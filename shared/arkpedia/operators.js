// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage adapters are opt-in. Stronghold's mode kits are migration candidates,
// not evidence that a character is supported in ordinary Arknights stages.
import { MEDIC_OPERATORS } from './medic-operators.js';
import { CASTER_OPERATORS } from './caster-operators.js';
import { GUARD_OPERATORS } from './guard-operators.js';
import { SNIPER_OPERATORS } from './sniper-operators.js';
import { VANGUARD_OPERATORS } from './vanguard-operators.js';
import { DEFENDER_OPERATORS } from './defender-operators.js';
import { ADVANCED_SNIPER_OPERATORS } from './advanced-sniper-operators.js';
import { SUPPORT_OPERATORS } from './support-operators.js';
import { SPECIALIST_OPERATORS } from './specialist-operators.js';
export const REGULAR_OPERATORS = Object.freeze({
  char_123_fang: { skillId: "skcom_charge_cost[1]", talentKeys: ["cost"], mechanic: "dp", prefabId: "skcom_charge_cost", templateKey: "charge_cost" },
  char_208_melan: { skillId: "skcom_atk_up[1]", talentKeys: ["atk"], mechanic: "buff" },
  char_122_beagle: { skillId: "skcom_def_up[1]", talentKeys: ["def"], mechanic: "buff" },
  char_124_kroos: { skillId: "skchr_kroos_1", talentKeys: ["prob", "atk_scale"], mechanic: "buff" },
  char_120_hibisc: { skillId: "skcom_heal_up[1]", talentKeys: ["atk"], mechanic: "buff" },
  char_210_stward: { skillId: "skchr_stward_1", talentKeys: ["atk"], mechanic: "buff" },
  char_240_wyvern: { skillId: "skchr_wyvern_1", talentKeys: ["atk"], mechanic: "dp", prefabId: "skchr_wyvern_1", templateKey: "charge_cost" },
  char_209_ardign: { skillId: "skcom_heal_self[1]", talentKeys: ["max_hp"], mechanic: "self-heal" },
  char_278_orchid: { skillId: "skcom_quickattack[1]", talentKeys: ["attack_speed"], mechanic: "buff" },
  char_192_falco: { skillId: "skcom_quickattack[1]", talentKeys: ["atk"], mechanic: "charger" },
  char_281_popka: { skillId: "skcom_atk_up[1]", talentKeys: ["atk", "max_hp"], mechanic: "centurion" },
  char_211_adnach: { skillId: "skcom_atk_up[1]", talentKeys: ["attack_speed"], mechanic: "ranged-priority" },
  char_121_lava: { skillId: "skcom_magic_rage[1]", talentKeys: ["sp"], mechanic: "starting-sp" },
  char_282_catap: { skillId: "skchr_catap_1", talentKeys: ["cost"], mechanic: "blast-area" },
  char_283_midn: { skillId: "skchr_midn_1", talentKeys: ["prob", "atk_scale"], mechanic: "arts-lord" },
  char_212_ansel: { skillId: "skcom_range_extend", talentKeys: ["attack@prob"], mechanic: "extra-heal" },
  char_284_spot: { skillId: "skchr_spot_1", talentKeys: ["prob", "duration"], mechanic: "healing-stance" },
  char_502_nblade: { skillId: null, talentKeys: ["respawn_time"], mechanic: "fast-redeploy" },
  char_500_noirc: { skillId: null, talentKeys: ["max_hp", "def"], mechanic: "buff" },
  char_503_rang: { skillId: null, talentKeys: ["atk_scale"], mechanic: "anti-air" },
  char_501_durin: { skillId: null, talentKeys: ["prob"], mechanic: "dodge-arts" },
  char_009_12fce: { skillId: null, talentKeys: ["prob"], mechanic: "dodge-phys" },
  ...MEDIC_OPERATORS,
  ...CASTER_OPERATORS,
  ...GUARD_OPERATORS,
  ...SNIPER_OPERATORS,
  ...VANGUARD_OPERATORS,
  ...DEFENDER_OPERATORS,
  ...ADVANCED_SNIPER_OPERATORS,
  ...SUPPORT_OPERATORS,
  ...SPECIALIST_OPERATORS,
});

export function assertRegularOperator(op) {
  const support = REGULAR_OPERATORS[op?.id];
  const skillIds = support?.skillIds ?? (support?.skillId == null ? [] : [support.skillId]);
  if (!support || !Array.isArray(op.skills) || op.skills.length !== skillIds.length
    || op.skills.some((skill, index) => skill.id !== skillIds[index]))
    throw new Error(`Unsupported regular-stage operator or skill: ${op?.id}`);
  for (const talent of op.talents ?? [])
    for (const candidate of talent.candidates)
      for (const { key } of candidate.blackboard ?? [])
        if (!support.talentKeys.includes(key))
          throw new Error(`Unsupported talent ${key}: ${op.id}`);
  return support;
}
