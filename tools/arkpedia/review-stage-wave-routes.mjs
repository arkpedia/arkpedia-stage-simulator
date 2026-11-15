// SPDX-License-Identifier: GPL-3.0-or-later
// Source-backed diagnostics for the original/deduplicated hidden-route boundary.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createStageLibraryLoader } from '../../shared/arkpedia/stage-library.js';
import { loadStageRuleReceipt } from './stage-rule-storage.mjs';
import { readOriginalLevel } from './original-level.mjs';
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(await readFile(`${root}data/arkpedia-library.json`));
const base = JSON.parse(await readFile(`${root}data/arkpedia-mvp.json`));
const loader = createStageLibraryLoader(async url => new Response(await readFile(root + url.slice(1))));
const results = [];
for (const id of ['aw-8_challenge_mode', 'ga-ex-7_challenge_mode', 'iw-ex-7_challenge_mode', 'le-ex-4_challenge_mode', 'ps-3_challenge_mode']) {
  const stage = await loader.load(manifest.stages.find(entry => entry.id === id));
  const { receipt } = await loadStageRuleReceipt(root, id), { level } = await readOriginalLevel(root, receipt);
  const targets = new Map();
  for (const [wi, wave] of level.waves.entries()) for (const [fi, fragment] of wave.fragments.entries()) {
    const active = fragment.actions.filter(action => [0, 'SPAWN'].includes(action.actionType)
      && (!action.hiddenGroup || stage.rules.hiddenGroups[action.hiddenGroup] === true));
    for (const [ai, action] of active.entries()) if (action.hiddenGroup) {
      targets.set(`stage-wave:${wi}:${fi}:${ai}`, { enemyKey: action.key, originalRoute: action.routeIndex,
        compiledRoute: stage.waveProgram.waves[wi].fragments[fi].spawns[ai].routeIndex,
        expected: level.routes[action.routeIndex].startPosition });
    }
  }
  assert.ok(targets.size, `${id}: no hidden actions`);
  const battle = new StandardBattle({ ...base, stage, enemies: { ...base.enemies, ...stage.enemies } },
    { operators: [defaultBuild(base.operators.char_123_fang)] });
  battle.life = 1000000;
  battle.on('enemySpawn', ({ enemy }) => {
    const target = targets.get(enemy.tag);
    if (target && !target.observed) target.observed = { enemyKey: enemy.defId, row: enemy.spawnY, col: enemy.spawnX, time: battle.time };
  });
  while ([...targets.values()].some(target => !target.observed) && !battle.finished && battle.time < 300) battle.step();
  for (const [tag, target] of targets) {
    assert.ok(target.observed, `${id}: ${tag} did not spawn`);
    assert.equal(target.observed.enemyKey, target.enemyKey);
    assert.equal(target.observed.row, target.expected.row);
    assert.equal(target.observed.col, target.expected.col);
  }
  assert.deepEqual(battle.errors, []);
  results.push({ id, scope: 'Original waves with diagnostic high life and no deployed operators; route origins, not a stage clear',
    originalLevelSha256: receipt.source.sha256, actions: [...targets.values()] });
  console.log(`${id}: ${targets.size} original hidden-action routes verified`);
}
const directory = `${root}.cache/arkpedia/stage-library-review/`;
await mkdir(directory, { recursive: true });
await writeFile(`${directory}hidden-route-results.json`, JSON.stringify(results, null, 2) + '\n');
