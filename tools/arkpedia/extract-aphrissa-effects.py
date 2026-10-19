#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover original pinned CN effect inputs; no public/runtime rendering approval."""
import argparse
from pathlib import Path
from native_effect_source import export as export_inputs
ROOT = Path(__file__).resolve().parents[2]
SPEC = {'operator': 'char_4229_aphris', 'version': '26-09-22-07-47-20_6c71fa',
        'manifest': 'cn-native-source/hot_update_list.json',
        'manifest_sha256': 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35',
        'bundle': 'battle/prefabs/effects/aphris.ab', 'source_directory': 'aphrissa-source',
        'local_bundle': 'cn-native-source/bundles/battle/prefabs/effects/aphris.ab',
        'dependencies_directory': 'cn-native-source/bundles/', 'root_prefix': ('aphris_', 'token_aphris_', 'common_char_'),
        'source_count': 26, 'extra_dependencies': ['refs/fx/texture/overseas/char_010_chen_sale#10.ab'],
        'additional_roots': {'pkgrps/btl_pfb_fx_token_3.ab': ['token_aphris_pc_attack_01_buff_01',
                             'token_aphris_pc_skill_02_buff_01', 'token_aphris_pc_skill_03_buff_01'],
                             'battle/prefabs/effects/common.ab': ['common_char_birth_01_delay_01']},
        'roots': 22, 'core': ['aphris_attack_01_line_01', 'aphris_skill_02_line_01',
                            'aphris_skill_03_charge_01', 'aphris_skill_03_charge_01_end']}
def export(cache, out, manifest_out=None):
    return export_inputs(cache, out, SPEC, manifest_out)
if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    p.add_argument('--out', type=Path, default=ROOT / '.cache/arkpedia/aphrissa-source/effects')
    p.add_argument('--manifest-out', type=Path)
    args = p.parse_args()
    export(args.cache, args.out, args.manifest_out)
