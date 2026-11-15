// SPDX-License-Identifier: GPL-3.0-or-later
/** A source-owned response to character departure. Selectors and reasons are
 * explicit: a native ON_OWNER_FINISH mark can include retreats and leaks,
 * whereas a killed-only trait can pass reasons:['killed']. */
export function nearbyDepartureGains({radius,healRatio,atkPerStack,maxStacks,key,excludedBuffs=[],reasons=null}){
 if(![radius,healRatio,atkPerStack].every(Number.isFinite)||radius<0||healRatio<0||atkPerStack<0
  ||!Number.isSafeInteger(maxStacks)||maxStacks<1||typeof key!=='string'||!key
  ||!Array.isArray(excludedBuffs)||excludedBuffs.some(k=>typeof k!=='string'||!k)
  ||reasons!==null&&(!Array.isArray(reasons)||reasons.some(k=>typeof k!=='string'||!k)))throw Error('Invalid departure gain definition');
 return{
  spawn(b,e){
   const ownerLife=e.deploySeq;
   b.on('death',c=>{
    const u=c.unit;
    if(!e.alive||!e.deployed||e.deploySeq!==ownerLife||e.hidden||u===e||!u||u.hidden||!['ally','enemy'].includes(u.side)
     ||reasons&&!reasons.includes(c.reason)||Math.hypot(u.x-e.x,u.y-e.y)>radius+1e-9
     ||u.kind!=='enemy'&&(u.kind!=='op'||!['PIONEER','WARRIOR','TANK','SNIPER','CASTER','MEDIC','SUPPORT','SPECIAL'].includes(u.def.profession))
     ||excludedBuffs.some(k=>u.findBuff(k)))return;
    const life=e.deploySeq;b.heal(e,e,e.s.maxHp*healRatio,{self:true});
    if(!e.alive||!e.deployed||e.deploySeq!==life)return;
    b.addBuff(e,{key,source:e,refresh:'stack',stacks:1,maxStacks,persist:true,mods:{atkPct:atkPerStack}});
   },{owner:e,priority:1000});
  },
 };
}
/** Ordinary blocked melee and unblocked ranged hits can share the same
 * damage pipeline while keeping distinct source multipliers and clip names. */
export function blockedAttackMode({unblockedScale,blockedScale=1,unblockedClip,blockedClip}){
 if(![unblockedScale,blockedScale].every(Number.isFinite)||unblockedScale<0||blockedScale<0
  ||[unblockedClip,blockedClip].some(k=>k!==undefined&&(typeof k!=='string'||!k)))throw Error('Invalid blocked attack mode');
 return{
  before(c,_b,e){if(c.isSkill)return;const clip=e.blockedBy?blockedClip:unblockedClip;if(clip)e.profile.attackVisual=clip;},
  hitOut(c,_b,e){if(c.dmg.isAttack&&!c.dmg.isSkill)c.dmg.amount*=c.target===e.blockedBy?blockedScale:unblockedScale;},
 };
}
