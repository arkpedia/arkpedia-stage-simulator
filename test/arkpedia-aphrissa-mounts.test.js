// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import metadata from '../data/arkpedia-aphrissa-mounts.json' with {type:'json'};
import {recoverAphrissaMounts} from '../tools/arkpedia/aphrissa-mount-source.mjs';
import {actorBoneAnchor} from '../shared/arkpedia/actor-bone-anchor.js';
import {createAphrissaActorMounts} from '../public/arkpedia/aphrissa-actor-mounts.js';
import {APHRISSA_BEAM_CONTRACT as contract,APHRISSA_BEAM_OWNER as ID} from '../shared/arkpedia/aphrissa-beam-presentation.js';
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${v} != ${b[i]}`));};
function camera(width,height,ortho=false){
 const c=ortho?new T.OrthographicCamera(-5,5,5*height/width,-5*height/width,.01,100):new T.PerspectiveCamera(40,width/height,.01,100);
 c.up.set(0,0,1);c.position.set(6,-8,10);c.lookAt(4,3,0);c.setViewOffset(width,height,.08*width,-.04*height,width,height);c.updateMatrixWorld(true);return c;
}
test('mount metadata reproduces original muzzle pointers, follower flags and full-width skeleton identities',async()=>{
 // Compare the exported JSON representation (JSON canonicalizes signed zero).
 assert.deepEqual(JSON.parse(JSON.stringify(await recoverAphrissaMounts())),metadata);assert.equal(Object.keys(metadata.bindings).length,2);
 assert.equal(metadata.bindings[`operator/${ID}/default/front`].bone,'F_Muzzle');assert.equal(metadata.bindings[`operator/${ID}/default/back`].bone,'B_Muzzle');
 for(const b of Object.values(metadata.bindings)){
  assert.equal(b.follower.data.skeletonRenderer.m_PathID,b.skeletonAnimation);assert.equal(b.ancestors[0].pathId,b.transform);
  assert.equal(b.ancestors.at(-1).data.m_Father.m_PathID,'0');assert.equal(b.follower.data.followSkeletonFlip,1);
 }
 assert.deepEqual(metadata.scope.enabledOperators,[]);assert.equal(metadata.scope.nativeMountTypeMappingVerified,false);
 await assert.rejects(recoverAphrissaMounts({read:async p=>String(p).includes('native-operators')?Buffer.from('{}'):readFile(p)}));
});
test('rendered bones project back to their exact CSS pixel at fixed actor depth through camera changes, mirroring and both camera types',()=>{
 for(const [width,height]of [[1280,800],[844,390],[390,844]])for(const ortho of [false,true])for(const flip of [-1,1]){
  const c=camera(width,height,ortho),base=[4,3,.6],anchor=new T.Vector3(...base).project(c),origin=[(anchor.x+1)*width/2,(1-anchor.y)*height/2],bone={worldX:30,worldY:-40,active:true};let calls=0;
  const spine={skeleton:{findBone:name=>name==='source'?bone:null},toGlobal:p=>{calls++;return{x:origin[0]+flip*.7*p.x+.1*p.y,y:origin[1]+.2*p.x+.8*p.y};}},
   sample=actorBoneAnchor({three:T,spine,boneName:'source',boardPosition:base,camera:c,width,height}),
   board=new T.Vector3(sample.position[0],sample.position[2],sample.position[1]),projected=board.clone().project(c),pixel=[(projected.x+1)*width/2,(1-projected.y)*height/2];
  near(pixel,[origin[0]+flip*21-4,origin[1]+6-32]);near(sample.pixel,pixel);assert.equal(calls,1);
  near([board.clone().sub(new T.Vector3(...base)).dot(c.getWorldDirection(new T.Vector3()))],[0]);
  bone.worldX+=20;const moved=actorBoneAnchor({three:T,spine,boneName:'source',boardPosition:base,camera:c,width,height});
  near([moved.pixel[0]-sample.pixel[0]],[flip*14]);assert.ok(new T.Vector3(...moved.position).distanceTo(new T.Vector3(...sample.position))>.01);
 }
});
function fixture(){
 const width=844,height=390,c=camera(width,height),owner={id:1,def:{charId:ID},deploySeq:3,alive:true,deployed:true,x:4,y:3,mem:{}},battle={time:1,units:[owner]},
  loaded={entry:{},skeleton:{}},bone={worldX:30,worldY:-40,active:true},spine={spineData:loaded.skeleton,skeleton:{data:loaded.skeleton,findBone:name=>['F_Muzzle','B_Muzzle'].includes(name)?bone:null},toGlobal:p=>({x:420+p.x*.5,y:190+p.y*.5})},
  front=`operator/${ID}/default/front`,back=`operator/${ID}/default/back`,view={key:front,unit:owner,life:3,actor:{entry:loaded.entry,spine}},renderer={views:new Map([[1,view]]),preloaded:new Map([[front,loaded],[back,loaded]]),camera:c,three:{getSize:v=>v.set(width,height)},heightAt:()=>.6},
  mounts=createAphrissaActorMounts({three:T,renderer,contract,endAt:()=>[8,.7,2],orientationAt:()=>({rotation:[0,0,0,1],scale:[1,1,1]})}),
  context={point:{role:'start',unitId:1,life:3},track:{ownerId:1,ownerLife:3},owner,battle};
 return{mounts,context,owner,battle,view,renderer,spine,bone,loaded,front,back};
}
test('actual loaded facing chooses the source bone; stale lives, actors and missing bones cannot use a tile-centre fallback',()=>{
 const f=fixture();f.mounts.anchorAt(f.context);assert.equal(f.mounts.inspect()[0].bone,'F_Muzzle');
 f.view.key=f.back;assert.deepEqual(f.mounts.inspect(),[]);f.mounts.anchorAt(f.context);assert.equal(f.mounts.inspect()[0].bone,'B_Muzzle');
 // Force-front presentation chooses Front even if deployed direction is UP.
 f.owner.dir='UP';f.view.key=f.front;f.mounts.anchorAt(f.context);assert.equal(f.mounts.inspect()[0].bone,'F_Muzzle');
 for(const mutate of [()=>f.view.life=2,()=>f.view.unit={},()=>f.view.actor.entry={},()=>f.spine.spineData={},()=>f.bone.active=false,
  ()=>f.renderer.preloaded.delete(f.front),()=>f.owner.hidden=true]){
  const state={life:f.view.life,unit:f.view.unit,entry:f.view.actor.entry,data:f.spine.spineData,active:f.bone.active,hidden:f.owner.hidden};
  mutate();assert.throws(()=>f.mounts.anchorAt(f.context));Object.assign(f.view,{life:state.life,unit:state.unit});f.view.actor.entry=state.entry;f.spine.spineData=state.data;
  f.bone.active=state.active;f.owner.hidden=state.hidden;f.renderer.preloaded.set(f.front,f.loaded);
 }
 assert.deepEqual(f.mounts.anchorAt({...f.context,point:{role:'end'}}),[8,.7,2]);
 assert.deepEqual(f.mounts.pointFrameAt({position:[1,2,3]}),{position:[1,2,3],rotation:[0,0,0,1],scale:[1,1,1]});
 f.battle.time+=.1;assert.deepEqual(f.mounts.inspect(),[]);f.mounts.anchorAt(f.context);assert.equal(f.mounts.inspect().length,1);
 f.owner.alive=false;assert.deepEqual(f.mounts.inspect(),[]);f.mounts.dispose();assert.throws(()=>f.mounts.anchorAt(f.context),/disposed/);
});
test('nonfinite bones, projections and behind-camera actors fail explicitly',()=>{
 const c=camera(800,600),base={three:T,spine:{skeleton:{findBone:()=>({worldX:0,worldY:0})},toGlobal:()=>({x:400,y:300})},boneName:'source',boardPosition:[4,3,0],camera:c,width:800,height:600};
 for(const change of [{width:0},{height:Infinity},{boardPosition:Array(3)},{boneName:'',},
  {spine:{skeleton:{findBone:()=>null},toGlobal:()=>({x:0,y:0})}},
  {spine:{skeleton:{findBone:()=>({worldX:NaN,worldY:0})},toGlobal:()=>({x:0,y:0})}},
  {spine:{skeleton:{findBone:()=>({worldX:0,worldY:0})},toGlobal:()=>({x:Infinity,y:0})}},
  {boardPosition:c.position.clone().sub(c.getWorldDirection(new T.Vector3())).toArray()}])assert.throws(()=>actorBoneAnchor({...base,...change}));
});
