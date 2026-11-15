// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-5-4.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { readFile } from 'node:fs/promises';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';

function clearOriginalWaves(stage) {
  const plan = [
    ['char_151_myrtle', 0, 6, 3, 'UP'],
    ['char_264_f12yin', 1, 3, 1, 'UP'],
    ['char_4133_logos', 0, 2, 5, 'LEFT'],
    ['char_103_angel', 2, 5, 8, 'RIGHT'],
    ['char_202_demkni', 0, 4, 9, 'DOWN'],
    ['char_1016_agoat2', 0, 3, 7, 'RIGHT'],
    ['char_293_thorns', 2, 1, 4, 'RIGHT'],
    ['char_172_svrash', 2, 1, 7, 'DOWN'],
  ];
  const operators = plan.map(([id, skill]) => ({ ...defaultBuild(mvp.operators[id]), skillId: mvp.operators[id].skills[skill].id }));
  const battle = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators }, { seed: 1 });
  battle.setViewport('fullscreen-workspace');
  let next = 0, mountainActive = false, spawned = 0;
  battle.on('enemySpawn', () => spawned++);
  while (!battle.finished && battle.time < 300) {
    const p = plan[next];
    if (p && !battle.placementError(p[0], p[2], p[3])) {
      assert.ok(battle.deployOperator(p[0], p[2], p[3], p[4]));
      next++;
    }
    for (const [id] of plan) {
      if (id === 'char_264_f12yin' && mountainActive) continue;
      if (battle.activateOperator(id) && id === 'char_264_f12yin') mountainActive = true;
    }
    battle.step();
  }
  assert.equal(next, plan.length);
  assert.equal(spawned, 52);
  assert.equal(battle.reason, 'cleared');
  assert.ok(battle.life > 0);
  assert.deepEqual(battle.errors, []);
}

test('5-4 clears all original waves with legal deployments and natural DP/SP', () => clearOriginalWaves(stage));
test('compiled 5-4 clears its original fragment/wave program with legal deployments and natural DP/SP', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const compiled = await loader.load(manifest.stages.find(entry => entry.id === '5-4'));
  assert.ok(compiled.waveProgram);
  clearOriginalWaves(compiled);
});
