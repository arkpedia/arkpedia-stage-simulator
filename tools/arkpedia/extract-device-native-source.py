#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain reviewed manual-device prefabs from the checksum-pinned shared bundles."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

pin = json.loads((ROOT / 'data/arkpedia-cn-native-source.json').read_bytes())
rows = {r['path']: r for r in pin['bundles']}
# The tile bundle was independently retained by the permanent-water review.
# Keep its exact source checksum instead of trusting an unpinned local bundle.
rows['battle/prefabs/[uc]tiles.ab'] = {
    'path': 'battle/prefabs/[uc]tiles.ab', 'bytes': 59712,
    'sha256': '5a913749bb207f004ac0d5f6050dc5b751e3abceb3bf834aea21ff663ff615f0'}
def exact(value, key=''):
    if isinstance(value, dict): return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list): return [exact(v, key) for v in value]
    if isinstance(value, float) and value.is_integer(): return int(value)
    return str(value) if key == 'm_PathID' else value
def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

prefabs, bundles = {}, []
for path, group, keys in [
    ('pkgrps/btl_pfb_tokens_0.ab', 'tokens', ['trap_087_allady', 'trap_021_flame', 'trap_025_prison', 'trap_086_larva', 'trap_075_bgarmn', 'trap_076_bgarms', 'trap_077_rmtarmn', 'trap_078_rmtarms', 'trap_050_blizzard', 'trap_002_emp', 'trap_005_sensor', 'trap_008_farm', 'trap_057_wpnsts', 'trap_018_bomb', 'trap_019_electric', 'trap_007_ballis', 'trap_013_blower', 'trap_014_tower', 'trap_009_battery', 'trap_006_antidr', 'trap_043_dupilr', 'trap_044_duruin', 'trap_045_dublst', 'trap_001_crate', 'trap_015_tree', 'trap_016_peon', 'trap_017_wooden_broke', 'trap_012_mine', 'trap_011_ore', 'trap_062_magicstart', 'trap_063_magicturn', 'trap_064_magiccircle', 'trap_024_npcsld']),
    ('pkgrps/btl_pfb_tokens_1.ab', 'tokens', ['trap_156_dsshell', 'trap_161_lrcage', 'trap_098_mire', 'trap_125_bonore']),
    ('pkgrps/btl_pfb_tokens_3.ab', 'tokens', ['trap_757_skzbox', 'trap_758_skzmbx', 'trap_759_skzwyx', 'trap_760_skztzs']),
    ('battle/prefabs/[uc]skills.ab', 'skills', ['sktok_allady', 'sktok_allady_2', 'sktok_flame', 'sktok_prison', 'sktok_dsshell', 'sktok_larva', 'sktok_bgarmn_1', 'sktok_bgarms_1', 'sktok_rmtarmn_1', 'sktok_rmtarms_1', 'sktok_blizzard', 'sktok_blizzard_2', 'sktok_emp', 'sktok_sensor', 'sktok_farm', 'sktok_wpnsts_1', 'sktok_wpnsts_2', 'sktok_bomb', 'sktok_electric', 'sktok_ballis', 'sktok_blower', 'sktok_tower', 'sktok_antidr', 'sktok_dupilr', 'sktok_dublst', 'sktok_tree', 'sktok_mine', 'sktok_ore', 'sktok_magiccircle', 'sktok_skzmbx', 'sktok_mire', 'sktok_npcsld', 'sktok_bonore']),
    ('battle/prefabs/[uc]tiles.ab', 'tiles', ['tile_mire', 'tile_reed', 'tile_reedf', 'tile_reedw']),
    ('battle/prefabs/[uc]projectiles.ab', 'projectiles', ['projectile_trap_allady', 'projectile_flame', 'projectile_chr_electric_shock', 'projectile_chr_electric_shock_effect', 'projectile_ballis', 'projectile_chr_tower_1', 'projectile_chr_tower_2', 'projectile_trap_bonore']),
]:
    raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
    row = rows[path]
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256']
    bundles.append(row)
    env = UnityPy.load(raw)
    by = {o.path_id: o for o in env.objects}
    for key in keys:
        components = []
        def walk(go):
            data = go.read_typetree()
            for ref in data['m_Component']:
                obj = by[ref['component']['m_PathID']]
                value = obj.read_typetree()
                if obj.type.name == 'MonoBehaviour' or (group == 'projectiles' or key in ('trap_012_mine', 'sktok_mine', 'trap_086_larva', 'sktok_larva')) and obj.type.name in ('BoxCollider2D', 'CircleCollider2D'):
                    value = exact(value)
                    components.append({'pathId': str(obj.path_id), 'object': data['m_Name'], 'data': value, 'sha256': digest(value)})
                elif obj.type.name == 'Transform':
                    if group == 'projectiles' or key in ('trap_012_mine', 'sktok_mine', 'trap_086_larva', 'sktok_larva'):
                        retained = exact(value)
                        components.append({'pathId': str(obj.path_id), 'object': data['m_Name'], 'data': retained, 'sha256': digest(retained)})
                    for child in value['m_Children']:
                        walk(by[by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID']])
        asset = f'dyn/battle/prefabs/[uc]{group}/{key}.prefab'
        walk(env.container[asset])
        prefabs[key] = {'bundle': path, 'asset': asset, 'components': components}
# Consumers verify sorted JSON with JSON.stringify. Python spells small
# exponents differently (e-08 vs e-8), so hash with the same numeric serializer.
# Path IDs have already been converted to strings by exact(), preserving int64.
hashes = subprocess.run(['node', '--input-type=module', '-e', '''
import {createHash} from 'node:crypto';
let input='';for await(const chunk of process.stdin)input+=chunk;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
process.stdout.write(JSON.stringify(JSON.parse(input).map(v=>
 createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex'))));
'''], input=json.dumps([c['data'] for p in prefabs.values() for c in p['components']]),
    capture_output=True, text=True, check=True)
for component, sha256 in zip((c for p in prefabs.values() for c in p['components']), json.loads(hashes.stdout), strict=True):
    component['sha256'] = sha256

raw = (ROOT / '.cache/arkpedia/cn-native-source/tables/buff_template_data.json').read_bytes()
blob = hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
assert len(raw) == 27996217 and blob == 'a94bbb391fded80e59db38ad7c3ded89e25fd682'
table = json.loads(raw)
out = {'schemaVersion': 1, 'source': {k: pin['source'][k] for k in ['repository', 'commit', 'clientVersion', 'resourceVersion']},
       'bundles': bundles, 'prefabs': prefabs,
       'templateSource': {'repository': pin['source']['repository'], 'commit': pin['source']['commit'],
                          'path': 'zh_CN/gamedata/battle/buff_template_data.json', 'gitBlob': blob, 'sha256': hashlib.sha256(raw).hexdigest()},
       'templates': {key: table[key] for key in ['farm_t_1', 'farm_s_1', 'switch_mode_restart_fsm', 'wpnsts_change_side', 'switch_side_when_start', 'modify_sp[trigger]', 'wpnsts_log_born', 'immu_environment_damage', 'switch_mode_no_restore', 'bomb_s', 'suicide', 'switch_mode_when_trigger', 'log_born[filter_player_side]', 'electric[attack]', 'electric_s[activate]', 'electric_s', 'blower_s_character[equal]', 'blower_s_character[opposite]', 'blower_s_character[vertical]', 'blower_s_enemy[equal]', 'blower_s_enemy[opposite]', 'blower_s_enemy[vertical]', 'tower_t_1[charge]', 'tower_t_2[max_sp]', 'tower_t_3[min_sp]', 'tower_t_4[attack]', 'tower_t_5[heal]', 'instant_heal[hp_ratio]']}}
def template_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ('templateKey', '_templateKey') and isinstance(child, str) and child in table:
                yield child
            elif key == 'SerializedState' and isinstance(child, str):
                yield from template_keys(json.loads(child))
            else:
                yield from template_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from template_keys(child)

# A new device retains its referenced templates once, including nested buffs.
# This avoids a second hand-maintained list for every atomic device addition.
todo = set(template_keys(prefabs)) | set(out['templates'])
retained = {}
while todo:
    key = min(todo)
    todo.remove(key)
    if key in retained:
        continue
    retained[key] = table[key]
    todo.update(template_keys(table[key]))
out['templates'] = dict(sorted(retained.items()))

status = (ROOT / '.cache/arkpedia/cn-native-source/status-enums-dump.cs').read_bytes()
assert hashlib.sha256(status).hexdigest() == '0cd60676fa4f3f47bcc5d1b9e3296a28d96d537974956b841050bdc515b2fdb4'
out['statusSource'] = {'repository': 'Tim23333/Arknights_timer', 'commit': '2e5c4306e4949fb6b15f990e34a9c69053be3327', 'path': 'game_data/reference/android_arm64/dump.cs', 'sha256': hashlib.sha256(status).hexdigest(), 'limit': 'Numeric definitions only; reference has no client version, so not frame-parity evidence.'}
out['statusDefinitions'] = {k: int(v) for k, v in re.findall(r'public const (?:AbnormalFlag|AbnormalCombo|AttributeType) ([A-Z_]+) = (\d+);', status.decode()) if k in ['UNBALANCE_IMMUNE', 'ELEMENT_FREE_ALL', 'HEAL_FREE', 'ALLY_TARGET_FREE', 'STUNNED', 'FROZEN', 'SILENCED', 'COLD', 'DISARMED', 'SLEEPING', 'DISABLE_COMBAT', 'SHELTERING', 'TAUNT_LEVEL']}
encoded = json.dumps(out, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/arkpedia-device-native-source.json'
if '--check' in sys.argv:
    assert target.read_text() == encoded, 'Manual device native evidence changed'
else:
    target.write_text(encoded)
print(f'Verified {len(prefabs)} manual device/skill prefabs')
