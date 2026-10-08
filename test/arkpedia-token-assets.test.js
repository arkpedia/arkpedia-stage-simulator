// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_SUMMONS, REGULAR_AUTOMATIC_TOKENS,
  regularTokenIdsFor } from '../shared/arkpedia/summons.js';

test('automatic mines, Freelings and Obelisks load with their selected owners without adding deck cards', () => {
  const owners = ['char_113_cqbw', 'char_2015_dusk', 'char_344_beewax'];
  assert.deepEqual(regularTokenIdsFor(owners), ['token_10008_cqbw_box',
    'token_10015_dusk_drgn', 'token_10011_beewax_oblisk']);
  for (const owner of owners) assert.equal(REGULAR_SUMMONS[owner], undefined);
  assert.deepEqual(regularTokenIdsFor(['char_002_amiya']), [], 'unselected owners never allocate their token assets');
  assert.deepEqual(regularTokenIdsFor([owners[0], owners[0]]), ['token_10008_cqbw_box']);
});

test('every reviewed automatic or manual token dependency has complete original Front and Back models', () => {
  for (const owner of new Set([...Object.keys(REGULAR_SUMMONS), ...Object.keys(REGULAR_AUTOMATIC_TOKENS)])) {
    assert.ok(data.operators[owner], 'the owner belongs to the enabled roster');
    for (const id of regularTokenIdsFor([owner])) {
      assert.ok(data.tokens[id], 'the token retains its own source record');
      for (const facing of ['front', 'back']) {
        const model = data.sd.models[`operator/${id}/default/${facing}`];
        assert.ok(model?.skeleton?.sha256 && model?.atlas?.sha256);
        assert.ok(model?.textures?.length && model.textures.every(texture => texture.sha256));
        assert.ok(model?.animationRoles?.idle && model?.animationRoles?.deploy);
      }
    }
  }
});
