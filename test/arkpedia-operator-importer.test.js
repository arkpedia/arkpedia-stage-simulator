// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceOverrides, verifyFacingOverrides } from '../tools/arkpedia/import-operators.mjs';

const id = 'char_107_liskam';
const options = (patch = {}) => ({ ids: [id], singleModels: new Set(), fixedFrontModels: new Set(),
  directoryMap: {}, catalogue: { [id]: { profession: 'TANK', isNotObtainable: false } }, ...patch });

test('catalogue override retains original identity while allowing the verified Liskarm spelling', () => {
  validateSourceOverrides(options({ directoryMap: { [id]: 'spine/char_107_liskam/char_107_liskarm' } }));
  for (const directory of ['spine/char_107_liskam/../char_107_liskarm',
    'spine/char_107_liskam/char_108_silent', 'spine/char_108_silent/char_107_liskarm',
    'spine/char_107_liskam/build_char_107_liskarm', 'spine/char_107_liskam/char_107_liskarm#1',
    '/spine/char_107_liskam/char_107_liskarm', 'spine/char_107_liskam/char_107_liskarm/Front'])
    assert.throws(() => validateSourceOverrides(options({ directoryMap: { [id]: directory } })), /same operator default/);
  assert.throws(() => validateSourceOverrides(options({ directoryMap: [] })), /JSON object/);
  assert.throws(() => validateSourceOverrides(options({ catalogue: {},
    directoryMap: { [id]: `spine/${id}/${id}` } })), /catalogue operators/);
  assert.throws(() => validateSourceOverrides(options({ ids: [],
    directoryMap: { [id]: `spine/${id}/${id}` } })), /catalogue operators/);
});

test('front-only and single original aliases require explicit IDs and an exact pinned tree', () => {
  assert.throws(() => validateSourceOverrides(options({ fixedFrontModels: new Set(['char_291_aglina']) })), /explicitly imported/);
  assert.throws(() => validateSourceOverrides(options({ singleModels: new Set([id]),
    fixedFrontModels: new Set([id]) })), /Conflicting/);
  const source = names => ({ listing: directory => names.includes(directory.split('/').at(-1)) ? [{ type: 'file' }] : [] });
  const front = options({ fixedFrontModels: new Set([id]) });
  verifyFacingOverrides(source(['Front']), front);
  assert.throws(() => verifyFacingOverrides(source(['Front', 'Back']), front), /pinned original tree/);
  assert.throws(() => verifyFacingOverrides(source([]), front), /pinned original tree/);
  const single = options({ singleModels: new Set([id]) });
  verifyFacingOverrides(source(['Spine']), single);
  assert.throws(() => verifyFacingOverrides(source(['Front', 'Spine']), single), /pinned original tree/);
  assert.throws(() => verifyFacingOverrides(source([]), single), /pinned original tree/);
});
