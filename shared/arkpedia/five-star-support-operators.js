// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_SUPPORT_OPERATORS = Object.freeze({
  char_144_red: { skillIds: ['skchr_red_1', 'skchr_red_2'],
    talentKeys: ['atk_scale'], passiveTalentKeys: [], mechanic: 'red-executor' },
  char_243_waaifu: { skillIds: ['skchr_waaifu_1', 'skchr_waaifu_2'],
    talentKeys: ['prob', 'atk_scale', 'force'], passiveTalentKeys: [], criticalTalent: false, mechanic: 'waaifu-executor' },
  char_214_kafka: { skillIds: ['skchr_kafka_1', 'skchr_kafka_2'],
    talentKeys: ['atk'], passiveTalentKeys: [], mechanic: 'kafka-executor' },
  char_174_slbell: { skillIds: ['skchr_slbell_1', 'skchr_slbell_2'],
    talentKeys: ['hp_ratio', 'damage_scale', 'attack@max_target'], passiveTalentKeys: [], mechanic: 'pramanix-underminer' },
  char_326_glacus: { skillIds: ['skchr_glacus_1', 'skchr_glacus_2'],
    talentKeys: ['atk_scale'], passiveTalentKeys: [], mechanic: 'glaucus-decel' },
});
