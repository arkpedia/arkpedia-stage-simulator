// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-vigil-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { REGULAR_SUMMONS } from '../shared/arkpedia/summons.js';

const ID = 'char_427_vigil', TOKEN = 'token_10028_vigil_wolf';
const bb = xs => Object.fromEntries(xs.map(x => [x.key, x.value]));
const rows = group => Object.values(e[group]).flatMap(rs => rs.flatMap(r => r.components));
const component = (group, id) => rows(group).find(c => c.pathId === id).data;
function nodes(value, predicate, out = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { nodes(JSON.parse(value), predicate, out); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) out.push(value);
    for (const v of Object.values(value)) nodes(v, predicate, out);
  }
  return out;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);
const template = key => e.templates[key];
const token = e.tables.tokens[TOKEN];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('complete Vigil source registers all three skills and original Wolfpack with explicit dispatcher limits', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ['skchr_vigil_1','skchr_vigil_2','skchr_vigil_3']); assert.equal(REGULAR_SUMMONS[ID].tokenId,TOKEN);
  assert.equal(data.operators[ID].skills.length,3); assert.equal(data.tokens[TOKEN].skills.length,3);
  assert.equal(e.runtimeContracts.length,7); assert.deepEqual(e.holdReasons,[]);
  assert.ok(e.historicalHoldReasons.some(r => /runActionOnEvent 2/.test(r)));
  assert.ok(e.historicalHoldReasons.some(r => /waitAttackEventForAllAttacks 0/.test(r)));
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  assert.equal(e.source.bundles.length, 6); assert.equal(rows('characters').length + rows('tokens').length
    + rows('skills').length + rows('projectiles').length, 184);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.equal(Object.keys(e.templates).length, 30);
});

test('all owner ranks and only the real token ranks are retained', () => {
  assert.deepEqual(Object.keys(e.tables.skills), ['skchr_vigil_1','skchr_vigil_2','skchr_vigil_3']);
  assert.deepEqual(Object.keys(e.tables.tokenSkills), ['sktok_vigil_wolf_1','sktok_vigil_wolf_2','sktok_vigil_wolf_3']);
  for (const s of Object.values(e.tables.skills)) assert.equal(s.levels.length, 10);
  assert.deepEqual(Object.values(e.tables.tokenSkills).map(s => s.levels.length), [1,1,10]);
  assert.equal(Object.values({...e.tables.skills,...e.tables.tokenSkills}).reduce((n,s)=>n+s.levels.length,0),42);
  for (const s of Object.values(e.tables.tokenSkills)) for (const l of s.levels) {
    assert.equal(l.skillType,'PASSIVE'); assert.equal(l.spData.spCost,0); assert.equal(l.duration,-1);
  }
  assert.deepEqual(e.tables.tokenSkills.sktok_vigil_wolf_1.levels[0].blackboard,[]);
  assert.deepEqual(e.tables.tokenSkills.sktok_vigil_wolf_2.levels[0].blackboard,[]);
});

test('initial two heads, promotion recovery and independent token stats stay distinct from owner stock', () => {
  assert.deepEqual(e.tables.character.talents[0].candidates.map(c=>bb(c.blackboard).cnt),[1,1,1]);
  assert.ok(e.tables.character.talents[0].candidates.every(c=>/initially consisting of 2/.test(c.description)));
  const ts=token.talents[0].candidates.map(c=>bb(c.blackboard));
  assert.deepEqual(ts.map(t=>t.interval),[30,27,25]);
  assert.deepEqual(ts.map(t=>t['vigil_wolf_t_1_enhance[trigger].interval']),[30,27,25]);
  assert.ok(ts.every(t=>t.block_cnt===1 && t['vigil_wolf_t_1_enhance[trigger].max_stack_cnt']===2
    && t['vigil_wolf_t_1_enhance[trigger].block_cnt']===1));
  assert.deepEqual(token.phases.map(p=>p.attributesKeyFrames.at(-1).data.maxHp),[650,836,1100]);
  assert.deepEqual(token.phases.map(p=>p.attributesKeyFrames.at(-1).data.atk),[213,294,371]);
  assert.ok(token.phases.every(p=>p.attributesKeyFrames.every(f=>f.data.blockCnt===0 && f.data.baseAttackTime===1.25)));
  const born=template('vigil_wolf_t_1_enhance[born]');
  assert.deepEqual(nodes(born,type('CheckContainsBuff'))[0]._buffKeys,['vigil_wolf_t_1_enhance[born_override]']);
  assert.equal(nodes(born,type('IfNot')).length,1);
  assert.deepEqual(nodes(born,type('CreateBuff')).map(n=>n._buff.buffKey),
    ['vigil_wolf_t_1_enhance[born_override]','vigil_wolf_t_1_enhance[holder]']);
});

test('head growth cap overrides a recoverable periodic holder rather than adding permanent attack targets', () => {
  const buffs=component('tokens','-4165121327147104433')._buffs;
  const periodic=buffs.find(b=>b.buffKey==='vigil_wolf_t_1_enhance[trigger]');
  assert.equal(periodic.triggerLifeType,2); assert.equal(periodic.waitFirstTriggerInterval,1);
  assert.equal(periodic.stripBlackboardParamsWithBuffKey,1);
  assert.equal(periodic.overrideKey,'vigil_wolf_enhance_trigger');
  assert.equal(bb(periodic.blackboard).priority_flag,0);
  const graph=template('vigil_wolf_t_1_enhance[trigger]');
  assert.deepEqual(nodes(graph,type('FilterByBuffStackCount')).map(n=>[n._condType,n._stackCountKey,n._stackCountPeeling]),
    [['LT','max_stack_cnt',0],['GE','max_stack_cnt',-1]]);
  const [head,cap]=nodes(graph,type('CreateBuff')).map(n=>n._buff);
  assert.equal(head.buffKey,'vigil_wolf_t_1_enhance[holder]'); assert.equal(head.disableOverride,true);
  assert.equal(head.attributes.attributeModifiers[0].attributeType,'BLOCK_CNT');
  assert.equal(cap.overrideKey,periodic.overrideKey); assert.equal(bb(cap.blackboard).priority_flag,1);
});

test('each extra head derives one Attack-filtered Physical receipt with explicit callback suppression', () => {
  const derived=nodes(template('vigil_wolf_t_1_enhance[holder]'),type('CreateBuff'))[0];
  assert.equal(derived._buff.buffKey,'vigil_wolf_t_1_enhance[damage]');
  assert.equal(derived._isDerivedBuff,true); assert.equal(derived._finishDerivedBuffIfParentFinish,true);
  const graph=template('vigil_wolf_t_1_enhance[damage]');
  assert.deepEqual(Object.keys(graph.eventToActions),['ON_ABILITY_CAST_ON_TARGET']);
  assert.equal(nodes(graph,type('FilterAbilityName'))[0]._abilityName,'Attack');
  const hit=nodes(graph,type('AdvancedApplyDamage'))[0];
  assert.equal(hit._damageType,'PHYSICAL'); assert.equal(hit._applyWay,'MELEE');
  assert.equal(hit._baseOnHostAtk,false); assert.equal(hit._emitSourceOnCalculateDamage,false);
  assert.equal(hit._ignoreForSp,false); assert.equal(hit._attackType,'NORMAL');
});

test('fatal before/post hooks preserve one-head removal, cap reopening and HealFree bypass', () => {
  const graph=template('vigil_wolf_t_1[listener]').eventToActions;
  assert.deepEqual(Object.keys(graph),['ON_BEFORE_TRY_SET_HP_ZERO','ON_POST_TRY_SET_HP_ZERO']);
  const consume=nodes(graph.ON_BEFORE_TRY_SET_HP_ZERO,type('ConsumeTrySetHpZeroModifier'))[0];
  assert.equal(consume._blockThisHpSet,false); assert.equal(consume._dontConsumeWhenUndeadable,true);
  assert.equal(nodes(graph.ON_BEFORE_TRY_SET_HP_ZERO,type('FinishOneBuffById'))[0]._buffKey,'vigil_wolf_t_1_enhance[holder]');
  assert.ok(nodes(graph.ON_BEFORE_TRY_SET_HP_ZERO,type('FinishBuffsById'))
    .some(n=>n._buffKey==='vigil_wolf_t_1_enhance[trigger_override]'));
  assert.equal(nodes(graph.ON_BEFORE_TRY_SET_HP_ZERO,type('SwitchMode'))[0]._loadModeFromBlackboard,true);
  assert.equal(nodes(graph.ON_POST_TRY_SET_HP_ZERO,type('IsConsumerOfTrySetHpZeroModifier')).length,1);
  const heal=nodes(graph.ON_POST_TRY_SET_HP_ZERO,type('HealViaMaxHpRatio'))[0];
  assert.equal(heal._getMaxHpFromTarget,true); assert.equal(heal._ignoreHealFree,true); assert.equal(heal._skipModifierEvent,true);
  assert.ok(nodes(graph.ON_BEFORE_TRY_SET_HP_ZERO,type('CreateBuff')).some(n=>n._buff.buffKey==='vigil_e_002_t_1[evade]'));
});

test('persistent tactical point retains recovery and skill marks without a facing picker or slot cost', () => {
  const root=component('tokens','-3264388375348295857');
  assert.equal(root._modes.length,2); assert.equal(root._category,2); assert.equal(root._cardPolicy,0);
  assert.equal(root._occupiedRemainingCharacterCnt,0); assert.equal(root._withdrawCostRecoverRatio,0);
  assert.equal(root._buildCondition.buildableType,1); assert.equal(root._buildCondition.limitByHostAttackRange,1);
  assert.equal(root._buildCondition.needSpecifyDirection,0); assert.equal(root._showFullHpOnBorn,0);
  for(const key of ['vigil_wolf_t_1[trigger]','vigil_wolf_t_1[reborn]','vigil_wolf_t_1[block_cnt]',
    'vigil_wolf_state_1','vigil_wolf_healfree','vigil_wolf_t_1_enhance[born_override]','vigil_wolf_s_2','vigil_wolf_s_3[mark]'])
    assert.ok(root._retainedBuffsWhenDead.includes(key));
  assert.deepEqual(component('tokens','-5515683340706953393')._buffs[0].attributes.abnormalFlags,[7]);
  assert.deepEqual(component('tokens','490094596486416207')._buffs[0].attributes.abnormalFlags,[18,6,5]);
});

test('rebirth uses its own one-second ability and requests active owner marks only when missing', () => {
  const d=component('tokens','6906676463158511439');
  assert.equal(d._metadata.namedAsAlias,'vigil_wolf_switch'); assert.equal(d._waitForAttackEvent,0);
  assert.equal(d._preDelay,1); assert.equal(d._cooldown,1); assert.equal(d._timeMode,2);
  assert.equal(d._animKey,'ReBorn'); assert.deepEqual(bb(d._activeBuffs[0].blackboard),{category:1,mode:1,hp_ratio:1});
  const reborn=template('vigil_wolf_t_1[reborn]');
  assert.equal(nodes(reborn,type('RallyPointReborn'))[0]._target,'BUFF_OWNER');
  assert.deepEqual(nodes(reborn,type('CheckContainsBuff'))[0]._buffKeys,['vigil_wolf_s_3[mark]']);
  assert.deepEqual(nodes(reborn,type('TriggerHostsBuffsByKeys'))[0]._buffKeys,['vigil_s_3[buff_token]']);
  const trigger=component('tokens','-8843324075016566961')._buffs[0];
  assert.equal(trigger.triggerLifeType,1); assert.equal(trigger.triggerCnt,1); assert.equal(trigger.waitFirstTriggerInterval,1);
});

test('trait own-token block check and temporary DEF penetration retain different owner/token scopes', () => {
  const trait=template('vigil_tr');
  assert.equal(bb(e.tables.character.trait.candidates[0].blackboard).atk_scale,1.5);
  assert.equal(nodes(trait,type('CheckBlocked'))[0]._checkBlockedBySourceToken,true);
  assert.equal(nodes(trait,type('AtkScaleUp'))[0]._filterApplyWay,false);
  for(const [key,sourceToken]of [['vigil_t_2',true],['vigil_wolf_t_2',false]]){
    const graph=template(key),check=nodes(graph,type('CheckBlocked'))[0];
    assert.equal(check._checkBlockedBySourceToken,sourceToken); assert.equal(check._checkBlockedBySource,false);
    const buff=nodes(graph,type('CreateBuff'))[0];
    assert.equal(buff._isDerivedBuff,true); assert.equal(buff._buff.attributes.attributeModifiers[0].attributeType,'DEF_PENETRATE_FIXED');
    assert.equal(nodes(graph.eventToActions.ON_AFTER_OUTPUT_DAMAGE,type('FinishDerivedBuff')).length,1);
  }
  for(const c of [e.tables.character,token]){
    const talents=c.talents[1].candidates;
    assert.deepEqual(talents.map(t=>[t.unlockCondition.phase,t.requiredPotentialRank,bb(t.blackboard).def_penetrate_fixed]),
      [['PHASE_2',0,175],['PHASE_2',4,200]]);
  }
});

test('S1 preserves automatic DP and resting/active/capped point branches', () => {
  const ls=e.tables.skills.skchr_vigil_1.levels;
  assert.ok(ls.every(l=>l.skillType==='AUTO' && l.spData.spType==='INCREASE_WITH_TIME' && l.duration===0 && bb(l.blackboard).cost===7));
  assert.deepEqual(ls.map(l=>l.spData.spCost),[30,29,28,27,26,25,24,23,22,21]);
  const graph=template('vigil_s_1[enhance]'); assert.equal(nodes(graph,type('CheckFirstRallyPointMode')).length,1);
  assert.deepEqual(nodes(graph,type('CreateBuffToToken')).map(n=>n._buffData.buffKey),
    ['vigil_wolf_t_1[trigger][imme]','vigil_wolf_s_1[enhance]']);
  const active=template('vigil_wolf_s_1[enhance]');
  assert.deepEqual(nodes(active,type('CheckContainsBuff'))[0]._buffKeys,['vigil_wolf_t_1_enhance[trigger_override]']);
  assert.equal(nodes(active,type('HealViaMaxHpRatio'))[0]._ignoreHealFree,true);
  assert.deepEqual(nodes(active,type('TriggerBuffsByKeys'))[0]._buffKeys,['vigil_wolf_t_1_enhance[trigger]']);
  assert.equal(nodes(active,type('TriggerBuffsByKeys'))[0]._forceTrigger,false);
});

test('S2 retains selected owner parameters and separate attack/kill/heal/finish callbacks', () => {
  const ls=e.tables.skills.skchr_vigil_2.levels;
  assert.ok(ls.every(l=>l.skillType==='AUTO' && l.spData.spType==='INCREASE_WITH_TIME' && bb(l.blackboard).cost===2));
  assert.deepEqual(ls.map(l=>l.spData.spCost),[7,7,7,7,7,7,6,6,6,5]);
  assert.deepEqual(ls.map(l=>bb(l.blackboard)['vigil_wolf_s_2.atk_scale']),[1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.8,1.9,2]);
  assert.deepEqual(ls.map(l=>bb(l.blackboard)['vigil_wolf_s_2.hp_ratio']),[.1,.1,.1,.1,.1,.1,.15,.15,.15,.2]);
  const sent=nodes(template('vigil_s_2'),type('CreateBuffToToken'))[0]._buffData;
  assert.equal(sent.lifeTimeType,'INFINITY'); assert.equal(sent.maxStackCnt,1); assert.equal(sent.stripBlackboardParamsWithBuffKey,true);
  const graph=template('vigil_wolf_s_2').eventToActions;
  for(const ev of ['ON_CALCULATE_DAMAGE','ON_TARGET_KILLED','ON_ABILITY_CAST_ON_TARGET'])
    assert.equal(nodes(graph[ev],type('FilterAbilityName'))[0]._abilityName,'Attack');
  assert.equal(nodes(graph.ON_TARGET_KILLED,type('ModifyCost'))[0]._blackboardKey,'cost');
  assert.equal(nodes(graph.ON_ABILITY_CAST_ON_TARGET,type('HealViaMaxHpRatio'))[0]._ignoreHealFree,true);
  assert.equal(nodes(graph.ON_ABILITY_FINISH,type('FinishBuffsById'))[0]._buffKey,'vigil_wolf_s_2[mark_finish]');
  assert.equal(nodes(template('vigil_wolf_s_2[mark_finish]'),type('FinishBuffsById'))[0]._buffKey,'vigil_wolf_s_2');
});

test('event-free S1/S2 casts keep numeric buff hooks separate from wait-for-attack settings', () => {
  for(const [id,ability]of [['skchr_vigil_1','-994001994528330555'],['skchr_vigil_2','3481059443951263315']]){
    const d=component('skills',ability); assert.equal(d._waitForAttackEvent,1); assert.equal(d._preDelay,0);
    assert.equal(d._cooldown,0); assert.equal(d._timeMode,1);
    assert.equal(d._actions.SerializedState,'[]');
    const buff=e.skills[id].flatMap(r=>r.components).find(c=>c.data._runActionOnEvent!=null).data;
    assert.equal(buff._runActionOnEvent,2); assert.equal(buff._buffs[0].templateKey,'charge_cost');
    for(const face of ['Front','Back']){
      const m=e.models[ID][face]; assert.equal(m.durations[d._animKey],1);
      assert.deepEqual(m.eventPayloads[d._animKey]??[],[]);
    }
  }
});

test('S3 retains all rank ratios and native periodic DP values including rounded intervals', () => {
  const owner=e.tables.skills.skchr_vigil_3.levels, wolf=e.tables.tokenSkills.sktok_vigil_wolf_3.levels;
  const ratio=[.1,.13,.16,.2,.23,.26,.3,.35,.4,.5];
  assert.deepEqual(owner.map(l=>bb(l.blackboard)['attack@vigil_s_3.atk_scale']),ratio);
  assert.deepEqual(wolf.map(l=>bb(l.blackboard)['attack@vigil_wolf_s_3.atk_scale']),ratio);
  assert.deepEqual(owner.map(l=>bb(l.blackboard).value),[9,9,9,10,10,10,11,11,11,12]);
  assert.deepEqual(owner.map(l=>bb(l.blackboard).interval),[1.667,1.667,1.667,1.5,1.5,1.5,1.364,1.364,1.364,1.25]);
  assert.ok(owner.every(l=>l.duration===15 && l.skillType==='MANUAL'));
  const cost=component('skills','1736583768592786678')._buffs.find(b=>b.templateKey==='periodic_cost');
  assert.equal(cost.lifeTimeType,1); assert.equal(cost.triggerLifeType,2); assert.equal(cost.waitFirstTriggerInterval,1);
});

test('S3 sequential A/B/C abilities keep triple-projectile fields distinct from triple Spine events', () => {
  const composite=component('characters','3985271100816784185');
  assert.equal(composite._selectAbilitySequentially,1); assert.equal(composite._resetSubAbilities,0);
  assert.equal(composite._resetSubAbilityCooldown,0); assert.equal(composite._useSubAbilityEscapeTime,1);
  for(const [index,cfg]of composite._abilityConfigs.entries()){
    const d=component('characters',cfg._ability.m_PathID);
    assert.equal(d._waitForAttackEvent,1); assert.equal(d._additionalTimes,2);
    assert.equal(d._triggerDelta,0); assert.equal(d._waitAttackEventForAllAttacks,0);
    assert.equal(d._escapeTime,1); assert.equal(d._projectileKey,'projectile_chr_vigil_s3_1');
    assert.deepEqual(d._additionalProjectiles,['projectile_chr_vigil_s3_2','projectile_chr_vigil_s3_3']);
    assert.deepEqual(d._mountPointGroup,[2,8,9]); assert.equal(d._onlyFeedActiveBuffToFirstOne,0);
    const clip=`Skill3_Attack_${'ABC'[index]}`;
    for(const face of ['Front','Back']){
      const events=e.models[ID][face].eventPayloads[clip]; assert.equal(events.length,3);
      for(const [i,time]of [.03333333507180214,.13333334028720856,.3333333432674408].entries())
        assert.deepEqual(events[i],{time,name:'OnAttack',int:0,float:0,string:''});
    }
  }
});

test('S3 Arts receipts keep own blocking, host ATK and callback suppression scopes', () => {
  const owner=template('vigil_s_3[buff]'),wolf=template('vigil_wolf_s_3');
  assert.equal(nodes(owner,type('CheckBlocked'))[0]._checkBlockedBySourceToken,true);
  assert.equal(nodes(wolf,type('CheckBlocked'))[0]._checkBlockedBySource,true);
  assert.deepEqual(nodes(wolf,type('CheckContainsBuff'))[0]._buffKeys,['vigil_wolf_s_3[mark]']);
  const count=nodes(wolf,type('AssignBuffCountIntoBlackboard'))[0];
  assert.equal(count._buffKey,'vigil_wolf_t_1_enhance[damage]'); assert.equal(count._stackCountPeeling,1);
  assert.equal(count._stackCountKey,'times'); assert.equal(nodes(wolf,type('CreateBuffs'))[0]._buffPair.useBlackboard,true);
  for(const [graph,host,way]of [[owner,false,'RANGED'],[template('vigil_wolf_s_3[damage]'),true,'MELEE']]){
    const damage=nodes(graph,type('AdvancedApplyDamage'))[0];
    assert.equal(damage._baseOnHostAtk,host); assert.equal(damage._emitSourceOnCalculateDamage,false);
    assert.equal(damage._damageType,'MAGICAL'); assert.equal(damage._applyWay,way);
  }
  for(const ev of ['ON_BUFF_START','ON_BUFF_TRIGGER']){
    const mark=nodes(template('vigil_s_3[buff_token]').eventToActions[ev],type('CreateBuffToToken'))[0];
    assert.equal(mark._isDerivedBuff,true); assert.equal(mark._finishDerivedBuffIfParentFinish,true);
  }
});

test('all original projectile trees keep independent source-invalid policy and lifetime', () => {
  assert.deepEqual(Object.keys(e.projectiles).toSorted(),
    ['projectile_chr_vigil','projectile_chr_vigil_s3_1','projectile_chr_vigil_s3_2','projectile_chr_vigil_s3_3']);
  for(const rs of Object.values(e.projectiles)){
    const ds=rs.flatMap(r=>r.components).map(c=>c.data);
    assert.equal(ds.find(d=>d._speed!=null)._speed,10);
    const root=ds.find(d=>d._stopWhenSourceInvalid!=null);
    assert.equal(root._stopWhenSourceInvalid,0); assert.equal(root._lifeTime,10);
  }
});

test('default Wolfpack has its single original animator/atlas chain with no fabricated facing', () => {
  assert.deepEqual(Object.keys(e.models[TOKEN]),['Original']);
  const m=e.models[TOKEN].Original,b=e.officialSkeletonBindings[TOKEN].Original;
  assert.equal(b.sha256,m.sha256); assert.equal(b.byteLength,m.bytes);
  assert.equal(m.bundle,'pkgrps/btl_pfb_tokens_0.ab');
  assert.deepEqual(m.eventPayloads.Attack,[{time:.46666666865348816,name:'OnAttack',int:0,float:0,string:''}]);
  assert.deepEqual(m.eventPayloads.Start,[{time:.4000000059604645,name:'OnStart',int:0,float:0,string:''}]);
  assert.equal(m.durations.Start,1); assert.equal(m.durations.Idle_2,0);
  const animator=component('tokens',b.animatorPathId);
  assert.equal(animator._animations.find(a=>a.animKey==='ReBorn').animName,'Start');
  assert.equal(animator._animations.find(a=>a.animKey==='Idle').animName,'Idle_1');
  assert.equal(e.source.bundles.some(r=>r.path.startsWith('skinpack/')),false);
  for(const face of ['Front','Back']){
    near(e.models[ID][face].eventPayloads.Attack[0].time,.2666666805744171);
    assert.equal(e.officialSkeletonBindings[ID][face].sha256,e.models[ID][face].sha256);
  }
});
