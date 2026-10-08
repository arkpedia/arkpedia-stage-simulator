// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import target from '../data/arkpedia-roster-target.json' with { type: 'json' };
import coverage from '../data/arkpedia-coverage.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { rosterTargetFor } from '../tools/arkpedia/roster-target.mjs';
test('full target includes both Amiya alternate forms and all playable records while Global scope stays explicit', () => {
  assert.equal(target.summary.operatorForms, target.operators.length);
  assert.equal(target.summary.operators + target.summary.additionalAmiyaForms, target.summary.operatorForms);
  assert.deepEqual(target.operators.filter(o => o.alternateFormOf).map(o => o.id), ['char_1001_amiya2', 'char_1037_amiya3']);
  const ids = new Set(target.operators.map(o => o.id)); assert.equal(ids.size, target.operators.length);
  for (const id of Object.keys(data.operators)) assert.ok(ids.has(id), id);
  assert.equal(coverage.fullRosterTarget.playableOperatorForms + coverage.fullRosterTarget.remainingOperatorForms, target.summary.operatorForms);
  assert.equal(coverage.fullRosterTarget.remainingOutsideGlobalSnapshot, 57);
  assert.ok(coverage.scope.includes('Global')); assert.match(target.source.commit, /^[a-f0-9]{40}$/);
  for (const table of target.source.tables) assert.match(table.sha256, /^[a-f0-9]{64}$/);
});
test('roster target excludes inaccessible characters and tokens and refuses unknown alternate-form owners', () => {
  const op = { name: 'Example', isNotObtainable: false, profession: 'CASTER', rarity: 'TIER_5', skills: [{ skillId: 'skill' }] };
  const report = rosterTargetFor({ characters: { char_example: op, char_npc: { ...op, isNotObtainable: true }, token_example: op,
    char_trap: { ...op, profession: 'TRAP' } }, patchCharacters: { char_1001_amiya2: op }, source: {} });
  assert.equal(report.summary.operators, 1); assert.equal(report.summary.operatorForms, 2);
  assert.throws(() => rosterTargetFor({ characters: {}, patchCharacters: { char_unknown: op }, source: {} }), /alternate-form/);
});
