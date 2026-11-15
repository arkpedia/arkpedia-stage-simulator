// SPDX-License-Identifier: GPL-3.0-or-later
/** Independent damage-type counters share the accepted-damage receipt. The
 * current packet has already been mitigated; later packets see the new stats. */
export function damageAdaptation({channels,taunt=0}){
  return {spawn(b,e,a){
    a.counts=Object.fromEntries(channels.map(c=>[c.type,0]));
    const refresh=()=>b.addBuff(e,{key:'ab:damageAdaptation',persist:true,mods:Object.assign({taunt},
      ...channels.map(c=>({[c.attribute]:c.amount*a.counts[c.type]/c.cap})))});
    refresh();b.on('calculatedDamage',c=>{
      if(c.target!==e||!e.alive||!e.deployed||e.hidden)return;
      const channel=channels.find(x=>x.type===c.dmg.type);if(!channel)return;
      if(a.counts[channel.type]>=channel.cap)return;
      a.counts[channel.type]++;refresh();
    },{owner:e});
  }};
}
