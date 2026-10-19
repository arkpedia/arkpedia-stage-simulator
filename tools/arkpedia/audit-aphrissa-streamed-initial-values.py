#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compare sparse clip decoding/samples with original native streamed words."""
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from native_effect_source import exact
NODE = os.environ.get('ARKPEDIA_REVIEW_NODE','node')
META = ROOT / 'data/arkpedia-aphrissa-streamed-initial-values.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-aphrissa-streamed-initial-values.json'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def build():subprocess.run([NODE,'tools/arkpedia/export-aphrissa-streamed-initial-values.mjs'],cwd=ROOT,check=True,capture_output=True)
build();before = [sha(p.read_bytes()) for p in [META,FIXTURE]]
meta,fixtures = [json.loads(p.read_bytes()) for p in [META,FIXTURE]]
effects = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
source = next(r for r in effects['sources'] if r['path'] == 'battle/prefabs/effects/aphris.ab')
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / source['path']).read_bytes()
assert sha(raw) == source['sha256'] and len(raw) == source['bytes']
native = UnityPy.load(raw);objects = {o.path_id:o for o in native.objects}
assert meta['sourcePackSha256'] == effects['pack']['sha256'] and meta['rendererVerified'] is False and meta['compiledFrameParity'] is False and meta['enabledOperators'] == []
assert meta['fixture'] == {'path':str(FIXTURE.relative_to(ROOT)),'bytes':FIXTURE.stat().st_size,'sha256':sha(FIXTURE.read_bytes())}
script = """import fs from'node:fs';import{decodeEffectClip,sampleEffectClip}from'./shared/arkpedia/native-effect-animation.js';
const fixtures=JSON.parse(fs.readFileSync('test/fixtures/arkpedia-aphrissa-streamed-initial-values.json')),out={};for(const[k,f]of Object.entries(fixtures)){const d=decodeEffectClip(f.data),times=new Set([d.start-1,d.start,d.stop,d.stop+.125]);for(const c of d.channels){if(c.kind==='streamed'){if(c.keys.length&&c.keys[0].time>d.start)times.add((c.keys[0].time+d.start)/2);for(let i=0;i<c.keys.length;i++){times.add(c.keys[i].time);if(i+1<c.keys.length)times.add((c.keys[i].time+c.keys[i+1].time)/2);}}}out[k]={decoded:d,samples:[...times].flatMap(time=>[false,true].map(loop=>({time,loop,values:sampleEffectClip(d,time,{loop})})))};}process.stdout.write(JSON.stringify(out));"""
result = subprocess.run([NODE,'--input-type=module','-e',script],cwd=ROOT,check=True,text=True,capture_output=True)
decoded = json.loads(result.stdout);initial_channels = sampled = 0
assert set(decoded) == set(fixtures) == set(meta['clips']) and len(fixtures) == 5
for key,fixture in fixtures.items():
    obj = objects[int(key.rsplit(':',1)[1])];tree = obj.read_typetree();muscle = tree['m_MuscleClip'];data = muscle['m_Clip']['data'];actual = decoded[key]['decoded']
    assert obj.type.name == 'AnimationClip' and fixture['sourceSha256'] == sha(obj.get_raw_data()) == meta['clips'][key]['sourceSha256']
    projected = {k:tree[k] for k in ['m_Name','m_RotationCurves','m_CompressedRotationCurves','m_EulerCurves','m_PositionCurves','m_ScaleCurves','m_FloatCurves','m_PPtrCurves','m_ClipBindingConstant']}
    projected['m_MuscleClip'] = {k:muscle[k] for k in ['m_StartTime','m_StopTime','m_LoopTime','m_Clip','m_ValueArrayDelta']}
    assert exact(projected) == fixture['data']
    words = data['m_StreamedClip']['data'];binary = struct.pack('<'+'I'*len(words),*words);at = frames = 0
    finite = [[] for _ in range(data['m_StreamedClip']['curveCount'])];initial = {}
    while at<len(binary):
        time,count = struct.unpack_from('<fi',binary,at);at += 8
        for _ in range(count):
            index,a,b,c,d = struct.unpack_from('<i4f',binary,at);at += 20
            if frames == 0:initial[index] = [a,b,c,d]
            elif math.isfinite(time):finite[index].append({'time':time,'coefficients':[a,b,c,d]})
        frames += 1
    assert actual['sourceFrames'] == frames and actual['streamedWords'] == len(words)
    for i,keys in enumerate(finite):
        channel = actual['channels'][i];assert channel['kind'] == 'streamed' and channel['keys'] == keys
        if not keys or keys[0]['time'] > muscle['m_StartTime']:
            assert initial[i][:3] == [0,0,0] and channel['initialValue'] == initial[i][3] == muscle['m_ValueArrayDelta'][i]['m_Start'];initial_channels += 1
        else:assert 'initialValue' not in channel
    constants = data['m_ConstantClip']['data']
    for sample in decoded[key]['samples']:
        t=max(muscle['m_StartTime'],sample['time']);start,stop=muscle['m_StartTime'],muscle['m_StopTime']
        t=start+(t-start)%(stop-start) if sample['loop'] and t>=stop else min(t,stop)
        expected=[]
        for i,keys in enumerate(finite):
            prior=[p for p in keys if p['time']<=t]
            if not prior:expected.append(initial[i][3]);continue
            p=prior[-1];a,b,c,d=p['coefficients'];dt=t-p['time'];expected.append(d if p is keys[-1] else ((a*dt+b)*dt+c)*dt+d)
        expected.extend(constants)
        assert len(sample['values']) == len(expected)
        for a,b in zip(sample['values'],expected):assert math.isclose(a,b,rel_tol=1e-9,abs_tol=1e-9),(key,t,a,b)
        sampled += len(expected)
build();assert before == [sha(p.read_bytes()) for p in [META,FIXTURE]]
print(json.dumps({'nativeClips':5,'authoredInitialChannels':initial_channels,'independentlySampledScalars':sampled,'reproducibleOutputs':2,'compiledFrameParity':False,'rendererVerified':False}))
