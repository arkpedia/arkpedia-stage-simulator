// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

function fixture(id = 'enemy_1024_mortar') {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'mortar_target', profession: 'WARRIOR', stats: { maxHp: 100000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [[9, 6], [10, 7], [9, 7], [9, 8]].map(([row, col]) => ({ chessId: guard.chessId, row, col })),
    setup: b => installEnemyFeatures(b) });
  const b = h.b, [center, diagonal, side, outside] = b.allyUnits;
  b.start();
  for (const unit of b.allyUnits) b.addBuff(unit, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  b.addBuff(center, { key: 'fixture:target', mods: { taunt: 100 } });
  const e = b.spawnEnemy(id, { pos: [9, 10] }), hits = [];
  b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { h, b, e, center, diagonal, side, outside, hits };
}

for (const id of ['enemy_1024_mortar', 'enemy_1024_mortar_2']) {
  test(`${id}: one delayed shell hits the center and all eight neighboring tiles once`, () => {
    const { h, b, e, center, diagonal, side, outside, hits } = fixture(id);
    b.applyStatus(e, 'silence', { duration: 20 });
    h.run(.1); assert.equal(e.stats.attacks, 1); assert.equal(hits.length, 0);
    assert.equal(b.projectiles.list[0].speed, 4); assert.equal(b.projectiles.list[0].maxAge, 10);
    h.run(1.1);
    assert.deepEqual(b.errors, []); assert.equal(hits.length, 3); assert.deepEqual(new Set(hits.map(c => c.target)), new Set([center, diagonal, side]));
    for (const hit of hits) { assert.equal(hit.hpLoss, e.s.atk); assert.equal(hit.dmg.isAttack, true); }
    assert.equal(outside.hp, outside.s.maxHp); assert.deepEqual(b.errors, []);
  });
}

test('the shell ignores camouflage for splash but respects stealth and the rectangle/circle corner boundary', () => {
  const { h, b, center, diagonal, side, outside, hits } = fixture();
  b.addBuff(diagonal, { key: 'fixture:camou', flags: { camou: true } });
  b.addBuff(side, { key: 'fixture:stealth', flags: { stealth: true } });
  outside.x = center.x + 1.7; outside.y = center.y + 1.7;
  h.run(1.2);
  assert.deepEqual(new Set(hits.map(c => c.target)), new Set([center, diagonal]));
  assert.equal(side.hp, side.s.maxHp); assert.equal(outside.hp, outside.s.maxHp);
});

test('a launched shell survives source death and lands at the retired target location without transferring target identity', () => {
  const { h, b, e, center, side, hits } = fixture();
  h.run(.1); assert.equal(hits.length, 0);
  b.kill(e, center); b.kill(center, null); h.run(1.2);
  assert.ok(hits.some(c => c.target === side)); assert.ok(hits.every(c => c.target !== center));
  assert.deepEqual(b.errors, []);
});

test('a homing shell follows a moving target instead of exploding at its original tile', () => {
  const { h, e, center, side, outside, hits } = fixture();
  h.run(.1); center.x += 2; center.y += 2; h.run(2);
  assert.ok(hits.some(c => c.target === center)); assert.ok(hits.every(c => c.target !== side && c.target !== outside));
  assert.equal(e.stats.attacks, 1);
});

test('Mortar admission requires the original attack and projectile shape, timing and target policy', () => {
  for (const edit of [
    c => { if (c.m_Size) c.m_Size.x = 5; },
    c => { if ('_speed' in c) c._speed = 8; },
    c => { if ('_ignoreCamouflage' in c) c._ignoreCamouflage = 0; },
    c => { if ('_stopWhenSourceInvalid' in c) c._stopWhenSourceInvalid = 1; },
  ]) {
    const changed = structuredClone(evidence);
    for (const row of changed.projectiles.projectile_mortar) {
      const c = JSON.parse(row.originalJson); edit(c); row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1024_mortar, index.prefabs, changed).policy, null);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1024_mortar, index.prefabs, {}).policy, null);
});
