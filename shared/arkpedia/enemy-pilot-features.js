// SPDX-License-Identifier: GPL-3.0-or-later
// Commander Ulšulah (enemy_1368_spilot; PRTS 指挥官厄尔苏拉). Reviewed from the pinned prefab (Charge, ChargeOre,
// DebuffAura, Aura and its circle, Reborn and both selectors) and three templates; the Bloodcalling Altar's side
// (its Passive marks, talent `1`, SummonSpilot, trap_bonore_upgraded[summon], enemy_spilot_reborn[bonore]) is reviewed
// in stage-blood-altar.js.
// - Charge (【凝髓隙环】; skill cooldown 20, initial 10): a wrapper whose trigger selects one own-side trap carrying
//   `trap_bonore_need_upgrade` (an Altar not yet upgraded; post-filter 11, PRTS: the nearest). It runs DebuffAura for
//   hit_duration (10 s) together with ChargeOre and finishes both when one finishes. DebuffAura wraps Aura: opposing
//   units within the Aura circle (radius 1.7) get `enemy_spilot_atk_speed[down]` (attribute 7, ASPD, from the
//   blackboard: attack_speed -80). ChargeOre's projectile gives the Altar trap_bonore_upgraded[trigger], which finishes
//   its need-upgrade mark and gives it `trap_bonore_upgraded` for good. PRTS: a 10 s silenceable cast; the Altar
//   upgrades when it completes.
// - Reborn: a passive buff (enemy_spilot_reborn[trigger]); when the pilot is killed it puts
//   enemy_spilot_reborn[bonore] (Reborn.duration, 20 s) on one own-side trap carrying `trap_bonore_spilot[mark]`
//   (post-filter 14, PRTS: a random Altar). That Altar summons the pilot again when it ends (stage-blood-altar.js).
const f32 = Math.fround;

export const PILOT = 'enemy_1368_spilot';
export const PILOT_TEXT = Object.freeze([
  '[Marrowchill Aura] Significantly reduces the ASPD of surrounding allied units and gives a Bloodcalling Altar the ability to produce Blood Amber.',
  'When defeated, returns to a Bloodcalling Altar and revives after a period of time.',
]);
export const isPilot = r => r?.prefabKey === PILOT;
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = list => (list ?? []).map(b => b.buffKey).join();

/** A trap selector of the pilot's own side: one unit carrying `buffKey`, sorted by `postFilter`. */
const trapSelector = (s, buffKey, postFilter) => s?._buffKey === buffKey && s._targetSide === 1 && s._targetCategory === 2
  && s._targetMotion === 3 && s._postFilter === postFilter && s._maxNum === 1 && s._limitTargetNum === 1 && s._buffKeyExcluded === 0;

export function pilotNative(r, n) {
  if (!isPilot(r) || r.talents?.bb?.['Reborn.duration'] !== 20 || r.stats?.dmgType !== 'arts' || r.applyWay !== 'RANGED') return false;
  const sk = r.skills?.length === 1 && r.skills[0];
  if (sk?.prefabKey !== 'Charge' || sk.cooldown !== 20 || sk.initCooldown !== 10
    || !same(sk.bb, { hit_duration: 10, attack_speed: -80, interval: 10 })) return false;
  const wrapper = (n?.Charge ?? []).find(c => '_trigger' in c), combo = (n?.Charge ?? []).find(c => '_mainAbility' in c);
  const trigger = n?.$ref?.(wrapper?._trigger);
  const target = (n?.$siblings?.(trigger) ?? []).find(c => '_buffKey' in c);
  const ore = (n?.ChargeOre ?? []).find(c => '_projectileKey' in c), debuff = (n?.DebuffAura ?? []).find(c => '_wrappedAbilities' in c);
  const aura = n?.$ref?.(debuff?._wrappedAbilities?.[0]), validator = n?.$ref?.(aura?._targetValidator);
  const circle = (n?.$siblings?.(aura) ?? []).find(c => 'm_Radius' in c);
  const mod = aura?._buffs?.[0]?.attributes?.attributeModifiers;
  const reborn = (n?.Reborn ?? []).find(c => c._buffs), returnTo = n?.$ref?.(reborn?._selector);
  const T = k => n?.$template?.(k)?.eventToActions;
  const upgrade = T('trap_bonore_upgraded[trigger]')?.ON_BUFF_TRIGGER;
  const killed = T('enemy_spilot_reborn[trigger]')?.ON_OWNER_KILLED;
  const ret = T('enemy_spilot_reborn[bonore]');
  return wrapper?._familyMask === 3 && wrapper._ignoreSilence === 0 && trigger?._minTargetNum === 1
    && trapSelector(target, 'trap_bonore_need_upgrade', 11)
    && combo?._finishAllAbilitiesIfOneFinish === 1 && combo._mainAbility?.m_PathID === '-6799291171347184294'
    && same(combo._abilities?.map(a => a.m_PathID), ['-5499821939823950502', '-6799291171347184294'])
    && debuff?._durationKey === 'hit_duration' && debuff._wrappedAbilities.length === 1
    && keys(aura?._buffs) === 'enemy_spilot_atk_speed[down]' && aura._buffs[0].lifeTimeType === 2 && aura._removeBuffWhenTargetLeave === 1
    && mod?.length === 1 && mod[0].attributeType === 7 && mod[0].loadFromBlackboard === 1 && mod[0].formulaItem === 0
    && validator?._targetOptions?.targetSide === 2 && validator._targetOptions.targetCategory === 1
    && circle?.m_Radius === f32(1.7) && circle.m_Offset?.x === 0 && circle.m_Offset?.y === 0
    && ore?._projectileKey === 'projectile_enemy_spilot_charge' && ore._waitForProjectileInvalid === 1
    && keys(ore._activeBuffs) === 'trap_bonore_upgraded[trigger]' && ore._activeBuffs[0].templateKey === 'trap_bonore_upgraded[trigger]'
    && types(upgrade) === 'FinishBuffsById,CreateBuff' && upgrade[0]._buffKey === 'trap_bonore_need_upgrade'
    && upgrade[1]._buff.buffKey === 'trap_bonore_upgraded' && upgrade[1]._buff.lifeTimeType === 'INFINITY'
    && keys(reborn?._buffs) === 'enemy_spilot_reborn[trigger]' && reborn._buffs[0].templateKey === 'enemy_spilot_reborn[trigger]'
    && trapSelector(returnTo, 'trap_bonore_spilot[mark]', 14)
    && types(killed) === 'CreateBuffUseAbilitySelector' && killed[0]._abilityName === 'Reborn'
    && killed[0]._buff.buffKey === 'enemy_spilot_reborn[bonore]' && killed[0]._buff.durationKey === 'duration'
    && killed[0]._buff.maxStackCnt === 1 && killed[0]._buff.refreshRemainingTimeWhenStackMax === false
    && types(ret?.ON_BUFF_FINISH) === 'CheckUnitAlive,TriggerAbility' && ret.ON_BUFF_FINISH[1]._abilityName === 'SummonSpilot'
    && types(ret.ON_OWNER_KILLED) === 'CreateBuffUseAbilitySelector' && ret.ON_OWNER_KILLED[0]._abilityName === 'SummonSpilot'
    && ret.ON_OWNER_KILLED[0]._excludeTarget === true && ret.ON_OWNER_KILLED[0]._buff.buffKey === 'enemy_spilot_reborn[bonore]';
}

export function pilotParams(r) {
  const s = r.skills[0];
  // The cast is timed by PRTS (10 s, the DebuffAura's hit_duration), not by ChargeOre's projectile.
  return { initial: s.initCooldown, cooldown: s.cooldown, duration: s.bb.hit_duration, aspd: s.bb.attack_speed,
    radius: f32(1.7), returnDelay: r.talents.bb['Reborn.duration'] };
}

const lines = new Set(PILOT_TEXT);
export const PILOT_CHARGE = { matchesRecord: isPilot, covers: pilotNative, nativeClaim: () => ({ wrappers: 1 }),
  explains: text => lines.has(text),
  note: 'Commander Ulšulah: a 10 s cast at the nearest un-upgraded Bloodcalling Altar (ASPD aura), which then produces Blood Amber; implemented with talent:Reborn (kind spilot)' };
export const PILOT_REBORN = { covers: pilotNative, ability: r => ({ kind: 'spilot', params: () => pilotParams(r) }) };
