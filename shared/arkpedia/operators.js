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
import { UTILITY_OPERATORS } from './utility-operators.js';
import { ROBOT_EXPANSION_OPERATORS } from './robot-expansion-operators.js';
import { GUARD_EXPANSION_OPERATORS } from './guard-expansion-operators.js';
import { CASTER_EXPANSION_OPERATORS } from './caster-expansion-operators.js';
import { SNIPER_EXPANSION_OPERATORS } from './sniper-expansion-operators.js';
import { SUPPORT_EXPANSION_OPERATORS } from './support-expansion-operators.js';
import { FIVE_STAR_GUARD_OPERATORS } from './five-star-guard-operators.js';
import { FIVE_STAR_CASTER_OPERATORS } from './five-star-caster-operators.js';
import { FIVE_STAR_VANGUARD_OPERATORS } from './five-star-vanguard-operators.js';
import { FIVE_STAR_SUPPORT_OPERATORS } from './five-star-support-operators.js';
import { FIVE_STAR_GUARD_EXPANSION_OPERATORS } from './five-star-guard-expansion-operators.js';
import { FIVE_STAR_CASTER_EXPANSION_OPERATORS } from './five-star-caster-expansion-operators.js';
import { FIVE_STAR_SUPPORT_EXPANSION_OPERATORS } from './five-star-support-expansion-operators.js';
import { FIVE_STAR_GUARD_THIRD_OPERATORS } from './five-star-guard-third-operators.js';
import { FIVE_STAR_SNIPER_OPERATORS } from './five-star-sniper-operators.js';
import { FIVE_STAR_CASTER_OVERLOAD_OPERATORS } from './five-star-caster-overload-operators.js';
import { FIVE_STAR_SUPPORT_THIRD_OPERATORS } from './five-star-support-third-operators.js';
import { FIVE_STAR_GUARD_FOURTH_OPERATORS } from './five-star-guard-fourth-operators.js';
import { FIVE_STAR_CASTER_UTILITY_OPERATORS } from './five-star-caster-utility-operators.js';
import { FIVE_STAR_GUARD_FIFTH_OPERATORS } from './five-star-guard-fifth-operators.js';
import { FIVE_STAR_MEDIC_OPERATORS } from './five-star-medic-operators.js';
import { FIVE_STAR_SNIPER_SECOND_OPERATORS } from './five-star-sniper-second-operators.js';
import { FIVE_STAR_SNIPER_THIRD_OPERATORS } from './five-star-sniper-third-operators.js';
import { FIVE_STAR_MEDIC_SECOND_OPERATORS } from './five-star-medic-second-operators.js';
import { FIVE_STAR_MEDIC_THIRD_OPERATORS } from './five-star-medic-third-operators.js';
import { FIVE_STAR_DEFENDER_OPERATORS } from './five-star-defender-operators.js';
import { FIVE_STAR_DEFENDER_SECOND_OPERATORS } from './five-star-defender-second-operators.js';
import { FIVE_STAR_GUARD_SIXTH_OPERATORS } from './five-star-guard-sixth-operators.js';
import { FIVE_STAR_VANGUARD_SECOND_OPERATORS } from './five-star-vanguard-second-operators.js';
import { CASTERS_NEXT_OPERATORS } from './caster-next-operators.js';
import { DEFENDER_THIRD_OPERATORS } from './defender-third-operators.js';
import { SIX_STAR_MEDIC_OPERATORS } from './six-star-medic-operators.js';
import { DEFENDER_FOURTH_OPERATORS } from './defender-fourth-operators.js';
import { FIVE_STAR_MEDIC_FOURTH_OPERATORS } from './five-star-medic-fourth-operators.js';
import { CASTER_SECOND_OPERATORS } from './caster-second-operators.js';
import { FIVE_STAR_VANGUARD_THIRD_OPERATORS } from './five-star-vanguard-third-operators.js';
import { GUARD_SIX_STAR_OPERATORS } from './guard-six-star-operators.js';
import { FIVE_STAR_SNIPER_FOURTH_OPERATORS } from './five-star-sniper-fourth-operators.js';
import { FIVE_STAR_SUPPORT_FOURTH_OPERATORS } from './five-star-support-fourth-operators.js';
import { SNIPER_SIX_STAR_OPERATORS } from './sniper-six-star-operators.js';
import { SNIPER_SIX_STAR_SECOND_OPERATORS } from './sniper-six-star-second-operators.js';
import { SUPPORT_AURA_OPERATORS } from './support-aura-operators.js';
import { GUARD_SIX_STAR_SECOND_OPERATORS } from './guard-six-star-second-operators.js';
import { ELEMENTAL_CASTER_OPERATORS } from './elemental-caster-operators.js';
import { BLESSING_EXPANSION_OPERATORS } from './blessing-expansion-operators.js';
import { GUARD_SIX_STAR_THIRD_OPERATORS } from './guard-six-star-third-operators.js';
import { CASTER_THIRD_OPERATORS } from './caster-third-operators.js';
import { RITUALIST_OPERATORS } from './ritualist-operators.js';
import { SUPPORT_CONTROL_OPERATORS } from './support-control-operators.js';
import { LUCILLA_OPERATORS } from './lucilla-operators.js';
import { HOOK_EXPANSION_OPERATORS } from './hook-expansion-operators.js';
import { PHANTOM_OPERATORS } from './phantom-operators.js';
import { THORNS_OPERATORS } from './thorns-operators.js';
import { ARCHETTO_OPERATORS } from './archetto-operators.js';
import { GUARD_SIX_STAR_FOURTH_OPERATORS } from './guard-six-star-fourth-operators.js';
import { FARTOOTH_OPERATORS } from './fartooth-operators.js';
import { SARIA_OPERATORS } from './saria-operators.js';
import { BAGPIPE_OPERATORS } from './bagpipe-operators.js';
import { ROSA_OPERATORS } from './rosa-operators.js';
import { PUZZLE_OPERATORS } from './puzzle-operators.js';
import { HOEDERER_OPERATORS } from './hoederer-operators.js';
import { W_OPERATORS } from './w-operators.js';
import { MLYNAR_OPERATORS } from './mlynar-operators.js';
import { SILENCE_PARADIGMATIC_OPERATORS } from './silence-paradigmatic-operators.js';
import { EYJA_ALTER_OPERATORS } from './eyja-alter-operators.js';
import { JIEYUN_OPERATORS } from './jieyun-operators.js';
import { RADIANT_KNIGHT_OPERATORS } from './radiant-knight-operators.js';
import { NIAN_OPERATORS } from './nian-operators.js';
import { KALTSIT_OPERATORS } from './kaltsit-operators.js';
import { ZUOLE_OPERATORS } from './zuole-operators.js';
import { BOBBING_OPERATORS } from './bobbing-operators.js';
import { SCENE_OPERATORS } from './scene-operators.js';
import { CHILCHUCK_OPERATORS } from './chilchuck-operators.js';
import { VIGIL_OPERATORS } from './vigil-operators.js';
import { RAY_OPERATORS } from './ray-operators.js';
import { COLDSHOT_OPERATORS } from './coldshot-operators.js';
import { NYMPH_OPERATORS } from './nymph-operators.js';
import { LEMUEN_OPERATORS } from './lemuen-operators.js';
import { TRAGODIA_OPERATORS } from './tragodia-operators.js';
import { MON3TR_OPERATORS } from './mon3tr-operators.js';
import { AKKORD_OPERATORS } from './akkord-operators.js';
import { WINTIM_OPERATORS } from './wintim-operators.js';
import { JCINTA_OPERATORS } from './jcinta-operators.js';
import { VARKIS_OPERATORS } from './varkis-operators.js';
import { SNHUNT_OPERATORS } from './snhunt-operators.js';
import { KICHI_OPERATORS } from './kichi-operators.js';
import { CAIRN_OPERATORS } from './cairn-operators.js';
import { TANYA_OPERATORS } from './tanya-operators.js';
import { THUMPY_OPERATORS } from './thumpy-operators.js';
import { TMSLOT_OPERATORS } from './tmslot-operators.js';
import { PEDRO_OPERATORS } from './pedro-operators.js';
import { MCNIST_OPERATORS } from './mcnist-operators.js';
import { GALLUS_OPERATORS } from './gallus-operators.js';
import { KOROMARU_OPERATORS } from './koromaru-operators.js';
import { RECON_OPERATORS } from './recon-operators.js';
import { JU_OPERATORS } from './ju-operators.js';
import { TARAXA_OPERATORS } from './taraxa-operators.js';
import { BOTANY_OPERATORS } from './botany-operators.js';
import { SKYBOX_OPERATORS } from './skybox-operators.js';
import { AEGIS_OPERATORS } from './aegis-operators.js';
import { YUKARI_OPERATORS } from './yukari-operators.js';
import { MAKOTO_OPERATORS } from './makoto-operators.js';
import { APHRISSA_OPERATORS } from './aphrissa-operators.js';
import { HADIYA_OPERATORS } from './hadiya-operators.js';
import { AMORIS_OPERATORS } from './amoris-operators.js';
import { TMORIS_OPERATORS } from './tmoris-operators.js';
import { DOLRIS_OPERATORS } from './dolris-operators.js';
import { MORTIS_OPERATORS } from './mortis-operators.js';
import { OBLVNS_OPERATORS } from './oblvns-operators.js';
import { MAKIRI_OPERATORS } from './makiri-operators.js';
import { FLWR2_OPERATORS } from './flwr2-operators.js';
import { TURDUS_OPERATORS } from './turdus-operators.js';
import { HEADB2_OPERATORS } from './headb2-operators.js';
import { TITI_OPERATORS } from './titi-operators.js';
import { BRANCH_OPERATORS } from './branch-operators.js';
import { RECKPR_OPERATORS } from './reckpr-operators.js';
import { CLOSUR_OPERATORS } from './closur-operators.js';
import { LIESEL_OPERATORS } from './liesel-operators.js';
import { NECRASS_OPERATORS } from './necrass-operators.js';
import { MUELSYSE_OPERATORS } from './muelsyse-operators.js';
import { MARCIL_OPERATORS } from './marcil-operators.js';
import { RMIXER_OPERATORS } from './rmixer-operators.js';
import { NARANT_OPERATORS } from './narant-operators.js';
import { ELA_OPERATORS } from './ela-operators.js';
import { FUZE_OPERATORS } from './fuze-operators.js';
import { ROSMONTIS_OPERATORS } from './rosmontis-operators.js';
import { WISADEL_OPERATORS } from './wisadel-operators.js';
import { SWIRE_ALTER_OPERATORS } from './swire-alter-operators.js';
import { BLACKNIGHT_OPERATORS } from './blacknight-operators.js';
import { CHRISTINE_OPERATORS } from './christine-operators.js';
import { EXECUTOR_REAPER_OPERATORS } from './executor-reaper-operators.js';
import { PHILAE_OPERATORS } from './philae-operators.js';
import { WINDFLIT_OPERATORS } from './windflit-operators.js';
import { BLEMISHINE_OPERATORS } from './blemishine-operators.js';
import { FLAMETAIL_OPERATORS } from './flametail-operators.js';
import { TECNO_OPERATORS } from './tecno-operators.js';
import { TINMAN_OPERATORS } from './tinman-operators.js';
import { SENSHI_OPERATORS } from './senshi-operators.js';
import { CATHERINE_OPERATORS } from './catherine-operators.js';
import { ALANNA_OPERATORS } from './alanna-operators.js';
import { SAILEACH_OPERATORS } from './saileach-operators.js';
import { SURTR_OPERATORS } from './surtr-operators.js';
import { SPURIA_OPERATORS } from './spuria-operators.js';
import { MAYER_OPERATORS } from './mayer-operators.js';
import { FANG_FIRE_SHARPENED_OPERATORS } from './fang-fire-sharpened-operators.js';
import { SIEGE_OPERATORS } from './siege-operators.js';
import { FIREWATCH_OPERATORS } from './firewatch-operators.js';
import { SURFER_OPERATORS } from './surfer-operators.js';
import { MELANITE_OPERATORS } from './melanite-operators.js';
import { ASH_OPERATORS } from './ash-operators.js';
import { CHEN_OPERATORS } from './chen-operators.js';
import { VULPIS_OPERATORS } from './vulpis-operators.js';
import { SAGA_OPERATORS } from './saga-operators.js';
import { EUNECTES_OPERATORS } from './eunectes-operators.js';
import { BENA_OPERATORS } from './bena-operators.js';
import { KAZEMARU_OPERATORS } from './kazemaru-operators.js';
import { AAK_OPERATORS } from './aak-operators.js';
import { FROST_OPERATORS } from './frost-operators.js';
import { ROBIN_OPERATORS } from './robin-operators.js';
import { WULFENITE_OPERATORS } from './wulfenite-operators.js';
import { TIPPI_OPERATORS } from './tippi-operators.js';
import { LESSING_OPERATORS } from './lessing-operators.js';
import { PENANCE_OPERATORS } from './penance-operators.js';
import { MUDROCK_OPERATORS } from './mudrock-operators.js';
import { BLAZE_OPERATORS } from './blaze-operators.js';
import { GAVIAL_INVINCIBLE_OPERATORS } from './gavial-invincible-operators.js';
import { FIAMMETTA_OPERATORS } from './fiammetta-operators.js';
import { HORN_OPERATORS } from './horn-operators.js';
import { TYPHON_OPERATORS } from './typhon-operators.js';
import { DEGENBRECHER_OPERATORS } from './degenbrecher-operators.js';
import { CHONGYUE_OPERATORS } from './chongyue-operators.js';
import { PEPE_OPERATORS } from './pepe-operators.js';
import { CROWNSLAYER_OPERATORS } from './crownslayer-operators.js';
import { IANA_OPERATORS } from './iana-operators.js';
import { BRIGID_OPERATORS } from './brigid-operators.js';
import { EBENHOLZ_OPERATORS } from './ebenholz-operators.js';
import { LIN_OPERATORS } from './lin-operators.js';
import { ULPIANUS_OPERATORS } from './ulpianus-operators.js';
import { WEEDY_OPERATORS } from './weedy-operators.js';
import { VINA_OPERATORS } from './vina-operators.js';
import { JESSICA_OPERATORS } from './jessica-operators.js';
import { SKADI_ALTER_OPERATORS } from './skadi-alter-operators.js';
import { INES_OPERATORS } from './ines-operators.js';
import { REED_ALTER_OPERATORS } from './reed-alter-operators.js';
import { POZEMKA_OPERATORS } from './pozemka-operators.js';
import { AMIYA_GUARD_OPERATORS } from './amiya-guard-operators.js';
import { AMIYA_MEDIC_OPERATORS } from './amiya-medic-operators.js';
import { CIVILIGHT_OPERATORS } from './civilight-operators.js';
import { DOROTHY_OPERATORS } from './dorothy-operators.js';
import { VIRTUOSA_OPERATORS } from './virtuosa-operators.js';
import { SAND_RECKONER_OPERATORS } from './sand-reckoner-operators.js';
import { ENTELECHIA_OPERATORS } from './entelechia-operators.js';
import { HOOLHEYAK_OPERATORS } from './hoolheyak-operators.js';
import { GOLDENGLOW_OPERATORS } from './goldenglow-operators.js';
import { LAPPLAND_ALTER_OPERATORS } from './lappland-alter-operators.js';
import { THORNS_LODESTAR_OPERATORS } from './thorns-lodestar-operators.js';
import { BLAZE_IGNITING_OPERATORS } from './blaze-igniting-operators.js';
import { EXUSIAI_COVENANT_OPERATORS } from './exusiai-covenant-operators.js';
import { MAGALLAN_OPERATORS } from './magallan-operators.js';
import { LING_OPERATORS } from './ling-operators.js';
import { SHU_OPERATORS } from './shu-operators.js';
import { YU_OPERATORS } from './yu-operators.js';
import { STAINLESS_OPERATORS } from './stainless-operators.js';
import { MITM_OPERATORS } from './mitm-operators.js';
import { LEE_OPERATORS } from './lee-operators.js';
import { YATO_ALTER_OPERATORS } from './yato-alter-operators.js';
import { SPECTER_ALTER_OPERATORS } from './specter-alter-operators.js';
import { ASCALON_OPERATORS } from './ascalon-operators.js';
import { GLADIIA_OPERATORS } from './gladiia-operators.js';
import { CHEN_ALTER_OPERATORS } from './chen-alter-operators.js';
import { IRENE_OPERATORS } from './irene-operators.js';
import { TEXAS_ALTER_OPERATORS } from './texas-alter-operators.js';
import { GNOSIS_OPERATORS } from './gnosis-operators.js';
import { EYJAFJALLA_OPERATORS } from './eyjafjalla-operators.js';
import { FIVE_STAR_SPECIALIST_EXPANSION_OPERATORS } from './five-star-specialist-expansion-operators.js';
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
  ...UTILITY_OPERATORS,
  ...ROBOT_EXPANSION_OPERATORS,
  ...GUARD_EXPANSION_OPERATORS,
  ...CASTER_EXPANSION_OPERATORS,
  ...SNIPER_EXPANSION_OPERATORS,
  ...FIVE_STAR_GUARD_OPERATORS,
  ...FIVE_STAR_CASTER_OPERATORS,
  ...FIVE_STAR_VANGUARD_OPERATORS,
  ...FIVE_STAR_SUPPORT_OPERATORS,
  ...FIVE_STAR_GUARD_EXPANSION_OPERATORS,
  ...FIVE_STAR_CASTER_EXPANSION_OPERATORS,
  ...FIVE_STAR_SUPPORT_EXPANSION_OPERATORS,
  ...FIVE_STAR_GUARD_THIRD_OPERATORS,
  ...FIVE_STAR_SNIPER_OPERATORS,
  ...FIVE_STAR_CASTER_OVERLOAD_OPERATORS,
  ...FIVE_STAR_SUPPORT_THIRD_OPERATORS,
  ...FIVE_STAR_GUARD_FOURTH_OPERATORS,
  ...FIVE_STAR_CASTER_UTILITY_OPERATORS,
  ...FIVE_STAR_GUARD_FIFTH_OPERATORS,
  ...FIVE_STAR_MEDIC_OPERATORS,
  ...FIVE_STAR_SNIPER_SECOND_OPERATORS,
  ...FIVE_STAR_SNIPER_THIRD_OPERATORS,
  ...FIVE_STAR_MEDIC_SECOND_OPERATORS,
  ...FIVE_STAR_MEDIC_THIRD_OPERATORS,
  ...FIVE_STAR_DEFENDER_OPERATORS,
  ...FIVE_STAR_DEFENDER_SECOND_OPERATORS,
  ...FIVE_STAR_GUARD_SIXTH_OPERATORS,
  ...FIVE_STAR_VANGUARD_SECOND_OPERATORS,
  ...CASTERS_NEXT_OPERATORS,
  ...DEFENDER_THIRD_OPERATORS,
  ...SIX_STAR_MEDIC_OPERATORS,
  ...DEFENDER_FOURTH_OPERATORS,
  ...FIVE_STAR_MEDIC_FOURTH_OPERATORS,
  ...CASTER_SECOND_OPERATORS,
  ...FIVE_STAR_VANGUARD_THIRD_OPERATORS,
  ...GUARD_SIX_STAR_OPERATORS,
  ...FIVE_STAR_SNIPER_FOURTH_OPERATORS,
  ...FIVE_STAR_SUPPORT_FOURTH_OPERATORS,
  ...SNIPER_SIX_STAR_OPERATORS,
  ...SNIPER_SIX_STAR_SECOND_OPERATORS,
  ...SUPPORT_AURA_OPERATORS,
  ...GUARD_SIX_STAR_SECOND_OPERATORS,
  ...ELEMENTAL_CASTER_OPERATORS,
  ...BLESSING_EXPANSION_OPERATORS,
  ...GUARD_SIX_STAR_THIRD_OPERATORS,
  ...CASTER_THIRD_OPERATORS,
  ...RITUALIST_OPERATORS,
  ...SUPPORT_CONTROL_OPERATORS,
  ...LUCILLA_OPERATORS,
  ...THORNS_OPERATORS,
  ...ARCHETTO_OPERATORS,
  ...GUARD_SIX_STAR_FOURTH_OPERATORS,
  ...FARTOOTH_OPERATORS,
  ...SARIA_OPERATORS,
  ...BAGPIPE_OPERATORS,
  ...ROSA_OPERATORS,
  ...PUZZLE_OPERATORS,
  ...HOEDERER_OPERATORS,
  ...W_OPERATORS,
  ...MLYNAR_OPERATORS,
  ...SILENCE_PARADIGMATIC_OPERATORS,
  ...EYJA_ALTER_OPERATORS,
  ...JIEYUN_OPERATORS,
  ...RADIANT_KNIGHT_OPERATORS,
  ...NIAN_OPERATORS,
  ...KALTSIT_OPERATORS,
  ...ZUOLE_OPERATORS,
  ...BOBBING_OPERATORS,
  ...SCENE_OPERATORS,
  ...CHILCHUCK_OPERATORS,
  ...BLACKNIGHT_OPERATORS,
  ...VIGIL_OPERATORS,
  ...RAY_OPERATORS,
  ...COLDSHOT_OPERATORS,
  ...NYMPH_OPERATORS,
  ...LEMUEN_OPERATORS,
  ...RMIXER_OPERATORS,
  ...MARCIL_OPERATORS,
  ...MUELSYSE_OPERATORS,
  ...NECRASS_OPERATORS,
  ...TRAGODIA_OPERATORS,
  ...MON3TR_OPERATORS,
  ...NARANT_OPERATORS,
  ...ELA_OPERATORS,
  ...FUZE_OPERATORS,
  ...SWIRE_ALTER_OPERATORS,
  ...ROSMONTIS_OPERATORS,
  ...WISADEL_OPERATORS,
  ...CHRISTINE_OPERATORS,
  ...EXECUTOR_REAPER_OPERATORS,
  ...PHILAE_OPERATORS,
  ...WINDFLIT_OPERATORS,
  ...BLEMISHINE_OPERATORS,
  ...FLAMETAIL_OPERATORS,
  ...ALANNA_OPERATORS,
  ...CATHERINE_OPERATORS,
  ...SENSHI_OPERATORS,
  ...TINMAN_OPERATORS,
  ...TECNO_OPERATORS,
  ...SAILEACH_OPERATORS,
  ...SURTR_OPERATORS,
  ...SPURIA_OPERATORS,
  ...ROBIN_OPERATORS,
  ...WULFENITE_OPERATORS,
  ...TIPPI_OPERATORS,
  ...LESSING_OPERATORS,
  ...PENANCE_OPERATORS,
  ...MUDROCK_OPERATORS,
  ...BLAZE_OPERATORS,
  ...GAVIAL_INVINCIBLE_OPERATORS,
  ...EYJAFJALLA_OPERATORS,
  ...FIAMMETTA_OPERATORS,
  ...HORN_OPERATORS,
  ...GNOSIS_OPERATORS,
  ...TEXAS_ALTER_OPERATORS,
  ...TYPHON_OPERATORS,
  ...IRENE_OPERATORS,
  ...DEGENBRECHER_OPERATORS,
  ...CHONGYUE_OPERATORS,
  ...PEPE_OPERATORS,
  ...GLADIIA_OPERATORS,
  ...ASCALON_OPERATORS,
  ...CROWNSLAYER_OPERATORS,
  ...IANA_OPERATORS,
  ...BRIGID_OPERATORS,
  ...SPECTER_ALTER_OPERATORS,
  ...YATO_ALTER_OPERATORS,
  ...LEE_OPERATORS,
  ...GOLDENGLOW_OPERATORS,
  ...LAPPLAND_ALTER_OPERATORS,
  ...THORNS_LODESTAR_OPERATORS,
  ...BLAZE_IGNITING_OPERATORS,
  ...EXUSIAI_COVENANT_OPERATORS,
  ...MAGALLAN_OPERATORS,
  ...LING_OPERATORS,
  ...SHU_OPERATORS,
  ...YU_OPERATORS,
  ...STAINLESS_OPERATORS,
  ...MITM_OPERATORS,
  ...HOOLHEYAK_OPERATORS,
  ...EBENHOLZ_OPERATORS,
  ...LIN_OPERATORS,
  ...ULPIANUS_OPERATORS,
  ...WEEDY_OPERATORS,
  ...VINA_OPERATORS,
  ...JESSICA_OPERATORS,
  ...SAND_RECKONER_OPERATORS,
  ...VIRTUOSA_OPERATORS,
  ...DOROTHY_OPERATORS,
  ...SKADI_ALTER_OPERATORS,
  ...INES_OPERATORS,
  ...CIVILIGHT_OPERATORS,
  ...REED_ALTER_OPERATORS,
  ...POZEMKA_OPERATORS,
  ...AMIYA_GUARD_OPERATORS,
  ...AMIYA_MEDIC_OPERATORS,
  ...ENTELECHIA_OPERATORS,
  ...CHEN_ALTER_OPERATORS,
  ...FROST_OPERATORS,
  ...MAYER_OPERATORS,
  ...FANG_FIRE_SHARPENED_OPERATORS,
  ...SIEGE_OPERATORS,
  ...FIREWATCH_OPERATORS,
  ...SURFER_OPERATORS,
  ...MELANITE_OPERATORS,
  ...ASH_OPERATORS,
  ...CHEN_OPERATORS,
  ...VULPIS_OPERATORS,
  ...SAGA_OPERATORS,
  ...EUNECTES_OPERATORS,
  ...AAK_OPERATORS,
  ...BENA_OPERATORS,
  ...KAZEMARU_OPERATORS,
  ...PHANTOM_OPERATORS,
  ...HOOK_EXPANSION_OPERATORS,
  ...FIVE_STAR_SPECIALIST_EXPANSION_OPERATORS,
  ...Object.fromEntries(Object.entries(SUPPORT_EXPANSION_OPERATORS)
    .filter(([id]) => ['char_272_strong', 'char_4107_vrdant', 'char_4165_ctrail', 'char_110_deepcl', 'char_484_robrta', 'char_452_bstalk'].includes(id))),
  ...AKKORD_OPERATORS,
  ...WINTIM_OPERATORS,
  ...JCINTA_OPERATORS,
  ...LIESEL_OPERATORS,
  ...CLOSUR_OPERATORS,
  ...RECKPR_OPERATORS,
  ...VARKIS_OPERATORS,
  ...SNHUNT_OPERATORS,
  ...KICHI_OPERATORS,
  ...CAIRN_OPERATORS,
  ...TANYA_OPERATORS,
  ...THUMPY_OPERATORS,
  ...TMSLOT_OPERATORS,
  ...PEDRO_OPERATORS,
  ...MCNIST_OPERATORS,
  ...GALLUS_OPERATORS,
  ...KOROMARU_OPERATORS,
  ...RECON_OPERATORS,
  ...TURDUS_OPERATORS,
  ...JU_OPERATORS,
  ...TARAXA_OPERATORS,
  ...BOTANY_OPERATORS,
  ...SKYBOX_OPERATORS,
  ...AEGIS_OPERATORS,
  ...YUKARI_OPERATORS,
  ...MAKOTO_OPERATORS,
  ...APHRISSA_OPERATORS,
  ...HADIYA_OPERATORS,
  ...AMORIS_OPERATORS,
  ...TMORIS_OPERATORS,
  ...DOLRIS_OPERATORS,
  ...MORTIS_OPERATORS,
  ...OBLVNS_OPERATORS,
  ...MAKIRI_OPERATORS,
  ...FLWR2_OPERATORS,
  ...HEADB2_OPERATORS,
  ...TITI_OPERATORS,
  ...BRANCH_OPERATORS,
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
