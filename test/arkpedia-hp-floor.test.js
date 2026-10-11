// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';

test('native undeadable clamps all HP-loss paths before fractional and fatal bookkeeping and expires', () => {
  const h = makeBattle({ defs: { chess: { g: chessRec({ id: 'g', skill: null }) },
    enemies: { e: enemyRec({ key: 'e', hp: 10000, speed: 0 }) } },
    units: [{ chessId: 'g', row: 10, col: 5 }], enemies: [{ key: 'e' }],
    content: 'none', autoFinish: false });
  h.step();
  const u = h.unit('g'), e = h.enemies()[0];
  u.atkCd = e.atkCd = 1000;
  let fatals = 0;
  h.b.on('fatal', () => fatals++);
  h.b.addBuff(u, { key: 'source:undying', flags: { undeadable: true } });
  u.hp = 1.2;
  const before = u.stats.taken;
  const dealt = h.b.dealDamage(e, u, { amount: .5, type: 'true' });
  assert.ok(Math.abs(dealt - .2) < 1e-6);
  assert.equal(u.hp, 1);
  assert.ok(Math.abs(u.stats.taken - before - .2) < 1e-6);
  assert.equal(h.b.dealDamage(e, u, { amount: 100000, type: 'true' }), 0);
  assert.equal(u.hp, 1);
  h.b.loseHp(u, 100000);
  assert.equal(u.hp, 1);
  assert.equal(fatals, 0);
  h.b.removeBuff(u, 'source:undying');
  h.b.dealDamage(e, u, { amount: 2, type: 'true' });
  assert.equal(u.alive, false);
  assert.equal(fatals, 1);
  assert.deepEqual(h.b.errors, []);
});

test('undeadable does not prevent a scripted kill', () => {
  const h = makeBattle({ defs: { chess: { g: chessRec({ id: 'g', skill: null }) } },
    units: [{ chessId: 'g', row: 10, col: 5 }], content: 'none', autoFinish: false });
  h.step();
  const u = h.unit('g');
  h.b.addBuff(u, { key: 'undying', flags: { undeadable: true } });
  h.b.kill(u);
  assert.equal(u.alive, false);
  assert.deepEqual(h.b.errors, []);
});
