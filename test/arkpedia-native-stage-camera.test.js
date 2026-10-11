// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {fitCamera,syncThreeCamera} from '../public/js/render/projection.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const [width,height]of [[1280,800],[390,844],[844,390]])test(`native source projection/depth exactly matches the off-axis stage camera at ${width}x${height}`,()=>{
 const p=fitCamera({r0:0,r1:7,c0:0,c1:12},{width,height,padding:{top:60,bottom:145,left:8,right:8}},{tilt:28,dist:20,headroom:1,margin:.2});
 const stage=new T.PerspectiveCamera();syncThreeCamera(p,stage,width,height);const bridge=createNativeStageCamera(T),source=bridge.sync(stage);
 assert.ok(source.matrixWorld.determinant()<0);assert.equal(source.isPerspectiveCamera,true);
 for(let row=0;row<8;row++)for(let col=0;col<13;col++)for(const z of [0,.38,1.25]){
  const a=new T.Vector3(col,row,z).project(stage),b=new T.Vector3(col,z,row).project(source);a.toArray().forEach((v,n)=>near(v,b.getComponent(n)));
 }
 assert.deepEqual(source.position.toArray(),[stage.position.x,stage.position.z,stage.position.y]);
 source.updateMatrixWorld(true);assert.deepEqual(source.matrixWorldInverse.elements,new T.Matrix4().copy(source.matrixWorld).invert().elements);
});
test('reflected view basis preserves board-facing quad axes and texture orientation without quaternion decomposition',()=>{
 const stage=new T.PerspectiveCamera(40,1.5,.1,100);stage.up.set(0,0,1);stage.position.set(6,-8,13);stage.lookAt(6,4,0);stage.updateMatrixWorld(true);
 const source=createNativeStageCamera(T).sync(stage),swap=new T.Matrix4().set(1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1),spin=new T.Matrix4().makeRotationZ(.7);
 const boardQuad=stage.matrixWorld.clone().setPosition(6,4,1).multiply(spin).scale(new T.Vector3(.7,.5,1));
 const sourceQuad=source.matrixWorld.clone().setPosition(6,1,4).multiply(spin).scale(new T.Vector3(.7,.5,1));
 new T.Matrix4().multiplyMatrices(swap,sourceQuad).elements.forEach((v,n)=>near(v,boardQuad.elements[n]));
 for(const p of [[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]]){
  const a=new T.Vector3(...p).applyMatrix4(boardQuad).project(stage),b=new T.Vector3(...p).applyMatrix4(sourceQuad).project(source);a.toArray().forEach((v,n)=>near(v,b.getComponent(n)));
 }
});
test('orthographic projection is retained and invalid cameras cannot replace the last valid bridge',()=>{
 const c=new T.OrthographicCamera(-6,6,4,-4,.1,50);c.up.set(0,0,1);c.position.set(6,-3,10);c.lookAt(6,3,0);c.updateMatrixWorld(true);
 const bridge=createNativeStageCamera(T),source=bridge.sync(c),before=source.matrixWorld.elements.slice();assert.equal(source.isOrthographicCamera,true);assert.equal(source.isPerspectiveCamera,false);
 const a=new T.Vector3(3,2,.7).project(c),b=new T.Vector3(3,.7,2).project(source);a.toArray().forEach((v,n)=>near(v,b.getComponent(n)));
 assert.throws(()=>bridge.sync(null),/require a stage camera/);c.projectionMatrix.elements[0]=NaN;assert.throws(()=>bridge.sync(c),/Invalid/);assert.deepEqual(source.matrixWorld.elements,before);
});
