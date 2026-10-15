// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4166_varkis.json' with { type: 'json' };
import { VARKIS_ID as ID, VARKIS_SKILLS as SKILLS, selectedVarkisBuild as select, varkisNativeInputs }
  from '../server/sim/content/arkpedia-varkis-source.js';
import { near } from './helpers/mon3tr-fixture.js';
const build = (elite = 2, skill = 0, rank = [4,7,10][elite], potential = 1, trust = 0) => ({
  elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
  skillId: SKILLS[skill], skillRank: rank, module: 'none',
});
test('Varkáris receipt retains original bytes and does not itself grant public admission', async () => {
  const raw = await readFile(new URL('../data/arkpedia-native-operators/char_4166_varkis.json', import.meta.url));
  assert.equal(raw.length, 248827);
  assert.equal(createHash('sha256').update(raw).digest('hex'), '2726cf348a031ad5330fe733096a604c3109f9558a38896031870a003ccc9574');
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(e.source.nativeClient, '26-09-22-07-47-20_6c71fa');
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const key of ['frameParity','moduleSupport','nativeParticleSupport']) assert.equal(e[key], false);
  assert.deepEqual(e.nativeTemplateGaps, []); assert.deepEqual(e.jsonTemplateGaps, []);
  assert.equal(e.source.bundles.length, 5); assert.equal(Object.keys(e.templates).length, 8);
  assert.deepEqual(e.projectiles, {}); assert.deepEqual(Object.keys(e.models), [ID]);
});
for (const elite of [0,1,2]) for (const potential of [1,6]) test(`Varkáris E${elite}/P${potential} selects trust, stats, costs and the correct Minos talent`, () => {
  const r = select(build(elite,0,[4,7,10][elite],potential,200));
  near(r.stats.maxHp, [1533,1966,2622][elite] + 150);
  near(r.stats.atk, [426,577,760][elite] + 50);
  near(r.stats.def, [202,273,333][elite]); near(r.stats.baseAttackTime, 1.2);
  near(r.stats.cost, [21,23,25][elite] - (potential === 6 ? 3 : 0));
  near(r.stats.respawnTime, potential === 6 ? 70 : 80); near(r.stats.blockCnt, elite === 2 ? 3 : 2);
  assert.ok(r.tags.includes('minos'));
  if (elite === 0) assert.deepEqual(r.talentBb, []);
  else near(r.talentBb[0].talent_atk_scale, (elite === 1 ? 1.07 : 1.10) + (potential === 6 ? .02 : 0));
});
for (let rank=1;rank<=10;rank++) test(`Varkáris rank ${rank} preserves offensive three-hit S1 and timed S2 resource inputs`, () => {
  const a=select(build(2,0,rank)), b=select(build(2,1,rank));
  assert.equal(a.source.skillType,'AUTO'); assert.equal(a.source.spData.spType,'INCREASE_WHEN_ATTACK');
  near(a.source.spData.spCost,[6,6,6,5,5,5,4,4,4,4][rank-1]); near(a.source.duration,0);
  near(a.bb.atk_scale,[1,1.05,1.1,1.1,1.15,1.2,1.2,1.25,1.3,1.35][rank-1]);
  assert.equal(b.source.skillType,'MANUAL'); assert.equal(b.source.spData.spType,'INCREASE_WITH_TIME');
  near(b.source.spData.spCost,[55,54,53,52,51,50,48,47,46,45][rank-1]);
  near(b.source.spData.initSp,[25,25,25,25,25,25,25,26,28,30][rank-1]); near(b.source.duration,30);
  near(b.bb['attack@s2_atk_scale'],[1.35,1.4,1.45,1.55,1.6,1.65,1.75,1.85,1.9,2][rank-1]);
  near(b.bb['attack@hp_ratio'],[.05,.05,.05,.06,.06,.06,.07,.07,.07,.08][rank-1]);
  near(b.bb.max_hp_ratio,1); near(b.bb.dynamic_dec_per_sec,100);
  assert.deepEqual(a.rangeGrid,b.rangeGrid); assert.deepEqual(b.skillRangeGrid,[]);
});
test('invalid, locked and module-bearing selections fail before combat setup', () => {
  for (const patch of [{elite:-1},{elite:3},{level:0},{level:81},{potential:0},{potential:7},{trust:-1},{trust:201},
    {skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},{module:''},{module:false},
    {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},
    {elite:0,level:50,skillRank:4,skillId:SKILLS[1]}]) assert.throws(()=>select({...build(),...patch}));
});
test('native attacks cap at block count and S1 keeps three distinct literal release events', () => {
  const n=varkisNativeInputs();
  for(const [attack,clip] of [[n.ordinary,'Attack'],[n.modeAttack,'Skill_2_Loop'],[n.burst,'Skill']]) {
    assert.equal(attack._animKey,clip); assert.equal(attack._waitForAttackEvent,1);
    assert.equal(attack._selectTargetTiming,0); assert.equal(attack._timeMode,0); assert.equal(attack._maxAnimScale,1);
  }
  for(const selector of [n.ordinarySelector,n.modeSelector,n.burstSelector]) {
    assert.equal(selector._targetMotion,1); assert.equal(selector._limitedMaxTargetNumToBlockedCnt,1);
    assert.equal(selector._allowZeroBlockCntLimit,0);
  }
  assert.equal(n.burst._additionalTimes,2); assert.equal(n.burst._waitAttackEventForAllAttacks,1);
  assert.equal(n.burst._refreshInputTargetOnCheckSpell,0); assert.equal(n.s1._recoverSpIfTargetDead,1);
  for(const face of ['Front','Back']) {
    const m=e.models[ID][face]; near(m.eventPayloads.Attack[0].time,.5666666626930237);
    assert.deepEqual(m.eventPayloads.Skill.map(x=>x.time),[.46666666865348816,.5,.5333333611488342]);
    near(m.eventPayloads.Skill_2_Loop[0].time,.5666666626930237);
  }
  assert.ok(e.models[ID].Front.durations.Attack_Down); assert.equal(e.models[ID].Back.durations.Attack_Down,undefined);
});
test('native Minos aura compares its receiving ally HP ratio, not the aura owner HP ratio', () => {
  const n=varkisNativeInputs(), actions=n.templates['varkis_t1[minos_atk_up]'].eventToActions.ON_CALCULATE_DAMAGE;
  assert.deepEqual(n.talentValidator._tags,['minos']); assert.equal(n.talent._removeBuffWhenAbilityDetached,1);
  assert.equal(actions[0]._targetType,'TARGET'); assert.equal(actions[1]._targetType,'BUFF_OWNER');
  assert.equal(actions[2]._condType,'GE'); assert.equal(actions[3]._atkScaleKey,'talent_atk_scale');
  assert.equal(actions[3]._filterApplyWay,false); assert.equal(actions[3]._overwriteAtkScale,false);
});
test('S2 native heal, overheal barrier, retained core and one-second decay remain separate from attack hit count', () => {
  const n=varkisNativeInputs(), t=n.templates;
  const h=t['varkis_s2[attack_add_hp]'].eventToActions.ON_BUFF_START[0];
  assert.equal(h._healTarget,'BUFF_OWNER'); assert.equal(h._ignoreHealFree,false); assert.equal(h._skipModifierEvent,false);
  assert.equal(n.attackHeal._maxTarget,1); assert.equal(n.attackHeal._onlyRunOnce,0);
  const shield=n.s2Passive._buffs.find(b=>b.buffKey==='varkis_s2[shield]');
  near(shield.triggerInterval,1); assert.equal(shield.waitFirstTriggerInterval,1);
  const s=t[shield.templateKey].eventToActions;
  assert.equal(s.ON_APPLYING_MODIFIER[0]._checkCurModeIndex,1);
  assert.equal(s.ON_APPLYING_MODIFIER[2]._sharedFlagIndex,'HEAL_CAN_GENERAL_SHIELD');
  const core=s.ON_BUFF_START.find(a=>a._buff?.buffKey==='varkis_s2[shield_core]');
  assert.equal(core._isDerivedBuff,false); assert.equal(core._finishDerivedBuffIfParentFinish,false);
  const decay=s.ON_BUFF_TRIGGER.find(a=>a._minusParamKey==='dynamic_dec_per_sec');
  assert.equal(decay._minValueKey,'min_shield_value');
  const block=t['varkis_s2[shield_core]'].eventToActions.ON_TAKE_DAMAGE[0];
  assert.equal(block._filterDamageType,false); assert.equal(block._useDynamicVar,true);
  assert.equal(block._allowNegativeDynamicVar,false);
});
test('S2 original Begin and explicit End mixes do not imply a compiled FSM timing proof', () => {
  const n=varkisNativeInputs(); assert.equal(n.s2._playSkillBeginAnim,1); assert.equal(n.s2._beginAnim,'Skill_2_Begin');
  assert.equal(n.s2._allowSpRecoveryWhenAffecting,0); assert.equal(n.s2._attackBlackboardModeIndex,1);
  assert.deepEqual(n.mixes.map(m=>[m.sourceAnimName,m.targetAnimName,m.mixAnimName]),[
    ['Skill_2_Idle','Idle','Skill_2_End'],['Skill_2_Loop','Idle','Skill_2_End']]);
  assert.equal(e.frameParity,false); assert.match(e.reviewStatus,/^Held original CN source/);
});
