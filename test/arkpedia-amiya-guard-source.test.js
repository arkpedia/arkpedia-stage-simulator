// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-amiya-guard-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_1001_amiya2';
const components = group => Object.values(group).flatMap(rows => rows.flatMap(r => r.components));
const rows = components(e.characters), skillRows = components(e.skills);
const component = id => [...rows, ...skillRows].find(c => c.pathId === id)?.data;
const bb = values => Object.fromEntries(values.map(r => [r.key, r.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function nodes(value, predicate, out = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { nodes(JSON.parse(value), predicate, out); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) out.push(value);
    for (const child of Object.values(value)) nodes(child, predicate, out);
  }
  return out;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);

test('Guard form registers only its complete reviewed two-skill kit', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'amiya-guard'); assert.equal(data.operators[ID].skills.length, 2);
  assert.match(e.reviewStatus, /bounded two-skill combat adapter/); assert.equal(e.runtimeContracts.length, 7);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false); assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.equal(e.source.bundles.length, 5); assert.equal(rows.length + skillRows.length, 81);
});
test('pinned Global patch data preserves identity, class and exact unlock condition', () => {
  assert.equal(e.source.repository, 'Kengxxiao/ArknightsGameData_YoStar');
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.deepEqual(e.source.patchTable, { path: 'en_US/gamedata/excel/char_patch_table.json',
    sha: 'fc84d705f44b9c2e430069c482fbf935a995952e', size: 47115 });
  assert.equal(e.tables.character.name, 'Amiya');
  assert.equal(e.tables.character.profession, 'WARRIOR');
  assert.equal(e.tables.character.subProfessionId, 'artsfghter');
  assert.deepEqual(e.tables.formInfo, { tmplIds: ['char_002_amiya', ID, 'char_1037_amiya3'], default: 'char_002_amiya' });
  assert.deepEqual(e.tables.unlockConds[ID], { conds: [{ stageId: 'main_08-16', completeState: 'PASS', unlockTs: 0 }] });
  assert.equal(e.tables.patchDetailInfoList[ID].infoParam, 'Guard');
});
test('both skills retain ten complete ranks and E1/E2 selected aura values', () => {
  assert.deepEqual(e.tables.character.skills.map(s => s.skillId), ['skchr_amiya2_1', 'skchr_amiya2_2']);
  for (const s of Object.values(e.tables.skills)) {
    assert.equal(s.levels.length, 10);
    assert.ok(s.levels.every(l => l.skillType === 'MANUAL' && l.spData.spType === 'INCREASE_WITH_TIME'));
    assert.ok(s.levels.every(l => bb(l.blackboard).talent_scale === 2));
  }
  assert.deepEqual(e.tables.character.talents[0].candidates.map(c => [c.unlockCondition.phase, bb(c.blackboard)]),
    [['PHASE_1', { atk: .04, def: .04 }], ['PHASE_2', { atk: .07, def: .07 }]]);
});
test('ordinary Arts and subsequent S2 True attacks remain distinct native modes', () => {
  const normal = component('6770483602527127411'), s2 = component('-4708773150343657613');
  assert.equal(normal._damageType, 2); assert.equal(normal._animKey, 'Attack');
  assert.equal(s2._damageType, 3); assert.equal(s2._animKey, 'Skill_2_Attack');
  for (const a of [normal, s2]) { assert.equal(a._waitForAttackEvent, 1); assert.equal(a._maxAnimScale, -1); }
  const animator = e.chararts[ID].find(r => r.data._animations).data;
  assert.equal(animator._animations.find(a => a.animKey === 'Skill_2_Attack').animName, 'Skill_2_Loop');
});
test('S1 uses two original events, double strikes and Arts-only dodge', () => {
  const attack = component('-9209462254262646925');
  assert.equal(attack._additionalTimes, 1); assert.equal(attack._waitAttackEventForAllAttacks, 1);
  assert.equal(attack._damageType, 2); assert.equal(attack._animKey, 'Skill_1');
  const evade = nodes(e.templates.evade_magic, type('Evade'))[0];
  assert.equal(evade._damageMask, 'MAGICAL');
  const buffs = component('4224224645030116021')._buffs;
  assert.equal(buffs[0].templateKey, 'evade_magic');
  assert.deepEqual(bb(buffs[1].blackboard), { mode: 1 });
  const rank = e.tables.skills.skchr_amiya2_1.levels[9];
  assert.equal(bb(rank.blackboard).atk, .8); assert.equal(bb(rank.blackboard).prob, .6);
});
test('S2 once-per-battle limit and target-required selector are preserved separately', () => {
  const s = component('-983358195399657483');
  assert.equal(s._maxTriggerTime, 1); assert.equal(s._limitGlobalTriggerTime, 1);
  assert.equal(s._useTriggerInManualMode, 1); assert.equal(s._allowNoTarget, 0);
  assert.deepEqual(s._extraAbilities.map(a => a.m_PathID), ['-8359318221383927819', '3252258648490506229']);
  const selector = component('1510359335885535221');
  assert.equal(selector._postFilter, 16); assert.equal(selector._maxNum, 1);
  assert.equal(selector._targetMotion, 1);
  assert.match(e.tables.skills.skchr_amiya2_2.levels[9].description, /lowest HP/);
});
test('S2 native event cursor is retained without guessing which ten of eleven payloads are consumed', () => {
  const a = component('-8359318221383927819');
  assert.equal(a._selectTargetTiming, 2); assert.equal(a._timeMode, 1);
  near(a._preDelay, .867); near(a._minPostDelay, .2);
  assert.equal(a._waitAttackEventForAllAttacks, 1);
  assert.equal(a._onlyFeedActiveBuffToLastOne, 1); assert.equal(a._maxAnimScale, 1);
  assert.ok(e.verificationLimits.some(r => /eleven payloads/.test(r)));
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face], events = model.eventPayloads.Skill_2;
    assert.equal(events.length, 11); near(events[0].time, .6); near(events[9].time, 2.333333);
    near(events[10].time, 3.066667); assert.ok(events.every(r => r.name === 'OnAttack'));
  }
});
test('final strike cancels direct damage and emits a separate delayed True-damage receipt', () => {
  const branch = nodes(e.templates['amiya2_s_2[cirtical]'], type('CreateBuff'));
  assert.equal(branch[0]._buff.buffKey, 'amiya2_s_2[delay_attack]');
  near(branch[0]._buff.triggerInterval, .4); assert.equal(branch[0]._buff.waitFirstTriggerInterval, true);
  assert.equal(branch[1]._buff.buffKey, 'amiya2_s_2[cirtical_cancel]');
  assert.equal(nodes(e.templates['amiya2_s_2[cirtical_cancel]'], type('SetAtkScaleZero')).length, 1);
  const actions = e.templates['amiya2_s_2[delay_attack]'].eventToActions.ON_BUFF_TRIGGER;
  assert.equal(actions[0]._buffKey, 'amiya2_s_2[cirtical_cancel]');
  assert.equal(actions[1]._damageType, 'PURE'); assert.equal(actions[1]._atkScaleVar, 'atk_scale_2');
  assert.equal(actions[1]._emitSourceOnCalculateDamage, false);
  assert.equal(actions[1]._applyWay, 'MELEE');
});
test('kill bonus is limited to attack-state kills and removed with skill lifetime', () => {
  const t = e.templates['amiya2_s_2[attack]'];
  assert.deepEqual(Object.keys(t.eventToActions), ['ON_TARGET_KILLED', 'ON_BUFF_FINISH']);
  const create = t.eventToActions.ON_TARGET_KILLED[0]._buff;
  assert.equal(create.buffKey, 'amiya2_s_2[kill]'); assert.equal(create.overrideType, 'STACK');
  assert.equal(create.stripBlackboardParamsWithBuffKey, true);
  const bb3 = bb(e.tables.skills.skchr_amiya2_2.levels[9].blackboard);
  assert.equal(bb3.times, 10); assert.equal(bb3['amiya2_s_2[kill].max_stack_cnt'], 3);
  assert.equal(bb3['amiya2_s_2[kill].atk'], .4); assert.equal(bb3['amiya2_s_2[kill].magic_resistance'], 20);
  assert.equal(t.eventToActions.ON_BUFF_FINISH[1]._abilityName, 'SkillEnd');
  assert.equal(e.templates.amiya2_s_2.eventToActions.ON_BUFF_FINISH[0]._buffKey, 'amiya2_s_2[kill]');
});
test('both original facing chains retain normal, S1, S2 and end events byte identities', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face], b = e.officialSkeletonBindings[ID][face];
    assert.equal(m.sha256, b.sha256); assert.equal(m.bytes, b.byteLength);
    near(m.eventPayloads.Attack[0].time, .566667);
    assert.equal(m.eventPayloads.Skill_1.length, 2);
    near(m.eventPayloads.Skill_1[0].time, .366667); near(m.eventPayloads.Skill_1[1].time, .733333);
    near(m.eventPayloads.Skill_2_Loop[0].time, .433333); near(m.durations.Skill_2_End, .2);
    assert.ok(e.chararts[ID].some(r => r.pathId === b.faceSwitcherPathId));
  }
});
