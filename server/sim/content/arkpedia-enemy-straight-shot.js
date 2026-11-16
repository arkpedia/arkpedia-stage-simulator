// SPDX-License-Identifier: GPL-3.0-or-later
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {canTargetAlly,sortAllyTargets,evadesGround} from '../targeting.js';
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

/** One straight bolt from the source toward a point, continuing past it. */
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
    b.dealDamage(e,u,{amount:e.alive?e.s.atk*p.scale:cached,type:p.type,isAttack:true,applyWay:'ranged',attackId,tags:['straightShot']});
   } else if(shot.age>=shot.maxAge-1e-9||end.x<-.5||end.y<-.5||end.x>size.cols-.5||end.y>size.rows-.5)shot.removed=true;
  }});
}

export function straightShot(p){
 validate(p);
 const aimOf=c=>{const t=c.targets[0];if(t?.alive&&t.deployed)c.aim={x:t.x,y:t.y};return c.aim;};
 const casts=timedEnemyCasts([{initial:p.initial,cooldown:p.cooldown,clip:p.clip,duration:p.duration,release:p.release,slowDown:true,
  select:(b,e)=>straightShotTargets(b,e,p.band),
  start(b,e,c){
   const t=c.targets[0];c.aim={x:t.x,y:t.y};c.fired=0;c.attackId=++b._attackSeq;e.mem.straightShotCast=c;
   const dy=t.y-e.y,clip=dy>.1?p.clip+'_Up':dy<-.1?p.clip+'_Down':p.clip;
   e.mem.regularFormVisual={...e.mem.regularFormVisual,clip};
  },
  // The first bolt leaves at the release event, the others one interval apart, while the cast lasts.
  fire(b,e){const c=e.mem.straightShotCast;if(!c)return;fireStraightBolt(b,e,aimOf(c),p,c.attackId);c.fired=1;},
  visual(b,e,c){
   while(c.fired>0&&c.fired<p.bolts&&c.elapsed+1e-9>=p.release+c.fired*p.interval){fireStraightBolt(b,e,aimOf(c),p,c.attackId);c.fired++;}
  },
  finish(_b,e){e.mem.straightShotCast=null;}}]);
 return casts;
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0;
 if(!p||!pos(p.cooldown)||!(Number.isFinite(p.initial)&&p.initial>=0)||typeof p.clip!=='string'||!p.clip||!pos(p.duration)||!(Number.isFinite(p.release)&&p.release>=0)
  ||!Number.isSafeInteger(p.bolts)||p.bolts<1||p.bolts>16||!(Number.isFinite(p.interval)&&p.interval>=0)||p.release+(p.bolts-1)*p.interval>p.duration
  ||!['phys','arts','true'].includes(p.type)||!pos(p.scale)||!pos(p.speed)||!pos(p.lifetime)||!pos(p.radius)||!pos(p.band))throw Error('Invalid Straight Shot');
}
straightShot.validate=validate;
