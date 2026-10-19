#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Cache pinned reference-only Unity enum/editor evidence; never copy it into runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PIN = 'b052b1fe38b45d5aefa609a115c626ed2e74f3a6'
FILES = {'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs',
         'Modules/ParticleSystemEditor/ParticleSystemModules/RendererModuleUI.cs'}


def fetch(cache):
    reference = json.loads((ROOT / 'data/arkpedia-aphrissa-mesh-alignment.json').read_bytes())['reference']
    if reference['repository'] != 'Unity-Technologies/UnityCsReference' or reference['commit'] != PIN:
        raise ValueError('Changed Unity reference revision')
    if len(reference['files']) != 2 or {r['path'] for r in reference['files']} != FILES:
        raise ValueError('Changed Unity reference file inventory')
    directory = cache / 'unity-builtin-source/mesh-alignment-reference'
    directory.mkdir(parents=True, exist_ok=True)
    for entry in reference['files']:
        target = directory / Path(entry['path']).name
        def check(raw):
            if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
                raise ValueError('Changed pinned Unity reference bytes: ' + entry['path'])
        if target.exists():
            check(target.read_bytes())
            continue
        url = 'https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/' + PIN + '/' + entry['path']
        with tempfile.TemporaryDirectory() as tmp:
            body = Path(tmp) / 'body'
            subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '60',
                            '--max-filesize', str(entry['bytes']), url, '--output', str(body)], check=True)
            raw = body.read_bytes();check(raw);target.write_bytes(raw)
    print(json.dumps({'referenceFiles': 2, 'commit': PIN, 'nativeFrameParity': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    fetch(parser.parse_args().cache)
