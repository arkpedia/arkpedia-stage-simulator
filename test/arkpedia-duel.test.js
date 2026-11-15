// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
function fixture(id = 'enemy_1098_cchmpn') {
  assert.ok(support.enemies[id].policy);
  const h = spawnAny(id, { seconds: .1, stats: { moveSpeed: 0 } }), b = h.b, e = b.enemies[0], guard = b.allyUnits[0];
  b.addBuff(guard, { key: 'fixture:passive', flags: { disarm: true } }); e.profile.noAttack = true;
  const other = b.spawnDevice('fixture:other', 9, 8, { hp: 10000, blockCnt: 0 });
  assert.ok(other);
  e.x = guard.x + .2; e.y = guard.y;
  return { h, b, e, guard, other, id };
}
for (const id of ['enemy_1098_cchmpn', 'enemy_1098_cchmpn_2']) {
  test(`${id}: blocking lowers both defenses and taunt, and only the actual blocker can damage it`, () => {
    const { b, e, guard, other } = fixture(id), def = e.s.def, gd = guard.s.def, taunt = e.s.taunt;
    assert.ok(b._checkBlock(e));
    assert.ok(Math.abs(e.s.def - def * .3) < 1e-8); assert.ok(Math.abs(guard.s.def - gd * .3) < 1e-8);
    assert.equal(e.s.taunt, taunt - 1);
    for (const type of ['phys', 'arts', 'true']) for (const source of [other, null]) {
      const hp = e.hp; b.dealDamage(source, e, { amount: 500, type, canDodge: false }); assert.equal(e.hp, hp);
    }
    const hp = e.hp; b.dealDamage(guard, e, { amount: 500, type: 'true' }); assert.equal(hp - e.hp, 500);
    b._unblock(e); assert.equal(e.s.def, def); assert.equal(guard.s.def, gd); assert.equal(e.s.taunt, taunt);
    const free = e.hp; b.dealDamage(other, e, { amount: 500, type: 'true' }); assert.equal(free - e.hp, 500);
    assert.deepEqual(b.errors, []);
  });
}

test('two duels share one blocker penalty, and removing one source preserves the other', () => {
  const { b, e, guard, id } = fixture(); guard.base.blockCnt = 3; guard.markDirty(); const def = guard.s.def;
  assert.ok(b._checkBlock(e));
  const second = b.spawnEnemy(id, { pos: [guard.y, guard.x + .1] }); second.profile.noAttack = true;
  assert.ok(b._checkBlock(second)); assert.equal(guard.buffs.filter(x => x.key === 'ab:duelBlocker').length, 1);
  assert.ok(Math.abs(guard.s.def - def * .3) < 1e-8);
  b.kill(e, null); assert.ok(guard.findBuff('ab:duelBlocker'));
  b.kill(second, null); assert.equal(guard.findBuff('ab:duelBlocker'), null); assert.equal(guard.s.def, def);
  assert.equal(guard.mem.regularDuels.size, 0); assert.deepEqual(b.errors, []);
});

test('natural silence is refused; forced silence disables only the native self buff', () => {
  const { h, b, e, guard, other } = fixture(), def = e.s.def, gd = guard.s.def;
  b._checkBlock(e); assert.equal(b.applyStatus(e, 'silence', { duration: 1 }), false);
  assert.ok(e.findBuff('ab:duelSelf')); assert.equal(b.applyStatus(e, 'silence', { duration: 1, force: true }), true);
  assert.equal(e.s.def, def); assert.ok(Math.abs(guard.s.def - gd * .3) < 1e-8);
  const hp = e.hp; b.dealDamage(other, e, { amount: 100, type: 'true' }); assert.equal(hp - e.hp, 100);
  h.run(1.1); assert.ok(e.findBuff('ab:duelSelf'));
  const restored = e.hp; b.dealDamage(other, e, { amount: 100, type: 'true' }); assert.equal(e.hp, restored);
  b.applyStatus(guard, 'stun', { duration: 2 }); h.run(.1);
  assert.equal(e.blockedBy, null); assert.equal(guard.findBuff('ab:duelBlocker'), null); assert.equal(e.findBuff('ab:duelSelf'), null);
  assert.deepEqual(b.errors, []);
});

test('blocker death releases both penalties immediately, and a replacement receives a fresh independent link', () => {
  const { b, e, guard, other } = fixture(); b._checkBlock(e); b.kill(guard, null);
  assert.equal(e.blockedBy, null); assert.equal(e.findBuff('ab:duelSelf'), null); assert.equal(guard.mem.regularDuels.size, 0);
  other.base.blockCnt = 1; other.markDirty(); e.x = other.x + .2; e.y = other.y;
  assert.ok(b._checkBlock(e)); assert.ok(other.findBuff('ab:duelBlocker'));
  assert.equal(e.blockedBy, other); assert.deepEqual(b.errors, []);
});

test('changed native ownership, silence or damage-filter semantics remain unsupported', () => {
  const id = 'enemy_1098_cchmpn', entry = ENEMY_RECORDS.enemies[id];
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    x => { x.templates.enemy_cchmpn_t.eventToActions.ON_TAKE_DAMAGE[0]._checkBlockedBySourceToken = true; },
    x => { x.templates.enemy_cchmpn_t.eventToActions.ON_TAKE_DAMAGE[2]._filterDamageType = true; },
    x => { for (const row of x.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) { const c = JSON.parse(row.originalJson); if (c._buffsToBlockee) c._buffsToBlockee[0].disableOverride = 1; row.originalJson = JSON.stringify(c); } },
  ]) { const changed = structuredClone(evidence); edit(changed); assert.equal(enemySupport(entry, index.prefabs, changed).policy, null); }
});
