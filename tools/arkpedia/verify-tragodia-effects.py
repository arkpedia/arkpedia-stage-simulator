#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check original Tragodia effect pixels, geometry and closure."""
import argparse
from pathlib import Path
from native_effect_verify import verify

ROOT = Path(__file__).resolve().parents[2]
SPEC = {"operator": "char_1042_phatm2", "bundle": "battle/prefabs/effects/phatm2.ab",
        "local_bundle": "tragodia-source/phatm2-effects.ab", "root_prefix": "phatm2_",
        "roots": 33, "meshes": 32, "textures": 72, "unresolved": 4}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    parser.add_argument('--directory', type=Path, default=ROOT / '.cache/arkpedia/tragodia-source/effects')
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/arkpedia-tragodia-effects.json')
    args = parser.parse_args()
    verify(args.cache, args.directory, args.manifest, SPEC)
