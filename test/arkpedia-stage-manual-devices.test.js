// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeBattle, enemyRec, chessRec } from './helpers/battleHarness.js';
import { ManualStageDevices } from '../server/sim/content/arkpedia-stage-manual-devices.js';
import { manualDeviceNativeReviewed, manualDeviceDefinition } from '../shared/arkpedia/stage-manual-devices.js';
import { enemyStealthed, canTargetAlly, enemyAttackTargets, sortAllyTargets } from '../server/sim/targeting.js';
import { areaAllies, areaAlliesInTiles, fieldAllies } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };

function fixture(key = 'trap_002_emp', count = 1) {
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 600,
    players: [{ playerId: 'arkpedia', side: 'L', units: [] }],
    defs: { enemies: { target: enemyRec({ hp: 10000, res: 20, speed: 0 }) } } });
  h.b.start(); h.b.getPlayer('arkpedia').dp = 99;
  h.b.life = 3; h.b.unitLimit = 8;
  const devices = Array.from({ length: count }, (_, i) => ({ key, row: 9, col: 6 + i,
    name: { trap_002_emp: 'Stun Generator', trap_005_sensor: 'Detector', trap_008_farm: 'Command Terminal' }[key], kind: 'device', hidden: false, instance: { level: 10, skillLevel: 1 } }));
  const controller = new ManualStageDevices(h.b, devices), d = [...controller.entries.values()][0];
  return { h, b: h.b, controller, d };
}
test('manual device source hashes and predicates reject changed native timing and targeting', () => {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  for (const row of Object.values(native.prefabs).flatMap(p => p.components))
    assert.equal(createHash('sha256').update(JSON.stringify(canonical(row.data))).digest('hex'), row.sha256);
  const changed = structuredClone(native);
  changed.prefabs.sktok_emp.components.find(c => '_damageType' in c.data).data._preDelay = 0;
  changed.prefabs.sktok_sensor.components.find(c => '_targetOptions' in c.data).data._targetOptions.ignoreTargetFree = 0;
  for (const key of ['trap_002_emp', 'trap_005_sensor']) {
    assert.equal(manualDeviceNativeReviewed(key), true); assert.equal(manualDeviceNativeReviewed(key, changed), false);
  }
  assert.equal(manualDeviceDefinition('trap_002_emp', { level: 10, skillLevel: 1 }).damage, 1000);
  assert.equal(manualDeviceDefinition('trap_002_emp', { level: 30, skillLevel: 1 }).damage, 3000);
});
test('Stun Generator checks SP and DP, samples ground targets at release, then withdraws once', () => {
  const { h, b, controller, d } = fixture();
  assert.throws(() => controller.activate(d.id), /charging/);
  h.run(5); b.getPlayer('arkpedia').dp = 9;
  assert.throws(() => controller.activate(d.id), /DP/); assert.equal(d.sp, 5);
  b.getPlayer('arkpedia').dp = 20;
  const ground = b.spawnEnemy('target', { pos: [9, 5] }), air = b.spawnEnemy('target', { pos: [10, 6] });
  air.motion = 'FLY';
  const outside = b.spawnEnemy('target', { pos: [9, 8] });
  b.addBuff(ground, { key: 'concealed', flags: { stealth: true, untargetable: true } });
  controller.activate(d.id); assert.equal(b.getPlayer('arkpedia').dp, 10); assert.equal(d.sp, 0);
  assert.throws(() => controller.activate(d.id), /already active/);
  h.run(.7); assert.equal(ground.hp, 10000);
  h.run(.1); assert.equal(ground.hp, 9200); assert.equal(air.hp, 10000); assert.equal(outside.hp, 10000);
  assert.equal(ground.s.flags.stun, true); assert.equal(d.sp, 0);
  h.run(.8); assert.equal(d.state, 'spent'); assert.equal(d.unit.alive, false);
  assert.equal(b._occ[9 * b.grid.cols + 6], null);
  assert.throws(() => controller.activate(d.id), /no longer/); assert.deepEqual(b.errors, []);
});
test('Detector reveals moving ground/air targets, cleans each source separately and pauses SP during its duration', () => {
  const { h, b, controller, d } = fixture('trap_005_sensor', 2), second = [...controller.entries.values()][1];
  const target = b.spawnEnemy('target', { pos: [9, 5] }); target.motion = 'FLY';
  b.addBuff(target, { key: 'invisible', flags: { stealth: true, untargetable: true } });
  assert.equal(enemyStealthed(target), true); h.run(15);
  controller.activate(d.id); controller.activate(second.id); assert.equal(enemyStealthed(target), false);
  h.run(10); assert.equal(d.sp, 0);
  target.x = 2; h.run(.1); assert.equal(enemyStealthed(target), true);
  target.x = 5; h.run(.1); assert.equal(enemyStealthed(target), false);
  b._remove(d.unit, 'withdraw'); h.run(.1); assert.equal(enemyStealthed(target), false, 'second source still reveals');
  h.run(9.7); assert.equal(enemyStealthed(target), true); assert.equal(second.sp, 0);
  h.run(1); assert.ok(Math.abs(second.sp - 1) < 1e-8); assert.deepEqual(b.errors, []);
});
test('original placed levels are retained atomically; unknown skill overrides stay blocked', async () => {
  const c = await loadContentContext();
  for (const [id, key, level] of [['1-12', 'trap_002_emp', 10], ['3-7', 'trap_005_sensor', 60]]) {
    const p = await planStage(c, id); assert.deepEqual(p.blockers, []);
    const d = p.stage.devices.find(d => d.key === key); assert.deepEqual(d.instance, { level, skillLevel: 1 });
    assert.ok(p.localSources.some(s => s.path === 'data/arkpedia-device-native-source.json'));
    const original = { predefines: { tokenInsts: [{ position: { row: d.row, col: d.col }, hidden: false,
      skillIndex: 0, mainSkillLvl: 1, inst: { characterKey: key, level, phase: 'PHASE_0' }, overrideSkillBlackboard: [{ key: 'stun', value: 100 }] }] } };
    assert.throws(() => validateStaticDeviceInstances([d], original), /override/);
  }
});

test('Command Terminal upgrades once, regenerates through heal-free, and retains its slot after destruction', () => {
  const { h, b, controller, d } = fixture('trap_008_farm', 2), second = [...controller.entries.values()][1];
  const u = d.unit;
  assert.deepEqual([u.hp, u.s.def, u.s.res, u.s.taunt], [5000, 100, 10, 0]);
  assert.equal(u.s.blockCnt, 0); assert.equal(u.deploymentSlotCost, 0);
  assert.equal(b.grid.tile(d.row, d.col).pass, 'FLY');
  assert.equal(b.grid.tile(d.row, d.col).build, 'NONE');
  assert.throws(() => controller.activate(d.id), /charging/);
  h.run(120); assert.equal(d.sp, 120);
  b.getPlayer('arkpedia').dp = 19; assert.throws(() => controller.activate(d.id), /DP/);
  b.getPlayer('arkpedia').dp = 50; controller.activate(d.id);
  assert.equal(b.unitLimit, 9); assert.equal(b.getPlayer('arkpedia').dp, 30);
  assert.deepEqual([u.s.def, u.s.res, u.s.hpRegen], [300, 30, 10]);
  u.hp -= 100;
  assert.equal(b.heal(second.unit, u, 100), 0);
  assert.equal(b.heal(u, u, 100, { self: true }), 0);
  h.run(3); assert.ok(Math.abs(u.hp - 4930) < 1.01);
  assert.equal(d.sp, 0); assert.equal(d.state, 'active');
  assert.throws(() => controller.activate(d.id), /already active/);
  controller.activate(second.id); assert.equal(b.unitLimit, 10);
  b.dealDamage(null, u, { amount: 1e6, type: 'true', sourceless: true });
  assert.equal(u.alive, false); assert.equal(b.life, 2); assert.equal(b.unitLimit, 10);
  assert.equal(b.grid.tile(d.row, d.col).pass, 'ALL');
  assert.equal(b.grid.tile(d.row, d.col).build, 'ALL');
  b._remove(u, 'killed'); h.run(1); assert.equal(b.life, 2);
  b._remove(second.unit, 'killed'); assert.equal(b.life, 1); assert.equal(b.unitLimit, 10);
  assert.deepEqual(b.errors, []);
});

test('Command Terminal is an enemy building target, but never a friendly buff/heal candidate', () => {
  const { b, d } = fixture('trap_008_farm');
  const e = b.spawnEnemy('target', { pos: [9, 7] });
  const other = b.spawnDevice('other', 10, 6, { blockCnt: 0 });
  assert.equal(canTargetAlly(e, d.unit, true), true); assert.equal(canTargetAlly(e, other, true), false);
  assert.deepEqual(enemyAttackTargets(b, e, 3), [d.unit]);
  assert.deepEqual(areaAllies(b, e, 6, 9, 3), [d.unit]);
  assert.deepEqual(areaAlliesInTiles(b, e, 9, 6), [d.unit]);
  assert.deepEqual(fieldAllies(b, e), [d.unit]);
  assert.equal(b.allySelectable(d.unit, other), false);
  assert.equal(b.alliesFor(other).includes(d.unit), false);
});

test('Marksman and Fanatic choose a real terminal over a later operator; building damage uses the shared pipeline', () => {
  for (const id of ['enemy_1057_gansho', 'enemy_1059_buster']) {
    const record = ENEMY_RECORDS.enemies[id]; assert.ok(record, id);
    const target = chessRec({ id: 'building_control', stats: { atk: 0, maxHp: 10000, def: 0 } });
    const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 30,
      defs: { chess: { [target.chessId]: target }, enemies: { [id]: record.levels[0] } },
      units: [{ chessId: target.chessId, row: 10, col: 6 }], setup: installEnemyFeatures });
    const b = h.b; b.start(); b.life = 3;
    const controller = new ManualStageDevices(b, [{ key: 'trap_008_farm', name: 'Command Terminal', hidden: false,
      row: 9, col: 6, instance: { level: 1, skillLevel: 1 } }]);
    const d = [...controller.entries.values()][0], ally = b.allyUnits.find(u => u.kind === 'op');
    b.addBuff(ally, { key: 'control', flags: { disarm: true, noBlock: true, noMove: true } });
    ally.aggroSeq = d.unit.aggroSeq + 1;
    const e = b.spawnEnemy(id, { pos: [9, 7] });
    assert.equal(sortAllyTargets(e, enemyAttackTargets(b, e, 3))[0], d.unit);
    assert.ok(h.runUntil(() => d.unit.hp < 5000, 5), id);
    assert.equal(ally.stats.taken, 0);
    if (id === 'enemy_1059_buster') assert.equal(d.unit.stats.taken, e.s.atk * 1.5 - 100);
    assert.deepEqual(b.errors, []);
  }
});

test('Command Terminal rejects altered lifecycle templates and native skill modifiers', () => {
  assert.equal(manualDeviceNativeReviewed('trap_008_farm'), true);
  for (const change of ['grant', 'life', 'def', 'target']) {
    const n = structuredClone(native);
    if (change === 'grant') n.templates.farm_s_1.eventToActions.ON_BUFF_FINISH = [];
    if (change === 'life') n.templates.farm_t_1.eventToActions.ON_OWNER_FINISH[0]._isSub = true;
    if (change === 'def') n.prefabs.sktok_farm.components.find(c => '_buffs' in c.data).data._buffs[0].attributes.attributeModifiers[0].formulaItem = 0;
    if (change === 'target') n.prefabs.trap_008_farm.components.find(c => '_category' in c.data).data._category = 2;
    assert.equal(manualDeviceNativeReviewed('trap_008_farm', n), false, change);
  }
});
