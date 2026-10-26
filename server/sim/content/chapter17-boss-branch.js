// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit internal branch start; room sequencing and stage admission are separate.
import contract from '../../../data/candidates/arkpedia-ch17-boss-branch-contract.json' with {type:'json'};
import {chapter17BossBranchRecord} from './chapter17-boss-branch-records.js';
import {installChapter17SnakeCore} from './chapter17-snake-core.js';
import {pollutionBrute} from './chapter17-brute.js';
import {attach,installFeatureDispatch} from './enemies.js';
const owners=new WeakMap(),snakes=new WeakMap();
export function isChapter17BossBranchSnake(b,source,life){
 const birth=snakes.get(b);return !!birth&&source?.deploySeq===life&&birth.enemy===source&&birth.enemyLife===life;
}
export function installChapter17BossBranch(b,{stage,finishWave}={}){
 const ending=()=>b.finished||!!b._endReq;
 if(stage!==contract.stage||ending()||typeof finishWave!=='function'||!Number.isFinite(b.life)
  ||b.rect.r0!==0||b.rect.r1!==16||b.rect.c0!==0||b.rect.c1!==10)throw Error('Boss branch requires the canonical stage rectangle and wave/life receiver');
 if(owners.has(b))throw Error('Only one boss branch scheduler is allowed per battle');
 const keys=Object.keys(contract.records),checkOverrides=()=>{if(keys.some(k=>b.enemyOverrides[k]))throw Error('Unreviewed boss branch runtime override');};
 checkOverrides();installFeatureDispatch(b);
 const handles=[],timers=[],state={active:true,started:false,startedAt:null,spawned:[],
  // Cancel only unborn work. Already born combat belongs to the units' lives.
  stop(){if(!state.active)return;state.active=false;timers.forEach(t=>t.cancel());handles.forEach(h=>b.off(h));},
  start(){
   if(!state.active||state.started||ending())return false;checkOverrides();state.started=true;state.startedAt=b.time;
   for(const [index,entry]of contract.entries.entries())timers.push(b.after(entry.time,()=>{
    if(!state.active||ending())return;
    try{
     checkOverrides();const expectedLife=b._deploySeq+1;
     const e=b.spawnEnemy(entry.enemyKey,{def:chapter17BossBranchRecord(stage,entry.enemyKey),route:entry.route,pos:entry.route.start});
     if(!e||ending()||!e.alive||!e.deployed||e.deploySeq!==expectedLife)return;
     e.route.cursorOffset={x:0,y:0};e.route.goal={x:entry.route.end[1],y:entry.route.end[0]};e.route.visitEveryCheckPoint=entry.native.visitEveryCheckPoint;e.route.nativeReachRadius=.05;
     e.mem.ch17BossBranch=Object.freeze({branch:contract.branch,index,extraRouteIndex:entry.extraRouteIndex,startedAt:state.startedAt});
     const receipt=Object.freeze({enemy:e,enemyLife:e.deploySeq,index,time:b.time});state.spawned.push(receipt);
     if(index===0){installChapter17SnakeCore(b,e,{finishWave});snakes.set(b,receipt);}
     else attach(b,e,[pollutionBrute(e.def.raw,{stage})]);
    }catch(error){state.stop();throw error;}
   },{owner:state,holdsBattle:true}));
   return true;
  },
 };
 owners.set(b,state);handles.push(b.on('battleEnd',()=>state.stop(),{owner:state}));return state;
}
