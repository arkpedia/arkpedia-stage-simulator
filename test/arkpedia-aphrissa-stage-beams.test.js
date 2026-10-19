// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAphrissaStageBeams} from '../public/arkpedia/aphrissa-stage-beams.js';
import {APHRISSA_BEAM_OWNER as ID,APHRISSA_BEAM_PACK as PACK,APHRISSA_BEAM_CONTRACT as contract,APHRISSA_BEAM_STYLES as styles} from '../shared/arkpedia/aphrissa-beam-presentation.js';
function fixture(create){
 const instances=[],calls=[],track={id:'1:1:beam:attack:1',ownerId:1,ownerLife:1,mode:'normal',root:styles.normal.root,clip:styles.normal.clip.id,
  startedAt:5,clipStartedAt:5,stage:'active',points:[{role:'start',row:2,col:3,unitId:1,life:1,mountType:2},
  {role:'waypoint',row:2,col:5,unitId:2,life:1,mountType:1,fixedHeight:styles.normal.waypointFixedHeight},{role:'end',row:5,col:5}]};
 const library={async inspectLines(root,options){calls.push({root,options});if(create)return create(root,options);
  const i={group:new T.Group(),inspection:{fullEffect:false},shaderGlobals:{_HG_UV_ROTATION:0},updates:[],disposed:0,
   update(time,options){this.updates.push({time,options});},dispose(){this.disposed++;this.group.removeFromParent();}};instances.push(i);return i;}};
 const owner={id:1,def:{charId:ID},side:'ally',alive:true,deployed:true,deploySeq:1,mem:{aphrissaLinePresentation:{snapshot:()=>[structuredClone(track)]}}};
 const relay={id:2,alive:true,deployed:true,deploySeq:1,side:'ally'},battle={time:5,regularReviewCandidates:[ID],units:[owner,relay]};
 const anchorAt=({point})=>[point.col,.4,point.row];
 const pass=createAphrissaStageBeams({three:T,library,sourcePackSha256:PACK,contract,heightAt:()=>.6,anchorAt,shaderGlobals:{_HG_UV_ROTATION:0}});
 const camera=new T.PerspectiveCamera(40,1,.1,100);camera.up.set(0,0,1);camera.position.set(7,-6,8);camera.lookAt(3,2,0);camera.updateMatrixWorld(true);
 const renderer={autoClear:true,render(){}};
 return{pass,track,owner,relay,battle,instances,calls,camera,renderer};
}
test('a captured actual ray creates one original instance per segment, with native waypoint height and stage depth',async()=>{
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();assert.equal(f.pass.instanceCount,2);assert.equal(f.pass.isActor(f.owner),false);
 f.battle.time=5.25;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);
 assert.equal(f.instances[0].updates[0].time,.25);assert.equal(f.instances[0].updates[0].options.clip,styles.normal.clip.id);
 assert.deepEqual(f.calls[0].options.linePositions(),[[3,.4,2],[5,.6+styles.normal.waypointFixedHeight,2]]);
 assert.deepEqual(f.calls[1].options.linePositions(),[[5,.6+styles.normal.waypointFixedHeight,2],[5,.4,5]]);
 const point=new T.Vector3(3,.4,2).project(f.instances[0].updates[0].options.camera),board=new T.Vector3(3,2,.4).project(f.camera);
 assert.ok(point.distanceTo(board)<1e-10);assert.equal(f.renderer.autoClear,true);
 f.pass.render(f.renderer,f.camera);assert.equal(f.instances[0].updates.length,1);
 f.owner.hidden=true;f.pass.update(f.battle);assert.equal(f.pass.instanceCount,0);assert.ok(f.instances.every(i=>i.disposed===1));
 f.pass.dispose();
});
test('S2 path and End clip changes reuse their segment while the combat clock remains paused',async()=>{
 const f=fixture();Object.assign(f.track,{mode:'s2',root:styles.s2.root,clip:styles.s2.clip.id});f.pass.update(f.battle);await f.pass.ready();
 f.track.points[2].row=6;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].options.linePositions()[1][2],6);
 Object.assign(f.track,{stage:'end',clip:styles.s2.end.id,clipStartedAt:5.1});f.battle.time=5.2;
 f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);assert.ok(Math.abs(f.instances[0].updates.at(-1).time-.1)<1e-12);
 assert.equal(f.instances[0].updates.at(-1).options.clip,styles.s2.end.id);assert.equal(f.calls.length,2);f.pass.dispose();
});
test('a late original load cannot resurrect a cleared battle or retired owner',async()=>{
 const waiting=[],f=fixture(()=>new Promise(resolve=>waiting.push(resolve)));
 f.pass.update(f.battle);await Promise.resolve();assert.equal(f.pass.pendingCount,2);f.owner.alive=false;f.pass.update(f.battle);
 const make=()=>({group:new T.Group(),disposed:0,dispose(){this.disposed++;}}),a=make(),b=make();waiting[0](a);waiting[1](b);await f.pass.ready();
 assert.equal(a.disposed,1);assert.equal(b.disposed,1);assert.equal(f.pass.scene.children.length,0);
 assert.equal(f.calls[0].options.linePositions(),null);f.pass.dispose();
});
test('unknown sources and invalid mounts/lives are rejected without silently changing an existing scene',async()=>{
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();
 for(const mutate of [t=>t.mode='__proto__',t=>t.ownerLife=2,t=>t.points[1].life=2,t=>t.points[1].fixedHeight=.5,t=>t.clip='invented']){
  const before=structuredClone(f.track);mutate(f.track);assert.throws(()=>f.pass.update(f.battle));Object.assign(f.track,before);assert.equal(f.pass.instanceCount,2);
 }
 assert.throws(()=>f.pass.update({...f.battle,regularReviewCandidates:[]}),/held Aphrissa battle/);
 f.pass.clear();assert.equal(f.pass.instanceCount,0);f.pass.dispose();assert.throws(()=>f.pass.update(f.battle),/disposed/);
});
test('source load failure and render failure preserve resource and caller ownership',async()=>{
 const failed=fixture(async()=>{throw Error('Original line unavailable');});failed.pass.update(failed.battle);await assert.rejects(failed.pass.ready(),/unavailable/);failed.pass.dispose();
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();f.renderer.autoClear=false;f.renderer.render=()=>{throw Error('GPU failed');};
 assert.throws(()=>f.pass.render(f.renderer,f.camera),/GPU failed/);assert.equal(f.renderer.autoClear,false);f.pass.dispose();
});
