#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the original serialized content of the enemy ability components that
reviewed enemy features read (shared/arkpedia/enemy-features.js).

Each component is located through the verified timing index
(data/arkpedia-enemy-clock-source.json) and kept as the exact canonical JSON whose
sha256 the index already records as originalDataSha256, so the content is tied to
the pinned CN bundles without re-trusting this script. Same-prefab MonoBehaviours
those components reference (validators, selectors), which the index does not
hash, are kept from the same hash-verified bundles with their own sha256. Buff
templates the kept content names are copied from the pinned Global
buff_template_data (data/arkpedia-mvp.json behaviors.source).

  python tools/arkpedia/extract-enemy-native-abilities.py [--check]
"""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

C = ROOT / '.cache/arkpedia/cn-native-source'
OUT = ROOT / 'data/arkpedia-enemy-native-abilities.json'
index_raw = (ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes()
index = json.loads(index_raw)
source = json.loads((ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes())
bundles = {r['path']: r for r in source['bundles']}
# Component object names whose content a reviewed feature reads.
OBJECTS = ['DefDown', 'enhance', 'Blink', 'enemy_1220_dzoms', 'enemy_1220_dzoms_2', 'enemy_1221_dzomg', 'enemy_1221_dzomg_2', 'ColdAttack', 'StunAttack', 'StormAura', 'Lasso', 'blink', 'dmg_res', 'buff_to_blocker', 'Boomb']
SCOPED_OBJECTS = {
    'enemy_5021_tmagfd': ['enemy_5021_tmagfd','Default','Attack','Trigger','NpcEffect'],
    'enemy_1391_dhbow': ['enemy_1391_dhbow','MagicMode','PhyMode','Attack','Selector','Passive'],
    'enemy_1391_dhbow_2': ['enemy_1391_dhbow_2','MagicMode','PhyMode','Attack','Selector','Passive'],
    'enemy_1179_aruarw': ['enemy_1179_aruarw','Night','Bright','Attack','Trigger','NightBuff','Passive'],
    'enemy_1179_aruarw_2': ['enemy_1179_aruarw_2','Night','Bright','Attack','Trigger','NightBuff','Passive'],
    'enemy_2047_smtree': ['enemy_2047_smtree','Default','Attack','Passive'],
    'enemy_1135_redman': ['enemy_1135_redman','Default','Combat','Attack','Trigger','Invi'],
    'enemy_1135_redman_2': ['enemy_1135_redman_2','Default','Combat','Attack','Trigger','Invi'],
    'enemy_10053_cjman': ['enemy_10053_cjman','Default','Combat','Attack','Selector'],
    'enemy_10053_cjman_2': ['enemy_10053_cjman_2','Default','Combat','Attack','Selector'],
    'enemy_1178_dscorp': ['enemy_1178_dscorp','Mode','NightBuff','Passive','Combat'],
    'enemy_1178_dscorp_2': ['enemy_1178_dscorp_2','Mode','NightBuff','Combat'],
    'enemy_5010_catrdg': ['enemy_5010_catrdg','Default','Crash'],
    'enemy_10069_ftlsj': ['enemy_10069_ftlsj','Default','Combat'],
    'enemy_10069_ftlsj_2': ['enemy_10069_ftlsj_2','Default','Combat'],
    'enemy_1080_sotidp': ['enemy_1080_sotidp','Default','Strength'],
    'enemy_1080_sotidp_2': ['enemy_1080_sotidp_2','Default','Strength'],
    'enemy_1078_sotisc': ['enemy_1078_sotisc','Default','Strength'],
    'enemy_1078_sotisc_2': ['enemy_1078_sotisc_2','Default','Strength'],
    'enemy_1082_soticn': ['enemy_1082_soticn','Default','Strength'],
    'enemy_1082_soticn_2': ['enemy_1082_soticn_2','Default','Strength'],
    'enemy_1083_sotiab': ['enemy_1083_sotiab','Default','Strength','Combat'],
    'enemy_1083_sotiab_2': ['enemy_1083_sotiab_2','Default','Strength','Combat'],

    'enemy_10095_crgst':['enemy_10095_crgst','Default','Combat','unblockable','check'],
    'enemy_10095_crgst_2':['enemy_10095_crgst_2','Default','Combat','unblockable','check'],
    'enemy_1335_bldrat':['enemy_1335_bldrat','Default','Combat','BloodHit'],
    'enemy_1335_bldrat_2':['enemy_1335_bldrat_2','Default','Combat','BloodHit'],
    'enemy_1364_spnaxe':['enemy_1364_spnaxe','Default','Combat','Attack','Selector','Summon'],
    'enemy_1364_spnaxe_2':['enemy_1364_spnaxe_2','Default','Combat','Attack','Selector','Summon'],
    'enemy_10091_hlsttu': ['enemy_10091_hlsttu','Default','Attack','Trigger','CircleShield','Passive','Effect'],
    'enemy_10091_hlsttu_2': ['enemy_10091_hlsttu_2','Default','Attack','Trigger','CircleShield','Passive','Effect'],
    'enemy_10091_hlsttu_3': ['enemy_10091_hlsttu_3','Default','Attack','Trigger','CircleShield','Passive','Effect','AttackTargetNum','LogKilled'],
    'enemy_1262_durplc': ['enemy_1262_durplc','Default','Combat','Resist'],
    'enemy_1262_durplc_2': ['enemy_1262_durplc_2','Default','Combat','Resist'],
    'enemy_2035_sybox': ['enemy_2035_sybox','Default','Combat','LogKilled','Graphic'],
    'enemy_2059_smbox': ['enemy_2059_smbox','Default','Combat','LogKilled','Graphic'],
    'enemy_2009_csaudc': ['enemy_2009_csaudc','Default','Combat'],
    'enemy_10052_cjshld': ['enemy_10052_cjshld','Default','Combat','Ability0'],
    'enemy_10052_cjshld_2': ['enemy_10052_cjshld_2','Default','Combat','Ability0'],
    'enemy_10019_sgmum': ['enemy_10019_sgmum','Default','Combat','hit_ad','hit_ap'],
    'enemy_10019_sgmum_2': ['enemy_10019_sgmum_2','Default','Combat','hit_ad','hit_ap'],
    'enemy_1263_durbus': ['enemy_1263_durbus','Default','Combat','Bus','Selector'],
    'enemy_1263_durbus_2': ['enemy_1263_durbus_2','Default','Combat','Bus','Selector'],
    'enemy_1410_mmelee': ['enemy_1410_mmelee','Default','Combat','PhysicalEvade'],
    'enemy_1410_mmelee_2': ['enemy_1410_mmelee_2','Default','Combat','PhysicalEvade'],
    'enemy_1516_jakill': ['enemy_1516_jakill','Default','R','Combat','Attack','Trigger','Reborn','Enhance','Liberty','LibertyOthersAbility','Selector','IronSandStorm','ArmorPiercing'],
    'enemy_1120_vofwiz': ['enemy_1120_vofwiz', 'Default', 'R', 'L', 'Combat', 'Attack', 'Trigger', 'Confinement', 'Liberty', 'AtkSpeedUp'],
    'enemy_1120_vofwiz_2': ['enemy_1120_vofwiz_2', 'Default', 'R', 'L', 'Combat', 'Attack', 'Trigger', 'Confinement', 'Liberty', 'AtkSpeedUp'],
    'enemy_1121_lifbos': ['enemy_1121_lifbos', 'Default', 'R', 'L', 'Combat', 'Confinement', 'Liberty', 'Selector', 'LibertyOthersAbility'],
    'enemy_1121_lifbos_2': ['enemy_1121_lifbos_2', 'Default', 'R', 'L', 'Combat', 'Confinement', 'Liberty', 'Selector', 'LibertyOthersAbility'],
    'enemy_1117_liiprr': ['enemy_1117_liiprr', 'Default', 'R', 'L', 'Attack', 'Trigger', 'Confinement', 'Liberty'],
    'enemy_1117_liiprr_2': ['enemy_1117_liiprr_2', 'Default', 'R', 'L', 'Attack', 'Trigger', 'Confinement', 'Liberty'],
    'enemy_1434_dsshel': ['enemy_1434_dsshel', 'Default', 'Combat', '0', 'KilledToLog'],
    'enemy_1271_nhkodo': ['enemy_1271_nhkodo', 'Default', 'S1', 'Combat', 'Devour', 'Stronger', 'Selector'],
    'enemy_1271_nhkodo_2': ['enemy_1271_nhkodo_2', 'Default', 'S1', 'Combat', 'Devour', 'Stronger', 'Selector'],
    'enemy_2064_skzwdd': ['enemy_2064_skzwdd', 'Default', 'M1', 'Combat', 'MultiAttack'],
    'enemy_1276_telex': ['enemy_1276_telex', 'Default', 'Attack', 'Invincible', 'InfiniteAttack'],
    'enemy_1273_stmgun': ['enemy_1273_stmgun', 'Default', 'Attack', 'Cannon'],
    'enemy_1273_stmgun_2': ['enemy_1273_stmgun_2', 'Default', 'Attack', 'Cannon'],
    'enemy_1272_nhtank': ['enemy_1272_nhtank', 'Default', 'Combat', 'Attack', 'AttackPolluted', 'PollutedRangedAtk', 'Empty'],
    'enemy_1272_nhtank_2': ['enemy_1272_nhtank_2', 'Default', 'Combat', 'Attack', 'AttackPolluted', 'PollutedRangedAtk', 'Empty'],
    'enemy_1266_nhapos': ['enemy_1266_nhapos', 'Default', 'Combat', 'PollutedArea'],
    'enemy_1268_nhnrs': ['enemy_1268_nhnrs', 'Default', 'Attack', 'Heallarva'],
    'enemy_1268_nhnrs_2': ['enemy_1268_nhnrs_2', 'Default', 'Attack', 'Heallarva'],
    'enemy_2088_skzdwz': ['enemy_2088_skzdwz', 'Default', 'EmptyCombat', 'EffectAura', 'Apoptosis'],
    'enemy_2065_skzjs': ['enemy_2065_skzjs', 'Default', 'Combat', '1'],
    'enemy_1193_krgbsk': ['enemy_1193_krgbsk', 'Default', 'Combat', 'AtkUp', 'StatusResistance'],
    'enemy_1193_krgbsk_2': ['enemy_1193_krgbsk_2', 'Default', 'Combat', 'AtkUp', 'StatusResistance'],
    'enemy_10083_hlbird': ['Attack', 'Combat', 'Default', 'SelfFear', 'enemy_10083_hlbird'],
    'enemy_10083_hlbird_2': ['Attack', 'Combat', 'Default', 'SelfFear', 'enemy_10083_hlbird_2'],
    'enemy_10084_hlegle': ['Attack', 'Combat', 'DamageOrBullet', 'Default', 'Effect', 'SelfFear', 'enemy_10084_hlegle'],
    'enemy_10084_hlegle_2': ['Attack', 'Combat', 'DamageOrBullet', 'Default', 'Effect', 'SelfFear', 'enemy_10084_hlegle_2'],
    'enemy_10085_hllevi': ['Attack', 'Combat', 'Default', 'Effect', 'Roar', 'SelfFear', 'enemy_10085_hllevi'],
    'enemy_10085_hllevi_2': ['Attack', 'Combat', 'Default', 'Effect', 'Roar', 'SelfFear', 'enemy_10085_hllevi_2'],
    'enemy_10086_hltigr': ['enemy_10086_hltigr', 'Default', 'Combat', 'SelfFear'],
    'enemy_10086_hltigr_2': ['enemy_10086_hltigr_2', 'Default', 'Combat', 'SelfFear'],
    'enemy_1531_bbrain': ['Activate', 'Aoe', 'AoeM2', 'AoePrepare', 'AoeRelease', 'Attack', 'AttackD', 'AttackL', 'AttackLR', 'AttackR', 'AttackU', 'AttackUDLR', 'Aura', 'Aura Logger', 'Blink', 'DamageSplit', 'Default', 'HighlandStun', 'M2', 'Passive', 'Reborn', 'S2', 'Skills', 'enemy_1531_bbrain'],
    'enemy_1257_lydrty': ['enemy_1257_lydrty', 'Default', 'Passive', 'PlaceTrap', 'Attack'],
    'enemy_1250_lyengs': ['enemy_1250_lyengs', 'Default', 'Charge', 'Attack'],
    'enemy_1250_lyengs_2': ['enemy_1250_lyengs_2', 'Default', 'Charge', 'Attack'],
    'enemy_1255_lybgpa': ['enemy_1255_lybgpa', 'Default', 'Combat', 'Punch', 'PunchMain', 'FirstPunch', 'InturruptLasso', 'PunchEnd', 'Passive', 'KeepPunch', 'ReleaseFromBlocker', 'PunchReleaseLasso'],
    'enemy_1255_lybgpa_2': ['enemy_1255_lybgpa_2', 'Default', 'Combat', 'Punch', 'PunchMain', 'FirstPunch', 'InturruptLasso', 'PunchEnd', 'Passive', 'KeepPunch', 'ReleaseFromBlocker', 'PunchReleaseLasso'],
    'enemy_1251_lysyta': ['enemy_1251_lysyta', 'Default', 'Driver', 'Combat'],
    'enemy_1251_lysyta_2': ['enemy_1251_lysyta_2', 'Default', 'Driver', 'Combat'],
    'enemy_1252_lysytb': ['enemy_1252_lysytb', 'Default', 'Driver', 'Combat'],
    'enemy_1252_lysytb_2': ['enemy_1252_lysytb_2', 'Default', 'Driver', 'Combat'],
    'enemy_1253_lysytc': ['enemy_1253_lysytc', 'Default', 'Driver', 'DamageReduce', 'Combat'],
    'enemy_1253_lysytc_2': ['enemy_1253_lysytc_2', 'Default', 'Driver', 'DamageReduce', 'Combat'],
    'enemy_1256_lyacpa': ['enemy_1256_lyacpa', 'Default', 'Passive', 'Attack', 'Combat'],
    'enemy_1256_lyacpa_2': ['enemy_1256_lyacpa_2', 'Default', 'Passive', 'Attack', 'Combat'],
    'enemy_4007_murino': ['enemy_4007_murino', 'Default', 'Weakness', 'Direction', 'TriggerBonus', 'Combat'],
    'enemy_4007_murino_2': ['enemy_4007_murino_2', 'Default', 'Weakness', 'Direction', 'TriggerBonus', 'Combat'],
    'enemy_1536_ncrmcr': ['Arson', 'Arson_trigger', 'AtkUp', 'Attack', 'Aura', 'Chain_1', 'Chain_2', 'Combat', 'Combat_scale', 'Default', 'Mark', 'Passive_trigger', 'Reborn', 'Sacrifice_1', 'Sacrifice_2', 'enemy_1536_ncrmcr'],
    'enemy_1294_duchns': ['Aura', 'Bleed', 'Boom', 'Default', 'Mark', 'enemy_1294_duchns'],
    'enemy_1292_duskld': ['enemy_1292_duskld', 'Default', 'Prop', 'Attack', 'Empty', 'Born', 'BornAnim', 'RebornToProp', 'RebornToDefault', 'Revive[Trigger]', 'Invisible', 'Mark', 'aura'],
    'enemy_1292_duskld_2': ['enemy_1292_duskld_2', 'Default', 'Prop', 'Attack', 'Empty', 'Born', 'BornAnim', 'RebornToProp', 'RebornToDefault', 'Revive[Trigger]', 'Invisible', 'Mark', 'aura'],
    'enemy_1293_duswrd': ['enemy_1293_duswrd', 'Default', 'Combat', 'MultiAttack', 'ignite'],
    'enemy_1293_duswrd_2': ['enemy_1293_duswrd_2', 'Default', 'Combat', 'MultiAttack', 'ignite'],
    'enemy_1293_duswrd_3': ['enemy_1293_duswrd_3', 'Default', 'Combat', 'MultiAttack', 'ignite'],
    'enemy_1290_duflm': ['enemy_1290_duflm', 'Default', 'Attack', 'Boom'],
    'enemy_1290_duflm_2': ['enemy_1290_duflm_2', 'Default', 'Attack', 'Boom'],
    'enemy_1289_dubmb': ['enemy_1289_dubmb', 'Default', 'Attack', 'PowerAttack'],
    'enemy_1289_dubmb_2': ['enemy_1289_dubmb_2', 'Default', 'Attack', 'PowerAttack'],
    'enemy_1288_duskls': ['enemy_1288_duskls', 'Default', 'Prop', 'Attack', 'Empty', 'Born', 'BornAnim', 'RebornToProp', 'RebornToDefault', 'Revive[Trigger]', 'Invisible', 'Mark', 'aura'],
    'enemy_1288_duskls_2': ['enemy_1288_duskls_2', 'Default', 'Prop', 'Attack', 'Empty', 'Born', 'BornAnim', 'RebornToProp', 'RebornToDefault', 'Revive[Trigger]', 'Invisible', 'Mark', 'aura'],
    'enemy_1286_dumcy': ['enemy_1286_dumcy', 'Default', 'Combat', '1'],
    'enemy_1286_dumcy_2': ['enemy_1286_dumcy_2', 'Default', 'Combat', '1'],
    'enemy_1287_ducrb': ['enemy_1287_ducrb', 'Mode', 'Combat', 'mire[immune]'],
    'enemy_1287_ducrb_2': ['enemy_1287_ducrb_2', 'Mode', 'Combat', 'mire[immune]'],
    'enemy_1291_dusrch': ['enemy_1291_dusrch', 'Default', 'Combat', 'aura', 'mire[immune]'],
    'enemy_1291_dusrch_2': ['enemy_1291_dusrch_2', 'Default', 'Combat', 'aura', 'mire[immune]'],
    'enemy_2070_skzfbx': ['enemy_2070_skzfbx', 'Fly', 'Walk', 'Combat', 'EmptyCombat', 'RecoverAnim', 'FallDown', 'M0Effect', 'M1Effect', '1', 'LogKilled'],
    'enemy_1171_durokt': ['enemy_1171_durokt', 'Fly', 'Walk', 'Combat', 'EmptyCombat', 'RecoverAnim', 'FallDown', 'M0Effect', 'M1Effect'],
    'enemy_1171_durokt_2': ['enemy_1171_durokt_2', 'Fly', 'Walk', 'Combat', 'EmptyCombat', 'RecoverAnim', 'FallDown', 'M0Effect', 'M1Effect'],
    'enemy_2067_skzcy': ['enemy_2067_skzcy', 'Default', 'Combat', 'JustSelector', '1'],
    'enemy_2069_skzbox': ['enemy_2069_skzbox', 'Default', 'Combat', 'LogKilled'],
    'enemy_2091_skzgds': ['enemy_2091_skzgds', 'Default', 'Combat', 'Attack', 'Ability0'],
    'enemy_1097_cclmbjk': ['enemy_1097_cclmbjk', 'Default', 'Attack', 'Combat', 'CutTree'],
    'enemy_1097_cclmbjk_2': ['enemy_1097_cclmbjk_2', 'Default', 'Attack', 'Combat', 'CutTree'],
    'enemy_1264_durgrd': ['enemy_1264_durgrd', 'Default', 'Combat', 'Rage'],
    'enemy_1264_durgrd_2': ['enemy_1264_durgrd_2', 'Default', 'Combat', 'Rage'],
    'enemy_1328_cbjedi': ['enemy_1328_cbjedi', 'Default', 'Combat', 'unbalanced_bleed'],
    'enemy_1328_cbjedi_2': ['enemy_1328_cbjedi_2', 'Default', 'Combat', 'unbalanced_bleed'],
    'enemy_1329_cbshld': ['enemy_1329_cbshld', 'Default', 'Combat', 'def_reduce'],
    'enemy_1329_cbshld_2': ['enemy_1329_cbshld_2', 'Default', 'Combat', 'def_reduce'],
    'enemy_1192_krgscr': ['enemy_1192_krgscr', 'Default', 'Attack', 'ColdAttack', 'StatusResistance'],
    'enemy_1192_krgscr_2': ['enemy_1192_krgscr_2', 'Default', 'Attack', 'ColdAttack', 'StatusResistance'],
    'enemy_1187_krghd': ['enemy_1187_krghd', 'Default', 'Combat', 'StatusResistance'],
    'enemy_1187_krghd_2': ['enemy_1187_krghd_2', 'Default', 'Combat', 'StatusResistance'],
    'enemy_1189_krgaxe': ['enemy_1189_krgaxe', 'Default', 'Combat', 'Effect'],
    'enemy_1189_krgaxe_2': ['enemy_1189_krgaxe_2', 'Default', 'Combat', 'Effect'],
    'enemy_1188_krgdrn': ['enemy_1188_krgdrn', 'Default', 'Attack', 'Trigger', 'StatusResistance'],
    'enemy_1188_krgdrn_2': ['enemy_1188_krgdrn_2', 'Default', 'Attack', 'Trigger', 'StatusResistance'],
    'enemy_1247_ltgtld': ['enemy_1247_ltgtld', 'Default', 'Attack', 'SummonShadow'],
    'enemy_1248_ltholo': ['enemy_1248_ltholo', 'Default', 'NoCombat', 'Weak'],
    'enemy_1243_ltswar': ['enemy_1243_ltswar', 'Default', 'Combat', 'Trigger', 'FourDirAttack'],
    'enemy_1243_ltswar_2': ['enemy_1243_ltswar_2', 'Default', 'Combat', 'Trigger', 'FourDirAttack'],
    'enemy_1244_ltssch': ['enemy_1244_ltssch', 'Default', 'Attack', 'Trigger'],
    'enemy_1244_ltssch_2': ['enemy_1244_ltssch_2', 'Default', 'Attack', 'Trigger'],
    'enemy_1245_ltseal': ['enemy_1245_ltseal', 'Default', 'Life', 'Attack', 'Effect'],
    'enemy_1241_ltmage': ['enemy_1241_ltmage', 'Default', 'Attack', 'Trigger', 'AOEDamage'],
    'enemy_1241_ltmage_2': ['enemy_1241_ltmage_2', 'Default', 'Attack', 'Trigger', 'AOEDamage'],
    'enemy_1242_ltsmag': ['enemy_1242_ltsmag', 'Default', 'Attack', 'Trigger', 'EmitProjectile'],
    'enemy_1242_ltsmag_2': ['enemy_1242_ltsmag_2', 'Default', 'Attack', 'Trigger', 'EmitProjectile'],

    'enemy_1240_ltgint': ['enemy_1240_ltgint', 'Default', 'Combat', 'Weak'],
    'enemy_1240_ltgint_2': ['enemy_1240_ltgint_2', 'Default', 'Combat', 'Weak'],
    'enemy_1238_ltmob': ['enemy_1238_ltmob', 'Default', 'Combat', 'Attack', 'Trigger', 'ExAtk'],
    'enemy_1238_ltmob_2': ['enemy_1238_ltmob_2', 'Default', 'Combat', 'Attack', 'Trigger', 'ExAtk'],
    'enemy_1239_ltbow': ['enemy_1239_ltbow', 'Default', 'Combat', 'Attack', 'Trigger', 'ExAtk'],
    'enemy_1239_ltbow_2': ['enemy_1239_ltbow_2', 'Default', 'Combat', 'Attack', 'Trigger', 'ExAtk'],

    'enemy_1143_merrpg': ['enemy_1143_merrpg', 'Default', 'Melee', 'Combat', 'MoveSpeedUp'],
    'enemy_1143_merrpg_2': ['enemy_1143_merrpg_2', 'Default', 'Melee', 'Combat', 'MoveSpeedUp'],
    'enemy_1133_harchn': ['enemy_1133_harchn', 'Default', 'Attack', 'Trigger', 'deathrattle', 'SummonToken'],
    'enemy_1133_harchn_2': ['enemy_1133_harchn_2', 'Default', 'Attack', 'Trigger', 'deathrattle', 'SummonToken'],
    'enemy_1420_lrmm': ['enemy_1420_lrmm', 'Default', 'SelfBuff', 'TraceStorm'],
    'enemy_1420_lrmm_2': ['enemy_1420_lrmm_2', 'Default', 'SelfBuff', 'TraceStorm'],
    'enemy_1421_lrchld': ['enemy_1421_lrchld', 'Default', 'Combat', 'Immune', 'SelectChld', 'SelectChildSingle'],
    'enemy_1421_lrchld_2': ['enemy_1421_lrchld_2', 'Default', 'Combat', 'Immune', 'SelectChld', 'SelectChildSingle'],
    'enemy_1509_mousek': ['enemy_1509_mousek', 'Attack', 'Default', 'DriftSand', 'Mark', 'MaxHpAsc', 'MaxHpDes', 'NoShield', 'SandStorm', 'SleepImmune', 'defup', 'effect', 'enrage', 'shield'],
    'enemy_1205_sfpin': ['enemy_1205_sfpin', 'Default', 'Attack', 'Trigger', 'PowerAttack', 'DeadSpawn'],
    'enemy_1205_sfpin_2': ['enemy_1205_sfpin_2', 'Default', 'Attack', 'Trigger', 'PowerAttack', 'DeadSpawn'],
    'enemy_1207_sfji': ['enemy_1207_sfji', 'PowerUp', 'Combat', 'DeadSpawn', 'AtkUp', 'Default'],
    'enemy_1207_sfji_2': ['enemy_1207_sfji_2', 'PowerUp', 'Combat', 'DeadSpawn', 'AtkUp', 'Default', 'LogKilled'],
    'enemy_1209_sfden': ['enemy_1209_sfden', 'Default', 'InvisibleShield', 'Combat', 'DeadSpawn', 'AuraInvisible'],
    'enemy_1209_sfden_2': ['enemy_1209_sfden_2', 'Default', 'InvisibleShield', 'Combat', 'DeadSpawn', 'AuraInvisible'],
    'enemy_1511_mdrock': ['enemy_1511_mdrock', 'Default', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Combat', 'Charge', 'Shield', 'RefreshShield', 'Occupy', 'SleepImmune'],
    'enemy_1088_ltsmer': ['enemy_1088_ltsmer', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1088_ltsmer_2': ['enemy_1088_ltsmer_2', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1089_ltlntc': ['enemy_1089_ltlntc', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1089_ltlntc_2': ['enemy_1089_ltlntc_2', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1090_mdsnpr': ['enemy_1090_mdsnpr', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1090_mdsnpr_2': ['enemy_1090_mdsnpr_2', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1091_mdhmmr': ['enemy_1091_mdhmmr', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_1091_mdhmmr_2': ['enemy_1091_mdhmmr_2', 'Default', 'Normal', 'Shield', 'Combat', 'Attack', 'Trigger', 'Charge', 'periodic_damage', 'boom', 'occupy', 'shield'],
    'enemy_2085_skzjxd': ['enemy_2085_skzjxd', 'Attack', 'StateListener', 'LogKilled', 'Shield', 'Weakness', 'Show', 'ShowTrigger', 'Shield_Back'],
    'enemy_1104_lfkght': ['enemy_1104_lfkght', 'Body', 'Attack', 'Trigger', 'reborn', 'AtkDesWeaken'],
    'enemy_1104_lfkght_2': ['enemy_1104_lfkght_2', 'Body', 'Attack', 'Trigger', 'reborn', 'AtkDesWeaken'],
    'enemy_1104_lfkght_3': ['enemy_1104_lfkght_3', 'Mode', 'Attack', 'Trigger', 'reborn', 'AtkDesWeaken'],
    'enemy_1513_dekght': ['enemy_1513_dekght', 'Combat', 'AOE', 'TriggerRage', 'ChargeAttack', 'EffectBuff'],
    'enemy_1513_dekght_2': ['enemy_1513_dekght_2', 'Attack', 'Trigger', 'TriggerRage', 'TripleAttack', 'EffectBuff'],
    'enemy_1217_rescar': ['enemy_1217_rescar', 'Default', 'Combat', 'Attack', 'ShotBuff', 'BornCar'],
    'enemy_1217_rescar_2': ['enemy_1217_rescar_2', 'Default', 'Combat', 'Attack', 'ShotBuff', 'BornCar'],
    'enemy_1218_bomscr': ['enemy_1218_bomscr', 'Default', 'Combat', 'Boom', 'Effect'],
    'enemy_1218_bomscr_2': ['enemy_1218_bomscr_2', 'Default', 'Combat', 'Boom', 'Effect'],
    'enemy_1219_mtrbty': ['enemy_1219_mtrbty', 'Default', 'HeadShot', 'Combat', 'Attack', 'ShotBuff'],
    'enemy_1219_mtrbty_2': ['enemy_1219_mtrbty_2', 'Default', 'HeadShot', 'Combat', 'Attack', 'ShotBuff'],
    'enemy_1215_ptrarc': ['enemy_1215_ptrarc', 'Default', 'Attack', 'ShotTrap'],
    'enemy_1215_ptrarc_2': ['enemy_1215_ptrarc_2', 'Default', 'Attack', 'ShotTrap'],
    'enemy_1216_cansld': ['enemy_1216_cansld', 'Default', 'HeadShot', 'Combat', 'Attack', 'ShotBuff'],
    'enemy_1216_cansld_2': ['enemy_1216_cansld_2', 'Default', 'HeadShot', 'Combat', 'Attack', 'ShotBuff'],
    'enemy_1213_mtrsnp': ['enemy_1213_mtrsnp', 'Default', 'HeadShot', 'Attack', 'Combat', 'ShotBuff'],
    'enemy_1213_mtrsnp_2': ['enemy_1213_mtrsnp_2', 'Default', 'HeadShot', 'Attack', 'Combat', 'ShotBuff'],
    'enemy_1214_mtrmgc': ['enemy_1214_mtrmgc', 'Default', 'FireShot', 'Attack', 'Combat', 'ShotBuff'],
    'enemy_1214_mtrmgc_2': ['enemy_1214_mtrmgc_2', 'Default', 'FireShot', 'Attack', 'Combat', 'ShotBuff'],

    'enemy_1060_emouse': ['enemy_1060_emouse', 'Default', 'SpeedUp', 'shield', 'speedup', 'Combat'],
    'enemy_1060_emouse_2': ['enemy_1060_emouse_2', 'Default', 'SpeedUp', 'shield', 'speedup', 'Combat'],
    'enemy_1057_gansho': ['enemy_1057_gansho', 'Default', 'Attack'],
    'enemy_1057_gansho_2': ['enemy_1057_gansho_2', 'Default', 'Attack'],
    'enemy_1059_buster': ['enemy_1059_buster', 'Default', 'Attack', 'AtkUp'],
    'enemy_1059_buster_2': ['enemy_1059_buster_2', 'Default', 'Attack', 'AtkUp'],
    'enemy_1267_nhpbr': ['PollutedDie'],
    'enemy_1267_nhpbr_2': ['PollutedDie'],
    'enemy_1425_lrcmra': ['enemy_1425_lrcmra', 'triggerAnim', 'Combat', 'Default', 'Originium', 'OrigAura', 'AtkBoost', 'switchToOrig'],
    'enemy_1425_lrcmra_2': ['enemy_1425_lrcmra_2', 'triggerAnim', 'Combat', 'Default', 'Originium', 'OrigAura', 'AtkBoost', 'switchToOrig'],
    'enemy_1068_snmage': ['enemy_1068_snmage', 'Default', 'Attack', 'ColdAttack'],
    'enemy_1068_snmage_2': ['enemy_1068_snmage_2', 'Default', 'Attack', 'ColdAttack'],

    'enemy_1085_sotiwz': ['enemy_1085_sotiwz', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1085_sotiwz_2': ['enemy_1085_sotiwz_2', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1085_sotiwz_3': ['enemy_1085_sotiwz_3', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1084_sotidm': ['enemy_1084_sotidm', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1084_sotidm_2': ['enemy_1084_sotidm_2', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1084_sotidm_3': ['enemy_1084_sotidm_3', 'Immo', 'Immo[Rage]', 'Ore_immune', 'Effect', 'Trigger', 'Default', 'Rage', 'Combat', 'Attack'],
    'enemy_1112_emppnt': ['Attack', 'ScanRange'],
    'enemy_1112_emppnt_2': ['Attack', 'ScanRange'],
    'enemy_1070_iced': ['Bomb'],
    'enemy_1045_hammer': ['StunCombat'],
    'enemy_1045_hammer_2': ['StunCombat'],
    'enemy_1048_hirman': ['MagicResistance'],
    'enemy_1048_hirman_2': ['MagicResistance'],
    'enemy_1049_eagent': ['ReduceBlockCnt'],
    'enemy_1049_eagent_2': ['ReduceBlockCnt'],
    'enemy_1024_mortar': ['Attack'],
    'enemy_1024_mortar_2': ['Attack'],
    'enemy_1072_dlancer': ['Rush', 'FirstAttack'],
    'enemy_1072_dlancer_2': ['Rush', 'FirstAttack'],
    'enemy_2001_duckmi': ['Run', 'SpeedUp'],
    'enemy_1058_traink': ['enemy_1058_traink', 'Passsive'],
    'enemy_1058_traink_2': ['enemy_1058_traink_2', 'Passsive'],
    'enemy_1092_mdgint': ['KilledToLog'],
    'enemy_1092_mdgint_2': ['KilledToLog'],
    'enemy_1050_lslime': ['enemy_1050_lslime', 'Default', 'Attack', 'RangeDamageAbility', 'RangeDamage', 'SelfBuff', 'Dot'],
    'enemy_1074_dbskar': ['enemy_1074_dbskar', 'Normal', 'Sleep', 'Revive', 'Attack', 'Combat'],
    'enemy_1074_dbskar_2': ['enemy_1074_dbskar_2', 'Normal', 'Sleep', 'Revive', 'Attack', 'Combat'],
    'enemy_1075_dmgswd': ['enemy_1075_dmgswd', 'Normal', 'Sleep', 'Revive', 'Attack', 'Combat'],
    'enemy_1075_dmgswd_2': ['enemy_1075_dmgswd_2', 'Normal', 'Sleep', 'Revive', 'Attack', 'Combat'],
    'enemy_1073_dscout': ['enemy_1073_dscout', 'Normal', 'Awake', 'Warn', 'Undeadable', 'Combat'],
    'enemy_1073_dscout_2': ['enemy_1073_dscout_2', 'Normal', 'Awake', 'Warn', 'Undeadable', 'Undead', 'Combat'],
    'enemy_1076_bsthmr': ['AOE', 'Combat'],
    'enemy_1076_bsthmr_2': ['AOE', 'Combat'],
    'enemy_2034_sythef': ['Combat', 'BuffEffect'],
    'enemy_1105_tyokai_2': ['enemy_1105_tyokai_2', 'KilledToLog', 'loot'],
    'enemy_1105_tyokai': ['enemy_1105_tyokai', 'KilledToLog', 'loot'],
    'enemy_1106_byokai': ['enemy_1106_byokai', 'KilledToLog', 'buff'],
    'enemy_2005_axetro': ['Checker', 'AtkUp', 'Combat', 'Attack'],
    'enemy_1098_cchmpn': ['duel'],
    'enemy_1098_cchmpn_2': ['duel'],
    'enemy_1203_sfhu': ['Attack', 'DeadBoom'],
    'enemy_1203_sfhu_2': ['Attack', 'DeadBoom'],
}
templates_raw = (ROOT / '.cache/arkpedia/buff_template_data.json').read_bytes()
template_pin = json.loads((ROOT / 'data/arkpedia-mvp.json').read_bytes())['behaviors']['source']
assert hashlib.sha256(templates_raw).hexdigest() == template_pin['sha256']
TEMPLATES = json.loads(templates_raw)


def exact(v, key=''):
    if isinstance(v, dict): return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [exact(x, key) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v


def canonical(v):
    return json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def local_refs(v):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}:
            if v['m_FileID'] == 0 and str(v['m_PathID']) != '0': yield str(v['m_PathID'])
            return
        for k, x in v.items():
            if k not in ('m_GameObject', 'm_Script'): yield from local_refs(x)
    elif isinstance(v, list):
        for x in v: yield from local_refs(x)


def template_keys(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if k in ('templateKey', '_templateKey') and isinstance(x, str) and x in TEMPLATES: yield x
            else: yield from template_keys(x)
    elif isinstance(v, list):
        for x in v: yield from template_keys(x)


def auxiliary_candidates():
    """Retain evidence, never grant support. The separate exact auxiliary
    classifier still rejects gameplay buffs, selectors and unknown actions."""
    records = json.loads((ROOT / 'data/arkpedia-enemy-records.json').read_bytes())
    using = {}
    for entry in records['enemies'].values():
        for record in entry['levels'].values():
            using.setdefault(record['prefabKey'], []).append(record)
    candidates = {}
    for key, levels in using.items():
        if any(r['abilities'] or r['skills'] or r['talents']['groups'] for r in levels):
            continue
        path = f'dyn/battle/prefabs/enemies/{key}.prefab'
        prefab = index['prefabs'].get(path)
        if not prefab:
            continue
        rows = prefab['clockComponents']
        root = next((c for c in rows if '_modes' in c['fields']), None)
        if not root or len(root['fields']['_modes']) != 1 or any('_familyMask' in c['fields'] for c in rows):
            continue
        refs = [ref for c in rows for name in ('_commonAbilities', '_generalAbilities')
                for ref in c['fields'].get(name, []) if ref['m_PathID'] != '0']
        by_path = {c['pathId']: c for c in rows}
        if not refs or any(ref['m_FileID'] != 0 or ref['m_PathID'] not in by_path
                           or by_path[ref['m_PathID']]['script']['m_PathID'] != '3800760148018415462'
                           for ref in refs):
            continue
        candidates[path] = {ref['m_PathID'] for ref in refs}
    return candidates


automatic_auxiliaries = auxiliary_candidates()
wanted = {}
for path, p in index['prefabs'].items():
    for c in p['clockComponents']:
        if (c['objectName'] in OBJECTS or c['objectName'] in SCOPED_OBJECTS.get(p['rootName'], [])
                or c['pathId'] in automatic_auxiliaries.get(path, set())):
            wanted.setdefault(p['bundle'], []).append((path, c))
components = {}
used_templates = {'tile_originum_t_1[dmg]', 'fear_buff', 'enemy_durcar_hit_blocker'}
for bundle in sorted(wanted):
    row = bundles[bundle]
    raw = (C / 'bundles' / bundle).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256']
    by = {o.path_id: o for o in UnityPy.load(raw).objects}
    for path, c in wanted[bundle]:
        data = exact(by[int(c['pathId'])].read_typetree())
        text = canonical(data)
        assert hashlib.sha256(text.encode()).hexdigest() == c['originalDataSha256'], (path, c['pathId'])
        rows = components.setdefault(path, [])
        retained = {'pathId': c['pathId'], 'objectName': c['objectName'], 'originalJson': text}
        # Mode-local talents need their verified hierarchy identity as well as
        # their serialized fields. Retain only the families that consume it.
        if path.rsplit('/', 1)[-1] in ('enemy_1536_ncrmcr.prefab', 'enemy_1294_duchns.prefab', 'enemy_1292_duskld.prefab', 'enemy_1292_duskld_2.prefab', 'enemy_1288_duskls.prefab', 'enemy_1288_duskls_2.prefab', 'enemy_2070_skzfbx.prefab', 'enemy_1171_durokt.prefab', 'enemy_1171_durokt_2.prefab'):
            retained['ancestors'] = c['ancestors']
        rows.append(retained)
        # Referenced same-bundle MonoBehaviours, transitively; each keeps its own digest.
        seen, todo = {r['pathId'] for r in rows}, list(local_refs(data))
        while todo:
            ref = todo.pop()
            if ref in seen or by[int(ref)].type.name != 'MonoBehaviour': continue
            seen.add(ref)
            d = exact(by[int(ref)].read_typetree()); t = canonical(d)
            go = by[int(d['m_GameObject']['m_PathID'])].read_typetree()['m_Name']
            rows.append({'pathId': ref, 'objectName': go, 'referenced': True, 'sha256': hashlib.sha256(t.encode()).hexdigest(), 'originalJson': t})
            todo.extend(local_refs(d))
        # Tree cutters use separate unit and tile circles, both stored beside
        # their trigger rather than through a serialized ability reference.
        if path.rsplit('/', 1)[-1] in ('enemy_1097_cclmbjk.prefab', 'enemy_1097_cclmbjk_2.prefab'):
            for r in list(rows):
                component = json.loads(r['originalJson'])
                if '_keepTarget' not in component and '_minTileNum' not in component: continue
                go = by[int(component['m_GameObject']['m_PathID'])].read_typetree()
                for sibling in go['m_Component']:
                    ref = str(sibling['component']['m_PathID']); obj = by[int(ref)]
                    if ref in seen or obj.type.name not in ('MonoBehaviour', 'CircleCollider2D', 'Transform'): continue
                    seen.add(ref); text = canonical(exact(obj.read_typetree()))
                    rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                                 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'originalJson': text})
        # Range-selector geometry is a sibling Unity component, not a MonoBehaviour reference.
        if path.rsplit('/', 1)[-1] in ('enemy_1509_mousek.prefab', 'enemy_1205_sfpin.prefab', 'enemy_1205_sfpin_2.prefab', 'enemy_1207_sfji.prefab', 'enemy_1207_sfji_2.prefab', 'enemy_1209_sfden.prefab', 'enemy_1209_sfden_2.prefab', 'enemy_1511_mdrock.prefab', 'enemy_1088_ltsmer.prefab', 'enemy_1088_ltsmer_2.prefab', 'enemy_1057_gansho.prefab', 'enemy_1057_gansho_2.prefab', 'enemy_1059_buster.prefab', 'enemy_1059_buster_2.prefab'):
            for r in list(rows):
                component = json.loads(r['originalJson'])
                if '_keepTarget' not in component: continue
                go = by[int(component['m_GameObject']['m_PathID'])].read_typetree()
                for sibling in go['m_Component']:
                    ref = str(sibling['component']['m_PathID']); obj = by[int(ref)]
                    if ref in seen or obj.type.name not in ('MonoBehaviour', 'CircleCollider2D', 'Transform'): continue
                    seen.add(ref); text = canonical(exact(obj.read_typetree()))
                    rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                                 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'originalJson': text})
        # Retain it once for the reviewed circle selectors, including global alarm and ranged attacks.
        if path.rsplit('/', 1)[-1] in ('enemy_1273_stmgun.prefab', 'enemy_1273_stmgun_2.prefab', 'enemy_1536_ncrmcr.prefab', 'enemy_1294_duchns.prefab', 'enemy_1292_duskld.prefab', 'enemy_1292_duskld_2.prefab', 'enemy_1288_duskls.prefab', 'enemy_1288_duskls_2.prefab', 'enemy_1509_mousek.prefab', 'enemy_1205_sfpin.prefab', 'enemy_1205_sfpin_2.prefab', 'enemy_1209_sfden.prefab', 'enemy_1209_sfden_2.prefab', 'enemy_1511_mdrock.prefab', 'enemy_1104_lfkght.prefab', 'enemy_1104_lfkght_2.prefab', 'enemy_1104_lfkght_3.prefab', 'enemy_1085_sotiwz.prefab', 'enemy_1085_sotiwz_2.prefab', 'enemy_1085_sotiwz_3.prefab', 'enemy_1050_lslime.prefab', 'enemy_1513_dekght_2.prefab', 'enemy_1073_dscout.prefab', 'enemy_1073_dscout_2.prefab', 'enemy_1074_dbskar.prefab', 'enemy_1074_dbskar_2.prefab', 'enemy_1425_lrcmra.prefab', 'enemy_1425_lrcmra_2.prefab'):
            for r in list(rows):
                selector = json.loads(r['originalJson'])
                if selector.get('m_Script', {}).get('m_PathID') not in ('7080728813803358465', '6185056810787956083', '9073738633337710967'): continue
                go = by[int(selector['m_GameObject']['m_PathID'])].read_typetree()
                for component in go['m_Component']:
                    ref = str(component['component']['m_PathID']); obj = by[int(ref)]
                    if ref in seen or obj.type.name not in ('Transform', 'CircleCollider2D'): continue
                    seen.add(ref); geom = canonical(exact(obj.read_typetree()))
                    rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                                 'sha256': hashlib.sha256(geom.encode()).hexdigest(), 'originalJson': geom})
        # Sentinels have a sibling global-range component and a leader-only
        # ability-finish buff hook which the clock index does not classify.
        if path.rsplit('/', 1)[-1] in ('enemy_1509_mousek.prefab', 'enemy_1205_sfpin.prefab', 'enemy_1205_sfpin_2.prefab', 'enemy_1207_sfji.prefab', 'enemy_1207_sfji_2.prefab', 'enemy_1209_sfden.prefab', 'enemy_1209_sfden_2.prefab', 'enemy_1511_mdrock.prefab', 'enemy_1088_ltsmer.prefab', 'enemy_1088_ltsmer_2.prefab', 'enemy_1104_lfkght.prefab', 'enemy_1104_lfkght_2.prefab', 'enemy_1104_lfkght_3.prefab', 'enemy_1513_dekght.prefab', 'enemy_1513_dekght_2.prefab', 'enemy_1073_dscout.prefab', 'enemy_1073_dscout_2.prefab', 'enemy_1425_lrcmra.prefab', 'enemy_1425_lrcmra_2.prefab', 'enemy_1213_mtrsnp.prefab', 'enemy_1213_mtrsnp_2.prefab', 'enemy_1214_mtrmgc.prefab', 'enemy_1214_mtrmgc_2.prefab', 'enemy_1216_cansld.prefab', 'enemy_1216_cansld_2.prefab', 'enemy_1215_ptrarc.prefab', 'enemy_1215_ptrarc_2.prefab', 'enemy_1219_mtrbty.prefab', 'enemy_1219_mtrbty_2.prefab', 'enemy_1217_rescar.prefab', 'enemy_1217_rescar_2.prefab', 'enemy_1218_bomscr.prefab', 'enemy_1218_bomscr_2.prefab'):
            for r in list(rows):
                if r['objectName'] not in ('enemy_1509_mousek', 'DriftSand', 'SandStorm', 'Mark', 'MaxHpAsc', 'MaxHpDes', 'NoShield', 'shield', 'enrage', 'enemy_1205_sfpin', 'enemy_1205_sfpin_2', 'PowerAttack', 'enemy_1207_sfji', 'enemy_1207_sfji_2', 'enemy_1209_sfden', 'enemy_1209_sfden_2', 'PowerUp', 'Default', 'AtkUp', 'DeadSpawn', 'InvisibleShield', 'AuraInvisible', 'Awake', 'Selector', 'OrigAura', 'triggerAnim', 'Attack', 'Trigger', 'Combat', 'BornCar', 'ChargeAttack', 'TripleAttack', 'AtkDesWeaken', 'reborn', 'Charge', 'RefreshShield', 'Occupy'): continue
                d = json.loads(r['originalJson'])
                go = by[int(d['m_GameObject']['m_PathID'])].read_typetree()
                for component in go['m_Component']:
                    ref = str(component['component']['m_PathID']); obj = by[int(ref)]
                    if ref in seen or obj.type.name != 'MonoBehaviour': continue
                    seen.add(ref); sibling = canonical(exact(obj.read_typetree()))
                    rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                                 'sha256': hashlib.sha256(sibling.encode()).hexdigest(), 'originalJson': sibling})
        # Explicit per-prefab sibling scopes avoid copying extraction branches
        # when a new family uses attack hooks or companion target selectors.
        sibling_names = {
            'enemy_5021_tmagfd': {'Attack','Trigger','NpcEffect'},
            'enemy_1391_dhbow': {'Attack','Selector','Passive'},
            'enemy_1391_dhbow_2': {'Attack','Selector','Passive'},
            'enemy_1179_aruarw': {'Attack','Trigger','NightBuff','Passive'},
            'enemy_1179_aruarw_2': {'Attack','Trigger','NightBuff','Passive'},
            'enemy_2047_smtree': {'Attack','Passive'},
            'enemy_1135_redman': {'Combat','Attack','Trigger','Invi'},
            'enemy_1135_redman_2': {'Combat','Attack','Trigger','Invi'},
            'enemy_10053_cjman': {'Combat','Attack','Selector'},
            'enemy_10053_cjman_2': {'Combat','Attack','Selector'},
            'enemy_1178_dscorp': {'NightBuff','Combat'},
            'enemy_1178_dscorp_2': {'NightBuff','Combat'},
            'enemy_5010_catrdg': {'Crash'},
            'enemy_10069_ftlsj': {'Combat'},
            'enemy_10069_ftlsj_2': {'Combat'},
            'enemy_1080_sotidp': {'Strength'},
            'enemy_1080_sotidp_2': {'Strength'},
            'enemy_1078_sotisc': {'Strength'},
            'enemy_1078_sotisc_2': {'Strength'},
            'enemy_1082_soticn': {'Strength'},
            'enemy_1082_soticn_2': {'Strength'},
            'enemy_1083_sotiab': {'Strength','Combat'},
            'enemy_1083_sotiab_2': {'Strength','Combat'},

            'enemy_10095_crgst': {'unblockable','check'},
            'enemy_10095_crgst_2': {'unblockable','check'},
            'enemy_1335_bldrat': {'Combat','BloodHit'},
            'enemy_1335_bldrat_2': {'Combat','BloodHit'},
            'enemy_1364_spnaxe': {'Attack'},
            'enemy_1364_spnaxe_2': {'Attack'},
            'enemy_10091_hlsttu': {'CircleShield','Attack'},
            'enemy_10091_hlsttu_2': {'CircleShield','Attack'},
            'enemy_10091_hlsttu_3': {'CircleShield','Attack','AttackTargetNum'},
            'enemy_1262_durplc': {'Resist'},
            'enemy_1262_durplc_2': {'Resist'},
            'enemy_2009_csaudc': {'Combat'},
            'enemy_10019_sgmum': {'hit_ad','hit_ap','Combat'},
            'enemy_10019_sgmum_2': {'hit_ad','hit_ap','Combat'},
            'enemy_1263_durbus': {'Bus','Selector','Combat'},
            'enemy_1263_durbus_2': {'Bus','Selector','Combat'},
            'enemy_1410_mmelee': {'PhysicalEvade','Combat'},
            'enemy_1410_mmelee_2': {'PhysicalEvade','Combat'},
            'enemy_1516_jakill': {'Default','R','Combat','Attack','Trigger','Reborn','Enhance','Liberty','LibertyOthersAbility','Selector','IronSandStorm','ArmorPiercing'},
            'enemy_1120_vofwiz': {'Combat','Attack','Trigger','Confinement','Liberty','AtkSpeedUp','R','L'},
            'enemy_1120_vofwiz_2': {'Combat','Attack','Trigger','Confinement','Liberty','AtkSpeedUp','R','L'},
            'enemy_1121_lifbos': {'Combat','Confinement','Liberty','Selector','LibertyOthersAbility','R','L'},
            'enemy_1121_lifbos_2': {'Combat','Confinement','Liberty','Selector','LibertyOthersAbility','R','L'},
            'enemy_1117_liiprr': {'Attack','Trigger','Confinement','Liberty','R','L'},
            'enemy_1117_liiprr_2': {'Attack','Trigger','Confinement','Liberty','R','L'},
            'enemy_1434_dsshel': {'0','KilledToLog','Combat'},
            'enemy_1271_nhkodo': {'Combat','Devour','Stronger','Selector','S1'},
            'enemy_1271_nhkodo_2': {'Combat','Devour','Stronger','Selector','S1'},
            'enemy_2064_skzwdd': {'Combat','MultiAttack'},
            'enemy_1276_telex': {'Attack','Invincible','InfiniteAttack','Trigger'},
            'enemy_1273_stmgun': {'Attack','Cannon','Trigger'},
            'enemy_1273_stmgun_2': {'Attack','Cannon','Trigger'},
            'enemy_1272_nhtank': {'Combat','Attack','AttackPolluted','PollutedRangedAtk','Empty','Trigger'},
            'enemy_1272_nhtank_2': {'Combat','Attack','AttackPolluted','PollutedRangedAtk','Empty','Trigger'},
            'enemy_1266_nhapos': {'PollutedArea', 'Trigger'},
            'enemy_1268_nhnrs': {'Heallarva', 'Trigger'},
            'enemy_1268_nhnrs_2': {'Heallarva', 'Trigger'},
            'enemy_2088_skzdwz': {'EffectAura', 'Apoptosis', 'Selector'},
            'enemy_2065_skzjs': {'Combat', '1'},
            'enemy_1193_krgbsk': {'Combat', 'AtkUp', 'StatusResistance'},
            'enemy_1193_krgbsk_2': {'Combat', 'AtkUp', 'StatusResistance'},
            'enemy_10084_hlegle': {'Selector', 'Attack', 'DamageOrBullet', 'Default'},
            'enemy_10084_hlegle_2': {'Selector', 'Attack', 'DamageOrBullet', 'Default'},
            'enemy_1536_ncrmcr': set(['Arson', 'Arson_trigger', 'AtkUp', 'Attack', 'Aura', 'Chain_1', 'Chain_2', 'Combat', 'Combat_scale', 'Default', 'Mark', 'Passive_trigger', 'Reborn', 'Sacrifice_1', 'Sacrifice_2', 'enemy_1536_ncrmcr']),
            'enemy_1294_duchns': set(['Aura', 'Bleed', 'Boom', 'Default', 'Mark', 'enemy_1294_duchns']),
            'enemy_1292_duskld': {'RebornToDefault', 'RebornToProp', 'Born', 'Default', 'enemy_1292_duskld', 'Prop', 'aura'},
            'enemy_1292_duskld_2': {'RebornToDefault', 'enemy_1292_duskld_2', 'RebornToProp', 'Born', 'Default', 'Prop', 'aura'},
            'enemy_1293_duswrd': {'Default', 'Combat', 'MultiAttack', 'ignite'},
            'enemy_1293_duswrd_2': {'Default', 'Combat', 'MultiAttack', 'ignite'},
            'enemy_1293_duswrd_3': {'Default', 'Combat', 'MultiAttack', 'ignite'},
            'enemy_1290_duflm': {'Default', 'Boom', 'Attack'},
            'enemy_1290_duflm_2': {'Default', 'Boom', 'Attack'},
            'enemy_1289_dubmb': {'Default', 'PowerAttack', 'Attack'},
            'enemy_1289_dubmb_2': {'Default', 'PowerAttack', 'Attack'},
            'enemy_1288_duskls': {'enemy_1288_duskls', 'RebornToProp', 'RebornToDefault', 'Prop', 'Default', 'aura', 'Born'},
            'enemy_1288_duskls_2': {'enemy_1288_duskls_2', 'RebornToProp', 'RebornToDefault', 'Prop', 'Default', 'aura', 'Born'},
            'enemy_1264_durgrd': {'Rage'},
            'enemy_1264_durgrd_2': {'Rage'},
            'enemy_1192_krgscr': {'Attack', 'ColdAttack', 'StatusResistance'},
            'enemy_1192_krgscr_2': {'Attack', 'ColdAttack', 'StatusResistance'},
            'enemy_1187_krghd': {'Combat', 'StatusResistance'},
            'enemy_1187_krghd_2': {'Combat', 'StatusResistance'},
            'enemy_1189_krgaxe': {'Effect', 'Combat'},
            'enemy_1189_krgaxe_2': {'Effect', 'Combat'},
            'enemy_1188_krgdrn': {'Attack', 'StatusResistance'},
            'enemy_1188_krgdrn_2': {'Attack', 'StatusResistance'},
            'enemy_1247_ltgtld': {'Attack', 'SummonShadow'},
            'enemy_1248_ltholo': {'NoCombat', 'Weak'},
            'enemy_1243_ltswar': {'FourDirAttack', 'Combat'},
            'enemy_1243_ltswar_2': {'FourDirAttack', 'Combat'},
            'enemy_1244_ltssch': {'Attack', 'Trigger'},
            'enemy_1244_ltssch_2': {'Attack', 'Trigger'},
            'enemy_1245_ltseal': {'Attack', 'Life'},
            'enemy_1241_ltmage': {'Attack', 'Trigger', 'AOEDamage'},
            'enemy_1241_ltmage_2': {'Attack', 'Trigger', 'AOEDamage'},
            'enemy_1242_ltsmag': {'Attack', 'Trigger', 'EmitProjectile'},
            'enemy_1242_ltsmag_2': {'Attack', 'Trigger', 'EmitProjectile'},

            'enemy_1238_ltmob': {'Combat', 'Attack', 'Trigger', 'ExAtk'},
            'enemy_1238_ltmob_2': {'Combat', 'Attack', 'Trigger', 'ExAtk'},
            'enemy_1239_ltbow': {'Combat', 'Attack', 'Trigger', 'ExAtk'},
            'enemy_1239_ltbow_2': {'Combat', 'Attack', 'Trigger', 'ExAtk'},

            'enemy_1143_merrpg': {'Combat', 'Trigger', 'MoveSpeedUp', 'Melee'},
            'enemy_1143_merrpg_2': {'Combat', 'Trigger', 'MoveSpeedUp', 'Melee'},
        }.get(index['prefabs'][path]['rootName'], set())
        for r in list(rows):
            if r['objectName'] not in sibling_names: continue
            d = json.loads(r['originalJson'])
            go = by[int(d['m_GameObject']['m_PathID'])].read_typetree()
            for component in go['m_Component']:
                ref = str(component['component']['m_PathID']); obj = by[int(ref)]
                if ref in seen or obj.type.name not in (('MonoBehaviour', 'Transform', 'BoxCollider2D') if index['prefabs'][path]['rootName'] == 'enemy_1245_ltseal' else ('MonoBehaviour',)): continue
                seen.add(ref); sibling = canonical(exact(obj.read_typetree()))
                rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                             'sha256': hashlib.sha256(sibling.encode()).hexdigest(), 'originalJson': sibling})
        # Geometry scopes complement MonoBehaviour sibling scopes. A family's
        # contact contract can retain its original colliders without a new branch.
        geometry_names = {
            'enemy_5021_tmagfd': {'Trigger'},
            'enemy_1391_dhbow': {'Selector'},
            'enemy_1391_dhbow_2': {'Selector'},
            'enemy_1179_aruarw': {'Trigger'},
            'enemy_1179_aruarw_2': {'Trigger'},
            'enemy_5010_catrdg': {'Crash'},
            'enemy_10053_cjman': {'Selector'},
            'enemy_10053_cjman_2': {'Selector'},
            'enemy_1263_durbus': {'Selector'},
            'enemy_1263_durbus_2': {'Selector'},
        }.get(path.rsplit('/', 1)[-1].removesuffix('.prefab'), set())
        for r in list(rows):
            if r['objectName'] not in geometry_names: continue
            d = json.loads(r['originalJson'])
            go = by[int(d['m_GameObject']['m_PathID'])].read_typetree()
            for component in go['m_Component']:
                ref = str(component['component']['m_PathID']); obj = by[int(ref)]
                if ref in seen or obj.type.name not in ('CircleCollider2D', 'BoxCollider2D', 'Transform'): continue
                seen.add(ref); original = canonical(exact(obj.read_typetree()))
                rows.append({'pathId': ref, 'objectName': go['m_Name'], 'referenced': True,
                             'sha256': hashlib.sha256(original.encode()).hexdigest(), 'originalJson': original})
        for r in rows: used_templates.update(template_keys(json.loads(r['originalJson'])))
templates, todo = {}, sorted(used_templates)
while todo:
    k = todo.pop()
    if k in templates: continue
    templates[k] = TEMPLATES[k]; todo.extend(template_keys(TEMPLATES[k]))
# Retain the reviewed projectile controllers from the separately pinned shared
# bundle. Both Bombtail variants share motion/target/hit behavior, not visuals.
projectile_source = next(r for r in json.loads((ROOT / 'data/arkpedia-cn-native-source.json').read_bytes())['bundles']
                         if r['path'] == 'battle/prefabs/[uc]projectiles.ab')
raw = (C / 'bundles' / projectile_source['path']).read_bytes()
assert len(raw) == projectile_source['bytes'] and hashlib.sha256(raw).hexdigest() == projectile_source['sha256']
by = {o.path_id: o for o in UnityPy.load(raw).objects}
projectiles = {}
for o in by.values():
    if o.type.name not in ('MonoBehaviour', 'BoxCollider2D', 'CircleCollider2D'): continue
    d = o.read_typetree()
    name = by[d['m_GameObject']['m_PathID']].read_typetree()['m_Name']
    if name not in ('projectile_enemy_tidmag', 'projectile_enemy_dhbow_magic', 'projectile_enemy_dhbow_phy', 'projectile_enemy_aruarw_night', 'projectile_enemy_aruarw_bright', 'projectile_enemy_redman', 'projectile_enemy_hlsttu', 'projectile_enemy_jakill', 'projectile_enemy_jakill_s1', 'projectile_enemy_vofwiz', 'projectile_enemy_liiprr', 'projectile_enemy_liiprr_2', 'projectile_enemy_telex', 'projectile_enemy_stmgun', 'projectile_enemy_stmgun_s', 'projectile_enemy_nhtank', 'projectile_enemy_nhtank_polluted', 'projectile_enemy_nhnrs', 'projectile_enemy_nhnrs_skill', 'projectile_enemy_hlegle', 'projectile_enemy_bbrain_left', 'projectile_enemy_bbrain_right', 'projectile_enemy_bbrain_up', 'projectile_enemy_bbrain_down', 'projectile_enemy_lydrty', 'projectile_enemy_lydrty_2', 'projectile_enemy_lybgpa', 'projectile_enemy_lyengs', 'projectile_enemy_lyengs_charge', 'projectile_enemy_magic_ball', 'projectile_enemy_lyacpa', 'projectile_enemy_ncrmcr', 'projectile_enemy_ncrmcr_2', 'projectile_enemy_ncrmcr_3', 'projectile_enemy_duflm', 'projectile_enemy_duflm_2', 'projectile_enemy_dubmb', 'projectile_enemy_dubmb_2', 'projectile_enemy_skzgds', 'projectile_enemy_krgscr', 'projectile_enemy_krgscr _s1', 'projectile_enemy_ltgtld', 'projectile_enemy_ltswar', 'projectile_enemy_ltmage', 'projectile_enemy_ltsmag', 'projectile_enemy_ltsmag_forward', 'projectile_enemy_ltsmag_backward', 'projectile_enemy_ltbow', 'projectile_enemy_merrpg', 'projectile_enemy_harchn_attack', 'projectile_enemy_harchn_dead', 'projectile_mousek', 'projectile_mousek_s1', 'projectile_mousek_s2', 'projectile_enemy_sfpin', 'projectile_enemy_sfpin_ex', 'projectile_bombd', 'projectile_bombd_2', 'projectile_iced', 'projectile_mortar', 'projectile_sagent_s1', 'projectile_enemy_sfhu', 'projectile_enemy_sfhu_boom', 'projectile_enemy_byokai', 'projectile_enemy_tyokai', 'projectile_enemy_tyokai_2', 'projectile_enemy_dekght', 'projectile_enemy_dekght_s', 'projectile_enemy_axetro', 'projectile_enemy_emppnt', 'projectile_lslime', 'projectile_enemy_snow_magic_ball', 'projectile_enemy_nhpbr_polluted', 'projectile_gansho', 'projectile_enemy_mtrsnp', 'projectile_enemy_mtrsnp_headshot', 'projectile_enemy_mtrmgc', 'projectile_enemy_mtrmgc_headshot', 'projectile_enemy_cansld', 'projectile_enemy_ptrarc', 'projectile_enemy_mtrbty', 'projectile_enemy_rescar', 'projectile_enemy_ltsmer', 'projectile_enemy_ltsmer_charge', 'projectile_enemy_ltlntc', 'projectile_enemy_ltlntc_2', 'projectile_enemy_mdsnpr'): continue
    text = canonical(exact(d))
    projectiles.setdefault(name, []).append({'pathId': str(o.path_id), 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'originalJson': text})
# Shared projectile selectors can reference a range component or asset.
# Keep each selected range once beside its controller instead of copying its
# cells into each enemy's feature definition.
for rows in projectiles.values():
    seen = {r['pathId'] for r in rows}
    cursor = 0
    while cursor < len(rows):
        data = json.loads(rows[cursor]['originalJson']); cursor += 1
        for field in ['_rangeToLoad', '_selector', '_targetValidator']:
            ref = data.get(field)
            if not ref or ref['m_FileID'] != 0 or ref['m_PathID'] == '0' or ref['m_PathID'] in seen: continue
            value = exact(by[int(ref['m_PathID'])].read_typetree())
            text = canonical(value); seen.add(ref['m_PathID'])
            rows.append({'pathId': ref['m_PathID'], 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'originalJson': text})
            go_ref = value.get('m_GameObject')
            if not go_ref or go_ref['m_FileID'] != 0 or go_ref['m_PathID'] == '0': continue
            go = by[int(go_ref['m_PathID'])].read_typetree()
            for sibling in go['m_Component']:
                obj = by[sibling['component']['m_PathID']]
                if str(obj.path_id) in seen or obj.type.name not in ('MonoBehaviour', 'Transform', 'BoxCollider2D', 'CircleCollider2D'): continue
                seen.add(str(obj.path_id)); text = canonical(exact(obj.read_typetree()))
                rows.append({'pathId': str(obj.path_id), 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'originalJson': text})
def unique_components(rows):
    # A referenced component may also be selected directly later in the scan.
    # Retain its bytes once and prefer the indexed (non-reference) receipt.
    unique = {}
    for row in rows:
        previous = unique.get(row['pathId'])
        if previous:
            assert previous['originalJson'] == row['originalJson']
        if not previous or previous.get('referenced'):
            unique[row['pathId']] = row
    return sorted(unique.values(), key=lambda r: int(r['pathId']))


range_source = {'repository': 'Kengxxiao/ArknightsGameData', 'commit': source['source']['commit'],
                'path': 'zh_CN/gamedata/excel/range_table.json',
                'gitBlob': '8ade26d87026ee7649ff8a2d1636e7c3426959c8',
                'sha256': '4d974598394630a1ad465b954321254397f514c7fb26cba944d320ac18b874d0'}
range_raw = (ROOT / '.cache/arkpedia' / f"range_table_cn-{range_source['commit']}.json").read_bytes()
assert hashlib.sha256(range_raw).hexdigest() == range_source['sha256']
assert hashlib.sha1(f'blob {len(range_raw)}\0'.encode() + range_raw).hexdigest() == range_source['gitBlob']
ranges = json.loads(range_raw)

buff_raw = (C / 'tables/buff_table.json').read_bytes()
assert len(buff_raw) == 176162 and hashlib.sha1(f'blob {len(buff_raw)}\0'.encode() + buff_raw).hexdigest() == 'b588d86b514d61c0025c0d9534f2a4e548aae302'
buff_source = {'repository': 'Kengxxiao/ArknightsGameData', 'commit': source['source']['commit'], 'path': 'zh_CN/gamedata/buff_table.json', 'gitBlob': 'b588d86b514d61c0025c0d9534f2a4e548aae302', 'sha256': hashlib.sha256(buff_raw).hexdigest()}
buff_table = json.loads(buff_raw)
result = {'schemaVersion': 1,
    'scope': 'Original serialized content of the enemy ability components reviewed enemy features read. Each indexed originalJson hashes to the originalDataSha256 the native timing index records for that component; referenced components carry their own sha256 from the same verified bundles.',
    'source': {'nativeTimingIndex': 'data/arkpedia-enemy-clock-source.json',
               'sha256': hashlib.sha256(index_raw).hexdigest(), 'templates': template_pin, 'projectiles': projectile_source,
               'ranges': range_source, 'buffDatabase': buff_source},
    'objects': OBJECTS,
    'scopedObjects': SCOPED_OBJECTS,
    'automaticAuxiliaryCandidates': {path: sorted(ids) for path, ids in sorted(automatic_auxiliaries.items())},
    'prefabs': {k: unique_components(v) for k, v in sorted(components.items())},
    'templates': dict(sorted(templates.items())),
    'ranges': {key: ranges[key] for key in ['x-5', 'x-4', '0-1']},
    'buffDatabase': {key: buff_table[key] for key in ['enemy_confinement', 'enemy_confinement_final', 'disarmed_and_cant_use_skill', 'status_resistance[inf]', 'damage_resistance[inf]', 'fear']},
    'projectiles': {k: sorted(v, key=lambda r: int(r['pathId'])) for k, v in sorted(projectiles.items())}}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    if OUT.read_text() != text: sys.exit('Enemy native ability evidence is stale')
    print('Enemy native ability evidence matches the pinned bundles')
else:
    OUT.write_text(text)
    print('Wrote', sum(len(v) for v in result['prefabs'].values()), 'components from', len(components), 'prefabs')
