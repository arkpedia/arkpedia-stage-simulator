#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the Lappland export and independently reject semantic corruption."""
from native_effect_audit import audit
if __name__ == '__main__':
    audit('lappland', 'lappland-alter-source', 'char_1038_whitw2', 'whitw2_token_02')
