// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-civilight-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4134_cetsyr';
const rows = Object.values({ ...e.characters, ...e.skills, ...e.projectiles })
  .flatMap(rs => rs.flatMap(r => r.components));
const component = id => rows.find(c => c.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.valueStr || v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = (rows, kind) => rows.find(a => a.$type.includes('+' + kind + ','));

test('complete Civilight source graphs retain explicit runtime contracts and fidelity limits', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds,Object.keys(e.tables.skills));
  assert.equal(data.operators[ID].skills.length,3);
  assert.equal(e.runtimeContract.length,5);assert.equal(e.fidelityLimits.length,4);
  assert.deepEqual(e.holdReasons,[]);assert.equal(e.gameplayCorroboration.length,1);
  assert.equal(rows.length, 186); assert.equal(e.source.bundles.length, 5);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(Object.keys(e.templates).length, 12); assert.equal(Object.keys(e.buffDatabase).length, 2);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.equal(Object.keys(e.projectiles).length, 12);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
});
test('all thirty ranks retain permanent automatic S1 and manual S2/S3 source SP and range', () => {
  const [one,two,three] = [1,2,3].map(n => e.tables.skills[`skchr_cetsyr_${n}`].levels);
  for (const levels of [one,two,three]) {
    assert.equal(levels.length, 10);
    for (const l of levels) assert.equal(l.spData.spType, 'INCREASE_WITH_TIME');
  }
  assert.deepEqual(one.map(l => l.spData.spCost), [90,90,90,80,80,80,75,70,68,65]);
  for (const l of one) { assert.equal(l.skillType, 'AUTO'); assert.equal(l.duration, -1); assert.equal(bb(l.blackboard).talent_cool_down, 3); }
  for (const l of two) { assert.equal(l.skillType, 'MANUAL'); assert.equal(l.duration, 35); assert.equal(bb(l.blackboard).extra_cnt, 6); }
  near(bb(two.at(-1).blackboard).atk_scale, 2.75); near(bb(two.at(-1).blackboard).unmoveable_duration, 3.5);
  for (const l of three) {
    assert.equal(l.skillType, 'MANUAL'); assert.equal(l.duration, 30); assert.equal(l.rangeId, 'x-2');
    for (const suffix of ['cal_hp_ratio','collect_hp_ratio']) assert.equal(bb(l.blackboard)[`attack@cetsyr_s_3[${suffix}].interval`], 2);
  }
});
test('original single skeleton aliases both facings without inventing OnAttack events', () => {
  const [front,back] = ['Front','Back'].map(f => e.models[ID][f]);
  assert.equal(front.path, back.path); assert.equal(front.sha256, back.sha256);
  assert.deepEqual(front.hits, {}); assert.deepEqual(front.eventPayloads, {});
  assert.equal(front.durations.Attack, undefined);
  const bindings = e.officialSkeletonBindings[ID];
  assert.equal(bindings.Front.skeletonAnimationPathId, bindings.Back.skeletonAnimationPathId);
  assert.match(bindings.Front.faceSwitcherPathId, /^-?\d+$/);
  const switcher = e.chararts[ID].find(r=>r.pathId===bindings.Front.faceSwitcherPathId).data;
  near(switcher._switchTime, .15); assert.equal(switcher._defaultLOrR,3);
  near(front.durations.Skill_1_Begin, .833); near(front.durations.Skill_2_Begin, 1); near(front.durations.Skill_3_Begin, 1.2);
});
test('four orbital modes preserve all main/graphic/logic variants and original geometry', () => {
  for (const suffix of ['', '_s1', '_s2', '_s3']) for (const role of ['', '_graphic', '_logic']) {
    const name = 'projectile_chr_cetsyr_talent' + suffix + role;
    assert.ok(e.projectileVariants.includes(name));
    const cs = e.projectiles[name].flatMap(r => r.components).map(c => c.data);
    near(cs.find(d => d.m_Radius != null).m_Radius, .4);
    const movement = cs.find(d => d._aroundSpeed != null);
    near(movement._aroundSpeed, suffix === '_s2' ? .01 : 150);
    const projectile = cs.find(d => d._lifeTimeType != null);
    assert.equal(projectile._stopWhenSourceInvalid, 1); assert.equal(projectile._stopAfterFirstHit, 0);
  }
});
test('collision filters retain source-specific recipient marks, raw FP cooldown and persistent S3 distinction', () => {
  for (const suffix of ['', '_s1']) {
    const cs = e.projectiles['projectile_chr_cetsyr_talent'+suffix].flatMap(r => r.components).map(c=>c.data);
    const hit = cs.find(d => d._coolDown);
    assert.equal(hit._coolDown._serializedValue, 8589934592);
    assert.equal(hit._targetOptions.professionMask, 639); assert.equal(hit._targetOptions.ignoreHealFree, 1);
    const filter = cs.find(d => d._filterBuffSource);
    assert.deepEqual(filter._buffs, ['cetsyr_t_1[trait_up]']); assert.equal(filter._excludeKey, 1);
  }
  const s3 = e.projectiles.projectile_chr_cetsyr_talent_s3.flatMap(r=>r.components).map(c=>c.data);
  assert.equal(s3.some(d=>d._coolDown), false);
  // Persistence is an emitter/mode contract, not a fabricated collider flag.
  assert.equal(s3.find(d=>d._hitTargetNoDamage!==undefined)._hitTargetNoDamage, 0);
  assert.equal(s3.find(d=>d._lifeTimeType!==undefined)._stopAfterFirstHit, 0);
});
test('trait regeneration boosts only the same producer mark and restores its multiplier after each receipt', () => {
  const condition = actions('cetsyr_atk_to_hp_recovery','ON_BUFF_TRIGGER')[0];
  assert.equal(condition._conditionNode._checkBuffSource, true);
  assert.equal(condition._conditionNode._buffSourceType, 'BUFF_SOURCE');
  const [up, heal, down] = condition._succeedNodes;
  assert.equal(up._multiplyParamKey, 'trait_mul'); assert.equal(down._dividedParamKey, 'trait_mul');
  assert.equal(heal._getAtkTargetType, 'SOURCE'); assert.match(condition._failNodes[0].$type, /AtkToHpRecovery/);
  const aura = component('9180648869914837210')._buffs[0];
  assert.equal(aura.triggerInterval, 1); assert.equal(aura.waitFirstTriggerInterval, 1);
});
test('S1/S2/S3 mutate the emitter blackboards and preserve skill-finish restoration', () => {
  const s1 = actions('cetsyr_s_1[trigger_talent]','ON_BUFF_START');
  assert.equal(type(s1,'SwitchMode')._modeIndex, 1);
  assert.equal(s1.find(a=>a._blackboardKeys==='cooldown')._fromBlackboardKeys, 'talent_cool_down');
  const s2 = actions('cetsyr_s_2','ON_BUFF_START'), finish = actions('cetsyr_s_2','ON_BUFF_FINISH');
  assert.ok(s2.some(a=>a._blackboardKeys==='final_radius')); assert.ok(s2.some(a=>a._blackboardKeys==='dynamic_spd'));
  assert.equal(finish.find(a=>a._blackboardKeys==='next_projectile_key')._fromBlackboardKeys, 'default_projectile_key');
  assert.equal(type(finish,'SwitchMode')._restartFSM, true);
  const s3 = actions('cetsyr_s_3','ON_BUFF_START'); assert.equal(type(s3,'SwitchMode')._modeIndex,3);
  assert.equal(actions('cetsyr_s_3','ON_BUFF_FINISH').find(a=>a._blackboardKeys==='cnt')._fromBlackboardKeys, 'extra_cnt');
});
test('Sarkaz damage resistance checks the actual modifier source and retains nonstacking one-minus scaling', () => {
  const t = component('3224773207526899930')._buffs[0]; assert.equal(bb(t.blackboard).tag,'sarkaz');
  const [filter,scale] = actions('filtertag[reduce_damage]','ON_TAKE_DAMAGE');
  assert.equal(filter._targetType,'MODIFIER_SOURCE'); assert.equal(scale._isOneMinus,true); assert.equal(scale._isStackable,false);
  const candidates=e.tables.character.talents[1].candidates;
  assert.equal(bb(candidates[0].blackboard).damage_resistance,.1); assert.equal(bb(candidates[1].blackboard).damage_resistance,.15);
});
test('S3 HP redistribution retains weighted collection, modifier-free application, reset and separate raw/table clocks', () => {
  const record=actions('cetsyr_s_3[record_cur_hp_ratio]','ON_BUFF_START');
  assert.deepEqual(record.filter(a=>a.$type.includes('+RecordCurrentHpRatio,')).map(a=>a._recordType),['hp','maxHp']);
  assert.deepEqual(record.filter(a=>a.$type.includes('+AddBuffBlackboard,')).map(a=>a._blackboardKey),['record_cur_hp','record_cur_maxhp']);
  const calculate=actions('cetsyr_s_3[cal_hp_ratio]','ON_BUFF_TRIGGER');
  assert.equal(calculate[0]._inputKey,'record_cur_hp'); assert.equal(calculate[0]._dividedParamKey,'record_cur_maxhp');
  assert.deepEqual(calculate.slice(-3).map(a=>[a._blackboardKey,a._value]),[['record_cur_hp',0],['record_cur_maxhp',0],['hp_ratio',0]]);
  assert.equal(actions('cetsyr_s_3[set_hp_ratio]','ON_BUFF_START')[0]._skipModifierEvent,true);
  const aura=component('-8492696783154872102')._passiveBuffs;
  for(const suffix of ['collect_hp_ratio','cal_hp_ratio']) {
    const raw=aura.find(b=>b.buffKey===`cetsyr_s_3[${suffix}]`);
    assert.equal(raw.triggerInterval,1); assert.equal(raw.waitFirstTriggerInterval,0);
  }
});
test('ATK and max-HP Inspiration preserve source-stat sampling and final-scaler channels', () => {
  for(const[template,stat,key]of [['atk_to_atk[final_addition]','ATK','encourage[atk]'],['hp_to_hp[final_addition]','MAX_HP','encourage[max_hp]']]) {
    const a=actions(template,'ON_BUFF_TRIGGER'); assert.equal(a[0]._sourceType,'BUFF_SOURCE');
    assert.equal(a[0]._sourceAttributeType,stat); assert.equal(a[0]._formulaType,'FINAL_ADDITION');
    assert.equal(a[2]._buff.buffKey,key); assert.equal(a[2]._buff.attributes.attributeModifiers[0].fetchBaseValueFromSourceEntity,true);
    assert.equal(e.buffDatabase[key].priorityBBKeys[0],stat==='ATK'?'atk':'max_hp');
  }
});
