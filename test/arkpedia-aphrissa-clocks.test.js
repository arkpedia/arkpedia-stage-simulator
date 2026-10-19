// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import evidence from '../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import clocks from '../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};
import {recoverClocks} from '../tools/arkpedia/aphrissa-clocks.mjs';

const id = 'char_4229_aphris', token = 'token_10070_aphris_pc';
const cached = ['front.skel', 'back.skel', `tokens/${token}/single.skel`].every(path =>
  existsSync(new URL(`../.cache/arkpedia/cn-operators/${id}/${path}`, import.meta.url)));

test('Aphrissa preserves original attack, charge and facing clocks without frame-parity approval', () => {
  assert.equal(clocks.operator, id);
  assert.deepEqual(clocks.enabledOperators, []);
  assert.equal(clocks.frameParity, false);
  for (const [face, model] of Object.entries(clocks.models)) {
    assert.equal(model.sha256, evidence.officialSkeletonBindings[id][face].sha256);
    assert.equal(model.bytes, evidence.officialSkeletonBindings[id][face].bytes);
    assert.equal(model.exactDurations.Attack, 2.9000000953674316);
    assert.equal(model.exactDurations.Skill_1_Loop_A, 2.9000000953674316);
    assert.equal(model.exactDurations.Skill_1_Loop_B, 2.9000000953674316);
    assert.equal(model.exactDurations.Skill_2_Begin, .1666666716337204);
    assert.equal(model.exactDurations.Skill_3_Charge_End, .2666666805744171);
    assert.equal(model.exactDurations.Skill_3_Loop, 4);
    const tracks = evidence.models[id][face].eventPayloads;
    for (const clip of ['Attack', 'Skill_1_Loop_A', 'Skill_1_Loop_B'])
      assert.deepEqual(tracks[clip].filter(event => event.name === 'OnAttack').map(event => event.time), [.4333333373069763]);
    assert.deepEqual(tracks.Skill_3_Loop.filter(event => event.name === 'OnAttack').map(event => event.time), [.5]);
    assert.equal(tracks.Skill_2_Loop, undefined, 'The repeated S2 damage clock is not an invented Spine OnAttack marker');
    assert.equal(model.exactDurations.Die, face === 'Front' ? 1 : undefined);
    assert.equal(model.exactDurations.Skill_Down_3_Loop, face === 'Front' ? 4 : undefined);
  }
  const relay = clocks.tokens[token].models;
  assert.deepEqual(Object.keys(relay), ['Single']);
  assert.equal(relay.Single.sha256, evidence.officialSkeletonBindings[token].Single.sha256);
  assert.deepEqual(relay.Single.exactDurations, {Default: 0, Die: 1, Idle: 3, Start: 1});
});

test('All three original skeletons independently reproduce the unrounded clocks', {skip: !cached}, async () => {
  assert.deepEqual(await recoverClocks(), clocks);
});

for (const suffix of ['front.skel', 'back.skel', `tokens/${token}/single.skel`, `${id}.json`])
  test(`Changed original ${suffix} cannot certify animation clocks`, {skip: !cached}, async () => {
    await assert.rejects(() => recoverClocks({read: async path => {
      const bytes = await readFile(path);
      if (!path.pathname.endsWith(suffix)) return bytes;
      const changed = Buffer.from(bytes);
      changed[changed.length - 1] ^= 1;
      return changed;
    }}));
  });
