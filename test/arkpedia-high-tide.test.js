// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import stage from '../data/arkpedia-stage-dh-1.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };
const make = () => new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 2).map(defaultBuild) });

test('high tide is inactive before its start and blocks deployment on low ground', () => {
  const battle = make();
  assert.equal(battle._isFlooded(0, 0), false);
  battle.highTide.windows = [{ start: 0, end: 999 }];
  battle.step();
  let tile;
  for (let r = 0; r < battle.grid.rows && !tile; r++) for (let c = 0; c < battle.grid.cols && !tile; c++) {
    if (battle.grid.isLow(r, c) && battle.grid.groundPassable(r, c, true) && !battle._occ[r * battle.grid.cols + c]?.alive) tile = [r, c];
  }
  assert.ok(tile);
  assert.equal(battle._isFlooded(...tile), true);
  assert.throws(() => battle.deployOperator(Object.keys(data.operators)[0], tile[0], tile[1], 'UP'));
});

test('high tide deals True damage and erosion while it is active', () => {
  const battle = make();
  let tile;
  for (let r = 0; r < battle.grid.rows && !tile; r++) for (let c = 0; c < battle.grid.cols && !tile; c++) {
    if (battle.grid.isLow(r, c) && battle.grid.groundPassable(r, c, true) && !battle._occ[r * battle.grid.cols + c]?.alive) tile = [r, c];
  }
  const enemy = battle.spawnEnemy('enemy_1007_slime_3', { pos: tile });
  assert.ok(enemy);
  battle.highTide.windows = [{ start: 0, end: 999 }];
  const hp = enemy.hp;
  battle.step(); battle.step();
  assert.ok(enemy.hp < hp, `enemy HP ${enemy.hp} did not fall below ${hp}`);
});

test('deep water damages enemies without a tide window', async () => {
  const dh7 = (await import('../data/arkpedia-stage-dh-7.json', { with: { type: 'json' } })).default;
  const battle = new StandardBattle({ ...mvp, stage: dh7, enemies: { ...mvp.enemies, ...dh7.enemies } },
    { operators: Object.values(mvp.operators).slice(0, 1).map(defaultBuild) });
  let tile;
  for (let r = 0; r < battle.grid.rows && !tile; r++) for (let c = 0; c < battle.grid.cols && !tile; c++) if (battle._isDeepWater(r, c)) tile = [r, c];
  assert.ok(tile);
  const enemy = battle.spawnEnemy('enemy_1007_slime_3', { pos: tile });
  const hp = enemy.hp;
  battle.step(); battle.step();
  assert.ok(enemy.hp < hp);
});
