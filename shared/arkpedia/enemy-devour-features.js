// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-devour-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const is = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
const ids = ['enemy_1271_nhkodo', 'enemy_1271_nhkodo_2'];
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
export function devourNative(r, n) {
  const clock = clocks.enemies[r.prefabKey];
  if (!clock || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys' || r.skills.length !== 1
    || !same(Object.keys(r.talents.groups), ['Stronger'])
    || !same(r.talents.bb, { 'Stronger.def': 700, 'Stronger.move_speed': -.3 })
    || !fields(r.skills[0], { prefabKey: 'Devour', cooldown: -1, initCooldown: 0, spCost: 0, bb: {}, bbStr: {} })) return false;
  const root = n[r.prefabKey]?.[0], wrapper = n.Devour?.find(c => '_familyMask' in c), cast = n.Devour?.find(c => '_activeBuffs' in c);
  const trigger = n.$ref(wrapper?._trigger), selectors = n.$siblings(trigger), selector = selectors.find(c => '_postFilter' in c);
  const validator = n.$ref(selector?._validatorFilterSettings?.[0]?.validator), strong = n.Stronger?.find(c => '_buffs' in c);
  if (root?._modes.length !== 2 || root._commonAbilities.length || root._sideTypeIndex !== 1
    || !fields(wrapper, { _familyMask: 2, _ignoreSilence: 1, _immuneStunWhenAffecting: 0, _castLikeAttack: 0,
      _resetMainAbilityCdWhenCastEnd: 1, _resetCdWaitFirstPeriod: 1, _maxTriggerTime: -1 })
    || !fields(trigger, { _keepTarget: 0, _minTargetNum: 1 })
    || !fields(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4,
      _ignoreTargetFree: 1, _forceIgnoreCamouflage: 0, _needProfessionMask: 1, _professionMask: 767,
      _limitTargetNum: 1, _maxNum: 1, _excludeSomeAbnormalFlags: 0 })
    || selector._validatorFilterSettings.length !== 1
    || !fields(validator, { _isUnset: 1, _tags: ['DEVOUR_IMMU'], _isAnd: 0 })
    || !fields(cast, { _animKey: 'Attack_A', _waitForAttackEvent: 1, _interuptIfTargetDead: 1,
      _selectTargetSource: 2, _selectTargetTiming: 0, _timeMode: 0, _atkScale: 0, _affectedBySlowDown: 1 })
    || cast._activeBuffs.length !== 1 || !fields(cast._activeBuffs[0], {
      templateKey: 'enemy_nhkodo_t[devour_holder]', lifeTimeType: 0, blackboard: [] })
    || !empty(cast._activeBuffs[0].attributes)) return false;
  for (let i = 0; i < 2; i++) {
    const mode = n.$ref(root._modes[i]), combat = n.$ref(mode?._combat);
    if (!mode || mode._generalAbilities.length || !zero(mode._attack) || !zero(mode._attackTrigger)
      || !fields(combat, { _animKey: i ? 'Attack_B' : 'Attack_A2', _atkScale: 1, _attackType: 1,
        _damageType: 1, _activeBuffs: [], _waitForAttackEvent: 1, _affectedBySlowDown: 1 })) return false;
  }
  const buff = strong?._buffs?.[0];
  if (strong?._buffs.length !== 1 || !fields(buff, { buffKey: 'enemy_nhkodo_buff', templateKey: 'empty',
    lifeTimeType: 2, isSilenceable: 0, blackboard: [] }) || !same(buff.attributes.attributeModifiers, [
      { attributeType: 2, formulaItem: 0, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 },
      { attributeType: 6, formulaItem: 1, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 },
    ]) || !empty({ ...buff.attributes, attributeModifiers: [] })) return false;
  const holder = n.$template('enemy_nhkodo_t[devour_holder]')?.eventToActions;
  const create = holder?.ON_BUFF_START?.[0], change = holder?.ON_BUFF_START?.[1];
  if (!same(Object.keys(holder ?? {}), ['ON_BUFF_START']) || holder.ON_BUFF_START.length !== 2
    || !is(create, 'CreateBuffUseTargetAsSource') || !fields(create, { _buffOwner: 'SOURCE', _target: 'TARGET', _isDerivedBuff: false })
    || !fields(create._buff, { templateKey: 'enemy_nhkodo_t[devour]', buffKey: 'enemy_nhkodo_t_devour',
      lifeTimeType: 'INFINITY', blackboard: [{ key: 'respawn_disabled', value: 1, valueStr: '' }] }) || !empty(create._buff.attributes)
    || !is(change, 'CreateBuff') || change._buffOwner !== 'SOURCE'
    || !fields(change._buff, { templateKey: 'switch_mode_no_restore', lifeTimeType: 'IMMEDIATELY',
      blackboard: [{ key: 'Mode', value: 1, valueStr: '' }] }) || !empty(change._buff.attributes)) return false;
  const switchAction = n.$template('switch_mode_no_restore')?.eventToActions.ON_BUFF_START;
  if (switchAction?.length !== 1 || !is(switchAction[0], 'SwitchMode')
    || !fields(switchAction[0], { _loadModeFromBlackboard: true, _restoreDefault: false, _restartFSM: true })) return false;
  const events = n.$template('enemy_nhkodo_t[devour]')?.eventToActions, branch = events?.ON_BUFF_START?.[0];
  if (!same(Object.keys(events ?? {}), ['ON_BUFF_START', 'ON_BUFF_FINISH']) || events.ON_BUFF_START.length !== 1
    || !is(branch, 'IfElse') || !is(branch._conditionNode, 'IsCharacter') || branch._conditionNode._targetType !== 'SOURCE'
    || branch._succeedNodes.length !== 5 || branch._failNodes.length !== 1 || events.ON_BUFF_FINISH.length !== 2) return false;
  const [card, deck, uid, next, kill] = branch._succeedNodes, fallback = branch._failNodes[0];
  if (!is(card, 'CreateCardBuff') || !fields(card, { _target: 'SOURCE', _lifeType: 'HOLD_BY_BUFF', _isRatio: false })
    || !is(deck, 'CreateDeckBuff') || !fields(deck, { _onlyToTarget: true, _target: 'SOURCE' })
    || !fields(deck._deckBuff, { cardEffectType: 'DEVOURED', lifeType: 'ALL_THE_TIME' })
    || !fields(deck._deckBuff.buff, { buffKey: 'nhkodo_deck', templateKey: 'empty' })
    || !is(uid, 'AssignCardUIDToBlackBoard') || uid._blackBoardKey !== 'card_uid'
    || !is(next, 'AlwaysNext') || !is(kill, 'InstantKill')
    || !fields(kill, { _killSource: true, _skipReborn: false, _noReason: false, _markReachExit: false })
    || !is(fallback, 'IfElse') || !is(fallback._conditionNode, 'CheckFilterTag')
    || fallback._conditionNode._filterTag !== 'DEVOUR_IMMU' || fallback._failNodes.length !== 1
    || !is(fallback._failNodes[0], 'InstantKill') || fallback._failNodes[0]._skipReborn !== false
    || !is(events.ON_BUFF_FINISH[0], 'FinishCardBuff') || !is(events.ON_BUFF_FINISH[1], 'FinishDeckBuffByCardUIDAndKey')
    || !fields(events.ON_BUFF_FINISH[1], { _blackBoardKey: 'card_uid', _deckBuffKey: 'nhkodo_deck' })) return false;
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && ['Attack_A', 'Attack_A2', 'Attack_B'].every(clip => same(clock.events[clip],
      [{ time: Math.fround(25 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }]));
}
const matchesRecord = r => ids.includes(r.prefabKey);
export const DEVOUR_FEATURES = {
  'skill:Devour': { matchesRecord, covers: devourNative, nativeClaim: () => ({ wrappers: 1 }),
    ability: { kind: 'witherDevourer', params: r => {
      const c = clocks.enemies[r.prefabKey]; return { def: r.talents.bb['Stronger.def'], move: r.talents.bb['Stronger.move_speed'],
        release: c.events.Attack_A[0].time, duration: c.durations.Attack_A,
        attacks: ['Attack_A2', 'Attack_B'].map(clip => ({ clip, duration: c.durations[clip], releases: c.events[clip].map(e => e.time) })) };
    } } },
  'talent:Stronger': { matchesRecord, covers: devourNative },
  'ability:When blocked for the first time, devours the blocker. DEF is greatly increased, but Movement Speed is reduced': { matchesRecord, covers: devourNative },
  'ability:Returns devoured Operator when defeated': { matchesRecord, covers: devourNative },
};
