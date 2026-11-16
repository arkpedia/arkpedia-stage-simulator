// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
/** A source-owned paired-marker block condition and blocker-side polling
 * effect. Each relationship owns a separate checker instance and cleanup. */
export function pairedBlockerBuffs({blockerBuffKey,blockeeBuffKey,pairs,checkBuffKey,interval,immediate=true,program,blackboard={}}){
  validatePair({blockerBuffKey,blockeeBuffKey,pairs,checkBuffKey,interval,immediate,program});
  // Several native pairs describe markers owned elsewhere (for example a shared attribute account):
  // this component then neither attaches a blockee marker nor has a marker-only fallback release.
  const compiled=program===undefined?null:prepareBehaviorProgram(program);
  compiled?.validateServices([]);compiled?.validateBlackboard(blackboard);
  const clear=(b,a)=>{
    const prior=a.binding;a.binding=null;
    if(prior)b.removeBuff(prior.blocker,prior.buff);
  };
  return{
    spawn(b,e){
      if(e.profile.blockerBuffPairs)throw Error('Blocker buff pair condition already installed');
      e.profile.blockerBuffPairs=pairs?pairs.map(p=>({...p})):[{blockerBuffKey,blockeeBuffKey}];
      if(!pairs)b.addBuff(e,{key:blockeeBuffKey,source:e,persist:true});
    },
    blocked(c,b,e,a){
      clear(b,a);const blocker=c.blocker,life=e.deploySeq;
      if(!blocker||e.blockedBy!==blocker)return;
      const check=({unit,buff})=>{
        if(a.binding?.buff!==buff)return;
        if(!e.alive||!e.deployed||e.deploySeq!==life||e.blockedBy!==unit){clear(b,a);return;}
        if(compiled){compiled.run('ON_BUFF_TRIGGER',{battle:b,unit,source:e,blackboard});return;}
        if(e.findBuff(blockeeBuffKey)&&!unit.findBuff(blockerBuffKey))b._unblock(e);
      };
      const buff=b.addBuff(blocker,{key:checkBuffKey,source:e,refresh:'independent',maxStacks:Number.MAX_SAFE_INTEGER,
        interval,onTick:check});
      if(!buff)return;
      a.binding={blocker,buff};
      // Native waitFirstTriggerInterval=false checks on attachment, then at
      // the fixed interval; true waits one interval first. The clock belongs
      // to the blocker, not the enemy.
      if(immediate)check({unit:blocker,buff});
    },
    unblocked(_c,b,_e,a){clear(b,a);},
    death(_c,b,_e,a){clear(b,a);},
  };
}

pairedBlockerBuffs.validate=params=>{
  if(Object.hasOwn(params,'programComponent'))throw Error('Unhydrated behaviour program component');
  validatePair(params);
  if(Object.hasOwn(params,'program')){const p=prepareBehaviorProgram(params.program);p.validateServices([]);p.validateBlackboard(params.blackboard??{});}
};

pairedBlockerBuffs.decodeParameters=decodeBehaviorParameters;

function validatePair({blockerBuffKey,blockeeBuffKey,pairs,checkBuffKey,interval,immediate=true,program}){
  const text=k=>typeof k==='string'&&!!k&&k.length<=256;
  if(pairs!==undefined){
    if(blockerBuffKey!==undefined||blockeeBuffKey!==undefined||program===undefined||!Array.isArray(pairs)||!pairs.length||pairs.length>16
      ||pairs.some(p=>!p||Object.keys(p).sort().join()!=='blockeeBuffKey,blockerBuffKey'||!text(p.blockerBuffKey)||!text(p.blockeeBuffKey)))throw Error('Invalid paired blocker buffs');
  }else if(![blockerBuffKey,blockeeBuffKey].every(text))throw Error('Invalid paired blocker buffs');
  if(!text(checkBuffKey)||typeof immediate!=='boolean'||!Number.isFinite(interval)||interval<=0)
    throw Error('Invalid paired blocker buffs');
}
