#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify all held CN clip inputs and bindings against original native bytes."""
import importlib.util
import gzip
import json
from pathlib import Path
from native_effect_animation_verify import verify as verify_inputs, UnityPy
from native_effect_verify import digest

ROOT = Path(__file__).resolve().parents[2]
SPEC = {'operator': 'char_4229_aphris', 'source_directory': 'aphrissa-source',
        'fixture_path': 'test/fixtures/arkpedia-aphrissa-effect-clips.json',
        'counts': {'clips': 14, 'instances': 21, 'bindings': 568, 'channels': 584, 'keys': 537},
        'unbound_ambiguous_paths': 1}
DIRECTORY = ROOT / '.cache/arkpedia/aphrissa-source/effects'
MANIFEST = ROOT / 'data/arkpedia-aphrissa-effect-animations.json'


def native_clips():
    module = importlib.util.spec_from_file_location('aphrissa_effects_verify', ROOT / 'tools/arkpedia/verify-aphrissa-effects.py')
    verifier = importlib.util.module_from_spec(module)
    module.loader.exec_module(verifier)
    verifier.verify(ROOT / '.cache/arkpedia', DIRECTORY, ROOT / 'data/arkpedia-aphrissa-effects.json')
    meta = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
    pack = json.loads(gzip.decompress((DIRECTORY / 'native-effects.bin').read_bytes()))
    originals = {}
    for name in ['battle/prefabs/effects/aphris.ab', 'refs/fx/sharedbattle.ab']:
        source = next(r for r in meta['sources'] if r['path'] == name)
        raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / name).read_bytes()
        assert len(raw) == source['bytes'] and digest(raw) == source['sha256']
        for obj in UnityPy.load(raw).objects:
            if obj.type.name == 'AnimationClip':
                key = name + ':' + str(obj.path_id)
                if key in pack['records']:
                    originals[key] = obj
    assert len(originals) == 14
    return originals


def verify(originals, directory=DIRECTORY, manifest=MANIFEST):
    return verify_inputs(originals, directory, manifest, SPEC)


if __name__ == '__main__':
    print(json.dumps(verify(native_clips())))
