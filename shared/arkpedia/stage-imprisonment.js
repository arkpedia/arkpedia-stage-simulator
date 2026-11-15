// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const is = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export function imprisonmentNativeReviewed(n) {
  const tokenRows = n.prefabs.trap_025_prison?.components ?? [], parts = tokenRows.map(c => c.data);
  const root = parts.find(c => '_modes' in c), mode = parts.find(c => '_tileOptions' in c), passive = parts.find(c => '_buffs' in c);
  const buff = passive?._buffs?.[0];
  if (!fields(root, { _sideType: 1, _category: 1, _occupiedRemainingCharacterCnt: 0, _withdrawable: 0,
      _rewriteTileOptions: 1, _filterTag: ['prison'] }) || root._modes.length !== 1 || root._commonAbilities.length !== 1
    || mode?._combat.m_PathID !== '0' || mode._attack.m_PathID !== '0' || mode._generalAbilities.length
    || !fields(mode._tileOptions, { buildableType: 0, passableMask: 2, overrideObstacleLikeMoveCost: 0 })
    || root._modes[0].m_PathID !== tokenRows.find(c => c.data === mode)?.pathId
    || root._commonAbilities[0].m_PathID !== tokenRows.find(c => c.data === passive)?.pathId
    || root._traitAbility.m_PathID !== '0'
    || passive?._buffs.length !== 1 || !fields(buff, { buffKey: 'confin_target_free', templateKey: 'log_born',
      lifeTimeType: 2, isSilenceable: 0 }) || !same(buff.attributes.abnormalFlags, [7, 15])
    || !same(buff.attributes.abnormalImmunes, [0, 16]) || !same(buff.attributes.abnormalComboImmunes, [])
    || !empty({ ...buff.attributes, abnormalFlags: [], abnormalImmunes: [] })) return false;
  const skillRows = n.prefabs.sktok_prison?.components ?? [], skill = skillRows.map(c => c.data);
  const account = skill.find(c => '_allowSpRecoveryWhenAffecting' in c), cast = skill.find(c => '_activeBuffs' in c);
  const select = skill.find(c => '_targetSide' in c), trigger = skill.find(c => '_minTargetNum' in c), group = skill.find(c => '_abilities' in c);
  const effects = skill.find(c => c._buffs?.some(b => b.templateKey === 'trap_prison_effect'))?._buffs;
  if (!fields(account, { _allowSpRecoveryWhenAffecting: 0, _canCastWithNoSp: 0, _canSilenced: 0,
      _canUseInAbnormalState: 0, _allowNoTarget: 0, _useTriggerInManualMode: 1, _extraAbilities: [] })
    || !fields(cast, { _waitForAttackEvent: 0, _selectTargetSource: 1, _selectTargetTiming: 0, _timeMode: 2,
      _cooldown: Math.fround(4.17), _preDelay: 0, _animKey: 'Attack', _affectedBySlowDown: 0 })
    || !fields(select, { _targetSide: 2, _targetMotion: 3, _targetCategory: 1, _limitTargetNum: 0,
      _ignoreTargetFree: 1, _onlyIgnoreSomeOfTargetFreeCase: 1, _abnormalFlag: 20, _forceIgnoreCamouflage: 0 })
    || !fields(trigger, { _minTargetNum: 1, _keepTarget: 0 }) || group?._abilities.length !== 2
    || effects?.length !== 2 || !fields(effects[0], { templateKey: 'trap_prison_effect', lifeTimeType: 2,
      triggerInterval: Math.fround(.1), blackboard: [{ key: 'sp_ratio', value: 1, valueStr: '' }] })
    || !empty(effects[0].attributes) || !empty(effects[1].attributes)
    || effects[1].templateKey !== 'log_killed'
    || account._trigger.m_PathID !== skillRows.find(c => c.data === trigger)?.pathId
    || !group._abilities.some(ref => ref.m_PathID === skillRows.find(c => c.data === cast)?.pathId)) return false;
  const [stun, force] = cast._activeBuffs ?? [];
  if (cast._activeBuffs.length !== 2 || !fields(stun, { buffKey: 'stun', loadFromDB: 1, lifeTimeType: 1 })
    || !fields(force, { buffKey: 'enemy_confinement_force', templateKey: 'enemy_confinement_force', isSilenceable: 0 })
    || !empty(force.attributes)) return false;
  const actions = n.templates.enemy_confinement_force?.eventToActions.ON_BUFF_START;
  return actions?.length === 6 && is(actions[0], 'CheckContainsBuff')
    && same(actions[0]._buffKeys, ['enemy_liberty[state]']) && actions[0]._targetType === 'BUFF_OWNER'
    && is(actions[1], 'SwitchMode') && fields(actions[1], { _modeIndex: 0, _restoreDefault: false, _restartFSM: true })
    && is(actions[2], 'AlwaysNext') && is(actions[3], 'CreateBuff') && empty(actions[3]._buff.attributes)
    && is(actions[4], 'AlwaysNext') && is(actions[5], 'LogExtraBattleInfo') && actions[5]._key === 'prison';
}
