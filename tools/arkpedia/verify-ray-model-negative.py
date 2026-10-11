#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reject independently modified Sandbeast art; only writes disposable cache."""
import hashlib,json,shutil,subprocess,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/arkpedia/ray-source/sandbeast-art'
NEG=ROOT/'.cache/arkpedia/ray-source/sandbeast-negative'
ID='token_10034_ray_sndbst'
VERIFY=ROOT/'tools/arkpedia/verify-ray-model.py'
subprocess.check_call([sys.executable,str(VERIFY),'--delivered'],cwd=ROOT)
for case in ['pixel','atlas-region','native-facing']:
 d=NEG/case
 d.mkdir(parents=True,exist_ok=True)
 shutil.copytree(OUT/'original',d/'original',dirs_exist_ok=True)
 m=json.loads((OUT/'sources.json').read_text());record=m['models'][ID]
 if case=='pixel':
  path=d/'original'/(ID+'.png');img=Image.open(path).convert('RGBA')
  original=img.getpixel((0,0));img.putpixel((0,0),((original[0]+1)%256,*original[1:]));img.save(path)
 elif case=='atlas-region':
  path=d/'original'/(ID+'.atlas');s=path.read_text()
  # Even structurally valid/checksummed art must preserve the native regions.
  s=s.replace('rotate: false','rotate: true',1);assert s!=path.read_text();path.write_text(s)
 else:
  record['originalPathIds']['faceSwitcherPathId']='0'
 if case!='native-facing':
  raw=path.read_bytes();record['files'][path.name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 metadata=d/'sources.json';metadata.write_text(json.dumps(m,indent=2)+'\n')
 p=subprocess.run([sys.executable,str(VERIFY),'--metadata',str(metadata)],cwd=ROOT,capture_output=True,text=True)
 if p.returncode==0:raise AssertionError(f'Altered {case} unexpectedly accepted')
 print('Rejected altered',case)
print('All three altered original-art records rejected')
