// SPDX-License-Identifier: GPL-3.0-or-later
import { passiveOutcomeBuff, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
import { conditionalContactBuff } from './enemy-contact-contracts.js';
export const GLOOMPINCER_TEXT = 'Immune to the effects of Mire; gains increased Movement Speed while in Mire';
export function gloompincerNative(r, n) {
  if (!['enemy_1287_ducrb', 'enemy_1287_ducrb_2'].includes(r.prefabKey)
    || r.skills.length || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys'
    || !same(r.talents.groups, { 'mire[immune]': ['move_speed'] })
    || !Number.isFinite(r.talents.bb['mire[immune].move_speed']) || r.talents.bb['mire[immune].move_speed'] < 0
    || r.abilities.length !== 1 || r.abilities[0].text !== GLOOMPINCER_TEXT) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), combat = n.$ref(mode?._combat);
  const immune = n['mire[immune]']?.[0], marker = immune?._buffs?.[0], checker = immune?._buffs?.[1];
  const buff = conditionalContactBuff(n, 'enemy_ducrb_checker', 'buff_mire', 'enemy_ducrb_mire');
  return root?._modes.length === 1 && root._commonAbilities.length === 0 && mode?._generalAbilities.length === 0
    && zero(mode._attack) && zero(mode._attackTrigger) && combat?._activeBuffs.length === 0
    && combat._damageType === 1 && combat._atkScale === 1 && zero(combat._selector)
    && immune?.m_Script.m_PathID === '3800760148018415462' && zero(immune._selector) && immune._buffs.length === 2
    && passiveOutcomeBuff(marker) && marker.buffKey === 'enemy_ducrb_mire[immune]' && marker.templateKey === 'empty' && !marker.blackboard.length
    && passiveOutcomeBuff(checker) && checker.buffKey === 'enemy_ducrb_checker' && checker.templateKey === 'enemy_ducrb_checker'
    && checker.triggerLifeType === 2 && Math.abs(checker.triggerInterval - .1) < 1e-8 && checker.firstTriggerInterval === 0 && !checker.blackboard.length
    && buff?.buffKey === 'enemy_ducrb_mire' && buff.templateKey === 'empty' && buff.lifeTimeType === 'INFINITY'
    && buff.overrideType === 'DEFAULT' && !buff.isSilenceable && !buff.isStunnable && !buff.isFreezable && !buff.isLevitatable
    && !buff.blackboard.length && Object.entries(buff.attributes).every(([key, values]) => key === 'attributeModifiers' || values.length === 0)
    && same(buff.attributes.attributeModifiers, [{ attributeType: 'MOVE_SPEED', formulaItem: 'MULTIPLIER', value: 0,
      loadFromBlackboard: true, fetchBaseValueFromSourceEntity: false }]);
}
