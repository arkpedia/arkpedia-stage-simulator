#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify/fetch the exact original anonymous archive; no rendering approval."""
import argparse
import json
from pathlib import Path
from native_anonymous_source import read_anonymous_source
ROOT = Path(__file__).resolve().parents[2]
if __name__ == '__main__':
    p = argparse.ArgumentParser();p.add_argument('--cache', type=Path, default=ROOT/'.cache/arkpedia');args = p.parse_args()
    hot = (args.cache/'cn-native-source/hot_update_list.json').read_bytes()
    print(json.dumps(read_anonymous_source(args.cache, 'data/arkpedia-aphrissa-material-source.json', hot,
          '26-09-22-07-47-20_6c71fa', fetch=True)))
