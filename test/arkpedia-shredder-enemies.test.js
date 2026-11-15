// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageScenery } from '../server/sim/content/arkpedia-stage-scenery.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { brokenStumpNative, shredderNative } from '../shared/arkpedia/enemy-shredder-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import devices from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const ids = ['enemy_1097_cclmbjk', 'enemy_1097_cclmbjk_2'];
function fixture(id = ids[0]) {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  const op = chessRec({ id: 'shredder_target', stats: { maxHp: 100000, atk: 0, def: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 100, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 10, col: 6 }] });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [10, 5] });
  b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const scenery = b.stageScenery = new StageScenery(b, []);
  scenery.stumps.set('11,5', { row: 11, col: 5 });
  b.grid.setTile(11, 5, { ...b.grid.tile(11, 5), height: 'HIGH', build: 'RANGED', pass: 'FLY' });
  const hits = []; b.on('hit', c => { if (c.source === e) hits.push({ time: b.time, target: c.target, dmg: c.dmg }); });
  return { h, b, e, record, hits, target: h.allies()[0], scenery };
}
test('both Shredders use delayed ground-only melee damage at range, charging four releases before cutting a stump', () => {
  for (const id of ids) {
    const { h, b, e, record, hits, target, scenery } = fixture(id);
    target.motion = 'FLY'; h.run(1); assert.equal(e.stats.attacks, 0);
    target.motion = 'WALK'; h.run(1.3); assert.equal(hits.length, 0);
    h.run(.2); assert.equal(hits.length, 1); assert.equal(e.mem.stumpShredder.sp, 1);
    assert.equal(hits[0].dmg.amount, record.stats.atk); assert.equal(hits[0].dmg.applyWay, 'melee');
    assert.equal(b.projectiles.list.length, 0);
    h.runUntil(() => e.mem.stumpShredder.cast?.skill, 25);
    assert.equal(hits.length, 4); assert.equal(e.mem.stumpShredder.sp, 0);
    h.run(1.3); assert.equal(scenery.brokenStumps.size, 0);
    h.run(.2); assert.equal(scenery.brokenStumps.size, 1);
    assert.equal(b.grid.tile(11, 5).build, 'NONE'); assert.equal(b.grid.tile(11, 5).pass, 'FLY');
    assert.equal(scenery.destructibleStumps(e, 1.8).length, 0); assert.deepEqual(b.errors, []);
  }
});
test('silence keeps accumulated readiness and ordinary attacks; stun cancels a pre-release cast', () => {
  const { h, b, e, scenery, hits } = fixture(); b.applyStatus(e, 'silence', { duration: 24 });
  h.run(23); assert.equal(e.mem.stumpShredder.sp, 4); assert.ok(hits.length >= 4); assert.equal(scenery.brokenStumps.size, 0);
  h.runUntil(() => e.mem.stumpShredder.cast?.skill, 5); b.applyStatus(e, 'stun', { duration: 5 });
  h.run(5); assert.equal(scenery.brokenStumps.size, 0); assert.equal(e.mem.stumpShredder.sp, 0);
  assert.deepEqual(b.errors, []);
});
test('Slow Down stretches release, interrupted ordinary attacks grant no SP, and no eligible terrain preserves a full charge', () => {
  const { h, b, e, scenery, hits } = fixture(); b.addBuff(e, { key: 'slow', mods: { slowDownMul: .5 } });
  h.run(2); assert.equal(hits.length, 0); b.applyStatus(e, 'stun', { duration: 1 });
  h.run(1); assert.equal(e.mem.stumpShredder.sp, 0); b.removeBuff(e, 'slow');
  scenery.stumps.clear(); h.run(25); assert.equal(e.mem.stumpShredder.sp, 4);
  assert.equal(scenery.brokenStumps.size, 0); assert.deepEqual(b.errors, []);
});
test('stump destruction kills allied occupants through rebirth, disables deployment, and is idempotent', () => {
  const { b, e, target, scenery } = fixture();
  scenery.stumps.set('10,6', { row: 10, col: 6 });
  b.addBuff(target, { key: 'invincible', flags: { invulnerable: true } });
  let kills = 0; b.on('kill', ({ victim }) => { if (victim === target && ++kills === 1) victim.hp = 1; });
  assert.equal(scenery.destroyStump(10, 6, e), true); assert.equal(target.alive, true); assert.equal(target.hp, 1);
  assert.equal(b.grid.tile(10, 6).build, 'NONE'); assert.equal(scenery.destroyStump(10, 6, e), false); assert.equal(kills, 1);
  assert.deepEqual(b.errors, []);
});
test('admission requires both source-reviewed enemy variants and exact broken-stump terrain semantics', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const field of ['radius', 'kill', 'motion', 'silence']) {
    const n = structuredClone(native);
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (field === 'radius' && 'm_Radius' in d) d.m_Radius = 9;
      if (field === 'kill' && d._actions) d._actions.SerializedState = '[]';
      if (field === 'motion' && d._targetCategory === 1) d._targetMotion = 3;
      if (field === 'silence' && '_ignoreSilence' in d) d._ignoreSilence = 1;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clocks.prefabs, n).policy, null, field);
  }
  const d = structuredClone(devices); d.prefabs.trap_017_wooden_broke.components.find(c => c.data._tileOptions).data._tileOptions.buildableType = 2;
  assert.equal(brokenStumpNative(d), false);
  assert.equal(shredderNative(ENEMY_RECORDS.enemies[ids[0]].levels[0], nativeComponents(native, ids[0]), d), false);
});
