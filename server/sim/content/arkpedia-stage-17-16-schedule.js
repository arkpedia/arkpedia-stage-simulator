// SPDX-License-Identifier: GPL-3.0-or-later
// Internal exact-source composition. Wave clearance and pause are explicit
// regular-engine mappings, not native scheduler/FSM proof or stage admission.
import contract from'../../../data/candidates/arkpedia-17-16-schedule-contract.json' with{type:'json'};
import{jsonSourceDigest}from'../../../shared/arkpedia/source-digest.js';
import{ownsStage17_16Dialogs}from'./arkpedia-stage-17-16-dialogs.js';
import{ownsStage17_16Cards}from'./arkpedia-stage-17-16-cards.js';
import{hasCurrentViyPredefined}from'./arkpedia-viy-predefined.js';
const owners=new WeakMap(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function stage17_16SchedulePlan(source=contract){
 if(jsonSourceDigest(source)!=='3e3b4de94c8ed4cab79e33e159e3b7d7cbb45cd9d1fed45a49a44b79d5938f58')throw Error('Unreviewed 17-16 schedule source');
 return structuredClone(source);
}
export function installStage17_16Schedule(b,{dialogs,cards,source=contract}={}){
 const plan=stage17_16SchedulePlan(source),ending=()=>b.finished||!!b._endReq;
 if(ending()||b.time!==0||owners.has(b)||b._pending.length||b.enemies.length||b.total!==0||b.simulationHeld
  ||!ownsStage17_16Dialogs(b,dialogs)||!ownsStage17_16Cards(b,cards)||!hasCurrentViyPredefined(b)||dialogs.state()||cards.cards().some(r=>r.active))throw Error('17-16 schedule requires fresh owned stage receivers');
 if(!same(b.rect,plan.layout.rect)||!same(b.routes,plan.layout.routes)||!same(b.grid.stage.rows,plan.layout.stage.rows)||!same(b.grid.stage.legend,plan.layout.stage.legend)
  ||b.flags.moveScale!==plan.moveScale)throw Error('17-16 schedule requires its source layout and movement scale');
 const checkOverrides=()=>{if(Object.keys(plan.records).some(k=>b.enemyOverrides[k]))throw Error('Unreviewed 17-16 enemy override');};checkOverrides();
 let active=true,reason=null,wave=0,startedAt=null,waveStartedAt=null,cursor=0,timer=null;
 const history=[],batches=[],spawns=plan.waves.map(w=>w.actions.filter(r=>r.action.actionType==='SPAWN'));
 const stop=why=>{
  if(!active)return;active=false;reason=why;timer?.cancel();batches.forEach(batch=>batch.cancel());dialogs.stop();cards.stop();b.off(endHandle);
  if(['cancelled','error'].includes(why)&&!ending())b.forceEnd();
 };
 const controller=Object.freeze({
  state:()=>Object.freeze({active,reason,wave,startedAt,waveStartedAt,pendingSpawns:batches.reduce((n,r)=>n+r.pendingCount,0),history:Object.freeze([...history])}),
  spawned:()=>Object.freeze(batches.flatMap((batch,i)=>batch.spawned.map(r=>Object.freeze({...r,wave:i,action:structuredClone(spawns[i][r.index])})))),
  stop:()=>stop('cancelled'),
 });
 const endHandle=b.on('battleEnd',()=>stop('ended'),{owner:controller});
 for(const[i,w]of plan.waves.entries())batches.push(b.reserveEnemySpawns(spawns[i].map(({time,action})=>({time,enemyKey:action.key,def:plan.records[action.key],route:plan.layout.routes[action.routeIndex],ownerPlayerId:'arkpedia'})),controller));
 const beginWave=()=>{waveStartedAt=b.time;cursor=0;batches[wave].activate();history.push(Object.freeze({kind:'wave-start',wave,time:b.time}));};
 const pump=()=>{
  timer=null;if(!active)return;if(ending()){stop('ended');return;}
  try{
   checkOverrides();if(startedAt===null){startedAt=b.time;beginWave();}
   const w=plan.waves[wave],actions=w.actions.filter(r=>r.action.actionType!=='SPAWN');
   while(cursor<actions.length&&actions[cursor].time<=b.time-waveStartedAt+1e-8){
    const entry=actions[cursor++],action=entry.action,result=action.actionType==='ACTIVATE_PREDEFINED'?cards.receive(action):dialogs.receive(action);
    if(result.status==='cancelled'||result.operation?.status==='cancelled')throw Error('17-16 source action receiver was retired');
    history.push(Object.freeze({kind:action.actionType,wave,time:b.time,offset:entry.time,key:action.key}));
    if(ending()||b.simulationHeld)break;
   }
   if(ending()){stop('ended');return;}
   const batch=batches[wave],born=batch.spawned;
   if(!batch.pendingCount&&born.length!==spawns[wave].length)throw Error('17-16 reserved enemy spawn failed');
   if(born.some(r=>!r.unit||r.unit.deploySeq!==r.unitLife))throw Error('17-16 managed enemy deployment was replaced');
   if(!b.simulationHeld&&cursor===actions.length&&!batch.pendingCount&&born.length===spawns[wave].length&&born.every(r=>!r.unit.alive||!r.unit.deployed||r.unit.removed)){
    history.push(Object.freeze({kind:'wave-finish',wave,time:b.time}));
    if(wave===plan.waves.length-1){stop('complete');return;}
    wave++;beginWave();
   }
  }catch(error){stop('error');throw error;}
  if(active)timer=b.after(b.simulationHeld?0:b.dt,pump,{owner:controller,holdsBattle:true});
 };
 owners.set(b,controller);timer=b.after(0,pump,{owner:controller,holdsBattle:true});return controller;
}
