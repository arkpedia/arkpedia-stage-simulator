// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
export function fluxConditionalAttack({ranged,scale,attackAnim}) {
  const bonus=(b,e,target,{amount,attackId})=>{
    if(b.stageMagicCircuit?.contains(target))return;
    b.dealDamage(e,target,{amount:amount*scale,type:ranged?'phys':'arts',isAttack:true,noSp:true,attackId,
      applyWay:'melee',tags:['fluxConditionalBonus']});
  };
  const shot=projectileSingleAttack({speed:10,lifetime:5,type:'phys',onImpact:bonus});
  return {
    spawn(b,e){e.def={...e.def,attackAnim};e.profile.deferHit=true;e.profile.shot='none';if(ranged)shot.spawn(b,e);},
    attack(c,b,e){
      if(ranged)return shot.attack(c,b,e);
      const amount=e.s.atk,attackId=b._attackSeq;
      for(const target of c.targets){const life=target.deploySeq;
        b.dealDamage(e,target,{amount,type:'phys',isAttack:true,attackId,applyWay:'melee'});
        if(target.alive&&target.deployed&&target.deploySeq===life)bonus(b,e,target,{amount,attackId});
      }
    },
  };
}

export function fluxColossus({def,res}) {
  const update=(b,e)=>{
    const inside=b.stageMagicCircuit?.coversPosition(e.y,e.x) ?? false,key='enemy_ltgint_t[weak]';
    if(inside&&!e.findBuff(key))b.addBuff(e,{key,mods:{defFlat:def,resFlat:res},visible:true});
    else if(!inside)b.removeBuff(e,key);
  };
  return {spawn:update,tick:update};
}
