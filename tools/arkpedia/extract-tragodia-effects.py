#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover every original Tragodia effect input without claiming renderer support."""
import argparse
from pathlib import Path
from native_effect_source import export

ROOT = Path(__file__).resolve().parents[2]
SPEC = {"operator": "char_1042_phatm2", "bundle": "battle/prefabs/effects/phatm2.ab",
        "source_directory": "tragodia-source", "local_bundle": "tragodia-source/phatm2-effects.ab",
        "root_prefix": "phatm2_", "roots": 33,
        "core": ["phatm2_skill_03_prison_01", "phatm2_skill_02_buff_01", "phatm2_skill_03_buff_01"]}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    parser.add_argument('--out', type=Path, default=ROOT / '.cache/arkpedia/tragodia-source/effects')
    parser.add_argument('--manifest-out', type=Path)
    args = parser.parse_args()
    export(args.cache, args.out, SPEC, args.manifest_out)
