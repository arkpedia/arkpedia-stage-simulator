// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-h5-3.json' with { type: 'json' };
import receipt from '../data/stage-rules/h5-3.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
const battleFor = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_123_fang)] }, { seed: 1 });

test('H5-3 source time limit allows its last spawn after five minutes without a timer override', () => {
  assert.equal(receipt.options.maxPlayTime, -1); assert.equal(stage.battle.max_play_time, -1);
  const b = battleFor(stage); assert.equal(b.timeLimit, Infinity);
  b.setViewport('fullscreen-workspace'); b.life = 1e6; // Isolate schedule completion from leaks; no timer override.
  let spawned = 0, lastSpawn = 0;
  b.on('enemySpawn', () => { spawned++; lastSpawn = b.time; });
  while (!b.finished && b.time < 400) b.step();
  assert.equal(spawned, 93); assert.ok(lastSpawn > 300); assert.ok(b.time > 300);
  assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
});
test('positive source time limits still expire, while unreviewed legacy stages retain their existing default', () => {
  const timed = { ...stage, battle: { ...stage.battle, max_play_time: 2 } }, b = battleFor(timed);
  b.setViewport('fullscreen-workspace'); while (!b.finished && b.time < 3) b.step();
  assert.equal(b.reason, 'timeout'); assert.equal(b.time, 2);
  const legacy = structuredClone(stage); delete legacy.battle.max_play_time;
  assert.equal(battleFor(legacy).timeLimit, 300);
  for (const value of [0, -2, '60', NaN])
    assert.throws(() => battleFor({ ...stage, battle: { ...stage.battle, max_play_time: value } }), /Invalid stage time limit/);
});
test('the rule compiler refuses unknown original options and invalid time limits', () => {
  const source = { id: receipt.stageId };
  for (const options of [{ maxPlayTime: 0 }, { maxPlayTime: -2 }, { maxPlayTime: -1, unknown: 1 }])
    assert.throws(() => compileStageRules(source, { ...receipt, options }), /Unsupported original level options/);
});
