// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createLapplandMotionFixture} from '../tools/arkpedia/lappland-motion-fixture.mjs';
import {recordLapplandS3Motion} from '../server/sim/content/arkpedia-lappland-motion.js';
import {createLapplandStageEffects} from '../public/arkpedia/lappland-stage-effects.js';
import {readLapplandMotionInput} from '../shared/arkpedia/lappland-effect-motion.js';
import source from '../data/arkpedia-lappland-effects.json' with {type:'json'};
const SHA=source.pack.sha256;
function library(){
 const created=[],calls=[],wait=[];let deferred=false,fail=false;
 return {created,calls,wait,get deferred(){return deferred;},set deferred(v){deferred=v;},set fail(v){fail=v;},
  async create(root){
   calls.push(root);if(fail)throw Error('fixture: missing original resource');
   const i={group:new T.Group(),disposed:0,frames:[],update(time,{camera,trajectory}){this.frames.push({time,position:trajectory.sample(time),camera});},dispose(){this.disposed++;this.group.removeFromParent();}};
   created.push(i);if(deferred)await new Promise(resolve=>wait.push(resolve));return i;
  }};
}
function fixture(lib=library(),recordMotion=recordLapplandS3Motion){
 const f=createLapplandMotionFixture(),pass=createLapplandStageEffects({three:T,library:lib,sourcePackSha256:SHA,recordMotion});pass.update(f.b);
 const camera=new T.PerspectiveCamera(40,1.6,.1,100);camera.up.set(0,0,1);camera.position.set(6,-5,12);camera.lookAt(6,5,0);camera.updateMatrixWorld(true);
 const renderer={autoClear:true,calls:0,render(){this.calls++;}};return {...f,lib,pass,camera,renderer};
}
async function begin(f){f.enemy();f.activate();f.pass.update(f.b);await f.pass.ready();}
test('live S3 births create three strict source roots, with independent observed paths and stage coordinates',async()=>{
 const f=fixture();try{
  await begin(f);assert.equal(f.pass.instanceCount,3);assert.equal(f.pass.pendingCount,0);assert.ok(f.lib.calls.every(n=>n==='whitw2_skill_03_token_trail_01'));
  f.advance(.7);f.pass.update(f.b);f.pass.render(f.renderer,f.camera);
  for(const e of f.pass.inspect()){
   const d=f.controller.s3.drones[e.track.slot];assert.deepEqual(e.track.samples.at(-1).position,[d.x,0,d.y]);assert.equal(e.time,e.track.samples.at(-1).time);
   assert.deepEqual(e.instance.frames.at(-1).position,[d.x,0,d.y]);assert.equal(e.instance.group.matrixWorld.determinant(),1);
  }
  assert.equal(f.renderer.calls,1);assert.equal(f.renderer.autoClear,true);assert.ok(f.pass.camera.matrixWorld.determinant()<0);
 }finally{f.pass.dispose();}
});
test('attachment retires cruise artwork and active snapshots omit closed historical paths',async()=>{
 const f=fixture();try{
  await begin(f);f.advance(6);assert.ok(f.controller.s3.drones.every(d=>d.phase==='attach'));f.pass.update(f.b);await f.pass.ready();
  assert.equal(f.pass.instanceCount,0);assert.equal(f.pass.scene.children.length,0);assert.ok(f.lib.created.every(i=>i.disposed===1));
 }finally{f.pass.dispose();}
});
test('source reappearance creates fresh zero-age instances and never joins the old cruise trail',async()=>{
 const f=fixture();try{
  await begin(f);const old=f.pass.inspect().map(e=>e.track.id);f.advance(6);f.pass.update(f.b);f.b.enemies[0].hidden=true;f.enemy(14);f.advance(f.b.dt);f.pass.update(f.b);await f.pass.ready();
  assert.equal(f.pass.instanceCount,3);for(const e of f.pass.inspect()){assert.ok(!old.includes(e.track.id));assert.equal(e.track.samples[0].time,0);assert.ok(e.time<=f.b.dt+1e-9);}
  assert.equal(f.lib.created.filter(i=>i.disposed).length,3);
 }finally{f.pass.dispose();}
});
test('skill end and cast restart retire prior roots and replace their source generation',async()=>{
 const f=fixture();try{
  await begin(f);const generation=f.pass.inspect()[0].track.generation;f.u.skill.end('fixture');f.pass.update(f.b);assert.equal(f.pass.instanceCount,0);
  f.activate();f.pass.update(f.b);await f.pass.ready();assert.equal(f.pass.instanceCount,3);assert.ok(f.pass.inspect().every(e=>e.track.generation>generation&&e.time===0));
  f.b.retreat(f.u,{permanent:true});f.pass.update(f.b);assert.equal(f.pass.instanceCount,0);
 }finally{f.pass.dispose();}
});
test('paused rendering cannot advance combat, spend SP, consume RNG or move a source drone',async()=>{
 const f=fixture();try{
  await begin(f);f.advance(.5);f.pass.update(f.b);const state=f.b.snapshot(),positions=f.controller.s3.drones.map(d=>[d.x,d.y]),sp=f.u.skill.sp;
  f.b.rng=()=>{throw Error('presentation consumed combat RNG');};for(let n=0;n<8;n++)f.pass.render(f.renderer,f.camera);
  assert.deepEqual(f.b.snapshot(),state);assert.deepEqual(f.controller.s3.drones.map(d=>[d.x,d.y]),positions);assert.equal(f.u.skill.sp,sp);
  assert.ok(f.lib.created.every(i=>i.frames.every(frame=>frame.time===i.frames[0].time)));
 }finally{f.pass.dispose();}
});
test('late texture completion after battle replacement cannot attach an old root to the new scene',async()=>{
 const lib=library();lib.deferred=true;const f=fixture(lib),next=createLapplandMotionFixture();
 try{
  f.activate();f.pass.update(f.b);await Promise.resolve();assert.equal(lib.wait.length,3);
  f.pass.update(next.b);for(const resolve of lib.wait)resolve();await f.pass.ready();assert.equal(f.pass.instanceCount,0);assert.equal(f.pass.scene.children.length,0);assert.ok(lib.created.every(i=>i.disposed===1));
  next.activate();lib.deferred=false;f.pass.update(next.b);await f.pass.ready();assert.equal(f.pass.instanceCount,3);
 }finally{f.pass.dispose();}
});
test('disposing during async creation releases late roots and leaves the borrowed library reusable',async()=>{
 const lib=library();lib.deferred=true;const f=fixture(lib);f.activate();f.pass.update(f.b);await Promise.resolve();f.pass.dispose();
 for(const resolve of lib.wait)resolve();await f.pass.ready();assert.equal(f.pass.instanceCount,0);assert.equal(f.pass.scene.children.length,0);assert.ok(lib.created.every(i=>i.disposed===1));
 assert.throws(()=>f.pass.update(f.b),/disposed/);assert.throws(()=>f.pass.render(f.renderer,f.camera),/disposed/);
 lib.deferred=false;const i=await lib.create('whitw2_skill_03_token_trail_01');assert.equal(i.disposed,0);i.dispose();
});
test('invalid source hashes or changed live identities fail before replacing valid artwork',async()=>{
 let alter=null;const f=fixture(library(),b=>{const r=recordLapplandS3Motion(b);return {dispose:()=>r.dispose(),activeSnapshot(){const s=r.activeSnapshot();if(alter==='hash')s.sourcePackSha256='0'.repeat(64);if(alter==='identity')s.tracks[0].owner='foreign';return s;}};});
 try{await begin(f);const before=f.pass.inspect().map(e=>e.instance);for(const change of ['hash','identity']){alter=change;assert.throws(()=>f.pass.update(f.b),/changed|identity/);assert.deepEqual(f.pass.inspect().map(e=>e.instance),before);}alter=null;f.pass.update(f.b);}finally{f.pass.dispose();}
});
test('late recording rejection preserves the previously bound battle and its live roots',async()=>{
 const f=fixture(),next=createLapplandMotionFixture();try{await begin(f);const before=f.pass.inspect().map(e=>e.instance);next.activate();assert.throws(()=>f.pass.update(next.b),/before skill activation/);assert.deepEqual(f.pass.inspect().map(e=>e.instance),before);f.pass.update(f.b);}finally{f.pass.dispose();}
});
test('strict resource failures propagate through readiness instead of showing incomplete effects',async()=>{
 const lib=library();lib.fail=true;const f=fixture(lib);try{f.activate();f.pass.update(f.b);await assert.rejects(f.pass.ready(),/missing original resource/);assert.throws(()=>f.pass.render(f.renderer,f.camera),/missing original/);assert.equal(f.pass.scene.children.length,0);f.pass.clear();}finally{f.pass.dispose();}
});
test('render failures restore both true and false caller auto-clear policies',async()=>{
 const f=fixture();try{await begin(f);for(const value of [true,false]){f.renderer.autoClear=value;f.renderer.render=()=>{assert.equal(f.renderer.autoClear,false);throw Error('fixture: render failure');};assert.throws(()=>f.pass.render(f.renderer,f.camera),/render failure/);assert.equal(f.renderer.autoClear,value);}}finally{f.pass.dispose();}
});
test('same-frame birth and retirement cancel queued creation before any assets are requested',async()=>{
 const f=fixture();try{f.activate();f.pass.update(f.b);f.u.skill.end('fixture');f.pass.update(f.b);await f.pass.ready();assert.equal(f.lib.calls.length,0);assert.equal(f.pass.instanceCount,0);}finally{f.pass.dispose();}
});
test('live empty reports retain source validation without weakening inspector input requirements',()=>{
 const f=createLapplandMotionFixture(),r=recordLapplandS3Motion(f.b),empty=r.activeSnapshot();
 assert.throws(()=>readLapplandMotionInput(empty,SHA),/Invalid/);assert.equal(readLapplandMotionInput(empty,SHA,{allowEmpty:true}).tracks.length,0);
 empty.sourcePackSha256='changed';assert.throws(()=>readLapplandMotionInput(empty,SHA,{allowEmpty:true}),/changed/);r.dispose();
});
