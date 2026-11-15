// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-wither-caster-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
const ids = ['enemy_1268_nhnrs', 'enemy_1268_nhnrs_2'];
const match = (v, fields) => !!v && Object.entries(fields).every(([k, value]) => v[k] === value);
export function witherCasterNative(r, n) {
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'arts'
    || r.skills.length !== 1 || Object.keys(r.talents.groups).length) return false;
  const s = r.skills[0], cast = n.Heallarva?.find(c => '_projectileKey' in c), wrapper = n.Heallarva?.find(c => '_familyMask' in c);
  if (!match(s, { prefabKey: 'Heallarva', priority: 0, cooldown: 15, initCooldown: 5, spCost: 0 })
    || !same(s.bb, { hp_ratio: .02, hit_duration: 8 }) || Object.keys(s.bbStr).length
    || !match(wrapper, { _familyMask: 3, _ignoreSilence: 0, _immuneStunWhenAffecting: 0, _castLikeAttack: 0,
      _maxTriggerTime: -1, _overwriteInitCooldown: -1, _resetMainAbilityCdWhenCastEnd: 0 })
    || !match(cast, { _projectileKey: 'projectile_enemy_nhnrs_skill', _waitForAttackEvent: 1, _selectTargetSource: 2,
      _selectTargetTiming: 0, _timeMode: 0, _allowNoTarget: 0, _alwaysIncludeTarget: 0, _preDelay: 0,
      _affectedBySlowDown: 0, _atkScale: 0, _damageType: 2, _attackType: 4, _waitForProjectileInvalid: 1,
      _notClearProjectileWhenCastEnd: 0, _fireAttackFinishWhenProjectileInvalid: 1,
      _minPostDelayWhenProjectileInvalid: Math.fround(.667), _waitForAnimEndWhenProjectileInvalid: 1 })
    || cast._extraProjectileKeys.length || cast._activeBuffs.length !== 1) return false;
  const selector = n.$ref(cast._selector), trigger = n.$ref(wrapper._trigger);
  if (selector?.m_Script.m_PathID !== '3579891523335379677'
    || !match(selector, { _targetSide: 1, _targetMotion: 3, _targetCategory: 1, _postFilter: 3,
      _filterID: 'trap_086_larva', _ignoreTargetFree: 1, _ignoreAllyTargetFree: 0, _ignoreHealFree: 0,
      _ignoreMotionMode: 0, _forceIgnoreCamouflage: 0, _limitTargetNum: 1, _maxNum: 1, _excludeOwner: 1,
      _sortByTauntAtLast: 0, _ignoreHitRange: 0, _onlyIgnoreSomeOfTargetFreeCase: 0, _excludeSomeAbnormalFlags: 0,
      _checkUnitType: 0, _needProfessionMask: 0 })
    || !match(trigger, { _keepTarget: 0, _minTargetNum: 1, _overrideSearchTargetTick: -1 })
    || !n.$siblings(selector).some(c => c.m_Script?.m_PathID === '6185056810787956083'
      && match(c, { _useBlackboardRangeId: 0, _extendable: 0, _scaleble: 0 }))) return false;
  const buff = cast._activeBuffs[0];
  if (!match(buff, { buffKey: 'enemy_nhnrs_heal', templateKey: 'enemy_nhnrs_t[healtrap]', loadFromDB: 0,
    lifeTimeType: 0, lifeTime: 0, maxStackCnt: 1, overrideType: 0, independentCharacterSource: 0,
    isSilenceable: 0, isStunnable: 0, isFreezable: 0, isLevitatable: 0, isDurableBuff: 0, isDamageMissable: 0 })
    || buff.blackboard.length || !emptyOutcomeAttributes(buff.attributes)
    || !same(n.$template(buff.templateKey)?.eventToActions, { ON_BUFF_START: [{
      $type: 'Torappu.Battle.Action.Nodes+HealViaMaxHpRatio, Assembly-CSharp', _healTarget: 'BUFF_OWNER',
      _getMaxHpFromTarget: false, _ignoreHealFree: false, _skipModifierEvent: false,
    }] })) return false;
  const parts = n.$projectile(cast._projectileKey), link = parts.find(c => '_linkDuration' in c);
  if (!match(link, { _isSilenceable: 1, _keepAlreadyHitTime: 1, _keepHitTarget: 1, _lifeTimeType: 2,
    _maxHitTimes: -1, _linkDuration: 3600, _lifeTime: 0 })
    || !match(link._actionController, { _dontAddBuffs: 0, _onlyAddBuffsToTargetOnce: 0, _useSelfBlackboard: 0 })
    || !parts.some(c => c._speed === 10 && c._extendLenth === 15 && c._flyToTargetLocationOnly === 0)) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes[0]), attack = n.$ref(mode?._attack);
  const target = n.$siblings(mode?._attackTrigger).find(c => '_postFilter' in c);
  const ordinary = n.$projectile('projectile_enemy_nhnrs');
  if (root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length
    || n.$ref(mode._combat) !== attack || !match(attack, { _projectileKey: 'projectile_enemy_nhnrs', _atkScale: 1,
      _damageType: 2, _attackType: 1, _waitForAttackEvent: 1, _timeMode: 0 }) || attack._activeBuffs.length
    || !match(target, { _targetSide: 2, _targetCategory: 1, _targetMotion: 3, _postFilter: 4, _maxNum: 1, _ignoreTargetFree: 0 })
    || !ordinary.some(c => c._speed === 10 && c._flyToTargetLocationOnly === 0)
    || !ordinary.some(c => c._lifeTime === 10 && c._maxHitNum === 1 && c._stopWhenSourceInvalid === 0)) return false;
  const clock = clocks.enemies[r.prefabKey], animator = n.$ref(root._animator);
  const animation = n.$siblings(cast).find(c => '_default' in c);
  return n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && same(animation?._default, { beginAnim: 'Skill_Begin', loopAnim: 'Skill_Loop', endAnim: 'Skill_End' })
    && animation._waitForAttachFinishEvent === 1
    && clock.durations.Skill_Begin === .5 && clock.durations.Skill_End === .5 && clock.durations.Attack === 1
    && same(clock.events.Skill_Loop, [{ time: Math.fround(10 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }])
    && same(clock.events.Attack, [{ time: Math.fround(16 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }]);
}
export const WITHER_CASTER_FEATURE = {
  matchesRecord: r => ids.includes(r.prefabKey), covers: witherCasterNative, nativeClaim: () => ({ wrappers: 1 }),
  explains: /^Continuously heals the Twigs That Crave$/,
  ability: { kind: 'witherCasterChannel', params: r => ({ initial: r.skills[0].initCooldown, cooldown: r.skills[0].cooldown,
    duration: r.skills[0].bb.hit_duration, ratio: r.skills[0].bb.hp_ratio, begin: .5, release: Math.fround(10 / 30),
    recovery: Math.fround(.667), attackAnim: { dur: 1, hit: Math.fround(16 / 30) } }) },
  note: 'Original device-ID selector, injured lowest-HP ratio selection, timed travelling healing link and ordinary Arts projectiles. Device admission is separate.',
};
