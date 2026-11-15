// SPDX-License-Identifier: GPL-3.0-or-later
import {makeDamageInfo} from '../damage.js';
import {chargedAttacks} from './arkpedia-enemy-projectiles.js';

/** A retained, fixed HP-loss clock. Refresh extends the existing instance;
 * source death, healing, silence and control do not remove an attached effect. */
export function attachPeriodicLoss(b,source,target,{key,amount,duration,interval,firstDelay}) {
  return b.addBuff(target,{key,source,duration,refresh:'extend',interval,firstTickDelay:firstDelay,visible:true,sourceStatusResistable:false,
    onTick:({unit})=>b.loseHp(unit,amount,{source,tags:[key,'dot']})});
}

/** Attack-recovery selection reuses the common charge helper. Physical melee
 * damage resolves through the ordinary pipeline; only an accepted charged
 * packet may attach the independent, profession-filtered loss effect. */
export function chargedMeleePeriodicLoss({initialSp,cost,increment,maxSp,key,amount,duration,interval,firstDelay,
  excludedProfessions=[],silenceBlocksSpend=true,effectSilenceable=true,attackAnim}) {
  if(![initialSp,cost,increment,maxSp,amount,duration,interval,firstDelay].every(Number.isFinite)
    ||initialSp<0||cost<=0||maxSp<cost||initialSp>maxSp||increment<0||amount<0||duration<=0||interval<=0||firstDelay<0
    ||typeof key!=='string'||!key||!Array.isArray(excludedProfessions)||excludedProfessions.some(p=>typeof p!=='string')
    ||typeof silenceBlocksSpend!=='boolean'||typeof effectSilenceable!=='boolean')throw Error('Invalid charged melee periodic loss');
  const excluded=new Set(excludedProfessions);
  const attack=charged=>({
    spawn(_b,e){e.profile.deferHit=true;e.profile.shot='none';if(attackAnim)e.def={...e.def,attackAnim};},
    attack(c,b,e){
      for(const target of c.targets){
        if(!e.alive||!target.alive||!target.deployed)continue;
        const life=target.deploySeq;
        const packet=makeDamageInfo({amount:e.s.atk*(e.profile.atkScale??1),type:'phys',isAttack:true,
          attackId:b._attackSeq,applyWay:'melee'});
        let accepted=false;
        const off=charged?b.on('calculatedDamage',receipt=>{if(receipt.dmg===packet)accepted=true;}):null;
        try{b.dealDamage(e,target,packet);}finally{if(off)b.off(off);}
        const profession=target.kind==='token'?'TOKEN':target.kind==='device'?'TRAP':target.def?.profession??target.def?.raw?.profession;
        if(charged&&accepted&&target.alive&&target.deployed&&target.deploySeq===life
          &&!(effectSilenceable&&e.s.flags.silence)&&!excluded.has(profession))
          attachPeriodicLoss(b,e,target,{key,amount,duration,interval,firstDelay});
      }
    },
  });
  return chargedAttacks(attack(false),attack(true),{initialSp,cost,increment,maxSp,silenceBlocksSpend,respectNoSp:true});
}
