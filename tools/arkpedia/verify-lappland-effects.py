#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check the pinned Lappland effect export against original bytes."""
import argparse
from pathlib import Path
from native_effect_verify import verify as verify_inputs

ROOT = Path(__file__).resolve().parents[2]
SPEC = {"operator": "char_1038_whitw2", "bundle": "battle/prefabs/effects/whitw2.ab",
        "local_bundle": "lappland-alter-source/whitw2-effects.ab", "root_prefix": "whitw2_",
        "roots": 35, "meshes": 20, "textures": 90, "unresolved": 9}


def verify(cache, directory, manifest):
    return verify_inputs(cache, directory, manifest, SPEC)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    parser.add_argument('--directory', type=Path, default=ROOT / '.cache/arkpedia/lappland-alter-source/effects')
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/arkpedia-lappland-effects.json')
    args = parser.parse_args()
    verify(args.cache, args.directory, args.manifest)
