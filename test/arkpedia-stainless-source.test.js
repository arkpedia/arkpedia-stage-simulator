// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };

const ID = 'char_4072_ironmn';
const tokens = [1, 2, 3].map(n => `token_10027_ironmn_pile${n}`);
const components = rows => rows.flatMap(r => r.components);
const controller = rows => components(rows).find(c => c.data._modes).data;
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = a => a.$type.split('+').at(-1).split(',')[0];
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr || r.value]));

test('Stainless immutable foundation remains held independently of separate public approval', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
});

test('receipt includes all three distinct devices, sixty ranks and exact source IDs', () => {
  assert.deepEqual(Object.keys(e.tokens), tokens);
  assert.deepEqual(Object.keys(e.tables.tokens), tokens);
  assert.deepEqual(Object.keys(e.tables.skills), [1, 2, 3].map(n => `skchr_ironmn_${n}`));
  assert.deepEqual(Object.keys(e.tables.tokenSkills), [1, 2, 3].map(n => `sktok_ironmn_pile${n}`));
  assert.ok([...Object.values(e.tables.skills), ...Object.values(e.tables.tokenSkills)].every(s => s.levels.length === 10));
  const rows = [...Object.values(e.characters), ...Object.values(e.tokens), ...Object.values(e.skills), ...Object.values(e.projectiles)].flat();
  assert.equal(components(rows).length, 284);
  assert.ok(components(rows).every(c => typeof c.pathId === 'string'));
  assert.equal(e.source.bundles.length, 6);
  assert.deepEqual(Object.keys(e.projectiles), ['projectile_chr_ironmn_pile3']);
  assert.equal(Object.keys(e.templates).length, 16);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.deepEqual(Object.keys(e.tables.ranges), ['1-1', '3-13', 'b-1', 'x-4']);
});

test('devices consume no operator slot and preserve distinct native sides and build rules', () => {
  assert.equal(controller(e.characters[ID])._occupiedRemainingCharacterCnt, 1);
  for (const [n, token] of tokens.entries()) {
    const c = controller(e.tokens[token]);
    assert.equal(c._occupiedRemainingCharacterCnt, 0);
    assert.equal(c._buildCondition.needSpecifyDirection, 1);
    assert.equal(c._buildCondition.buildableType, n === 2 ? 1 : 3);
    assert.equal(c._sideType, n === 2 ? 2 : 1);
    assert.equal(c._category, n === 2 ? 1 : 2);
  }
});

test('owner four modes retain single-target attacks and S2 blocked-count targeting', () => {
  const by = new Map(components(e.characters[ID]).map(c => [c.pathId, c.data]));
  const attacks = controller(e.characters[ID])._modes.map(p => by.get(by.get(p.m_PathID)._attack.m_PathID));
  assert.deepEqual(attacks.map(a => a._animKey), ['Attack', 'Skill_1', 'Skill_2', 'Skill_3']);
  assert.ok(attacks.every(a => a._damageType === 1 && a._waitForAttackEvent === 1));
  const selectors = controller(e.characters[ID])._modes.map(p => {
    const trigger = by.get(by.get(p.m_PathID)._attackTrigger.m_PathID);
    const row = e.characters[ID].find(r => r.pathId === trigger.m_GameObject.m_PathID);
    return row.components.find(c => c.data._targetMotion !== undefined).data;
  });
  assert.ok(selectors.every(s => s._targetMotion === 1));
  assert.equal(selectors[2]._limitedMaxTargetNumToBlockedCnt, 1);
  assert.ok([0, 1, 3].every(n => selectors[n]._limitTargetNum === 1 && selectors[n]._maxNum === 1));
});

test('owner skill token recharge and destruction preserve native lifecycle order', () => {
  assert.deepEqual(actions('ironmn_s_1', 'ON_BUFF_START').map(type), ['SwitchMode', 'AlwaysNext', 'RechargeToken']);
  assert.deepEqual(actions('ironmn_s_1', 'ON_BUFF_FINISH').map(type), ['SwitchMode', 'AlwaysNext', 'KillTokens']);
  assert.deepEqual(actions('ironmn_s_2', 'ON_BUFF_START').map(type), ['SwitchMode']);
  assert.deepEqual(actions('ironmn_s_2', 'ON_BUFF_FINISH').map(type), ['SwitchMode', 'AlwaysNext', 'RechargeToken']);
  assert.deepEqual(actions('ironmn_s_3', 'ON_BUFF_START').map(type), ['SwitchMode', 'AlwaysNext', 'RechargeToken']);
  assert.deepEqual(actions('ironmn_s_3', 'ON_BUFF_FINISH').map(type), ['SwitchMode']);
  assert.deepEqual(actions('die_to_kill_token', 'ON_OWNER_FINISH').map(type), ['KillTokens']);
});

test('SP platform retains rank-dependent intervals and separate device HP loss', () => {
  const passive = e.tables.tokens[tokens[1]].talents.flatMap(t => t.candidates);
  assert.equal(bb(passive.find(c => c.prefabKey === '2').blackboard)['default.interval'], 3.5);
  const rank = bb(e.tables.tokenSkills.sktok_ironmn_pile2.levels[9].blackboard);
  assert.equal(rank['s2.interval'], 2); assert.equal(rank['s2.hp_ratio'], .008);
  const bleed = actions('ironmn_pile_bleed', 'ON_BUFF_TRIGGER')[0];
  assert.equal(bleed._targetType, 'BUFF_OWNER'); assert.equal(bleed._damageType, 'PURE');
  assert.equal(bleed._ignoreForSp, true); assert.equal(bleed._skipModifierEvent, true);
  const grant = actions('modify_sp[trigger]', 'ON_BUFF_TRIGGER')[0];
  assert.equal(grant._spString, 'sp'); assert.equal(grant._spMask, 'ALL'); assert.equal(grant._forceFlag, false);
});

test('turret rejects HP damage but distinguishes Artificer-source repair', () => {
  const seq = actions('ironmn_pile3_trait', 'ON_TAKE_DAMAGE');
  assert.deepEqual(seq.map(type), ['CancelModifier', 'AlwaysNext', 'CheckTargetProfession', 'HealViaMaxHpRatio']);
  assert.equal(seq[0]._reason, 'UNHURTABLE');
  assert.equal(seq[2]._targetType, 'MODIFIER_SOURCE'); assert.equal(seq[2]._checkSubProfession, true);
  assert.equal(seq[2]._subProfessions, 'craftsman'); assert.deepEqual(seq[2]._profession, ['SUPPORT']);
  assert.equal(seq[3]._healTarget, 'BUFF_OWNER'); assert.equal(seq[3]._ignoreHealFree, true);
});

test('turret five-SP skill preserves main/splash multipliers and self HP payment', () => {
  const rank = e.tables.tokenSkills.sktok_ironmn_pile3.levels[9];
  assert.equal(rank.skillType, 'AUTO'); assert.equal(rank.spData.spType, 'INCREASE_WHEN_TAKEN_DAMAGE');
  assert.equal(rank.spData.spCost, 5); assert.equal(rank.rangeId, '3-13');
  assert.deepEqual(bb(rank.blackboard), { atk_scale: 3, atk_scale_2: 1.5, hp_ratio: .025 });
  for (const [key, scale] of [['ironmn_pile3_s[main]', 'atk_scale'], ['ironmn_pile3_s[splash]', 'atk_scale_2']]) {
    const a = actions(key, 'ON_BUFF_START')[0];
    assert.equal(a._damageType, 'PHYSICAL'); assert.equal(a._atkScaleVar, scale);
    assert.equal(a._baseOnHostAtk, true); assert.equal(a._forceUseProjectileCachedAtk, false);
  }
  const bleed = actions('ironmn_pile3_bleed', 'ON_BUFF_START')[0];
  assert.equal(bleed._damageType, 'PURE'); assert.equal(bleed._targetType, 'BUFF_OWNER');
});

test('recycling uses owner-finish probability before recharge', () => {
  const seq = actions('ironmn_t_2', 'ON_OWNER_FINISH');
  assert.deepEqual(seq.map(type), ['Dice', 'RechargeToken', 'CreateEffect']);
  assert.equal(seq[0]._probKey, 'prob'); assert.equal(seq[1]._rechargeTiming, 'ON_FINISH');
  const candidates = e.tables.character.talents[1].candidates;
  assert.deepEqual(candidates.map(c => bb(c.blackboard).prob), [.7, .8]);
});

test('owner and device capacity records remain separate, including the E1 discrepancy', () => {
  const owner = e.tables.character.talents[0].candidates;
  assert.deepEqual(owner.map(c => bb(c.blackboard).cnt), [2, 3, 3]);
  assert.ok(owner[1].description.includes('carry 2'));
  for (const token of tokens) {
    const caps = e.tables.tokens[token].talents[1].candidates.map(c => bb(c.blackboard));
    assert.deepEqual(caps, [
      { max_deck_stack_cnt: 2, max_deploy_count: 0 },
      { max_deck_stack_cnt: 2, max_deploy_count: 1 },
      { max_deck_stack_cnt: 3, max_deploy_count: 1 },
    ]);
  }
});

test('owner and all turret facings retain unrounded native hit events', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.equal(m.eventPayloads.Attack[0].time, .4333333373069763);
    assert.equal(m.eventPayloads.Skill_2[0].time, .46666666865348816);
    assert.equal(m.eventPayloads.Skill_3[0].time, .46666666865348816);
    assert.equal(m.eventPayloads.Start[0].time, .1666666716337204);
  }
  for (const token of tokens.slice(0, 2)) assert.deepEqual(Object.keys(e.tokenModels[token]), ['Single']);
  assert.deepEqual(Object.keys(e.tokenModels[tokens[2]]), ['Front', 'Back', 'Down']);
  for (const m of Object.values(e.tokenModels[tokens[2]])) assert.equal(m.eventPayloads.Attack[0].time, .06666667014360428);
  assert.equal(e.models[ID].Back.durations.Die, undefined);
});
