// SPDX-License-Identifier: GPL-3.0-or-later
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { installFakePixi } from './render/fakepixi.js';

let fake, BattleActor;
before(async () => {
  fake = installFakePixi();
  ({ BattleActor } = await import('../public/arkpedia/battle-actor.js'));
});
after(() => fake.restore());

for (const facing of ['front', 'back']) {
  test(`Ambriel ${facing} uses the source normal shot nearby and skill shot far away during S2`, () => {
    const model = data.sd.models[`operator/char_302_glaze/default/${facing}`];
    const entry = { anims: model.animationRoles, animations: model.animations, hits: model.hits };
    const skeleton = { animations: Object.keys(model.animations).map(name => ({ name })) };
    const actor = new BattleActor(skeleton, entry, 1, { attackDrivenSkill: true });
    const original = structuredClone(entry.anims);
    actor.setSkill(true);
    assert.equal(actor.current, model.animationRoles.idle, 'activation never invents a targetless shot');
    actor.attack(3.6, false, { animation: 'attack', windup: .6 });
    assert.equal(actor.current, 'Attack');
    assert.equal(actor.spine.state.tracks[0].trackTime, 0, 'normal windup starts at the source first frame');
    assert.equal(actor.windUntil - actor.clock, .6);
    actor.update(1.5); assert.equal(actor.current, model.animationRoles.idle);
    actor.attack(3.6, false, { animation: 'skill', windup: .9 });
    assert.equal(actor.current, 'Skill'); assert.ok(Math.abs(actor.windUntil - actor.clock - .9) < 1e-9);
    assert.equal(actor.spine.state.tracks[0].trackTime, 0);
    const track = actor.spine.state.tracks[0];
    actor.attack(3.6, false, { animation: 'skill', windup: .9 });
    assert.equal(actor.spine.state.tracks[0], track, 'a multi-target event never restarts the same shot');
    actor.update(1.8); assert.equal(actor.current, model.animationRoles.idle);
    actor.setSkill(false); actor.attack(2.7, false, { animation: 'attack', windup: .6 });
    assert.equal(actor.current, 'Attack');
    assert.deepEqual(entry.anims, original, 'a per-shot role never changes the shared model');
    actor.destroy();
  });

  test(`Gummy ${facing} selects the original S2 cooking sequence without changing the shared S1 model`, () => {
    const model = data.sd.models[`operator/char_196_sunbr/default/${facing}`];
    const entry = { anims: model.animationRoles, animations: model.animations, hits: model.hits };
    const skeleton = { animations: Object.keys(model.animations).map(name => ({ name })) };
    const first = new BattleActor(skeleton, entry, 0);
    const second = new BattleActor(skeleton, entry, 1);
    first.setSkill(true); second.setSkill(true);
    if (facing === 'front') {
      assert.equal(first.current, 'Skill');
      assert.equal(second.current, 'Skill_2_Begin');
    }
    assert.notEqual(second.roles, entry.anims, 'selection cannot mutate cached role metadata');
    assert.equal(entry.anims.skill.index, 0);
    assert.equal(second.roles.skill.index, 1);
    assert.equal(first.roles.skill.index, 0);
    for (let i = 0; i < 600; i++) second.update(1 / 60);
    second.setSkill(false);
    if (second.has(second.roles.skill.end)) assert.equal(second.current, second.roles.skill.end);
    first.destroy(); second.destroy();
  });
}

test('a missing S2 role never borrows S1, and a stat-only skill never invents extra attacks', () => {
  const model = data.sd.models['operator/char_109_fmout/default/front'];
  const skeleton = { animations: Object.keys(model.animations).map(name => ({ name })) };
  const entry = { anims: model.animationRoles, animations: model.animations, hits: model.hits };
  const actor = new BattleActor(skeleton, entry, 1);
  actor.setSkill(true);
  for (let i = 0; i < 120; i++) actor.update(1 / 60);
  assert.equal(actor.current, model.animationRoles.idle); assert.equal(actor.mode, 'base');
  const unsupported = new BattleActor(skeleton, entry, 2);
  unsupported.setSkill(true); assert.equal(unsupported.roles.skill, null);
  assert.equal(unsupported.current, model.animationRoles.idle);
  actor.destroy(); unsupported.destroy();
});
