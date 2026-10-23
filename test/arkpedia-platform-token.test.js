// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import base from '../data/arkpedia-stage-dh-1.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const stage = { ...base, tokens: [{ unitId: 'trap_040_canoe', count: 1, cost: 3, hp: 100, block: 0 }] };
const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };

test('the floating platform can be deployed on water and hosts an operator', () => {
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 1).map(defaultBuild) });
  battle.setViewport('fullscreen-workspace');
  battle.addDp('arkpedia', 99);
  let tile;
  for (let r = 0; r < battle.grid.rows && !tile; r++) for (let c = 0; c < battle.grid.cols && !tile; c++) {
    if (String(battle.grid.tile(r, c)?.key).includes('water')) tile = [r, c];
  }
  assert.ok(tile, 'a water tile');
  const platform = battle.deployToken('trap_040_canoe', tile[0], tile[1]);
  assert.ok(platform);
  assert.equal(battle.platformTiles.has(`${tile[0]},${tile[1]}`), true);
  const op = battle.deployOperator(Object.keys(data.operators)[0], tile[0], tile[1], 'UP');
  assert.ok(op);
});
