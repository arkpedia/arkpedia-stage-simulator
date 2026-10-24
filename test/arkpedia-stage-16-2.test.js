// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import stage from '../data/arkpedia-stage-16-2.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import { applyStage, resolveStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies, REGULAR_ENEMIES } from '../shared/arkpedia/enemies.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
const fetchStage = async () => ({ ok: true, json: async () => structuredClone(stage) });

test('16-2 is a canonical candidate behind both experimental and test-only admission', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '16-2'), /test-only/);
  assert.equal(REGULAR_ENEMIES.enemy_3010_mcreep, undefined);
  const data = structuredClone(mvp);
  await applyStage(data, index, '16-2', fetchStage, { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(data));
  assert.throws(() => assertRegularEnemies({ ...data, stage: { ...stage, testOnly: false } }), /Unsupported/);
  const bad = { ...index, stages: index.stages.map(e => e.id === '16-2' ? { ...e, testOnly: false } : e) };
  await assert.rejects(applyStage(structuredClone(mvp), bad, '16-2', fetchStage, { experimental: true }), /experimental test-only/);
});

test('16-2 retains all 42 spawns, four canonical records and runs through the native civilian spawn', () => {
  const adapter = stageAdapter(stage);
  assert.equal(adapter.spawns.length, 42); assert.equal(Object.keys(stage.enemies).length, 4);
  const data = { ...structuredClone(mvp), stage, enemies: structuredClone(stage.enemies) };
  const b = new StandardBattle(data, { operators: [defaultBuild(Object.values(data.operators)[0])] });
  // Inspect full source schedule without ending early on the deliberately undefended red box.
  b.life = 1000;
  const miners = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === 'enemy_3010_mcreep') miners.push(enemy); });
  for (let i = 0; i < Math.round(180 / b.dt) && !b.finished; i++) b.step();
  assert.deepEqual(b.errors, []);
  assert.ok(miners.length > 0); assert.ok(miners.every(e => e.profile.friendly));
});
