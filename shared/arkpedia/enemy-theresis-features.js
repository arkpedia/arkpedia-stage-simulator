// SPDX-License-Identifier: GPL-3.0-or-later
import clock from '../../data/arkpedia-theresis-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
export function theresisNative(r, n) {
  if (r.prefabKey !== 'enemy_1276_telex' || r.applyWay !== 'MELEE' || r.stats.atk !== 0 || r.stats.lpr !== 0
    || r.skills.length !== 1 || Object.keys(r.talents.groups).length
    || !fields(r.skills[0], { prefabKey: 'InfiniteAttack', priority: 0, cooldown: 999, initCooldown: 15, spCost: 0 })
    || Object.keys(r.skills[0].bb).length || Object.keys(r.skills[0].bbStr).length) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), attack = n.$ref(mode?._attack);
  const cast = n.InfiniteAttack?.find(c => '_projectileKey' in c), wrapper = n.InfiniteAttack?.find(c => '_familyMask' in c);
  const passive = n.Invincible?.find(c => '_buffs' in c) ?? n.$siblings(n.Invincible?.[0]).find(c => '_buffs' in c);
  const buff = passive?._buffs?.[0], selector = n.$ref(cast?._selector);
  if (root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length || mode._combat.m_PathID !== '0'
    || attack?._activeBuffs.length || attack?._atkScale !== 1 || passive?._buffs.length !== 1
    || !fields(buff, { templateKey: 'empty', lifeTimeType: 2, isSilenceable: 1, blackboard: [] })
    || !same(buff.attributes.abnormalFlags, [5, 3]) || !same(buff.attributes.abnormalImmunes, [0, 12, 16, 25])
    || !same(buff.attributes.abnormalComboImmunes, [0])
    || !fields(wrapper, { _familyMask: 3, _ignoreSilence: 0, _castLikeAttack: 0, _maxTriggerTime: -1 })
    || !fields(cast, { _projectileKey: 'projectile_enemy_telex', _animKey: 'Attack', _timeMode: 1,
      _selectTargetSource: 1, _selectTargetTiming: 0, _waitForAttackEvent: 1, _affectedBySlowDown: 1 })
    || !fields(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _filterID: 'char_003_kalts',
      _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0, _maxNum: 1 }) || cast._activeBuffs.length !== 1) return false;
  const kill = cast._activeBuffs[0], actions = n.$template('enemy_telex_t[kill]')?.eventToActions.ON_BUFF_START;
  if (kill.templateKey !== 'enemy_telex_t[kill]' || kill.lifeTimeType !== 0 || !emptyOutcomeAttributes(kill.attributes)
    || actions?.length !== 2 || !actions[0].$type.includes('AlwaysNext') || !actions[1].$type.includes('InstantKill')
    || !fields(actions[1], { _targetType: 'TARGET', _killSource: false, _noSource: false,
      _skipReborn: false, _noReason: false, _markReachExit: false })) return false;
  const parts = n.$projectile('projectile_enemy_telex');
  if (!parts.some(c => c._speed === 5 && c._moveType === 4 && c._useSourceDirection === 1)
    || !parts.some(c => c._lifeTime === 5 && c._stopWhenSourceInvalid === 0 && c._stopAfterMaxHit === 0)
    || !parts.some(c => c.m_Radius === .5 && same(c.m_Offset, { x: 0, y: 0 }))
    || !parts.some(c => c._targetOptions?.targetSide === 2 && c._targetOptions.targetMotion === 3
      && c._targetOptions.ignoreTargetFree === 0 && c._onlyTraceTarget === 0 && c._goThroughWall === 1)) return false;
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && clock.durations.Attack === 5.5 && same(clock.events.Attack,
      [{ time: Math.fround(97 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }]);
}
export const THERESIS_FEATURE = {
  matchesRecord: r => r.prefabKey === 'enemy_1276_telex', covers: theresisNative, nativeClaim: () => ({ wrappers: 1 }),
  explains: text => ['Cannot be attacked, will not deplete Life Points on leaving the field', 'Knocks down anything in its way'].includes(text),
  ability: { kind: 'theresis', params: r => ({ initial: r.skills[0].initCooldown, cooldown: r.skills[0].cooldown,
    duration: clock.durations.Attack, release: clock.events.Attack[0].time }) },
};
