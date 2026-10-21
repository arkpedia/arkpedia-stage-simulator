// SPDX-License-Identifier: GPL-3.0-or-later
// 0-2 is the first file-backed stage and stays out of the public catalogue
// until its simplified-art build and battle are reviewed. These tests keep the
// generated file honest: source geometry, sequential waves, supported enemies
// and a real battle step with no engine errors.
import test from 'node:test';
import assert from 'node:assert/strict';
import stage from '../data/arkpedia-stage-0-2.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const data = () => ({ ...structuredClone(mvp), stage });

test('0-2 keeps its source geometry and the sequential three-wave schedule', () => {
  assert.equal(stage.code, '0-2');
  assert.equal(stage.geometry.rows, 6); assert.equal(stage.geometry.cols, 10);
  assert.equal(stage.geometry.waves.length, 3);
  const adapter = stageAdapter(stage);
  assert.equal(adapter.spawns.length, 14);
  assert.deepEqual(adapter.spawns.map(spawn => spawn.time), [5, 12, 13, 19, 21, 25, 37, 37, 54, 61, 64, 67, 71, 73]);
  assert.doesNotThrow(() => assertRegularEnemies({ ...mvp, stage }));
});
test('0-2 runs on the shared battle without engine errors', () => {
  const source = data(), selection = { operators: Object.values(source.operators).slice(0, 12).map(defaultBuild) };
  const battle = new StandardBattle(source, selection);
  battle.setViewport('fullscreen-workspace');
  for (let i = 0; i < Math.round(30 / battle.dt) && !battle.finished; i++) battle.step();
  assert.deepEqual(battle.errors, []);
  assert.ok(battle.units.some(unit => unit.side === 'enemy'), 'the first wave spawned');
});
