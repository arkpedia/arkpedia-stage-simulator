// SPDX-License-Identifier: GPL-3.0-or-later
/** Independent sources recharge one named recipient barrier. Charge persists
 * after leaving the aura or losing a source; lowering Max HP does not discard
 * existing charge. Native predicates supply the exact selector and parameters. */
export function rechargingBarrierAura({key,interval,radius,addRate,maxRate,excludedBuffs=[],
  types=['phys','arts'],ignoreTargetFree=false,ignoreAllyTargetFree=false}){
  if(typeof key!=='string'||!key||![interval,radius,addRate,maxRate].every(Number.isFinite)||interval<=0||radius<0||addRate<0||maxRate<0
    ||!Array.isArray(excludedBuffs)||excludedBuffs.some(k=>typeof k!=='string'||!k)
    ||!Array.isArray(types)||!types.length||types.some(t=>!['phys','arts','true','elemental'].includes(t)))throw Error('Invalid barrier recharge definition');
  const eligible=(e,u)=>{
    if(!u.alive||!u.deployed||u.hidden||u.removed||u.side!==e.side||u.s.flags.sleep
      ||u.kind==='device'&&!u.profile?.enemyTargetableDevice&&!u.profile?.characterLikeDevice)return false;
    if(!ignoreTargetFree&&u.s.flags.untargetable||!ignoreAllyTargetFree&&u.s.flags.isolated)return false;
    return !excludedBuffs.some(k=>u.findBuff(k))&&Math.hypot(u.x-e.x,u.y-e.y)<=radius+1e-9;
  };
  return {
    spawn(_b,_e,a){a.elapsed=0;},
    tick(b,e,a,dt){
      if(!e.alive||!e.deployed||e.hidden||e.removed)return;
      a.elapsed+=dt;
      while(a.elapsed+1e-9>=interval){
        a.elapsed=Math.max(0,a.elapsed-interval);
        for(const u of b.units){
          if(!eligible(e,u))continue;
          let buff=u.findBuff(key);const charge=buff?.shield??0,cap=u.s.maxHp*maxRate;
          if(charge>=cap)continue;
          const amount=Math.min(cap,charge+u.s.maxHp*addRate);if(!(amount>charge))continue;
          if(buff){buff.shield=amount;u.markDirty();}
          else b.addBuff(u,{key,source:e,shield:amount,shieldTypes:[...types]});
        }
      }
    },
  };
}
