// SPDX-License-Identifier: GPL-3.0-or-later
// Loopback review boot only. The production app, catalogue and admission
// gates are unchanged; combat is constructed by the exact internal factory.
import{readFile}from'node:fs/promises';
import{createPublicReviewServer}from'./public-review-server.mjs';
import{stage17_16SchedulePlan}from'../../server/sim/content/arkpedia-stage-17-16-schedule.js';
const root=new URL('../../',import.meta.url);
export async function createStage17_16ReviewServer({origin,geometryOnly=false}={}){
 const[rawApp,rawData,rawSource]=await Promise.all(['public/arkpedia/app.js','data/arkpedia-mvp.json','data/candidates/arkpedia-stage-17-16-source.json'].map(p=>readFile(new URL(p,root),'utf8')));
 const data=JSON.parse(rawData),source=JSON.parse(rawSource),plan=stage17_16SchedulePlan();let app=rawApp;
 const replace=(from,to,count)=>{if(app.split(from).length-1!==count)throw Error('Internal review app boot changed');app=app.split(from).join(to);};
 replace('import { StandardBattle } from "/sim/arkpedia.js";','import { StandardBattle, createStage17_16MechanicsBattle } from "/sim/arkpedia.js";',1);
 replace('({ entry: activeStage } = await applyStage(data, stageIndex, requested, fetch, { experimental }));',"activeStage = { id: '17-16', testOnly: true };",1);
 replace('new StandardBattle(data, selection, { seed: Date.now() })','createStage17_16MechanicsBattle(data, { seed: 1 })',2);
 data.stage={...source.stage,testOnly:true,geometry:source.geometry,devices:source.devices,tokens:[]};data.enemies=plan.records;
 const ids=['char_4226_veen','char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'];data.operators=Object.fromEntries(ids.map(id=>[id,data.operators[id]]));
 if(geometryOnly){data.sd={...data.sd,models:{}};data.skillEffects=null;}
 const hook=`\nwindow.__stage17_16Review = Object.freeze({ read() {
  const mechanics = battle?.internalStageMechanics;
  return { time: battle?.time, paused, selected, error: battleError,
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
 return createPublicReviewServer({origin,app,data,hook});
}
