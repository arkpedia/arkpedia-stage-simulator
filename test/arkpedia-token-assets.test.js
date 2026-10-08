// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import nian from '../data/arkpedia-nian-prefabs.json' with { type: 'json' };
import kaltsit from '../data/arkpedia-kaltsit-prefabs.json' with { type: 'json' };
import scene from '../data/arkpedia-scene-prefabs.json' with { type: 'json' };
import blacknight from '../data/arkpedia-blacknight-prefabs.json' with { type: 'json' };
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
        assert.ok(model?.animationRoles?.idle);
        if (id === 'token_10010_folivo_car') {
          assert.equal(model.animationRoles.deploy, null);
          assert.equal(model.animations.Start, undefined, 'the original camera has no entrance clip');
        } else assert.ok(model.animationRoles.deploy);
      }
    }
  }
});

test('Nian skill roles retain ordinary S1, disarmed S2 idle and literal S3 on each actual native facing', () => {
  for (const facing of ['front', 'back']) {
    const model = data.sd.models[`operator/char_2014_nian/default/${facing}`];
    const native = nian.models.char_2014_nian[facing === 'front' ? 'Front' : 'Back'];
    assert.equal(model.skeleton.sha256, native.sha256);
    assert.equal(model.animationRoles.skills[0].loop, 'Attack_Loop');
    assert.equal(model.animationRoles.skills[1].via, 'idle');
    assert.equal(model.animationRoles.skills[1].loop, model.animationRoles.idle);
    assert.equal(model.animationRoles.skills[2].loop, 'Skill_2_Loop');
    for (const role of Object.values(model.animationRoles.skills))
      for (const name of [role.begin, role.loop, role.end, role.idle].filter(Boolean))
        assert.ok(Object.hasOwn(model.animations, name), `${facing}:${name}`);
  }
});

test('Mon3tr renderer keeps the exact native source bytes and mode attack events rather than owner healing clips', () => {
  const native = kaltsit.models.token_10002_kalts_mon3tr;
  for (const facing of ['front', 'back']) {
    const model = data.sd.models[`operator/token_10002_kalts_mon3tr/default/${facing}`];
    assert.equal(model.source.facingAlias, 'single-original-model');
    assert.equal(model.skeleton.sha256, native.files['token_10002_kalts_mon3tr.skel'].sha256);
    assert.equal(model.atlas.sha256, native.files['token_10002_kalts_mon3tr.atlas'].sha256);
    assert.deepEqual(model.hits, { Attack: [.233], Skill: [.367], Skill_2: [.667] });
    assert.deepEqual(Object.values(model.animationRoles.skills).map(role => role.loop), ['Attack', 'Skill', 'Skill_2']);
  }
});

test('Scene cameras retain actual distinct facing bytes and native attack events without inventing Start', () => {
  const hashes = [];
  for (const facing of ['front', 'back']) {
    const native = scene.models.token_10010_folivo_car[facing === 'front' ? 'Front' : 'Back'];
    const model = data.sd.models[`operator/token_10010_folivo_car/default/${facing}`];
    hashes.push(model.skeleton.sha256);
    assert.equal(model.skeleton.sha256, native.files['token_10010_folivo_car.skel'].sha256);
    assert.equal(model.atlas.sha256, native.files['token_10010_folivo_car.atlas'].sha256);
    assert.equal(model.textures[0].sha256, native.files['token_10010_folivo_car.png'].sha256);
    assert.equal(model.animationRoles.deploy, null);
    assert.equal(model.animations.Start, undefined);
    assert.deepEqual(model.hits, { Attack: [.333] });
    assert.equal(model.animations.Stun, .9);
  }
  assert.notEqual(hashes[0], hashes[1]);
});

test('Scene owner requests its native one-shot S1 beginning and ordinary attacks for S2', () => {
  for (const facing of ['front', 'back']) {
    const model = data.sd.models[`operator/char_336_folivo/default/${facing}`];
    const native = scene.models.char_336_folivo[facing === 'front' ? 'Front' : 'Back'];
    assert.equal(model.skeleton.sha256, native.sha256);
    assert.deepEqual(model.animationRoles.skills[0], { begin: 'Skill_1', loop: 'Attack',
      end: null, index: 0, idle: 'Idle' });
    assert.equal(model.animationRoles.skills[1].via, 'attack');
    assert.equal(model.animationRoles.skills[1].loop, 'Attack');
    assert.equal(model.animationRoles.skills[1].begin, null);
  }
});

test('Slumberfoot uses exact original single-model bytes and native inactive, active and sleep clips', () => {
  const id = 'token_10021_blkngt_hypnos', native = blacknight.models[id];
  assert.deepEqual(regularTokenIdsFor(['char_476_blkngt']), [id]);
  for (const facing of ['front', 'back']) {
    const model = data.sd.models[`operator/${id}/default/${facing}`];
    assert.equal(model.source.facingAlias, 'single-original-model');
    assert.equal(model.skeleton.sha256, native.files[`${id}.skel`].sha256);
    assert.equal(model.atlas.sha256, native.files[`${id}.atlas`].sha256);
    assert.equal(model.textures[0].sha256, native.files[`${id}.png`].sha256);
    assert.equal(model.avatar.sha256, native.files['avatar.png'].sha256);
    assert.equal(model.animationRoles.idle, 'Idle_2');
    assert.equal(model.animationRoles.die, 'Die_2');
    assert.equal(model.animationRoles.deploy, 'Start');
    assert.deepEqual(model.hits, { Attack: [.5], Skill_2: [.5] });
    for (const clip of ['Idle_1', 'Die_1', 'Skill_Begin', 'Skill_Loop', 'Skill_End'])
      assert.equal(model.animations[clip], native.durations[clip]);
  }
});
