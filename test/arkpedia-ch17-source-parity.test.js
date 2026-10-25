// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { nativeComponents, deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-16-2.json' with { type: 'json' };
import { assertRegularEnemies, REGULAR_ENEMIES } from '../shared/arkpedia/enemies.js';
const read = p => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const actions = read('candidates/arkpedia-ch16-action-source.json');
const evidence = { ...read('candidates/arkpedia-ch16-native-abilities.json'), actions };
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const index = read('arkpedia-enemy-clock-source.json').prefabs;
const ids = ['enemy_10203_mumag','enemy_10206_muveg','enemy_10208_mucow','enemy_10210_muwiz','enemy_10211_murad'];
const near = (a,z) => assert.ok(Math.abs(a-z)<1e-6, `${a} != ${z}`);
const projectile = key => actions.projectiles[`dyn/battle/prefabs/[uc]projectiles/${key}.prefab`].map(c => JSON.parse(c.originalJson));
const nodes = key => JSON.parse(actions.templates[key].originalJson).eventToActions._items.flatMap(e => JSON.parse(e.value.SerializedState));

test('retained native projectile bytes independently establish movement, collision and lifetime parity constants',()=>{
  for(const [key,speed,life,radius] of [['projectile_enemy_murad_hide',6,1.3,.6],['projectile_enemy_murad',6,1.1,.6],['projectile_enemy_muwiz',8,10,1],['projectile_enemy_mumag',10,10,null]]) {
    const rows=projectile(key);assert.ok(rows.some(c=>c._speed===speed));near(rows.find(c=>c._lifeTime>0)._lifeTime,life);
    if(radius!=null)near(rows.find(c=>c.m_Radius>0).m_Radius,radius);
  }
  for(const key of ['projectile_enemy_mumag_charge','projectile_enemy_muwiz_line']) {
    const rows=projectile(key);assert.ok(rows.some(c=>c._speed===10));assert.ok(rows.some(c=>c._keepAlreadyHitTime===1));
  }
});

test('retained native actions independently specify delayed attack, forced shield guard and final-flat theft ownership',()=>{
  const trim=nativeComponents(evidence,ids[1]);near(trim.Combat[0]._activeBuffs[0].triggerInterval,.7);
  assert.equal(trim.Combat[0]._atkScale,0);assert.ok(nodes('muveg_attack_damage').some(n=>n._defaultAtkScale===1&&n._attackType==='NORMAL'));
  const forced=nodes('enemy_muwiz_t');const at=forced.findIndex(n=>n.$type.endsWith('+CheckEnemySkillAffecting'));
  assert.ok(at>=0);assert.ok(forced[at+1].$type.endsWith('+IfNot'));
  const trigger=forced.find(n=>n.$type.endsWith('+TriggerEnemySkill'));assert.equal(trigger._checkSkillReady,false);assert.equal(trigger._interruptCurAbility,true);
  const caster=nativeComponents(evidence,ids[3]);assert.equal(caster.StealAtk[0]._formulaType,2);
  assert.equal(caster.StealAtk[0]._keepTargetAttributeAtLeastOneAfterSteal,1);
  assert.equal(caster.StealAtk[0]._finishTargetBuffWhenInvalid,1);assert.equal(caster.StealAtk[0]._finishOwnerBuffWhenTargetInvalid,0);
});

test('native environment agrees with tile validation, harmless summons and firewall click/lifetime configuration',()=>{
  const env=Object.entries(actions.environments).find(([k])=>k.endsWith('env_v073_mainline17_ctrl.prefab'))[1].map(c=>JSON.parse(c.originalJson));
  const summon=env.find(c=>c._enemyKey);assert.equal(summon._enemyKey,ids[4]);assert.equal(summon._unharmful,1);assert.equal(summon._maxTileNum,1);
  assert.equal(summon._tileOptions.buildableType,3);assert.equal(summon._tileOptions.passableMask,1);assert.equal(summon._tileOptions.checkBuildableOrPassable,0);
  const boss=Object.entries(actions.environments).find(([k])=>k.endsWith('env_v073_mainline17_boss_ctrl.prefab'))[1].map(c=>JSON.parse(c.originalJson));
  for(const config of boss.find(c=>c._bossFirewallEffectConfigs)._bossFirewallEffectConfigs){assert.equal(config.vulnerabilityButtonDuration,5);assert.equal(config.vulnerabilityRequiredClickCount,3);}
});

test('all retained actions and projectiles preserve their recorded SHA-256 identities',()=>{
  for(const c of [...Object.values(actions.templates),...Object.values(actions.projectiles).flat(),...Object.values(actions.environments).flat()])
    assert.equal(createHash('sha256').update(c.originalJson).digest('hex'),c.sha256);
});

for(const id of ids)test(`${id}: altered native component, missing action closure or extra blackboard parameter cannot clear support`,()=>{
  for(const mutate of [
    e=>{e.prefabs[prefabPath(id)][0].originalJson+=' ';},
    e=>{delete e.actions;},
    e=>{e.actions.templates.enemy_mucow_t.originalJson+=' ';},
  ]) {
    const changed=structuredClone(evidence);mutate(changed);
    assert.equal(deriveEnemySupport({[id]:records[id]},index,changed)[id].policy,null);
  }
  const changed=structuredClone(records[id]);changed.levels[0].talents.bb.unreviewed=1;
  assert.equal(deriveEnemySupport({[id]:changed},index,evidence)[id].policy,null);
  assert.equal(REGULAR_ENEMIES[id],undefined,'public registry remains held');
});

test('StandardBattle integrates the native marker device and all five canonical controllers without a stub environment',()=>{
  const data=structuredClone(mvp);data.stage=structuredClone(stage);
  const enemies={...data.stage.enemies,...Object.fromEntries(ids.map(id=>[id,records[id].levels[0]]))};
  data.stage.enemies=enemies;data.enemies=enemies;
  data.stage.devices=[{key:'trap_329_rift',name:'Leak Marker',kind:'device',row:2,col:3,spCost:1}];
  const b=new StandardBattle(data,{operators:[defaultBuild(Object.values(data.operators)[0])]});
  assert.equal(b.chapter16.rifts.length,1);assert.doesNotThrow(()=>assertRegularEnemies(data));
  for(const id of ids){const e=b.spawnEnemy(id,{pos:[2,3],countInTotal:false});assert.ok(e.mem.ab.list.length);e.base.moveSpeed=0;e.markDirty();}
  for(let i=0;i<Math.round(1.2/b.dt);i++)b.step();
  assert.deepEqual(b.errors,[]);assert.ok(b.enemies.filter(e=>e.mem.ch16Leak).length>=2,'scheduled marker created another canonical source');
  const missing=structuredClone(data);delete missing.enemies.enemy_10211_murad;
  assert.throws(()=>assertRegularEnemies(missing),/Missing record|Missing canonical/);
});
