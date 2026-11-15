// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
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
  return chargedMeleeEffect({initialSp,cost,increment,maxSp,silenceBlocksSpend,attackAnim},(b,e,target)=>{
    const profession=target.kind==='token'?'TOKEN':target.kind==='device'?'TRAP':target.def?.profession??target.def?.raw?.profession;
    if(!(effectSilenceable&&e.s.flags.silence)&&!excluded.has(profession))
      attachPeriodicLoss(b,e,target,{key,amount,duration,interval,firstDelay});
  });
}

function validateCharge({initialSp,cost,increment,maxSp,silenceBlocksSpend,attackAnim}){
  if(![initialSp,cost,increment,maxSp].every(Number.isFinite)||initialSp<0||cost<=0||maxSp<cost||initialSp>maxSp||increment<0
    ||typeof silenceBlocksSpend!=='boolean')throw Error('Invalid charged melee program charge');
  if(attackAnim&&(!Number.isFinite(attackAnim.dur)||attackAnim.dur<=0||!Number.isFinite(attackAnim.hit)||attackAnim.hit<0||attackAnim.hit>attackAnim.dur))
    throw Error('Invalid charged melee program animation');
}
function chargedMeleeEffect(params,onHit){
  validateCharge(params);
  const {initialSp,cost,increment,maxSp,silenceBlocksSpend,attackAnim}=params;
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
        if(charged&&accepted&&target.alive&&target.deployed&&target.deploySeq===life)onHit(b,e,target);
      }
    },
  });
  return chargedAttacks(attack(false),attack(true),{initialSp,cost,increment,maxSp,silenceBlocksSpend,respectNoSp:true});
}

/** Native decisions and payloads are data; the shared attack transport keeps
 * accepted-hit and attack-recovery semantics for both old and new plans. */
export function chargedMeleeBuffProgram(params){
  const program=validateChargedProgram(params),blackboard=program.validateBlackboard(params.blackboard);
  return chargedMeleeEffect(params,(battle,unit,target)=>program.run('ON_AFTER_OUTPUT_DAMAGE',{battle,unit,target,blackboard}));
}
function validateChargedProgram(params){
  if(Object.hasOwn(params,'programComponent'))throw Error('Unhydrated behaviour program component');
  const program=prepareBehaviorProgram(params.program);program.validateBlackboard(params.blackboard);validateCharge(params);
  return program;
}
chargedMeleeBuffProgram.validate=validateChargedProgram;

chargedMeleeBuffProgram.decodeParameters=decodeBehaviorParameters;
