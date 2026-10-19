// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, advance, near} from './helpers/aphrissa-relay-fixture.js';
const make = options => {
  const f = fixture({ordinary: true, ...options});
  f.hits = []; f.receipts = [];
  f.b.on('damaged', event => { if (event.source === f.u) f.hits.push({id: event.target.id,
    at: f.b.time, amount: event.amount, attackId: event.dmg.attackId}); });
  f.b.on('attack', event => { if (event.attacker === f.u) f.receipts.push({at: f.b.time,
    ids: event.targets.map(t => t.id), isSkill: event.isSkill}); });
  return f;
};
function enemy(f, {row = 5, col = 6, hp = 100000, fly = false, res = 0} = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', {pos: [row, col]});
  Object.assign(t.base, {maxHp: hp, def: 9999, res, moveSpeed: 0});
  t.markDirty(); void t.s; t.hp = hp;
  if (fly) t.motion = 'FLY';
  f.b.addBuff(t, {key: 'fixture:pin', flags: {noMove: true, disarm: true}});
  f.b._buildEnemyIndex(); return t;
}
function until(f, predicate, seconds = 5) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), 'Expected controlled ordinary phase');
}

test('Ordinary Arts line releases at the original marker and shares one attack receipt across staggered recipients', () => {
  const f = make(), one = enemy(f), two = enemy(f, {col: 7, fly: true, res: 50});
  advance(f.b, 1.4); assert.equal(f.hits.length, 0); assert.equal(f.receipts.length, 0);
  until(f, () => f.hits.length === 2);
  assert.deepEqual(f.hits.map(hit => hit.id), [one.id, two.id]);
  assert.equal(f.receipts.length, 1); assert.equal(f.receipts[0].isSkill, false);
  assert.deepEqual(f.receipts[0].ids, [one.id, two.id]);
  assert.equal(f.hits[0].attackId, f.hits[1].attackId);
  near(f.hits[0].amount, f.u.s.atk); near(f.hits[1].amount, f.u.s.atk * .5);
  assert.ok(f.hits[0].at >= 1 + .4333333373069763 - 1e-7);
  assert.ok(f.hits[1].at - f.hits[0].at >= .0333333333);
});

test('The original relay path admits only the turned line, with no invented splash or attack outside it', () => {
  const f = make(); f.deck.place(5, 7, 'UP');
  const a = enemy(f, {row: 6, col: 7}), b = enemy(f, {row: 7, col: 7});
  const outside = enemy(f, {row: 5, col: 8});
  until(f, () => f.hits.length === 2);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, b.id]);
  assert.equal(outside.hp, outside.s.maxHp); assert.equal(f.receipts.length, 1);
});

test('Recipients entering or leaving during windup are resampled at the marker', () => {
  const f = make(), leaving = enemy(f), entering = enemy(f, {row: 6, col: 7});
  until(f, () => !!f.attacks.phase);
  leaving.y = 6; entering.y = 5;
  until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].id, entering.id); assert.equal(leaving.hp, leaving.s.maxHp);
});

test('Losing the triggering enemy does not cancel a legal fresh recipient at the marker', () => {
  const f = make(), first = enemy(f);
  until(f, () => !!f.attacks.phase); f.b.kill(first, null);
  const next = enemy(f, {col: 8});
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].id, next.id);
});

test('An empty release does not invent a target, damage receipt or attack SP', () => {
  const f = make(), first = enemy(f);
  until(f, () => !!f.attacks.phase); f.b.kill(first, null);
  advance(f.b, 1); assert.deepEqual(f.hits, []); assert.deepEqual(f.receipts, []);
  assert.equal(f.u.stats.attacks, 0);
});

test('A captured later recipient can move after acceptance but a new arrival cannot join that batch', () => {
  const f = make(); enemy(f);
  const later = enemy(f, {col: 7}), late = enemy(f, {row: 6, col: 8});
  until(f, () => f.hits.length === 1);
  later.y = 6; late.y = 5;
  until(f, () => f.hits.length === 2);
  assert.equal(f.hits[1].id, later.id); assert.equal(late.hp, late.s.maxHp);
});

test('A replaced later recipient life does not receive a stale hit', () => {
  const f = make(); enemy(f); const later = enemy(f, {col: 7});
  until(f, () => f.hits.length === 1); later.deploySeq++;
  advance(f.b, .2); assert.equal(f.hits.length, 1); assert.equal(later.hp, later.s.maxHp);
});

for (const reason of ['stun', 'disarm', 'mode', 'retreat', 'death', 'replacement'])
  test(`Source ${reason} cancels unborn ordinary windup`, () => {
    const f = make(); enemy(f); until(f, () => !!f.attacks.phase);
    if (reason === 'stun' || reason === 'disarm') f.b.addBuff(f.u, {key: 'fixture:control', flags: {[reason]: true}});
    if (reason === 'mode') f.mode.ordinary = false;
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'replacement') f.u.deploySeq++;
    advance(f.b, 1); assert.deepEqual(f.hits, []); assert.deepEqual(f.receipts, []);
  });

test('Retirement inside the first damage callback cancels later unborn hits without repeating the accepted one', () => {
  const f = make(); enemy(f); const later = enemy(f, {col: 7});
  f.b.on('damaged', event => { if (event.source === f.u) f.b.retreat(f.u, {permanent: true}); });
  until(f, () => f.hits.length === 1); advance(f.b, 1);
  assert.equal(f.hits.length, 1); assert.equal(f.receipts.length, 1);
  assert.equal(later.hp, later.s.maxHp); assert.equal(f.attacks.handles.length, 0);
});

test('Each staggered hit uses current ATK rather than an invented cast-wide snapshot', () => {
  const f = make(); enemy(f); enemy(f, {col: 7});
  until(f, () => f.hits.length === 1);
  const first = f.hits[0].amount;
  f.b.addBuff(f.u, {key: 'fixture:later-atk', mods: {atkPct: 1}});
  until(f, () => f.hits.length === 2); near(f.hits[1].amount, first * 2);
});

test('Sampled ordinary playback respects the native maximum animation scale', () => {
  const f = make(); enemy(f);
  f.b.addBuff(f.u, {key: 'fixture:fast', mods: {aspd: 100}});
  until(f, () => !!f.attacks.phase); near(f.attacks.phase.speed, 1);
  until(f, () => f.hits.length === 1);
  near(f.u.mem.regularFormVisual.speed, 1);
});

test('A longer source attack interval slows the ordinary marker without an extra arbitrary delay', () => {
  const f = make(); enemy(f);
  f.b.addBuff(f.u, {key: 'fixture:slow-interval', mods: {batFlat: 2.9}});
  until(f, () => !!f.attacks.phase); near(f.attacks.phase.speed, .5);
  advance(f.b, .7); assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length === 1);
  assert.ok(f.hits[0].at >= 1 + .4333333373069763 / .5 - 1e-7);
});

test('Live slow_down applies once, and zero freezes then resumes the original unborn marker', () => {
  const f = make(); enemy(f); until(f, () => !!f.attacks.phase);
  advance(f.b, .2);
  f.b.addBuff(f.u, {key: 'fixture:slow-clock', mods: {slowDownMul: .5}});
  advance(f.b, .2); near(f.u.mem.regularFormVisual.speed, .5);
  const p = f.attacks.phase;
  f.b.addBuff(f.u, {key: 'fixture:zero-clock', mods: {slowDownMul: 0}});
  const age = p.age; advance(f.b, 1); near(p.age, age); assert.equal(f.hits.length, 0);
  f.b.removeBuff(f.u, 'fixture:zero-clock');
  until(f, () => f.hits.length === 1); assert.equal(f.receipts.length, 1);
});

test('Interrupted attacks preserve positive cooldown rather than granting an immediate replacement', () => {
  const f = make(); enemy(f); until(f, () => !!f.attacks.phase);
  advance(f.b, .1);
  f.b.addBuff(f.u, {key: 'fixture:brief-disarm', flags: {disarm: true}});
  advance(f.b, .1); assert.equal(f.attacks.phase, null);
  const remaining = f.u.atkCd; assert.ok(remaining > 2);
  f.b.removeBuff(f.u, 'fixture:brief-disarm');
  advance(f.b, .5); assert.equal(f.attacks.phase, null); assert.equal(f.hits.length, 0);
  assert.ok(f.u.atkCd < remaining);
});

test('Reentrant forceAttack at the marker cannot emit another accepted attack receipt', () => {
  const f = make(), t = enemy(f); let attempted = false;
  f.b.on('beforeAttack', event => { if (event.attacker === f.u && !attempted) {
    attempted = true; assert.equal(f.b.forceAttack(f.u, [t]), false);
  }});
  until(f, () => f.hits.length === 1);
  assert.equal(f.receipts.length, 1); assert.equal(f.u.stats.attacks, 1);
});

test('A beforeAttack target replacement cannot redirect the original admitted batch', () => {
  const f = make(); enemy(f); const outside = enemy(f, {row: 6, col: 8});
  f.b.on('beforeAttack', event => { if (event.attacker === f.u) event.targets = [outside]; });
  advance(f.b, 2); assert.deepEqual(f.hits, []); assert.equal(f.u.stats.attacks, 0);
});

for (const [dir, row, col, clip] of [['RIGHT', 5, 6, 'Attack'], ['UP', 6, 5, 'Attack'], ['DOWN', 4, 5, 'Attack_Down']])
  test(`${dir} ordinary attack uses the original facing and literal ${clip} clip`, () => {
    const f = make({dir}); enemy(f, {row, col}); until(f, () => !!f.attacks.phase);
    assert.equal(f.u.mem.regularFormVisual.clip, clip);
    assert.equal(f.u.mem.regularVisualDirection, dir);
    assert.equal(f.u.mem.regularDeathVisual.hide, dir === 'UP' ? true : undefined);
    until(f, () => f.hits.length === 1);
  });

test('Explicit ordinary cleanup preserves a foreign presentation owner', () => {
  const f = make(), foreign = {clip: 'foreign'};
  f.u.mem.regularFormVisual = foreign; f.attacks.stop();
  assert.equal(f.u.mem.regularFormVisual, foreign); assert.equal(f.attacks.handles.length, 0);
});

test('Replacing the current controller slot retires an old windup without touching its replacement', () => {
  const f = make(); enemy(f); until(f, () => !!f.attacks.phase);
  const replacement = {owner: 'new-controller'}, visual = {clip: 'replacement'};
  f.u.mem.aphrissaOrdinary = replacement; f.u.mem.regularFormVisual = visual;
  advance(f.b, 1);
  assert.equal(f.attacks.stopped, true); assert.equal(f.attacks.handles.length, 0);
  assert.deepEqual(f.hits, []); assert.deepEqual(f.receipts, []);
  assert.equal(f.u.mem.aphrissaOrdinary, replacement); assert.equal(f.u.mem.regularFormVisual, visual);
});

test('A mode predicate clearing the phase during staggered-hit admission cancels the old pending hit', () => {
  const f = make(); enemy(f); const later = enemy(f, {col: 7});
  until(f, () => f.hits.length === 1);
  f.attacks.mayBegin = () => {
    // The first query observes the prior tick age. The flush queries again
    // after advancing age, just as a reentrant owning mode dispatcher can.
    if (f.attacks.phase?.age >= .48) f.attacks.phase = null;
    return true;
  };
  advance(f.b, .2);
  assert.equal(f.hits.length, 1); assert.equal(later.hp, later.s.maxHp);
});

test('A throwing mode query cancels the old pending phase before reporting the error', () => {
  const f = make(); enemy(f); until(f, () => !!f.attacks.phase);
  f.attacks.mayBegin = () => { throw Error('fixture:mode-query'); };
  assert.throws(() => f.attacks.tick(), /fixture:mode-query/);
  assert.equal(f.attacks.phase, null);
  f.attacks.mayBegin = () => true;
  advance(f.b, 1); assert.deepEqual(f.hits, []);
});

test('An unreviewed ordinary contract cannot install an attack fallback', () => {
  assert.throws(() => make({ordinaryContract: {}}), /explicit ordinary contract/);
});
