// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnAny,ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const warriors=['enemy_1189_krgaxe','enemy_1189_krgaxe_2'],drones=['enemy_1188_krgdrn','enemy_1188_krgdrn_2'];
const hounds=['enemy_1187_krghd','enemy_1187_krghd_2'],resistant=[...drones,...hounds];
const admitted=(id,n=native)=>!!enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,n).policy;
test('Icefield native admission rejects changed no-combat helpers, damage and resistance contracts',()=>{
 for(const id of [...warriors,...resistant])assert.ok(admitted(id),id);
 for(const [id,name,edit] of [[warriors[0],'Effect',c=>c._actions={}],[warriors[1],'Combat',c=>c._atkScale=2],
  [drones[0],'StatusResistance',c=>c._buffs[0].blackboard[0].value=-.8],
  [drones[1],'StatusResistance',c=>c._buffs[0].isSilenceable=1]]){
  const n=structuredClone(native),row=n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(r=>r.objectName===name&&!r.referenced);
  const c=JSON.parse(row.originalJson);edit(c);row.originalJson=JSON.stringify(c);assert.equal(admitted(id,n),false,id);
 }
 const n=structuredClone(native);n.buffDatabase['status_resistance[inf]'].lifeTimeType='LIMITED';assert.equal(admitted(drones[0],n),false);
});
test('Frigid and Icefield Hound variants halve resistible status duration and keep resistance under silence',()=>{
 for(const id of resistant){
  const h=spawnAny(id,{units:[],autoFinish:false});h.step();const e=h.b.enemies[0];assert.ok(e);
  assert.equal(h.b.resistOf(e),.5);assert.equal(e.findBuff('ab:permanentResistance').timeLeft,Infinity);
  h.b.applyStatus(e,'silence',{duration:10});assert.equal(h.b.resistOf(e),.5);
  for(const status of ['stun','cold','freeze']){
   h.b.applyStatus(e,status,{key:`review:${status}`,duration:4});const buff=e.findBuff(`review:${status}`);
   assert.equal(buff.timeLeft,2,status);
  }
  h.b.applyStatus(e,'sleep',{key:'review:sleep',duration:4});assert.equal(e.findBuff('review:sleep').timeLeft,2);
  assert.deepEqual(h.b.errors,[]);
 }
});
test('Warriors preserve ordinary resistance and all six variants retain physical attacks',()=>{
 for(const id of [...warriors,...resistant]){
  const h=spawnAny(id,{autoFinish:false}),hits=[];
  h.b.on('damaged',c=>{if(c.source?.defId===id&&c.target.side==='ally')hits.push(c)});
  h.step();const e=h.b.enemies[0];assert.ok(e);h.run(30);
  assert.ok(hits.length>0,id);assert.ok(hits.every(c=>c.dmg.type==='phys'&&c.dmg.isAttack));
  assert.equal(h.b.resistOf(e),resistant.includes(id)?.5:0);assert.deepEqual(h.b.errors,[]);
 }
});

test('Berserkers reuse Frozen-target attack scaling before DEF, with a neutral Cold-only branch', () => {
 for (const id of ['enemy_1193_krgbsk','enemy_1193_krgbsk_2']) {
  assert.ok(admitted(id));
  const h=spawnAny(id,{autoFinish:false,seconds:.1}),b=h.b,e=b.enemies[0],u=b.allyUnits[0];
  const scale=ENEMY_RECORDS.enemies[id].levels[0].talents.bb['atkup.enemy_krgbsk_t[frozen].atk_scale'];
  b.addBuff(e,{key:'fixture:hold',flags:{noMove:true,disarm:true}});
  for(const status of [null,'cold','freeze']) {
   b.removeBuff(u,'fixture:condition');if(status)b.applyStatus(u,status,{key:'fixture:condition',duration:10});
   const hp=u.hp;b.dealDamage(e,u,{amount:e.s.atk,type:'phys',isAttack:true,applyWay:'melee'});
   assert.equal(hp-u.hp,e.s.atk*(status==='freeze'?scale:1)-u.s.def,`${id} ${status}`);
  }
  assert.equal(b.resistOf(e),.5);b.applyStatus(e,'stun',{duration:4,key:'fixture:stun'});
  assert.equal(e.findBuff('fixture:stun').timeLeft,2);assert.deepEqual(b.errors,[]);
 }
});
test('Berserker source gates reject altered Cold defaults, Frozen conditions and blackboard stripping',()=>{
 const id='enemy_1193_krgbsk';
 for(const kind of ['cold','frozen','strip','scale']) {
  const n=structuredClone(native);
  if(kind==='cold')n.templates['enemy_krgbsk_t[cold]'].eventToActions.ON_CALCULATE_DAMAGE[3]._defaultValue=2;
  if(kind==='frozen')n.templates.e2c_frozen_atkscale.eventToActions.ON_CALCULATE_DAMAGE[0]._abnormalFlag='COLD';
  if(kind==='strip'){
   const row=n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(r=>r.objectName==='AtkUp'&&!r.referenced);
   const c=JSON.parse(row.originalJson);c._buffs[1].stripBlackboardParamsWithBuffKey=0;row.originalJson=JSON.stringify(c);
  }
  if(kind==='scale'){
   const row=n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(r=>r.objectName==='Combat'&&!r.referenced);
   const c=JSON.parse(row.originalJson);c._atkScale=2;row.originalJson=JSON.stringify(c);
  }
  assert.equal(admitted(id,n),false,kind);
 }
});

test('BI-EX-6 and Challenge Mode load from source and exhaust their complete original wave programs', async()=>{
 const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
 const {StandardBattle}=await import('../server/sim/arkpedia.js');
 const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
 const c=await loadContentContext();
 for(const id of ['bi-ex-6','bi-ex-6_challenge_mode']) {
  const p=await planStage(c,id,{waves:true});assert.deepEqual(p.blockers,[]);
  const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
   {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
  b.life=1e6;b.setViewport('fullscreen-workspace');const spawns=[];
  b.on('enemySpawn',({enemy})=>spawns.push(enemy.defId));
  for(let tick=0;tick<Math.ceil(600/b.dt)&&!b.finished;tick++)b.step();
  const expected=p.stage.waveProgram.waves.flatMap(w=>w.fragments).flatMap(f=>f.spawns).reduce((n,s)=>n+s.count,0);
  assert.equal(spawns.length,expected,id);assert.ok(spawns.includes('enemy_1193_krgbsk_2'));
  assert.equal(b.stageWaveScheduler.done,true,id);assert.equal(b.aliveEnemies().length,0);
  assert.deepEqual(b.errors,[]);
 }
});
