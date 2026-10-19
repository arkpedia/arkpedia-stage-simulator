// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAphrissaStateMounts,APHRISSA_STATE_MOUNTS as source} from '../public/arkpedia/aphrissa-state-mounts.js';
import {APHRISSA_STATE_CONTRACT as contract,APHRISSA_STATE_STYLES as styles} from '../shared/arkpedia/aphrissa-state-presentation.js';
const ID='char_4229_aphris';
test('literal source special points retain each front/back follower and its own skeleton binding',()=>{
 assert.equal(source.front.specialPoint0.bone,'F_Chest');assert.equal(source.back.specialPoint0.bone,'B_Chest3');
 assert.equal(source.front.specialPoint1.bone,'C_Drone_B2');assert.equal(source.back.specialPoint1.bone,'C_Drone_B2');
 assert.notEqual(source.front.specialPoint1.transform,source.back.specialPoint1.transform);
 assert.notEqual(source.front.specialPoint0.skeleton.sha256,source.back.specialPoint0.skeleton.sha256);
});
function fixture(){
 const owner={id:1,def:{charId:ID},deploySeq:3,alive:true,deployed:true,x:4,y:3,mem:{}},battle={time:1,units:[owner]},
  loaded={entry:{},skeleton:{}},bone={worldX:30,worldY:-40,active:true},spine={spineData:loaded.skeleton,
   skeleton:{data:loaded.skeleton,findBone:name=>['F_Chest','B_Chest3','C_Drone_B2'].includes(name)?bone:null},toGlobal:p=>({x:420+p.x,y:200+p.y})},
  actor={entry:loaded.entry,spine},view={unit:owner,life:3,key:`operator/${ID}/default/front`,actor},camera=new T.PerspectiveCamera(40,844/390,.1,100);
 camera.up.set(0,0,1);camera.position.set(6,-8,10);camera.lookAt(4,3,0);camera.updateMatrixWorld(true);
 const renderer={views:new Map([[1,view]]),preloaded:new Map(['front','back'].map(f=>[`operator/${ID}/default/${f}`,loaded])),camera,
  three:{getSize:out=>out.set(844,390)},heightAt:()=>.6},state={id:'wing:1',kind:'wing',root:styles.wing.root,ownerId:1,ownerLife:3,activation:1,startedAt:0};
 let policy='specialPoint0';const pass=createAphrissaStateMounts({three:T,renderer,contract,anchorFor:()=>policy,
  orientationAt:()=>({rotation:[0,0,0,1],scale:[1,1,1]})});
 return{owner,battle,view,loaded,bone,renderer,state,pass,frame:()=>pass.stateFrameAt({state,owner,battle}),policy:p=>policy=p};
}
test('actual rendered face chooses the original wing root and source chest bone without advancing the clock',()=>{
 const f=fixture(),front=f.frame();assert.equal(front.root,styles.wing.root);let [receipt]=f.pass.inspect();assert.equal(receipt.source.bone,'F_Chest');
 const pixel=new T.Vector3(front.position[0],front.position[2],front.position[1]).project(f.renderer.camera);
 assert.ok(Math.abs((pixel.x+1)*422-450)<1e-8);assert.ok(Math.abs((1-pixel.y)*195-160)<1e-8);
 f.view.key=`operator/${ID}/default/back`;const rear=f.frame();assert.equal(rear.root,styles.wing.back);[receipt]=f.pass.inspect();assert.equal(receipt.source.bone,'B_Chest3');
 assert.equal(receipt.time,1);f.policy('specialPoint1');f.frame();assert.equal(f.pass.inspect()[0].source.bone,'C_Drone_B2');
 f.policy('actorFoot');assert.deepEqual(f.frame().position,[4,.6,3]);f.pass.dispose();assert.throws(()=>f.frame(),/disposed/);
});
test('stale life, loaded actor, missing bone and unknown policies reject rather than inventing a mount',()=>{
 for(const change of [f=>f.owner.deploySeq++,f=>f.view.life++,f=>f.view.actor.entry={},f=>f.owner.hidden=true,
  f=>f.bone.active=false,f=>f.policy('invented'),f=>f.view.key='foreign',f=>f.loaded.skeleton={},f=>f.owner.removed=true]){
  const f=fixture();f.frame();change(f);assert.throws(()=>f.frame());f.pass.dispose();
 }
});
