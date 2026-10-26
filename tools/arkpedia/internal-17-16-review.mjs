// SPDX-License-Identifier: GPL-3.0-or-later
// Loopback stage bootstrap only. The real app owns preparation and battle
// dispatch; catalogue admission remains separate and unchanged.
import{readFile}from'node:fs/promises';
import{createPublicReviewServer}from'./public-review-server.mjs';
import{stage17_16SchedulePlan}from'../../server/sim/content/arkpedia-stage-17-16-schedule.js';
const root=new URL('../../',import.meta.url);
export async function createStage17_16ReviewServer({origin,geometryOnly=false}={}){
 const[rawApp,rawData,rawSource]=await Promise.all(['public/arkpedia/app.js','data/arkpedia-mvp.json','data/candidates/arkpedia-stage-17-16-source.json'].map(p=>readFile(new URL(p,root),'utf8')));
 const data=JSON.parse(rawData),source=JSON.parse(rawSource),plan=stage17_16SchedulePlan();
 const stageIndex={schemaVersion:1,defaultStage:'17-16',stages:[{id:'17-16',code:'17-16',name:source.stage.name,description:source.stage.description,testOnly:true,data:null}]};
 data.stage={...source.stage,testOnly:true,geometry:source.geometry,devices:source.devices,tokens:[],pathing:{moveScale:plan.moveScale}};data.enemies=plan.records;
 const ids=['char_4226_veen','char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'];data.operators=Object.fromEntries(ids.map(id=>[id,data.operators[id]]));
 if(geometryOnly){data.sd={...data.sd,models:{}};data.skillEffects=null;}
 const hook=`\nwindow.__stage17_16Review = Object.freeze({ read() {
  const mechanics = battle?.internalStageMechanics;
  return { time: battle?.time, paused, selected, error: battleError,
   selection: {operators:selection?.operators.map(p=>p.id)??[],support:selection?.support?.id??null},
   held: battle?.simulationHeld, dp: battle?.dp, life: battle?.life, killed: battle?.killed,
   finished: battle?.finished, reason: battle?.reason, slots: battle?.deployedSlots(),
   preset: mechanics ? { key: mechanics.viy.key, alive: mechanics.viy.unit.alive,
    skillActive: mechanics.viy.unit.skill.active, sp: mechanics.viy.unit.skill.spTotal } : null,
   cards: mechanics?.cards.cards(), schedule: mechanics?.schedule.state(),
   records: Object.fromEntries(Object.keys(battle?.bench ?? {}).map(id => {
    const e = battle.operatorEntry(id);return [id,{ cost: battle.cost(id), readyAt:e.readyAt,
     deployments:e.deployments, alive:!!e.unit, stats:e.record.stats, module:e.build.module,
     moduleLevel:e.build.moduleLevel, dir:e.unit?.dir, tile:e.unit?[e.unit.tileR,e.unit.tileC]:null }];
   })) };
 } });`;
 return createPublicReviewServer({origin,app:rawApp,data,hook,stageIndex});
}
