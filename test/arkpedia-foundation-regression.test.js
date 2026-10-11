// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { performAttack } from '../server/sim/ai.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function make() {
  const h = makeBattle({
    defs: { chess: { guard: chessRec({ id: 'guard', skill: null, stats: { bat: 2, atk: 100 } }) },
      enemies: { enemy: enemyRec({ key: 'enemy', hp: 100000, def: 1000, speed: 0 }) } },
    units: [{ chessId: 'guard', row: 10, col: 5 }], enemies: [{ key: 'enemy' }],
    content: 'none', autoFinish: false,
  });
  h.step();
  const unit = h.unit('guard'), enemy = h.enemies()[0];
  unit.atkCd = enemy.atkCd = 1000;
  return { h, b: h.b, unit, enemy };
}

test('source faction identifiers survive normalization and deployment without sharing mutable tags', () => {
  const record = chessRec({ id: 'guard', skill: null });
  record.tags = ['ursus', 'student'];
  const h = makeBattle({ defs: { chess: { guard: record } },
    units: [{ chessId: 'guard', row: 10, col: 5 }], content: 'none', autoFinish: false });
  h.step();
  const unit = h.unit('guard');
  assert.deepEqual(unit.def.tags, ['ursus', 'student']);
  assert.deepEqual([...unit.tags], ['ursus', 'student']);
  unit.tags.add('runtime');
  assert.deepEqual(unit.def.tags, ['ursus', 'student']);
  assert.deepEqual(record.tags, ['ursus', 'student']);
  assert.deepEqual(h.b.errors, []);
});

test('owned valued Fragile keeps the strongest effect, independent expiry, and a weaker tail', () => {
  const { h, b, unit, enemy } = make();
  b.applyStatus(enemy, 'fragile', { key: 'fragile:a', source: unit, duration: .2, value: .4 });
  b.applyStatus(enemy, 'fragile', { key: 'fragile:b', source: unit, duration: 2, value: .1 });
  near(b.dealDamage(unit, enemy, { amount: 100, type: 'true' }), 140);
  h.run(.25); near(enemy.s.dmgTakenMul, 1.1);
  b.applyStatus(enemy, 'fragile', { key: 'fragile:b', source: unit, duration: .2, value: .5 });
  b.applyStatus(enemy, 'fragile', { key: 'fragile:b', source: unit, duration: 3, value: .2 });
  near(enemy.s.dmgTakenMul, 1.5);
  h.run(.25); near(enemy.s.dmgTakenMul, 1.2);
  b.removeBuff(enemy, 'fragile:b'); near(enemy.s.dmgTakenMul, 1);
  assert.deepEqual(b.errors, []);
});

test('owned Resist overlap decays only one Palsy stack each five seconds', () => {
  const { h, b, unit } = make();
  b.applyStatus(unit, 'palsy', { value: 3, duration: 20 });
  b.applyStatus(unit, 'resist', { key: 'resist:a', duration: 20, value: .5 });
  b.applyStatus(unit, 'resist', { key: 'resist:b', duration: 20, value: .25 });
  h.run(5.1); assert.equal(unit.findBuff('palsy')?.stacks, 2);
  h.run(5); assert.equal(unit.findBuff('palsy')?.stacks, 1);
  h.run(5); assert.equal(unit.findBuff('palsy'), null);
  assert.deepEqual(b.errors, []);
});

test('staggered Resist sources preserve one cadence through strongest-source expiry', () => {
  const { h, b, unit } = make();
  b.applyStatus(unit, 'palsy', { value: 3, duration: 30 });
  b.applyStatus(unit, 'resist', { key: 'resist:a', duration: 6, value: .5 });
  h.run(2);
  b.applyStatus(unit, 'resist', { key: 'resist:b', duration: 20, value: .25 });
  h.run(3.1); assert.equal(unit.findBuff('palsy')?.stacks, 2);
  h.run(2); assert.equal(unit.findBuff('palsy')?.stacks, 2, 'second source does not supply an extra tick');
  near(b.resistOf(unit), .25);
  h.run(3); assert.equal(unit.findBuff('palsy')?.stacks, 1, 'continuous Resist retains the original five-second clock');
  assert.deepEqual(b.errors, []);
});

test('removing the last Resist source resets its clock before immediate reapplication', () => {
  const { h, b, unit } = make();
  b.applyStatus(unit, 'palsy', { value: 3, duration: 30 });
  b.applyStatus(unit, 'resist', { key: 'resist:a', duration: 20 });
  h.run(4); b.removeBuff(unit, 'resist:a');
  b.applyStatus(unit, 'resist', { key: 'resist:b', duration: 20 });
  h.run(1.2); assert.equal(unit.findBuff('palsy')?.stacks, 3);
  h.run(3.9); assert.equal(unit.findBuff('palsy')?.stacks, 2);
  assert.deepEqual(b.errors, []);
});

test('unnamed Resist still decays Palsy and ordinary buff intervals remain independent', () => {
  const { h, b, unit } = make(); let ticks = 0;
  b.applyStatus(unit, 'palsy', { value: 3, duration: 30 });
  b.applyStatus(unit, 'resist', { duration: 6 });
  b.addBuff(unit, { key: 'independent:a', interval: 1, onTick: () => ticks++ });
  b.addBuff(unit, { key: 'independent:b', interval: 1, onTick: () => ticks++ });
  h.run(5.1); assert.equal(unit.findBuff('palsy')?.stacks, 2); assert.equal(ticks, 10);
  h.run(5); assert.equal(unit.findBuff('palsy')?.stacks, 2); assert.equal(b.resistOf(unit), 0);
  assert.deepEqual(b.errors, []);
});

test('BAT final multipliers compose after percentages and before ASPD, then restore on removal', () => {
  const { b, unit } = make();
  b.addBuff(unit, { key: 'other', mods: { batPct: .3, aspd: 100 } });
  b.addBuff(unit, { key: 'final:a', mods: { batMul: .5 } });
  b.addBuff(unit, { key: 'final:b', mods: { batMul: .8 } });
  near(unit.s.interval, 2 * 1.3 * .5 * .8 / 2);
  b.removeBuff(unit, 'final:a'); near(unit.s.interval, 2 * 1.3 * .8 / 2);
  b.removeBuff(unit, 'final:b'); near(unit.s.interval, 2 * 1.3 / 2);
});

test('explicit damage floors retain incoming multipliers and shields; ordinary damage retains its legacy floor', () => {
  const { b, unit, enemy } = make();
  near(b.dealDamage(unit, enemy, { amount: 100, type: 'phys' }), 5);
  b.addBuff(enemy, { key: 'taken', mods: { physTakenMul: .5 } });
  b.addBuff(enemy, { key: 'shield', shield: 15 });
  near(b.dealDamage(unit, enemy, { amount: 100, type: 'phys', minimumAmount: 40 }), 5);
  assert.equal(enemy.findBuff('shield'), null);
  near(b.dealDamage(unit, enemy, { amount: 100, type: 'phys', minimumAmount: NaN }), 2.5);
});

test('noInspire rejects semantic Inspire effects while unrelated display keys remain usable', () => {
  const { b, unit } = make(); unit.mem.noInspire = true;
  const atk = unit.s.atk;
  assert.equal(b.addBuff(unit, { key: 'normal', status: 'inspire', mods: { atkFlat: 20 } }), null);
  assert.equal(b.addBuff(unit, { key: 'other', tags: ['inspire'], mods: { atkFlat: 20 } }), null);
  near(unit.s.atk, atk);
  assert.ok(b.addBuff(unit, { key: 'inspire', mods: { atkFlat: 20 } })); near(unit.s.atk, atk + 20);
});

test('opted-in healing projectiles heal on impact and an already launched heal survives source retreat', () => {
  const { h, b, unit, enemy: target } = make();
  target.side = 'ally'; target.x = unit.x + 2; target.y = unit.y;
  target.base.maxHp = 1000; target.markDirty(); target.s; target.hp = 1;
  performAttack(b, unit, { dmgType: 'heal', heal: { mode: 'single' }, healProjectileSpeed: 2, windup: 0 }, [target]);
  near(target.hp, 1); h.run(.5); near(target.hp, 1);
  b.retreat(unit); h.run(.7); near(target.hp, 101);
  assert.deepEqual(b.errors, []);
});
