// SPDX-License-Identifier: GPL-3.0-or-later
import { emptyOutcomeAttributes, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
const match = (row, fields) => !!row && Object.entries(fields).every(([key, value]) => row[key] === value);
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const type = (node, name) => node?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const actionBuff = (buff, template, life) => emptyOutcomeAttributes(buff?.attributes) && match(buff, {
  templateKey: template, lifeTimeType: life, lifeTime: 0, loadFromDB: false, isDurableBuff: false,
  isSilenceable: false, isStunnable: false, isFreezable: false, isLevitatable: false,
  independentCharacterSource: false, maxStackCnt: 1, triggerCnt: 0,
}) && buff.blackboard?.length === 0;
export function portalNative(record, n) {
  if (record.prefabKey !== 'enemy_2067_skzcy' || record.applyWay !== 'MELEE' || record.stats.dmgType !== 'arts'
    || record.skills.length || Object.keys(record.talents.groups).join() !== '1'
    || record.talents.groups['1'].join() !== 'effect_duration' || record.talents.bb['1.effect_duration'] !== 10) return false;
  const root = n[record.prefabKey]?.[0], mode = n.Default?.[0], combat = n.Combat?.[0], ability = n['1']?.[0];
  const named = n.JustSelector?.[0], selector = n.$ref(named?._selector);
  if (root?._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length !== 1
    || n.$ref(root._commonAbilities[0]) !== named || mode?._generalAbilities.length || !zero(mode._attack)
    || !zero(mode._attackTrigger) || n.$ref(mode._combat) !== combat
    || !match(combat, { _attackType: 1, _damageType: 2, _atkScale: 1, _epDamageRatio: 0, _extraDamageType: 0,
      _timeMode: 0, _waitForAttackEvent: 1, _selectTargetSource: 2, _allowNoTarget: 0, _alwaysIncludeTarget: 1 })
    || combat._activeBuffs.length || !zero(combat._selector)
    || ability?.m_Script?.m_PathID !== '3800760148018415462' || !zero(ability._selector)
    || ability._buffs?.length !== 2 || !match(ability, { _forceAsDmgOrHealAbility: 0,
      _ignoreIfOwnerDead: 0, _attachPassiveBuffsOnDummy: 1 })
    || named?._metadata?.namedAsAlias !== 'JustSelector'
    || !match(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _needProfessionMask: 1,
      _professionMask: 639, _postFilter: 34, _sortByTauntAtLast: 0, _limitTargetNum: 1, _maxNum: 1,
      _ignoreTargetFree: 1, _onlyIgnoreSomeOfTargetFreeCase: 0, _forceIgnoreCamouflage: 1,
      _buffKey: 'enemy_entlec_self_mark', _buffKeyExcluded: 1, _filterBuffSource: 0,
      _excludeSomeAbnormalFlags: 0, _checkUnitType: 0, _filterTag: '', _filterTokenHost: 0, _checkOrInsteadOfAnd: 0 })
    || selector._filterTagList.length || selector._buffs.length) return false;
  const [effect, birth] = ability._buffs;
  if (!passiveOutcomeBuff(effect) || effect.templateKey !== 'skzcy_t[first_step]'
    || JSON.stringify(effect.blackboard) !== JSON.stringify([{ key: 'respawn_disabled', value: 1, valueStr: '' }])
    || !passiveOutcomeBuff({ ...birth, lifeTimeType: 2 }) || birth.lifeTimeType !== 1
    || birth.templateKey !== 'empty' || birth.durationKey !== 'effect_duration' || birth.blackboard.length) return false;
  const first = n.$template('skzcy_t[first_step]')?.eventToActions;
  if (Object.keys(first ?? {}).sort().join() !== 'ON_BUFF_START,ON_OWNER_KILLED'
    || first.ON_OWNER_KILLED.length !== 1 || first.ON_BUFF_START.length !== 1) return false;
  const select = first.ON_OWNER_KILLED[0], visual = first.ON_BUFF_START[0];
  if (!type(select, 'CreateBuffUseAbilitySelector') || !match(select, { _sourceType: 'SOURCE', _targetType: 'TARGET',
    _abilityName: 'JustSelector', _excludeTarget: false, _isDerivedBuff: false })
    || !actionBuff(select._buff, 'skzcy_t[ban_card]', 'IMMEDIATELY')
    || !type(visual, 'CreateBuff') || visual._buffOwner !== 'BUFF_OWNER'
    || !actionBuff(visual._buff, 'empty', 'INFINITY')
    || Object.keys(n.$template('empty')?.eventToActions ?? { missing: true }).length) return false;
  const events = n.$template('skzcy_t[ban_card]')?.eventToActions, actions = events?.ON_BUFF_START;
  if (Object.keys(events ?? {}).join() !== 'ON_BUFF_START' || actions?.length !== 5) return false;
  const [card, deck, log, next, kill] = actions;
  return type(card, 'CreateCardBuff') && match(card, { _target: 'BUFF_OWNER', _lifeType: 'ALL_THE_TIME',
    _isRatio: false, _enableMaxStackCount: false, _filterIsInHand: false, _useCardBuffKey: false, _cardBuffKey: '' })
    && type(deck, 'CreateDeckBuff') && match(deck, { _randomOneDeckCard: false, _filterIsInHand: false,
      _exceptTokenAndTrap: false, _onlyTokenAndTrap: false, _excludeTarget: false, _onlyToTarget: true, _target: 'BUFF_OWNER' })
    && match(deck._deckBuff, { cardEffectType: 'DEVOURED', lifeType: 'ALL_THE_TIME', affectInHand: false,
      affectOutOfHand: false, showToastWhenAffect: false })
    && deck._deckBuff.buff.templateKey === 'empty'
    && Object.values(deck._deckBuff.buff.attributes ?? {}).every(v => v === null)
    && type(log, 'LogExtraBattleInfoInstId') && match(log, { _target: 'BUFF_OWNER', _key: 'rogue_first_step' })
    && type(next, 'AlwaysNext') && type(kill, 'InstantKill') && match(kill, { _targetType: 'BUFF_OWNER',
      _killSource: false, _noSource: false, _withdrawIfRallyPoint: false, _resultIfInRallyPointMode: false,
      _skipReborn: false, _noReason: false, _markReachExit: false, _switchState: false });
}
export const PORTAL_FEATURES = Object.freeze({
  'ability:Temporarily removes an Operator from the squad when it disappears.': {
    covers: portalNative, nativeClaim: () => ({ active: 1 }),
    ability: { kind: 'portalCardRemoval', params: () => ({}) },
    note: 'On native ON_OWNER_KILLED, selects the newest-created eligible ground operator, excludes Entelechia self-mark, disables its card for this battle and invokes ordinary instant-kill/rebirth. Records the removed operator identity for the caller. Birth alert duration is visual; run return timing is outside individual-stage scope.',
  },
});
