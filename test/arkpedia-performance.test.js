// SPDX-License-Identifier: GPL-3.0-or-later
// A generous engine-time guard for the heaviest committed stage. It is not a
// micro-benchmark: the 5 s budget only catches an accidental complexity jump.
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-14-11.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

test('a heavy 10s battle stays inside the engine-time budget', () => {
  const data = { ...structuredClone(mvp), stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 12).map(defaultBuild) });
  battle.setViewport('fullscreen-workspace');
  const started = performance.now();
  while (!battle.finished && battle.time < 10) battle.step();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 5000, `10s of 14-11 took ${elapsed.toFixed(0)}ms`);
  assert.deepEqual(battle.errors, []);
});
