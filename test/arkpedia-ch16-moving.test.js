// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
const records = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url))).enemies;
const route = { motion: 'WALK', start: [10, 5], end: [10, 10], checkpoints: [] };
const runTo = (h, unit, x) => {
  for (let i = 0; i < 25 / h.b.dt && unit.x < x && unit.alive; i++) h.step();
  assert.ok(unit.alive && unit.x >= x);
  assert.deepEqual(h.b.errors, []);
};

test('a walking miner is healed in its current tile, independently of its retained spawn tile', () => {
  const key = 'enemy_3010_mcreep';
  const medic = chessRec({ id: 'moving_miner_medic', profession: 'MEDIC', stats: { atk: 100 }, rangeGrid: [[0, 0]] });
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures,
    defs: { chess: { moving_miner_medic: medic }, enemies: { [key]: records[key].levels[0] } },
    units: [{ chessId: 'moving_miner_medic', row: 10, col: 8 }] });
  const m = h.spawn(key, { route });
  h.b.dealDamage(null, m, { amount: 1500, type: 'true', sourceless: true });
  const hp = m.hp;
  runTo(h, m, 7.6);
  assert.equal(m.tileC, 5, 'engine deployment coordinates are retained; movement queries must use x/y');
  h.run(2);
  assert.ok(m.hp > hp, 'current position enters the Medic range');
  assert.deepEqual(h.b.errors, []);
});

test('a moving cow summons beside its death position rather than its spawn position', () => {
  const key = 'enemy_10208_mucow', child = 'enemy_10211_murad';
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [key]: records[key].levels[0], [child]: records[child].levels[0] } } });
  const e = h.spawn(key, { route });
  runTo(h, e, 7.8);
  const col = Math.round(e.x), row = Math.round(e.y);
  h.b.kill(e, null);
  const children = h.b.enemies.filter(u => u.defId === child);
  assert.ok(children.length > 0);
  assert.ok(children.every(u => Math.abs(u.x - col) <= 1 && Math.abs(u.y - row) <= 1));
  assert.ok(children.every(u => u.x > 6), 'the old spawn neighborhood ends at column 6');
  assert.deepEqual(h.b.errors, []);
});
