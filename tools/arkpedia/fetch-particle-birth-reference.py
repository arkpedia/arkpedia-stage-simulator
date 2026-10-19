#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Cache checked reference-only gradient/renderer evidence; no runtime code copy."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PIN = 'b052b1fe38b45d5aefa609a115c626ed2e74f3a6'
FILES = {'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs','Runtime/Export/Math/Gradient.bindings.cs'}
URLS = {'https://docs.unity3d.com/2021.3/Documentation/ScriptReference/GradientMode.html',
        'https://docs.unity3d.com/2021.3/Documentation/Manual/PartSysRendererModule.html'}


def fetch(cache):
    ref = json.loads((ROOT / 'data/arkpedia-aphrissa-birth-controls.json').read_bytes())['reference']
    assert ref['repository'] == 'Unity-Technologies/UnityCsReference' and ref['commit'] == PIN
    assert len(ref['files']) == 2 and {e['path'] for e in ref['files']} == FILES
    assert len(ref['documents']) == 2 and {e['url'] for e in ref['documents']} == URLS
    directory = cache / 'unity-builtin-source/particle-birth-reference';directory.mkdir(parents=True,exist_ok=True)
    for entry in ref['files']+ref['documents']:
        name = Path(entry.get('path',entry.get('url'))).name;target = directory / name
        def check(raw):
            if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
                raise ValueError('Changed particle birth reference: '+name)
        if target.exists(): check(target.read_bytes());continue
        existing = cache / 'unity-builtin-source/mesh-alignment-reference' / name
        if existing.exists():
            raw = existing.read_bytes();check(raw);target.write_bytes(raw);continue
        url = entry.get('url','https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/'+PIN+'/'+entry.get('path',''))
        with tempfile.TemporaryDirectory() as tmp:
            body = Path(tmp) / 'body'
            subprocess.run(['curl','--fail','--silent','--show-error','--max-time','60','--max-filesize',str(entry['bytes']),url,'--output',str(body)],check=True)
            raw = body.read_bytes();check(raw);target.write_bytes(raw)
    print(json.dumps({'referenceFiles':4,'commit':PIN,'nativeFrameParity':False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser();parser.add_argument('--cache',type=Path,default=ROOT / '.cache/arkpedia')
    fetch(parser.parse_args().cache)
