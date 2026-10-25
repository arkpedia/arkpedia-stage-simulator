// SPDX-License-Identifier: GPL-3.0-or-later
import {installChapter17MuamaActions} from './chapter17-muama-actions.js';
import {installChapter17MutwinLifecycle} from './chapter17-mutwin-lifecycle.js';
export function installChapter17MutwinCore(b,e,{finishRoom}={}){
 const life=e?.deploySeq,old=e?.mem?.ch17MutwinCore;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one twin core');if(old?.active)old.stop();
 const handles=[],parts=[],core={active:true,ownerLife:life,actions:null,lifecycle:null,
  stop(){if(!core.active)return;core.active=false;for(const part of [...parts].reverse())part.stop();for(const h of handles)b.off(h);if(e?.mem?.ch17MutwinCore===core)delete e.mem.ch17MutwinCore;},
 };
 try{
  core.actions=installChapter17MuamaActions(b,e);parts.push(core.actions);
  core.lifecycle=installChapter17MutwinLifecycle(b,e,{actions:core.actions,finishRoom});parts.push(core.lifecycle);e.mem.ch17MutwinCore=core;
  handles.push(b.on('tick',()=>{if(!core.lifecycle.valid())core.stop();},{owner:core,priority:300}),
   b.on('death',({unit})=>{if(unit===e)core.stop();},{owner:core,priority:-100}),b.on('battleEnd',()=>core.stop(),{owner:core}));return core;
 }catch(error){core.stop();throw error;}
}
