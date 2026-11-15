// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-blade-animations.json' with { type: 'json' };
export const isBladeKnight = r => ['enemy_1104_lfkght', 'enemy_1104_lfkght_2', 'enemy_1104_lfkght_3'].includes(r.prefabKey);
const keys = (o, k) => Object.keys(o ?? {}).sort().join() === [...k].sort().join();
export function bladeNative(r, n) {
  if (!isBladeKnight(r)) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), attack = n.$ref(mode?._attack);
  const rows = n.AtkDesWeaken ?? [], skill = rows.find(c => '_activeBuffs' in c), wrapper = rows.find(c => '_familyMask' in c);
  const selector = n.$ref(skill?._selector), buff = skill?._activeBuffs?.[0], mods = buff?.attributes.attributeModifiers;
  const reborn = n.$siblings(n.reborn?.[0]).find(c => '_hpRechargeRatio' in c);
  const animator = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey], s = r.skills[0];
  const cd = r.prefabKey.endsWith('_3') ? 10 : r.prefabKey.endsWith('_2') ? 15 : 25;
  if (r.applyWay !== 'RANGED' || r.stats.motion !== 'WALK' || r.stats.dmgType !== 'arts'
    || r.skills.length !== 1 || s.prefabKey !== 'AtkDesWeaken' || s.cooldown !== cd || s.initCooldown !== cd || s.spCost !== 0
    || !keys(s.bb, ['atk', 'duration']) || !keys(s.bbStr, []) || s.bb.atk !== -.5 || s.bb.duration !== 25
    || !keys(r.talents.groups, ['reborn']) || !keys(r.talents.bb, ['reborn.duration']) || !keys(r.talents.bbStr, []) || r.talents.bb['reborn.duration'] !== 5
    || root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length
    || mode._combat.m_PathID !== mode._attack.m_PathID || attack?._damageType !== 2 || attack._atkScale !== 1 || attack._activeBuffs.length
    || attack._attackType !== 1 || attack._selectTargetSource !== 1 || attack._waitForAttackEvent !== 1
    || n.$ref(attack._selector)?._targetMotion !== 1
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || wrapper._immuneStunWhenAffecting !== 0
    || wrapper._resetMainAbilityCdWhenCastEnd !== 0 || wrapper._castLikeAttack !== 0
    || skill?._timeMode !== 1 || skill._selectTargetTiming !== 1 || skill._affectedBySlowDown !== 1
    || skill._waitForAttackEvent !== 1 || skill._allowNoTarget !== 1 || skill._alwaysIncludeTarget !== 0
    || skill._activeBuffs.length !== 1 || skill._actions.SerializedState !== '[]'
    || selector?._targetSide !== 2 || selector._targetMotion !== 3 || selector._targetCategory !== 1
    || selector._postFilter !== 17 || selector._maxNum !== 1 || selector._limitTargetNum !== 1
    || selector._ignoreTargetFree !== 0 || selector._forceIgnoreCamouflage !== 0
    || selector._buffKey !== 'lfkght_s[weaken]' || selector._buffKeyExcluded !== 1 || selector._filterBuffSource !== 0
    || !n.$siblings(skill).some(c => c.m_Script.m_PathID === '6275044311115013764' && c._useBlackboardRangeId === 0)
    || buff?.buffKey !== 'lfkght_s[weaken]' || buff.templateKey !== 'enemy_lfkght_s' || buff.isDamageMissable !== 0 || buff.isSilenceable !== 0
    || buff.lifeTimeType !== 1 || buff.maxStackCnt !== 1 || buff.independentCharacterSource !== 0 || buff.statusResistable !== 2
    || mods?.length !== 1 || mods[0].attributeType !== 1 || mods[0].formulaItem !== 3 || mods[0].loadFromBlackboard !== 1
    || mods[0].fetchBaseValueFromSourceEntity !== 0 || Object.entries(buff.attributes).some(([k, v]) => k !== 'attributeModifiers' && v.length)
    || reborn?._hpRechargeRatio !== Math.fround(.2) || reborn._maxRespawnCnt !== 1 || reborn._keepAlive !== 0
    || reborn._buffs.length || reborn._buffsRetainedWhenReborn.length || reborn._detachAbilityWhenReborn !== 0
    || reborn._rebornAfterWave !== 0 || reborn._extraRebornDataPresets.length
    || !clock || n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || clock.durations.Skill_1 !== 1.5 || clock.events.Skill_1?.[0]?.time !== Math.fround(.4)) return false;
  const clip = animator._animations.find(a => a.animKey === 'Skill_1');
  const ordinary = animator._animations.find(a => a.animKey === 'Attack');
  const finish = n.$template('enemy_lfkght_s')?.eventToActions.ON_BUFF_FINISH;
  return clip?.animName === 'Skill_1' && clip.speed === 1 && clip.loop === 0
    && ordinary?.animName === 'Attack' && ordinary.speed === Math.fround(1.4) && ordinary.loop === 0
    && clock.durations.Attack === 2 && clock.events.Attack?.[0]?.time === Math.fround(29 / 30)
    && finish?.length === 1 && finish[0].$type === 'Torappu.Battle.Action.Nodes+FinishBuffsById, Assembly-CSharp';
}
export const BLADE_FEATURES = {
  'skill:AtkDesWeaken': { covers: bladeNative, nativeClaim: () => ({ wrappers: 1 }),
    explains: /^Significantly decreases ATK of the unit with the highest ATK for a period of time$/,
    ability: { kind: 'bladeKnight', params: r => ({
      stat: 'atk', key: 'lfkght_s[weaken]', mods: { atkMul: 1 + r.skills[0].bb.atk },
      duration: r.skills[0].bb.duration, cooldown: r.skills[0].cooldown, initial: r.skills[0].initCooldown,
      release: clocks.enemies[r.prefabKey].events.Skill_1[0].time, castDuration: clocks.enemies[r.prefabKey].durations.Skill_1,
      attackAnim: { dur: clocks.enemies[r.prefabKey].durations.Attack / Math.fround(1.4),
        hit: clocks.enemies[r.prefabKey].events.Attack[0].time / Math.fround(1.4) },
      rebirthDuration: r.talents.bb['reborn.duration'], hpRatio: Math.fround(.2),
    }) } },
};
