// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePristineHiddenGroups } from '../shared/arkpedia/stage-conditional.js';

const geometry = () => ({ hasConditionalSpawns: true, waves: [{ spawns: [] }] });
const hidden = (extra = {}) => ({ enemy_id: 'e', count: 1, time: 0, wave: 0, source: 'wave', condition: { hidden_group: 'h' }, ...extra });

test('pristine hidden groups are appended and clear the conditional flag', () => {
  const g = geometry();
  assert.equal(mergePristineHiddenGroups(g, [hidden(), hidden({ time: 3 })]), true);
  assert.equal(g.waves[0].spawns.length, 2); assert.equal(g.hasConditionalSpawns, false); assert.equal(g.hiddenGroupsMerged, 2);
});
test('a branch, random pack or weight keeps the stage conditional', () => {
  for (const extra of [{ branch: 'r1' }, { condition: { hidden_group: 'h', random_group_pack: 'a' } }, { condition: { hidden_group: 'h', weight: 5 } }]) {
    const g = geometry(); assert.equal(mergePristineHiddenGroups(g, [hidden(extra)]), false);
    assert.equal(g.waves[0].spawns.length, 0); assert.equal(g.hasConditionalSpawns, true);
  }
});
test('mixed entries are not merged', () => {
  const g = geometry(); assert.equal(mergePristineHiddenGroups(g, [hidden(), hidden({ branch: 'r1' })]), false);
  assert.equal(g.waves[0].spawns.length, 0);
});
