// SPDX-License-Identifier: GPL-3.0-or-later
// Internal action composition; twins' lifecycle and stage admission stay gated.
import {installChapter17MuamaCombat} from './chapter17-muama-combat.js';
import {installChapter17MuamaLine} from './chapter17-muama-line.js';
import {installChapter17MuamaBlink} from './chapter17-muama-blink.js';
export function installChapter17MuamaActions(b,e,{stage}={}){
 if(b.finished||!e?.alive||!e.deployed||e.hidden||!Number.isFinite(e.deployedAt)||Math.abs(e.deployedAt-b.time)>1e-9)throw Error('Muama actions require a fresh live deployment');
 const life=e.deploySeq,old=e.mem.ch17MuamaActions;if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one Muama action composition');if(old?.active)old.stop();
 const handles=[],parts=[],state={active:true,ownerLife:life,combat:null,line:null,blink:null,
  stop(){if(!state.active)return;state.active=false;for(const part of [...parts].reverse())part.stop();for(const h of handles)b.off(h);if(e.mem.ch17MuamaActions===state)delete e.mem.ch17MuamaActions;},
 };
 e.mem.ch17MuamaActions=state;
 try{
  state.combat=installChapter17MuamaCombat(b,e,{stage});parts.push(state.combat);
  state.line=installChapter17MuamaLine(b,e,{combat:state.combat,stage});parts.push(state.line);
  state.blink=installChapter17MuamaBlink(b,e,{combat:state.combat,line:state.line,stage});parts.push(state.blink);
  handles.push(b.on('tick',()=>{if(!state.combat.valid()||parts.some(p=>!p.active))state.stop();},{owner:state,priority:100}),
   b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
  if(!parts.every(p=>p.active)||!state.combat.valid())throw Error('Muama action deployment retired during admission');
  return state;
 }catch(error){state.stop();throw error;}
}
