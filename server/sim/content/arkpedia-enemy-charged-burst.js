// SPDX-License-Identifier: GPL-3.0-or-later
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {enemyAttackTargets,sortAllyTargets,areaSelectable} from '../targeting.js';

/** A cooldown channel aimed at one ally within attack range: Begin, a Loop for
 * the skill's duration, then End, whose attack event bursts over a grid range
 * centred on the target's tile (its last tile if it has left). Every
 * selectable ally on those tiles takes the damage. While the cast lasts the
 * source is immune to Invisibility (shown here as a reveal of itself). */
export function chargedTileBurst(p){
 validate(p);
 const duration=p.phases.reduce((t,v)=>t+v.duration,0);
 const phaseAt=elapsed=>{let t=0;for(const v of p.phases){if(elapsed<t+v.duration-1e-9)return v;t+=v.duration;}return p.phases.at(-1);};
 const tileOf=u=>({row:Math.round(u.y),col:Math.round(u.x)});
 const reveal='ab:chargedBurstVisible';
 return timedEnemyCasts([{initial:p.initial,cooldown:p.cooldown,clip:p.phases[0].clip,duration,release:p.release,slowDown:false,
  select:(b,e)=>sortAllyTargets(e,enemyAttackTargets(b,e,p.radius).filter(u=>!p.groundOnly||!u.isFlying)).slice(0,1),
  start(b,e,c){c.tile=tileOf(c.targets[0]);c.attackId=++b._attackSeq;b.addBuff(e,{key:reveal,flags:{reveal:true}});},
  fire(b,e,targets){
   const c=e.mem.chargedBurstCast??{},t=targets[0];if(t?.alive&&t.deployed)c.tile=tileOf(t);if(!c.tile)return;
   const tiles=new Set(p.grids.map(g=>`${c.tile.row+g.row},${c.tile.col+g.col}`));
   for(const u of b.allies(null,{includeTargetableDevices:true}))
    if(tiles.has(`${Math.round(u.y)},${Math.round(u.x)}`)&&areaSelectable(e,u))
     b.dealDamage(e,u,{amount:e.s.atk*p.scale,type:p.type,isAttack:true,applyWay:'ranged',attackId:c.attackId,tags:['chargedBurst','splash']});
  },
  visual(b,e,c){
   e.mem.chargedBurstCast=c;const v=phaseAt(c.elapsed);
   if(e.mem.regularFormVisual?.clip!==v.clip)e.mem.regularFormVisual={...e.mem.regularFormVisual,clip:v.clip,loop:!!v.loop,playId:`chargedBurst:${c.attackId}:${v.clip}`};
  },
  finish(b,e){e.mem.chargedBurstCast=null;b.removeBuff(e,reveal);}}]);
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0;
 const total=Array.isArray(p?.phases)?p.phases.reduce((t,v)=>t+v?.duration,0):NaN;
 if(!p||!pos(p.cooldown)||!(Number.isFinite(p.initial)&&p.initial>=0)||!Array.isArray(p.phases)||!p.phases.length||p.phases.length>3
  ||p.phases.some(v=>!v||typeof v.clip!=='string'||!v.clip||!pos(v.duration))||!(Number.isFinite(p.release)&&p.release>=0&&p.release<=total)
  ||!pos(p.radius)||!pos(p.scale)||!['phys','arts','true'].includes(p.type)||typeof p.groundOnly!=='boolean'
  ||!Array.isArray(p.grids)||!p.grids.length||p.grids.length>64||p.grids.some(g=>!Number.isSafeInteger(g?.row)||!Number.isSafeInteger(g?.col)))throw Error('Invalid charged tile burst');
}
chargedTileBurst.validate=validate;
