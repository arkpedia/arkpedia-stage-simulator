#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the held CN export and independently reject semantic corruption."""
from native_effect_audit import audit
if __name__ == '__main__':
    audit('aphrissa', 'aphrissa-source', 'char_4229_aphris', 'aphris_skill_03_charge_01',
          omitted_dependency_root='token_aphris_pc_skill_03_buff_01')
