// SPDX-License-Identifier: GPL-3.0-or-later
import environmentSource from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty, passiveOutcomeBuff as passive } from './enemy-outcome-contracts.js';
const fields = (v, x) => !!v && Object.entries(x).every(([k, expected]) => same(v[k], expected));
const action = (name, fields = {}) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export const DREADKAZ = 'enemy_2065_skzjs', EPOCH_MARK = 'enemy_2088_skzdwz';
export const isDreadkaz = r => r.prefabKey === DREADKAZ;
export const isEpochMark = r => r.prefabKey === EPOCH_MARK;
const templateBuff = (b, key, lifetime = 'INFINITY') => fields(b, { buffKey: key, templateKey: key,
  loadFromDB: false, lifeTimeType: lifetime, isDurableBuff: false, isSilenceable: false,
  isStunnable: false, isFreezable: false, isLevitatable: false, blackboard: [], triggerCnt: 0 }) && empty(b.attributes);
const derived = (node, key) => fields(node, { $type: action('CreateBuff').$type, _buffOwner: 'BUFF_OWNER',
  _isDerivedBuff: true, _finishDerivedBuffIfParentFinish: true, _useSpecialBuffSource: false })
  && fields(node._buff, { buffKey: key, loadFromDB: false, lifeTimeType: 'INFINITY', overrideType: 'UNIQUE',
    maxStackCnt: 1, independentCharacterSource: false, isSilenceable: false, isStunnable: false,
    isFreezable: false, isLevitatable: false, blackboard: [] }) && empty(node._buff.attributes);
function ordinaryRoot(r, n, side) {
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0];
  return root?._sideTypeIndex === side && root._commonAbilities.length === 0 && root._modes.length === 1
    && n.$ref(root._modes[0]) === mode && mode._generalAbilities.every(zero) && zero(mode._attackTrigger)
    && r.skills.length === 0;
}
const rangeReviewed = n => same(n.$range('x-4'), { id: 'x-4', direction: 1,
  grids: [1, 0, -1].flatMap(row => [-1, 0, 1].map(col => ({ row, col }))) });

/** The tile environment is shared by every Mark emitter. It owns one recipient
 * clock, even when multiple tile regions overlap. */
export function epochEnvironmentNative(source = environmentSource) {
  const rows = source.prefabs?.['rogue_4_apoptosis[random_tile]'], c = rows?.[0]?.data, buff = c?._buffs?.[0];
  if (rows?.length !== 1 || c.m_Script.m_PathID !== '-1154975798789204242'
    || !fields(c, { _key: '[g]rogue_4_apoptosis', _sourceType: 0, _deckBuffs: [], _excludeBorderTiles: 0,
      _buildableType: 3, _weightType: 1, _tickForEnemy: 1, _tickInterval: Math.fround(.3) })
    || c._buffs.length !== 1 || !passive(buff) || !fields(buff, { templateKey: 'rogue_4_apoptosis',
      buffKey: '[g]rogue_4_apoptosis', disableOverride: 0, overrideType: 0, independentCharacterSource: 0, blackboard: [] })
    || !same(c._options, { targetSide: 3, targetMotion: 3, targetCategory: 1, enableAdvancedOptions: 0,
      ignoreTargetFree: 0, ignoreAllyTargetFree: 0, ignoreHealFree: 0, ignoreMotionMode: 0, ignoreTargetSide: 0,
      excludeSomeAbnormalFlags: 0, containSomeAbnormalFlags: 0, excludeAbnormalFlag: 0, containAbnormalFlag: 0,
      purposeMask: 0, professionMask: 0, checkUnitType: 0, unitTypeMask: 0, onlyIgnoreSomeOfTargetFreeCase: 0,
      abnormalFlag: 0, abnormalCombo: 0 })) return false;
  const events = source.templates?.rogue_4_apoptosis?.eventToActions, branch = events?.ON_BUFF_START?.[0];
  if (!same(Object.keys(events ?? {}), ['ON_BUFF_START']) || events.ON_BUFF_START.length !== 1
    || !fields(branch, { $type: action('IfElse').$type,
      _conditionNode: action('IfTargetSide', { _sideMask: 'ALLY', _targetType: 'BUFF_OWNER' }) })
    || branch._succeedNodes.length !== 3 || branch._failNodes.length !== 1
    || !derived(branch._succeedNodes[0], 'rogue_4_apoptosis[ally]')
    || !fields(branch._succeedNodes[0]._buff, { templateKey: 'rogue_4_apoptosis[ally]', triggerInterval: 1,
      waitFirstTriggerInterval: true, firstTriggerInterval: -1, triggerLifeType: 'INFINITY' })
    || !same(branch._succeedNodes[1], action('CheckGlobalBuffExistByKey', { _globalBuffKey: 'rogue_4_disaster_buff_8' }))
    || !derived(branch._failNodes[0], 'rogue_4_apoptosis[enemy]')
    || !fields(branch._failNodes[0]._buff, { templateKey: 'empty', stripBlackboardParamsWithBuffKey: true })) return false;
  const lock = branch._succeedNodes[2];
  if (!fields(lock, { $type: action('CreateBuff').$type, _buffOwner: 'BUFF_OWNER', _isDerivedBuff: true,
    _finishDerivedBuffIfParentFinish: true }) || !fields(lock._buff, { buffKey: 'rogue_4_apoptosis[not_withdrawable]',
    templateKey: 'empty', lifeTimeType: 'INFINITY', loadFromDB: false })
    || !same(lock._buff.attributes.abnormalFlags, ['NOT_WITHDRAWABLE'])
    || !empty({ ...lock._buff.attributes, abnormalFlags: [] })) return false;
  return same(source.templates?.['rogue_4_apoptosis[ally]']?.eventToActions, { ON_BUFF_TRIGGER: [
    action('CheckFilterTag', { _targetType: 'BUFF_OWNER', _filterTag: 'rogue_4_skhbox', _bbKey: 'tag' }), action('IfNot'),
    action('ApplyElementDamage', { _elementDamageType: 'DARK', _sourceType: 'SOURCE', _isFixedEpDamage: true,
      _baseOnHostAtk: false, _baseOnEnemyHostAtk: false, _fixedEpDamageKey: 'element_damage', _fixedEpDamage: 0,
      _noSource: true, _forceUseProjectileCachedAtk: false, _multiplyWithBuffValidStackCnt: false, _buffKey: null,
      _buffSourceType: 'BUFF_SOURCE', _targetType: 'BUFF_OWNER', _isEnvElementDamage: false,
      _loadElementTypeFromBb: false, _fixedEpDamageScale: '', _epDamageScale: 'ep_damage_ratio' }),
  ] });
}
export function epochMarkNative(r, n) {
  if (!isEpochMark(r) || !ordinaryRoot(r, n, 2) || r.applyWay !== 'NONE' || r.stats.motion !== 'FLY'
    || r.stats.moveSpeed !== 0 || r.stats.lpr !== 0 || !same(r.talents.bb, { 'Apoptosis.element_damage': 100 })
    || !same(r.talents.bbStr, { 'Apoptosis.range_id': 'x-4' }) || !rangeReviewed(n) || !epochEnvironmentNative()) return false;
  const mode = n.Default[0], combat = n.EmptyCombat?.[0], ability = n.Apoptosis?.[0], buff = ability?._buffs?.[0];
  if (!zero(mode._attack) || n.$ref(mode._combat) !== combat || combat?._activeBuffs.length !== 0
    || combat.m_Script.m_PathID !== '8145049199648393782' || combat._animKey !== ''
    || ability?._buffs.length !== 1 || !fields(buff, { buffKey: 'enemy_fake_t_apoptosis', templateKey: 'enemy_fake_t_apoptosis', blackboard: [] })
    || !same(buff.attributes.abnormalFlags, [22, 2, 5]) || !passive({ ...buff, attributes: { ...buff.attributes, abnormalFlags: [] } })) return false;
  const selector = n.$ref(ability._selector), range = n.$siblings(selector).find(c => c.m_Script.m_PathID === '-2891200616113119906');
  if (!fields(range, { _extendable: 0, _useBlackboardRangeId: 0 })
    || selector?.m_Script.m_PathID !== '-7891991905135157257'
    || !fields(selector, { _limitTargetNum: 0, _ignoreHitRange: 0, _excludeOwnerRootTile: 0, _filterType: 0,
      _extraFilterTypeList: [], _blackboardKeys: [], _enemyKeys: [], _tileOrTokenIdListPreferred: [],
      _excludeAllCharacter: 0, _excludeCamouflagCharacter: 0, _checkUnitType: 0, _needProfessionMask: 0 })
    || !['_options'].every(k => ['buildableType', 'checkBuildableOrPassable', 'checkExtraBuildableCheckers',
      'checkHeightType', 'checkTileHidden', 'checkTileMode', 'checkTileMoveCost', 'checkTileTypes'].every(f => selector[k][f] === 0))) return false;
  const binding = { _abilitySource: 'SOURCE', _selectorTarget: 'TARGET', _abilityName: 'Apoptosis',
    _globalBuffPrefabKey: 'rogue_4_apoptosis[random_tile]', _globalBuffKey: '[g]rogue_4_apoptosis' };
  if (!same(n.$template('enemy_fake_t_apoptosis')?.eventToActions, {
    ON_BUFF_START: [action('CreateTileBindingGlobalBuff', binding)], ON_BUFF_FINISH: [action('RemoveTileBindingGlobalBuff', binding)] })) return false;
  const visual = n.EffectAura?.[0], events = n.$template('Dark_Effect_x_4')?.eventToActions;
  return visual?._buffs.length === 1 && passive(visual._buffs[0]) && visual._buffs[0].templateKey === 'Dark_Effect_x_4'
    && same(Object.keys(events ?? {}), ['ON_BUFF_START']) && events.ON_BUFF_START.length === 2
    && same(events.ON_BUFF_START[0], action('IsCharacterOrTokenOrTrap', { _targetType: 'BUFF_OWNER' }))
    && fields(events.ON_BUFF_START[1], { $type: action('CreateBuff').$type, _isDerivedBuff: true, _finishDerivedBuffIfParentFinish: true })
    && fields(events.ON_BUFF_START[1]._buff, { templateKey: 'empty', loadFromDB: false, lifeTimeType: 'INFINITY', blackboard: [] })
    && empty(events.ON_BUFF_START[1]._buff.attributes);
}
export function dreadkazNative(r, n) {
  if (!isDreadkaz(r) || !ordinaryRoot(r, n, 1) || r.applyWay !== 'MELEE'
    || !same(r.talents.bb, { '1.damage_scale': .5, '1.exist_duration': 30 }) || Object.keys(r.talents.bbStr).length || !rangeReviewed(n)) return false;
  const birth = n['1']?.[0], buff = birth?._buffs?.[0], combat = n.Combat?.[0];
  if (birth?._buffs.length !== 1 || !passive(buff) || !fields(buff, { buffKey: 'skzjs_t[born]', templateKey: 'skzjs_t[born]',
    blackboard: [{ key: 'born_delay_duration', value: Math.fround(.1), valueStr: '' }] })
    || !fields(combat, { _atkScale: 1, _damageType: 1, _extraDamageType: 0, _epDamageRatio: 0, _activeBuffs: [], _attackType: 1 })) return false;
  const born = n.$template('skzjs_t[born]')?.eventToActions;
  if (!same(Object.keys(born ?? {}), ['ON_OWNER_BORN']) || born.ON_OWNER_BORN.length !== 1
    || !fields(born.ON_OWNER_BORN[0], { $type: action('CreateBuff').$type, _buffOwner: 'BUFF_OWNER', _isDerivedBuff: false })
    || !templateBuff(born.ON_OWNER_BORN[0]._buff, 'skzjs_t[born_action]', 'LIMITED')
    || born.ON_OWNER_BORN[0]._buff.durationKey !== 'born_delay_duration') return false;
  const events = n.$template('skzjs_t[born_action]')?.eventToActions, rows = events?.ON_BUFF_FINISH;
  if (!same(Object.keys(events ?? {}), ['ON_BUFF_FINISH']) || rows.length !== 5
    || !same(rows[0], action('PlayAudio', { _target: 'BUFF_OWNER', _audioSignal: 'skzjs_delay_born_audio' }))
    || !same(rows[1], action('AlwaysNext')) || !fields(rows[2], { $type: action('CreateEffect').$type, _effectKey: 'skzjs_start' })) return false;
  const hit = rows[3], summon = rows[4];
  return fields(hit, { $type: action('AOEDamage').$type, _sourceType: 'BUFF_SOURCE', _targetType: 'BUFF_OWNER',
    _useAbilitySourceSide: true, _damageType: 'MAGICAL', _sourceApplyWay: 'MELEE', _excludeTarget: true,
    _rangeId: 'x-4', _useRadius: false, _useAbilitySelector: false, _damageScale: 'damage_scale',
    _attackType: 'NORMAL', _useDamageFromBB: false, _isNoSourceDamage: false, _checkTargetAlive: false })
    && fields(hit._targetOptions, { targetSide: 'ENEMY', targetMotion: 'ALL', targetCategory: 'DEFAULT',
      enableAdvancedOptions: true, ignoreTargetFree: false, ignoreAllyTargetFree: false, ignoreHealFree: false,
      ignoreTargetSide: false, excludeSomeAbnormalFlags: false, onlyIgnoreSomeOfTargetFreeCase: false })
    && hit._buffs.length === 1 && hit._buffs[0].templateKey === 'empty'
    && Object.values(hit._buffs[0].attributes).every(v => v === null)
    && fields(summon, { $type: action('UnitSummonApopsisEnemy').$type, _source: 'BUFF_OWNER', _enemyKey: EPOCH_MARK,
      _motionMode: 'FLY', _unharmful: false, _alwaysCountAsKilled: false, _addBuffToEnemy: true })
    && templateBuff(summon._buffToEnemy, 'skzjs_t[suicide]', 'LIMITED') && summon._buffToEnemy.durationKey === 'exist_duration'
    && same(n.$template('skzjs_t[suicide]')?.eventToActions, { ON_BUFF_FINISH: [action('InstantKill', {
      _targetType: 'BUFF_OWNER', _killSource: false, _noSource: false, _withdrawIfRallyPoint: false,
      _resultIfInRallyPointMode: false, _skipReborn: false, _noReason: false, _markReachExit: false, _switchState: false })] });
}
export const EPOCH_MARK_FEATURE = {
  matchesRecord: isEpochMark, covers: epochMarkNative, unitProperties: { side: 'neutral' },
  ability: { kind: 'epochMark', params: r => ({ amount: r.talents.bb['Apoptosis.element_damage'], interval: 1, enemyInterval: Math.fround(.3) }) },
  note: 'Stationary neutral tile emitter. Overlapping Marks share one sourceless apoptosis clock; removal detaches only its region.',
};
export const DREADKAZ_ABILITY = { kind: 'dreadkazBirth', params: r => ({ delay: Math.fround(.1),
  scale: r.talents.bb['1.damage_scale'], duration: r.talents.bb['1.exist_duration'], child: EPOCH_MARK }) };
export const DREADKAZ_TEXT = /^When spawned, deals Arts damage to all allied units around its tile and creates a temporary Mark of Epoch\.$/;
