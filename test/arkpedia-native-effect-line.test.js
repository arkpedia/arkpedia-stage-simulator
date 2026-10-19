// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import lines from './fixtures/arkpedia-aphrissa-lines.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-lines.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {createEffectLine} from '../shared/arkpedia/native-effect-line.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);
const source=Object.values(lines)[0].data;
test('all twenty-four original beam layers remain pinned to their three complete roots',()=>{
  const bytes=readFileSync(new URL('./fixtures/arkpedia-aphrissa-lines.json',import.meta.url));
  assert.equal(meta.fixture.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(meta.fixture.bytes,bytes.length);
  assert.equal(meta.sourcePackSha256,effects.pack.sha256);
  assert.deepEqual(Object.keys(meta.lines).sort(),Object.keys(lines).sort());assert.equal(Object.keys(lines).length,24);
  assert.equal(Object.keys(meta.roots).length,3);assert.ok(Object.values(meta.roots).every(a=>a.length===8));
  assert.equal(new Set(Object.values(meta.roots).flat()).size,24);
  assert.equal(meta.scope.nativeEndpointDispatchVerified,false);assert.equal(meta.scope.nativeShaderGlobalsVerified,false);
  assert.equal(meta.scope.compiledFrameParity,false);assert.deepEqual(meta.scope.enabledOperators,[]);
});
for(const [id,record] of Object.entries(lines))test('original line '+id+' retains source width, world units and camera facing',()=>{
  const before=structuredClone(record),line=createEffectLine(record.data);
  assert.equal(meta.lines[id].sourceSha256,record.serializedSha256);
  const endpoints=[[1,2,3],[4,2,3]],camera=[2,2,10];
  const data=line.sample(endpoints,camera),width=record.data.m_Parameters.widthMultiplier*record.data.m_Parameters.widthCurve.m_Curve[0].value;
  assert.deepEqual(data.uvs,[0,0,0,1,3,0,3,1]);assert.deepEqual(data.indices,[0,1,2,1,3,2]);
  assert.deepEqual(data.widths,[width,width]);assert.deepEqual(data.colors,Array(16).fill(1));
  for(let i=0;i<2;i++)for(let axis=0;axis<3;axis++)near((data.positions[i*6+axis]+data.positions[i*6+axis+3])/2,endpoints[i][axis]);
  near(Math.hypot(...data.positions.slice(0,3).map((v,i)=>v-data.positions[i+3])),width);
  for(let i=0;i<4;i++){near(data.positions[i*3+2],3);near(data.positions[i*3],i<2?1:4);}
  assert.deepEqual(line.sample(endpoints,camera,0).indices,[]);
  assert.deepEqual(line.sample(endpoints,[10,2,3]).indices,[]);
  assert.deepEqual(line.sample([[1,2,3],[1,2,3]],camera).indices,[]);
  assert.deepEqual(line.sample(endpoints,camera),data);
  assert.deepEqual(record,before);
  assert.throws(()=>line.sample(undefined,camera),/explicit endpoints/);
  assert.throws(()=>line.sample([[1,NaN,3],[4,2,3]],camera),/endpoint/);
  assert.throws(()=>line.sample(endpoints,[1,2,Infinity]),/camera/);
  assert.throws(()=>line.sample(endpoints,camera,-1),/Negative/);
});
for(const [name,mutate] of [
  ['local space',s=>s.m_UseWorldSpace=false],['loop',s=>s.m_Loop=true],
  ['alignment',s=>s.m_Parameters.alignment=1],['stretched UV',s=>s.m_Parameters.textureMode=0],
  ['caps',s=>s.m_Parameters.numCapVertices=1],['corners',s=>s.m_Parameters.numCornerVertices=1],
  ['lighting',s=>s.m_Parameters.generateLightingData=true],['third point',s=>s.m_Positions.push({x:0,y:0,z:0})],
  ['width tessellation',s=>s.m_Parameters.widthCurve.m_Curve.push({...s.m_Parameters.widthCurve.m_Curve[0],time:1})],
  ['gradient tessellation',s=>s.m_Parameters.colorGradient.m_NumColorKeys=3],
  ['negative width',s=>s.m_Parameters.widthMultiplier=-1],['weighted width',s=>s.m_Parameters.widthCurve.m_Curve[0].weightedMode=1],
])test('unreviewed line '+name+' stays rejected',()=>{
  const changed=structuredClone(source);mutate(changed);assert.throws(()=>createEffectLine(changed),/native (line|particle)|Native line/);
});
