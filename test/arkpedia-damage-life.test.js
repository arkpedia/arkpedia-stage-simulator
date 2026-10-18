// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle, chessRec, enemyRec} from './helpers/battleHarness.js';

function make() {
  const h = makeBattle({defs: {chess: {g: chessRec({id: 'g', skill: null})},
    enemies: {e: enemyRec({key: 'e', hp: 100, speed: 0})}},
    units: [{chessId: 'g', row: 10, col: 5}], enemies: [{key: 'e'}], content: 'none', autoFinish: false});
  h.step(); const u = h.unit('g'), e = h.enemies()[0]; u.atkCd = e.atkCd = 1000;
  return {b: h.b, u, e};
}

for (const phase of ['outputDamage', 'hit', 'damageFinal', 'calculatedDamage'])
  for (const hpFloor of [0, 1]) test(`${phase} replacement rejects old damage with HP floor ${hpFloor}`, () => {
    const {b, u, e} = make(); let receipts = 0;
    b.on('damaged', () => receipts++);
    b.on(phase, c => { if (c.target === e) { e.deploySeq++; e.hp = 100; } });
    assert.equal(b.dealDamage(u, e, {amount: 200, type: 'true', hpFloor}), 0);
    assert.equal(e.hp, 100); assert.equal(e.stats.taken, 0); assert.equal(receipts, 0);
    assert.deepEqual(b.errors, []);
  });

test('The hit-count path also rejects a life replaced during calculatedDamage', () => {
  const {b, u, e} = make(); let receipts = 0;
  b.addBuff(e, {key: 'hit-count', flags: {hitCount: true}});
  b.on('calculatedDamage', () => { e.deploySeq++; e.hp = 100; });
  b.on('damaged', () => receipts++);
  assert.equal(b.dealDamage(u, e, {amount: 200, type: 'true'}), 0);
  assert.equal(e.hp, 100); assert.equal(e.stats.taken, 0); assert.equal(receipts, 0);
});

for (const nativeResponse of [false, true]) test(`A shield callback cannot spend a replacement life's budget (${nativeResponse})`, () => {
  const {b, u, e} = make(); let replacement;
  const replace = () => {
    e.deploySeq++; e.hp = 100;
    replacement = b.addBuff(e, {key: 'new-life-shield', shield: 1000});
  };
  b.addBuff(e, {key: 'old-life-shield', shield: 10,
    ...(nativeResponse ? {onShieldAbsorb: replace} : {onRemove: replace})});
  assert.equal(b.dealDamage(u, e, {amount: 200, type: 'true'}), 0);
  assert.equal(e.hp, 100); assert.equal(replacement.shield, 1000); assert.equal(e.stats.taken, 0);
});

test('Floor receipts distinguish an exactly lethal packet from an absorbed packet at fractional HP', () => {
  const {b, u, e} = make(), packets = [];
  b.on('damaged', c => packets.push(c));
  e.hp = .5; b.addBuff(e, {key: 'shield', shield: 10});
  assert.equal(b.dealDamage(u, e, {amount: 5, type: 'true', hpFloor: 1}), 0);
  assert.equal(packets.at(-1).hpFloor.lethal, false); assert.equal(e.hp, .5);
  assert.equal(b.dealDamage(u, e, {amount: 5.5, type: 'true', hpFloor: 1}), 0);
  assert.equal(packets.at(-1).hpFloor.lethal, true); assert.equal(e.hp, .5);
  assert.equal(packets.at(-1).hpFloor.unflooredAmount, .5);
  assert.equal(Object.isFrozen(packets.at(-1).hpFloor), true);
});

test('Direct HP loss has no damage-floor receipt or floor protection', () => {
  const {b, u, e} = make(), packets = [];
  b.on('damaged', c => packets.push(c)); b.loseHp(e, 200, {source: u});
  assert.equal(e.alive, false); assert.equal(packets.at(-1).hpFloor, undefined);
});
