// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemyRuntimeRecord } from '../shared/arkpedia/enemy-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageRewardDevices } from '../server/sim/content/arkpedia-stage-reward-devices.js';
import { rewardDeviceDefinition, rewardDeviceNativeReviewed } from '../shared/arkpedia/stage-reward-devices.js';
import { stageDeviceSpec } from '../shared/arkpedia/stage-devices.js';
import { readStageOutcomes } from '../server/sim/content/arkpedia-stage-outcomes.js';
import { validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const id = 'trap_760_skztzs', child = 'enemy_2088_skzdwz';
const entry = (alias, row = 9, hidden = false) => ({ key: id, name: 'Spines of Epoch', kind: 'device',
  alias, row, col: 7, hidden, instance: { level: 1, skillLevel: 1 } });
function fixture(entries = [entry('spines')]) {
  const op = chessRec({ id: 'spines_test', stats: { atk: 0, maxHp: 1e6 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, units: [{ chessId: op.chessId, row: 9, col: 6 }],
    defs: { chess: { [op.chessId]: op }, enemies: { [child]: enemyRuntimeRecord(ENEMY_RECORDS.enemies[child].levels[0]) } },
    setup: installEnemyFeatures });
  h.b.start(); const seen = []; h.b.on('elementHit', c => seen.push(c));
  const controller = new StageRewardDevices(h.b, entries);
  return { ...h, seen, controller, u: h.b.allyUnits[0], spines: controller.entries.get(entries[0].alias).unit };
}
test('Spines source checks its removable Mark, native side, immunity and defeated-result log', () => {
  assert.equal(rewardDeviceNativeReviewed(id), true);
  for (const change of ['side', 'ability', 'child', 'cleanup', 'immune', 'log']) {
    const n = structuredClone(native), root = n.prefabs[id].components.find(c => c.object === id).data;
    if (change === 'side') root._sideType = 1;
    if (change === 'ability') root._commonAbilities.push(root._commonAbilities[0]);
    if (change === 'child') n.templates['skztzs_t[apoptosis]'].eventToActions.ON_BUFF_START[0]._enemyKey = 'other';
    if (change === 'cleanup') n.templates['skztzs_t[apoptosis]'].eventToActions.ON_BUFF_FINISH = [];
    if (change === 'immune') n.prefabs[id].components.find(c => c.object === 'Passive').data._buffs[0].attributes.abnormalImmunes.push(12);
    if (change === 'log') n.templates.log_killed.eventToActions.ON_OWNER_KILLED[0]._additionValue = 2;
    assert.equal(rewardDeviceNativeReviewed(id, n), false, change);
  }
  const def = rewardDeviceDefinition(id, { level: 30, skillLevel: 1 });
  assert.deepEqual([def.hp, def.def, def.res, def.taunt], [12000, 1200, 50, 1]);
  assert.deepEqual(stageDeviceSpec(entry('a')).spawns, [child]);
});
test('a placed enemy-side Spine owns one neutral Mark and no enemy/deployment credit', () => {
  const f = fixture(), { b, spines: s } = f;
  assert.equal(s.side, 'enemy'); assert.equal(s.profile.characterLikeDevice, true); assert.equal(s.s.taunt, 1);
  assert.equal(s.deploymentSlotCost, 0); assert.equal(b.total, 0); assert.equal(s.obstacle, false);
  assert.ok(s.findBuff('skztzs_self_mark')); assert.equal(b.neutralUnits.length, 1);
  f.run(1.1); assert.equal(f.seen.length, 1); assert.ok(s.findBuff('rogue_4_apoptosis[enemy]'));
  b.kill(s, f.u); assert.equal(b.neutralUnits[0].alive, false); assert.equal(b.stageEpoch.tiles.size, 0);
  assert.equal(readStageOutcomes(b).counters.killed, 1); assert.equal(b.killed, 0);
  f.run(2); assert.equal(f.seen.length, 1); assert.deepEqual(b.errors, []);
});
test('overlapping Spines share the same contact timer and retire only their own Mark', () => {
  const f = fixture([entry('a'), entry('b', 10)]); f.run(.8);
  f.b.kill(f.spines); f.run(.3); assert.equal(f.seen.length, 1); assert.equal(f.b.neutralUnits.length, 1);
  const other = f.controller.entries.get('b').unit; f.b._remove(other, 'expired');
  assert.equal(f.b.stageEpoch.tiles.size, 0); f.run(2); assert.equal(f.seen.length, 1);
  assert.equal(readStageOutcomes(f.b).counters.killed, 1); assert.deepEqual(f.b.errors, []);
});
test('native immunity does not turn silence into an immunity or disable the unsilenceable field', () => {
  const f = fixture(), { b, spines: s } = f;
  for (const status of ['stun', 'freeze', 'sleep']) assert.equal(b.applyStatus(s, status, { duration: 5 }), false, status);
  assert.ok(b.applyStatus(s, 'silence', { duration: 5 })); f.run(1.1); assert.equal(f.seen.length, 1);
  assert.equal(s.hp, 12000); assert.deepEqual(b.errors, []);
});
test('hidden alias activation is idempotent and occupied-tile failure cannot leave an orphan Mark', () => {
  const f = fixture([entry('hidden', 9, true)]); assert.equal(f.b.neutralUnits.length, 0);
  assert.equal(f.controller.activate('hidden'), true); assert.equal(f.controller.activate('hidden'), true);
  assert.equal(f.b.neutralUnits.length, 1); f.controller.activate('missing'); assert.equal(f.b.neutralUnits.length, 1);
  const failed = new StageRewardDevices(f.b, [entry('occupied')]);
  assert.equal(failed.entries.get('occupied').unit, null); assert.equal(f.b.neutralUnits.length, 1);
  assert.deepEqual(f.b.errors, []);
});
test('the same source instance validator handles Spines levels and rejects unknown overrides', () => {
  const d = entry('native'), p = { alias: d.alias, hidden: false, position: { row: 9, col: 7 },
    inst: { characterKey: id, level: 1, phase: 'PHASE_0', potentialRank: 0, favorPoint: 0 }, skillIndex: -1, mainSkillLvl: 1 };
  const level = { predefines: { tokenInsts: [p] } }, instances = {};
  validateStaticDeviceInstances([d], level, instances); assert.deepEqual(instances[`${id}:9:7`], { level: 1, skillLevel: 1 });
  p.skillIndex = 0; assert.throws(() => validateStaticDeviceInstances([d], level, {})); p.skillIndex = -1;
  p.overrideSkillBlackboard = [{ key: 'unreviewed', value: 1, valueStr: null }];
  assert.throws(() => validateStaticDeviceInstances([d], level, {}));
});
