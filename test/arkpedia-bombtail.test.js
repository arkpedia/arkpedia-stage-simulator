// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

for (const id of ['enemy_1040_bombd', 'enemy_1040_bombd_2']) {
  test(`${id}: regular feature dispatch drops one delayed bomb, then doubles speed even when silenced`, () => {
    assert.ok(support.enemies[id].policy);
    const h = spawnAny(id, { seconds: .1 }), b = h.b;
    const e = b.enemies.find(u => u.defId === id), guard = b.units.find(u => u.side === 'ally');
    e.x = guard.x + 1; e.y = guard.y;
    const hits = [];
    b.on('damaged', c => { if (c.source === e) hits.push({ time: b.time, target: c.target, amount: c.hpLoss }); });
    b.applyStatus(e, 'silence', { duration: 30 });
    const cast = e.mem.ab.list.find(a => a.fire);
    h.runUntil(() => cast.casts > 0, 2);
    assert.equal(hits.length, 0, 'damage waits for release and projectile flight');
    const started = b.time;
    h.runUntil(() => !!e.findBuff('ab:bombRun'), 3);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].target, guard);
    assert.ok(hits[0].time - started >= 8 / 30);
    assert.equal(e.findBuff('ab:bombRun').mods.moveMul, 2);
    assert.equal(e.profile.noAttack, true);
    h.run(8);
    assert.equal(cast.casts, 1);
    assert.equal(hits.length, 1, 'no second bomb or ordinary attack');
    assert.deepEqual(b.errors, []);
  });
  test(`${id}: stun before release preserves the bomb for a later attempt`, () => {
    const h = spawnAny(id, { seconds: .1 }), b = h.b;
    const e = b.enemies.find(u => u.defId === id), guard = b.units.find(u => u.side === 'ally');
    e.x = guard.x + 1; e.y = guard.y;
    const cast = e.mem.ab.list.find(a => a.fire);
    h.runUntil(() => cast.casts > 0, 2);
    b.applyStatus(e, 'stun', { duration: 1.5 });
    const hp = guard.hp;
    h.run(1.4);
    assert.equal(guard.hp, hp);
    assert.equal(e.form ?? null, null);
    h.runUntil(() => !!e.findBuff('ab:bombRun'), 4);
    assert.equal(cast.casts, 2);
    assert.ok(guard.hp < hp);
    assert.deepEqual(b.errors, []);
  });
}

test('Bombtail admission refuses missing evidence or altered repeat/silence behavior', () => {
  const record = ENEMY_RECORDS.enemies.enemy_1040_bombd;
  assert.equal(enemySupport(record, index.prefabs, {}).policy, null);
  for (const [field, value] of [['_maxTriggerTime', 2], ['_ignoreSilence', 0]]) {
    const changed = structuredClone(evidence);
    for (const row of changed.prefabs['dyn/battle/prefabs/enemies/enemy_1040_bombd.prefab']) {
      const data = JSON.parse(row.originalJson);
      if ('_familyMask' in data) { data[field] = value; row.originalJson = JSON.stringify(data); }
    }
    assert.equal(enemySupport(record, index.prefabs, changed).policy, null, field);
  }
  const changed = structuredClone(evidence);
  for (const row of changed.projectiles.projectile_bombd) {
    const data = JSON.parse(row.originalJson);
    if ('_speed' in data) { data._speed = 9; row.originalJson = JSON.stringify(data); }
  }
  assert.equal(enemySupport(record, index.prefabs, changed).policy, null, 'changed projectile speed');
});
