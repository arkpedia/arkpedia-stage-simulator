// SPDX-License-Identifier: GPL-3.0-or-later
const zero = r => r?.m_PathID === '0' && r.m_FileID === 0;
const one = (n, k) => n[k]?.length === 1 ? n[k][0] : null;
const exactKeys = (obj, keys) => JSON.stringify(Object.keys(obj ?? {}).sort()) === JSON.stringify([...keys].sort());
const attributes = (b, flags, mods = []) => b && Object.entries(b.attributes ?? {}).every(([key, entries]) => {
  if (key === 'abnormalFlags') return JSON.stringify(entries) === JSON.stringify(flags);
  if (key === 'attributeModifiers') return entries.length === mods.length && entries.every((m, i) => m.attributeType === mods[i]
    && m.formulaItem === 1 && m.loadFromBlackboard === 1 && m.fetchBaseValueFromSourceEntity === 0);
  return entries.length === 0;
});
const passive = c => c?.m_Script?.m_PathID === '3800760148018415462' && zero(c._selector);
const fixedBuff = (b, key, template, life) => b?.buffKey === key && b.templateKey === template && b.lifeTimeType === life
  && b.isSilenceable === 0 && b.isDamageMissable === 0 && b.loadFromDB === 0;
const actionIs = (a, type, fields) => a?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`
  && Object.entries(fields).every(([k, v]) => JSON.stringify(a[k]) === JSON.stringify(v));
function listener(n, b, key, flag) {
  const a = n.$template('enemy_hp_listener')?.eventToActions?.ON_BUFF_TRIGGER;
  return fixedBuff(b, key, 'enemy_hp_listener', 2) && attributes(b, flag == null ? [] : [flag])
    && b.triggerLifeType === 2 && Math.abs(b.triggerInterval - .2) < 1e-6 && b.waitFirstTriggerInterval === 0
    && b.blackboard?.length === 1 && b.blackboard[0].key === 'mode' && b.blackboard[0].value === 1
    && a?.length === 3 && actionIs(a[0], 'FilterByTargetHpRatio', { _targetType: 'TARGET', _condType: 'LT', _useSourceHpRatio: false })
    && actionIs(a[1], 'FinishBuff', { _decCntIfStack: false, _updateOverrideMap: true })
    && actionIs(a[2], 'SwitchMode', { _loadModeFromBlackboard: true, _restoreDefault: false, _restartFSM: true, _targetType: 'TARGET' });
}
function modePair(n, id, first) {
  const root = one(n, id), a = one(n, first), b = one(n, 'Normal');
  return root?._modes?.length === 2 && n.$ref(root._modes[0]) === a && n.$ref(root._modes[1]) === b
    && a._generalAbilities?.every(zero) && b._generalAbilities?.every(zero);
}
export function sarkazStandbyNative(r, n) {
  if (!/^enemy_107[45]_(?:dbskar|dmgswd)(?:_2)?$/.test(r.prefabKey) || r.skills.length
    || !exactKeys(r.talents.bb, ['revive.hp_ratio', 'revive.move_speed', 'revive.unmove_duration'])
    || !(r.talents.bb['revive.hp_ratio'] > 0 && r.talents.bb['revive.hp_ratio'] <= 1)
    || !(r.talents.bb['revive.move_speed'] >= 0 && r.talents.bb['revive.unmove_duration'] >= 0)
    || !modePair(n, r.prefabKey, 'Sleep') || n[r.prefabKey][0]._commonAbilities?.length !== 0) return false;
  const revives = n.Revive, sleeping = revives?.find(c => c._buffs?.length === 2), active = revives?.find(c => c._buffs?.length === 1);
  const bind = sleeping?._buffs[1], move = active?._buffs[0];
  if (revives?.length !== 2 || !passive(sleeping) || !passive(active) || !listener(n, sleeping._buffs[0], 'enemy_slumber', 11)
    || !fixedBuff(bind, 'dbskar_t[sleep]', 'empty', 1) || bind.durationKey !== 'unmove_duration' || !attributes(bind, [22])
    || bind.blackboard?.length !== 0 || !attributes(move, [], [6]) || move.templateKey !== 'empty' || move.lifeTimeType !== 2
    || move.isSilenceable !== 0 || move.blackboard?.length !== 0) return false;
  const caster = r.prefabKey.includes('dbskar'), normal = n.Normal[0], attack = n.$ref(caster ? normal._attack : normal._combat);
  if (attack?._damageType !== 2 || attack._attackType !== 1 || attack._atkScale !== 1 || attack._activeBuffs?.length !== 0
    || attack._useDynamicAttackType !== 0 || attack._timeMode !== 0 || attack._waitForAttackEvent !== 1) return false;
  if (!caster) return r.applyWay === 'MELEE' && zero(attack._selector) && attack._preDelay === 0;
  const s = n.$ref(attack._selector);
  return r.applyWay === 'RANGED' && !('_projectileKey' in attack) && Math.abs(attack._preDelay - 1.134) < 1e-6
    && s?._targetMotion === 1 && s._targetSide === 2 && s._limitTargetNum === 1 && s._maxNum === 2
    && s._ignoreTargetFree === 0 && s._forceIgnoreCamouflage === 0 && s._abnormalFlag === 25 && s._postFilter === 4;
}
export function sentinelNative(r, n) {
  if (!/^enemy_1073_dscout(?:_2)?$/.test(r.prefabKey) || r.applyWay !== 'NONE' || r.skills.length !== 1
    || !exactKeys(r.talents.bb, ['warn.hp_ratio']) || !(r.talents.bb['warn.hp_ratio'] > 0 && r.talents.bb['warn.hp_ratio'] <= 1)
    || !modePair(n, r.prefabKey, 'Undeadable')) return false;
  const skill = r.skills[0], root = n[r.prefabKey][0], leader = r.prefabKey.endsWith('_2'), warn = one(n, 'Warn');
  if (skill.prefabKey !== 'Awake' || skill.cooldown !== 0 || skill.initCooldown !== .1 || skill.spCost !== 0
    || !exactKeys(skill.bb, ['atk', 'def']) || !(skill.bb.atk > 0 && skill.bb.def > 0)
    || !passive(warn) || warn._buffs?.length !== 1 || !listener(n, warn._buffs[0], 'dscout_t', leader ? null : 6)) return false;
  if (root._commonAbilities?.length !== Number(leader)) return false;
  if (leader) {
    const undead = one(n, 'Undead'), b = undead?._buffs?.[0];
    if (n.$ref(root._commonAbilities[0]) !== undead || !passive(undead) || undead._buffs?.length !== 1
      || !fixedBuff(b, 'dscout_undead', 'empty', 2) || !attributes(b, [6])) return false;
  }
  if (!['Normal', 'Undeadable'].every(key => {
    const m = n[key][0], c = n.$ref(m._combat);
    return n.$ref(m._attack) === c && c?.m_Script?.m_PathID === '8145049199648393782' && c._activeBuffs?.length === 0 && c._animKey === '';
  })) return false;
  const rows = n.Awake, w = rows?.find(c => '_familyMask' in c), c = rows?.find(c => '_activeBuffs' in c), b = c?._activeBuffs?.[0];
  const s = n.$ref(c?._selector), geometry = n.$siblings(c?._selector), global = geometry.find(c => '_useBlackboardRangeId' in c);
  if (rows?.length !== 2 || w?._familyMask !== 3 || w._maxTriggerTime !== 1 || w._ignoreSilence !== 0 || w._castLikeAttack !== 0
    || w._resetMainAbilityCdWhenCastEnd !== 0 || n.$ref(w._trigger)?.m_Script?.m_PathID !== '-2995189732062982133'
    || c?._activeBuffs?.length !== 1 || c._animKey !== 'Skill' || c._waitForAttackEvent !== 0 || c._timeMode !== 1
    || c._affectedBySlowDown !== 1 || c._allowNoTarget !== 1 || c._alwaysIncludeTarget !== 0 || c._preDelay !== 0
    || s?._targetSide !== 1 || s._targetMotion !== 3 || s._limitTargetNum !== 0 || s._excludeOwner !== 0
    || s._ignoreTargetFree !== 0 || s._abnormalFlag !== 42 || s._postFilter !== 0
    || global?.m_Script?.m_PathID !== '6275044311115013764' || global._useBlackboardRangeId !== 0
    || !fixedBuff(b, 'dscout_t[buff]', 'dscout_t[buff]', 2) || b.disableOverride !== 1 || !attributes(b, [], [1, 2])
    || b.blackboard?.length !== 1 || b.blackboard[0].key !== 'mode' || b.blackboard[0].value !== 1) return false;
  const anim = n.$ref(root._animator)?._animations?.find(a => a.animKey === 'Skill');
  if (anim?.animName !== 'Skill_Begin' || anim.speed !== 1 || anim.loop !== 0) return false;
  if (leader) {
    const finish = n.$siblings(c).find(c => '_onlyCheckOnStopAffect' in c), a = n.$template('dscout_cancel_undead')?.eventToActions?.ON_BUFF_START;
    if (finish?.m_Script?.m_PathID !== '7085803614365642631' || finish._onlyCheckOnStopAffect !== 0 || finish._buffs?.length !== 1
      || !fixedBuff(finish._buffs[0], 'dscout_cancel_undead', 'dscout_cancel_undead', 0)
      || a?.length !== 1 || !actionIs(a[0], 'FinishBuffsById', { _buffKey: 'dscout_undead', _loadFromBlackboard: false, _targetType: 'BUFF_OWNER' })) return false;
  }
  const a = n.$template('dscout_t[buff]')?.eventToActions?.ON_BUFF_START;
  return a?.length === 3 && actionIs(a[0], 'CheckContainsBuff', { _targetType: 'BUFF_OWNER', _buffKeys: ['enemy_slumber'], _loadFromBlackboard: false })
    && actionIs(a[1], 'SwitchMode', { _loadModeFromBlackboard: true, _restartFSM: false, _targetType: 'TARGET' })
    && actionIs(a[2], 'FinishBuffsById', { _buffKey: 'enemy_slumber', _loadFromBlackboard: false, _targetType: 'BUFF_OWNER' });
}
export const SARKAZ_ALARM_FEATURES = Object.freeze({
  'talent:warn': { covers: sentinelNative,
    explains: text => text === 'When injured, issues an alarm to immediately enhance the ATK and DEF of all enemy units, and makes enemies in Standby immediately enter Combat-Ready mode',
    note: 'Original 0.2-second HP listener switches from protected mode into the one-shot alarm mode.' },
  'skill:Awake': { covers: sentinelNative, nativeClaim: (_p, n) => ({ wrappers: 1, active: Number(!!n.Undead) }),
    ability: { kind: 'sentinelAlarm', params: r => ({ ratio: r.talents.bb['warn.hp_ratio'], atk: r.skills[0].bb.atk,
      def: r.skills[0].bb.def, initialCooldown: r.skills[0].initCooldown, leader: r.prefabKey.endsWith('_2') }) },
    note: 'A one-shot global grant to existing enemies; wakes native slumber, with leader protection until cast completion.' },
});
