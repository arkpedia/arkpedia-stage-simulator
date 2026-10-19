// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, cast, until, advance, near, enemy} from './helpers/aphrissa-s2-beam-fixture.js';
import {prepareAphrissaS2Beam, APHRISSA_S2_BEAM_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-s2-beam.js';

for (let rank = 1; rank <= 10; rank++) test(`Held S2 rank ${rank} uses selected scale and original timed pulses`, () => {
  const f = make({rank}), target = enemy(f, {res: 40}), p = cast(f);
  advance(f.b, .16); assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length === 1);
  near(f.hits[0].amount, f.u.s.atk * f.selected.bb.atk_scale * .6);
  assert.ok(f.hits[0].at + 1e-7 >= p.startedAt + .16699999570846558);
  advance(f.b, 8.5);
  assert.equal(f.hits.length, 16); assert.equal(f.receipts.length, 16);
  assert.equal(new Set(f.hits.map(hit => hit.attackId)).size, 16);
  assert.ok(f.hits.every(hit => hit.isSkill && hit.id === target.id));
  assert.ok(f.receipts.every(receipt => receipt.isSkill)); assert.equal(f.beam.phase, null);
});

test('One pulse hits distinct ground and air lives on the infinite ray with one receipt', () => {
  const f = make(), a = enemy(f), z = enemy(f, {col: 19, fly: true}), outside = enemy(f, {row: 6});
  cast(f); until(f, () => f.hits.length === 2);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, z.id]);
  assert.equal(f.hits[0].attackId, f.hits[1].attackId); assert.equal(f.receipts.length, 1);
  assert.equal(outside.hp, outside.s.maxHp);
});

test('Empty pulses spend clock positions without inventing attacks, targets or attack SP', () => {
  const f = make(), p = cast(f); advance(f.b, 1.3);
  assert.equal(p.pulses, 3); assert.equal(f.receipts.length, 0); assert.equal(f.u.stats.attacks, 0);
  const target = enemy(f); until(f, () => f.hits.length === 1);
  assert.ok(f.hits[0].at >= 1.6669999957084656 - 1e-7); assert.equal(f.hits[0].id, target.id);
});

test('Each pulse resamples current enemy positions rather than retaining the first recipient batch', () => {
  const f = make(), a = enemy(f), z = enemy(f, {row: 6, col: 9}); cast(f);
  until(f, () => f.hits.length === 1); a.y = 6; z.y = 5;
  until(f, () => f.hits.length === 2);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, z.id]);
});

test('A real operator can redirect later pulses and its changed facing is sampled again', () => {
  const f = make(), t = f.b.deployOperator('char_122_beagle', 5, 7, 'UP');
  const up = enemy(f, {row: 9, col: 7}), straight = enemy(f, {col: 10}); cast(f);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].id, up.id);
  t.dir = 'RIGHT'; until(f, () => f.hits.length === 2); assert.equal(f.hits[1].id, straight.id);
});

test('An actual relay redirects the beam and withdrawal restores the next straight pulse', () => {
  const f = make(), token = f.deck.place(5, 12, 'UP'); assert.ok(token);
  const turned = enemy(f, {row: 8, col: 12}), straight = enemy(f, {col: 17}); cast(f);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].id, turned.id);
  f.deck.retreat(token); until(f, () => f.hits.length === 2); assert.equal(f.hits[1].id, straight.id);
});

test('A directed cycle does not duplicate damage or run unbounded', () => {
  const f = make(); f.deck.place(5, 7, 'LEFT');
  enemy(f, {col: 6}); cast(f); until(f, () => f.hits.length === 1);
  assert.equal(f.receipts[0].ids.length, 1); advance(f.b, .5); assert.equal(f.hits.length, 2);
});

test('New enemies join only the next pulse, and stale recipient lives cannot borrow accepted damage', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8}); let added;
  f.b.on('damaged', event => { if (event.source !== f.u || event.target !== first || added) return;
    later.deploySeq++; added = enemy(f, {col: 9}); });
  cast(f); until(f, () => f.receipts.length === 1);
  assert.deepEqual(f.hits.map(hit => hit.id), [first.id]);
  until(f, () => f.receipts.length === 2);
  assert.deepEqual(f.hits.slice(1).map(hit => hit.id), [first.id, later.id, added.id]);
});

test('A moved accepted recipient keeps that pulse, but does not stay selected on later pulses', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source === f.u && event.target === first) later.y = 6; });
  cast(f); until(f, () => f.receipts.length === 1);
  assert.deepEqual(f.hits.map(hit => hit.id), [first.id, later.id]);
  until(f, () => f.receipts.length === 2); assert.equal(f.hits.length, 3);
});

test('Every hit uses current ATK and current enemy RES through the shared damage pipeline', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source === f.u && event.target === first) {
    f.b.addBuff(f.u, {key: 'fixture:live-atk', mods: {atkPct: 1}});
    f.b.addBuff(later, {key: 'fixture:live-res', mods: {resFlat: 50}});
  }});
  cast(f); until(f, () => f.hits.length === 2);
  near(f.hits[0].amount, f.selected.stats.atk * f.selected.bb.atk_scale);
  near(f.hits[1].amount, f.selected.stats.atk * 2 * f.selected.bb.atk_scale * .5);
});

for (const flag of ['untargetable', 'stealth', 'sleep', 'camou'])
  test(`S2 respects the original target selector's ${flag} exclusion`, () => {
    const f = make(), target = enemy(f);
    f.b.addBuff(target, {key: 'fixture:exclude', flags: {[flag]: true}}); cast(f);
    advance(f.b, .4); assert.equal(f.hits.length, 0); assert.equal(f.receipts.length, 0);
    f.b.removeBuff(target, 'fixture:exclude'); until(f, () => f.hits.length === 1);
  });

test('Native affectedBySlowDown0 keeps the beam clock independent of slow_down and ASPD', () => {
  const f = make(); enemy(f); cast(f);
  f.b.addBuff(f.u, {key: 'fixture:unrelated-clocks', mods: {slowDownMul: 0, aspd: -90, batFlat: 20}});
  advance(f.b, 1.3); assert.equal(f.hits.length, 3); near(f.hits[1].at - f.hits[0].at, .5);
});

for (const control of ['stun', 'disarm', 'permission']) test(`Explicit ${control} release policy skips pulses without backlog`, () => {
  const f = make(), target = enemy(f), p = cast(f);
  if (control === 'permission') f.mode.release = false;
  else f.b.addBuff(f.u, {key: 'fixture:control', flags: {[control]: true}});
  advance(f.b, 1.3); assert.equal(f.hits.length, 0); assert.equal(p.pulses, 3);
  f.mode.release = true; f.b.removeBuff(f.u, 'fixture:control');
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].id, target.id);
  assert.ok(f.hits[0].at >= 1.6669999957084656 - 1e-7);
});

for (const retirement of ['retreat', 'death', 'life', 'slot', 'account', 'spec', 'activation', 'battle'])
  test(`S2 ${retirement} retirement prevents later pulses and stale direct release`, () => {
    const f = make(); enemy(f); cast(f); until(f, () => f.hits.length === 1);
    if (retirement === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (retirement === 'death') f.b.kill(f.u, null);
    if (retirement === 'life') f.u.deploySeq++;
    if (retirement === 'slot') f.u.mem.aphrissaS2Beam = {};
    if (retirement === 'account') f.u.skill = Object.create(Object.getPrototypeOf(f.u.skill), Object.getOwnPropertyDescriptors(f.u.skill));
    if (retirement === 'spec') f.u.skill.spec = {...f.u.skill.spec};
    if (retirement === 'activation') f.u.skill.activations++;
    if (retirement === 'battle') f.b._finish('fixture');
    advance(f.b, 1); assert.equal(f.hits.length, 1); assert.equal(f.beam.start(), false);
    assert.equal(f.beam.release([], {attackId: 'forged'}), false);
  });

test('A mode departure detaches the old channel and cannot restart the same activation', () => {
  const f = make(); enemy(f); cast(f); f.mode.current = false; advance(f.b, .3);
  f.mode.current = true; assert.equal(f.beam.start(), false);
  advance(f.b, 1); assert.equal(f.hits.length, 0); assert.equal(f.beam.phase, null);
});

test('An ended account cannot deliver a later recipient within the accepted pulse', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source === f.u && event.target === first) f.u.skill.end('fixture'); });
  cast(f); until(f, () => f.hits.length === 1); advance(f.b, 1);
  assert.equal(f.hits.length, 1); assert.equal(later.hp, later.s.maxHp);
});

test('Reentrant tick, start and forceAttack inside a hit cannot duplicate an accepted pulse', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source !== f.u || event.target !== first) return;
    f.beam.tick(); assert.equal(f.beam.start(), false); assert.equal(f.b.forceAttack(f.u, [first, later]), false); });
  cast(f); until(f, () => f.hits.length === 2); assert.equal(f.receipts.length, 1);
});

test('Direct forceAttack and launch calls cannot manufacture pulses between clock positions', () => {
  const f = make(), target = enemy(f); cast(f);
  assert.equal(f.b.forceAttack(f.u, [target]), false);
  assert.equal(f.beam.release([target], {attackId: 'forged'}), false);
  until(f, () => f.hits.length === 1);
  assert.equal(f.b.forceAttack(f.u, [target]), false); assert.equal(f.hits.length, 1);
});

test('Replacing mode ownership from its query cancels the pending pulse', () => {
  const f = make({channelCurrent: ({mode, beam}) => { if (mode.drop) beam.detach(); return true; }});
  enemy(f); cast(f); f.mode.drop = true; advance(f.b, .3); assert.equal(f.hits.length, 0);
});

test('A throwing release policy clears all pending work before propagation', () => {
  const f = make({mayRelease: () => { throw Error('fixture:policy'); }}); enemy(f); cast(f);
  f.b.time = .2; assert.throws(() => f.beam.tick(), /fixture:policy/);
  assert.equal(f.beam.phase, null); assert.equal(f.beam.ticking, false); assert.equal(f.beam.querying, false);
});

test('A late release-permission callback cannot replace ownership and lend permission to the stale pulse', () => {
  const f = make({mayRelease: ({u}) => { u.mem.aphrissaS2Beam = {}; return true; }});
  enemy(f); cast(f); advance(f.b, .4); assert.equal(f.hits.length, 0); assert.equal(f.receipts.length, 0);
});

test('A fresh second account activation has its own clock and never flushes the ended first one', () => {
  const f = make(); enemy(f); cast(f); until(f, () => f.hits.length === 1);
  f.u.skill.end('fixture'); advance(f.b, .1); const second = cast(f);
  advance(f.b, .1); assert.equal(f.hits.length, 1); until(f, () => f.hits.length === 2);
  assert.ok(f.hits[1].at + 1e-7 >= second.startedAt + .16699999570846558);
});

test('The exact contract, complete selected S2 and both explicit adapters are required', () => {
  assert.throws(() => make({contract: {...contract}}), /exact beam contract/);
  assert.throws(() => make({mutate: def => { def.skill.bb.atk_scale = 999; }}), /Incomplete original/);
  const f = make({defer: true});
  assert.throws(() => prepareAphrissaS2Beam(f.b, f.u, {contract}), /explicit channel\/release/);
  assert.equal(f.beam.start(), false); assert.throws(() => f.beam.install(), /installation/);
});

test('A cancelled attack hook consumes the pulse without a later retry or invented receipt', () => {
  const f = make(); enemy(f); let cancel = true;
  f.b.on('beforeAttack', context => { if (context.attacker === f.u && cancel) context.cancel = true; });
  const p = cast(f); advance(f.b, .4);
  assert.equal(p.pulses, 1); assert.equal(f.hits.length, 0); assert.equal(f.receipts.length, 0);
  cancel = false; until(f, () => f.hits.length === 1);
  assert.ok(f.hits[0].at >= .6669999957084656 - 1e-7);
});

test('A beforeAttack hook cannot substitute, duplicate or remove an accepted input list', () => {
  const f = make(), first = enemy(f), later = enemy(f, {col: 8}), foreign = enemy(f, {row: 8});
  let variant = 0;
  f.b.on('beforeAttack', context => {
    if (context.attacker !== f.u) return;
    context.targets = variant++ === 0 ? [first, foreign] : variant === 2 ? [first, first] : [first];
  });
  cast(f); advance(f.b, 1.4);
  assert.equal(f.beam.phase.pulses, 3); assert.equal(f.receipts.length, 0);
  assert.equal(f.hits.length, 0); assert.equal(later.hp, later.s.maxHp);
});

for (const change of ['retreat', 'life', 'account', 'mode'])
  test(`A ${change} during the first hit stops the rest of that pulse`, () => {
    const f = make(), first = enemy(f), later = enemy(f, {col: 8});
    f.b.on('damaged', event => {
      if (event.source !== f.u || event.target !== first) return;
      if (change === 'retreat') f.b.retreat(f.u, {permanent: true});
      if (change === 'life') f.u.deploySeq++;
      if (change === 'account') f.u.skill = Object.create(Object.getPrototypeOf(f.u.skill), Object.getOwnPropertyDescriptors(f.u.skill));
      if (change === 'mode') f.mode.current = false;
    });
    cast(f); until(f, () => f.hits.length === 1); advance(f.b, 1);
    assert.equal(f.hits.length, 1); assert.equal(later.hp, later.s.maxHp);
  });

test('Hiding skips clock positions without revealing the source or accumulating a burst', () => {
  const f = make(); enemy(f); const p = cast(f); f.u.hidden = true;
  advance(f.b, 1.4); assert.equal(p.pulses, 3); assert.equal(f.hits.length, 0);
  f.u.hidden = false; until(f, () => f.hits.length === 1);
  assert.ok(f.hits[0].at >= 1.6669999957084656 - 1e-7);
});

test('The selected end boundary does not emit a tail pulse or reinterpret postDelayChecker as damage', () => {
  const f = make(); enemy(f); const p = cast(f);
  // Advance only the ability clock, holding the harness account active, so the
  // component's own boundary is tested independently of SkillRuntime.end.
  f.b.time = p.startedAt + 8; f.beam.tick();
  assert.equal(f.beam.phase, null); assert.equal(f.hits.length, 0);
  f.b.time += .6669999957084656; f.beam.tick(); assert.equal(f.hits.length, 0);
  assert.equal(f.beam.start(), false);
});

test('Explicit detach preserves foreign presentation and refuses the consumed account activation', () => {
  const f = make(); enemy(f); cast(f);
  const foreign = f.u.mem.regularFormVisual = {clip: 'fixture:foreign'};
  f.beam.detach(); advance(f.b, .8);
  assert.equal(f.beam.start(), false); assert.equal(f.u.mem.regularFormVisual, foreign);
  f.beam.stop(); assert.equal(f.beam.handles.length, 0); assert.equal(f.u.mem.regularFormVisual, foreign);
});

test('A throwing mode adapter clears the pending channel and releases its query guard', () => {
  const f = make({channelCurrent: ({mode}) => { if (mode.fail) throw Error('fixture:mode'); return true; }});
  enemy(f); cast(f); f.mode.fail = true;
  assert.throws(() => f.beam.tick(), /fixture:mode/);
  assert.equal(f.beam.phase, null); assert.equal(f.beam.querying, false); assert.equal(f.beam.ticking, false);
});

test('Calling start again from the mode adapter cannot admit a second beam', () => {
  const f = make({channelCurrent: ({beam}) => { assert.equal(beam.start(), false); return true; }});
  enemy(f); cast(f); until(f, () => f.hits.length === 1); assert.equal(f.receipts.length, 1);
});
