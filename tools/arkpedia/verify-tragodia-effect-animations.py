#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently verify original Tragodia effect channels and bindings."""
import argparse
import json
from pathlib import Path
from native_effect_animation_verify import native_clips as read_native, verify as verify_inputs

ROOT = Path(__file__).resolve().parents[2]
SPEC = {'operator': 'char_1042_phatm2',
 'source_directory': 'tragodia-source',
 'source_manifest': 'data/arkpedia-tragodia-effects.json',
 'source_bundle': 'battle/prefabs/effects/phatm2.ab',
 'local_bundle': 'tragodia-source/phatm2-effects.ab',
 'fixture_path': 'test/fixtures/arkpedia-tragodia-effect-clips.json',
 'counts': {'clips': 9, 'instances': 9, 'bindings': 476, 'channels': 476, 'keys': 238},
 'unresolved_bindings': 8,
 'material_slot_bindings': 28,
 'effects': {'operator': 'char_1042_phatm2',
             'bundle': 'battle/prefabs/effects/phatm2.ab',
             'local_bundle': 'tragodia-source/phatm2-effects.ab',
             'root_prefix': 'phatm2_',
             'roots': 33,
             'meshes': 32,
             'textures': 72,
             'unresolved': 4}}
DIRECTORY = ROOT / '.cache/arkpedia' / SPEC['source_directory'] / 'effects'
MANIFEST = ROOT / 'data/arkpedia-tragodia-effect-animations.json'


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
