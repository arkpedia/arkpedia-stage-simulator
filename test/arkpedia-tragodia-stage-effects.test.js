// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTragodiaStageEffects,TRAGODIA_CAGE_ACTOR as ID} from '../public/arkpedia/tragodia-stage-effects.js';
import {EffectOnlyActor} from '../public/arkpedia/effect-only-actor.js';
const PACK='e39769c56a91f5d483632808082a05a3dbe0b71d5a5c99b3ade9ebdee68fd0ff';
const ROOT='phatm2_skill_03_prison_01',CLIP='battle/prefabs/effects/phatm2.ab:7379801640911501129';
function fixture({create}={}){
  const calls=[],instances=[];
  const library={async create(root){calls.push(root);if(create)return create(root);
    const i={group:new T.Group(),updates:[],disposed:0,
      update(time,options){this.updates.push({time,options});},
      dispose(){this.disposed++;this.group.removeFromParent();}};instances.push(i);return i;}};
  const pass=createTragodiaStageEffects({three:T,library,sourcePackSha256:PACK,heightAt:(row,col)=>row===2&&col===3?.6:0});
  const unit={defId:ID,side:'ally',alive:true,deployed:true,deploySeq:1,deployedAt:5,x:3,y:2,mem:{regularNativeEffect:ROOT}};
  const battle={time:5,units:[unit]},camera=new T.PerspectiveCamera(40,1,.1,100);
  camera.up.set(0,0,1);camera.position.set(7,-6,8);camera.lookAt(3,2,0);camera.updateMatrixWorld(true);
  const renderer={autoClear:true,calls:[],render(scene,cam){this.calls.push({scene,cam,autoClear:this.autoClear});}};
  return{pass,unit,battle,camera,renderer,calls,instances};
}
test('original cage life controls the source effect clock, tile height and camera depth',async()=>{
  const f=fixture();f.pass.update(f.battle);await f.pass.ready();
  assert.deepEqual(f.calls,[ROOT]);assert.equal(f.pass.instanceCount,1);assert.equal(f.pass.isActor(f.unit),true);
  f.battle.time=17.5;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);
  const update=f.instances[0].updates.at(-1);
  assert.equal(update.time,12.5);assert.equal(update.options.clip,CLIP);
  assert.deepEqual(update.options.trajectory.sample(0),[3,.6,2]);
  assert.deepEqual(update.options.trajectory.sample(120),[3,.6,2]);
  const board=new T.Vector3(3,2,.6).project(f.camera),native=new T.Vector3(3,.6,2).project(update.options.camera);
  assert.ok(board.distanceTo(native)<1e-10);assert.equal(f.renderer.autoClear,true);
  assert.equal(f.renderer.calls[0].autoClear,false);
  // Rendering while paused must not advance particle time or respawn an instance.
  f.pass.render(f.renderer,f.camera);assert.equal(f.instances[0].updates.at(-1).time,12.5);assert.equal(f.calls.length,1);
  assert.equal(f.instances[0].updates.length,1);
  f.camera.aspect=2;f.camera.updateProjectionMatrix();f.pass.render(f.renderer,f.camera);
  assert.equal(f.instances[0].updates.length,2);
  f.pass.dispose();assert.equal(f.instances[0].disposed,1);assert.equal(f.pass.scene.children.length,0);
});
test('death, hidden scene clearing and battle replacement retire only their owned instances',async()=>{
  const f=fixture();f.pass.update(f.battle);await f.pass.ready();f.unit.alive=false;f.pass.update(f.battle);
  assert.equal(f.instances[0].disposed,1);assert.equal(f.pass.instanceCount,0);
  f.unit.alive=true;f.pass.update(f.battle);await f.pass.ready();
  const old=f.instances[1];f.pass.update({...f.battle,units:[]});assert.equal(old.disposed,1);
  f.pass.update(f.battle);await f.pass.ready();f.pass.update(null);
  assert.equal(f.instances[2].disposed,1);assert.equal(f.pass.instanceCount,0);f.pass.dispose();
});
test('a recycled token object receives a new effect and deployment-relative clock',async()=>{
  const f=fixture();f.pass.update(f.battle);await f.pass.ready();
  Object.assign(f.unit,{deploySeq:2,deployedAt:25});f.battle.time=26;f.pass.update(f.battle);await f.pass.ready();
  assert.equal(f.instances[0].disposed,1);assert.equal(f.pass.instanceCount,1);
  f.pass.render(f.renderer,f.camera);assert.equal(f.instances[1].updates[0].time,1);f.pass.dispose();
});
test('late native loads cannot resurrect a retired life or replaced battle',async()=>{
  let finish;const loaded={group:new T.Group(),disposed:0,dispose(){this.disposed++;this.group.removeFromParent();}};
  const f=fixture({create:()=>new Promise(resolve=>{finish=resolve;})});
  f.pass.update(f.battle);await Promise.resolve();assert.equal(f.pass.pendingCount,1);
  f.pass.update({time:0,units:[]});finish(loaded);await f.pass.ready();
  assert.equal(loaded.disposed,1);assert.equal(f.pass.scene.children.length,0);assert.equal(f.pass.instanceCount,0);f.pass.dispose();
});
test('a changed token life rejects a late load even when the unit object is reused',async()=>{
  const deferred=[];const f=fixture({create:()=>new Promise(resolve=>deferred.push(resolve))});
  f.pass.update(f.battle);await Promise.resolve();f.unit.deploySeq++;f.pass.update(f.battle);await Promise.resolve();
  const i=()=>({group:new T.Group(),disposed:0,dispose(){this.disposed++;}}),old=i(),next=i();
  deferred[0](old);deferred[1](next);await f.pass.ready();
  assert.equal(old.disposed,1);assert.equal(next.disposed,0);assert.equal(f.pass.instanceCount,1);f.pass.dispose();assert.equal(next.disposed,1);
});
test('source loading failures propagate and disposal remains idempotent',async()=>{
  const f=fixture({create:async()=>{throw Error('Pinned asset missing');}});f.pass.update(f.battle);
  await assert.rejects(f.pass.ready(),/Pinned asset missing/);
  assert.throws(()=>f.pass.render(f.renderer,f.camera),/Pinned asset missing/);
  f.pass.clear();f.pass.dispose();f.pass.dispose();assert.throws(()=>f.pass.update(f.battle),/disposed/);
});
test('unknown roots, invalid life clocks and moving stationary cages are rejected',async()=>{
  const f=fixture();
  assert.equal(f.pass.isActor({defId:'other'}),false);
  f.unit.mem.regularNativeEffect='different-effect';assert.throws(()=>f.pass.update(f.battle),/Unreviewed/);
  f.unit.mem.regularNativeEffect=ROOT;
  for(const change of [{deploySeq:0},{deployedAt:6},{deployedAt:NaN},{side:'enemy'},{x:3.5}]){
    const old={...f.unit};Object.assign(f.unit,change);assert.throws(()=>f.pass.update(f.battle),/token life/);Object.assign(f.unit,old);
  }
  assert.throws(()=>f.pass.update({time:NaN,units:[]}),/clock/);
  f.pass.update(f.battle);await f.pass.ready();f.unit.x=4;assert.throws(()=>f.pass.update(f.battle),/Stationary cage moved/);f.pass.dispose();
});
test('original coordinate transforms and caller clearing state survive render errors',async()=>{
  const f=fixture();f.pass.update(f.battle);await f.pass.ready();
  f.renderer.autoClear=false;f.renderer.render=()=>{throw Error('GPU failure');};
  assert.throws(()=>f.pass.render(f.renderer,f.camera),/GPU failure/);assert.equal(f.renderer.autoClear,false);
  assert.deepEqual(f.instances[0].group.matrix.elements,new T.Matrix4().elements);f.pass.dispose();
});
test('effect-only HUD anchor creates no stand-in sprite or geometry',()=>{
  class Container {children=[];destroy(){this.destroyed=true;}}
  const actor=new EffectOnlyActor({Container},{gaugeHeight:280});
  assert.deepEqual(actor.spine.children,[]);assert.equal(actor.gaugeHeight,280);
  for(const method of ['deploy','die','setBase','setSkill','setRegularSkin','setRegularVisual','update'])actor[method]();
  actor.destroy();assert.equal(actor.spine.destroyed,true);
  assert.throws(()=>new EffectOnlyActor({Container},{gaugeHeight:NaN}),/gauge height/);
});
test('presentation requires the exact reviewed source pack',()=>{
  assert.throws(()=>createTragodiaStageEffects({three:T,library:{create(){}},sourcePackSha256:'0'.repeat(64),heightAt:()=>0}),/original inputs/);
});
