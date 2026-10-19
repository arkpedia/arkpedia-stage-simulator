#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover all original Aphrissa effect shader programs without enabling rendering."""
from native_effect_shader_source import extract as recover

SPEC = {'counts': {'programs': 12, 'shaders': 7},
 'exporter': 'tools/arkpedia/extract-aphrissa-effect-shaders.py',
 'manifest': 'data/arkpedia-aphrissa-effect-shaders.json',
 'operator': 'char_4229_aphris',
 'source_directory': 'aphrissa-source',
 'shader_bundle': 'cn-native-source/bundles/[uc]shaders.ab',
 'source_manifest': 'data/arkpedia-aphrissa-effects.json'}


def extract():
    return recover(SPEC)


if __name__ == '__main__':
    extract()
