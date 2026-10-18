// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import evidence from '../data/arkpedia-native-operators/char_4221_ju.json' with {type: 'json'};
import clocks from '../data/arkpedia-ju-clocks.json' with {type: 'json'};
import {recoverClocks} from '../tools/arkpedia/ju-clocks.mjs';

const cached = existsSync(new URL('../.cache/arkpedia/cn-operators/char_4221_ju/front.skel', import.meta.url));
test('Ju exact original clocks preserve attack markers, skill transitions and missing Back death', () => {
  assert.equal(clocks.operator, evidence.operatorId);
  assert.deepEqual(clocks.enabledOperators, []);
  assert.equal(clocks.frameParity, false);
  for (const [face, model] of Object.entries(clocks.models)) {
    assert.equal(model.sha256, evidence.officialSkeletonBindings[evidence.operatorId][face].sha256);
    for (const clip of ['Attack', 'Skill_1', 'Skill_2_Loop']) {
      assert.equal(model.exactDurations[clip], 2.4000000953674316);
      assert.equal(evidence.models[evidence.operatorId][face].eventPayloads[clip][0].time, .5333333611488342);
    }
    assert.equal(model.exactDurations.Skill_2_Begin, .5);
    assert.equal(model.exactDurations.Skill_2_End, .1666666716337204);
    assert.equal(model.exactDurations.Die, face === 'Front' ? 1 : undefined);
  }
});
test('Raw Ju Front/Back skeletons independently reproduce unchanged rounded and exact clocks', {skip: !cached},
  async () => assert.deepEqual(await recoverClocks(), clocks));
test('Changed original Ju skeleton/foundation bytes cannot declare a valid clock', {skip: !cached}, async () => {
  for (const suffix of ['front.skel', 'back.skel', 'char_4221_ju.json'])
    await assert.rejects(() => recoverClocks({read: async path => {
      const bytes = await readFile(path);
      if (!path.pathname.endsWith(suffix)) return bytes;
      const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1; return changed;
    }}));
});
