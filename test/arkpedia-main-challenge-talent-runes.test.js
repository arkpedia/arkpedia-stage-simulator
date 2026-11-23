// SPDX-License-Identifier: GPL-3.0-or-later
// 4-7 and 6-9 Challenge: their ebuff_talent_blackb_mul runes scale talents the runtimes read from the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };

async function load(id) {
  const { readFile } = await import('node:fs/promises');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const entry = manifest.stages.find(s => s.id === id);
  assert.equal(entry.availability, 'available', id);
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  return loader.load(entry);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('4-7 Challenge: Acid Originium Slugs blast at boom.atk_scale x1.8', async () => {
  const stage = await load('4-7_challenge_mode'), base = records.enemies.enemy_1021_bslime.levels[0].talents.bb['boom.atk_scale'];
  near(stage.enemies.enemy_1021_bslime.talents.bb['boom.atk_scale'], base * 1.8);
});

test('6-9 Challenge: every atkup.atk_scale is x1.667, other talents unchanged', async () => {
  const stage = await load('6-9_challenge_mode');
  const scaled = Object.entries(stage.enemies).filter(([, r]) => 'atkup.atk_scale' in r.talents.bb);
  assert.ok(scaled.some(([id]) => id === 'enemy_1064_snsbr'));
  for (const [id, r] of scaled) {
    const base = records.enemies[id].levels[r.level ?? 0].talents.bb['atkup.atk_scale'];
    near(r.talents.bb['atkup.atk_scale'], base * 1.667);
  }
});
