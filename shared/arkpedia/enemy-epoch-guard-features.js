// SPDX-License-Identifier: GPL-3.0-or-later
import clock from '../../data/arkpedia-epoch-guard-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
import { epochEnvironmentNative } from './enemy-epoch-features.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const switchMode = (v, mode) => fields(v, { $type: 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp',
  _modeIndex: mode, _loadModeFromBlackboard: false, _restoreDefault: false, _restartFSM: false, _targetType: 'TARGET' });
export function epochGuardNative(r, n) {
  if (r.prefabKey !== 'enemy_2064_skzwdd' || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys'
    || r.skills.length || Object.keys(r.talents.groups).length || !epochEnvironmentNative()) return false;
  const root = n[r.prefabKey]?.[0], passive = n.MultiAttack?.[0], buff = passive?._buffs?.[0];
  if (root?._modes.length !== 2 || root._commonAbilities.length !== 1 || n.$ref(root._commonAbilities[0]) !== passive
    || root._sideTypeIndex !== 1 || passive._buffs.length !== 1 || !zero(passive._selector)
    || !fields(buff, { buffKey: 'skzwdd_a[multi_attack]', templateKey: 'skzwdd_a[multi_attack]', lifeTimeType: 2,
      triggerLifeType: 2, triggerInterval: Math.fround(.3), waitFirstTriggerInterval: 1, firstTriggerInterval: -1,
      isSilenceable: 0, blackboard: [] }) || !empty(buff.attributes)) return false;
  for (let i = 0; i < 2; i++) {
    const mode = n.$ref(root._modes[i]), combat = n.$ref(mode?._combat);
    if (!mode || !zero(mode._attack) || !zero(mode._attackTrigger) || mode._generalAbilities.length
      || !fields(combat, { _animKey: i ? 'Skill' : 'Attack', _interruptAbilityOnDetach: 1,
        _waitForAttackEvent: 1, _affectedBySlowDown: 1, _selectTargetSource: 2, _selectTargetTiming: 0,
        _alwaysIncludeTarget: 1, _allowNoTarget: 0, _timeMode: 0, _maxAnimScale: 1,
        _atkScale: 1, _attackType: 1, _damageType: 1, _activeBuffs: [] }) || !zero(combat._selector)) return false;
    if (i && !fields(combat, { _additionalTimes: 1, _triggerDelta: 0, _waitAttackEventForAllAttacks: 1,
      _splitDamage: 0, _minPostDelay: 0, _onlyFeedActiveBuffToLastOne: 0, _onlyFeedActiveBuffToFirstOne: 0,
      _refreshInputTargetOnCheckSpell: 0, _refreshTimesOnCastStart: 0, _refreshTimesOnCheckAnotherSpell: 0 })) return false;
  }
  const events = n.$template('skzwdd_a[multi_attack]')?.eventToActions, branch = events?.ON_BUFF_TRIGGER?.[0];
  if (!same(Object.keys(events ?? {}), ['ON_BUFF_TRIGGER']) || events.ON_BUFF_TRIGGER.length !== 1
    || branch?.$type !== 'Torappu.Battle.Action.Nodes+IfElse, Assembly-CSharp'
    || !fields(branch._conditionNode, { $type: 'Torappu.Battle.Action.Nodes+CheckContainsBuff, Assembly-CSharp',
      _targetType: 'BUFF_OWNER', _buffKeys: ['[g]rogue_4_apoptosis'], isAND: true,
      _loadFromBlackboard: false, _checkBuffSource: false, _buffSourceType: 'BUFF_SOURCE', _checkSourceHost: false })
    || branch._succeedNodes.length !== 2 || branch._failNodes.length !== 2
    || !switchMode(branch._succeedNodes[1], 1) || !switchMode(branch._failNodes[1], 0)) return false;
  const create = branch._succeedNodes[0], effect = create._buff;
  if (!fields(create, { $type: 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp', _buffOwner: 'BUFF_OWNER',
      _isDerivedBuff: false, _finishDerivedBuffIfParentFinish: false })
    || !fields(effect, { buffKey: 'skzwdd_a[effect]', templateKey: 'empty', lifeTimeType: 'INFINITY',
      loadFromDB: false, maxStackCnt: 1, isSilenceable: false, blackboard: [] }) || !empty(effect.attributes)
    || !fields(branch._failNodes[0], { $type: 'Torappu.Battle.Action.Nodes+FinishBuffsById, Assembly-CSharp',
      _buffKey: 'skzwdd_a[effect]', _loadFromBlackboard: false, _decCntIfStack: false, _targetType: 'BUFF_OWNER',
      _checkBuffSource: false, _finishHostBuff: false })) return false;
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && same(clock.events.Attack?.map(e => e.time), [Math.fround(20 / 30)])
    && same(clock.events.Skill?.map(e => e.time), [Math.fround(20 / 30), Math.fround(44 / 30)]);
}
export const EPOCH_GUARD_FEATURE = {
  matchesRecord: r => r.prefabKey === 'enemy_2064_skzwdd', covers: epochGuardNative, nativeClaim: () => ({ active: 1 }),
  ability: { kind: 'epochGuard', params: () => ({ interval: Math.fround(.3), animations: ['Attack', 'Skill'].map(clip =>
    ({ clip, duration: clock.durations[clip], releases: clock.events[clip].filter(e => e.name === 'OnAttack').map(e => e.time) })) }) },
};
