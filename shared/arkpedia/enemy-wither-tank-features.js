// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-wither-tank-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
import {corruptionDamageValue,nativeCorruptionTemplate} from './enemy-corruption-contracts.js';
const ids = ['enemy_1272_nhtank', 'enemy_1272_nhtank_2'];
const fields = (v, wanted) => !!v && Object.entries(wanted).every(([k, x]) => same(v[k], x));
export function witherTankNative(r, n) {
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'ALL' || r.skills.length !== 1
    || !same(r.sp, { type: 'INCREASE_WHEN_ATTACK', maxSp: 2, initSp: 2, increment: 1 })
    || !same(r.talents.bb, { 'Empty.attack@chuang_atk_scale': 2, 'Empty.sp': 2 })) return false;
  const skill = r.skills[0], root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes[0]);
  const combat = n.$ref(mode?._combat), attack = n.$ref(mode?._attack), group = n.PollutedRangedAtk?.find(c => '_abilities' in c);
  const wrapper = n.PollutedRangedAtk?.find(c => '_familyMask' in c), pollution = n.AttackPolluted?.find(c => '_activeBuffs' in c);
  if (!fields(skill, { prefabKey: 'PollutedRangedAtk', priority: 0, cooldown: -1, initCooldown: -1, spCost: 2 })
    || !same(Object.keys(skill.bb).sort(),['polluted_damage_high','polluted_damage_low','projectile_delay_time','projectile_life_time','range_radius'])
    || !fields(skill.bb,{projectile_delay_time:10,range_radius:2.2,projectile_life_time:10})
    || !['polluted_damage_low','polluted_damage_high'].every(key=>corruptionDamageValue(skill.bb[key]))
    || Object.keys(skill.bbStr).length || root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length
    || !fields(combat, { _animKey: 'Attack2', _damageType: 1, _atkScale: 1, _waitForAttackEvent: 1 })
    || combat._metadata.blackboardPrefix !== 'chuang_' || combat._activeBuffs.length
    || !fields(attack, { _projectileKey: 'projectile_enemy_nhtank', _damageType: 1, _atkScale: 1, _animKey: 'Attack' })
    || attack._activeBuffs.length || !fields(wrapper, { _familyMask: 3, _ignoreSilence: 1, _castLikeAttack: 0 })
    || group?._abilities.length !== 2 || !group._abilities.some(ref => n.$ref(ref) === pollution)) return false;
  for (const ability of [attack, ...group._abilities.map(ref => n.$ref(ref))]) {
    const selector = n.$ref(ability._selector);
    if (!fields(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4,
      _heightType: 0, _maxNum: 1, _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0 })) return false;
  }
  const buff = pollution?._activeBuffs[0];
  if (!fields(pollution, { _projectileKey: 'projectile_enemy_nhtank_polluted', _atkScale: 0, _emitToInputPosWhenTargetIsInvalid: 1 })
    || !fields(buff, { templateKey: 'polluted_area', lifeTimeType: 2, triggerInterval: 1, isSilenceable: 0 })
    || !emptyOutcomeAttributes(buff.attributes)) return false;
  const ordinary = n.$projectile('projectile_enemy_nhtank'), carrier = n.$projectile('projectile_enemy_nhtank_polluted');
  if (!ordinary.some(c => c._speed === 4 && c._flyToTargetLocationOnly === 0)
    || !ordinary.some(c => c._lifeTime === 20 && c._maxHitNum === 1 && c._stopWhenSourceInvalid === 0)
    || !carrier.some(c => c._speed === 4 && c._delayAfterReached === 1)
    || !carrier.some(c => c._getLifeTimeFromBB === 1 && c._stopWhenSourceInvalid === 0)
    || !carrier.some(c => c._targetOptions?.ignoreTargetFree === 1 && c._targetOptions.targetMotion === 3 && c._targetOptions.professionMask === 767 && c._ignoreCamouflage === 1)) return false;
  if (!nativeCorruptionTemplate(n)) return false;
  const clock = clocks.enemies[r.prefabKey], animator = n.$ref(root._animator);
  return n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && clock.durations.Attack === 1 && clock.durations.Attack2 === 1
    && clock.events.Attack[0]?.time === .5 && clock.events.Attack2[0]?.time === Math.fround(11 / 30);
}
export const WITHER_TANK_FEATURES = {
  'skill:PollutedRangedAtk': { matchesRecord: r => ids.includes(r.prefabKey), covers: witherTankNative,
    nativeClaim: () => ({ wrappers: 1 }),
    stageSkillMultipliers:{PollutedRangedAtk:{polluted_damage_low:corruptionDamageValue,polluted_damage_high:corruptionDamageValue}},
    explains: text => ['Only attacks ground units', 'Melee attacks deal more damage',
      'After several attacks, the next attack will release Corruption'].includes(text),
    ability: { kind: 'witherTank', params: r => ({ initial: r.sp.initSp, cost: r.sp.maxSp, increment: r.sp.increment,
      meleeScale: 2, speed: 4, life: 10, radius: 2.2, low: r.skills[0].bb.polluted_damage_low, high: r.skills[0].bb.polluted_damage_high,
      rangedAnim: { dur: 1, hit: .5 }, meleeAnim: { dur: 1, hit: Math.fround(11 / 30) } }) } },
  'talent:Empty': { matchesRecord: r => ids.includes(r.prefabKey), covers: witherTankNative,
    note: 'Melee scale and ready-charge presentation belong to the shared tank attack account.' },
};
