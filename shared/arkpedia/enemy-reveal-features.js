// SPDX-License-Identifier: GPL-3.0-or-later
import { passiveOutcomeBuff, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export const isSwampRover = r => ['enemy_1291_dusrch', 'enemy_1291_dusrch_2'].includes(r.prefabKey);
export const ROVER_REVEAL = 'Reveals <$ba.camou>Camouflaged</> and <$ba.invisible>Invisible</> allied units within range';
export const MIRE_IMMUNITY = 'Immune to the effects of Mire';
export function swampRoverNative(r, n) {
  if (!isSwampRover(r) || r.skills.length || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys'
    || Object.keys(r.talents.groups).join() !== 'aura' || r.talents.groups.aura.join() !== 'range_radius'
    || !(r.talents.bb['aura.range_radius'] > 0) || !Number.isFinite(r.talents.bb['aura.range_radius'])
    || r.abilities.length !== 2 || ![ROVER_REVEAL, MIRE_IMMUNITY].every(t => r.abilities.some(a => a.text === t))) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), combat = n.$ref(mode?._combat);
  const aura = n.aura?.find(c => '_buffs' in c), validator = n.$ref(aura?._targetValidator);
  const immune = n['mire[immune]']?.[0], buff = aura?._buffs?.[0], mire = immune?._buffs?.[0];
  return root?._modes.length === 1 && root._commonAbilities.length === 0 && mode?._generalAbilities.length === 0
    && zero(mode._attack) && zero(mode._attackTrigger) && combat?._activeBuffs.length === 0
    && combat._damageType === 1 && combat._atkScale === 1 && zero(combat._selector)
    && aura?.m_Script.m_PathID === '9073738633337710967' && zero(aura._selector)
    && aura._removeBuffWhenAbilityDetached === 1 && aura._removeBuffWhenTargetLeave === 1
    && aura._onlyAddBuffOnceForEachTarget === 0 && aura._selfOption === 0 && aura._passiveBuffs.length === 0
    && aura._buffs.length === 1 && buff.templateKey === 'empty' && buff.buffKey === 'talent_antiinvi'
    && same(buff.attributes.abnormalImmunes, [9, 17]) && buff.blackboard.length === 0
    && passiveOutcomeBuff({ ...buff, attributes: { ...buff.attributes, abnormalImmunes: [] } })
    && same(validator?._targetOptions, { abnormalCombo: 0, abnormalFlag: 0, checkUnitType: 0, containAbnormalFlag: 0,
      containSomeAbnormalFlags: 0, enableAdvancedOptions: 1, excludeAbnormalFlag: 0, excludeSomeAbnormalFlags: 0,
      ignoreAllyTargetFree: 0, ignoreHealFree: 0, ignoreMotionMode: 0, ignoreTargetFree: 1, ignoreTargetSide: 0,
      onlyIgnoreSomeOfTargetFreeCase: 0, professionMask: 0, purposeMask: 0, targetCategory: 3, targetMotion: 3, targetSide: 2, unitTypeMask: 0 })
    && immune?.m_Script.m_PathID === '3800760148018415462' && zero(immune._selector) && immune._buffs.length === 1
    && passiveOutcomeBuff(mire) && mire.buffKey === 'enemy_ducrb_mire[immune]' && mire.templateKey === 'empty' && mire.blackboard.length === 0;
}
export const SWAMP_ROVER_AURA = { kind: 'visibilityAura', params: r => ({ range: r.talents.bb['aura.range_radius'] }) };
