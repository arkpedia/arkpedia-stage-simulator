// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage adapters; both skills are covered, including their E2 mastery levels.
export const CASTER_OPERATORS = Object.freeze({
  char_141_nights: {
    skillIds: ["skcom_atk_up[2]", "skchr_nights_2"],
    talentKeys: ["duration", "magic_resistance"],
    passiveTalentKeys: [],
    mechanic: "haze",
  },
  char_109_fmout: {
    skillIds: ["skcom_magic_rage[2]", "skchr_fmout_2"],
    talentKeys: ["attack_speed", "atk", "max_hp"],
    // Divination chooses exactly one buff at deployment. These are not three passives.
    passiveTalentKeys: [],
    mechanic: "gitano",
  },
  char_253_greyy: {
    skillIds: ["skcom_magic_rage[2]", "skchr_greyy_2"],
    talentKeys: ["sluggish"],
    passiveTalentKeys: [],
    mechanic: "greyy",
  },
});
