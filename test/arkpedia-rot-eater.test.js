// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { rotEaterNative } from '../shared/arkpedia/enemy-rot-eater-features.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
const id = 'enemy_1266_nhapos';
test('original stage full-strength floor changes one fresh record and rejects other percentages', () => {
  const original = ENEMY_RECORDS.enemies[id].levels[0];
  const override = { level: original.level, blackboard: [{ key: 'PollutedArea.guaranteed_percentage', value: 1, valueStr: null }] };
  const modified = applyStageEnemyBlackboard(original, override);
  assert.equal(modified.talents.bb['PollutedArea.guaranteed_percentage'], 1);
  assert.equal(original.talents.bb['PollutedArea.guaranteed_percentage'], .2);
  assert.equal(rotEaterNative(modified, nativeComponents(evidence, id)), true);
  for (const value of [0, .5, 2, NaN]) assert.throws(() => applyStageEnemyBlackboard(original,
    { ...override, blackboard: [{ ...override.blackboard[0], value }] }));
});
test('Rot Eater admission rejects altered progress attributes and bounds', () => {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  assert.equal(rotEaterNative(record, nativeComponents(evidence, id)), true);
  const ev = structuredClone(evidence);
  ev.templates['enemy_nhapos_t[born]'].eventToActions.ON_BUFF_START[1]._attributeType = 'RES';
  assert.equal(rotEaterNative(record, nativeComponents(ev, id)), false);
  const changed = structuredClone(record); changed.talents.bb['PollutedArea.max_percentage'] = 1;
  assert.equal(rotEaterNative(changed, nativeComponents(evidence, id)), false);
});
function fixture() {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const target = chessRec({ id: 'rot_target', stats: { atk: 0, maxHp: 100000 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { enemies: { [id]: r }, chess: { [target.chessId]: target } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }],
    setup: b => {
      b.on('enemySpawn', ({ enemy }) => { if (enemy.tag === 'twig-child') enemy.mem.stageBranch = true; }, { priority: 1000 });
      installEnemyFeatures(b);
    } });
  h.b.start(); return h;
}
test('Rot Eater birth stats clamp stage progress without increasing above source stats', () => {
  for (const [killed, leaked, scale] of [[0, 0, .2], [40, 0, .4], [90, 0, .8], [100, 0, 1], [90, 10, 1]]) {
    const h = fixture(); h.b.total = 100; h.b.killed = killed; h.b.leakedCount = leaked;
    const e = h.b.spawnEnemy(id, { pos: [9, 7], tag: 'twig-child', countInTotal: false });
    assert.equal(e.mem.rotEaterBirthScale, scale); assert.equal(e.s.maxHp, 40000 * scale);
    assert.equal(e.s.atk, 2000 * scale); assert.equal(e.s.def, 1000 * scale); assert.equal(e.hp, e.s.maxHp);
    h.b.killed = 100; h.run(.1); assert.equal(e.s.atk, 2000 * scale, 'birth value is frozen');
    assert.deepEqual(h.b.errors, []);
  }
});
test('ordinary entry-point Rot Eaters retain full stats; pollution starts after one second and ends with its owner', () => {
  const h = fixture(); h.b.total = 100;
  const e = h.b.spawnEnemy(id, { pos: [9, 7] }); e.profile.noAttack = true;
  assert.equal(e.s.maxHp, 40000); assert.equal(e.s.atk, 2000);
  const u = h.b.allyUnits[0]; h.run(.8); assert.equal(u.hp, 100000);
  h.run(.3); assert.equal(u.hp, 99950);
  h.b.kill(e); const hp = u.hp; h.run(2); assert.equal(u.hp, hp);
  assert.equal(u.findBuff('ab:corruption'), null); assert.deepEqual(h.b.errors, []);
});
