// SPDX-License-Identifier: GPL-3.0-or-later
// Native c2e_cold layers share one flag/debuff and spend each pairing credit once.
// Legacy Gnosis keys remain compatible with existing source-owned Freeze holders.
export function syncSourceColdSpeed(b,e) {
 const cold=e.buffs.filter(buff=>buff.status==='cold');
 for(const buff of cold)if(buff.mods?.aspd){buff.mods={...buff.mods,aspd:0};e.markDirty();}
 if(cold.length&&!e.s.flags.freeze){if(!e.findBuff('gnosis:cold-aspd'))b.addBuff(e,{key:'gnosis:cold-aspd',mods:{aspd:-30}});}
 else b.removeBuff(e,'gnosis:cold-aspd');
}
function observe(b,e) {
 let state=b._sourceColdLayers;
 if(!state){state=b._sourceColdLayers={targets:new Set(),handles:[]};}
 state.targets.add(e);
 if(state.handles.length)return;
 const stop=()=>{for(const h of state.handles)b.off(h);state.handles=[];state.targets.clear();};
 state.handles.push(b.on('tick',()=>{
  for(const target of state.targets){syncSourceColdSpeed(b,target);
   if(!target.alive||!target.deployed||!target.buffs.some(v=>v.status==='cold'))state.targets.delete(target);}
  if(!state.targets.size)stop();
 }),b.on('battleEnd',stop));
}
export function applySourceCold(b,u,e,duration) {
 const old=e.buffs.find(v=>v.status==='cold'&&!v.data.gnosisPaired&&!v.data.sourceColdPaired);
 const owned=`source:cold:${b._sourceColdSeq=(b._sourceColdSeq??0)+1}`;
 if(!b.applyStatus(e,'cold',{duration,source:u,key:owned,coldPairing:'independent'}))return false;
 const added=e.findBuff(owned);
 if(old&&e.buffs.includes(old)&&added&&!e.def.immune.has('frozen')){
  old.data.gnosisPaired=added.data.gnosisPaired=true;
  old.data.sourceColdPaired=added.data.sourceColdPaired=true;
  b.applyStatus(e,'freeze',{duration:Math.max(old.timeLeft,added.timeLeft),source:u,resistApplied:true});
 }
 syncSourceColdSpeed(b,e);observe(b,e);return true;
}
