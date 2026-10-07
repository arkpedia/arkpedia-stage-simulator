#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract reviewed original token models from the pinned Global asset bundle.

Run with Python + UnityPy + Pillow (the stage extractor's .cache/map-env works):
  python tools/arkpedia/extract-summons.py --download \
    --avatar-source ../arkpedia-sd-assets/.cache/arknights-resource

The hot-update manifest must already exist. Its resource version, official MD5,
and byte count are verified before extraction. The existing stage extractor
merges RGB with the separately encoded alpha texture and normalizes atlas page
sizes/PMA metadata; the original binary skeleton is copied byte-for-byte.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- registers the client's LZ4 decompressor
import UnityPy
from extract import merge_alpha, normalize_atlas

VERSION = '26-09-23-17-49-43_b9cc4a'
TOKEN_IDS = ['token_10001_deepcl_tentac', 'token_10014_bstalk_crab', 'token_10018_robrta_mach']
AVATAR_COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundle-root', type=Path, default=ROOT / '.cache/arkpedia/map-source/ab')
parser.add_argument('--hot-update-list', type=Path, default=ROOT / '.cache/arkpedia/map-source/hot_update_list.json')
parser.add_argument('--out', type=Path, default=ROOT / '.cache/arkpedia/original-summons')
parser.add_argument('--avatar-source', type=Path, required=True)
parser.add_argument('--download', action='store_true')
parser.add_argument('--ids', help='Explicit original token IDs for a reviewed batch; defaults to the initial three')
args = parser.parse_args()
if args.ids:
    catalogue = json.loads((ROOT / '.cache/arkpedia/character_table.json').read_text())
    TOKEN_IDS = args.ids.split(',')
    if not TOKEN_IDS or any(not token_id.startswith('token_') or token_id not in catalogue
                            or catalogue[token_id]['profession'] != 'TOKEN' for token_id in TOKEN_IDS):
        raise ValueError('Unknown original token source ID')
hot = json.loads(args.hot_update_list.read_text())
if hot.get('versionId') != VERSION:
    raise ValueError('Unexpected source resource version')
bundle_path = 'pkgrps/btl_pfb_tokens_0.ab'
info = next(row for row in hot['abInfos'] if row['name'] == bundle_path)
url = f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat'
bundle = args.bundle_root / bundle_path
if not bundle.exists() and args.download:
    with urllib.request.urlopen(url, timeout=60) as response:
        with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
            raw = archive.read(bundle_path)
    bundle.parent.mkdir(parents=True, exist_ok=True)
    bundle.write_bytes(raw)
raw = bundle.read_bytes()
if len(raw) != info['abSize'] or hashlib.md5(raw).hexdigest() != info['md5']:
    raise ValueError('Original bundle size or official MD5 mismatch')
env = UnityPy.load(raw)
records = {}
for token_id in TOKEN_IDS:
    stem = 'token_10001_deepcl_tentacle' if token_id == 'token_10001_deepcl_tentac' else token_id
    directory = args.out / token_id
    directory.mkdir(parents=True, exist_ok=True)
    texts, textures = {}, {}
    for obj in env.objects:
        if obj.type.name not in ['TextAsset', 'Texture2D']:
            continue
        data = obj.read()
        name = data.m_Name
        if name not in [stem + '.skel', stem + '.atlas', stem, stem + '[alpha]']:
            continue
        if obj.type.name == 'TextAsset':
            texts[name] = data.m_Script.encode('utf8', 'surrogateescape') if isinstance(data.m_Script, str) else bytes(data.m_Script)
        else:
            textures[name] = data.image
    if len(texts) != 2 or stem not in textures or stem + '[alpha]' not in textures:
        raise ValueError('Missing original source skeleton, atlas, RGB or alpha: ' + token_id)
    image = merge_alpha(textures[stem], textures[stem + '[alpha]'])
    image.save(directory / (stem + '.png'))
    texts[stem + '.atlas'] = normalize_atlas(texts[stem + '.atlas'].decode('utf8'), {stem + '.png': image.size}).encode('utf8')
    for name, content in texts.items():
        (directory / name).write_bytes(content)
    # Read the avatar from the pinned commit, never the working tree.
    avatar = subprocess.check_output(['git', '-C', str(args.avatar_source), 'show',
        f'{AVATAR_COMMIT}:avatar/ASSISTANT/{token_id}.png'])
    (directory / 'avatar.png').write_bytes(avatar)
    files = [stem + '.skel', stem + '.atlas', stem + '.png', 'avatar.png']
    records[token_id] = {'directory': str(directory), 'files': {
        name: {'bytes': (directory / name).stat().st_size,
            'sha256': hashlib.sha256((directory / name).read_bytes()).hexdigest()} for name in files},
        'textureDimensions': list(image.size)}
    print('Extracted original ' + token_id)
source = {'path': bundle_path, 'bytes': len(raw), 'md5': info['md5'],
    'sha256': hashlib.sha256(raw).hexdigest(), 'resourceVersion': VERSION, 'url': url,
    'transforms': ['RGB plus separated Alpha texture merge', 'atlas texture dimensions normalized and pma: true recorded']}
metadata = {'sourceBundle': source,
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': AVATAR_COMMIT, 'directory': 'avatar/ASSISTANT'},
    'models': records}
(args.out / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
