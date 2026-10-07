// SPDX-License-Identifier: GPL-3.0-or-later
// Original client charpacks confirm zero occupied deployment slots for each.
export const ROBOT_EXPANSION_OPERATORS = Object.freeze({
  char_4077_palico: { skillId: null, mechanic: 'felyne-lottery', deploymentSlotCost: 0,
    talentKeys: ['attack@prob1', 'attack@prob2', 'attack@prob3', 'attack@prob4',
      'attack@bomb_scale', 'attack@sleep', 'attack@stun'], passiveTalentKeys: [] },
  char_4091_ulika: { skillId: null, mechanic: 'u-official', deploymentSlotCost: 0,
    noBasicAttack: true, fixedFacing: true,
    talentKeys: ['attack@stun_duration', 'attack@stun_anim_duration'], passiveTalentKeys: [] },
  char_4136_phonor: { skillId: null, mechanic: 'phonor', deploymentSlotCost: 0,
    talentKeys: ['duration', 'attack@dark_damage_value', 'damage_scale'], passiveTalentKeys: [] },
});
