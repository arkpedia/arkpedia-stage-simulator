#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently verify original Lappland effect channels and bindings."""
import argparse
import json
from pathlib import Path
from native_effect_animation_verify import native_clips as read_native, verify as verify_inputs

ROOT = Path(__file__).resolve().parents[2]
SPEC = {'operator': 'char_1038_whitw2',
 'source_directory': 'lappland-alter-source',
 'source_manifest': 'data/arkpedia-lappland-effects.json',
 'source_bundle': 'battle/prefabs/effects/whitw2.ab',
 'local_bundle': 'lappland-alter-source/whitw2-effects.ab',
 'fixture_path': 'test/fixtures/arkpedia-lappland-effect-clips.json',
 'counts': {'clips': 10, 'instances': 17, 'bindings': 337, 'channels': 375, 'keys': 342},
 'unresolved_bindings': 0,
 'effects': {'operator': 'char_1038_whitw2',
             'bundle': 'battle/prefabs/effects/whitw2.ab',
             'local_bundle': 'lappland-alter-source/whitw2-effects.ab',
             'root_prefix': 'whitw2_',
             'roots': 35,
             'meshes': 20,
             'textures': 90,
             'unresolved': 9}}
DIRECTORY = ROOT / '.cache/arkpedia' / SPEC['source_directory'] / 'effects'
MANIFEST = ROOT / 'data/arkpedia-lappland-effect-animations.json'


def native_clips():
    return read_native(SPEC)


def verify(originals, directory=DIRECTORY, manifest=MANIFEST):
    return verify_inputs(originals, directory, manifest, SPEC)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    args = parser.parse_args()
    print(json.dumps(verify(native_clips(), args.directory, args.manifest)))
