// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,existsSync}from'node:fs';
import {createHash}from'node:crypto';
import {tmpdir}from'node:os';
import {join}from'node:path';
import {execFileSync}from'node:child_process';
import stage from '../data/arkpedia-stage-16-8.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
import index from '../data/arkpedia-stages.json' with {type:'json'};
import source from '../data/candidates/arkpedia-stage-16-8-source.json' with {type:'json'};
import review from '../data/candidates/arkpedia-ch16-reviewed-stage-16-8.json' with {type:'json'};
import {resolveStage,applyStage}from'../shared/arkpedia/stages.js';
import {assertRegularEnemies}from'../shared/arkpedia/enemies.js';
import {StandardBattle,stageAdapter}from'../server/sim/arkpedia.js';
import {defaultBuild}from'../shared/arkpedia/loadout.js';
const data=()=>({...structuredClone(mvp),stage:structuredClone(stage),enemies:structuredClone(stage.enemies)});
test('16-8 stays experimental with canonical 35-hostile normal wave, five default hidden slugs and no Six-Star replacement',async()=>{
  assert.equal(index.stages.filter(e=>!e.testOnly).length,597);
  assert.throws(()=>resolveStage(index,'16-8'),/test-only/);
  const d=structuredClone(mvp);await applyStage(d,index,'16-8',async()=>({ok:true,json:async()=>structuredClone(stage)}),{experimental:true});
  assert.doesNotThrow(()=>assertRegularEnemies(d));
  for(const change of[s=>{s.testOnly=false;},s=>{delete s.enemyCatalogue;},s=>{s.code='16-9';}]){const bad=data();change(bad.stage);assert.throws(()=>assertRegularEnemies(bad),/Unsupported/);}
  assert.equal(stage.canonicalData.repository,'arkpedia/arkpedia-data');assert.equal(stage.canonicalData.commit,'79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit,'245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  assert.equal(stage.pathing.moveScale,.5);assert.deepEqual(stage.includedHiddenGroups,['group0']);assert.deepEqual(stage.excludedHiddenGroups,['group1']);
  const spawns=stageAdapter(stage).spawns;assert.equal(spawns.length,35);assert.equal(spawns.filter(s=>s.enemyKey==='enemy_10126_rkbomb').length,12);
  assert.equal(spawns.filter(s=>s.enemyKey==='enemy_1107_uoffcr').length,20);assert.equal(spawns.filter(s=>s.enemyKey==='enemy_10124_uashld').length,3);
  assert.equal(stage.geometry.waves[0].spawns.filter(s=>s.enemy_id==='enemy_10126_rkbomb'&&[0,2,4,6,8].includes(s.route)).length,5);
  assert.deepEqual(Object.keys(stage.enemies).sort(),review.expected.enemies.slice().sort());
});
test('16-8 hashes bind original source and controller approval; changed input cannot build',()=>{
  for(const p of Object.values(review.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p.path,import.meta.url))).digest('hex'),p.sha256);
  const dir=mkdtempSync(join(tmpdir(),'ch16-8-build-')),input=join(dir,'stage.json'),geometry=join(dir,'geometry.json'),out=join(dir,'out.json');
  writeFileSync(input,JSON.stringify({...source.stage,name:'Altered'}));writeFileSync(geometry,JSON.stringify(source.geometry));
  assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-stage.mjs','--candidate','ch16','--stage',input,'--geometry',geometry,'--out',out],{stdio:'pipe'}),e=>/does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out),false);
});
function battle(seed){const b=new StandardBattle(data(),{operators:[defaultBuild(mvp.operators.char_122_beagle)]},{seed});b.life=1000;b.setViewport('fullscreen-workspace');return b;}
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt)&&!b.finished;i++){
  // End toggling in Standby at t=120 so this route-only fixture cannot keep
  // feeding new miners to the surviving enemies indefinitely.
  for(const[id,e]of b.stageDeviceActions)if(b.time<121&&e.state.canActivate())b.activateStageDevice(id);b.step();
}}
for(const seed of[19,71,129])test(`16-8 extended route-only clear exercises live slug transitions and canonical branch offsets (seed ${seed})`,()=>{
  const b=battle(seed);b.timeLimit=600;const born=[];b.on('enemySpawn',({enemy})=>born.push(enemy));advance(b,600);
  // Native marker timing changes miner/slug encounters and their route delay.
  // Keep the existing 600-second diagnostic budget, not the old immediate-hit
  // controller's incidental <410 completion bound. The game default stays 300.
  assert.equal(b.result().reason,'cleared');assert.ok(b.time<600);assert.equal(b.total,35);assert.deepEqual(b.errors,[]);
  const slugs=born.filter(e=>e.defId==='enemy_10126_rkbomb');assert.equal(slugs.length,12);
  assert.ok(slugs.some(e=>e.mem.ab.list.some(a=>a.changeMode&&a.mode===1)),'native miner attacks break at least one shield');
  const miners=born.filter(e=>e.mem.ch16Branch);assert.ok(miners.length>0);
  for(const e of miners){assert.equal(e.counted,false);assert.equal(e.holdsBattle,false);assert.equal(e.mem.ch16Branch.route,0);
    assert.ok(Math.abs(e.spawnX-8)<=.4&&Math.abs(e.spawnY-2)<=.4);assert.equal(e.route.visitEveryCheckPoint,false);
  }
});
test('16-8 default 300-second limit remains enforced for the route-only fixture',()=>{
  const b=battle(71);assert.equal(b.timeLimit,300);advance(b,300);assert.equal(b.result().reason,'timeout');assert.deepEqual(b.errors,[]);
});
