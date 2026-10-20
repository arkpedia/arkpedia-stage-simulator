// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { ENEMY_FEATURES } from '../shared/arkpedia/enemy-features.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';

const enemy = (h, key) => h.b.units.find(u => u.side === 'enemy' && u.defId === key);
const usedBy = id => Object.entries(support.enemies).filter(([, e]) => e.features?.includes(id)).map(([k]) => k);

test('every registered feature is used by an enemy and approved for at least one', () => {
  for (const id of Object.keys(ENEMY_FEATURES)) {
    const users = Object.entries(ENEMY_RECORDS.enemies).filter(([, e]) => Object.values(e.levels).some(r => r.abilities.some(a => `ability:${a.text}` === id)));
    assert.ok(users.length, `${id} is used`);
    assert.ok(usedBy(id).length, `${id} clears at least one enemy`);
  }
});
test('Flying unit: the record flies; a ground guard does not block it', () => {
  const h = spawnAny('enemy_1005_yokai', { seconds: 8 }), e = enemy(h, 'enemy_1005_yokai');
  assert.equal(e.motion, 'FLY'); assert.equal(e.blockedBy ?? null, null);
});
test('Regenerates HP over time: the record regeneration heals it', () => {
  const h = spawnAny('enemy_1043_zomsbr', { units: [] }), e = (h.run(0.1), enemy(h, 'enemy_1043_zomsbr'));
  e.hp = e.s.maxHp / 2; const hp = e.hp; h.run(2);
  assert.ok(e.hp >= hp + 2 * ENEMY_RECORDS.enemies.enemy_1043_zomsbr.levels[0].stats.hpRecoveryPerSec - 1, `${e.hp} from ${hp}`);
});
for (const key of usedBy('ability:Cannot be blocked.')) test(`Cannot be blocked (${key}): it walks past a guard without being blocked`, () => {
  const h = spawnAny(key, { seconds: 0.1 }), e = () => enemy(h, key);
  assert.ok(e()?.alive, 'spawned');
  h.runUntil(() => !e()?.alive || e().blockedBy, 120);
  assert.equal(e()?.blockedBy ?? null, null); assert.ok(e().s.flags.unblockable);
});
for (const key of usedBy('ability:<$ba.invisible>Invisible</>')) test(`Invisible (${key}): stealthed for selection until a blocker reveals it`, () => {
  const h = spawnAny(key, { seconds: 0.1 }), e = () => enemy(h, key);
  assert.equal(enemyStealthed(e()), true, 'stealthed at spawn');
  h.runUntil(() => !e()?.alive || e().blockedBy, 120);
  assert.ok(e().blockedBy, 'the guard blocks it'); h.run(0.1);
  assert.equal(enemyStealthed(e()), false, 'blocking reveals it');
});
for (const key of usedBy('ability:Attacks two targets simultaneously.')) test(`Attacks two targets simultaneously (${key}): two ranged targets per attack`, () => {
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  assert.equal(e.profile.maxTargets, 2);
});
test('approved features apply only to enemies that use them', () => {
  const h = spawnAny('enemy_1007_slime', { seconds: 0.2 }), e = enemy(h, 'enemy_1007_slime');
  assert.equal(e.s.flags.unblockable ?? false, false); assert.equal(e.s.flags.stealth ?? false, false); assert.equal(e.profile?.maxTargets ?? 1, 1);
});
