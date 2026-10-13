#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover pinned Lappland effect inputs; source export is not rendering approval."""
import argparse
from pathlib import Path
from native_effect_source import export as export_inputs

ROOT = Path(__file__).resolve().parents[2]
SPEC = {"operator": "char_1038_whitw2", "bundle": "battle/prefabs/effects/whitw2.ab",
        "source_directory": "lappland-alter-source", "local_bundle": "lappland-alter-source/whitw2-effects.ab",
        "root_prefix": "whitw2_", "roots": 35,
        "core": ["whitw2_token_01", "whitw2_token_02", "whitw2_token_03", "whitw2_skill_03_token_trail_01"]}


def export(cache, out, manifest_out=None):
    return export_inputs(cache, out, SPEC, manifest_out)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    parser.add_argument('--out', type=Path, default=ROOT / '.cache/arkpedia/lappland-alter-source/effects')
    parser.add_argument('--manifest-out', type=Path)
    args = parser.parse_args()
    export(args.cache, args.out, args.manifest_out)
