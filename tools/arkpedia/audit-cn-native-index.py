#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the native root index and reject changed pointer/approval claims."""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/arkpedia-cn-native-index.json'
CACHE = ROOT / '.cache/arkpedia/cn-native-source/index-audits'
CACHE.mkdir(parents=True, exist_ok=True)
before = OUT.read_bytes()
subprocess.run([sys.executable, str(ROOT / 'tools/arkpedia/index-cn-native.py')], cwd=ROOT, check=True, capture_output=True)
assert OUT.read_bytes() == before, 'Original root index does not reproduce'
verifier = ROOT / 'tools/arkpedia/verify-cn-native-index.py'
subprocess.run([sys.executable, str(verifier)], cwd=ROOT, check=True, capture_output=True)
source = json.loads(before)


def mutate(name, fn):
    copy = json.loads(before)
    fn(copy)
    file = CACHE / (name + '.json')
    file.write_text(json.dumps(copy, ensure_ascii=False))
    result = subprocess.run([sys.executable, str(verifier), '--index', str(file)], cwd=ROOT, capture_output=True)
    assert result.returncode > 0, 'Verifier accepted changed root evidence: ' + name
    print('Rejected ' + name, flush=True)


mutate('foreign-source-receipt', lambda x: x['source'].__setitem__('receiptSha256', '0' * 64))
mutate('missing-operator', lambda x: x['operators'].pop('char_4051_akkord'))
mutate('changed-owner-pointer', lambda x: x['operators']['char_4051_akkord']['owner'].__setitem__('pathId', '1'))
mutate('numeric-instead-of-64bit-string', lambda x: x['operators']['char_4051_akkord']['owner']['components'][0].__setitem__(
    'pathId', int(x['operators']['char_4051_akkord']['owner']['components'][0]['pathId'])))
mutate('changed-native-component-order', lambda x: x['operators']['char_4051_akkord']['owner']['components'].reverse())
mutate('swapped-owner-and-default-art', lambda x: x['operators']['char_4051_akkord'].__setitem__(
    'defaultArtwork', x['operators']['char_4051_akkord']['owner']))
mutate('missing-skill-root', lambda x: x['operators']['char_4051_akkord']['skills'][0].__setitem__('bindings', []))
mutate('invented-passive-fallback', lambda x: x['operators']['char_4237_jcinta']['skills'][0].__setitem__('prefabId', 'empty'))
mutate('premature-kit-approval', lambda x: x.__setitem__('enabledOperators', ['char_4051_akkord']))
mutate('premature-graph-closure', lambda x: x.__setitem__('graphClosureVerified', True))
mutate('premature-animation-bindings', lambda x: x.__setitem__('animationBindingsVerified', True))
mutate('premature-frame-parity', lambda x: x.__setitem__('frameParity', True))
print('Reproduced the original root index and rejected 12 changed-pointer/approval fixtures')
