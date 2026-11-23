// SPDX-License-Identifier: GPL-3.0-or-later
// A hidden group that no rune of the level names stays off; one a rune enables for this difficulty spawns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const total = (stage, key) => stage.waveProgram.waves.flatMap(w => w.fragments.flatMap(f => f.spawns ?? []))
  .filter(s => s.enemyKey === key).reduce((n, s) => n + s.count, 0);

// [stage, hidden groups compiled from its runes, {enemy: spawns}] against the original level actions:
// 10-5: 3 ASVs plus 2 in `fstar` (no rune); 11-1: 3 Court Casters plus 2 in `h` (no rune);
// 11-13: `easy_normal` (EASY/NORMAL rune) 1 gun, `h` (adverse rune only) 2 precision guns.
for (const [stageId, groups, counts] of [
  ['10-5', {}, { enemy_1224_dsuply: 3 }],
  ['11-1', {}, { enemy_1275_dwlock: 3 }],
  ['11-13', { easy_normal: true }, { enemy_1275_dwlock: 3, enemy_1273_stmgun: 1, enemy_1273_stmgun_2: 0 }],
  ['11-13_adverse_environment', { h: true }, { enemy_1275_dwlock: 3, enemy_1273_stmgun: 0, enemy_1273_stmgun_2: 2 }]])
  test(`compiled ${stageId}: hidden groups ${JSON.stringify(groups)} decide the conditional spawns`, async () => {
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const entry = manifest.stages.find(s => s.id === stageId);
    assert.equal(entry.availability, 'available');
    const stage = await loader.load(entry);
    assert.deepEqual(stage.rules.hiddenGroups, groups);
    assert.deepEqual(Object.fromEntries(Object.keys(counts).map(k => [k, total(stage, k)])), counts);
  });
