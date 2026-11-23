// SPDX-License-Identifier: GPL-3.0-or-later
// TR-8: a hidden card of 3 Roadblocks is revealed by one ACTIVATE_PREDEFINED of its key, 5 s into wave 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStageSupplyCards } from '../tools/arkpedia/stage-supply-cards.mjs';

const card = { unit_id: 'trap_001_crate', count: 3, level: 1, elite: 0, potential: 0, skill_index: 0, skill_level: 1, hidden: true };
const original = { initialCnt: 3, hidden: true, alias: null, inst: { characterKey: 'trap_001_crate', level: 1, phase: 'PHASE_0', favorPoint: 0, potentialRank: 0 },
  skillIndex: 0, mainSkillLvl: 1, overrideSkillBlackboard: null, overrideTalents: null };
const reveal = (extra = {}) => ({ actionType: 'ACTIVATE_PREDEFINED', key: 'trap_001_crate', count: 1, hiddenGroup: null, ...extra });
const level = actions => ({ predefines: { tokenCards: [original] }, waves: [{ fragments: [{ actions }] }] });

test('a hidden supply card needs exactly one running reveal of its own key', () => {
  assert.doesNotThrow(() => validateStageSupplyCards([card], level([reveal()])));
  for (const [actions, rules] of [[[], {}], [[reveal(), reveal()], {}], [[reveal({ count: 2 })], {}],
    [[reveal({ hiddenGroup: 'raid' })], {}], [[reveal({ hiddenGroup: 'raid' })], { hiddenGroups: { raid: false } }]])
    assert.throws(() => validateStageSupplyCards([card], level(actions), rules), /supply card override/);
  assert.doesNotThrow(() => validateStageSupplyCards([card], level([reveal({ hiddenGroup: 'raid' })]), { hiddenGroups: { raid: true } }));
  // The viewer must agree that the card is hidden, and a visible original cannot be shown as hidden.
  assert.throws(() => validateStageSupplyCards([{ ...card, hidden: false }], level([reveal()])), /supply card override/);
  assert.throws(() => validateStageSupplyCards([card], { ...level([reveal()]), predefines: { tokenCards: [{ ...original, hidden: false }] } }), /supply card override/);
});

test('compiled TR-8: no Roadblocks at the start; three arrive with the wave-1 reveal, once', async () => {
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const entry = manifest.stages.find(s => s.id === 'tr-8');
  assert.equal(entry.availability, 'available');
  const stage = await loader.load(entry);
  const tokenCard = stage.tokens.find(t => t.unitId === 'trap_001_crate');
  assert.deepEqual([tokenCard.count, tokenCard.hiddenCount], [0, 3]);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  assert.equal(b.mvpStageTokens.get('trap_001_crate'), 0);
  let at = null;
  while (!b.finished && b.time < 600 && at == null) {
    for (const e of b.enemies) if (e.alive && !e.mem?.stageUnitDevice) b.kill(e);
    b.step();
    if (b.mvpStageTokens.get('trap_001_crate') > 0) at = b.time;
  }
  assert.ok(at != null, 'revealed');
  assert.equal(b.mvpStageTokens.get('trap_001_crate'), 3);
  b.activateStagePredefined('trap_001_crate');
  assert.equal(b.mvpStageTokens.get('trap_001_crate'), 3, 'granted once');
  assert.deepEqual(b.errors, []);
});
