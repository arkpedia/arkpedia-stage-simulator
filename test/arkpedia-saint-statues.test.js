// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {saintStatueNative} from '../shared/arkpedia/enemy-saint-statue-features.js';
import {compileEnemyRuntimePlan,withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
const ids=['enemy_10091_hlsttu','enemy_10091_hlsttu_2'],key='hlsttu_t[shield]';
function fixture(id=ids[0],compiled=true,positions=[[9,4]]){
 const row=records.enemies[id].levels[0],guard=chessRec({id:'statue_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,
  defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row,recipient:enemyRec({key:'recipient',hp:1000,speed:0})},chess:{[guard.chessId]:guard}},
  units:positions.map(([row,col])=>({chessId:guard.chessId,row,col})),kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,6]}),u=h.b.spawnEnemy('recipient',{pos:[9,8]});u.profile.noAttack=true;
 h.b.addBuff(u,{key:'hold',flags:{noMove:true}});return{...h,e,u,g:h.b.allyUnits[0],charge:u=>u.findBuff(key)?.shield??0};
}
test('each statue is composed from three shared data-plan components without a dedicated runtime adapter',()=>{
 for(const id of ids){const plan=compileEnemyRuntimePlan(records.enemies[id].levels[0]);
  assert.deepEqual(plan.entries.filter(e=>e.ability).map(e=>e.ability.kind),['rechargingBarrierAura','passiveEnemyBody','projectileSingleAttack']);
  assert.ok(plan.entries.some(e=>e.id==='native:saintBody'&&e.trait.flags.noMove));
 }
});
for(const id of ids)test(`${id}: immobile non-counting body recharges neighbors, excludes source markers and survives silence/freeze`,()=>{
 for(const compiled of[false,true]){
  const f=fixture(id,compiled),start=[f.e.x,f.e.y],marked=f.b.spawnEnemy('recipient',{pos:[10,7]});
  f.b.addBuff(marked,{key:'enemy_hlslp_self_mark'});f.b.addBuff(marked,{key:'hold',flags:{noMove:true}});
  assert.equal(f.e.counted,false);assert.ok(f.e.findBuff('enemy_hlsttu_self_mark'));
  for(const status of['stun','fear','levitate','disarm','sleep'])assert.equal(f.b.applyStatus(f.e,status,{duration:2}),false);
  assert.equal(f.b.applyStatus(f.e,'silence',{duration:2}),true);assert.equal(f.b.applyStatus(f.e,'freeze',{duration:2}),true);
  f.run(2);assert.equal(f.charge(f.u),40);assert.equal(f.charge(f.e),0);assert.equal(f.charge(marked),0);
  assert.deepEqual([f.e.x,f.e.y],start);f.b.kill(f.e);f.run(2);assert.equal(f.charge(f.u),40);assert.deepEqual(f.b.errors,[]);
 }
});
test('independent statues contribute to one shared capped barrier and cannot recharge each other',()=>{
 const f=fixture(),second=f.b.spawnEnemy(ids[0],{pos:[9,7]});f.run(13);
 assert.equal(f.charge(f.u),500);assert.equal(f.u.buffs.filter(b=>b.key===key).length,1);
 assert.equal(f.charge(f.e),0);assert.equal(f.charge(second),0);assert.deepEqual(f.b.errors,[]);
});
test('statue Arts shots travel to their locked target and retain their released damage after the source dies',()=>{
 const f=fixture(),hits=[];f.b.on('damaged',c=>{if(c.source===f.e&&c.target===f.g)hits.push(c);});
 assert.ok(f.runUntil(()=>f.b.projectiles.list.length===1,1));assert.equal(hits.length,0);f.b.kill(f.e);
 assert.ok(f.runUntil(()=>hits.length===1,1));assert.equal(hits[0].dmg.type,'arts');assert.equal(hits[0].hpLoss,180);assert.deepEqual(f.b.errors,[]);
});
test('native admission rejects selector, cap math, cosmetic gameplay mutations and changed projectile transport',()=>{
 for(const id of ids)assert.equal(saintStatueNative(records.enemies[id].levels[0],nativeComponents(native,id)),true);
 const mutations=[
  n=>n.$template('hlsttu_t[trigger_shield]').eventToActions.ON_BUFF_TRIGGER[0]._targetOptions.ignoreAllyTargetFree=false,
  n=>n.$template('hlsttu_t[to_enemy]').eventToActions.ON_BUFF_START[0]._buffKeys=[],
  n=>n.$template('hlsttu_t[to_enemy]').eventToActions.ON_BUFF_START[9]._maxValueKey=null,
  n=>n.$template('hlsttu_t[shield]').eventToActions.ON_TAKE_DAMAGE[0]._damageMask='ALL',
  n=>n.$template('hlsttu_t[shield]').eventToActions.ON_BUFF_TRIGGER[2]._succeedNodes.push({$type:'Torappu.Battle.Action.Nodes+InstantKill, Assembly-CSharp'}),
  n=>{const root=n[ids[0]][0],mode=n.$ref(root._modes[0]);n.$ref(mode._generalAbilities[0])._buffs[0].attributes.abnormalFlags.push(5);},
 ];
 for(const edit of mutations){const n=nativeComponents(structuredClone(native),ids[0]);edit(n);assert.equal(saintStatueNative(records.enemies[ids[0]].levels[0],n),false);}
 const transport=structuredClone(native),row=transport.projectiles.projectile_enemy_hlsttu.find(row=>'_speed'in JSON.parse(row.originalJson));
 const moved=JSON.parse(row.originalJson);moved._speed=11;row.originalJson=JSON.stringify(moved);
 assert.equal(saintStatueNative(records.enemies[ids[0]].levels[0],nativeComponents(transport,ids[0])),false);
 const changed=structuredClone(records.enemies[ids[0]].levels[0]);changed.talents.bb['CircleShield.shield_max_rate']=1;
 assert.equal(saintStatueNative(changed,nativeComponents(native,ids[0])),false);
});

const matriarch='enemy_10091_hlsttu_3';
test('Matriarch reuses the shared aura/body/transport and overrides its target count through data',()=>{
 const row=records.enemies[matriarch].levels[0];
 assert.ok(saintStatueNative(row,nativeComponents(native,matriarch)));
 const plan=compileEnemyRuntimePlan(row);
 assert.deepEqual(plan.entries.filter(e=>e.ability).map(e=>e.ability.kind),['rechargingBarrierAura','passiveEnemyBody','animatedProjectileAttack']);
 assert.equal(plan.entries.find(e=>e.id==='talent:AttackTargetNum').trait.maxTargets,3);
});
test('Matriarch recharges six percent per second to a 150-percent cap without shielding its own body',()=>{
 for(const compiled of[false,true]){
  const f=fixture(matriarch,compiled);f.e.profile.noAttack=true;
  assert.equal(f.e.counted,false);f.run(.9);assert.equal(f.charge(f.u),0);f.run(.2);assert.equal(f.charge(f.u),60);
  f.b.applyStatus(f.e,'silence',{duration:30});f.b.applyStatus(f.e,'freeze',{duration:30});f.run(25);
  assert.equal(f.charge(f.u),1500);assert.equal(f.charge(f.e),0);assert.equal(f.u.buffs.filter(b=>b.key===key).length,1);
  f.b.kill(f.e);f.run(2);assert.equal(f.charge(f.u),1500);assert.deepEqual(f.b.errors,[]);
 }
});
test('Matriarch waits for its native wind-up, releases at three distinct targets and retains released shots after death',()=>{
 for(const compiled of[false,true]){
  const f=fixture(matriarch,compiled,[[9,3],[9,4],[10,5],[11,5]]),hits=[],attacks=[];
  f.b.on('attack',c=>{if(c.attacker===f.e)attacks.push(c.targets.map(u=>u.id));});
  f.b.on('damaged',c=>{if(c.source===f.e)hits.push(c);});
  assert.equal(f.e.profile.maxTargets,3);assert.equal(f.e.def.attackAnim.hit,Math.fround(25/30));
  f.run(.4);assert.equal(f.b.projectiles.list.length,0);
  assert.ok(f.runUntil(()=>f.b.projectiles.list.length===3,3));
  assert.equal(attacks.length,1);assert.equal(new Set(attacks[0]).size,3);assert.equal(hits.length,0);
  f.b.kill(f.e);assert.ok(f.runUntil(()=>hits.length===3,2));
  assert.equal(new Set(hits.map(c=>c.target.id)).size,3);assert.ok(hits.every(c=>c.dmg.type==='arts'&&c.hpLoss===225));
  assert.deepEqual(f.b.errors,[]);
 }
});
test('Matriarch admission refuses altered talent target routing, release timing and added log gameplay',()=>{
 const row=records.enemies[matriarch].levels[0];
 for(const edit of[
  n=>n.AttackTargetNum.find(c=>c.m_Script?.m_PathID==='4865767822664548221')._selector={m_FileID:0,m_PathID:'9'},
  n=>{const c=n.AttackTargetNum.find(c=>c.m_Script?.m_PathID==='4865767822664548221');n.$siblings(c).find(c=>'_overwriteTalentKey'in c)._overwriteTalentKey='other';},
  n=>{const root=n[matriarch].find(c=>'_modes'in c),mode=n.$ref(root._modes[0]);n.$ref(mode._attack)._waitForAttackEvent=0;},
  n=>n.LogKilled.find(c=>'_buffs'in c)._buffs[0].attributes.abnormalFlags.push(5),
 ]){const n=nativeComponents(structuredClone(native),matriarch);edit(n);assert.equal(saintStatueNative(row,n),false);}
 const changed=structuredClone(row);changed.talents.bb['AttackTargetNum.attack@max_target']=4;
 assert.equal(saintStatueNative(changed,nativeComponents(native,matriarch)),false);
});

test('Matriarch interruption cancels unreleased shots and a later attack starts a fresh marker clock',()=>{
 const f=fixture(matriarch,true,[[9,3],[9,4],[9,5]]);f.run(.4);
 assert.equal(f.b.projectiles.list.length,0);f.b.applyStatus(f.e,'freeze',{duration:2});f.run(1);
 assert.equal(f.b.projectiles.list.length,0);f.run(1.1);
 assert.ok(f.runUntil(()=>f.b.projectiles.list.length===3,3));assert.deepEqual(f.b.errors,[]);
});
test('Matriarch source death before the animation marker cancels all pending releases',()=>{
 const f=fixture(matriarch);f.run(.4);f.b.kill(f.e);f.run(3);
 assert.equal(f.b.projectiles.list.length,0);assert.equal(f.g.hp,f.g.s.maxHp);assert.deepEqual(f.b.errors,[]);
});
test('Matriarch release and recovery use the shared slowdown-adjusted cast clock',()=>{
 const f=fixture(matriarch,true,[[9,3],[9,4],[9,5]]);
 f.b.addBuff(f.e,{key:'test:slowCast',mods:{slowDownMul:.5}});f.run(1.2);
 assert.equal(f.b.projectiles.list.length,0);assert.equal(f.e.mem.regularFormVisual.speed,.5);
 assert.ok(f.runUntil(()=>f.b.projectiles.list.length===3,2));assert.deepEqual(f.b.errors,[]);
});

test('the shared timed-projectile adapter rejects malformed release timelines before combat',async()=>{
 const {animatedProjectileAttack}=await import('../server/sim/content/arkpedia-enemy-projectiles.js');
 for(const animation of[
  {clip:'Attack',duration:1,releases:[]},{clip:'Attack',duration:1,releases:[NaN]},
  {clip:'Attack',duration:1,releases:[1.1]},{clip:'Attack',duration:1,releases:[.5,.4]},
  {clip:'Attack',duration:Infinity,releases:[.4]},
 ])assert.throws(()=>animatedProjectileAttack({type:'arts',speed:10,lifetime:10,animation}),/Invalid projectile attack animation/);
});
