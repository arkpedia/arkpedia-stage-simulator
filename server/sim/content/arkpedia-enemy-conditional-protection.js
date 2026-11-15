// SPDX-License-Identifier: GPL-3.0-or-later
export function unblockedSanctuary({reduction,key='lysytc[damage_resistance]',suppressedBy='lysytc[damage_reduce]',silenceable=false}) {
  const update=(b,e)=>{
    if(e.blockedBy||silenceable&&e.s.flags.silence)b.removeBuff(e,key);
    else if(!e.findBuff(key)&&!(suppressedBy&&e.findBuff(suppressedBy)))b.applyStatus(e,'sanctuary',{key,source:e,value:reduction});
  };
  return {
    spawn(b,e){update(b,e);for(const event of ['blocked','unblocked'])b.on(event,({enemy})=>{if(enemy===e)update(b,e);},{owner:e});},
    tick:update,status:(_c,b,e)=>update(b,e),
  };
}
