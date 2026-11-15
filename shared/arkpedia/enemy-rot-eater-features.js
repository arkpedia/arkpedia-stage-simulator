// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
export function rotEaterNative(r, n) {
  if (r.prefabKey !== 'enemy_1266_nhapos' || r.skills.length || r.applyWay !== 'MELEE'
    || !same(r.talents.groups, { PollutedArea: ['Polluted_damage_high', 'Polluted_damage_low',
      'guaranteed_percentage', 'max_percentage', 'range_Radius'] })
    || r.talents.bb['PollutedArea.guaranteed_percentage'] !== .2
    || r.talents.bb['PollutedArea.max_percentage'] !== .8) return false;
  const aura = n.PollutedArea?.find(c => '_buffs' in c), birth = aura?._passiveBuffs?.[0];
  if (aura?._buffs.length !== 1 || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || aura._buffs[0].templateKey !== 'polluted_area' || aura._buffs[0].triggerInterval !== 1
    || aura._buffs[0].firstTriggerInterval !== 1 || aura._buffs[0].waitFirstTriggerInterval !== 1
    || !emptyOutcomeAttributes(aura._buffs[0].attributes)
    || birth?.templateKey !== 'enemy_nhapos_t[born]' || birth.lifeTimeType !== 2 || birth.isSilenceable !== 0
    || !emptyOutcomeAttributes(birth.attributes)) return false;
  const actions = n.$template(birth.templateKey)?.eventToActions.ON_BUFF_START;
  return actions?.length === 5 && actions.slice(0, 3).every((a, i) => same(a, {
    $type: 'Torappu.Battle.Action.Nodes+AttributeModifierWithLevelProgress, Assembly-CSharp',
    _targetType: 'BUFF_OWNER', _attributeType: ['ATK', 'MAX_HP', 'DEF'][i], _isFinalScale: false,
    _guaranteedPercentageString: 'guaranteed_percentage', _maxPercentageString: 'max_percentage',
  })) && actions[3]._levelProgressKey === 'add_weapon_effect'
    && actions[4]._buff?.templateKey === 'empty' && emptyOutcomeAttributes(actions[4]._buff.attributes);
}
