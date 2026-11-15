// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePristineHiddenGroups } from '../shared/arkpedia/stage-conditional.js';

const geometry = () => ({ hasConditionalSpawns: true, waves: [{ spawns: [] }] });
const hidden = (extra = {}) => ({ enemy_id: 'e', count: 1, time: 0, wave: 0, source: 'wave', condition: { hidden_group: 'h' }, ...extra });

test('hidden groups without reviewed activation stay blocked; inactive groups do not spawn', () => {
  const g = geometry();
  assert.equal(mergePristineHiddenGroups(g, [hidden()]), false);
  assert.equal(g.hasConditionalSpawns, true);
  assert.equal(mergePristineHiddenGroups(g, [hidden()], { h: false }), true);
  assert.equal(g.waves[0].spawns.length, 0);
  assert.equal(g.hiddenGroupsMerged, 0);
});

test('pristine hidden groups are appended and clear the conditional flag', () => {
  const g = geometry();
  assert.equal(mergePristineHiddenGroups(g, [hidden(), hidden({ time: 3 })], { h: true }), true);
  assert.equal(g.waves[0].spawns.length, 2); assert.equal(g.hasConditionalSpawns, false); assert.equal(g.hiddenGroupsMerged, 2);
});
test('a branch, random pack or weight keeps the stage conditional', () => {
  for (const extra of [{ branch: 'r1' }, { condition: { hidden_group: 'h', random_group_pack: 'a' } }, { condition: { hidden_group: 'h', weight: 5 } }]) {
    const g = geometry(); assert.equal(mergePristineHiddenGroups(g, [hidden(extra)], { h: true }), false);
    assert.equal(g.waves[0].spawns.length, 0); assert.equal(g.hasConditionalSpawns, true);
  }
});
test('mixed entries are not merged', () => {
  const g = geometry(); assert.equal(mergePristineHiddenGroups(g, [hidden(), hidden({ branch: 'r1' })], { h: true }), false);
  assert.equal(g.waves[0].spawns.length, 0);
});
test('an invalid wave refuses the entire merge without moving spawns to another wave', () => {
  for (const wave of [-1, 1, 0.5, '0']) {
    const g = geometry(), before = structuredClone(g);
    assert.equal(mergePristineHiddenGroups(g, [hidden(), hidden({ wave })], { h: true }), false);
    assert.deepEqual(g, before);
  }
});
test('plain random candidates require the wave compiler and retain their source group and weight', () => {
  const entry = hidden({ condition: { random_group: 'g', weight: 50 } }), g = geometry();
  assert.equal(mergePristineHiddenGroups(g, [entry]), false);
  assert.equal(mergePristineHiddenGroups(g, [entry], {}, { random: true }), true);
  assert.deepEqual(g.waves[0].spawns[0].random, { group: 'g', weight: 50 });
  for (const condition of [{ random_group: 'g', weight: 1, random_group_pack: 'p' },
    { random_group: 'g', weight: 1, hidden_group: 'h' }, { random_group: 'g', weight: -1 },
    { random_group: '', weight: 1 }, { random_group: 'g', weight: 1.5 }]) {
    const target = geometry();
    assert.equal(mergePristineHiddenGroups(target, [hidden({ condition })], { h: true }, { random: true }), false);
    assert.equal(target.waves[0].spawns.length, 0);
  }
});
