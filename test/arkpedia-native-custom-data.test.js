// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createParticleCustomData,createParticleVertexLayout} from '../shared/arkpedia/native-particle-custom-data.js';
import {createStationaryParticles} from '../shared/arkpedia/native-stationary-particles.js';
import fixtures from './fixtures/arkpedia-tragodia-custom-streams.json' with {type:'json'};
import meta from '../data/arkpedia-tragodia-custom-streams.json' with {type:'json'};
import source from '../data/arkpedia-tragodia-effects.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
const constant=v=>({minMaxState:0,scalar:v,minScalar:v});
const module=()=>({enabled:true,mode0:1,mode1:0,vectorComponentCount0:4,
 vector0_0:constant(1),vector0_1:constant(2),vector0_2:constant(3),vector0_3:constant(4)});

test('eight original cage fixtures remain tied to source object and export digests',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-tragodia-custom-streams.json',import.meta.url));
 assert.equal(meta.fixture.bytes,bytes.length);
 assert.equal(meta.fixture.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(meta.sourcePackSha256,source.pack.sha256);
 assert.equal(Object.keys(fixtures).length,8);assert.deepEqual(Object.keys(fixtures),Object.keys(meta.renderers));
 for(const [id,row] of Object.entries(fixtures)){
  assert.equal(row.rendererSha256,meta.renderers[id].rendererSha256);
  assert.equal(row.particleSha256,meta.renderers[id].particleSha256);
  assert.deepEqual(row.streams,[0,1,3,4,34,38]);
 }
 assert.deepEqual(meta.scope,{sourceMapping:true,compiledFrameParity:false,enabledOperators:[]});
 assert.equal(mvp.operators[meta.operator],undefined);
});
for(const [id,row] of Object.entries(fixtures))test(row.name+' samples authored custom data at its particle age and reverses exactly',()=>{
 const before=structuredClone(row),emitter=createStationaryParticles(row.source),data=createParticleCustomData(row.source.CustomDataModule);
 const start=row.source.startDelay.scalar/row.source.simulationSpeed;
 const firstTime=start+.25/row.source.simulationSpeed,first=emitter.sample(firstTime);assert.ok(first.length>0);
 if(start>0)assert.deepEqual(emitter.sample(start-.001),[]);
 for(const offset of [.25,.75,1.25,3.5])for(const p of emitter.sample(start+offset/row.source.simulationSpeed)){
  const value=2*Math.max(0,Math.min(1,p.age/p.lifetime))-1;
  assert.ok(Math.abs(p.customData[0][0]-value)<1e-12,id);
  assert.deepEqual(p.customData[0].slice(1),[0,0,0]);assert.deepEqual(p.customData[1],[0,0,0,0]);
 }
 emitter.sample(start+4);assert.deepEqual(emitter.sample(firstTime),first);
 assert.deepEqual(data.sample(0,1,()=>.25),[[-1,0,0,0],[0,0,0,0]]);
 assert.deepEqual(data.sample(2,1,()=>.25),[[1,0,0,0],[0,0,0,0]]);
 assert.deepEqual(row,before);
});
test('UV and both custom vectors pack consecutively across attribute boundaries',()=>{
 const custom=[[1,2,3,4],[5,6,7,8]],before=structuredClone(custom);
 const layout=createParticleVertexLayout([0,1,3,4,34,38]);assert.deepEqual(layout.dimensions,[4,4,2]);
 assert.deepEqual(layout.sample([.25,.75],custom),[[.25,.75,1,2],[3,4,5,6],[7,8]]);
 const reordered=createParticleVertexLayout([0,1,3,34,4,38]);
 assert.deepEqual(reordered.sample([.25,.75],custom),[[1,2,3,4],[.25,.75,5,6],[7,8]]);
 assert.deepEqual(createParticleVertexLayout([0,1,3,4,31,36]).sample([.25,.75],custom),[[.25,.75,1,5],[6]]);
 assert.deepEqual(custom,before);
});
test('vector widths and HDR color streams remain independent from particle tint',()=>{
 const m=module();m.vectorComponentCount0=2;m.mode1=2;m.color1={minMaxState:0,maxColor:{r:3,g:2,b:1,a:.5}};
 const before=structuredClone(m);
 assert.deepEqual(createParticleCustomData(m).sample(.5,2,()=>.25),[[1,2,0,0],[3,2,1,.5]]);
 assert.deepEqual(m,before);assert.equal(createParticleCustomData({enabled:false}),null);
});
test('separate random factors remain stable across samples and do not replace source clocks',()=>{
 const m=module();m.vector0_0={minMaxState:3,scalar:10,minScalar:2};m.vector0_1={minMaxState:3,scalar:8,minScalar:4};
 const data=createParticleCustomData(m),factors=(stream,channel)=>channel===0?.25:.75;
 assert.deepEqual(data.sample(.25,1,factors),[[4,7,3,4],[0,0,0,0]]);
 assert.deepEqual(data.sample(.75,1,factors),data.sample(.25,1,factors));
});
test('unknown streams, malformed inputs and unsupported custom curves stay explicit',()=>{
 for(const streams of [[],[0],[0,1,3,4,34,34],[0,1,3,4,200],[0,1,3,4,2]])
  assert.throws(()=>createParticleVertexLayout(streams),/native particle/i);
 const layout=createParticleVertexLayout([0,1,3,4,34,38]);
 for(const uv of [[],[1],[1,NaN]])assert.throws(()=>layout.sample(uv,[[0,0,0,0],[0,0,0,0]]),/vertex values/);
 assert.throws(()=>layout.sample([0,0],[[0,0,0],[0,0,0,0]]),/vertex values/);
 for(const count of [0,5,.5])assert.throws(()=>createParticleCustomData({...module(),vectorComponentCount0:count}),/vector width/);
 assert.throws(()=>createParticleCustomData({...module(),mode1:3}),/custom data mode/);
 const data=createParticleCustomData(module());
 for(const [age,lifetime] of [[NaN,1],[-1,1],[0,0],[0,Infinity]])assert.throws(()=>data.sample(age,lifetime,()=>.5),/sample/);
 const bad=structuredClone(Object.values(fixtures)[0].source.CustomDataModule);
 bad.vector0_0.maxCurve.m_Curve[0].weightedMode=1;
 assert.throws(()=>createParticleCustomData(bad),/Weighted/);
});
