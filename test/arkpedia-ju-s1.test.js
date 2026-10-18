// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, until, near} from './helpers/ju-fixture.js';
import {prepareJuS1, JU_S1_CONTRACT, verifyJuS1} from '../server/sim/content/arkpedia-ju-s1.js';
import {juNativeInputs} from '../server/sim/content/arkpedia-ju-source.js';

const make = opts => fixture({...opts, prepare: (b, u) => prepareJuS1(b, u, {contract: JU_S1_CONTRACT})});
const target = (f, {ratio = .5, ...opts} = {}) => { const e = enemy(f, {hp: 1e7, ...opts}); e.hp = e.s.maxHp * ratio; return e; };
const prime = (f, charges = 1, partial = 0) => f.u.skill.setSpTotal(f.u.skill.spCost * charges + partial);
const phase = f => until(f, () => f.controller.phase?.shot.isSkill === true);
const airborne = f => until(f, () => f.controller.flights.size > 0);
const skillHits = f => f.hits.filter(h => h.dmg.tags.includes('ju:s1'));
const ended = f => until(f, () => !f.u.skill.active);

test('Selected S1 requires canonical source, exact native policy and a fresh controller', () => {
  assert.throws(() => fixture({prepare: (b, u) => prepareJuS1(b, u, {contract: {...JU_S1_CONTRACT}})}), /exact controller contract/);
  assert.throws(() => make({skill: 2}), /selected Ju S1/);
  const mutations = [n => n.s1._recoverSpIfTargetDead = 0,
    n => n.s1Selector._maxHpExcludeEqual = 1, n => n.s1Movement._speed = 10,
    n => n.s1._stopAffectOnInterrupt = 1];
  for (const mutate of mutations) { const n = structuredClone(juNativeInputs()); mutate(n); assert.throws(() => verifyJuS1(n), /Changed original/); }
});

test('Full charges remain stored with healthy targets while ordinary attacks still run', () => {
  const f = make(), e = target(f, {ratio: 1}); prime(f, 2); advance(f.b, 4);
  assert.equal(f.u.skill.maxCharges, 2); assert.equal(f.u.skill.charges, 2);
  assert.equal(f.u.skill.activations, 0); assert.equal(skillHits(f).length, 0);
  assert.ok(f.hits.some(h => h.dmg.tags.includes('ju:ordinary'))); assert.ok(e.hp < e.s.maxHp);
});

test('At half HP S1 independently selects its eligible input over a heavier healthy enemy', () => {
  const f = make(), heavy = target(f, {ratio: .9}), light = target(f, {ratio: .5});
  heavy.base.massLevel = 5; light.base.massLevel = 1; heavy.markDirty(); light.markDirty(); prime(f);
  phase(f); assert.equal(f.controller.phase.target, light);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1'); assert.equal(f.u.skill.active, true);
  assert.equal(f.u.skill.charges, 0); assert.equal(f.u.s.flags.noSp, true);
});

for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} uses original scale and one speed-fifteen projectile`, () => {
  const f = make({rank}); target(f); prime(f); phase(f);
  advance(f.b, .5); assert.equal(f.receipts.length, 0); airborne(f);
  assert.equal(f.controller.flights.size, 1); assert.equal(f.receipts.length, 1);
  assert.equal(f.receipts[0].isSkill, true); until(f, () => skillHits(f).length === 1);
  near(skillHits(f)[0].amount, f.u.s.atk * f.record.bb.atk_scale_s1);
  assert.equal(skillHits(f)[0].dmg.isSkill, true); assert.equal(skillHits(f)[0].dmg.applyWay, 'ranged');
});

test('HP is filtered at input acquisition rather than reselecting after a heal during windup', () => {
  const f = make(), e = target(f); prime(f); phase(f); e.hp = e.s.maxHp * .9;
  until(f, () => skillHits(f).length === 1); assert.equal(skillHits(f)[0].target, e);
});

test('A barely healthier than half-HP target cannot consume a stored charge', () => {
  const f = make(); target(f, {ratio: .5001}); prime(f, 2); advance(f.b, 1.7);
  assert.equal(f.u.skill.activations, 0); assert.equal(f.u.skill.charges, 2);
});

test('S1 holds its SP account for the sampled attack cycle and releases it without waiting on transport', () => {
  const f = make(), e = target(f), ends = []; f.b.on('skillEnd', c => { if (c.unit === f.u) ends.push(f.b.time); });
  prime(f); phase(f); const reservation = f.controller.reservation;
  airborne(f); assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.gainSp(10, 'fixture'), 0);
  until(f, () => !f.u.skill.active); near(ends.at(-1), reservation.endsAt);
  assert.equal(f.u.s.flags.noSp, undefined); assert.equal(f.u.skill.charges, 0);
  advance(f.b, .2); assert.ok(f.u.skill.spTotal > 0); assert.ok(e.hp < e.s.maxHp * .5);
});

test('The native controller SP hold is structural even if its convenience flag buff is rejected', () => {
  const f = make(); target(f); prime(f);
  f.b.on('beforeBuff', c => { if (c.unit === f.u && c.buff.flags?.noSp) c.cancel = true; });
  phase(f); assert.equal(f.u.s.flags.noSp, undefined);
  assert.equal(f.u.skill.gainSp(100, 'fixture-gift'), 0);
  const before = f.u.skill.spTotal; advance(f.b, .2); near(f.u.skill.spTotal, before);
});

test('A dead input before release refunds one charge while preserving partial SP', () => {
  const f = make(), e = target(f); prime(f, 1, 3); phase(f); const partial = f.u.skill.sp; f.b.kill(e);
  ended(f); assert.equal(f.u.skill.charges, 1); near(f.u.skill.sp, partial);
  assert.equal(f.receipts.length, 0); assert.equal(f.controller.flights.size, 0);
});

test('A replacement input life is lost rather than receiving the old S1 or consuming its refund', () => {
  const f = make(), e = target(f); prime(f); phase(f); e.deploySeq++; e.hp = e.s.maxHp;
  ended(f); assert.equal(f.u.skill.charges, 1); assert.equal(e.hp, e.s.maxHp);
  assert.equal(f.receipts.length, 0);
});

test('Activation-buff callbacks cannot switch the captured S1 input to a different enemy', () => {
  const f = make(), selected = target(f), other = target(f, {ratio: 1}); let entered = false;
  f.b.on('beforeBuff', c => { if (!entered && c.unit === f.u && c.buff.flags?.noSp) { entered = true; f.b.kill(selected); } });
  prime(f); phase(f); assert.equal(f.controller.phase.target, selected);
  ended(f); assert.equal(f.receipts.length, 0); assert.equal(other.hp, other.s.maxHp);
  assert.equal(f.u.skill.charges, 1);
});

test('A veto with a living input spends the activated charge without a fake attack or death refund', () => {
  const f = make(); target(f); prime(f);
  f.b.on('beforeAttack', c => { if (c.attacker === f.u) c.targets = []; });
  phase(f); ended(f); assert.equal(f.receipts.length, 0); assert.equal(f.u.skill.charges, 0);
  assert.equal(skillHits(f).length, 0);
});

test('A released arrow never refunds if its recipient dies before impact', () => {
  const f = make(), e = target(f, {col: 8}); prime(f); phase(f); airborne(f); f.b.kill(e);
  ended(f); assert.equal(f.u.skill.charges, 0); assert.equal(f.receipts.length, 1);
  assert.equal(skillHits(f).length, 0);
});

test('A transient interruption cancels the unfired shot but keeps its original account deadline', () => {
  const f = make(), ends = []; f.b.on('skillEnd', c => { if (c.unit === f.u) ends.push(f.b.time); });
  target(f); prime(f); phase(f); const end = f.controller.reservation.endsAt;
  f.b.applyStatus(f.u, 'stun', {duration: .01}); advance(f.b, .7);
  assert.equal(f.receipts.length, 0); assert.equal(f.u.skill.active, true); assert.equal(f.u.s.flags.noSp, true);
  ended(f); near(ends.at(-1), end); assert.equal(f.u.skill.charges, 0); assert.equal(f.controller.flights.size, 0);
});

test('Native unsilenceable S1 still activates while silenced', () => {
  const f = make(); target(f); f.b.applyStatus(f.u, 'silence', {duration: 10}); prime(f); phase(f);
  until(f, () => skillHits(f).length === 1); assert.equal(f.u.skill.silenceBlocked, false);
});

test('External skill end refuses an old unfired S1 while keeping positive cooldown', () => {
  const f = make(); target(f); prime(f); phase(f); f.u.skill.end('external'); advance(f.b, .7);
  assert.equal(f.receipts.length, 0); assert.ok(f.u.atkCd > 0); assert.equal(f.u.skill.charges, 0);
});

test('S1 cannot be manually activated without the automatic input reservation', () => {
  const f = make(); target(f); prime(f, 2); assert.equal(f.u.skill.activate('manual'), false);
  assert.equal(f.u.skill.charges, 2); phase(f); assert.equal(f.u.skill.activations, 1);
});

test('Born S1 arrows retain selected scale and finite transport after source withdrawal', () => {
  const f = make(); target(f); prime(f); phase(f); airborne(f);
  const amount = f.u.s.atk * f.record.bb.atk_scale_s1; f.b.retreat(f.u);
  until(f, () => skillHits(f).length === 1); near(skillHits(f)[0].amount, amount);
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.flights.size, 0);
  assert.equal(f.controller.watchers.length, 0); assert.equal(f.wounds.handles.length, 0);
});

test('Reentrant forcing accepts only one original S1 birth and one charge', () => {
  const f = make(), e = target(f); prime(f, 2);
  f.b.on('beforeAttack', c => { if (c.attacker === f.u) f.b.forceAttack(f.u, [e]); });
  phase(f); airborne(f); assert.equal(f.receipts.length, 1); assert.equal(f.u.skill.charges, 1);
});

test('Two stored charges create two separate natural S1 cycles without spending either twice', () => {
  const f = make(); target(f); prime(f, 2); phase(f);
  until(f, () => f.u.skill.activations === 2);
  assert.equal(f.u.skill.charges, 0); assert.equal(f.receipts.length, 1);
  until(f, () => f.receipts.length === 2);
  assert.equal(new Set(f.hits.filter(h => h.dmg.tags.includes('ju:s1')).map(h => h.dmg.attackId)).size, 1);
  until(f, () => skillHits(f).length === 2);
  assert.equal(new Set(skillHits(f).map(h => h.dmg.attackId)).size, 2);
});

test('High ASPD shortens the sampled S1 account while keeping the original capped marker', () => {
  const f = make(), ends = []; target(f); prime(f); f.b.addBuff(f.u, {key: 'fast', mods: {aspd: 100}});
  f.b.on('skillEnd', c => { if (c.unit === f.u) ends.push(f.b.time); });
  phase(f); const r = f.controller.reservation; near(r.phase.speed, 1);
  advance(f.b, .5); assert.equal(f.receipts.length, 0); ended(f);
  near(ends[0], r.endsAt); near(r.endsAt - (r.phase.lastAt - r.phase.age), 1.2);
});

test('A target lost inside beforeAttack refunds without an accepted phantom receipt', () => {
  const f = make(), e = target(f); prime(f);
  f.b.on('beforeAttack', c => { if (c.attacker === f.u) f.b.kill(e); });
  phase(f); ended(f); assert.equal(f.u.skill.charges, 1); assert.equal(f.receipts.length, 0);
});

test('Explicit dead-input charge refund preserves unrelated external no-SP state', () => {
  const f = make(), e = target(f); f.b.addBuff(f.u, {key: 'external-no-sp', flags: {noSp: true}});
  prime(f); phase(f); f.b.kill(e); ended(f);
  assert.equal(f.u.skill.charges, 1); assert.equal(f.u.s.flags.noSp, true);
});

test('Withdrawal before the S1 marker cancels unfired work and releases source handles', () => {
  const f = make(); target(f); prime(f); phase(f); f.b.retreat(f.u); advance(f.b, 3);
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.handles.length, 0);
  assert.equal(f.controller.flights.size, 0); assert.equal(f.controller.watchers.length, 0);
  assert.equal(f.wounds.handles.length, 0); assert.equal(f.receipts.length, 0);
});

test('A new caster life created during skillEnd cannot receive an old input refund', () => {
  const f = make(), e = target(f); prime(f); phase(f); f.b.kill(e);
  f.b.on('skillEnd', c => { if (c.unit === f.u) f.u.deploySeq++; });
  ended(f); assert.equal(f.u.skill.charges, 0); advance(f.b, .1);
  assert.equal(f.controller.stopped, true); assert.equal(f.wounds.handles.length, 0);
});

for (const [dir, row, col] of [['RIGHT',5,7], ['LEFT',5,3], ['UP',7,5], ['DOWN',3,5]])
  test(`S1 uses its original Skill_1 clock for ${dir}`, () => {
    const f = make({dir}); target(f, {row, col}); prime(f); phase(f);
    assert.equal(f.u.mem.regularVisualDirection, dir); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
    near(f.controller.phase.releaseAge, .5333333611488342);
    until(f, () => skillHits(f).length === 1);
  });
