// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-prayer-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
const match = (value, fields) => value && Object.entries(fields).every(([key, wanted]) => value[key] === wanted);
const ids = ['enemy_10085_hllevi', 'enemy_10085_hllevi_2'];
export function prayerNative(r, n) {
  const skill = r.skills[0], rows = n.Roar ?? [], cast = rows.find(c => '_activeBuffs' in c), wrapper = rows.find(c => '_familyMask' in c);
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'NONE' || r.skills.length !== 1
    || !match(skill, { prefabKey: 'Roar', priority: 0, cooldown: 40, initCooldown: 20, spCost: 0 })
    || !same(skill.bb, { duration: 15, attack_speed: -30 }) || Object.keys(skill.bbStr).length
    || !match(wrapper, { _familyMask: 3, _ignoreSilence: 0, _castLikeAttack: 0, _maxTriggerTime: -1,
      _resetMainAbilityCdWhenCastEnd: 0, _immuneStunWhenAffecting: 0, _overwriteInitCooldown: -1 })
    || n.$ref(wrapper._trigger)?.m_Script.m_PathID !== '-2995189732062982133') return false;
  if (!match(cast, { _selectTargetSource: 1, _selectTargetTiming: 0, _allowNoTarget: 1, _alwaysIncludeTarget: 0,
    _animKey: 'Skill', _endAnimKey: 'Idle', _timeMode: 1, _preDelay: 0, _affectedBySlowDown: 1,
    _maxAnimScale: 1, _waitForAttackEvent: 1, _forceAsDmgOrHealAbility: 0 }) || cast._activeBuffs.length !== 1) return false;
  const selector = n.$ref(cast._selector);
  if (selector?.m_Script.m_PathID !== '7080728813803358465'
    || !match(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4,
      _limitTargetNum: 0, _ignoreTargetFree: 0, _forceIgnoreCamouflage: 1, _ignoreMotionMode: 0,
      _onlyIgnoreSomeOfTargetFreeCase: 0, _excludeSomeAbnormalFlags: 0, _checkUnitType: 0, _needProfessionMask: 0 })) return false;
  const buff = cast._activeBuffs[0];
  if (!match(buff, { buffKey: 'hllevi_s[speed_down]', templateKey: 'empty', lifeTimeType: 1, lifeTime: 0,
    durationKey: 'duration', loadFromDB: 0, overrideType: 3, maxStackCnt: 1, independentCharacterSource: 0,
    isSilenceable: 0, isStunnable: 0, isFreezable: 0, isLevitatable: 0, isDurableBuff: 0, isDamageMissable: 0, statusResistable: 2 })
    || buff.blackboard.length || !emptyOutcomeAttributes({ ...buff.attributes, attributeModifiers: [] })
    || !same(buff.attributes.attributeModifiers, [{ attributeType: 7, formulaItem: 0, value: 0,
      loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 }])) return false;
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0], graphic = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey];
  if (root?._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length
    || n.$ref(mode._attack) !== n.Attack?.[0] || n.$ref(mode._combat) !== n.Combat?.[0]
    || ![n.Attack?.[0], n.Combat?.[0]].every(c => c?.m_Script.m_PathID === '8145049199648393782'
      && c._animKey === '' && c._activeBuffs.length === 0)
    || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock?.source.skeletonDataPathId) return false;
  return match(graphic._animations.find(a => a.animKey === 'Skill'), { animName: 'Skill', loop: 0, speed: 1 })
    && clock.durations.Skill === Math.fround(65 / 30)
    && same(clock.events.Skill, [{ time: 1, name: 'OnAttack', int: 0, float: 0, string: '' }]);
}
export const PRAYER_FEATURE = {
  matchesRecord: r => ids.includes(r.prefabKey), covers: prayerNative, nativeClaim: () => ({ wrappers: 1 }),
  explains: /^\[Invitation to Prayer\] Temporarily reduces all your units' ASPD$/,
  ability: { kind: 'globalEnemyStatDebuff', params: r => ({ initial: r.skills[0].initCooldown, cooldown: r.skills[0].cooldown,
    clip: 'Skill', castDuration: clocks.enemies[r.prefabKey].durations.Skill, release: clocks.enemies[r.prefabKey].events.Skill[0].time,
    key: 'hllevi_s[speed_down]', duration: r.skills[0].bb.duration, mods: { aspd: r.skills[0].bb.attack_speed } }) },
  note: 'Global ground-character selection at cast start, including concealed targets; delayed source-event ASPD reduction extends without stacking. Can cast on an empty battlefield.',
};
