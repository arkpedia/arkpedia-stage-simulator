#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover all original Lappland effect shader programs without enabling rendering."""
from native_effect_shader_source import extract as recover

SPEC = {'counts': {'programs': 23, 'shaders': 12},
 'exporter': 'tools/arkpedia/extract-lappland-effect-shaders.py',
 'manifest': 'data/arkpedia-lappland-effect-shaders.json',
 'operator': 'char_1038_whitw2',
 'source_directory': 'lappland-alter-source',
 'source_manifest': 'data/arkpedia-lappland-effects.json'}


def extract():
    return recover(SPEC)


if __name__ == '__main__':
    extract()
