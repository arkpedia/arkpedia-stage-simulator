// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { skillSourceFor, skillHud } from '../shared/arkpedia/skill-hud.js';

test('an explicitly bound owned summon displays its living deployed owner skill without sharing combat state', () => {
  const owner = { alive: true, deployed: true, skill: { ready: true,
    active: false, manual: true, spCost: 8, spTotal: 8, maxCharges: 1 } };
  const token = { ownerUnit: owner, mem: { skillOwner: owner }, skill: { noSkill: true } };
  assert.equal(skillSourceFor(token), owner);
  assert.equal(skillHud(skillSourceFor(token).skill).canActivate, true);
  assert.equal(skillHud(token.skill), null);
  owner.skill.active = true; owner.skill.duration = 20; owner.skill.timeLeft = 10;
  assert.equal(skillHud(skillSourceFor(token).skill).fraction, .5);
});

test('ordinary units and unbound or foreign summons never inherit owner controls', () => {
  const owner = { alive: true, deployed: true, skill: { ready: true } };
  const foreign = { alive: true, deployed: true };
  for (const unit of [{ mem: {} }, { ownerUnit: owner, mem: {} },
    { ownerUnit: owner, mem: { skillOwner: foreign } }])
    assert.equal(skillSourceFor(unit), unit);
  assert.equal(skillSourceFor(null), null);
});

test('removing an owner detaches the visible skill while preserving the summon own runtime', () => {
  for (const flag of ['alive', 'deployed']) {
    const owner = { alive: true, deployed: true, skill: {} };
    const token = { ownerUnit: owner, mem: { skillOwner: owner }, skill: { noSkill: true } };
    owner[flag] = false;
    assert.equal(skillSourceFor(token), token);
    assert.equal(skillHud(skillSourceFor(token).skill), null);
  }
});
