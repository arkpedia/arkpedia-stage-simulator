// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter-11 adverse environments: char_respawntime_add (11-14) and char_exclude with include_predefined 0 (11-9, 11-18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageCardRespawnTime } from '../server/sim/content/arkpedia-stage-card-cost.js';
import { excludedStageOperators } from '../shared/arkpedia/stage-roster.js';
import { PROFESSION_BITS } from '../shared/arkpedia/stage-card-rules.js';

async function load(id) {
  const { readFile } = await import('node:fs/promises');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const entry = manifest.stages.find(s => s.id === id); assert.equal(entry.availability, 'available', id);
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  return loader.load(entry);
}

test('11-14 adverse: every operator redeploys 30 s later', async () => {
  const stage = await load('11-14_adverse_environment');
  assert.deepEqual(stage.rules.allyCards.filter(r => r.add != null), [{ attribute: 'respawnTime', professionMask: 1023, buildableMask: 3, add: 30 }]);
  const record = { profession: 'WARRIOR', position: 'MELEE', stats: { respawnTime: 70 }, baseCardStats: { respawnTime: 70 } };
  assert.equal(stageCardRespawnTime({ stageCardRules: stage.rules }, record), 100);
  assert.equal(stageCardRespawnTime({ stageCardRules: {} }, record), 70, 'no rule, no change');
});

for (const [id, mask, banned] of [['11-9_adverse_environment', 34, ['SNIPER', 'TANK']], ['11-18_adverse_environment', 72, ['SUPPORT', 'SPECIAL']]])
  test(`${id}: ${banned.join(' and ')} cannot be brought; preplaced units are untouched`, async () => {
    const stage = await load(id);
    assert.equal(stage.battle.excluded_profession_mask, mask);
    const operators = Object.fromEntries(Object.keys(PROFESSION_BITS).map(p => [`char_t_${p.toLowerCase()}`, { id: `char_t_${p.toLowerCase()}`, profession: p }]));
    const excluded = excludedStageOperators(stage, operators);
    assert.deepEqual([...excluded].sort(), banned.map(p => `char_t_${p.toLowerCase()}`).sort());
  });

test('other forms of these runes stay refused (on a real 5-4 Challenge receipt)', async () => {
  const { compileStageRules } = await import('../shared/arkpedia/stage-rules.js');
  const receipt = (await import('../data/stage-rules/5-4_challenge_mode.json', { with: { type: 'json' } })).default;
  const normal = (await import('../data/arkpedia-stage-5-4.json', { with: { type: 'json' } })).default;
  const source = { code: '5-4', name: normal.name, id: 'main_05-04#f#', stage_type: 'main', battle: normal.battle,
    variant: { kind: 'challenge_mode', of_stage_id: 'main_05-04', shares_parent_level_file: true } };
  const withRune = (key, blackboard, professionMask = 1023) => ({ ...structuredClone(receipt),
    runes: [{ key, difficultyMask: 'ALL', professionMask, buildableMask: 'ALL', blackboard }] });
  const value = v => ({ key: 'value', value: v, valueStr: null });
  // accepted forms compile
  assert.deepEqual(compileStageRules(source, withRune('char_respawntime_add', [value(30)])).allyCards, [{ attribute: 'respawnTime', professionMask: 1023, buildableMask: 3, add: 30 }]);
  assert.equal(compileStageRules(source, withRune('char_exclude', [{ key: 'include_predefined', value: 0, valueStr: null }], 34)).battle.excluded_profession_mask, 34);
  // other forms do not
  assert.throws(() => compileStageRules(source, withRune('char_respawntime_add', [value(30)], 'TRAP')), /Unsupported redeployment-time addition|Unsupported stage rune/);
  assert.throws(() => compileStageRules(source, withRune('char_respawntime_add', [value(30), { key: 'char', value: 0, valueStr: 'trap_001_crate' }])), /Unsupported stage rune|Invalid rune parameter: char_respawntime_add.char/);
  assert.throws(() => compileStageRules(source, withRune('char_exclude', [{ key: 'include_predefined', value: 1, valueStr: null }], 34)), /Unsupported rune targeting|Unsupported stage rune/);
});
