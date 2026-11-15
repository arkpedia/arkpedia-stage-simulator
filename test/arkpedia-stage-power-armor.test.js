// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {StagePowerArmor} from '../server/sim/content/arkpedia-stage-power-armor.js';
import {StageBranchScheduler} from '../server/sim/content/arkpedia-stage-branches.js';
import {powerArmorDeviceNativeReviewed} from '../shared/arkpedia/stage-power-armor.js';
import native from '../data/arkpedia-device-native-source.json' with {type:'json'};
const small='enemy_1251_lysyta',bionic='enemy_1253_lysytc',active='enemy_1256_lyacpa',trap='trap_077_rmtarmn';
function fixture(){
  const enemies=Object.fromEntries([small,bionic,active].map(id=>{const r=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);r.stats.moveSpeed=0;return[id,r]}));
  const h=makeBattle({content:'none',autoFinish:false,defs:{enemies},setup:installEnemyFeatures});
  const b=h.b;b.start();b.stageBranches=new StageBranchScheduler(b,{armor:{spawns:[{enemyKey:active,routeIndex:0,order:0,count:1,offset:0,interval:1}]}});
  const controller=new StagePowerArmor(b,[{key:trap,name:'R-11 Assault Power Armor',row:10,col:5,instance:{level:1,skillLevel:1,branchId:'armor',actionIndex:0}}]);
  return{...h,controller,armor:controller.entries[0].unit};
}
test('two 50-SP drivers activate one branch body after the native animation, inheriting current HP',()=>{
  const h=fixture(),{b,armor}=h;h.run(2);assert.equal(armor.skill.sp,0);
  b.spawnEnemy(small,{pos:[10,5]});h.run(.1);assert.equal(armor.skill.sp,50);assert.equal(armor.skill.active,false);
  armor.hp=armor.s.maxHp*.4;b.spawnEnemy(small,{pos:[10,5]});h.run(.1);
  assert.equal(armor.skill.active,true);assert.equal(armor.findBuff('lypa[car_mark]'),null);
  const extra=b.spawnEnemy(small,{pos:[10,5]});h.run(1);assert.equal(extra.alive,true);assert.equal(armor.alive,true);
  assert.equal(b.enemies.filter(e=>e.defId===active).length,0);
  armor.hp=armor.s.maxHp*.3;h.run(.8);
  const child=b.enemies.find(e=>e.defId===active);assert.ok(child);assert.equal(child.hpRatio,.3);
  assert.equal(child.counted,false);assert.equal(child.profile.holdsBattle,true);assert.equal(armor.removeReason,'withdraw');
  assert.equal(b.stageOutcomes.counters.actived_bell,1);assert.equal(b.stageOutcomes.counters.killed,undefined);
  assert.deepEqual(b.errors,[]);
});
test('a Bionic supplies 100 SP and activation holds final victory until its child exits',()=>{
  const h=fixture(),{b,armor}=h;b.autoFinish=true;b.spawnEnemy(bionic,{pos:[10,5]});h.run(.1);
  assert.equal(armor.skill.active,true);assert.equal(b.finished,false);h.run(2);
  const child=b.enemies.find(e=>e.defId===active);assert.ok(child?.alive);assert.equal(b.finished,false);
  b.kill(child);h.run(.1);assert.equal(b.reason,'cleared');assert.deepEqual(b.errors,[]);
});
test('destroying dormant or activating armour cancels the conversion and records only its kill',()=>{
  for(const charging of [true,false]){
    const h=fixture(),{b,armor}=h;if(!charging){b.spawnEnemy(bionic,{pos:[10,5]});h.run(.1)}
    b.kill(armor);h.run(3);assert.equal(b.enemies.some(e=>e.defId===active),false);
    assert.equal(b.stageOutcomes.counters.killed,1);assert.equal(b.stageOutcomes.counters.actived_bell,undefined);
    assert.equal(b._hasPendingEnemySchedules(),false);assert.deepEqual(b.errors,[]);
  }
});
test('contact radius, driver identity, immunity removal and native mutation refusal',()=>{
  const h=fixture(),{b,armor}=h;const far=b.spawnEnemy(bionic,{pos:[10,7]}),ordinary=b.spawnEnemy(active,{pos:[10,5]});
  h.run(.1);assert.equal(far.alive,true);assert.equal(ordinary.alive,true);assert.equal(armor.skill.sp,0);
  b.applyStatus(armor,'stun',{duration:10});assert.equal(armor.s.flags.stun,false);
  far.x=armor.x;far.y=armor.y;h.run(.1);b.applyStatus(armor,'stun',{duration:.1});assert.equal(armor.s.flags.stun,true);
  for(const id of [trap,'trap_078_rmtarms'])assert.ok(powerArmorDeviceNativeReviewed(id));
  const n=structuredClone(native);n.templates['trap_bgarmn[summon_enemy]'].eventToActions.ON_BUFF_FINISH[1]._managedByScheduler=false;
  assert.equal(powerArmorDeviceNativeReviewed(trap,n),false);assert.deepEqual(b.errors,[]);
});
test('DV-6 loads original device instances and branch routes through the common compiler',async()=>{
  const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext(),p=await planStage(c,'dv-6',{waves:true});assert.deepEqual(p.blockers,[]);
  assert.equal(p.stage.devices.filter(d=>d.key===trap).length,4);
  assert.ok(p.stage.devices.every(d=>d.instance.branchId&&d.instance.actionIndex===0));
  const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
    {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});b.life=1e6;
  assert.equal(b.stagePowerArmor.entries.length,4);
  const d=b.stagePowerArmor.entries[0];d.unit.hp=d.unit.s.maxHp*.6;
  b.spawnEnemy(small,{pos:[d.unit.y,d.unit.x]});b.spawnEnemy(small,{pos:[d.unit.y,d.unit.x]});
  for(let i=0;i<Math.ceil(2/b.dt);i++)b.step();
  const child=b.enemies.find(e=>e.defId===active);assert.ok(child);assert.equal(child.hpRatio,.6);
  assert.equal(b.stageOutcomes.counters.actived_bell,1);assert.deepEqual(b.errors,[]);
});

test('all four armour devices share activation; challenge toggles and stat selectors remain local to the stage',async()=>{
  const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext();
  for(const [id,key,count,target] of [
    ['dv-4','trap_075_bgarmn',3,'enemy_1255_lybgpa'],
    ['dv-ex-2','trap_076_bgarms',6,'enemy_1255_lybgpa_2'],
    ['dv-ex-2_challenge_mode','trap_076_bgarms',8,'enemy_1255_lybgpa_2'],
    ['dv-ex-3','trap_078_rmtarms',4,'enemy_1256_lyacpa_2'],
    ['dv-ex-3_challenge_mode','trap_078_rmtarms',4,'enemy_1256_lyacpa_2'],
  ]){
    const p=await planStage(c,id,{waves:true});assert.deepEqual(p.blockers,[],id);
    assert.equal(p.stage.devices.length,count,id);
    assert.ok(p.localSources.some(s=>s.path==='data/arkpedia-device-native-source.json'));
    assert.ok(p.localSources.some(s=>s.path==='data/arkpedia-dormant-power-armor-animations.json'));
    const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
      {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});b.life=1e6;
    const d=b.stagePowerArmor.entries[0];assert.equal(d.entry.key,key);
    assert.ok(Math.abs(d.unit.s.maxHp/d.spec.hp-(id.includes('challenge')?1.1:1))<1e-9);
    d.unit.hp=d.unit.s.maxHp*.6;
    // The source stage roster chooses the driver variant; both Dor-1 variants grant 50 SP.
    const driver=Object.keys(p.stage.enemies).find(k=>/^enemy_1251_lysyta(?:_2)?$/.test(k));assert.ok(driver,id);
    b.spawnEnemy(driver,{pos:[d.unit.y,d.unit.x]});b.spawnEnemy(driver,{pos:[d.unit.y,d.unit.x]});
    for(let i=0;i<Math.ceil(2/b.dt);i++)b.step();
    const child=b.enemies.find(e=>e.defId===target);assert.ok(child,id);assert.equal(child.hpRatio,.6);
    assert.equal(d.unit.removeReason,'withdraw');assert.equal(b.stageOutcomes.counters.actived_bell,1);
    assert.deepEqual(b.errors,[],id);
  }
});

test('DV-7 activated heavy armour waits, disappears for three seconds, and exits its branch tunnel',async()=>{
  const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
  const {StandardBattle,stageAdapter}=await import('../server/sim/arkpedia.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext(),p=await planStage(c,'dv-7',{waves:true});assert.deepEqual(p.blockers,[]);
  const branch=p.stage.waveProgram.branches.line_05.spawns[0],route=stageAdapter(p.stage).routes[branch.routeIndex];
  assert.deepEqual(route.checkpoints.filter(cp=>cp.type!=='MOVE'),[
    {type:'WAIT',pos:[4,4],time:5},{type:'DISAPPEAR'},
    {type:'WAIT',pos:[4,5],time:3},{type:'APPEAR',pos:[7,10]},
  ]);
  const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
    {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});b.life=1e6;
  const d=b.stagePowerArmor.entries.find(e=>e.spec.branchId==='line_05');
  const driver=Object.keys(p.stage.enemies).find(k=>/^enemy_1251_lysyta(?:_2)?$/.test(k));assert.ok(driver);
  b.spawnEnemy(driver,{pos:[d.unit.y,d.unit.x]});b.spawnEnemy(driver,{pos:[d.unit.y,d.unit.x]});
  for(let i=0;i<Math.ceil(1.2/b.dt);i++)b.step();
  const child=b.enemies.find(e=>e.defId==='enemy_1255_lybgpa');assert.ok(child);
  for(let i=0;i<Math.ceil(3/b.dt);i++)b.step();assert.equal(child.x,4);assert.equal(child.y,4);
  let hiddenAt=null,appearedAt=null;
  for(let i=0;i<Math.ceil(50/b.dt);i++){
    b.step();if(child.hidden&&hiddenAt===null)hiddenAt=b.time;
    if(hiddenAt!==null&&!child.hidden){appearedAt=b.time;assert.ok(Math.abs(child.x-10)<.1);assert.ok(Math.abs(child.y-7)<.1);break;}
  }
  assert.ok(hiddenAt!==null&&appearedAt!==null);assert.ok(Math.abs(appearedAt-hiddenAt-3)<b.dt*2);
  assert.deepEqual(b.errors,[]);
});
