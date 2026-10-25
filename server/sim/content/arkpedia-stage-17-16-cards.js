// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit canonical action receiver. Dialog/fragment clocks and stage
// admission remain separate: this module does not schedule its own deliveries.
import source from '../../../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{ptilopsisStageBuild,ptilopsisStageRecord}from'./arkpedia-ptilopsis-stage-module.js';
import{poncirusStageBuild,poncirusStageRecord}from'./arkpedia-poncirus-stage-module.js';
import{kestrelStageBuild,kestrelStageRecord}from'./arkpedia-kestrel-stage-module.js';
import{mulberryStageBuild,mulberryStageRecord}from'./arkpedia-mulberry-stage-module.js';
const retained=JSON.stringify(source),owners=new WeakMap(),factories=[
 [mulberryStageBuild,mulberryStageRecord],[ptilopsisStageBuild,ptilopsisStageRecord],
 [kestrelStageBuild,kestrelStageRecord],[poncirusStageBuild,poncirusStageRecord],
];
export function installStage17_16Cards(b,data,{tutorial=source}={}){
 if(JSON.stringify(tutorial)!==retained)throw Error('Unreviewed 17-16 predefined card source');
 if(b.finished||b._endReq||b.time!==0||owners.has(b)||typeof b.data.registerChessRecords!=='function')throw Error('Predefined cards require a fresh battle data source');
 const rows=factories.map(([buildFor,recordFor])=>{
  const build=buildFor(),cards=tutorial.predefines.characterCards.filter(c=>c.inst.characterKey===build.id),actions=tutorial.actions.filter(r=>r.action.actionType==='ACTIVATE_PREDEFINED'&&r.action.key===cards[0]?.alias);
  if(cards.length!==1||cards[0].hidden!==true||cards[0].alias!==build.id+'#1'||actions.length!==1
   ||b.bench[build.id]||b.data.rawChess(build.id)||b.allyUnits.some(u=>u.defId===build.id))throw Error('Predefined card conflicts with a selected role');
  return{build:Object.freeze(build),alias:cards[0].alias,action:actions[0].action,record:recordFor(build,data),entry:null};
 });
 if(tutorial.predefines.characterCards.length!==rows.length)throw Error('Unreviewed extra predefined card');
 b.data.registerChessRecords(Object.fromEntries(rows.map(r=>[r.build.id,r.record])));
 let stopped=false;
 const controller={
  cards:()=>rows.map(r=>({id:r.build.id,alias:r.alias,active:!!r.entry})),
  receive(action){
   const row=rows.find(r=>JSON.stringify(r.action)===JSON.stringify(action));
   if(!row)throw Error('Unreviewed predefined card activation action');
   if(stopped||b.finished||b._endReq)return{status:'cancelled',alias:row.alias};
   if(b.data.rawChess(row.build.id)!==records.get(row.build.id))throw Error('Predefined card registration was replaced');
   if(row.entry){
    if(b.bench[row.build.id]!==row.entry||row.entry.build!==row.build)throw Error('Predefined card entry was replaced');
    return{status:'already-active',alias:row.alias,id:row.build.id};
   }
   if(b.bench[row.build.id])throw Error('Predefined card registration was replaced');
   row.entry={build:row.build,unit:null,deployments:0,readyAt:0,lastCost:0,predefinedAlias:row.alias};
   b.bench[row.build.id]=row.entry;
   return{status:'activated',alias:row.alias,id:row.build.id};
  },
  stop(){if(stopped)return;stopped=true;b.off(handle);},
 };
 const records=new Map(rows.map(r=>[r.build.id,b.data.rawChess(r.build.id)])),handle=b.on('battleEnd',()=>controller.stop(),{owner:controller});
 owners.set(b,controller);return controller;
}
