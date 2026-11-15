// SPDX-License-Identifier: GPL-3.0-or-later
import { passiveOutcomeBuff, emptyOutcomeAttributes, nativeKillLog, nativeTheftLog } from './enemy-outcome-contracts.js';
const matches = (row, expected) => !!row && Object.entries(expected).every(([key, value]) => row[key] === value);
const zero = ref => ref?.m_PathID === '0';
export function hoverGroundVisual(record) {
  const suffix=record.prefabKey==='enemy_2070_skzfbx'?'2':'02';
  return {clip:`Idle${suffix}`,move:`Move${suffix}`,die:`Die${suffix}`,
    attack:suffix==='2'?'Attack':'Attack02',loop:true};
}
function hoverModeVisualNative(record,n) {
  const root=n[record.prefabKey]?.[0],mode=n.$ref(root?._modes?.[1]),hook=n.$ref(mode?._animatorHooker);
  const visual=hoverGroundVisual(record),pairs=[['Move',visual.move],['Die',visual.die],['Idle',visual.clip]];
  if(record.prefabKey!=='enemy_2070_skzfbx')pairs.push(['Attack',visual.attack]);
  const animations=n.$ref(root?._animator)?._animations;
  return hook?._disableSwitchSettings.length===0&&hook._excludeAnimKeys.join()==='Stun'
    &&JSON.stringify(hook._replaceAnimPairs)===JSON.stringify(pairs.map(([fromAnimKey,toAnimKey])=>({fromAnimKey,toAnimKey})))
    &&Object.values(visual).filter(v=>typeof v==='string').every(name=>animations?.some(a=>a.animKey===name&&a.animName===name&&a.speed===1));
}
export function lostHovercraftNative(record, n) {
  if (record.prefabKey !== 'enemy_2070_skzfbx' || record.applyWay !== 'MELEE' || record.stats.dmgType !== 'phys'
    || Object.keys(record.talents.groups).join() !== '1' || record.talents.groups['1'].join() !== 'move_speed'
    || record.talents.bb['1.move_speed'] !== .35 || record.skills.length !== 1
    || !matches(record.skills[0], { prefabKey: 'RecoverAnim', cooldown: 0, initCooldown: 0, spCost: 0 })
    || Object.keys(record.skills[0].bb).length || !hoverModeVisualNative(record,n)) return false;
  const root = n[record.prefabKey]?.[0], air = n.Fly?.find(c => '_generalAbilities' in c), ground = n.Walk?.find(c => '_generalAbilities' in c);
  const fall = n.FallDown?.[0], logger = n.LogKilled?.[0], speed = n['1']?.[0], buff = fall?._buffs?.[0];
  const cast = n.RecoverAnim?.find(c => '_actions' in c), wrapper = n.RecoverAnim?.find(c => '_familyMask' in c);
  if (root?._modes.length !== 2 || n.$ref(root._modes[0]) !== air || n.$ref(root._modes[1]) !== ground
    || root._commonAbilities.length !== 1 || n.$ref(root._commonAbilities[0]) !== logger
    || air?._generalAbilities.length !== 2 || n.$ref(air._generalAbilities[0]) !== fall
    || n.$ref(air._generalAbilities[1]) !== n.M0Effect?.[0] || ground?._generalAbilities.length !== 1
    || n.$ref(ground._generalAbilities[0]) !== n.M1Effect?.[0]
    || !zero(air._attack) || !zero(ground._attack) || n.$ref(air._combat) !== n.EmptyCombat?.[0]
    || n.EmptyCombat[0].m_Script.m_PathID !== '8145049199648393782'
    || n.$ref(ground._combat) !== n.Combat?.[0]
    || !matches(n.Combat[0], { _damageType: 1, _atkScale: 1, _selectTargetSource: 2 })
    || n.Combat[0]._activeBuffs.length || !zero(n.Combat[0]._selector)
    || !matches(wrapper, { _familyMask: 3, _ignoreSilence: 1, _maxTriggerTime: 1, _castLikeAttack: 0 })
    || !matches(cast, { _animKey: 'Change', _timeMode: 1, _allowNoTarget: 1 }) || cast._activeBuffs.length
    || cast._actions.SerializedState !== '[]') return false;
  if (fall._buffs.length !== 1 || !matches(buff, { templateKey: 'skzfbx_m1_a[fall_down]', loadFromDB: 0,
    lifeTime: 0, lifeTimeType: 2, isSilenceable: 0, isStunnable: 1, isFreezable: 1, isLevitatable: 1, isGroundBoundable: 1 })
    || buff.attributes.abnormalFlags.join() !== '8'
    || !emptyOutcomeAttributes({ ...buff.attributes, abnormalFlags: [] })
    || JSON.stringify(buff.blackboard) !== JSON.stringify([{ key: 'motion', value: 1, valueStr: '' }, { key: 'mode', value: 1, valueStr: '' }])) return false;
  const speedBuff = speed?._buffs?.[0], modifier = speedBuff?.attributes.attributeModifiers;
  if (speed?._buffs.length !== 1 || !zero(speed._selector) || !n.$ancestors(speed).includes(ground.m_GameObject.m_PathID)
    || n.$ancestors(speed).includes(air.m_GameObject.m_PathID) || modifier?.length !== 1
    || !matches(modifier[0], { attributeType: 6, formulaItem: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0, value: 0 })
    || !passiveOutcomeBuff({ ...speedBuff, attributes: { ...speedBuff.attributes, attributeModifiers: [] } })
    || speedBuff.templateKey !== 'empty' || speedBuff.blackboard.length) return false;
  const events = n.$template('skzfbx_m1_a[fall_down]')?.eventToActions, off = events?.ON_BUFF_DISABLE;
  if (Object.keys(events ?? {}).sort().join() !== 'ON_BUFF_DISABLE,ON_BUFF_FINISH,ON_BUFF_START'
    || events.ON_BUFF_START.length !== 1 || events.ON_BUFF_FINISH.length !== 2 || off?.length !== 3
    || !matches(events.ON_BUFF_START[0], { $type: 'Torappu.Battle.Action.Nodes+ChangeMotionMode, Assembly-CSharp',
      _target: 'BUFF_OWNER', _resetToDefault: false, _motionMode: 'WALK' })
    || !matches(events.ON_BUFF_FINISH[0], { $type: 'Torappu.Battle.Action.Nodes+ChangeMotionMode, Assembly-CSharp',
      _target: 'BUFF_OWNER', _resetToDefault: true, _motionMode: 'WALK' })
    || !matches(events.ON_BUFF_FINISH[1], { $type: 'Torappu.Battle.Action.Nodes+UpdateEnemyCurrentTile, Assembly-CSharp',
      _ownerType: 'BUFF_OWNER', _force: true })
    || !matches(off[0], { $type: 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp', _loadModeFromBlackboard: true,
      _restoreDefault: false, _restartFSM: false, _targetType: 'TARGET' })
    || off[1].$type !== 'Torappu.Battle.Action.Nodes+CheckUnitAlive, Assembly-CSharp'
    || off[2].$type !== 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp'
    || off[2]._buff.templateKey !== 'empty' || off[2]._buff.loadFromDB !== false
    || off[2]._buff.blackboard.length || !emptyOutcomeAttributes(off[2]._buff.attributes)) return false;
  const visual = n.M0Effect[0]._buffs, groundedVisual = n.M1Effect[0]._buffs;
  const effectEvents = n.$template('skzfbx_m1_a[effect]')?.eventToActions;
  if (visual.length !== 1 || groundedVisual.length !== 1 || ![...visual, ...groundedVisual].every(passiveOutcomeBuff)
    || visual[0].templateKey !== 'empty' || groundedVisual[0].templateKey !== 'skzfbx_m1_a[effect]'
    || Object.keys(effectEvents ?? {}).join() !== 'ON_BUFF_START' || effectEvents.ON_BUFF_START.length !== 1
    || !matches(effectEvents.ON_BUFF_START[0], { $type: 'Torappu.Battle.Action.Nodes+FinishBuffsById, Assembly-CSharp',
      _buffKey: 'skzfbx_m0_a[effect]', _loadFromBlackboard: false, _targetType: 'BUFF_OWNER' })) return false;
  return logger?._buffs.length === 2 && logger._buffs.every(passiveOutcomeBuff)
    && logger._buffs.every(b => b.blackboard.length === 0)
    && logger._buffs[0].templateKey === 'log_killed' && logger._buffs[1].templateKey === 'log_thief_reach_exit'
    && nativeKillLog(n) && nativeTheftLog(n) && Object.keys(n.$template('empty')?.eventToActions ?? { missing: true }).length === 0;
}
export function dublinnHoverNative(record, n) {
  if (!['enemy_1171_durokt', 'enemy_1171_durokt_2'].includes(record.prefabKey)
    || record.skills.length !== 1 || !matches(record.skills[0], { prefabKey: 'RecoverAnim', cooldown: 0, initCooldown: 0, spCost: 0 })
    || Object.keys(record.skills[0].bb).length || !hoverModeVisualNative(record,n)) return false;
  const root = n[record.prefabKey]?.[0];
  if (root?._modes.length !== 2 || root._commonAbilities.length) return false;
  const air = n.$ref(root._modes[0]), ground = n.$ref(root._modes[1]);
  const passive = n.$ref(air?._generalAbilities?.[0]), buff = passive?._buffs?.[0];
  const groundCombat = n.$ref(ground?._combat), attack = n.$ref(ground?._attack);
  const cast = n.RecoverAnim?.find(row => '_actions' in row), wrapper = n.RecoverAnim?.find(row => '_familyMask' in row);
  if (air?._generalAbilities.length !== 1 || ground?._generalAbilities.length !== 1 || !zero(ground._generalAbilities[0])
    || passive?._buffs.length !== 1 || !zero(passive._selector)
    || !matches(buff, { templateKey: 'enemy_durokt[fly]', lifeTimeType: 2, lifeTime: 0, loadFromDB: 0,
      isSilenceable: 0, isStunnable: 1, isFreezable: 1, isGroundBoundable: 1, isLevitatable: 1, maxStackCnt: 1 })
    || buff.attributes.abnormalFlags.join() !== '8' || buff.attributes.attributeModifiers.length
    || ['abnormalAntis', 'abnormalComboImmunes', 'abnormalCombos', 'abnormalImmunes'].some(key => buff.attributes[key].length)
    || JSON.stringify(buff.blackboard) !== JSON.stringify([{ key: 'motion', value: 1, valueStr: '' }, { key: 'mode', value: 1, valueStr: '' }])
    || groundCombat !== attack || !matches(groundCombat, { _attackType: 1, _damageType: 1, _atkScale: 1,
      _useDynamicAttackType: 0, _selectTargetSource: 2 }) || !zero(groundCombat._selector) || groundCombat._activeBuffs.length
    || !matches(wrapper, { _familyMask: 1, _ignoreSilence: 1, _maxTriggerTime: 1, _castLikeAttack: 0 })
    || !matches(cast, { _animKey: 'Change', _timeMode: 1, _allowNoTarget: 1 }) || cast._activeBuffs.length
    || cast._actions.SerializedState !== '[]') return false;
  const events = n.$template('enemy_durokt[fly]')?.eventToActions, disable = events?.ON_BUFF_DISABLE, finish = events?.ON_BUFF_FINISH;
  return Object.keys(events ?? {}).sort().join() === 'ON_BUFF_DISABLE,ON_BUFF_FINISH,ON_BUFF_START'
    && events.ON_BUFF_START.length === 1 && events.ON_BUFF_FINISH.length === 5 && disable?.length === 2
    && matches(events.ON_BUFF_START[0], { $type: 'Torappu.Battle.Action.Nodes+ChangeMotionMode, Assembly-CSharp',
      _target: 'BUFF_OWNER', _resetToDefault: false, _motionMode: 'WALK' })
    && matches(finish[0], { $type: 'Torappu.Battle.Action.Nodes+ChangeMotionMode, Assembly-CSharp',
      _target: 'BUFF_OWNER', _resetToDefault: true, _motionMode: 'WALK' })
    && matches(finish[1], { $type: 'Torappu.Battle.Action.Nodes+CreateEffect, Assembly-CSharp', _targetType: 'BUFF_OWNER', _sourceType: 'BUFF_OWNER' })
    && matches(finish[2], { $type: 'Torappu.Battle.Action.Nodes+UpdateEnemyCurrentTile, Assembly-CSharp', _ownerType: 'BUFF_OWNER', _force: true })
    && matches(finish[3], { $type: 'Torappu.Battle.Action.Nodes+FilterDeathReason, Assembly-CSharp', _source: 'BUFF_OWNER', _finishReason: 'NONE' })
    && matches(finish[4], { $type: 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp', _buffOwner: 'BUFF_OWNER' })
    && matches(finish[4]._buff, { templateKey: 'empty', loadFromDB: false, lifeTimeType: 'IMMEDIATELY' })
    && emptyOutcomeAttributes(finish[4]._buff.attributes) && finish[4]._buff.blackboard.length === 0
    && matches(disable[0], { $type: 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp',
      _loadModeFromBlackboard: true, _restoreDefault: false, _restartFSM: false, _targetType: 'TARGET' })
    && matches(disable[1], { $type: 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp', _buffOwner: 'BUFF_OWNER' })
    && matches(disable[1]._buff, { buffKey: 'stun', loadFromDB: true, lifeTimeType: 'LIMITED' })
    && JSON.stringify(disable[1]._buff.blackboard) === JSON.stringify([{ key: 'stun', value: .5, valueStr: null }]);
}
