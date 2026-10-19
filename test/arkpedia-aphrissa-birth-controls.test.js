// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {sampleParticleGradient} from '../shared/arkpedia/native-particle-curves.js';
import {particleRandom} from '../shared/arkpedia/native-particle-random.js';
import rows from './fixtures/arkpedia-aphrissa-birth-controls.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-birth-controls.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex'),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  still={frameAt:()=>({birth:identity,movement:identity})},near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${v} != ${b[i]}`));};
let source=null;
try{
  const bytes=await Promise.all([effects.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const b=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256);return b;
  }));source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false},
  library=pack=>createNativeEffectLibrary({three:T,...source,...(pack?{pack}:{}),builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
  camera=(x,y,z)=>{const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(x,y,z);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;};
const unitBasis=m=>[0,1,2].flatMap(axis=>{const v=m.elements.slice(axis*4,axis*4+3),n=Math.hypot(...v);assert.ok(n>0);return v.map(x=>x/n);});

test('eight original birth-control profiles retain full source properties and explicit native fidelity limits',async()=>{
  const raw=await readFile(new URL('./fixtures/arkpedia-aphrissa-birth-controls.json',import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(sha(raw),meta.fixture.sha256);assert.equal(meta.sourcePackSha256,effects.pack.sha256);
  assert.deepEqual(meta.counts,{profiles:8,randomFixedColors:4,billboards3D:4,roots:3,sourceInactive:4,probes:192});
  assert.deepEqual(meta.scope,{originalProfiles:true,fixedFirstStrictlyLaterKey:true,stableRandomBirthColor:true,ordinaryBillboard3D:true,
    stretchedBillboard3D:false,nativeRngParity:false,compiledFrameParity:false,enabledOperators:[]});
  for(const row of Object.values(rows))if(row.kind==='randomFixedColor'){
    assert.equal(row.data.InitialModule.startColor.minMaxState,4);assert.equal(row.data.InitialModule.startColor.maxGradient.m_Mode,1);
    const s=structuredClone(row.data);s.ColorModule.enabled=false; // Declared control isolates birth color from source lifetime alpha.
    const e=createMovingParticles(s),first=e.sample(.25,still),later=e.sample(.35,still);assert.ok(first.length>0);
    for(const p of first){
      near(p.color,sampleParticleGradient(s.InitialModule.startColor,0,particleRandom(p.id,5,1)));
      const q=later.find(q=>q.id===p.id);if(q)near(q.color,p.color);
    }
  }
});

test('original ordinary Local billboards retain all three source rotation axes independently of camera orbit',native,async()=>{
  const lib=library(),cameras=[camera(2,3,5),camera(-4,1,3),createNativeStageCamera(T).sync(camera(2,3,4))];
  try{
    for(const [id,row] of Object.entries(rows).filter(([,r])=>r.kind==='billboard3D')){
      const i=await lib.inspectParticles(row.root,{particles:[id]});
      try{
        assert.equal(i.draws.length,1);const d=i.draws[0];assert.equal(d.alignment,2);let compared=0;
        const capture=c=>{
          i.update(.15,{camera:c});i.group.updateMatrixWorld(true);
          return d.lastParticles.map((p,n)=>{
            const [x,y,z]=p.rotation3D,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z),
              expected=[[cy*cz+sy*sx*sz,cx*sz,-sy*cz+cy*sx*sz],[-cy*sz+sy*sx*cz,cx*cz,sy*sz+cy*sx*cz],[sy*cx,-sx,cy*cx]].flat();
            // Multiply the original quaternion chain directly. Decomposing a
            // scaled matrix normalizes away serialized quaternion precision.
            const state=i.pose.sample(.15),chain=[];for(let id=d.transform;id;id=state.nodes.get(id).parent)chain.unshift(id);
            let q=[0,0,0,1];for(const id of chain){
              const node=state.nodes.get(id);assert.equal(node.euler,undefined);
              const [a,b,c,w]=q,[d,e,f,v]=node.rotation;
              q=[w*d+a*v+b*f-c*e,w*e+b*v+c*d-a*f,w*f+c*v+a*e-b*d,w*v-a*d-b*e-c*f];
            }
            const basis=unitBasis(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().fromArray(q)).invert().multiply(d.pool[n].matrixWorld));
            near(basis,expected);compared++;
            return {id:p.id,basis,particles:p};
          });
        };
        const first=capture(cameras[0]);assert.ok(first.length>0);
        for(const c of cameras.slice(1))assert.deepEqual(capture(c),first);
        assert.ok(compared>0);assert.deepEqual([...d.mesh.geometry.getAttribute('position').array],[-.5,.5,0,.5,.5,0,-.5,-.5,0,.5,-.5,0]);
      }finally{i.dispose();}
    }
  }finally{lib.dispose();}
});

test('original Fixed-palette emitters write their source colors to particle buffers while staying authored inactive',native,async()=>{
  const lib=library(),cam=camera(2,3,5),visible=part=>{for(let n=part;n;n=n.parent)if(!n.visible)return false;return true;};
  try{
    for(const [id,row] of Object.entries(rows).filter(([,r])=>r.kind==='randomFixedColor')){
      const i=await lib.inspectParticles(row.root,{particles:[id]});
      try{
        i.update(.25,{camera:cam});i.group.updateMatrixWorld(true);const d=i.draws[0];
        assert.ok(d.lastParticles.length>0);assert.equal(row.gameObjectActive,false);
        for(const [index,p] of d.lastParticles.entries()){
          assert.equal(visible(d.pool[index]),false);
          const color=d.pool[index].geometry.getAttribute('in_COLOR0');
          for(let vertex=0;vertex<color.count;vertex++)for(let axis=0;axis<4;axis++)
            assert.ok(Math.abs(color.array[vertex*4+axis]-p.color[axis])<1e-7);
        }
      }finally{i.dispose();}
    }
    assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
});

test('ordinary View billboards rotate their original quad in all three camera-plane axes rather than discarding pitch/yaw',native,async()=>{
  const [id,row]=Object.entries(rows).find(([,r])=>r.kind==='billboard3D'),pack=structuredClone(source.pack);
  pack.records[row.renderer].data.m_RenderAlignment=0;
  const c=v=>({minMaxState:0,scalar:v}),s=pack.records[id].data;
  Object.assign(s.InitialModule,{startRotationX:c(.3),startRotationY:c(-.6),startRotation:c(.7)});
  const lib=library(pack),i=await lib.inspectParticles(row.root,{particles:[id]}),d=i.draws[0],
    expected=unitBasis(new T.Matrix4().makeRotationFromEuler(new T.Euler(.3,-.6,.7,'YXZ')));
  try{
    for(const cam of [camera(2,3,5),camera(-4,1,3),createNativeStageCamera(T).sync(camera(2,3,4))]){
      i.update(.15,{camera:cam});i.group.updateMatrixWorld(true);assert.ok(d.lastParticles.length>0);
      for(const part of d.pool.slice(0,d.lastParticles.length))near(unitBasis(new T.Matrix4().multiplyMatrices(cam.matrixWorldInverse,part.matrixWorld)),expected);
    }
  }finally{i.dispose();lib.dispose();}
});

test('all 22 complete original effect roots retain every enabled renderer under explicit line ownership',native,async()=>{
  assert.deepEqual(meta.effectRoots,Object.keys(source.pack.roots).sort());assert.equal(meta.effectRoots.length,22);
  const lib=library(),cam=createNativeStageCamera(T).sync(camera(2,3,5));
  try{
    for(const root of meta.effectRoots){
      const i=await lib.create(root,{linePositions:()=>[[-1,0,0],[1,0,0]]});
      try{
        assert.equal(i.inspection,null);assert.deepEqual(i.blocked,[]);
        assert.deepEqual(i.draws.map(d=>d.component).sort(),[...i.pose.renderers].filter(([,r])=>r.enabled).map(([id])=>id).sort());
        const sample=(time,clip)=>{
          i.update(time,{camera:cam,clip});i.group.updateMatrixWorld(true);
          for(const d of i.draws)assert.ok((d.pool??[d.mesh]).every(p=>p.matrixWorld.elements.every(Number.isFinite)));
          return JSON.stringify(i.draws.map(d=>({id:d.component,particles:d.lastParticles,line:d.lineData})));
        };
        for(const clip of [null,...new Set(i.pose.instances.map(c=>c.clip))]){const first=sample(.15,clip);sample(.8,clip);assert.equal(sample(.15,clip),first);}
      }finally{i.dispose();}
    }
    assert.equal(lib.instanceCount,0);await assert.rejects(lib.create('aphris_attack_01_line_01'),/unplayed components/);
  }finally{lib.dispose();}
});
