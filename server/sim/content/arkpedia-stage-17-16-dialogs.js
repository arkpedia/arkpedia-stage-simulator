// SPDX-License-Identifier: GPL-3.0-or-later
// Internal source instruction receiver. Combat suspension until presentation
// completion is an explicit regular-engine mapping, not compiled clock/frame
// proof. No absolute wave/fragment dispatch or stage admission is enabled here.
import tutorial from '../../../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{applyViyTutorialSp}from'./arkpedia-viy-predefined.js';
const retained=JSON.stringify(tutorial),owners=new WeakMap();
export const ownsStage17_16Dialogs=(b,controller)=>{const entry=owners.get(b);return!!entry&&entry.controller===controller&&entry.active();};
export function installStage17_16Dialogs(b,{source=tutorial}={}){
 if(JSON.stringify(source)!==retained)throw Error('Unreviewed 17-16 dialog source');
 source=structuredClone(source);
 if(b.finished||b._endReq||b.time!==0||owners.has(b)||typeof b.acquireSimulationHold!=='function')throw Error('Source dialog receiver requires a fresh battle');
 const actions=source.actions.filter(r=>['DIALOG','STORY'].includes(r.action.actionType)).map(r=>r.action),completed=new Set();
 let stopped=false,active=null,pending=null,hold=null;
 const pump=()=>{
  const instructions=source.scripts[active.action.key].instructions;
  while(active.index<instructions.length){
   const instruction=instructions[active.index];
   if(instruction.kind==='header'){active.index++;continue;}
   if(instruction.kind==='end')break;
   if(!['cameraFocus','dialogue','cameraReset'].includes(instruction.kind))throw Error('Unsupported source dialog presentation instruction');
   pending=Object.freeze({receipt:Object.freeze({}),scriptKey:active.action.key,index:active.index,instruction:Object.freeze(structuredClone(instruction))});return;
  }
  completed.add(JSON.stringify(active.action));active=null;pending=null;hold.release();hold=null;
 };
 const controller={
  state:()=>stopped||b.finished||b._endReq?null:pending,
  receive(action){
   const identity=JSON.stringify(action),selected=actions.find(a=>JSON.stringify(a)===identity);
   if(!selected)throw Error('Unreviewed 17-16 dialog/story action');
   if(stopped||b.finished||b._endReq)return{status:'cancelled'};
   if(completed.has(identity))return{status:'already-complete'};
   if(active){if(JSON.stringify(active.action)===identity)return{status:'pending',state:pending};throw Error('An owned source dialog is still pending');}
   if(selected.actionType==='STORY'){
    const operation=applyViyTutorialSp(b,{key:selected.key,source});completed.add(identity);return{status:'complete',operation};
   }
   hold=b.acquireSimulationHold(controller);active={action:selected,index:0};pump();return{status:'pending',state:pending};
  },
  complete(receipt){
   if(stopped||b.finished||b._endReq||!pending||pending.receipt!==receipt)return false;
   pending=null;active.index++;pump();return true;
  },
  stop(){if(stopped)return;stopped=true;pending=null;active=null;hold?.release();hold=null;b.off(handle);},
 };
 const handle=b.on('battleEnd',()=>controller.stop(),{owner:controller});owners.set(b,{controller,active:()=>!stopped});return Object.freeze(controller);
}
