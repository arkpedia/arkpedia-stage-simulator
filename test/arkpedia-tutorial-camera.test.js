// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{Camera}from'../public/js/render/projection.js';import{TutorialCamera}from'../public/arkpedia/tutorial-camera.js';
const base=()=>new Camera({tx:5,ty:4,scale:50,cx:640,cy:350}),focus=(x=3)=>({kind:'cameraFocus',duration:1,scale:'MID',offsetX:x,offsetY:4});
test('source camera completion consumes presentation seconds while preserving baseline optics',async()=>{
 const c=new TutorialCamera(base());let done=false;const p=c.present(focus()).then(()=>done=true);c.advance(.4);await Promise.resolve();assert.equal(done,false);assert.equal(c.projection.tx,4.2);assert.equal(c.projection.scale,50);
 c.advance(.6);await p;assert.equal(done,true);assert.equal(c.projection.tx,3);assert.equal(c.projection.ty,4);assert.equal(c.projection.tilt,c.base.tilt);assert.equal(c.pending,null);
});
test('sequential source focus commands pan from the previous point and reset restores the fitted camera',async()=>{
 const c=new TutorialCamera(base());const first=c.present(focus(7));c.advance(1);await first;const second=c.present(focus(3));c.advance(.5);assert.equal(c.projection.tx,5);c.advance(.5);await second;
 await c.present({kind:'cameraReset'});assert.deepEqual(c.projection.params(),c.base.params());
});
test('resizing keeps the source point and current transition progress while rebasing viewport optics',async()=>{
 const c=new TutorialCamera(base()),p=c.present(focus());c.advance(.5);const b=base();b.tx=6;b.scale=30;b.cx=400;b.update();c.rebase(b);assert.equal(c.projection.tx,4.5);assert.equal(c.projection.scale,30);assert.equal(c.projection.cx,400);
 c.advance(.5);await p;assert.equal(c.projection.tx,3);await c.present({kind:'cameraReset'});assert.deepEqual(c.projection.params(),b.params());
});
test('aborted and superseded presentation work cannot finish another camera transition',async()=>{
 const c=new TutorialCamera(base()),a=new AbortController(),p=c.present(focus(),{signal:a.signal});assert.throws(()=>c.present(focus(7)),/pending/);a.abort();await assert.rejects(p,{name:'AbortError'});assert.deepEqual(c.projection.params(),c.base.params());
 const q=c.present(focus(7));a.abort();c.advance(.5);assert.equal(c.projection.tx,6);c.cancel();await assert.rejects(q,{name:'AbortError'});assert.deepEqual(c.projection.params(),c.base.params());
});
test('unsupported source camera variants and invalid durations fail before opening a transition',async()=>{
 const c=new TutorialCamera(base());for(const bad of [{...focus(),scale:'CLOSE'},{...focus(),duration:-1},{...focus(),offsetX:NaN},{kind:'unknown'}])assert.throws(()=>c.present(bad),/Unsupported/);
 const signal=AbortSignal.abort();await assert.rejects(c.present(focus(),{signal}),{name:'AbortError'});assert.equal(c.pending,null);assert.deepEqual(c.projection.params(),c.base.params());
});
