// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_394_hadiya.json' with {type: 'json'};
import clocks from '../data/arkpedia-hadiya-clocks.json' with {type: 'json'};
import {recoverClocks} from '../tools/arkpedia/hadiya-clocks.mjs';
const ID = 'char_394_hadiya';
const cached = existsSync(new URL('../.cache/arkpedia/cn-operators/' + ID + '/front.skel', import.meta.url));

test('Hadiya preserves unrounded original attack/cast clocks and distinct facing tracks', () => {
  assert.equal(clocks.operator, ID); assert.deepEqual(clocks.enabledOperators, []); assert.equal(clocks.frameParity, false);
  for (const [face, m] of Object.entries(clocks.models)) {
    assert.equal(m.sha256, e.officialSkeletonBindings[ID][face].sha256);
    for (const clip of ['Start', 'Idle', 'Attack_A', 'Attack_B', 'Skill_1', 'Skill_2_Begin',
      'Skill_2_Loop', 'Skill_2_Idle', 'Skill_2_End']) {
      assert.ok(Object.hasOwn(m.exactDurations, clip));
      assert.ok(Math.abs(m.exactDurations[clip] - e.models[ID][face].durations[clip]) < .00051);
    }
    for (const [clip, time] of [['Attack_A', .5333333611488342], ['Attack_B', .5333333611488342],
      ['Skill_1', .1666666716337204], ['Skill_2_Begin', .4333333373069763], ['Skill_2_Loop', .4333333373069763]])
      assert.equal(e.models[ID][face].eventPayloads[clip].find(v => v.name === 'OnAttack').time, time);
  }
  assert.equal(clocks.models.Back.exactDurations.Skill_Down_2_Loop, undefined);
  assert.equal(clocks.models.Back.exactDurations.Die, undefined);
  assert.equal(clocks.models.Front.exactDurations.Skill_Down_2_Loop, 1.2333333492279053);
});
test('Original Hadiya facing bytes independently reproduce unrounded clocks', {skip: !cached}, async () =>
  assert.deepEqual(await recoverClocks(), clocks));
test('Changed facing/receipt bytes cannot certify Hadiya clocks', {skip: !cached}, async () => {
  for (const suffix of ['front.skel', 'back.skel', ID + '.json'])
    await assert.rejects(() => recoverClocks({read: async path => {
      const b = await readFile(path); if (!path.pathname.endsWith(suffix)) return b;
      const v = Buffer.from(b); v[v.length - 1] ^= 1; return v;
    }}));
});
