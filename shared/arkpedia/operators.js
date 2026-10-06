// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage adapters are opt-in. Stronghold's mode kits are migration candidates,
// not evidence that a character is supported in ordinary Arknights stages.
export const REGULAR_OPERATORS = Object.freeze({
  char_123_fang: { skillId: "skcom_charge_cost[1]", talentKeys: ["cost"], mechanic: "dp" },
  char_208_melan: { skillId: "skcom_atk_up[1]", talentKeys: ["atk"], mechanic: "buff" },
  char_122_beagle: { skillId: "skcom_def_up[1]", talentKeys: ["def"], mechanic: "buff" },
  char_124_kroos: { skillId: "skchr_kroos_1", talentKeys: ["prob", "atk_scale"], mechanic: "buff" },
  char_120_hibisc: { skillId: "skcom_heal_up[1]", talentKeys: ["atk"], mechanic: "buff" },
  char_210_stward: { skillId: "skchr_stward_1", talentKeys: ["atk"], mechanic: "buff" },
  char_240_wyvern: { skillId: "skchr_wyvern_1", talentKeys: ["atk"], mechanic: "dp" },
  char_209_ardign: { skillId: "skcom_heal_self[1]", talentKeys: ["max_hp"], mechanic: "self-heal" },
  char_278_orchid: { skillId: "skcom_quickattack[1]", talentKeys: ["attack_speed"], mechanic: "buff" },
});

export function assertRegularOperator(op) {
  const support = REGULAR_OPERATORS[op?.id];
  if (!support || op.skills?.length !== 1 || op.skills[0].id !== support.skillId)
    throw new Error(`Unsupported regular-stage operator or skill: ${op?.id}`);
  for (const talent of op.talents ?? [])
    for (const candidate of talent.candidates)
      for (const { key } of candidate.blackboard ?? [])
        if (!support.talentKeys.includes(key))
          throw new Error(`Unsupported talent ${key}: ${op.id}`);
  return support;
}
