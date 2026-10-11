// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-ray-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4117_ray', TOKEN = 'token_10034_ray_sndbst';
const components = group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components));
const rows = components('characters');
const bb = xs => Object.fromEntries(xs.map(x => [x.key, x.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function nodes(value, predicate, out = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { nodes(JSON.parse(value), predicate, out); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) out.push(value);
    for (const v of Object.values(value)) nodes(v, predicate, out);
  }
  return out;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);
const component = id => rows.find(c => c.pathId === id).data;

test('Ray source audit preserves complete registered kit and explicit execution limits', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'ray'); assert.equal(data.operators[ID].skills.length, 3);
  assert.equal(e.runtimeContracts.length, 9); assert.deepEqual(e.holdReasons, []);
  assert.ok(e.historicalHoldReasons.some(r => /Reload clips have no Spine events/.test(r)));
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  assert.equal(e.source.bundles.length, 6);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
});

test('selected elite controls owner capacity and token collected capacity independently', () => {
  assert.deepEqual(e.tables.character.trait.candidates.map(c => bb(c.blackboard).value), [4,6,8]);
  for (const c of e.tables.character.trait.candidates) near(bb(c.blackboard).atk_scale, 1.2);
  const token = e.tables.tokens[TOKEN];
  assert.deepEqual(token.trait.candidates.map(c => bb(c.blackboard).value), [6,8]);
  const writes = nodes(e.templates.ray_sndbst_tr, type('ModifyAbilityBlackboard'));
  assert.deepEqual(writes.map(n => [n._blackboardKeys,n._fromBlackboardKeys,n._value]),
    [['max_cnt','value',0],['cnt','',0],['display_hunter_bullet_flag','',0]]);
  assert.equal(nodes(e.templates.ray_tr, type('ModifyAbilityBlackboard'))[1]._fromBlackboardKeys, 'value');
});

test('all directional composite attacks retain separate fire, reload-break fire and reload gates', () => {
  const composite = rows.map(r => r.data).filter(d => d._abilityConfigs);
  assert.equal(composite.length, 5);
  for (const d of composite) {
    assert.equal(d._category, 4); assert.equal(d._selectAbilitySequentially, 0);
    assert.equal(d._firstAttackIfAbilityChanged, 1);
    assert.equal(d._updateCooldownBySubAbilityCooldownDuringCasting, 1);
    assert.equal(d._abilityConfigs.length, 3);
    const ts = d._abilityConfigs.map(c => component(c._trigger.m_PathID));
    assert.deepEqual(ts.slice(0,2).map(t => [t._checkReloadFlag,t._reloadFlag]), [[1,0],[1,1]]);
    for (const t of ts.slice(0,2)) assert.deepEqual(t._triggerValidType.toSorted(), [0,1]);
    assert.deepEqual(ts[2]._triggerValidType.toSorted(), [1,2]);
    const reload = component(d._abilityConfigs[2]._ability.m_PathID);
    assert.equal(reload._allowNoTarget, 1); assert.equal(reload._timeMode, 1);
    assert.equal(reload._waitForAttackEvent, 1);
  }
});

test('original fire events and event-free reload clips remain distinct in both facings', () => {
  for (const face of ['Front','Back']) {
    const m = e.models[ID][face];
    for (const [clip, time] of [['Attack_Loop',.36666667461395264],['Skill_1_Loop',.2666666805744171],
                              ['Skill_2_Loop',.4000000059604645],['Skill_3_Loop',.30000001192092896]]) {
      assert.deepEqual(m.eventPayloads[clip], [{time,name:'OnAttack',int:0,float:0,string:''}]);
    }
    for (const [clip,duration] of [['Reload_Loop',1.6],['Skill_2_Reload_Loop',1.6],['Skill_3_Reload_Loop',.4]]) {
      near(m.durations[clip],duration); assert.deepEqual(m.eventPayloads[clip] ?? [],[]);
    }
    near(m.durations.Reload_Break,.167);
  }
  assert.equal(e.models[ID].Front.durations.Skill_Down_3_Reload_Loop,.4);
});

test('ammo callback numbers and conditional flag cleanup are not rewritten as animation events', () => {
  const hooks = rows.map(r => r.data).filter(d => d._startEvent != null && d._buffs?.some(b => /^ray_tr_(add|sub)$/.test(b.buffKey)));
  assert.equal(hooks.length, 17);
  for (const h of hooks) {
    assert.equal(h._startEvent,5); assert.equal(h._endEvent,3); assert.equal(h._forceFinishBuffOnCastEnd,0);
    const b=h._buffs[0]; assert.equal(bb(b.blackboard).dynamic, b.buffKey==='ray_tr_add'?1:-1);
  }
  const reset=e.templates['ray_attack[flag_reset]'].eventToActions.ON_BUFF_FINISH;
  assert.equal(nodes(reset,type('CheckUnitInAttackState'))[0]._isUnset,true);
  assert.equal(nodes(reset,type('AssignValueToTraitBB'))[0]._blackboardKey,'RELOAD_FLAG');
});

test('all owner ranks and the sole real token skill preserve charge and recovery rules', () => {
  assert.deepEqual(Object.keys(e.tables.skills), ['skchr_ray_1','skchr_ray_2','skchr_ray_3']);
  assert.deepEqual(Object.keys(e.tables.tokenSkills), ['sktok_ray_2']);
  assert.deepEqual(e.tables.tokens[TOKEN].skills.map(s=>s.skillId),[null,'sktok_ray_2',null]);
  for (const s of Object.values({...e.tables.skills,...e.tables.tokenSkills})) assert.equal(s.levels.length,10);
  const s1=e.tables.skills.skchr_ray_1.levels;
  assert.deepEqual(s1.map(l=>l.spData.maxChargeTime),[1,1,1,2,2,2,2,2,2,2]);
  assert.deepEqual(s1.map(l=>bb(l.blackboard).cnt),[1,1,1,1,1,1,1,2,2,2]);
  assert.deepEqual(s1.map(l=>bb(l.blackboard).force),[1,1,1,1,1,1,1,1,1,2]);
  assert.ok(s1.every(l=>l.skillType==='MANUAL' && l.spData.spType==='INCREASE_WITH_TIME'));
  const s2=e.tables.skills.skchr_ray_2.levels;
  assert.ok(s2.every(l=>l.skillType==='AUTO' && l.spData.spType==='INCREASE_WHEN_ATTACK' && l.spData.spCost===16 && l.duration===-1));
  assert.deepEqual(s2.map(l=>bb(l.blackboard).respawn_time),[-.1,-.1,-.1,-.2,-.2,-.2,-.3,-.3,-.3,-.4]);
  assert.ok(e.tables.skills.skchr_ray_3.levels.every(l=>l.duration===16 && bb(l.blackboard).reload_interval===-1.2));
});

test('S1 push and direct/fall kill graphs preserve distinct source ownership', () => {
  const push=nodes(e.templates['ray_s_1[konckback]'],type('Knockback'))[0];
  assert.equal(push._useSourceDirection,true); assert.equal(push._decreaseForceLevelWhenNotInDirection,1);
  const kill=e.templates['ray_s_1[kill_add_bullet]'].eventToActions;
  assert.equal(nodes(kill,type('FilterAbilityFamily'))[0]._familyGroupMask,'SKILL');
  const direct=nodes(e.templates['ray_s_1[bullet]'],type('CalculateTraitAbilityBlackboard'))[0];
  const fall=nodes(e.templates['ray_s_1[fallkill]'],type('CalculateTraitAbilityBlackboard'))[0];
  assert.equal(direct._targetType,'BUFF_OWNER'); assert.equal(fall._targetType,'BUFF_SOURCE');
  assert.equal(direct._targetBlackboardKey,'dynamic_extra'); assert.equal(fall._targetBlackboardKey,'dynamic_extra');
});

test('S2 token refund reads collected cnt and returns bullets through owner trait with cap/reset', () => {
  const collect=e.templates.ray_sndbst_collect.eventToActions.ON_OWNER_FINISH;
  const read=nodes(collect,type('ModifyBlackboardFromTrait'))[0];
  assert.equal(read._fromBlackboardKeys,'cnt'); assert.equal(read._blackboardKeys,'dynamic');
  const host=nodes(collect,type('CreateBuffToHost'))[0];
  assert.equal(host._buffData.templateKey,'ray_tr_add');
  const writes=nodes(e.templates.ray_tr_add,type('CalculateTraitAbilityBlackboard'));
  assert.ok(writes.some(n=>n._targetBlackboardKey==='dynamic_extra' && n._fromBlackboardKey===''));
  assert.ok(writes.some(n=>n._targetBlackboardKey==='cnt' && n._fromBlackboardKey==='max_cnt'));
  const card=nodes(e.templates['ray_s_2[deck]'],type('CreateCardBuffToMyToken'))[0];
  assert.equal(card._lifeType,'HOLD_BY_BUFF'); assert.equal(card._isRatio,true);
});

test('S3 uses full-ammo modes, additive reload change and one finish-time kill refund', () => {
  const root=rows.map(c=>c.data).find(d=>d._modes);
  assert.equal(root._modes.length,7);
  for (const index of [3,6]) {
    const mode=component(root._modes[index].m_PathID);
    const refill=component(mode._attack.m_PathID);
    assert.equal(refill._abilityConfigs,undefined);
    assert.equal(refill._allowNoTarget,1);
    assert.equal(refill._timeMode,1);
  }
  const initial=e.templates['ray_s_3[mode]'];
  const check=nodes(initial,type('CheckTraitAbilityBlackboard'))[0];
  assert.deepEqual([check._leftBlackboardKey,check._rightBlackboardKey,check._compareType],['cnt','max_cnt','EQUALS']);
  assert.deepEqual(nodes(initial,type('SwitchMode')).map(n=>n._modeIndex),[5,4,6,3,0]);
  assert.deepEqual(nodes(e.templates['ray_s_3[check_full]'],type('SwitchMode')).map(n=>n._modeIndex),[5,4]);
  for (const [event,sub] of [['ON_BUFF_START',false],['ON_BUFF_FINISH',true]]) {
    const change=nodes(e.templates['ray_s_3[reload]'].eventToActions[event],type('CalculateTraitAbilityBlackboard'))[0];
    assert.equal(change._isSub,sub); assert.equal(change._targetBlackboardKey,'reload_interval');
  }
  const sp=e.templates['ray_s_3[sp]'].eventToActions;
  assert.equal(nodes(sp.ON_TARGET_KILLED,type('ModifySp')).length,0);
  assert.equal(nodes(sp.ON_TARGET_KILLED,type('CreateBuff'))[0]._buff.buffKey,'ray_s_3[mark]');
  assert.equal(nodes(sp.ON_BUFF_FINISH,type('ModifySp'))[0]._spString,'sp');
  assert.equal(nodes(sp.ON_BUFF_FINISH,type('ModifySp'))[0]._forceFlag,true);
});

test('Sandbeast placement, lifetime and source-unfiltered aura remain explicit', () => {
  const t=components('tokens').map(c=>c.data);
  const root=t.find(d=>d._buildCondition);
  assert.equal(root._occupiedRemainingCharacterCnt,0); assert.equal(root._category,2);
  assert.equal(root._buildCondition.limitByHostAttackRange,1); assert.equal(root._buildCondition.needSpecifyDirection,0);
  assert.deepEqual(e.tables.tokens[TOKEN].talents[0].candidates.map(c=>bb(c.blackboard).duration),[15,25]);
  const selectors=rows.map(c=>c.data).filter(d=>d._buffKey==='ray_sndbst_aura');
  assert.equal(selectors.length,10);
  for (const s of selectors) { assert.equal(s._secondaryFilter,3); assert.equal(s._filterBuffSource,0); }
  const gate=nodes(e.templates['ray_t_1[damage_scale]'],type('CheckContainsBuff'))[0];
  assert.equal(gate._checkBuffSource,false);
  assert.equal(nodes(e.templates['ray_t_1[damage_scale]'],type('DamageScale'))[0]._damageMask,'PHYSICAL');
});

test('Extreme Focus cap uses selected blackboard rather than placeholder stack buff count', () => {
  const talent=component('-1880280650860160246');
  assert.equal(talent._targetFamilyMask,15); assert.equal(talent._ignoreOwnerAsTarget,1);
  assert.equal(talent._stackBuff.maxStackCnt,1);
  const cs=e.tables.character.talents[1].candidates;
  assert.deepEqual(cs.map(c=>bb(c.blackboard).max_stack_cnt),[3,3]);
  assert.deepEqual(cs.map(c=>bb(c.blackboard).atk),[.08,.09]);
  assert.deepEqual(cs.map(c=>c.requiredPotentialRank),[0,4]);
});

test('default Sandbeast has one native skeleton, not alternate costume or duplicated facings', () => {
  assert.deepEqual(Object.keys(e.models[TOKEN]),['Original']);
  const m=e.models[TOKEN].Original, b=e.officialSkeletonBindings[TOKEN].Original;
  assert.equal(m.bundle,'pkgrps/btl_pfb_tokens_0.ab');
  assert.equal(b.sha256,m.sha256); assert.equal(b.byteLength,m.bytes);
  assert.deepEqual(m.durations,{Default:0,Idle:1,Start:1});
  assert.deepEqual(m.hits,{});
  assert.equal(e.source.bundles.some(b=>b.path.startsWith('skinpack/')),false);
  assert.equal(Object.keys(e.projectiles).length,4);
  for (const rs of Object.values(e.projectiles)) {
    const speed=rs.flatMap(r=>r.components).find(c=>c.data._speed!=null).data._speed;
    assert.equal(speed,15);
  }
});
