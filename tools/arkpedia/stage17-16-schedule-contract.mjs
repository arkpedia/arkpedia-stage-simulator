// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{writeJSONAtomic}from'./write-json.mjs';import{stageAdapter}from'../../shared/arkpedia/stage-adapter.js';
import{sourceBoundRoutePath}from'../../shared/arkpedia/stage-path.js';import{normalizeRoute}from'../../server/sim/simdata.js';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const source=await read('data/candidates/arkpedia-stage-17-16-source.json'),lock=await read('data/arkpedia-canonical-stage-17-16.lock.json');
assert.deepEqual(source.inputs,lock.files);assert.equal(source.canonicalData.commit,lock.commit);assert.equal(source.admitted,false);assert.equal(source.testOnly,true);
assert.equal(sources['data/candidates/arkpedia-stage-17-16-source.json'].sha256,'9f152c8905bed50f22385d46c6e6093b786f7f01622d51031ecb29a57612feb3');
const support=await read('data/candidates/arkpedia-ch16-enemy-support.json'),all=await read(support.source.records.path);assert.equal(sources[support.source.records.path].sha256,support.source.records.sha256);
const records={};for(const ref of source.rawLevel.enemyDbRefs){
 assert.equal(ref.useDb,true);assert.equal(ref.level,0);assert.ok(!ref.overwrittenData||!JSON.stringify(ref.overwrittenData).includes('"m_defined":true'));
 assert.equal(support.enemies[ref.id]?.policy,'stats-attacks-and-features');records[ref.id]=all.enemies[ref.id].levels[0];
}
const paths={};for(const[i,r]of source.geometry.routes.entries())if(r&&!r.placeholder&&r.motion!=='e_num'){
 if(source.geometry.waves.some(w=>w.spawns.some(s=>s.route===i)))paths[i]=sourceBoundRoutePath(r,source.rawLevel.routes);
}
const layout=stageAdapter({...source.stage,geometry:source.geometry,devices:source.devices,pathing:{paths}});layout.routes=layout.routes.map(normalizeRoute);delete layout.spawns;delete layout.fixedSquad;
const waves=source.rawLevel.waves.map((wave,index)=>{
 assert.equal(wave.preDelay,0);assert.equal(wave.postDelay,0);assert.equal(wave.maxTimeWaitingForNextWave,-1);assert.equal(wave.advancedWaveTag,null);
 let cursor=0;const actions=[];for(const[fragment,f]of wave.fragments.entries()){
  cursor+=f.preDelay;let duration=0;for(const[actionIndex,action]of f.actions.entries()){
   assert.ok(['SPAWN','DIALOG','STORY','ACTIVATE_PREDEFINED'].includes(action.actionType));assert.equal(action.count,1);assert.equal(action.managedByScheduler,true);
   for(const key of ['blockFragment','isUnharmfulAndAlwaysCountAsKilled','dontBlockWave','forceBlockWaveInBranch'])assert.equal(action[key],false);
   assert.equal(action.hiddenGroup,null);assert.equal(action.randomSpawnGroupKey,null);assert.equal(action.randomSpawnGroupPackKey,null);assert.equal(action.randomType,'ALWAYS');assert.equal(action.refreshType,'ALWAYS');assert.equal(action.weight,0);
   if(action.actionType==='SPAWN')assert.ok(records[action.key]&&layout.routes[action.routeIndex]);
   actions.push({fragment,actionIndex,time:cursor+action.preDelay,action});duration=Math.max(duration,action.preDelay);
  }cursor+=duration;
 }
 const spawns=actions.filter(r=>r.action.actionType==='SPAWN').map(r=>({time:r.time,key:r.action.key,route:r.action.routeIndex}));
 assert.deepEqual(spawns,source.geometry.waves[index].spawns.map(s=>({time:s.time,key:s.enemy_id,route:s.route})));
 return{index,duration:cursor,waitForManagedEnemies:true,actions};
});
assert.deepEqual(waves.map(w=>w.actions.length),[11,10]);assert.equal(source.stage.enemies.total,14);
const result={schemaVersion:1,testOnly:true,admitted:false,frameParity:false,scope:'Internal exact 17-16 ordered actions, routes and enemy records. Dynamic wave-clear and tutorial pause use explicit regular-engine mappings; no stage or native scheduler/FSM admission.',sources,layout,records,waves,battle:source.stage.battle,moveScale:source.rawLevel.options.moveMultiplier};
const out=new URL('data/candidates/arkpedia-17-16-schedule-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified 17-16 source layout, fourteen spawns and seven tutorial/card actions across two waves');
