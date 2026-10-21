// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, chessRec, enemyRec, checkInvariants } from './helpers/battleHarness.js';
import { installSelected, ensureInstalled, KITS } from '../server/sim/content/enemies.js';
import { installReviewedUpstreamEnemies, UPSTREAM_ENEMY_CONTRACT as contract } from '../server/sim/content/arkpedia-upstream-enemies.js';
import { assertRegularEnemies, REGULAR_ENEMIES } from '../shared/arkpedia/enemies.js';
import review from '../data/arkpedia-upstream-enemy-review.json' with { type: 'json' };
const ID = 'enemy_1026_aghost', OTHER = 'enemy_1009_lurker';
const install = b => installReviewedUpstreamEnemies(b, { contract });
const wall = chessRec({ id: 'review_wall', profession: 'TANK', skill: null, stats: { maxHp: 1e7, atk: 0, blockCnt: 3 } });
const arena = (opts = {}) => makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
  units: [{ chessId: 'review_wall', row: 9, col: 5 }], defs: { chess: { review_wall: wall } }, ...opts });
const spawn = (h, key = ID, pos = [9, 5]) => h.spawn(key, { pos, routeIndex: 0 });

test('held primary review preserves native hierarchy identity and makes no public or compiled-dispatch claim', () => {
  assert.deepEqual(review.enabledEnemies, []);
  for (const key of ['frameParity', 'compiledDispatchVerified', 'nativeArtworkVerified']) assert.equal(review[key], false);
  assert.match(review.enemies[ID].description, /cannot be blocked/);
  assert.deepEqual(review.enemies[ID].skills, []); assert.deepEqual(review.enemies[ID].talent, {});
  const index = JSON.parse(readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url)));
  assert.deepEqual(review.enemies[ID].prefab, index.prefabs[review.enemies[ID].prefabKey]);
  assert.equal(review.upstream.license, 'GPL-3.0-or-later');
});
test('adapter requires the explicit contract and rejects changed source stats or seasonal overrides', () => {
  const h = arena(); assert.throws(() => installReviewedUpstreamEnemies(h.b), /Explicit/);
  const bad = arena({ defs: { chess: { review_wall: wall }, enemies: { [ID]: enemyRec({ key: ID }) } } });
  assert.throws(() => install(bad.b), /Changed reviewed/);
  h.b.enemyOverrides = { [ID]: { talents: { bb: { unexpected: 1 } } } };
  assert.throws(() => install(h.b), /Changed reviewed/);
  delete h.b.enemyOverrides[ID]; install(h.b); // Rejected installation did not poison scope.
  h.step(); assert.equal(h.b.errors.length, 0);
});
test('selected upstream kit passes a three-block defender without stealing block slots or attacking', () => {
  const h = arena(); install(h.b); h.step();
  const e = spawn(h), x = e.x; h.run(2);
  assert.equal(e.mem.ab.list.length, 1); assert.ok(e.s.flags.unblockable);
  assert.equal(e.blockedBy, null); assert.ok(e.x < x - .5); assert.equal(e.stats.attacks, 0);
  assert.equal(h.unit('review_wall').hp, h.unit('review_wall').s.maxHp);
  checkInvariants(h.b); assert.equal(h.b.errors.length, 0);
});
test('unselected upstream stealth kit never attaches or becomes hidden', () => {
  const h = arena(); install(h.b); h.step(); const e = spawn(h, OTHER, [10, 7]); h.run(.5);
  assert.equal(e.mem.ab, undefined); assert.ok(!e.s.flags.stealth); assert.ok(!e.s.flags.unblockable);
});
test('no selected dispatcher means no automatic upstream abilities in content none', () => {
  const h = arena(); h.step(); const e = spawn(h); h.run(.25);
  assert.equal(e.mem.ab, undefined); assert.ok(!e.s.flags.unblockable); assert.ok(e.blockedBy);
});
test('silence does not remove the permanent trait; stun still stops movement and then releases it', () => {
  const h = arena(); install(h.b); h.step(); const e = spawn(h, ID, [9, 7]);
  h.b.applyStatus(e, 'silence', { duration: 3 }); h.b.applyStatus(e, 'stun', { duration: 1 });
  const x = e.x; h.run(.5); assert.equal(e.x, x); assert.ok(e.s.flags.unblockable);
  h.run(1); assert.ok(e.x < x); assert.ok(e.s.flags.unblockable); assert.equal(e.blockedBy, null);
});
test('unblockable enemies remain damageable and can die before leaking', () => {
  const h = arena(); install(h.b); h.step(); const e = spawn(h), u = h.unit('review_wall');
  h.b.dealDamage(u, e, { amount: 1000, type: 'true' }); assert.equal(e.hp, 2800);
  h.b.dealDamage(u, e, { amount: 4000, type: 'true' }); assert.equal(e.alive, false); h.step(); checkInvariants(h.b);
});
test('an uneliminated Wraith follows its original route and leaks once', () => {
  const h = arena(); install(h.b); h.step(); const e = spawn(h, ID, [9, 8]);
  assert.ok(h.runUntil(() => h.hooksOf('enemyLeak').some(c => c.enemy === e), 25));
  assert.equal(h.hooksOf('enemyLeak').filter(c => c.enemy === e).length, 1); assert.equal(e.stats.attacks, 0);
});
test('selection is copied and identical reinstallation never duplicates spawn abilities', () => {
  const h = arena(), keys = [ID]; installSelected(h.b, keys); keys.push(OTHER);
  installSelected(h.b, [ID]); h.step(); const e = spawn(h), other = spawn(h, OTHER, [10, 7]);
  assert.equal(e.mem.ab.list.length, 1); assert.equal(other.mem.ab, undefined);
  installSelected(h.b, [ID]); assert.equal(e.mem.ab.list.length, 1);
});
test('full and selected scopes cannot silently widen one another; failure retains the original scope', () => {
  const h = arena(); install(h.b); assert.throws(() => ensureInstalled(h.b), /scope cannot change/);
  h.step(); assert.equal(spawn(h, OTHER, [10, 7]).mem.ab, undefined);
  const full = arena(); ensureInstalled(full.b); ensureInstalled(full.b);
  assert.throws(() => installSelected(full.b, [ID]), /scope cannot change/);
  full.step(); assert.ok(spawn(full, OTHER, [10, 7]).s.flags.stealth);
});
for (const keys of [null, [], [ID, ID], ['unknown'], ['__proto__'], [ID, 1]]) {
  test(`invalid selective request ${JSON.stringify(keys)} fails before registering dispatchers`, () => {
    const h = arena(); assert.throws(() => installSelected(h.b, keys), /distinct list/);
    install(h.b); h.step(); assert.ok(spawn(h).s.flags.unblockable);
  });
}
test('selective dispatch preserves factory identity; the public catalogue admits enemies only through derived support', () => {
  // Wraith Leader is now admitted by the data-derived 'Cannot be blocked.' feature
  // (shared/arkpedia/enemy-features.js), not by this upstream kit.
  assert.equal(typeof KITS[ID], 'function'); assert.equal(REGULAR_ENEMIES[ID], 'stats-attacks-and-features');
  const snapshot = JSON.parse(readFileSync(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  assert.equal(snapshot.enemies[ID], undefined);
  const unsupported = 'enemy_1334_ristar';
  assert.equal(REGULAR_ENEMIES[unsupported], undefined);
  assert.throws(() => assertRegularEnemies({ ...snapshot, enemies: { ...snapshot.enemies, [unsupported]: {} } }), /Unsupported/);
});

test('late selective installation fails instead of leaving existing enemies partly initialized', () => {
  const h = arena(); h.step(); const e = spawn(h);
  assert.throws(() => install(h.b), /before the first spawn/);
  assert.equal(e.mem.ab, undefined); assert.ok(!e.s.flags.unblockable);
});

test('equivalent multi-kit selections share one copied scope regardless of input order', () => {
  const h = arena(); const first = installSelected(h.b, [OTHER, ID]);
  assert.equal(installSelected(h.b, [ID, OTHER]), first); h.step();
  assert.equal(spawn(h).mem.ab.list.length, 1);
  const e = spawn(h, OTHER, [10, 7]); assert.equal(e.mem.ab.list.length, 1); assert.ok(e.s.flags.stealth);
});
for (const changed of [{ skills: [{ prefabKey: 'unexpected' }] }, { talent: { unexpected: 1 } }]) {
  test('review adapter rejects added skill/talent input before selecting any dispatcher: ' + Object.keys(changed)[0], () => {
    const h = arena(), data = h.b.data;
    h.b.data = { getEnemy: id => ({ ...data.getEnemy(id), ...changed }) };
    assert.throws(() => install(h.b), /Changed reviewed/);
    h.b.data = data; install(h.b); h.step(); assert.ok(spawn(h).s.flags.unblockable);
  });
}
