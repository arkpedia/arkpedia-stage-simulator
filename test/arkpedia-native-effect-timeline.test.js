// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createEffectTimeline,isEffectTimeline} from '../shared/arkpedia/native-effect-timeline.js';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {validateAphrissaPointSources} from '../shared/arkpedia/aphrissa-point-sources.js';
import {APHRISSA_BEAM_STYLES as styles} from '../shared/arkpedia/aphrissa-beam-presentation.js';
import effectMeta from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
test('clip transitions change only the animation clock, preserve exact boundaries and remain immutable through reverse sampling',()=>{
 const input=[{time:0,clip:'start'},{time:2,clip:'end'},{time:3,clip:null}],timeline=createEffectTimeline(input);
 assert.deepEqual(timeline.sample(-1),{clip:'start',time:0});assert.deepEqual(timeline.sample(1.5),{clip:'start',time:1.5});
 assert.deepEqual(timeline.sample(2),{clip:'end',time:0});assert.deepEqual(timeline.sample(2.5),{clip:'end',time:.5});
 assert.deepEqual(timeline.sample(4),{clip:null,time:1});assert.deepEqual(timeline.sample(.5),{clip:'start',time:.5});
 assert.equal(isEffectTimeline(timeline),true);assert.equal(isEffectTimeline({...timeline}),false);
 input[0].clip='changed';assert.equal(timeline.sample(0).clip,'start');assert.deepEqual(timeline.clips,['start','end',null]);
 assert.throws(()=>timeline.clips.push('unowned'));assert.throws(()=>timeline.sample(NaN));
 for(const input of [[],Array(1),[{time:1,clip:null}],[{time:0,clip:''}],[{time:0,clip:undefined}],
  [{time:0,clip:null},{time:0,clip:'end'}],[{time:0,clip:null},{time:-1,clip:'end'}]])assert.throws(()=>createEffectTimeline(input));
});
let source=null;
try{
 const bytes=await Promise.all([effectMeta.pack,animationMeta.artifact,shaderMeta.artifact].map(async e=>{
  const b=await readFile('.cache/arkpedia/aphrissa-source/effects/'+e.path);assert.equal(b.length,e.bytes);
  assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);return b;
 }));source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(e){if(e.code!=='ENOENT')throw e;}
const native={skip:!source?'Original effect cache unavailable':false};
test('all nine original point prefabs resolve their actual default states and three zero-duration OnEnd edges',native,()=>{
 const before=structuredClone(source),proof=validateAphrissaPointSources(source.pack,source.animations);
 assert.equal(proof.profiles.length,9);assert.equal(proof.profiles.filter(p=>p.controller===null).length,2);
 assert.equal(proof.profiles.filter(p=>p.onEnd).length,3);assert.equal(proof.nativeMountMappingVerified,false);
 assert.ok(proof.profiles.filter(p=>p.onEnd).every(p=>p.delayToFinish===0&&p.onEnd.parameter==='OnEnd'));
 for(const mutate of [
  s=>s.animations.sourcePackSha256='changed',s=>delete s.pack.roots.aphris_skill_02_start_01,
  s=>s.pack.records['battle/prefabs/effects/aphris.ab:-4404053874303159205'].data.m_Controller.m_StateMachineArray[0].data.m_DefaultState=1,
  s=>s.pack.records['battle/prefabs/effects/aphris.ab:-4404053874303159205'].data.m_Controller.m_StateMachineArray[0].data.m_StateConstantArray[0].data.m_Speed=2,
  s=>s.pack.records['battle/prefabs/effects/aphris.ab:-4404053874303159205'].data.m_Controller.m_StateMachineArray[0].data.m_StateConstantArray[0].data.m_TransitionConstantArray[0].data.m_TransitionDuration=.1,
  s=>s.pack.records['battle/prefabs/effects/aphris.ab:1238776794601408617'].data._delayToFinish=1,
 ]){const altered=structuredClone(source);mutate(altered);assert.throws(()=>validateAphrissaPointSources(altered.pack,altered.animations));}
 assert.deepEqual(source,before);
});
test('S2 End animation samples independently while original particle birth identities keep the continuing effect age',native,async()=>{
 const lib=createNativeEffectLibrary({three:T,...source,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
  style=styles.s2.points.end,instance=await lib.create(style.root),camera=new T.PerspectiveCamera(35,1,.001,100);
 camera.position.set(2,3,6);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const births=()=>instance.draws.map(d=>({id:d.component,particles:(d.lastParticles??[]).map(p=>({id:p.id,birthTime:p.birthTime}))})),
  timeline=createEffectTimeline([{time:0,clip:style.clip.id},{time:.5,clip:style.end.id}]);
 const transforms=()=>{const values=[];instance.group.traverse(o=>{if(o.isGroup)values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray());});return values;};
 try{
  instance.update(.6,{camera,clip:style.clip.id});const expected=births(),defaultTransforms=transforms();assert.ok(expected.some(d=>d.particles.length));
  instance.update(.6,{camera,timeline});assert.deepEqual(births(),expected);const endTransforms=transforms();assert.notDeepEqual(endTransforms,defaultTransforms);
  const properties=()=>instance.draws.map(d=>Object.fromEntries(Object.entries(d.mesh.material.uniforms)
    .filter(([name])=>name!=='_Time').map(([name,u])=>[name,u.value?.toArray?.()??(u.value?.isTexture?'originalTexture':u.value)]))),endProperties=properties();
  instance.update(.1,{camera,clip:style.end.id});assert.deepEqual(properties(),endProperties);
  const directEndTransforms=transforms();assert.equal(directEndTransforms.length,endTransforms.length);
  directEndTransforms.forEach((v,i)=>assert.ok(Math.abs(v-endTransforms[i])<1e-9));
  instance.update(.6,{camera,timeline});assert.deepEqual(births(),expected);
  const snapshot=()=>createHash('sha256').update(JSON.stringify(instance.draws.map(d=>({particles:d.lastParticles,matrices:d.pool?.slice(0,d.lastParticles?.length??0).map(p=>p.matrix.elements)})))).digest('hex'),first=snapshot();
  instance.update(.9,{camera,timeline});instance.update(.6,{camera,timeline});
  assert.equal(snapshot(),first);assert.ok(instance.draws.every(d=>d.pool?.slice(d.lastParticles?.length??0).every(p=>!p.visible)??true));
  assert.throws(()=>instance.update(.6,{camera,timeline:{...timeline}}),/owned clip timeline/);
  assert.throws(()=>instance.update(.6,{camera,timeline,clip:style.clip.id}),/owned clip timeline/);
  assert.throws(()=>instance.update(.6,{camera,timeline:createEffectTimeline([{time:0,clip:'unowned'}])}),/owned clip timeline/);
 }finally{instance.dispose();lib.dispose();}
});
