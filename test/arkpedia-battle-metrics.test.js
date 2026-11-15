// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleMetrics } from '../shared/arkpedia/battle-metrics.js';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';

function fixture() {
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { chess: { guard: chessRec({ id: 'guard', skill: null }) },
      enemies: { enemy: enemyRec({ key: 'enemy', hp: 10000, speed: 0 }) } },
    units: [{ chessId: 'guard', row: 10, col: 5 }],
    enemies: [{ key: 'enemy', pos: [10, 5.3] }] });
  h.step();
  const b = h.b, u = h.unit('guard'), e = h.enemies()[0];
  u.atkCd = e.atkCd = 1000;
  b.bench = { guard: { unit: u }, support: { unit: null } };
  const metrics = createBattleMetrics(b);
  return { h, b, u, e, metrics, row: () => metrics.read().find(row => row.id === 'guard') };
}

test('damage totals use settled HP loss, excluding shields, overkill, gauges and friendly damage', () => {
  const { b, u, e, row } = fixture();
  b.addBuff(e, { key: 'shield', shield: 100 });
  b.dealDamage(u, e, { amount: 150, type: 'true' });
  assert.equal(row().total, 50);
  b.dealDamage(u, e, { amount: 10, type: 'element', element: 'neural' });
  b.dealDamage(u, u, { amount: 10, type: 'true' });
  b.dealDamage(e, u, { amount: 10, type: 'true' });
  assert.equal(row().total, 50);
  e.hp = 25;
  b.dealDamage(u, e, { amount: 1000, type: 'true' });
  assert.equal(row().total, 75);
  assert.equal(row().types.true, 75);
  assert.deepEqual(b.errors, []);
});

test('nested damage receipts count each hit once in its own damage type', () => {
  const { b, u, e, row } = fixture();
  b.on('damaged', ({ type }) => {
    if (type === 'true') b.dealDamage(u, e, { amount: 30, type: 'arts', sourceless: true });
  });
  b.dealDamage(u, e, { amount: 70, type: 'true' });
  assert.equal(row().total, 100);
  assert.equal(row().types.true, 70);
  assert.equal(row().types.arts, 30);
});

test('summons, nested summons and sourceless bursts retain operator credit across deployments', () => {
  const { b, u, e, row, metrics } = fixture();
  const summon = { kind: 'token', side: 'ally', ownerUnit: u, stats: { dmg: 0 } };
  const child = { kind: 'token', side: 'ally', ownerUnit: summon, stats: { dmg: 0 } };
  b.dealDamage(child, e, { amount: 40, type: 'elemental', sourceless: true });
  const replacement = { kind: 'op', side: 'ally', defId: u.defId, stats: { dmg: 0 } };
  b.dealDamage(replacement, e, { amount: 60, type: 'true', sourceless: true });
  assert.equal(row().total, 100);
  assert.equal(row().types.elemental, 40);
  const support = { ...replacement, defId: 'support', stats: { dmg: 0 } };
  b.dealDamage(support, e, { amount: 120, type: 'true', sourceless: true });
  assert.equal(metrics.read()[0].id, 'support');
  assert.equal(metrics.read().length, 2);
});

test('DPS follows battle time, expires at five seconds and does not change cumulative totals', () => {
  const { b, u, e, row } = fixture();
  b.time = 1;
  b.dealDamage(u, e, { amount: 100, type: 'true' });
  assert.equal(row().dps, 20);
  assert.equal(row().dps, 20, 'reading while paused does not advance the window');
  b.time = 3;
  b.dealDamage(u, e, { amount: 50, type: 'true' });
  assert.equal(row().dps, 30);
  b.time = 6;
  assert.equal(row().dps, 10);
  b.time = 8;
  assert.equal(row().dps, 0);
  assert.equal(row().total, 150);
});

test('unowned or cyclic summons are ignored and disposal detaches the observer', () => {
  const { b, u, e, metrics, row } = fixture();
  const cycle = { kind: 'token', side: 'ally', stats: { dmg: 0 } };
  cycle.ownerUnit = cycle;
  b.dealDamage(cycle, e, { amount: 10, type: 'true', sourceless: true });
  assert.equal(row().total, 0);
  metrics.dispose();
  b.dealDamage(u, e, { amount: 10, type: 'true' });
  assert.equal(row().total, 0);
  const next = createBattleMetrics(b);
  assert.equal(next.read()[0].total, 0);
  b.dealDamage(u, e, { amount: 20, type: 'true' });
  assert.equal(next.read().find(row => row.id === 'guard').total, 20);
  assert.deepEqual(b.errors, []);
});
