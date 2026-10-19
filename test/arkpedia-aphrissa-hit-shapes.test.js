// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {BURST_SPREAD_CONE_CONTRACT} from '../shared/arkpedia/native-particle-cone.js';
import rows from './fixtures/arkpedia-aphrissa-hit-shapes.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-hit-shapes.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex'),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  still={frameAt:()=>({birth:identity,movement:identity})};
let source=null;
try{
  const raw=await Promise.all([effects.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const b=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256);return b;
  }));source={pack:JSON.parse(gunzipSync(raw[0])),animations:JSON.parse(raw[1]),shaders:JSON.parse(raw[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false};

test('all original hit-shape profiles retain their controls and disabled emission rather than inventing native activation',async()=>{
  const raw=await readFile(new URL('./fixtures/arkpedia-aphrissa-hit-shapes.json',import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(sha(raw),meta.fixture.sha256);assert.equal(meta.sourcePackSha256,effects.pack.sha256);
  assert.deepEqual(meta.counts,{profiles:12,hemispheres:3,burstSpread:3,dormantPoints:6,roots:6,sourceInactive:0,snapshots:120});
  assert.deepEqual(meta.scope,{originalProfiles:true,positiveZHemisphere:true,explicitIdentityBirthFrames:true,originalBurstCohorts:true,
    burstSpreadContract:BURST_SPREAD_CONE_CONTRACT,dormantEmissionPreserved:true,nativeEmissionParity:false,compiledFrameParity:false,enabledOperators:[]});
  for(const row of Object.values(rows)){
    const before=structuredClone(row.data),e=createMovingParticles(row.data,{burstSpreadContract:BURST_SPREAD_CONE_CONTRACT}),first=e.sample(.15,still);
    if(row.kind==='dormantPoint'){
      assert.equal(row.data.EmissionModule.enabled,false);assert.equal(row.data.InitialModule.startSpeed.scalar,5);
      for(const time of [0,.15,1,3,10])assert.deepEqual(e.sample(time,still),[]);
    }else{
      assert.ok(first.length>0);
      if(row.kind==='hemisphere'){assert.ok(row.data.startDelay.scalar>0);assert.deepEqual(e.sample(row.data.startDelay.scalar-1e-6,still),[]);}
    }
    e.sample(2,still);assert.deepEqual(e.sample(.15,still),first);assert.deepEqual(row.data,before);
  }
});

test('all complete ordinary/S2/S3 hit and explicitly owned line prefabs retain every enabled original renderer',native,async()=>{
  const lib=createNativeEffectLibrary({three:T,...source,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
    c=new T.PerspectiveCamera(35,1,.001,100),points=[[-1,0,0],[1,0,0]];
  c.position.set(2,3,5);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  try{
    for(const root of new Set(Object.values(rows).map(r=>r.root))){
      const i=await lib.create(root,{linePositions:()=>points});
      try{
        assert.equal(i.inspection,null);assert.deepEqual(i.blocked,[]);
        assert.deepEqual(i.draws.map(d=>d.component).sort(),[...i.pose.renderers].filter(([,r])=>r.enabled).map(([id])=>id).sort());
        const sample=(time,clip)=>{
          i.update(time,{camera:c,clip});i.group.updateMatrixWorld(true);
          for(const d of i.draws){
            assert.ok((d.pool??[d.mesh]).every(p=>p.matrixWorld.elements.every(Number.isFinite)));
            if(d.particleSource&&!d.particleSource.EmissionModule.enabled)assert.deepEqual(d.lastParticles,[]);
          }
          return JSON.stringify(i.draws.map(d=>({id:d.component,particles:d.lastParticles,line:d.lineData})));
        };
        for(const clip of [null,...new Set(i.pose.instances.map(c=>c.clip))]){
          const first=sample(.15,clip);sample(1,clip);assert.equal(sample(.15,clip),first);
        }
      }finally{i.dispose();}
    }
    assert.equal(lib.instanceCount,0);await assert.rejects(lib.create('aphris_skill_01_buff_01'),/unplayed components/);
  }finally{lib.dispose();}
});
