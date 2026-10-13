#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently audit all original Lappland shader bytes and player links."""
import importlib.util
from pathlib import Path
from native_effect_shader_verify import audit

path = Path(__file__).with_name('extract-lappland-effect-shaders.py')
spec = importlib.util.spec_from_file_location('shader_spec', path)
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

if __name__ == '__main__':
    audit(source.SPEC)
