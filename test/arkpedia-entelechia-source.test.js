// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-entelechia-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4010_etlchi', CANDLE = 'enemy_5601_entlec';
const rows = (group, key) => e[group][key].flatMap(o => o.components.map(c => c.data));
const component = (group, key, id) => e[group][key].flatMap(o => o.components).find(c => c.pathId === id)?.data;
const actions = (key, event) => e.templates[key].eventToActions[event];
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));

test('Entelechia source foundation keeps all30 ranks without claiming playable kit coverage', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.runtimeMapping, {});
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false); assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.tables.skills).length, 3);
  for (const skill of Object.values(e.tables.skills)) assert.equal(skill.levels.length, 10);
  assert.equal(Object.keys(e.templates).length, 26); assert.equal(Object.keys(e.originalTemplates).length, 25);
  assert.ok(e.verificationLimits.some(s => s.includes('not runtime combat verification')));
});

test('S1 has two zero-gap strikes from one native event, not two fabricated animation hits', () => {
  const attack = rows('skills', 'skchr_etlchi_1').find(d => d._animKey);
  assert.equal(attack._animKey, 'Skill_1'); assert.equal(attack._additionalTimes, 1);
  assert.equal(attack._triggerDelta, 0); assert.equal(attack._waitAttackEventForAllAttacks, 0);
  assert.equal(attack._splitDamage, 0); assert.equal(attack._selectTargetTiming, 1);
  assert.equal(attack._refreshInputTargetOnCheckSpell, 0);
  for (const face of ['Front', 'Back']) assert.deepEqual(e.models[ID][face].hits.Skill_1, [.4]);
  assert.equal(bb(e.tables.skills.skchr_etlchi_1.levels.at(-1).blackboard).atk_scale, 1.75);
});

test('trait excludes BUFF damage and retains native block-capped heal queue', () => {
  const output = actions('etlchi_trait', 'ON_OUTPUT_DAMAGE');
  assert.equal(output[0]._attackTypeFilter, 'BUFF'); assert.ok(output[1].$type.includes('IfNot'));
  assert.equal(output[2]._buff.lifeTime, 0.05000000074505806);
  assert.equal(output[2]._buff.triggerInterval, 0.0010000000474974513);
  const queue = actions('etlchi_trait[heal_fake]', 'ON_BUFF_TRIGGER')[0]._buff;
  assert.ok(actions('etlchi_trait[heal_fake]', 'ON_BUFF_START')[0].$type.includes('SetStackCountViaBlockNum'));
  assert.equal(queue.triggerInterval, 0.11999999731779099); assert.equal(queue.maxStackCnt, -1);
  assert.equal(queue.waitFirstTriggerInterval, false);
  const heal = actions('etlchi_trait[heal]', 'ON_BUFF_TRIGGER').find(a => a.$type.includes('FixedValueHeal'));
  assert.equal(heal._ignoreHealFree, true);
});

test('HP stealing preserves victim cleanup and persistent owner gain; DoT extends per source', () => {
  const steal = rows('characters', ID).find(d => d._stealOnceBBKey);
  assert.equal(steal._attributeType, 0); assert.equal(steal._formulaType, 2);
  assert.equal(steal._finishTargetBuffWhenInvalid, 1); assert.equal(steal._finishOwnerBuffWhenTargetInvalid, 0);
  const filter = actions('etlchi_t_1[steal]', 'ON_BEFORE_TARGET_APPLY_MODIFIER');
  assert.ok(filter.some(a => a._buffKeys?.includes('enemy_entlec_self_mark')));
  assert.ok(filter.some(a => a.$type.includes('IsPropLikeEnemy')));
  const dot = actions('etlchi_t_1[magic_dot]', 'ON_OUTPUT_MODIFIER').find(a => a._buff)?._buff;
  assert.equal(dot.overrideType, 'EXTEND'); assert.equal(dot.independentCharacterSource, true);
  assert.equal(dot.triggerInterval, 1); assert.equal(dot.durationKey, 'dot_duration');
  assert.equal(actions('etlchi_t_1[magic_dot_core]', 'ON_BUFF_TRIGGER')[1]._attackType, 'BUFF');
});

test('emergency heal is a once-only HP checker and physical resistance, not a permanent resurrection', () => {
  const checker = component('characters', ID, '-4989206303276204082');
  assert.equal(checker._toggleOnce, 1); assert.equal(checker._restoreDelay, 0);
  const talents = e.tables.character.talents[1].candidates.map(t => bb(t.blackboard));
  assert.ok(talents.every(t => t.hp_ratio === .25));
  assert.deepEqual(talents.map(t => t.damage_resistance), [.1, .15]);
  assert.deepEqual(talents.map(t => t['etlchi_t_2[heal].hp_ratio']), [.5, .55]);
  const resistance = actions('etlchi_t_2[resistance]', 'ON_TAKE_DAMAGE')[0];
  assert.equal(resistance._damageMask, 'PHYSICAL'); assert.equal(resistance._isOneMinus, true);
  assert.equal(resistance._isStackable, false);
});

test('S2 retains carrier selection, disarm and source x-4 AoE instead of generic melee splash', () => {
  const carrier = rows('skills', 'skchr_etlchi_2').find(d => d._postFilter === 34);
  assert.equal(carrier._targetSide, 1); assert.equal(carrier._targetMotion, 1);
  assert.equal(carrier._excludeOwner, 1); assert.equal(carrier._limitTargetNum, 1);
  const self = rows('skills', 'skchr_etlchi_2').find(d => d._buffs?.some(b => b.buffKey === 'etlchi_s_2[aoe]'));
  const aura = self._buffs.find(b => b.buffKey === 'etlchi_s_2[aoe]');
  assert.deepEqual(aura.attributes.abnormalFlags, [18]);
  assert.equal(aura.blackboard.find(b => b.key === 'range').valueStr, 'x-4');
  const aoe = actions('etlchi_s_2', 'ON_BUFF_TRIGGER')[0]._succeedNodes[0];
  assert.equal(aoe._rangeId, 'x-4'); assert.equal(aoe._useRadius, false);
  assert.equal(aoe._targetOptions.targetMotion, 'WALK_ONLY'); assert.equal(aoe._attackType, 'NORMAL');
  assert.ok(actions('etlchi_s_2[aura]', 'ON_BUFF_DISABLE').every(a => a._checkBuffSource));
});

test('S3 preserves current-HP copy, native host cleanup and non-scoring candle placement', () => {
  const rank = bb(e.tables.skills.skchr_etlchi_3.levels.at(-1).blackboard);
  assert.equal(rank['attack@max_target'], 3); assert.equal(rank['attack@max_hp_scale'], .6);
  const create = actions('etlchi_s3[to_enemy]', 'ON_BUFF_START')[0];
  assert.equal(create._enemyKey, CANDLE); assert.equal(create._unharmful, true);
  assert.equal(create._alwaysCountAsKilled, false); assert.equal(create._waitTime, 99999);
  assert.equal(create._selectTheNearestTileToSource, true); assert.equal(create._meanwhileNearestTileToTarget, true);
  const copy = actions('entlec_a[update_attributes]', 'ON_BUFF_START')[0]._succeedNodes
    .find(a => a._attributeType === 'MAX_HP' && a.$type.includes('AssignHostAttributeToBB'));
  assert.equal(copy._setCurrentHp, true); assert.equal(copy._scaleVar, 'max_hp_scale');
  assert.ok(actions('entlec_a[life_kill_listener]', 'ON_OWNER_FINISH')[0].$type.includes('InstantKill'));
  assert.ok(actions('stlchi_s3[skill_end_kill_entlec]', 'ON_BUFF_START')[0].$type.includes('InstantKill'));
});

test('Heart Candle accepts the Entelechia source mark, not only its summoner; minimum excludes DoT', () => {
  const restrict = actions('entlec_a[damage_etlchi_only]', 'ON_TAKE_DAMAGE');
  assert.deepEqual(restrict[0]._buffKeys, ['char_etlchi_self_mark']); assert.equal(restrict[0]._checkBuffSource, false);
  assert.equal(restrict[2]._reason, 'UNHURTABLE');
  const floor = actions('entlec_t[ensure_dmg]', 'ON_BEFORE_APPLYING_MODIFIER');
  assert.equal(floor[1]._attackTypeFilter, 'BUFF'); assert.ok(floor[2].$type.includes('IfNot'));
  assert.equal(e.tables.enemies[CANDLE][0].enemyData.talentBlackboard[0].value, .35);
  const forwarded = actions('entlec_a[damage]', 'ON_BUFF_START')[0];
  assert.equal(forwarded._damageType, 'PURE'); assert.equal(forwarded._ignoreForSp, true);
  assert.equal(forwarded._isNotChangeableValue, true);
  assert.equal(actions('entlec_a[ignore_buffs]', 'ON_OTHER_BUFF_START')[1]._buffKey, 'ironmn_pile3_t_2');
});

test('Heart Candle has original EmptyAnimator and explicit table/native visual difference', () => {
  const root = rows('enemies', CANDLE).find(d => d._canNotExit != null);
  assert.equal(root._canNotExit, 1); assert.equal(root._blockVolume, 0);
  assert.ok(e.enemies[CANDLE].some(o => o.object === 'EmptyAnimator'));
  assert.equal(e.models[CANDLE], undefined); assert.equal(e.officialSkeletonBindings[CANDLE], undefined);
  assert.deepEqual(e.nativeTemplateGaps, ['entlec_a[line_effect_core]']);
  assert.ok(e.templates['entlec_a[line_effect_core]']); assert.equal(e.originalTemplates['entlec_a[line_effect_core]'], undefined);
  const line = e.originalTemplates['entlec_a[line_effect]'].eventToActions._items[0].value;
  assert.equal(line.SerializedState, '[]');
});

test('both operator facings bind exact native skeleton bytes; no rounded pointers or invalid floats', () => {
  for (const face of ['Front', 'Back']) assert.equal(e.models[ID][face].sha256, e.officialSkeletonBindings[ID][face].sha256);
  for (const source of e.source.bundles) assert.match(source.sha256, /^[a-f0-9]{64}$/);
  const walk = (v, key = '') => {
    if (key === 'm_PathID') assert.equal(typeof v, 'string');
    if (typeof v === 'number') assert.ok(Number.isFinite(v));
    else if (Array.isArray(v)) v.forEach(x => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(e);
});
