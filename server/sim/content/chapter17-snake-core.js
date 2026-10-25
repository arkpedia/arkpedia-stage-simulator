// SPDX-License-Identifier: GPL-3.0-or-later
// Compose the retained action phases; firewall/stage admission is still separate.
import {installChapter17SnakeLine} from './chapter17-snake-line.js';
import {installChapter17SnakeHealth} from './chapter17-snake-health.js';
import {installChapter17SnakeTerminal} from './chapter17-snake-terminal.js';
import {installChapter17SnakeTimeout} from './chapter17-snake-timeout.js';
export function installChapter17SnakeCore(b,e,{finishWave}={}){
 if(typeof finishWave!=='function'||!Number.isFinite(b.life))throw Error('Snake core requires canonical wave and ordinary-stage life receivers');
 if(b.finished||!e?.alive||!e.deployed||!Number.isFinite(e.deployedAt)||Math.abs(e.deployedAt-b.time)>1e-9)
  throw Error('Snake core must attach to a fresh live deployment');
 const old=e.mem.ch17SnakeCore,life=e.deploySeq;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake core');if(old?.active)old.stop();
 const handles=[],parts=[],core={active:true,ownerLife:life,line:null,health:null,terminal:null,timeout:null,
  stop(){
   if(!core.active)return;core.active=false;for(const part of [...parts].reverse())part.stop();
   for(const h of handles)b.off(h);if(e.mem.ch17SnakeCore===core)delete e.mem.ch17SnakeCore;
  },
 };
 e.mem.ch17SnakeCore=core;
 try{
  core.line=installChapter17SnakeLine(b,e);parts.push(core.line);
  core.health=installChapter17SnakeHealth(b,e,{interruptCurrent:receipt=>{
   if(!core.active||receipt.source!==e||receipt.sourceLife!==life)return;
   // No ordinary attack is admitted for this enemy. The only actor-owned cast
   // is GlobalLineAttack; palsy stacks are not a PALSY FSM and are not consumed.
   core.line.interrupt();
  }});parts.push(core.health);
  core.terminal=installChapter17SnakeTerminal(b,e,{finishWave:receipt=>{try{finishWave(receipt);}finally{core.stop();}}});parts.push(core.terminal);
  core.timeout=installChapter17SnakeTimeout(b,e);parts.push(core.timeout);
  handles.push(b.on('tick',()=>{if(b.finished||!e.alive||!e.deployed||e.deploySeq!==life||parts.some(part=>!part.active))core.stop();},{owner:core}),
   b.on('death',({unit})=>{if(unit===e)core.stop();},{owner:core}),b.on('removed',({unit})=>{if(unit===e)core.stop();},{owner:core}),
   b.on('battleEnd',()=>core.stop(),{owner:core}));
  if(!e.alive||!e.deployed||e.deploySeq!==life)throw Error('Snake core deployment retired during admission');
  return core;
 }catch(error){core.stop();throw error;}
}
