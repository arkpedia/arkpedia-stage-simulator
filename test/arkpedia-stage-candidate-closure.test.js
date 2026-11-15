// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

test('published random stage definitions remain complete for seeds other than the compiler validation seed', async () => {
  const context = await loadContentContext(), id = 'isw-du_level_obt_roguelike_ro1_level_rogue1_t-1';
  const plan = await planStage(context, id, { waves: true });
  assert.deepEqual(plan.blockers, []);
  const { stage } = plan, seen = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const b = new StandardBattle({ ...context.mvp, stage, enemies: stage.enemies },
      { operators: [defaultBuild(context.mvp.operators.char_123_fang)] }, { seed });
    for (const wave of b.stageWaveScheduler.program.waves) for (const fragment of wave.fragments) for (const spawn of fragment.spawns) {
      assert.ok(stage.enemies[spawn.enemyKey], `seed ${seed} needs ${spawn.enemyKey}`);
      const enemy = b.spawnEnemy(spawn.enemyKey, { routeIndex: spawn.routeIndex, countInTotal: false,
        routeClock: { wave: 0, fragment: 0 } });
      assert.equal(enemy.defId, spawn.enemyKey); assert.equal(enemy.name, stage.enemies[spawn.enemyKey].name);
      seen.add(spawn.enemyKey);
    }
    assert.deepEqual(b.errors, []);
  }
  assert.ok(seen.has('enemy_2001_duckmi')); assert.ok(seen.has('enemy_1047_sagent'));
});

test('original zero-time activation branches with no predefined targets are retained as explicit empty programs', async () => {
  const context = await loadContentContext();
  for (const id of ['h5-3', 'fin-ts']) {
    const plan = await planStage(context, id, { waves: true });
    assert.deepEqual(plan.blockers, []);
    const branches = Object.values(plan.stage.waveProgram.branches);
    assert.equal(branches.length, 1); assert.ok(branches[0].missingActivationAliases.length > 0);
    assert.deepEqual(branches[0].spawns, []);
  }
});
