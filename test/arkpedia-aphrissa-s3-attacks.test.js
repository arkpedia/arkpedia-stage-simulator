// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, advance, near} from './helpers/aphrissa-relay-fixture.js';
import {enemy, until} from './helpers/aphrissa-s1-fixture.js';
import {APHRISSA_S3_ATTACK_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-ordinary.js';
const make = options => {
  const f = fixture({skill: 3, s3Relay: true, s3Attacks: true, ...options});
  f.hits = []; f.receipts = []; f.statuses = [];
  f.b.on('damaged', event => { if (event.source === f.u) f.hits.push({id: event.target.id, at: f.b.time,
    amount: event.amount, attackId: event.dmg.attackId, isSkill: event.dmg.isSkill,
    extra: event.dmg.tags?.includes('aphrissa:s3-extra')}); });
  f.b.on('attack', event => { if (event.attacker === f.u) f.receipts.push({at: f.b.time,
    ids: event.targets.map(t => t.id), isSkill: event.isSkill}); });
  f.b.on('statusApplied', event => { if (event.source === f.u && event.status === 'sluggish')
    f.statuses.push({id: event.target.id, at: f.b.time, duration: event.duration}); });
  return f;
};

for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} uses its original marker, selected main scale and base Slow`, () => {
  const f = make({rank}), target = enemy(f, {res: 50}); advance(f.b, 1.49);
  assert.equal(f.hits.length, 0); until(f, () => f.hits.length === 1);
  const bb = f.deck.record.owner.bb;
  assert.ok(f.hits[0].at >= 1.5 - 1e-7); near(f.hits[0].amount, f.u.s.atk * bb['attack@atk_scale'] * .5);
  near(target.findBuff('sluggish').duration, bb['attack@origin_sluggish']);
  assert.equal(f.statuses.length, 1); assert.equal(f.receipts.length, 1);
  assert.equal(f.hits[0].extra, false); assert.equal(f.hits[0].isSkill, true);
  assert.equal(target.findBuff('aphris_sk3'), null);
});

test('Per-recipient relay metadata gives unextended targets one hit and extended targets separate extra Arts damage', () => {
  const f = make(); f.deck.beginS3(); f.deck.place(5, 7, 'UP');
  f.deck.place(8, 7, 'RIGHT'); f.deck.place(8, 10, 'UP');
  const before = enemy(f), once = enemy(f, {row: 6, col: 7}), twice = enemy(f, {row: 8, col: 8}), thrice = enemy(f, {row: 10, col: 10});
  until(f, () => f.hits.length === 7);
  assert.deepEqual(f.hits.map(hit => [hit.id, hit.extra]), [[before.id, false], [once.id, true], [once.id, false],
    [twice.id, true], [twice.id, false], [thrice.id, true], [thrice.id, false]]);
  assert.equal(f.receipts.length, 1); assert.equal(new Set(f.hits.map(hit => hit.attackId)).size, 1);
  near(f.statuses.find(s => s.id === before.id).duration, .4);
  for (const unit of [once, twice, thrice]) {
    near(f.statuses.find(s => s.id === unit.id).duration, .8);
    near(f.hits.find(hit => hit.id === unit.id && hit.extra).amount, f.u.s.atk * .3);
  }
});

test('A straight-through relay also counts as an extension; an ordinary operator does not', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); f.b.deployOperator('char_122_beagle', 5, 8, 'UP');
  const before = enemy(f), after = enemy(f, {col: 9}); until(f, () => f.hits.length === 3);
  assert.deepEqual(f.hits.map(hit => [hit.id, hit.extra]), [[before.id, false], [after.id, true], [after.id, false]]);
});

test('Producer rejection preserves the independent main hit without fabricating Slow or extra damage', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8});
  f.b.on('beforeBuff', event => { if (event.buff.key === 'aphris_sk3') event.cancel = true; });
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].extra, false);
  assert.equal(target.findBuff('sluggish'), null); assert.equal(f.statuses.length, 0);
});

test('Rejecting Slow does not cancel the separate extra damage loop or main damage', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8});
  f.b.on('beforeStatus', event => { if (event.status === 'sluggish') event.cancel = true; });
  until(f, () => f.hits.length === 2); assert.deepEqual(f.hits.map(hit => hit.extra), [true, false]);
  assert.equal(target.findBuff('sluggish'), null);
});

test('A retained target moved off the current ray gets current zero-extension metadata, not stale bonus damage', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source === f.u && event.target === first) later.y = 6; });
  until(f, () => f.hits.length === 2); assert.equal(f.hits[1].id, later.id); assert.equal(f.hits[1].extra, false);
  near(f.statuses[1].duration, .4);
});

test('Slow is nonderived and keeps its accepted lifetime after the producer and caster are removed', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8});
  until(f, () => f.hits.length === 2); assert.equal(target.findBuff('aphris_sk3'), null);
  const slow = target.findBuff('sluggish'); near(slow.duration, .8);
  f.b.retreat(f.u, {permanent: true}); assert.equal(target.findBuff('sluggish'), slow);
  advance(f.b, .3); assert.ok(target.findBuff('sluggish')); advance(f.b, .6);
  assert.equal(target.findBuff('sluggish'), null);
});

test('Live ATK and RES changes between extra and main damage affect each separate receipt', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8}), base = f.u.s.atk;
  f.b.on('damaged', event => { if (event.source === f.u && event.dmg.tags?.includes('aphrissa:s3-extra')) {
    f.b.addBuff(f.u, {key: 'fixture:live', mods: {atkPct: 1}});
    f.b.addBuff(target, {key: 'fixture:res', mods: {resFlat: 50}});
  }});
  until(f, () => f.hits.length === 2); near(f.hits[0].amount, base * .3);
  near(f.hits[1].amount, base * 2 * 2 * .5);
});

test('Retirement from the Slow callback cancels unborn extra and main hits', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); enemy(f, {col: 8});
  f.b.on('statusApplied', event => { if (event.source === f.u && event.status === 'sluggish') f.b.retreat(f.u, {permanent: true}); });
  until(f, () => f.statuses.length === 1); advance(f.b, .5);
  assert.equal(f.hits.length, 0); assert.equal(f.attacks.handles.length, 0);
});

test('A replaced target life during producer admission receives neither stale producer nor main damage', () => {
  const f = make(), target = enemy(f);
  f.b.on('beforeBuff', event => { if (event.unit === target && event.buff.key === 'aphris_sk3') target.deploySeq++; });
  until(f, () => f.receipts.length === 1); assert.equal(f.hits.length, 0); assert.equal(f.statuses.length, 0);
  assert.equal(target.findBuff('aphris_sk3'), null);
});

test('A native Slow-resistance modifier shortens the child but does not alter extra damage or main damage', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8});
  f.b.applyStatus(target, 'resist', {duration: Infinity}); until(f, () => f.hits.length === 2);
  near(target.findBuff('sluggish').duration, .4); assert.equal(f.hits.length, 2);
});

for (const [dir, clip] of [['UP', 'Skill_3_Loop'], ['DOWN', 'Skill_Down_3_Loop']])
  test(`S3 ${dir} uses its original marker and clip family`, () => {
    const f = make({dir}); enemy(f, {row: dir === 'UP' ? 6 : 4, col: 5});
    until(f, () => !!f.attacks.phase); assert.equal(f.u.mem.regularFormVisual.clip, clip);
    near(f.attacks.phase.releaseAge, .5); until(f, () => f.hits.length === 1);
  });

test('Fast ASPD never exceeds native maxAnimScale, while live slow_down freezes and resumes the marker', () => {
  const f = make(); enemy(f); f.b.addBuff(f.u, {key: 'fixture:fast', mods: {aspd: 100}});
  until(f, () => !!f.attacks.phase); near(f.attacks.phase.speed, 1);
  f.b.addBuff(f.u, {key: 'fixture:freeze-clock', mods: {slowDownMul: 0}});
  advance(f.b, 1); assert.equal(f.hits.length, 0);
  f.b.removeBuff(f.u, 'fixture:freeze-clock'); until(f, () => f.hits.length === 1);
});

test('Reentrant forceAttack during extra damage cannot repeat a producer, main hit or attack receipt', () => {
  const f = make(); f.deck.place(5, 7, 'RIGHT'); const target = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source !== f.u || !event.dmg.tags?.includes('aphrissa:s3-extra')) return;
    assert.equal(f.b.forceAttack(f.u, [target]), false); f.attacks.tick(); });
  until(f, () => f.hits.length === 2); assert.equal(f.receipts.length, 1); assert.equal(f.statuses.length, 1);
});

test('The exact S3 attack contract and selected source build are required', () => {
  assert.throws(() => make({s3AttackContract: {...contract}}), /exact attack contract/);
  assert.throws(() => make({skill: 2}), /Changed original Aphrissa S3 relay actions/);
  assert.throws(() => make({mutate: def => { def.skill.bb['attack@atk_scale'] = 999; }}), /Incomplete original/);
});
