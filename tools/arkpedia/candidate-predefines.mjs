// SPDX-License-Identifier: GPL-3.0-or-later
// Existing candidate controllers do not implement predefined operator roles or
// tutorial card activation. Source retention must not flatten either into traps.
export function assertCandidatePredefines(source){
 const list=(value,label)=>{
  if(Array.isArray(value))return value;
  if(value==null||typeof value==='object'&&Object.keys(value).length===0)return[];
  throw Error('Invalid candidate predefined '+label);
 };
 const pre=source.rawLevel.predefines??{};
 if(list(pre.characterInsts,'operator instances').length)
  throw Error('Unsupported candidate predefined operator mechanics');
 if(list(source.geometry.suppliedUnits?.fixed_squad,'fixed squad').some(c=>c.hidden))
  throw Error('Unsupported candidate hidden operator-card activation');
 for(const w of source.rawLevel.waves??[])for(const f of w.fragments??[])for(const a of f.actions??[])
  if(a.actionType==='ACTIVATE_PREDEFINED'&&String(a.key).startsWith('char_'))
   throw Error('Unsupported candidate predefined operator-card activation');
}
