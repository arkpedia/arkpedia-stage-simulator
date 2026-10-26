// SPDX-License-Identifier: GPL-3.0-or-later
// Internal composition only; public stage and Closure compatibility stay gated.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
import {stageAdapter} from '../../shared/arkpedia/stage-adapter.js';
import {sourceBoundRoutePath} from '../../shared/arkpedia/stage-path.js';
import {normalizeRoute} from '../../server/sim/simdata.js';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin,path);sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const source=await read('data/candidates/arkpedia-stage-17-14-source.json','845a18d55b962cd8b87988770936137062c8de471219cf8362fc5cc5a5b87327');
const lock=await read('data/arkpedia-canonical-stage-17-14.lock.json');
assert.deepEqual(source.inputs,lock.files);assert.equal(source.canonicalData.commit,lock.commit);
assert.equal(source.testOnly,true);assert.equal(source.admitted,false);assert.deepEqual(source.conditional,[]);
const support=await read('data/candidates/arkpedia-ch16-enemy-support.json');
const all=await read(support.source.records.path,support.source.records.sha256),records={};
for(const ref of source.rawLevel.enemyDbRefs){
 assert.equal(ref.useDb,true);assert.equal(ref.level,0);
 assert.ok(!ref.overwrittenData||!JSON.stringify(ref.overwrittenData).includes('"m_defined":true'));
 assert.equal(support.enemies[ref.id]?.policy,'stats-attacks-and-features');records[ref.id]=all.enemies[ref.id].levels[0];
}
assert.deepEqual(Object.keys(records).sort(),['enemy_10201_muinf_2','enemy_10203_mumag_2','enemy_10207_mubrut_2','enemy_10208_mucow_2','enemy_10209_mubag_2','enemy_10211_murad']);
// Recheck the retained graphs that own all active skills and periodic parents.
// Ordinary attacks/Brute opt in; ChargeRift and Bag feeding do not. Periodic
// parents stay on world time. The unselectable Leak Source cannot receive S3.
const reviews={};
for(const kind of ['reactions','channel-carrier','brute','bag','marker']){
 const review=await read(`data/candidates/arkpedia-ch17-reviewed-${kind}.json`);reviews[kind]=review;
 for(const row of Object.values(review.sources))await read(row.path,row.sha256);
}
const attacks=await read('data/candidates/arkpedia-ch17-attack-clock-contract.json');
for(const row of Object.values(attacks.sources))await read(row.path,row.sha256);
const feeding=await read('data/candidates/arkpedia-ch17-bag-feeding-contract.json');
for(const row of Object.values(feeding.sources))await read(row.path,row.sha256);
const clocks={};
for(const id of ['enemy_10201_muinf_2','enemy_10203_mumag_2','enemy_10208_mucow_2']){
 const p=attacks.enemies[id];assert.ok(p);const n=p.native.map(JSON.parse).find(r=>r._animKey==='Attack');
 assert.equal(n._affectedBySlowDown,1);assert.equal(n._timeMode,0);
 clocks[id]={ordinary:p,otherClocks:id.includes('mumag')?'ChargeRift uses world time; source affectedBySlowDown=0.':'Contact/death parents have no elapsed ability clock.'};
}
for(const id of ['enemy_10207_mubrut_2','enemy_10209_mubag_2']){
 const review=reviews[id.includes('mubrut')?'brute':'bag'].enemies[id];assert.ok(review);
 const native=review.native.map(JSON.parse),eligible=native.filter(n=>n._affectedBySlowDown!==undefined);
 if(id.includes('mubrut')){assert.equal(eligible.length,2);assert.ok(eligible.every(n=>n._affectedBySlowDown===1&&n._timeMode===0));}
 else{assert.equal(eligible.length,2);assert.equal(JSON.parse(feeding.enemies[id].skillOriginalJson)._affectedBySlowDown,0);}
 clocks[id]={native:review.native,feeding:id.includes('mubag')?feeding.enemies[id]:null};
}
clocks.enemy_10211_murad={unselectable:true,scope:'Existing Leak Source invulnerable/untargetable receiver is excluded by real Closure target selection in every visible/contact phase; its native clocks are not admitted to slow_down.'};
const paths={};for(const[i,r]of source.geometry.routes.entries())if(source.geometry.waves.some(w=>w.spawns.some(s=>s.route===i)))paths[i]=sourceBoundRoutePath(r,source.rawLevel.routes);
const layout=stageAdapter({...source.stage,geometry:source.geometry,devices:source.devices,pathing:{paths}});
layout.routes=layout.routes.map(normalizeRoute);delete layout.fixedSquad;
const raw=source.rawLevel,wave=raw.waves[0];assert.equal(raw.waves.length,1);assert.equal(raw.branches,null);
assert.equal(wave.preDelay,0);assert.equal(wave.postDelay,0);assert.equal(wave.maxTimeWaitingForNextWave,-1);
let cursor=0,spawnIndex=0;const actions=[];
for(const[fragment,f]of wave.fragments.entries()){
 cursor+=f.preDelay;let duration=0;
 for(const[actionIndex,a]of f.actions.entries()){
  assert.ok(['SPAWN','DISPLAY_ENEMY_INFO'].includes(a.actionType));assert.equal(a.managedByScheduler,true);
  for(const key of ['blockFragment','isUnharmfulAndAlwaysCountAsKilled','dontBlockWave','forceBlockWaveInBranch'])assert.equal(a[key],false);
  for(const key of ['hiddenGroup','randomSpawnGroupKey','randomSpawnGroupPackKey'])assert.equal(a[key],null);
  assert.equal(a.randomType,'ALWAYS');assert.equal(a.refreshType,'ALWAYS');assert.equal(a.weight,0);
  const time=cursor+a.preDelay;actions.push({fragment,actionIndex,time,action:a});
  duration=Math.max(duration,a.preDelay+(a.count-1)*a.interval);
  if(a.actionType!=='SPAWN')continue;
  const g=source.geometry.waves[0].spawns[spawnIndex++];
  assert.equal(g.enemy_id,a.key);assert.equal(g.time,time);assert.equal(g.count,a.count);assert.equal(g.interval??1,a.interval);assert.equal(g.fragment,fragment);
  assert.deepEqual(sourceBoundRoutePath(source.geometry.routes[g.route],[raw.routes[a.routeIndex]]),paths[g.route]);
 }
 cursor+=duration;
}
assert.equal(spawnIndex,30);assert.equal(layout.spawns.length,52);assert.equal(source.stage.enemies.total,52);
assert.deepEqual(source.geometry.suppliedUnits,{fixed_squad:[],deployable_tokens:[]});
const result={schemaVersion:1,testOnly:true,admitted:false,frameParity:false,
 scope:'Exact internal 17-14 layout, one-wave schedule, selected squad plus preset Closure and existing source-clock mappings. No public enemy/operator/stage admission, preset withdrawal regeneration, compiled FSM or frame proof.',
 sources,layout,records,clocks,actions,battle:source.stage.battle,moveScale:raw.options.moveMultiplier,
 limits:['DISPLAY_ENEMY_INFO is retained presentation metadata, not a combat clock or a tutorial hold.',
 'Leak Source retains the existing unselectable receiver mapping. This contract does not admit its native clocks to slow_down or resolve terminal kill credit.']};
const out=new URL('data/candidates/arkpedia-17-14-mechanics-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified exact internal 17-14: 52 spawns, source routes, preset and selected enemy clocks');
