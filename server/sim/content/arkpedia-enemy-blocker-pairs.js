// SPDX-License-Identifier: GPL-3.0-or-later
/** A source-owned paired-marker block condition and blocker-side polling
 * effect. Each relationship owns a separate checker instance and cleanup. */
export function pairedBlockerBuffs({blockerBuffKey,blockeeBuffKey,checkBuffKey,interval}){
  if([blockerBuffKey,blockeeBuffKey,checkBuffKey].some(k=>typeof k!=='string'||!k)||!Number.isFinite(interval)||interval<=0)
    throw Error('Invalid paired blocker buffs');
  const clear=(b,a)=>{
    const prior=a.binding;a.binding=null;
    if(prior)b.removeBuff(prior.blocker,prior.buff);
  };
  return{
    spawn(b,e){
      if(e.profile.blockerBuffPairs)throw Error('Blocker buff pair condition already installed');
      e.profile.blockerBuffPairs=[{blockerBuffKey,blockeeBuffKey}];
      b.addBuff(e,{key:blockeeBuffKey,source:e,persist:true});
    },
    blocked(c,b,e,a){
      clear(b,a);const blocker=c.blocker,life=e.deploySeq;
      if(!blocker||e.blockedBy!==blocker)return;
      const check=({unit,buff})=>{
        if(a.binding?.buff!==buff)return;
        if(!e.alive||!e.deployed||e.deploySeq!==life||e.blockedBy!==unit){clear(b,a);return;}
        if(e.findBuff(blockeeBuffKey)&&!unit.findBuff(blockerBuffKey))b._unblock(e);
      };
      const buff=b.addBuff(blocker,{key:checkBuffKey,source:e,refresh:'independent',maxStacks:Number.MAX_SAFE_INTEGER,
        interval,onTick:check});
      if(!buff)return;
      a.binding={blocker,buff};
      // Native waitFirstTriggerInterval=false checks on attachment, then at
      // the fixed interval. The clock belongs to the blocker, not the enemy.
      check({unit:blocker,buff});
    },
    unblocked(_c,b,_e,a){clear(b,a);},
    death(_c,b,_e,a){clear(b,a);},
  };
}
