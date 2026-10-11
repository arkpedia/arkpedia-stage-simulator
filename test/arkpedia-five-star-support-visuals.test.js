// SPDX-License-Identifier: GPL-3.0-or-later
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-five-star-support-expansion-prefabs.json' with { type: 'json' };
import { installFakePixi } from './render/fakepixi.js';
let fake, BattleActor;
before(async () => {
  fake = installFakePixi();
  ({ BattleActor } = await import('../public/arkpedia/battle-actor.js'));
});
after(() => fake.restore());

function actor(id, facing) {
  const source = evidence.models[id][facing];
  const entry = { anims: { idle: 'Idle', attack: { loop: 'Attack' },
    skills: { 1: { index: 1, begin: 'Skill_2_Begin', idle: 'Skill_2_Idle', loop: 'Skill_2_Loop', end: 'Skill_2_End' } } },
  animations: source.durations, hits: source.hits };
  const skeleton = { animations: Object.keys(source.durations).map(name => ({ name })) };
  return { a: new BattleActor(skeleton, entry, 1), entry };
}

test('original animation-free Istina and Grain Buds S2 attacks preserve source stance tracks and never invent missing back clips', () => {
  for (const [id, clip, windup] of [['char_195_glassb', 'Skill_Loop', .5], ['char_4122_grabds', 'Skill_2_Loop', .2]]) {
    const sourceAttack = evidence.characters[id].find(row => row._preDelay > 0 && row._animKey === '');
    assert.equal(sourceAttack._waitForAttackEvent, 0);
    assert.ok(evidence.characters[id].some(row => row._excludeAnimKeys?.includes('Attack')));
    for (const facing of ['Front', 'Back']) {
      const { a, entry } = actor(id, facing), shared = structuredClone(entry);
      a.setRegularVisual({ clip, loop: true });
      const expected = Object.hasOwn(entry.animations, clip) ? clip : 'Idle';
      assert.equal(a.current, expected);
      const track = a.spine.state.tracks[0];
      a.update(.3);
      a.attack(1, false, { animation: 'none', windup, projectile: 'tracked' });
      assert.equal(a.spine.state.tracks[0], track);
      assert.equal(a.mode, 'base');
      a.update(.5);
      a.attack(1, false, { animation: 'none', windup, projectile: 'tracked' });
      assert.equal(a.spine.state.tracks[0], track);
      assert.equal(a.current, expected);
      a.setRegularVisual(null);
      a.attack(1, false, { animation: 'Attack', windup: sourceAttack._preDelay });
      assert.equal(a.current, 'Attack');
      assert.deepEqual(entry, shared);
      a.destroy();
    }
  }
});

test('Proviso S2 original idle remains distinct from each strike and returns after the per-attack clip finishes', () => {
  for (const facing of ['Front', 'Back']) {
    const { a } = actor('char_4032_provs', facing);
    a.setRegularVisual({ clip: 'Skill_2_Idle', loop: true });
    assert.equal(a.current, 'Skill_2_Idle');
    a.attack(1.3, false, { animation: 'Skill_2_Loop', windup: .433 });
    assert.equal(a.current, 'Skill_2_Loop');
    a.update(2);
    assert.equal(a.current, 'Skill_2_Idle');
    a.setRegularVisual(null);
    a.attack(1.9, false, { animation: 'Attack', windup: .433 });
    assert.equal(a.current, 'Attack');
    a.destroy();
  }
});
