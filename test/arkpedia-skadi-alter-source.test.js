// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-skadi-alter-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_1012_skadi2';
const TOKEN = 'token_10017_skadi2_dedant';
const components = group => Object.values(group).flatMap(rs => rs.flatMap(r => r.components.map(c => c.data)));
const rows = components({ ...e.characters, ...e.skills, ...e.tokens });
const buffs = group => components(group).flatMap(d => [...(Array.isArray(d._buffs) ? d._buffs : []), ...(d._passiveBuffs ?? [])]);
const skillBuff = (key, name) => buffs({ [key]: e.skills[key] }).find(b => b.buffKey === name);
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Skadi audit includes every owner and Seaborn skill without counting source records as playable', () => {
  assert.deepEqual(e.enabledOperators, []);
  assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined);
  assert.equal(data.operators[ID], undefined);
  assert.equal(rows.length, 218);
  assert.equal(e.source.bundles.length, 6);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(Object.keys(e.templates).length, 17);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase), ['encourage[atk]', 'encourage[def]']);
  assert.equal(e.frameParity, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.moduleSupport, false);
  assert.ok(e.holdReasons.some(r => /mitigation, recursion suppression/.test(r)));
  assert.deepEqual(Object.keys(e.skills), [...Object.keys(e.tables.skills), ...Object.keys(e.tables.tokenSkills)]);
});

test('all 30 owner and 30 token ranks retain separate SP, duration and selected effect values', () => {
  const owner = Object.values(e.tables.skills);
  const token = Object.values(e.tables.tokenSkills);
  assert.ok([...owner, ...token].every(s => s.levels.length === 10));
  assert.deepEqual(owner.map(s => s.levels.at(-1).skillType), ['MANUAL', 'AUTO', 'MANUAL']);
  assert.deepEqual(owner.map(s => s.levels.at(-1).spData.spCost), [50, 56, 35]);
  assert.deepEqual(owner.map(s => s.levels.at(-1).spData.initSp), [30, 0, 15]);
  assert.deepEqual(owner.map(s => s.levels.at(-1).duration), [30, -1, 20]);
  const one = bb(owner[0].levels.at(-1).blackboard);
  near(one.max_hp, 1.7);
  near(one['attack@atk_to_hp_recovery_ratio'], .8);
  near(one.damage_resistance, .5);
  const two = bb(owner[1].levels.at(-1).blackboard);
  near(two.atk, .6); near(two.def, .6);
  near(two['attack@atk_to_hp_recovery_ratio'], .2);
  const three = bb(owner[2].levels.at(-1).blackboard);
  near(three.atk_scale, .7); near(three.atk, 1.1); near(three.hp_ratio, .05);
});

test('S1 retains full-heal startup, scaled MaxHP and ordered nonstack damage sharing', () => {
  const startup = skillBuff('skchr_skadi2_1', 'skadi2_s_1');
  assert.deepEqual(bb(startup.blackboard), { hp_ratio: 1, mode: 1 });
  assert.deepEqual(startup.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem, m.loadFromBlackboard]), [[0, 1, 1]]);
  const actions = e.templates.skadi2_s_1.eventToActions.ON_BUFF_START;
  assert.match(actions[0].$type, /Nodes\+SwitchMode,/);
  assert.match(actions[1].$type, /Nodes\+HealViaMaxHpRatio,/);
  assert.equal(actions[1]._ignoreHealFree, true);
  assert.equal(actions[1]._skipModifierEvent, false);
  const protect = e.templates['skadi2_s_1[protect]'];
  assert.equal(protect.onEventPriority, 'LOWER_PRIORITY');
  assert.match(protect.eventToActions.ON_TAKE_DAMAGE[0].$type, /Nodes\+DamageSplit,/);
  assert.equal(protect.eventToActions.ON_TAKE_DAMAGE[0]._targetType, 'BUFF_SOURCE');
  assert.equal(protect.eventToActions.ON_TAKE_DAMAGE[0]._attackType, 'NORMAL');
  assert.match(protect.eventToActions.ON_TAKE_DAMAGE[1].$type, /Nodes\+DamageScale,/);
  assert.equal(protect.eventToActions.ON_TAKE_DAMAGE[1]._isOneMinus, true);
  assert.equal(protect.eventToActions.ON_TAKE_DAMAGE[1]._isStackable, false);
  assert.deepEqual(skillBuff('skchr_skadi2_1', 'skadi2_s_1[protect]').priorityBBKeys, ['damage_resistance']);
  assert.deepEqual(skillBuff('sktok_skadi2_1', 'skadi2_s_1[protect]').priorityBBKeys, []);
});

test('healing uses source ATK and immediate one-second clocks with explicit target exceptions', () => {
  const ratio = e.tables.character.trait.candidates[0].blackboard;
  near(bb(ratio)['attack@atk_to_hp_recovery_ratio'], .1);
  const healing = buffs({ ...e.characters, ...e.tokens }).filter(b => b.buffKey === 'skadi2_heal');
  assert.equal(healing.length, 6);
  for (const b of healing) {
    assert.equal(b.triggerInterval, 1);
    assert.equal(b.waitFirstTriggerInterval, 0);
    assert.equal(b.independentCharacterSource, 1);
    assert.equal(b.isStunnable, 0);
  }
  const action = e.templates.atk_to_hp_recovery.eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(action._getAtkTargetType, 'SOURCE');
  assert.equal(action._getAtkFromTarget, false);
  for (const group of [e.characters, e.tokens]) {
    const all = components(group);
    for (const aura of all.filter(d => Array.isArray(d._buffs) && d._buffs.some(b => b.buffKey === 'skadi2_heal'))) {
      const validator = all.find(d => d.m_GameObject.m_PathID === aura.m_GameObject.m_PathID && d._targetOptions);
      assert.equal(validator._targetOptions.ignoreHealFree, 1);
      assert.equal(validator._targetOptions.ignoreTargetFree, 1);
      assert.equal(aura._removeBuffWhenTargetLeave, 1);
    }
  }
});

test('Inspiration preserves immediate clocks, immune recipients and native final-scaler ownership', () => {
  for (const prefix of ['skchr', 'sktok']) {
    for (const [skill, stats] of [[2, ['atk', 'def']], [3, ['atk']]]) {
      const key = `${prefix}_skadi2_${skill}`;
      for (const stat of stats) {
        const buff = skillBuff(key, `skadi2_s_${skill}[${stat}]`);
        assert.equal(buff.triggerInterval, 1);
        assert.equal(buff.waitFirstTriggerInterval, 0);
        assert.equal(buff.disableOverride, 1);
      }
      const validator = components({ [key]: e.skills[key] }).find(d => d._excludeKey === 1 && d._buffs?.includes('immune_to_encourage'));
      assert.ok(validator);
      assert.equal(validator._targetOptions.ignoreAllyTargetFree, 1);
    }
  }
  for (const stat of ['atk', 'def']) {
    const actions = e.templates[`${stat}_to_${stat}[final_addition]`].eventToActions.ON_BUFF_TRIGGER;
    assert.equal(actions[0]._sourceType, 'BUFF_SOURCE');
    assert.equal(actions[0]._formulaType, 'FINAL_ADDITION');
    assert.match(actions[1].$type, /Nodes\+FinishDerivedBuff,/);
    assert.equal(actions[2]._buff.attributes.attributeModifiers[0].formulaItem, 'FINAL_SCALER');
    assert.equal(actions[2]._buff.attributes.attributeModifiers[0].fetchBaseValueFromSourceEntity, true);
  }
});

test('S3 preserves different owner, Seaborn and bleeding first-trigger delays', () => {
  const owner = skillBuff('skchr_skadi2_3', 'skadi2_s_3[damage]');
  const token = skillBuff('sktok_skadi2_3', 'skadi2_s_3[damage]');
  const bleeding = skillBuff('skchr_skadi2_3', 'skadi2_s_3[bleeding]');
  for (const b of [owner, token, bleeding]) {
    assert.equal(b.triggerInterval, 1);
    assert.equal(b.waitFirstTriggerInterval, 1);
  }
  near(owner.firstTriggerInterval, .9);
  near(token.firstTriggerInterval, .85);
  near(bleeding.firstTriggerInterval, .95);
  const damage = e.templates['skadi2_s_3[damage]'].eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(damage._damageType, 'PURE');
  assert.equal(damage._atkScaleVar, 'atk_scale');
  assert.equal(damage._skipModifierEvent, false);
  const loss = e.templates['periodic_damage_by_hp_ratio[skip_modifier]'].eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(loss._skipModifierEvent, true);
  assert.equal(loss._ignoreForSp, true);
  assert.equal(loss._isUndeadable, false);
});

test('Seaborn hidden skill wrappers and token synchronization remain separate from lifetime', () => {
  const actions = e.templates['skadi2_s[trigger_token]'].eventToActions;
  assert.match(actions.ON_BUFF_START[0].$type, /Nodes\+TriggerAbility,/);
  assert.equal(actions.ON_BUFF_START[0]._abilityName, 'Skill');
  assert.equal(actions.ON_BUFF_START[0]._checkCanUseAblityFlag, false);
  assert.match(actions.ON_BUFF_FINISH[0].$type, /Nodes\+InterruptTokenSkill,/);
  for (let i = 1; i <= 3; i++) {
    const cs = components({ token: e.skills[`sktok_skadi2_${i}`] });
    assert.equal(cs.find(d => '_hidden' in d)._hidden, 1);
    assert.equal(cs.find(d => '_wrappedAbilities' in d)._isInfinity, 1);
  }
  const root = rows.find(d => d._category === 2 && d._occupiedRemainingCharacterCnt === 0);
  assert.equal(root._buildCondition.buildableType, 3);
  assert.equal(root._buildCondition.needSpecifyDirection, 0);
  assert.equal(root._buildCondition.isTryingOverlapCharacater, 0);
  const phases = e.tables.tokens[TOKEN].phases;
  for (const p of phases) {
    assert.equal(p.attributesKeyFrames.at(-1).data.cost, 5);
    assert.equal(p.attributesKeyFrames.at(-1).data.respawnTime, 30);
    assert.equal(p.attributesKeyFrames.at(-1).data.maxDeployCount, 1);
  }
  assert.deepEqual(e.tables.tokens[TOKEN].talents[0].candidates.map(c => bb(c.blackboard).duration), [15, 25]);
  const recharge = e.templates['charge_token[finish]'].eventToActions.ON_OWNER_FINISH[0];
  assert.equal(recharge._rechargeTiming, 'ON_FINISH');
  assert.equal(recharge._refreshRemainingCnt, false);
});

test('Predatory Habits retains Abyssal override, mark exclusions and selected potential bonuses', () => {
  const candidates = e.tables.character.talents[1].candidates;
  assert.deepEqual(candidates.map(c => c.requiredPotentialRank), [0, 4]);
  assert.deepEqual(candidates.map(c => Object.values(bb(c.blackboard))), [[.06, .15], [.09, .18]]);
  const choose = e.templates.skadi2_t_2.eventToActions.ON_BUFF_START[0];
  assert.equal(choose._conditionNode._groupTag, 'abyssal');
  assert.equal(choose._conditionNode._targetType, 'BUFF_OWNER');
  for (const branch of [choose._succeedNodes, choose._failNodes]) {
    assert.equal(branch[0]._buff.overrideKey, 'skadi2_t_2[atk]');
    assert.equal(branch[0]._buff.maxStackCnt, 1);
    assert.equal(branch[0]._buff.isSilenceable, false);
  }
  const all = rows.filter(d => Array.isArray(d._buffs) && d._buffs.some(b => b === 'skadi2_c[mark]'));
  assert.equal(all.length, 1);
  for (const validator of all) assert.equal(validator._excludeKey, 1);
  const ownerAura = components(e.characters).find(d => Array.isArray(d._buffs) && d._buffs.some(b => b.buffKey === 'skadi2_t_2'));
  assert.equal(ownerAura._selfOption, 2);
  const ownerValidator = e.characters[ID].flatMap(r => r.components).find(c => c.pathId === ownerAura._targetValidator.m_PathID).data;
  assert.equal(ownerValidator._targetOptions.professionMask, 639);
});

test('native Skadi and Seaborn clips are preserved without inventing attack or death clips', () => {
  assert.equal(e.models[ID].Front.sha256, e.models[ID].Back.sha256);
  assert.equal(e.models[TOKEN].Front.sha256, e.models[TOKEN].Back.sha256);
  for (const face of ['Front', 'Back']) {
    const owner = e.models[ID][face];
    const token = e.models[TOKEN][face];
    assert.deepEqual(owner.hits, {});
    assert.equal(owner.durations.Skill_1_Begin, 3.2);
    assert.equal(owner.durations.Skill_2_Begin, 3.933);
    assert.equal(owner.durations.Skill_3_Begin, 4.4);
    assert.equal(owner.durations.Attack, undefined);
    assert.equal(token.durations.Die, undefined);
    assert.deepEqual(token.hits.Skill, [.333]);
    assert.deepEqual(token.animationRoles, { idle: 'Idle', deploy: 'Start', die: 'Idle', attack: null });
    assert.notEqual(token.originalPathIds.alphaTexturePathId, '0');
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, owner.sha256);
    assert.equal(e.officialSkeletonBindings[TOKEN][face].sha256, token.sha256);
  }
});
