// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make, enemy, ally, advance, near } from './helpers/closur-combat-fixture.js';
import { applySourceSlowDown, sourceAbilityDelta, NATIVE_SLOW_DOWN_CONTRACT as contract } from '../server/sim/content/arkpedia-slow-down.js';
import { attach, install } from '../server/sim/content/enemies.js';
const apply = (f, t, options = {}) => applySourceSlowDown(f.b, f.u, t,
  { key: 'closur', increment: .06, duration: 3, maxStacks: 10, maxStrength: .6, contract, ...options });
test('native slow_down stacks one source additively, caps and refreshes; movement-only Slow stays independent', () => {
  const f = make({ skill: 1 }), t = enemy(f); const base = t.s.interval;
  for (let i = 0; i < 15; i++) apply(f, t);
  near(t.s.moveSpeed, .4); near(t.s.aspd, 40); near(t.s.interval, base / .4); near(t.s.slowDownRate, .4);
  assert.equal(t.buffs.filter(b => b.data?.nativeSlowDown).length, 1);
  f.b.applyStatus(t, 'slow', { value: .5, duration: 4 }); near(t.s.moveSpeed, .2); near(t.s.aspd, 40);
  advance(f.b, 1); const b = apply(f, t); near(b.timeLeft, 3); near(b.stacks, 10);
});
test('different slow_down sources and names compete instead of multiplying, with weaker fallback after removal', () => {
  const f = make({ skill: 1 }), t = enemy(f); apply(f, t); apply(f, t);
  const strong = apply(f, t, { key: 'other', increment: .3, maxStrength: .8 });
  near(t.s.moveSpeed, .7); near(t.s.aspd, 70); near(t.s.slowDownRate, .7);
  f.b.removeBuff(t, strong); near(t.s.moveSpeed, .88); near(t.s.aspd, 88);
  const second = ally(f);
  applySourceSlowDown(f.b, second, t, { key: 'closur', increment: .2, maxStrength: .8, maxStacks: 4, duration: 3, contract });
  near(t.s.moveSpeed, .8); near(t.buffs.filter(b => b.data?.nativeSlowDown).length, 2);
});
test('slow_down applies the native ASPD multiplier after additive attack speed, with the ordinary attribute bounds', () => {
  const f = make({ skill: 1 }), t = enemy(f); f.b.addBuff(t, { key: 'aspd', mods: { aspd: 100 } });
  apply(f, t, { increment: .5 }); near(t.s.aspd, 100);
  f.b.removeBuff(t, 'aspd'); f.b.addBuff(t, { key: 'aspd-negative', mods: { aspd: -90 } }); near(t.s.aspd, 20);
});
test('source-resistable duration clocks slow dynamically without slowing their periodic trigger frequency', () => {
  const f = make({ skill: 1 }), t = enemy(f); apply(f, t, { increment: .5, duration: 10 });
  let pulses = 0;
  const yes = f.b.addBuff(t, { key: 'yes', duration: 2, sourceStatusResistable: true, interval: 1, onTick: () => pulses++ });
  const no = f.b.addBuff(t, { key: 'no', duration: 2, sourceStatusResistable: false });
  advance(f.b, 2); near(yes.timeLeft, 1); near(pulses, 2); assert.equal(t.buffs.includes(no), false);
  for (const b of t.buffs.slice()) if (b.data?.nativeSlowDown) f.b.removeBuff(t, b);
  advance(f.b, 1); assert.equal(t.buffs.includes(yes), false); near(pulses, 3);
});
test('catalogue controls use automatic eligibility, explicit NO wins, and ordinary positive buffs keep world time', () => {
  const f = make({ skill: 1 }), t = enemy(f); apply(f, t, { increment: .5, duration: 10 });
  f.b.applyStatus(t, 'stun', { duration: 2 }); f.b.applyStatus(t, 'silence', { duration: 2, sourceStatusResistable: false });
  f.b.applyStatus(t, 'sanctuary', { duration: 2, value: .2 }); advance(f.b, 2);
  near(t.findBuff('stun').timeLeft, 1); assert.equal(t.findBuff('silence'), null); assert.equal(t.findBuff('sanctuary'), null);
});
test('the source slow_down parent is itself resistable and is not prematurely cleared at its nominal world duration', () => {
  const f = make({ skill: 1 }), t = enemy(f), parent = apply(f, t, { increment: .5 });
  advance(f.b, 3); near(parent.timeLeft, 1.5); near(t.s.moveSpeed, .5);
  advance(f.b, 3); assert.equal(t.buffs.includes(parent), false); near(t.s.moveSpeed, 1); near(t.s.slowDownRate, 1);
});
test('native parent eligibility honors Resist before its slowed lifetime begins', () => {
  const f = make({ skill: 1 }), t = enemy(f); f.b.applyStatus(t, 'resist', { value: .5, duration: 10 });
  const parent = apply(f, t, { increment: .5 }); near(parent.duration, 1.5);
  advance(f.b, 3); assert.equal(t.buffs.includes(parent), false); near(t.s.moveSpeed, 1);
});
test('eligible enemy ability cooldowns consume slowed elapsed time while unmarked abilities retain their clock', () => {
  const f = make({ skill: 1 }), t = enemy(f); install(f.b); let slowed = 0, ordinary = 0;
  attach(f.b, t, [{ id: 'selected', cd: 2, icd: 2, affectedBySlowDown: true, fire: () => slowed++ },
    { id: 'unmarked', cd: 2, icd: 2, fire: () => ordinary++ }]);
  apply(f, t, { increment: .5, duration: 10 }); advance(f.b, 2);
  near(slowed, 0); near(ordinary, 1); advance(f.b, 2); near(slowed, 1); near(ordinary, 2);
});
test('source casting clocks can opt into slow_down without changing world-time or unmarked clocks', () => {
  const f = make({ skill: 1 }), t = enemy(f); apply(f, t, { increment: .5 });
  near(sourceAbilityDelta(t, 2, true), 1); near(sourceAbilityDelta(t, 2), 2);
  assert.throws(() => sourceAbilityDelta(t, Infinity, true)); assert.throws(() => sourceAbilityDelta(t, -1));
});
test('only enemy-class enemy units accept the original template; allies and enemy-side tokens are refused', () => {
  const f = make({ skill: 1 }), a = ally(f), t = enemy(f);
  assert.equal(apply(f, a), null); t.kind = 'token'; assert.equal(apply(f, t), null);
});
test('rejected application cannot add stacks, and death/cleanse removes every source contribution', () => {
  const f = make({ skill: 1 }), t = enemy(f), old = apply(f, t);
  f.b.on('beforeBuff', ctx => { if (ctx.buff.data?.nativeSlowDown) ctx.cancel = true; });
  assert.equal(apply(f, t), null); near(old.stacks, 1); near(t.s.moveSpeed, .94);
  f.b.removeBuff(t, old); near(t.s.moveSpeed, 1); f.b.kill(t); assert.equal(apply(f, t), null);
});
