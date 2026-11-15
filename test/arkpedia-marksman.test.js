// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { sortAllyTargets } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1057_gansho';
function fixture(id = ID) {
  const target = chessRec({ id: 'marksman_target', stats: { atk: 0, maxHp: 1e6, def: 150 } });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true,
    defs: { chess: { [target.chessId]: target }, enemies: { [id]: record } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0];
  h.b.addBuff(u, { key: 'dummy', flags: { disarm: true, noBlock: true, noMove: true } });
  const e = h.b.spawnEnemy(id, { pos: [9, 7.5] });
  return { h, b: h.b, u, e };
}
test('each Marksman attack releases three traveling shots with separate DEF mitigation and one attack identity', () => {
  for (const id of [ID, ID + '_2']) {
    const { h, b, u, e } = fixture(id);
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3));
    assert.equal(u.stats.taken, 0); assert.equal(b.projectiles.list.length, 1);
    b._attackSeq += 10; h.run(.4);
    const hits = h.hooksOf('damaged').filter(c => c.source === e);
    assert.equal(hits.length, 3); assert.equal(u.stats.taken, 3 * (e.s.atk - 150));
    assert.equal(new Set(hits.map(c => c.dmg.attackId)).size, 1);
    assert.ok(hits.every(c => c.dmg.type === 'phys' && c.dmg.applyWay === 'ranged' && c.dmg.isAttack));
    assert.equal(e.stats.attacks, 1); assert.deepEqual(b.errors, []);
  }
});
test('Silence leaves normal bursts enabled; killing the source interrupts later launches but not released shots', () => {
  const { h, b, u, e } = fixture(); b.applyStatus(e, 'silence', 10);
  h.runUntil(() => e.stats.attacks === 1, 3); b.kill(e); h.run(.4);
  assert.equal(u.stats.taken, 30); assert.equal(h.hooksOf('damaged').filter(c => c.source === e).length, 1);
  assert.deepEqual(b.errors, []);
  const next = fixture(); next.b.applyStatus(next.e, 'silence', 10); next.h.runUntil(() => next.e.stats.attacks === 1, 3); next.h.run(.4);
  assert.equal(next.u.stats.taken, 90); assert.deepEqual(next.b.errors, []);
});
test('native building tag wins before taunt, with ordinary blocker priority and no translated-name dependency', () => {
  const { e } = fixture();
  const building = { tags: new Set(['building']), s: { taunt: 0 }, aggroSeq: 1, def: { raw: { name: 'localized terminal' } } };
  const later = { tags: new Set(), s: { taunt: 3 }, aggroSeq: 2, def: { raw: { name: 'Command Terminal' } } };
  assert.equal(sortAllyTargets(e, [later, building])[0], building);
  e.blockedBy = later; assert.equal(sortAllyTargets(e, [building, later])[0], later);
});
test('burst admission refuses changed shot count, priority tag and projectile speed', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, native).policy);
  for (const change of ['count', 'tag', 'speed']) {
    const n = structuredClone(native);
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`]) {
      const v = JSON.parse(row.originalJson);
      if (change === 'count' && '_additionalTimes' in v) v._additionalTimes = 3;
      if (change === 'tag' && '_filterTag' in v) v._filterTag = 'unknown';
      row.originalJson = JSON.stringify(v);
    }
    for (const row of n.projectiles.projectile_gansho) {
      const v = JSON.parse(row.originalJson); if (change === 'speed' && '_speed' in v) v._speed = 1;
      row.originalJson = JSON.stringify(v);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, n).policy, null, change);
  }
});
