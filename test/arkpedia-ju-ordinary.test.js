// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, near, until} from './helpers/ju-fixture.js';
import {JU_ORDINARY_CONTRACT, verifyJuOrdinarySource} from '../server/sim/content/arkpedia-ju-ordinary.js';
import {juNativeInputs} from '../server/sim/content/arkpedia-ju-source.js';

const make = opts => fixture({ordinary: true, ...opts});
const target = (f, opts) => enemy(f, {hp: 1e7, ...opts});
const hits = f => f.hits.filter(h => h.source === f.u && h.dmg.tags.includes('ju:ordinary'));
const begun = f => until(f, () => !!f.attacks.phase);
const airborne = f => until(f, () => f.attacks.flights.size > 0);

test('Ju ordinary component requires its original contract and separate skill-composition predicate', () => {
  assert.throws(() => make({ordinaryContract: {...JU_ORDINARY_CONTRACT}}), /exact ordinary contract/);
  assert.throws(() => make({mayBegin: null}), /composition predicate/);
  const n = structuredClone(juNativeInputs()); n.ordinaryMovement._speed = 15;
  assert.throws(() => verifyJuOrdinarySource(n), /Changed original/);
});

test('Ju respects the original Start and .533333 attack marker, then emits one physical ranged receipt', () => {
  const f = make(), e = target(f); advance(f.b, .9);
  assert.equal(f.attacks.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
  begun(f); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
  advance(f.b, .5); assert.equal(f.receipts.length, 0); assert.equal(hits(f).length, 0);
  airborne(f); assert.equal(f.receipts.length, 1); assert.equal(e.hp, e.s.maxHp);
  until(f, () => hits(f).length === 1);
  near(hits(f)[0].amount, f.u.s.atk); assert.equal(hits(f)[0].dmg.applyWay, 'ranged');
  assert.equal(hits(f)[0].dmg.isAttack, true); assert.equal(hits(f)[0].dmg.isSkill, false);
});

test('New acquisition chooses the heaviest legal target and excludes the shared wound family', () => {
  const f = make(), light = target(f), heavy = target(f), wounded = target(f);
  light.base.massLevel = 1; heavy.base.massLevel = 3; wounded.base.massLevel = 5;
  for (const e of [light, heavy, wounded]) e.markDirty();
  f.b.addBuff(wounded, {key: 'cripple'}); begun(f);
  assert.equal(f.attacks.phase.target, heavy);
  until(f, () => hits(f).length === 1); assert.equal(hits(f)[0].target, heavy);
});

test('Ju can attack its own blocker outside the ordinary long-range grid', () => {
  const f = make(), e = target(f, {col: 5});
  e.blockedBy = f.u; f.u.blocking.push(e); begun(f);
  assert.equal(f.attacks.phase.target, e); until(f, () => hits(f).length === 1);
});

for (const [dir, row, col, face] of [['RIGHT',5,7,'Front'], ['LEFT',5,3,'Front'], ['UP',7,5,'Back'], ['DOWN',3,5,'Front']])
  test(`Original ordinary attack clocks remain available for ${dir}`, () => {
    const f = make({dir}); target(f, {row, col}); begun(f);
    assert.equal(f.u.mem.regularVisualDirection, dir);
    near(f.attacks.model().eventPayloads.Attack[0].time, .5333333611488342);
    assert.equal(f.attacks.model().exactDurations.Die, face === 'Front' ? 1 : undefined);
    until(f, () => hits(f).length === 1);
  });

test('Natural ordinary output creates one critical wound and does not reacquire that wounded enemy', () => {
  const f = make(), e = enemy(f); until(f, () => !!e.findBuff('cripple'));
  assert.equal(e.hp, 1); assert.equal(f.receipts.length, 1); advance(f.b, 6);
  assert.equal(f.receipts.length, 1); assert.equal(e.alive, true);
  until(f, () => !e.alive); assert.equal(f.wounds.pending.size, 0); assert.equal(f.attacks.flights.size, 0);
});

for (const flag of ['stealth', 'untargetable', 'sleep']) test(`New acquisition rejects ${flag} recipients`, () => {
  const f = make(); target(f, {flags: {[flag]: true}}); advance(f.b, 2);
  assert.equal(f.receipts.length, 0); assert.equal(f.attacks.flights.size, 0);
});

test('ASPD accelerates the cycle but the original max-animation-scale one keeps the release marker', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'fast', mods: {aspd: 100}});
  begun(f); near(f.attacks.phase.speed, 1);
  advance(f.b, .5); assert.equal(f.receipts.length, 0);
  until(f, () => f.receipts.length >= 2);
  near(f.receipts[1].time - f.receipts[0].time, 1.2);
});

test('A slow attack stat is sampled at phase start without a second slowdown multiplier', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'slow', mods: {aspd: -50, slowDownMul: .2}});
  begun(f); near(f.attacks.phase.speed, .5);
  advance(f.b, 1); assert.equal(f.receipts.length, 0); airborne(f);
  assert.equal(f.receipts.length, 1);
});

test('A target replaced or killed during windup is never redirected to a different enemy', () => {
  for (const replace of [true, false]) {
    const f = make(), e = target(f), other = target(f); begun(f);
    const selected = f.attacks.phase.target, untouched = selected === e ? other : e;
    if (replace) selected.deploySeq++; else f.b.kill(selected);
    advance(f.b, .8); assert.equal(f.receipts.length, 0); assert.equal(untouched.hp, untouched.s.maxHp);
  }
});

test('A stun that ends before the release still invalidates the unfired phase', () => {
  const f = make(); target(f); begun(f);
  f.b.applyStatus(f.u, 'stun', {duration: .01}); advance(f.b, .7);
  assert.equal(f.receipts.length, 0); assert.ok(f.u.atkCd > 0);
});

test('The composition predicate yields presentation and does not manufacture a skill substitute', () => {
  let enabled = true; const f = make({mayBegin: () => enabled}); target(f); begun(f);
  enabled = false; f.u.mem.regularFormVisual = {clip: 'Skill_1', loop: false};
  advance(f.b, 1); assert.equal(f.receipts.length, 0); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
  enabled = true; until(f, () => f.receipts.length > 0);
});

test('Before-attack veto and reentrant forcing cannot duplicate or replace the retained receipt', () => {
  for (const veto of [true, false]) {
    const f = make(), e = target(f);
    f.b.on('beforeAttack', c => { if (c.attacker !== f.u) return;
      if (veto) c.targets = []; else f.b.forceAttack(f.u, [e]); });
    advance(f.b, 2); assert.equal(f.receipts.length, veto ? 0 : 1);
  }
});

for (const flag of ['stealth', 'untargetable']) test(`A born projectile retains its recipient after ${flag}`, () => {
  const f = make(), e = target(f); airborne(f);
  f.b.addBuff(e, {key: 'late-state', flags: {[flag]: true}});
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk);
});

test('Born ordinary arrows survive source withdrawal with finite launch-ATK fallback', () => {
  const f = make(), e = target(f); airborne(f); const atk = f.u.s.atk;
  f.b.retreat(f.u); f.u.base.atk = 9999; f.u.markDirty();
  assert.equal(f.attacks.stopped, true); until(f, () => hits(f).length === 1);
  near(hits(f)[0].amount, atk); assert.equal(f.attacks.flights.size, 0); assert.equal(f.attacks.watchers.length, 0);
});

test('Live original ATK changes are evaluated at impact while the same source life remains', () => {
  const f = make(), e = target(f); airborne(f);
  f.b.addBuff(f.u, {key: 'late-atk', mods: {atkPct: 1}});
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk);
});

test('A born arrow cannot hit a replacement recipient life or adopt another target', () => {
  const f = make(), e = target(f), other = target(f); begun(f); const selected = f.attacks.phase.target;
  airborne(f); selected.deploySeq++; advance(f.b, .8);
  assert.equal(hits(f).length, 0); assert.equal(e.hp, e.s.maxHp); assert.equal(other.hp, other.s.maxHp);
});

test('External projectile removal and battle end release every finite watcher', () => {
  for (const end of [true, false]) {
    const f = make(); target(f); airborne(f);
    if (end) { f.b.finished = true; f.b.emit('battleEnd', {}); }
    else { f.b.removeProjectiles(p => f.attacks.flights.has(p)); advance(f.b, .05); }
    assert.equal(f.attacks.flights.size, 0); assert.equal(f.attacks.watchers.length, 0);
  }
});
