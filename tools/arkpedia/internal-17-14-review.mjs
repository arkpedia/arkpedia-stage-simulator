// SPDX-License-Identifier: GPL-3.0-or-later
// Loopback-only catalogue/data fixture. The actual app owns every command,
// preparation decision and Start/Restart dispatch. Observation only.
import {readFile} from 'node:fs/promises';
import {createPublicReviewServer} from './public-review-server.mjs';
import {stage17_14MechanicsPlan} from '../../shared/arkpedia/stage17-14-mechanics.js';
const root=new URL('../../',import.meta.url);
export async function createStage17_14ReviewServer({origin,geometryOnly=false}={}){
 const [app,raw,level]=await Promise.all(['public/arkpedia/app.js','data/arkpedia-mvp.json','data/candidates/arkpedia-stage-17-14-source.json'].map(p=>readFile(new URL(p,root),'utf8')));
 const data=JSON.parse(raw),source=JSON.parse(level),plan=stage17_14MechanicsPlan();
 data.stage={...source.stage,testOnly:true,geometry:source.geometry,devices:source.devices,tokens:[],pathing:{moveScale:plan.moveScale}};data.enemies=plan.records;
 const ids=['char_122_beagle','char_151_myrtle','char_128_plosis','char_002_amiya','char_4228_closur'];data.operators=Object.fromEntries(ids.map(id=>[id,data.operators[id]]));
 if(geometryOnly){data.sd={...data.sd,models:{}};data.skillEffects=null;}
 const stageIndex={schemaVersion:1,defaultStage:'17-14',stages:[{id:'17-14',code:'17-14',name:source.stage.name,description:source.stage.description,testOnly:true,data:null}]};
 const hook=`\nwindow.__stage17_14Review=Object.freeze({read(){
  const f=battle?.internalStageMechanics?.closur,p=f?.point.point,u=p?.unit;
  return{code:battle?.stageId,time:battle?.time,paused,selected,error:battleError,errors:[...(battle?.errors??[])],
   dp:battle?.dp,total:battle?.total,life:battle?.life,pending:battle?._pending.length,slots:battle?.deployedSlots(),placement:pending?{...pending}:null,
   selection:selection?structuredClone(selection):null,
   preset:f?{key:f.entry.key,life:f.u.deploySeq,alive:f.u.alive,sp:f.u.skill.spTotal,maxSp:f.u.skill.spCost,skillActive:f.u.skill.active,
    build:{...f.entry.build},stats:{...f.entry.record.stats},tile:[f.u.tileR,f.u.tileC],dir:f.u.dir}:null,
   point:p?{id:u.id,alive:u.alive,mode:p.mode,readyAt:p.readyAt,tile:[u.tileR,u.tileC]}:null,
   records:Object.fromEntries(Object.keys(battle?.bench??{}).map(id=>{const e=battle.operatorEntry(id);return[id,{build:{...e.build},cost:battle.cost(id),readyAt:e.readyAt,alive:!!e.unit,deployments:e.deployments}];}))};
 }});`;
 return createPublicReviewServer({origin,app,data,hook,stageIndex});
}
