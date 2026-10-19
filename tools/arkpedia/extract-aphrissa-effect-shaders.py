#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover all original Aphrissa effect shader programs without enabling rendering."""
from native_effect_shader_source import extract as recover

SPEC = {'counts': {'programs': 14, 'shaders': 8},
 'exporter': 'tools/arkpedia/extract-aphrissa-effect-shaders.py',
 'manifest': 'data/arkpedia-aphrissa-effect-shaders.json',
 'operator': 'char_4229_aphris',
 'source_directory': 'aphrissa-source',
 'shader_bundle': 'cn-native-source/bundles/[uc]shaders.ab',
 'additional_shader_bundles': {'anon/a90f86ed9fd93b2c2af4fd0571371829.bin':
     'cn-native-source/bundles/anon/a90f86ed9fd93b2c2af4fd0571371829.bin'},
 'source_manifest': 'data/arkpedia-aphrissa-effects.json'}


def extract():
    return recover(SPEC)


if __name__ == '__main__':
    extract()
