// SPDX-License-Identifier: GPL-3.0-or-later
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {canTargetAlly,sortAllyTargets,evadesGround,stealthOffKey,areaSelectable} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';
import {segmentCircleEntry} from '../projectile-collision.js';

/** Straight Shot: while unblocked, a cooldown skill selects one ally on the
 * same row or column (global range) and fires a burst of straight bolts toward
 * it. Each bolt hits the first eligible body in its path, not necessarily the
 * selected target, and stops there.
 *
 * Barricades and Exposed are read from the native selector fields: an ally
 * carrying the shelter mark is not selected unless it is also Exposed. A unit
 * carrying the Temporary Cover mark intercepts bolts. Neither device exists in
 * the simulator yet; stages that place them stay blocked by their devices. */
export const STRAIGHT_SHOT_MARKS=Object.freeze({shelter:'trap_sheltr_mark',exposed:'enemy_tgshd_exposed_mark',cover:'trap_ads_mark'});

/** Same row or column: the source lies inside the target tile's row or column band. */
export const onStraightLine=(e,u,band)=>Math.abs(u.x-e.x)<=band+1e-9||Math.abs(u.y-e.y)<=band+1e-9;

/** Selection for the shot: line of sight is blocked only by the shelter mark. */
export function straightShotTargets(b,e,band){
 if(e.blockedBy)return [];
 const cands=b.allies(null,{includeTargetableDevices:true}).filter(u=>canTargetAlly(e,u,true)&&onStraightLine(e,u,band)
  &&!(u.findBuff?.(STRAIGHT_SHOT_MARKS.shelter)&&!u.findBuff?.(STRAIGHT_SHOT_MARKS.exposed)));
 return sortAllyTargets(e,cands).slice(0,1);
}

// A bolt's passer-by check ignores stealth, camouflage and target-free status.
const passer=(e,u)=>u.alive&&u.deployed&&!u.hidden&&!u.s.flags.untargetable&&!u.s.flags.sleep&&!(u.s.flags.liftoff&&evadesGround(e,u))
 &&(u.kind!=='device'||u.profile?.enemyTargetableDevice||!!u.findBuff?.(STRAIGHT_SHOT_MARKS.cover));

/** One straight bolt from the source toward a point, continuing past it.
 * An optional status (the Ambushers' Stun) lands on the body it hits; an
 * optional blast (Mateo's guards) replaces that hit with damage to every
 * selectable ally within its radius of the contact point. */
export function fireStraightBolt(b,e,aim,p,attackId){
 const dx=aim.x-e.x,dy=aim.y-e.y,len=Math.hypot(dx,dy);
 if(!(len>1e-9))return null;
 const reach=p.speed*p.lifetime,cached=e.s.atk*p.scale,size=b.regularMapSize??b.grid;
 return b.addProjectile({from:e,source:e,to:{x:e.x+dx/len*reach,y:e.y+dy/len*reach},speed:p.speed,maxAge:p.lifetime,expireInPlace:true,visual:'arrow',
  data:{arkpediaTrackedVisual:true,straightShot:true},
  onMove({projectile:shot,previous,x,y}){
   const end={x,y};
   const hits=b.allies(null,{includeTargetableDevices:true}).flatMap(u=>{
    if(!passer(e,u))return [];
    const t=segmentCircleEntry(previous,end,u,p.radius+ALLY_COLLIDER_RADIUS);
    return t==null?[]:[{u,t}];
   }).sort((a,z)=>a.t-z.t||a.u.deploySeq-z.u.deploySeq);
   if(hits.length){
    const {u,t}=hits[0];shot.x=previous.x+(end.x-previous.x)*t;shot.y=previous.y+(end.y-previous.y)*t;shot.removed=true;
    const amount=e.alive?e.s.atk*p.scale:cached;
    if(p.blast){
     for(const v of b.alliesInRadius(shot.x,shot.y,p.blast+ALLY_COLLIDER_RADIUS).filter(v=>areaSelectable(e,v)))
      b.dealDamage(e,v,{amount,type:p.type,isAttack:true,applyWay:'ranged',attackId,tags:['straightShot','splash']});
     return;
    }
    b.dealDamage(e,u,{amount,type:p.type,isAttack:true,applyWay:'ranged',attackId,tags:['straightShot']});
    if(p.hitStatus&&u.alive)b.applyStatus(u,p.hitStatus.status,{duration:p.hitStatus.duration,source:e,sourceStatusResistable:2});
   } else if(shot.age>=shot.maxAge-1e-9||end.x<-.5||end.y<-.5||end.x>size.cols-.5||end.y>size.rows-.5)shot.removed=true;
  }});
}

/** Phases play in order (one plain clip, or Begin/Loop/End); a vertical
 * target selects the phase's _Up/_Down variant for the whole cast. */
export function straightShot(p){
 validate(p);
 const duration=p.phases.reduce((t,v)=>t+v.duration,0);
 const aimOf=c=>{const t=c.targets[0];if(t?.alive&&t.deployed)c.aim={x:t.x,y:t.y};return c.aim;};
 const phaseAt=elapsed=>{let t=0;for(const v of p.phases){if(elapsed<t+v.duration-1e-9)return v;t+=v.duration;}return p.phases.at(-1);};
 const show=(e,c)=>{const v=phaseAt(c.elapsed),clip=v.clip+c.suffix;
  if(e.mem.regularFormVisual?.clip!==clip)e.mem.regularFormVisual={...e.mem.regularFormVisual,clip,loop:!!v.loop,playId:`straightShot:${c.attackId}:${clip}`};};
 // Native Invisible toggle: off while the cast lasts, back after its restore delay.
 const stealthOff=(b,e,duration)=>{if(!p.stealth)return;b.removeBuff(e,stealthOffKey(p.stealth.key));
  if(duration!==0)b.addBuff(e,{key:stealthOffKey(p.stealth.key),...(duration?{duration}:{}),flags:{stealthOff:true}});};
 const casts=timedEnemyCasts([{initial:p.initial,cooldown:p.cooldown,clip:p.phases[0].clip,duration,release:p.releases[0],slowDown:true,
  select:(b,e)=>straightShotTargets(b,e,p.band),
  start(b,e,c){
   const t=c.targets[0],dy=t.y-e.y;c.aim={x:t.x,y:t.y};c.fired=0;c.attackId=++b._attackSeq;e.mem.straightShotCast=c;
   c.suffix=dy>.1?'_Up':dy<-.1?'_Down':'';stealthOff(b,e,null);
  },
  // One bolt per release time (an attack event, or an interval after the first), while the cast lasts.
  fire(b,e){const c=e.mem.straightShotCast;if(!c)return;fireStraightBolt(b,e,aimOf(c),p,c.attackId);c.fired=1;},
  visual(b,e,c){
   show(e,c);
   while(c.fired>0&&c.fired<p.releases.length&&c.elapsed+1e-9>=p.releases[c.fired]){fireStraightBolt(b,e,aimOf(c),p,c.attackId);c.fired++;}
  },
  finish(b,e){e.mem.straightShotCast=null;if(e.alive)stealthOff(b,e,p.stealth?.restoreDelay??0);}}]);
 return casts;
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0,name=v=>typeof v==='string'&&!!v&&v.length<=256;
 const total=Array.isArray(p?.phases)?p.phases.reduce((t,v)=>t+v?.duration,0):NaN;
 if(!p||!pos(p.cooldown)||!(Number.isFinite(p.initial)&&p.initial>=0)||!Array.isArray(p.phases)||!p.phases.length||p.phases.length>3
  ||p.phases.some(v=>!v||!name(v.clip)||!pos(v.duration)||(v.loop!==undefined&&typeof v.loop!=='boolean'))
  ||!Array.isArray(p.releases)||!p.releases.length||p.releases.length>16||p.releases.some((t,i)=>!(Number.isFinite(t)&&t>=0&&t<=total)||i&&t<p.releases[i-1])
  ||p.blast!==undefined&&!pos(p.blast)||p.blast!==undefined&&p.hitStatus!==undefined
  ||!['phys','arts','true'].includes(p.type)||!pos(p.scale)||!pos(p.speed)||!pos(p.lifetime)||!pos(p.radius)||!pos(p.band)
  ||p.hitStatus!==undefined&&(!p.hitStatus||!['stun'].includes(p.hitStatus.status)||!pos(p.hitStatus.duration))
  ||p.stealth!==undefined&&(!p.stealth||!name(p.stealth.key)||!(Number.isFinite(p.stealth.restoreDelay)&&p.stealth.restoreDelay>=0)))throw Error('Invalid Straight Shot');
}
straightShot.validate=validate;
