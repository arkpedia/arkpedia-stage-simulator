// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import fixtures from './fixtures/arkpedia-lappland-effect-clips.json' with {type:'json'};
import meta from '../data/arkpedia-lappland-effect-animations.json' with {type:'json'};
import source from '../data/arkpedia-lappland-effects.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {decodeEffectClip, sampleEffectClip} from '../shared/arkpedia/native-effect-animation.js';

const token = Object.values(fixtures).find(r=>r.data.m_Name==='token_1').data;
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} differs from ${b}`);
const clone = v => structuredClone(v);
const words = frames => {
  const bytes = Buffer.alloc(frames.reduce((n,f)=>n+8+f.keys.length*20,0));
  let p=0;
  for (const {time,keys} of frames) {
    bytes.writeFloatLE(time,p);bytes.writeInt32LE(keys.length,p+4);p+=8;
    for (const [index,coeff] of keys) {
      bytes.writeInt32LE(index,p);p+=4;
      for (const value of coeff) {bytes.writeFloatLE(value,p);p+=4;}
    }
  }
  return Array.from({length:bytes.length/4},(_,i)=>bytes.readUInt32LE(i*4));
};
function scalarFixture() {
  const f=clone(token), m=f.m_MuscleClip;
  m.m_StopTime=2;m.m_LoopTime=false;
  f.m_ClipBindingConstant.genericBindings=[{attribute:1,customType:0,isPPtrCurve:0,
    path:0,script:{m_FileID:0,m_PathID:'0'},typeID:23},
  {attribute:2,customType:0,isPPtrCurve:0,path:0,script:{m_FileID:0,m_PathID:'0'},typeID:23}];
  m.m_Clip.data.m_ConstantClip.data=[7];
  m.m_Clip.data.m_StreamedClip={curveCount:1,data:words([
    {time:-3.4028234663852886e38,keys:[[0,[0,0,0,3]]]},
    {time:0,keys:[[0,[2,-1,4,3]]]},
    {time:1,keys:[[0,[0,0,0,8]]]},
    {time:2,keys:[[0,[0,0,0,11]]]},
    {time:Infinity,keys:[]}
  ])};
  return f;
}

test('all ten original effect clips remain reproducible CI inputs with their native object digests',()=>{
  const bytes=readFileSync(new URL(meta.fixture.path.replace(/^test\//,''),import.meta.url));
  assert.equal(bytes.length,meta.fixture.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
  assert.equal(meta.sourcePackSha256,source.pack.sha256);
  assert.deepEqual(Object.keys(fixtures),Object.keys(meta.clips));
  let bindings=0,channels=0,keys=0;
  for (const [id,f] of Object.entries(fixtures)) {
    const c=decodeEffectClip(f.data), row=meta.clips[id];
    assert.equal(f.sourceSha256,row.sourceSha256);
    assert.equal(c.name,row.name);assert.equal(c.loop,row.loop);
    assert.equal(c.start,row.start);assert.equal(c.stop,row.stop);
    assert.equal(c.bindings.length,row.bindings);assert.equal(c.channels.length,row.channels);
    const n=c.channels.reduce((a,v)=>a+(v.keys?.length??0),0);
    assert.equal(n,row.keys);bindings+=c.bindings.length;channels+=c.channels.length;keys+=n;
    for(const t of [c.start,c.start+(c.stop-c.start)/2,c.stop,c.stop+.25]) {
      assert.ok(sampleEffectClip(c,t).every(Number.isFinite));
    }
  }
  assert.deepEqual(meta.counts,{clips:10,instances:17,bindings,channels,keys});
  assert.equal(channels,375);assert.equal(keys,342);
});

test('the original wolf bobs along its authored x channel over a two-second loop',()=>{
  const original=clone(token), c=decodeEffectClip(token);
  assert.equal(c.bindings.length,1);assert.equal(c.bindings[0].attribute,1);
  for (const [t,x] of [[0,-.04],[.5,0],[1,.04],[1.5,0],[2,-.04],[2.5,0]]) {
    const v=sampleEffectClip(c,t);close(v[0],x);assert.deepEqual(v.slice(1),[0,0]);
  }
  close(sampleEffectClip(c,-1)[0],-.04);
  close(sampleEffectClip(c,5,{loop:false})[0],-.04);
  assert.deepEqual(token,original);
});

test('cubic coefficients use seconds; steps hold until the next key and constant channels persist',()=>{
  const f=scalarFixture(), original=clone(f), c=decodeEffectClip(f);
  assert.deepEqual(sampleEffectClip(c,.5),[5,7]);
  assert.deepEqual(sampleEffectClip(c,1),[8,7]);
  assert.deepEqual(sampleEffectClip(c,1.999),[8,7]);
  assert.deepEqual(sampleEffectClip(c,2),[11,7]);
  assert.deepEqual(sampleEffectClip(c,9),[11,7]);
  assert.deepEqual(sampleEffectClip(c,2,{loop:true}),[3,7]);
  assert.deepEqual(sampleEffectClip(c,2.5,{loop:true}),[5,7]);
  assert.deepEqual(f,original);
});

test('each sparse channel uses its own clock without interpolating through another channel key',()=>{
  const f=clone(token), stream=f.m_MuscleClip.m_Clip.data.m_StreamedClip;
  stream.data=words([
    {time:-3.4028234663852886e38,keys:[[0,[0,0,0,0]],[1,[0,0,0,1]],[2,[0,0,0,2]]]},
    {time:0,keys:[[0,[0,0,2,0]],[1,[0,0,0,1]],[2,[0,0,0,2]]]},
    {time:.5,keys:[[1,[0,0,0,4]]]},
    {time:1,keys:[[0,[0,0,0,6]]]},
    {time:2,keys:[[0,[0,0,0,7]],[1,[0,0,0,9]],[2,[0,0,0,10]]]},
    {time:Infinity,keys:[]}
  ]);
  const c=decodeEffectClip(f);
  assert.deepEqual(sampleEffectClip(c,.75),[1.5,4,2]);
  assert.deepEqual(sampleEffectClip(c,1.5),[6,4,2]);
  assert.deepEqual(sampleEffectClip(c,2,{loop:false}),[7,9,10]);
});

for (const [name, mutate] of [
  ['dense curves',f=>f.m_MuscleClip.m_Clip.data.m_DenseClip.m_CurveCount=1],
  ['legacy curves',f=>f.m_FloatCurves.push({})],
  ['pointer curves',f=>f.m_ClipBindingConstant.genericBindings[0].isPPtrCurve=1],
  ['script curves',f=>f.m_ClipBindingConstant.genericBindings[0].script.m_PathID='123'],
  ['integer curves',f=>f.m_ClipBindingConstant.genericBindings[0].isIntCurve=1],
  ['binding count',f=>f.m_ClipBindingConstant.genericBindings=[]],
  ['transform attribute',f=>f.m_ClipBindingConstant.genericBindings[0].attribute=99],
  ['invalid word',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data[1]=-1],
  ['missing terminal frame',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data.splice(-2)],
  ['truncated key',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data.splice(-3)],
  ['trailing bytes',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data.push(0)],
  ['duplicate channel',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data[7]=0],
  ['NaN coefficient',f=>f.m_MuscleClip.m_Clip.data.m_StreamedClip.data[3]=0x7fc00000],
  ['reversed clock',f=>f.m_MuscleClip.m_StopTime=-1],
]) test(`unsupported or corrupted ${name} is rejected`,()=>{
  const f=clone(token);mutate(f);assert.throws(()=>decodeEffectClip(f),/Native effect animation/);
});

test('non-finite clocks cannot enter sampling and reviewed battle coverage stays unchanged',()=>{
  const c=decodeEffectClip(token);
  for (const t of [Infinity,-Infinity,NaN]) assert.throws(()=>sampleEffectClip(c,t),/non-finite sample time/);
  assert.throws(()=>sampleEffectClip(c,0,{loop:1}),/invalid loop/);
  assert.equal(meta.scope.sourceChannelsOnly,true);assert.equal(meta.scope.rendererVerified,false);
  assert.equal(meta.scope.compiledFrameParity,false);assert.deepEqual(meta.scope.enabledOperators,[]);
  assert.equal(Object.hasOwn(REGULAR_OPERATORS,'char_1038_whitw2'),false);
  assert.equal(Object.hasOwn(mvp.operators,'char_1038_whitw2'),false);
});
