#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover all original Tragodia effect shader programs without enabling rendering."""
from native_effect_shader_source import extract as recover

SPEC = {'counts': {'programs': 22, 'shaders': 8},
 'exporter': 'tools/arkpedia/extract-tragodia-effect-shaders.py',
 'manifest': 'data/arkpedia-tragodia-effect-shaders.json',
 'operator': 'char_1042_phatm2',
 'source_directory': 'tragodia-source',
 'source_manifest': 'data/arkpedia-tragodia-effects.json'}


def extract():
    return recover(SPEC)


if __name__ == '__main__':
    extract()
