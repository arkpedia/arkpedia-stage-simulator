// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-sniper-prisoner-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const is = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export const isSniperPrisoner = r => Object.hasOwn(clocks.enemies, r.prefabKey);
export function sniperPrisonerNative(r, n) {
  const clock = clocks.enemies[r.prefabKey], root = n[r.prefabKey]?.[0];
  if (!clock || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'phys' || r.skills.length
    || !same(Object.keys(r.talents.groups).sort(), ['confinement', 'liberty'])
    || !same(r.talents.bb, { 'liberty.atk': .5, 'confinement.times': 4, 'confinement.attack_speed': -50,
      'confinement.max_stack_cnt': -1, 'confinement.max_valid_stack_cnt': -1 })
    || root?._modes.length !== 3 || root._commonAbilities.length) return false;
  for (let i = 0; i < 3; i++) {
    const mode = n.$ref(root._modes[i]), attack = n.$ref(mode?._attack);
    const trigger = n.$siblings(n.$ref(mode?._attackTrigger)).find(c => '_targetSide' in c);
    if (!mode || mode._generalAbilities.length || n.$ref(mode._combat) !== attack
      || !fields(attack, { _animKey: 'Attack', _projectileKey: i === 2 ? 'projectile_enemy_liiprr_2' : 'projectile_enemy_liiprr',
        _interruptAbilityOnDetach: 0, _selectTargetSource: 2, _selectTargetTiming: 0, _waitForAttackEvent: 1,
        _timeMode: 0, _maxAnimScale: 1, _affectedBySlowDown: 1, _atkScale: 1, _damageType: i === 2 ? 2 : 1,
        _attackType: 1, _activeBuffs: [], _useCachedAtkOnly: 0 })
      || !fields(trigger, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4,
        _secondaryFilter: 2, _filterTag: 'prison', _sortByTauntAtLast: 1, _ignoreTargetFree: 0,
        _forceIgnoreCamouflage: 0, _limitTargetNum: 1, _maxNum: 1 })) return false;
    if (i) {
      const hook = n.$siblings(mode).find(c => '_replaceAnimPairs' in c);
      if (!same(hook?._replaceAnimPairs, ['Default', 'Idle', 'Attack', 'Move', 'Die'].map(fromAnimKey =>
        ({ fromAnimKey, toAnimKey: `${fromAnimKey}${i + 1}` })))) return false;
    }
  }
  const confined = n.Confinement?.filter(c => '_buffs' in c), liberty = n.Liberty?.find(c => '_buffs' in c);
  if (confined?.length !== 2 || liberty?._buffs.length !== 2) return false;
  const ordinary = confined.find(c => c._buffs.length === 1)?._buffs[0];
  const final = confined.find(c => c._buffs.length === 2)?._buffs;
  if (!fields(ordinary, { buffKey: 'enemy_confinement', loadFromDB: 1, templateKey: 'enemy_confinement', isSilenceable: 0 })
    || !fields(final?.[0], { buffKey: 'enemy_confinement_final', loadFromDB: 1, templateKey: 'empty', isSilenceable: 0 })
    || !fields(final?.[1], { templateKey: 'enemy_liberty[warning]', triggerLifeType: 1, triggerCnt: 1,
      triggerInterval: Math.fround(.15), waitFirstTriggerInterval: 1, firstTriggerInterval: -1, isSilenceable: 0 })
    || !fields(liberty._buffs[0], { buffKey: 'liprr_liberty', templateKey: 'empty', lifeTimeType: 2, isSilenceable: 0 })
    || !same(liberty._buffs[0].attributes.attributeModifiers,
      [{ attributeType: 1, formulaItem: 1, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 }])
    || !empty(liberty._buffs[1].attributes) || liberty._buffs[1].buffKey !== 'enemy_liberty[state]') return false;
  for (const key of ['enemy_confinement', 'enemy_confinement_final']) {
    const buff = n.$buff(key);
    if (!fields(buff, { buffKey: key, isSilenceable: false, lifeTimeType: 'INFINITY' })
      || !same(buff.attributes.attributeModifiers, [{ attributeType: 'ATTACK_SPEED', formulaItem: 'ADDITION',
        value: 0, loadFromBlackboard: true, fetchBaseValueFromSourceEntity: false }])) return false;
  }
  const init = n.$template('enemy_confinement')?.eventToActions.ON_BUFF_START;
  const counter = n.$template('enemy_confinement[atk_cnt]')?.eventToActions.ON_BEFORE_ATTACK;
  const warning = n.$template('enemy_liberty[warning]')?.eventToActions.ON_BUFF_TRIGGER;
  const listener = n.$template('enemy_liberty_listener[warning]')?.eventToActions.ON_BEFORE_ATTACK;
  if (init?.length !== 1 || !is(init[0], 'CreateBuffs') || !fields(init[0]._buffPair, { useBlackboard: true, count: 0 })
    || !fields(init[0]._buffPair.buff, { buffKey: 'enemy_confinement[atk_cnt]', templateKey: 'enemy_confinement[atk_cnt]',
      overrideType: 'STACK', maxStackCnt: -1, maxValidStackCnt: -1, lifeTimeType: 'INFINITY' })
    || counter?.length !== 4 || !is(counter[0], 'CheckAbnormalFlag') || !fields(counter[0], { _abnormalFlag: 'PALSY', _isUnset: true })
    || !is(counter[1], 'FinishBuff') || counter[1]._decCntIfStack !== true
    || !fields(counter[2], { _buffKey: 'enemy_confinement[atk_cnt]', _stackCount: 1, _condType: 'EQUALS' })
    || !is(counter[3], 'SwitchMode') || !fields(counter[3], { _modeIndex: 1, _restartFSM: false, _restoreDefault: false })
    || warning?.length !== 1 || !is(warning[0], 'CreateBuff')
    || warning[0]._buff.templateKey !== 'enemy_liberty_listener[warning]'
    || listener?.length !== 2 || !is(listener[0], 'FinishBuffsById')
    || !fields(listener[0], { _buffKey: 'enemy_confinement[atk_cnt]', _decCntIfStack: true })
    || !is(listener[1], 'SwitchMode') || !fields(listener[1], { _modeIndex: 2, _restartFSM: false, _restoreDefault: false })) return false;
  for (const key of ['projectile_enemy_liiprr', 'projectile_enemy_liiprr_2']) {
    const parts = n.$projectile(key);
    if (!parts.some(c => c._speed === 5 && c._useSourceDirection === 0)
      || !parts.some(c => c._lifeTime === 5 && c._stopWhenSourceInvalid === 0 && c._stopAfterMaxHit === 1)) return false;
  }
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && ['Attack', 'Attack2', 'Attack3'].every(clip => same(clock.events[clip],
      [{ time: Math.fround(28 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }]));
}
export const SNIPER_PRISONER_ABILITY = { kind: 'sniperPrisoner', params: r => {
  const c = clocks.enemies[r.prefabKey]; return { times: r.talents.bb['confinement.times'], atk: r.talents.bb['liberty.atk'],
    aspd: r.talents.bb['confinement.attack_speed'], warningDelay: Math.fround(.15), speed: 5, lifetime: 5,
    animations: ['Attack', 'Attack2', 'Attack3'].map((clip, i) => ({ clip, type: i === 2 ? 'arts' : 'phys',
      duration: c.durations[clip], releases: c.events[clip].map(e => e.time) })) };
} };
export const SNIPER_PRISONER_PRIORITY = { matchesRecord: isSniperPrisoner, covers: sniperPrisonerNative };
