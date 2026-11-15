// SPDX-License-Identifier: GPL-3.0-or-later
export function wakerRageNative(r, n) {
  const leader = r.prefabKey === 'enemy_1264_durgrd_2';
  if (!leader && r.prefabKey !== 'enemy_1264_durgrd') return false;
  if (r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys' || r.skills.length || !r.stats.immunities.silence
    || r.talents.groups.Rage?.join() !== 'attack_speed,duration,move_speed'
    || r.talents.bb['Rage.attack_speed'] !== (leader ? 150 : 100)
    || r.talents.bb['Rage.move_speed'] !== (leader ? 1.5 : 1) || r.talents.bb['Rage.duration'] !== 30) return false;
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0], attack = n.Combat?.[0];
  const toggle = n.Rage?.find(c => c._buffs), talent = toggle && n.$siblings(toggle).find(c => '_isSilenceable' in c);
  const check = toggle && n.$ref(toggle._checker), buff = toggle?._buffs?.[0];
  const attrs = buff?.attributes, mods = attrs?.attributeModifiers;
  return root?._modes?.length === 1 && n.$ref(root._modes[0]) === mode && root._commonAbilities.length === 0
    && mode?._generalAbilities?.length === 0 && n.$ref(mode._combat) === attack
    && mode._attack.m_PathID === '0' && mode._attackTrigger.m_PathID === '0'
    && attack?._attackType === 1 && attack._damageType === 1 && attack._atkScale === 1 && attack._activeBuffs.length === 0
    && attack._selector.m_PathID === '0' && attack._selectTargetSource === 2 && attack._waitForAttackEvent === 1
    && attack._epDamageRatio === 0 && attack._extraDamageType === 0
    && talent?._isSilenceable === 1 && toggle._selector.m_PathID === '0' && toggle._buffs.length === 1
    && toggle._unmanagedBuffsWhenToggleOn.length === 0 && toggle._buffsWhenToggleOff.length === 0
    && !toggle._isInverseToggle && !toggle._setToggleFalseOnDetached
    && check?._minHpRatio === 0 && check._maxHpRatio === 1 && check._useLTForMax === 1 && check._restoreDelay === 0
    && check._toggleOnce === 1 && check._setInitialToggle === 1 && check._initialToggle === 0 && !check._loadMinHpRatioFromBlackboard
    && buff.buffKey === 'enemy_durgrd_t' && buff.templateKey === 'empty' && !buff.loadFromDB
    && !buff.isSilenceable && !buff.isStunnable && !buff.isFreezable && buff.lifeTimeType === 1
    && buff.durationKey === '' && buff.lifeTime === 0 && buff.blackboard.length === 0
    && Object.entries(attrs).every(([key, value]) => key === 'attributeModifiers' || Array.isArray(value) && value.length === 0)
    && mods?.length === 2 && mods.every((m, i) => m.attributeType === [7, 6][i] && m.formulaItem === [0, 1][i]
      && m.loadFromBlackboard === 1 && m.fetchBaseValueFromSourceEntity === 0 && m.value === 0);
}
