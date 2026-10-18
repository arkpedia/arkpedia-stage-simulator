// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle, chessRec} from './helpers/battleHarness.js';

function make({hold = false, timed = false} = {}) {
  const h = makeBattle({defs: {chess: {t: chessRec({id: 't', skill: {spCost: 10, initSp: 20, maxChargeTime: 2}})}},
    units: [{chessId: 't', row: 10, col: 5}], content: 'generic', autoFinish: false,
    kits: {t: () => ({trait: {noAttack: true}, skill: {kind: timed ? 'duration' : 'instant',
      duration: 5, charges: 2, trigger: 'NEVER', attack: {}, completeOnAttack: false, holdSpWhileActive: hold}})}});
  h.b.start(); const u = h.unit('t'), sk = u.skill; assert.ok(sk.activate('fixture'));
  return {h, u, sk};
}

for (const hold of [false, true]) test(`Instant controller SP hold is opt-in (${hold}) and releases at account end`, () => {
  const {h, sk} = make({hold}), before = sk.spTotal;
  assert.equal(sk.gainSp(3, 'gift'), hold ? 0 : 3);
  h.run(.2);
  assert.ok(Math.abs(sk.spTotal - (hold ? before : before + 3.2)) < 1e-6);
  sk.end('controller-finished'); const end = sk.spTotal;
  assert.equal(sk.gainSp(2, 'gift'), 2); assert.ok(Math.abs(sk.spTotal - end - 2) < 1e-6);
});

test('Structural instant hold blocks attack/hurt/gift recovery without a flag buff', () => {
  const {sk, u} = make({hold: true}); assert.equal(u.s.flags.noSp, undefined);
  for (const reason of ['attack', 'hurt', 'gift', 'time']) assert.equal(sk.gainSp(1, reason), 0);
  assert.equal(sk.holdsSp, true); sk.end('complete'); assert.equal(sk.holdsSp, false);
});

test('Initialization and explicit charge refund remain distinct from blocked SP recovery', () => {
  const {sk} = make({hold: true}); sk.setSpTotal(15);
  assert.equal(sk.spTotal, 15); sk.addCharge(1); assert.equal(sk.spTotal, 20);
  assert.equal(sk.active, true); assert.equal(sk.pending, true);
});

test('Timed skills retain their existing intrinsic hold even without the new opt-in', () => {
  const {h, sk} = make({timed: true}), before = sk.spTotal;
  assert.equal(sk.holdsSp, true); assert.equal(sk.gainSp(3, 'gift'), 0);
  h.run(.2); assert.equal(sk.spTotal, before);
});
