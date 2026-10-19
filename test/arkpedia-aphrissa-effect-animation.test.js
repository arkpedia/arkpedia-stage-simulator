// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import fixtures from './fixtures/arkpedia-aphrissa-effect-clips.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import source from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {decodeEffectClip, sampleEffectClip} from '../shared/arkpedia/native-effect-animation.js';

const legacy = Object.values(fixtures).find(r => r.data.m_Legacy).data;
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} differs from ${b}`);

test('all fourteen Aphrissa clips remain complete original inputs',()=>{
  const bytes=readFileSync(new URL('./fixtures/arkpedia-aphrissa-effect-clips.json',import.meta.url));
  assert.equal(meta.fixture.bytes,bytes.length);
  assert.equal(meta.fixture.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(meta.sourcePackSha256,source.pack.sha256);
  assert.deepEqual(Object.keys(fixtures),Object.keys(meta.clips));
  assert.deepEqual(meta.counts,{clips:14,instances:21,bindings:568,channels:584,keys:537});
  assert.equal(meta.scope.sourceChannelsOnly,true);assert.equal(meta.scope.rendererVerified,false);
  assert.equal(meta.scope.compiledFrameParity,false);assert.deepEqual(meta.scope.enabledOperators,[]);
  assert.equal(meta.unresolvedBindings,undefined);
  assert.deepEqual(meta.unboundAmbiguousPaths,[{
    driver:'battle/prefabs/effects/aphris.ab:-5063427460730075031',path:67329413,nodes:[
      {path:'static_offset/rotation_z/scale_01/scale_02/sanjiao_mask_01',gameObject:'battle/prefabs/effects/aphris.ab:3552201232482224233'},
      {path:'static_offset/rotation_z/scale_01/scale_02/sanjiao_mask_01',gameObject:'battle/prefabs/effects/aphris.ab:1819121094335645801'}]}]);
});

for(const [key,fixture] of Object.entries(fixtures))test(fixture.data.m_Name+' retains its complete source channel extent',()=>{
  const before=structuredClone(fixture),clip=decodeEffectClip(fixture.data),row=meta.clips[key];
  assert.equal(fixture.sourceSha256,row.sourceSha256);
  assert.equal(clip.name,row.name);assert.equal(clip.start,row.start);assert.equal(clip.stop,row.stop);assert.equal(clip.loop,row.loop);
  assert.equal(clip.channels.length,row.channels);assert.equal(clip.bindings.length,row.bindings);
  assert.equal(clip.channels.reduce((n,c)=>n+(c.keys?.length??0),0),row.keys);
  for(const time of [clip.start-1,clip.start,.4,1.4,clip.stop,clip.stop+.25])
    assert.ok(sampleEffectClip(clip,time).every(Number.isFinite));
  assert.deepEqual(fixture,before);
});

test('legacy wings use their 3.33 second authored clock, literal paths and ZXY angles',()=>{
  const clip=decodeEffectClip(legacy);
  assert.equal(legacy.m_MuscleClip.m_StopTime,1);
  assert.equal(clip.stop,3.3333332538604736);assert.equal(clip.loop,true);
  assert.deepEqual(clip.bindings.map(b=>[b.path,b.rotationOrder,b.size]),[['wing_L','ZXY',3],['wing_R','ZXY',3]]);
  for(const [i,entry] of legacy.m_EulerCurves.entries())for(const point of entry.curve.m_Curve){
    const actual=sampleEffectClip(clip,point.time,{loop:false}).slice(i*3,i*3+3);
    ['x','y','z'].forEach((axis,j)=>near(actual[j],point.value[axis]));
  }
  for(const time of [.2,1.2,2,3]){
    const values=sampleEffectClip(clip,time);
    near(values[0],0);near(values[1],0);near(values[3],0);near(values[4],180);
    const p=legacy.m_EulerCurves[0].curve.m_Curve;
    const index=p.findIndex((a,i)=>i+1<p.length&&time>=a.time&&time<p[i+1].time);
    const a=p[index],b=p[index+1],dt=b.time-a.time,t=(time-a.time)/dt;
    const expected=(2*t**3-3*t**2+1)*a.value.z+(t**3-2*t**2+t)*dt*a.outSlope.z
      +(-2*t**3+3*t**2)*b.value.z+(t**3-t**2)*dt*b.inSlope.z;
    near(values[2],expected);
    sampleEffectClip(clip,time+clip.stop).forEach((v,i)=>near(v,values[i]));
  }
  assert.deepEqual(sampleEffectClip(clip,clip.stop),sampleEffectClip(clip,0));
  assert.deepEqual(sampleEffectClip(clip,clip.stop+1,{loop:false}),sampleEffectClip(clip,clip.stop,{loop:false}));
  assert.deepEqual(sampleEffectClip(clip,-1),sampleEffectClip(clip,0));
});

for(const [name,mutate] of [
  ['mixed source format',f=>f.m_MuscleClip.m_Clip.data.m_ConstantClip.data.push(1)],
  ['compressed legacy',f=>f.m_Compressed=true],
  ['stripped legacy bindings',f=>f.m_ClipBindingConstant.genericBindings.push({})],
  ['different wrap mode',f=>f.m_WrapMode=4],
  ['weighted tangent',f=>f.m_EulerCurves[0].curve.m_Curve[1].weightedMode=1],
  ['unknown rotation order',f=>f.m_EulerCurves[0].curve.m_RotationOrder=0],
  ['different infinity mode',f=>f.m_EulerCurves[0].curve.m_PostInfinity=0],
  ['duplicate literal path',f=>f.m_EulerCurves[1].path='wing_L'],
  ['nonfinite tangent',f=>f.m_EulerCurves[0].curve.m_Curve[1].outSlope.z=Infinity],
  ['nonfinite angle',f=>f.m_EulerCurves[0].curve.m_Curve[1].value.y=NaN],
  ['reversed key order',f=>f.m_EulerCurves[0].curve.m_Curve[1].time=0],
  ['nonzero first key',f=>f.m_EulerCurves[0].curve.m_Curve[0].time=.01],
  ['different wing clocks',f=>f.m_EulerCurves[0].curve.m_Curve.at(-1).time+=1],
  ['missing curves',f=>f.m_EulerCurves=[]],
  ['nonlegacy Euler',f=>f.m_Legacy=false],
])test('unreviewed '+name+' fails closed',()=>{
  const fixture=structuredClone(legacy);mutate(fixture);
  assert.throws(()=>decodeEffectClip(fixture),/Native effect animation/);
});

test('beam width channels retain the original LineRenderer property identity',()=>{
  const bindings=Object.values(fixtures).flatMap(f=>decodeEffectClip(f.data).bindings).filter(b=>b.typeID===120);
  assert.equal(bindings.length,96);
  const widths=bindings.filter(b=>b.customType===29);
  assert.equal(widths.length,32);assert.ok(widths.every(b=>b.attribute===3982886636&&b.size===1));
  assert.ok(meta.properties.includes('m_Parameters.widthMultiplier'));
});
