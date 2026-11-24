// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const SQUAD = ['char_151_myrtle', 'char_123_fang', 'char_240_wyvern', 'char_122_beagle', 'char_124_kroos', 'char_120_hibisc', 'char_208_melan'];
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: SQUAD.map(k => defaultBuild(mvp.operators[k])) }, { seed: 1 });

test('cbuff_max_cost: the DP cap starts at max_cost and may rise only to max_cost_ceil', async () => {
  const receipt = (await loadStageRuleReceipt(root, 'tr-22')).receipt;
  const source = { id: receipt.stageId, battle: { ...mvp.stage.battle } };
  const compiled = compileStageRules(source, receipt);
  assert.deepEqual([compiled.battle.max_dp, compiled.battle.max_dp_ceil], [20, 99]);
  for (const change of [r => r.blackboard[0].value = 100, r => r.blackboard[1].value = 1.5, r => r.blackboard.pop(),
    r => r.blackboard.push({ key: 'scale', value: 1, valueStr: null })]) {
    const bad = structuredClone(receipt); change(bad.runes.find(r => r.key === 'cbuff_max_cost'));
    assert.throws(() => compileStageRules(source, bad), /Unsupported|Invalid/);
  }
});

test('the first chapter-12 slice is available with its sight environment and DP ceiling', async () => {
  const ids = ['12-2', '12-2_adverse_environment', '12-6', '12-8', '12-8_adverse_environment', '12-17', '12-17_adverse_environment', 'tr-22', 'tr-23'];
  for (const id of ids) {
    const stage = await load(id);
    assert.deepEqual(stage.environment?.filter(e => e.kind === 'mainline12_sightManager'), [{ kind: 'mainline12_sightManager', interval: .5 }], id);
    assert.deepEqual([stage.battle.max_dp, stage.battle.max_dp_ceil], [20, 99], id);
  }
  const b = battle(await load('tr-22'));
  assert.equal(typeof b.stageSight?.inSight, 'function');
  assert.deepEqual([b.flags.dpMax, b.flags.dpMaxCeil], [20, 99]);
  // The rest of chapter 12 waits for its unreviewed identity variants.
  assert.notEqual(manifest.stages.find(s => s.id === '12-3')?.availability, 'available');
});

test('placed enemy-side objects hold neither a kill-all wave nor the battle (12-8 wave 0, TR-18)', async () => {
  const stage = await load('12-8'), b = battle(stage);
  b.setViewport('fullscreen-workspace'); b.life = 999;
  b.step();
  const placed = b.enemies.filter(e => e.alive && e.mem.stageUnitDevice);
  assert.ok(placed.length >= 5, 'the Reserves are on the field');
  for (const e of placed) assert.equal(e.profile.holdsBattle, false);
  const tr18 = battle(await load('tr-18'));
  tr18.setViewport('fullscreen-workspace'); tr18.life = 999;
  while (!tr18.finished && tr18.time < 300) tr18.step();
  assert.equal(tr18.finished, true, `TR-18 ends (was stalled behind its placed objects) at ${tr18.time}`);
  assert.equal(tr18.reason, 'cleared');
});
