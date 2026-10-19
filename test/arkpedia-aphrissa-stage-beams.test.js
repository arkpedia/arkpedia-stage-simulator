// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAphrissaStageBeams} from '../public/arkpedia/aphrissa-stage-beams.js';
import {APHRISSA_BEAM_OWNER as ID,APHRISSA_BEAM_PACK as PACK,APHRISSA_BEAM_CONTRACT as contract,APHRISSA_BEAM_STYLES as styles} from '../shared/arkpedia/aphrissa-beam-presentation.js';
function fixture(create,pointFrameAt=({position})=>({position,rotation:[0,0,0,1],scale:[1,1,1]}),hitFrameAt,stateFrameAt){
 const instances=[],calls=[],track={id:'1:1:beam:attack:1',ownerId:1,ownerLife:1,mode:'normal',root:styles.normal.root,clip:styles.normal.clip.id,
  startedAt:5,clipStartedAt:5,stage:'active',points:[{role:'start',row:2,col:3,unitId:1,life:1,mountType:2},
  {role:'waypoint',row:2,col:5,unitId:2,life:1,mountType:1,fixedHeight:styles.normal.waypointFixedHeight},{role:'end',row:5,col:5}]};
 const library={async create(root,options){calls.push({root,options});if(create)return create(root,options);
  const i={group:new T.Group(),inspection:null,blocked:[],shaderGlobals:{_HG_UV_ROTATION:0},updates:[],disposed:0,
   update(time,options){this.updates.push({time,options});},dispose(){this.disposed++;this.group.removeFromParent();}};instances.push(i);return i;}};
 const owner={id:1,def:{charId:ID},side:'ally',alive:true,deployed:true,deploySeq:1,mem:{aphrissaLinePresentation:{snapshot:()=>[structuredClone(track)]}}};
 const relay={id:2,alive:true,deployed:true,deploySeq:1,side:'ally'},battle={time:5,regularReviewCandidates:[ID],units:[owner,relay]};
 const anchorAt=({point})=>[point.col,.4,point.row];
 const pass=createAphrissaStageBeams({three:T,library,sourcePackSha256:PACK,contract,heightAt:()=>.6,anchorAt,pointFrameAt,hitFrameAt,stateFrameAt,shaderGlobals:{_HG_UV_ROTATION:0}});
 const camera=new T.PerspectiveCamera(40,1,.1,100);camera.up.set(0,0,1);camera.position.set(7,-6,8);camera.lookAt(3,2,0);camera.updateMatrixWorld(true);
 const renderer={autoClear:true,render(){}};
 return{pass,track,owner,relay,battle,instances,calls,camera,renderer};
}
test('a captured actual ray creates one original instance per segment, with native waypoint height and stage depth',async()=>{
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();assert.equal(f.pass.instanceCount,5);assert.equal(f.pass.isActor(f.owner),false);
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
 f.track.points[2].row=6;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);assert.equal(f.calls.length,5);
 assert.equal(f.calls[1].options.linePositions()[1][2],6);
 Object.assign(f.track,{stage:'end',clip:styles.s2.end.id,clipStartedAt:5.1});f.battle.time=5.2;
 f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);assert.ok(Math.abs(f.instances[0].updates.at(-1).time-.1)<1e-12);
 assert.equal(f.instances[0].updates.at(-1).options.clip,styles.s2.end.id);assert.equal(f.calls.length,5);
 for(const entry of f.pass.inspect().filter(e=>e.kind==='point')){
  assert.ok(Math.abs(entry.time-.2)<1e-12);assert.ok(Math.abs(entry.clip.time-.1)<1e-12);
  assert.equal(entry.clip.clip,styles.s2.points[entry.point.role].end.id);
 }
 f.pass.dispose();
});
test('a late original load cannot resurrect a cleared battle or retired owner',async()=>{
 const waiting=[],f=fixture(()=>new Promise(resolve=>waiting.push(resolve)));
 f.pass.update(f.battle);await Promise.resolve();assert.equal(f.pass.pendingCount,5);f.owner.alive=false;f.pass.update(f.battle);
 const instances=waiting.map(resolve=>{const i={group:new T.Group(),disposed:0,dispose(){this.disposed++;}};resolve(i);return i;});await f.pass.ready();
 assert.ok(instances.every(i=>i.disposed===1));assert.equal(f.pass.scene.children.length,0);
 assert.equal(f.calls[0].options.linePositions(),null);f.pass.dispose();
});
test('unknown sources and invalid mounts/lives are rejected without silently changing an existing scene',async()=>{
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();
 for(const mutate of [t=>t.mode='__proto__',t=>t.ownerLife=2,t=>t.points[1].life=2,t=>t.points[1].fixedHeight=.5,t=>t.clip='invented']){
  const before=structuredClone(f.track);mutate(f.track);assert.throws(()=>f.pass.update(f.battle));Object.assign(f.track,before);assert.equal(f.pass.instanceCount,5);
 }
 assert.throws(()=>f.pass.update({...f.battle,regularReviewCandidates:[]}),/held Aphrissa battle/);
 f.pass.clear();assert.equal(f.pass.instanceCount,0);f.pass.dispose();assert.throws(()=>f.pass.update(f.battle),/disposed/);
});
test('a newly introduced S2 relay receives its own point clock while existing endpoint particles retain theirs',async()=>{
 const f=fixture();Object.assign(f.track,{mode:'s2',root:styles.s2.root,clip:styles.s2.clip.id});
 const waypoint=f.track.points.splice(1,1)[0];f.pass.update(f.battle);await f.pass.ready();f.battle.time=6;f.pass.update(f.battle);
 const before=f.pass.inspect().find(e=>e.point?.role==='end'),endpoint=before.instance;
 f.track.points.splice(1,0,waypoint);f.pass.update(f.battle);await f.pass.ready();f.pass.render(f.renderer,f.camera);
 const views=f.pass.inspect(),added=views.find(e=>e.point?.role==='waypoint'),end=views.find(e=>e.point?.role==='end');
 assert.equal(added.time,0);assert.equal(added.bornAt,6);assert.equal(end.instance===endpoint,true);assert.equal(end.bornAt,5);assert.equal(end.time,1);
 const start=views.find(e=>e.point?.role==='start'),updates=start.instance.updates.length;
 f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);assert.equal(start.instance.updates.length,updates);
 // Same path index with a new deployment life must get a fresh effect.
 f.relay.deploySeq=2;f.track.points[1].life=2;f.battle.time=6.2;f.pass.update(f.battle);await f.pass.ready();
 const replacement=f.pass.inspect().find(e=>e.point?.role==='waypoint');assert.equal(added.instance.disposed,1);assert.equal(replacement.time,0);
 f.pass.dispose();
});
test('source load failure and render failure preserve resource and caller ownership',async()=>{
 const failed=fixture(async()=>{throw Error('Original line unavailable');});failed.pass.update(failed.battle);await assert.rejects(failed.pass.ready(),/unavailable/);failed.pass.dispose();
 const f=fixture();f.pass.update(f.battle);await f.pass.ready();f.renderer.autoClear=false;f.renderer.render=()=>{throw Error('GPU failed');};
 assert.throws(()=>f.pass.render(f.renderer,f.camera),/GPU failed/);assert.equal(f.renderer.autoClear,false);f.pass.dispose();
});
test('invalid point frames cannot partially replace a previously rendered scene',async()=>{
 let invalid=null;const f=fixture(null,({position})=>({position,rotation:[0,0,0,1],scale:[1,1,1],...invalid}));
 f.pass.update(f.battle);await f.pass.ready();f.pass.render(f.renderer,f.camera);
 const before=f.pass.inspect().map(e=>e.instance);
 for(const value of [{position:[999,0,0]},{rotation:[0,0,0,0]},{scale:[1,NaN,1]},{position:Array(3)}]){
  invalid=value;assert.throws(()=>f.pass.update(f.battle));assert.ok(before.every((i,n)=>f.pass.inspect()[n].instance===i&&i.disposed===0));
 }
 invalid=null;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);f.pass.dispose();
});
test('partial prefabs, blocked source components and changed shader globals never enter the battle scene',async()=>{
 for(const invalid of [{inspection:{fullEffect:false}},{blocked:['original helper']},{blocked:null},{shaderGlobals:{_HG_UV_ROTATION:1}}]){
  const instances=[],f=fixture(async()=>{
   const instance={group:new T.Group(),inspection:null,blocked:[],shaderGlobals:{_HG_UV_ROTATION:0},disposed:0,
    dispose(){this.disposed++;}};Object.assign(instance,invalid);instances.push(instance);return instance;
  });
  f.pass.update(f.battle);await assert.rejects(f.pass.ready(),/Unreviewed Aphrissa beam renderer/);
  assert.equal(f.pass.scene.children.length,0);assert.equal(f.pass.instanceCount,0);assert.ok(instances.every(i=>i.disposed===1));f.pass.dispose();
 }
});
function hitFixture(create,frame=({hit})=>({position:[hit.x,.4,hit.y],rotation:[0,0,0,1],scale:[1,1,1]})){
 const f=fixture(create,undefined,frame);f.hit={id:'1:1:hit:normal:2:enemy:1',ownerId:1,ownerLife:1,targetId:'enemy',targetLife:1,
  mode:'normal',attackId:2,root:'aphris_attack_01_hit_01',startedAt:4.8,x:3.2,y:2.1,row:2,col:3};
 f.owner.mem.aphrissaHitPresentation={snapshot:()=>[structuredClone(f.hit)]};return f;
}
test('a complete hit prefab retains its receipt clock and target position independently from the ray and camera',async()=>{
 const f=hitFixture();f.pass.update(f.battle);await f.pass.ready();f.pass.render(f.renderer,f.camera);
 let hit=f.pass.inspect().find(e=>e.kind==='hit');const instance=hit.instance;
 assert.ok(Math.abs(hit.time-.2)<1e-12);assert.equal(hit.bornAt,4.8);assert.deepEqual(hit.placement.position,[3.2,.4,2.1]);
 assert.equal(hit.clip.clip,null);assert.equal(f.calls.filter(c=>c.root===f.hit.root).length,1);
 f.camera.aspect=2;f.camera.updateProjectionMatrix();f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);
 hit=f.pass.inspect().find(e=>e.kind==='hit');assert.equal(hit.instance,instance);assert.ok(Math.abs(hit.time-.2)<1e-12);
 f.battle.time=6;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);
 assert.equal(f.pass.inspect().find(e=>e.kind==='hit').instance,instance);assert.deepEqual(f.pass.inspect().find(e=>e.kind==='hit').placement.position,[3.2,.4,2.1]);
 f.owner.mem.aphrissaHitPresentation.snapshot=()=>[];f.pass.update(f.battle);assert.equal(instance.disposed,1);assert.equal(f.pass.inspect().some(e=>e.kind==='hit'),false);f.pass.dispose();
});
test('invalid hit identities and caller mounts cannot partially mutate an existing scene',async()=>{
 let bad=false;const f=hitFixture(null,({hit})=>({position:[hit.x,.4,hit.y],rotation:bad?[0,0,0,0]:[0,0,0,1],scale:[1,1,1]}));
 f.pass.update(f.battle);await f.pass.ready();const before=f.pass.inspect().map(e=>e.instance);
 for(const edit of [h=>h.root='invented',h=>h.ownerLife=2,h=>h.startedAt=6,h=>h.x=NaN,h=>h.targetLife=0]){
  const copy=structuredClone(f.hit);edit(f.hit);assert.throws(()=>f.pass.update(f.battle));f.hit=copy;
  assert.ok(f.pass.inspect().every((e,i)=>e.instance===before[i]&&!e.instance.disposed));
 }
 bad=true;assert.throws(()=>f.pass.update(f.battle));assert.ok(f.pass.inspect().every((e,i)=>e.instance===before[i]));f.pass.dispose();
});
test('late hit loads cannot resurrect effects after source owner retirement',async()=>{
 const waiting=[],f=hitFixture(()=>new Promise(resolve=>waiting.push(resolve)));f.pass.update(f.battle);await Promise.resolve();
 assert.equal(f.pass.pendingCount,6);f.owner.alive=false;f.pass.update(f.battle);
 const items=waiting.map(resolve=>{const i={group:new T.Group(),disposed:0,dispose(){this.disposed++;}};resolve(i);return i;});
 await f.pass.ready();assert.ok(items.every(i=>i.disposed===1));assert.equal(f.pass.scene.children.length,0);f.pass.dispose();
});
test('front/back state prefabs preserve their parent birth and placement history while composing both source wing clips',async()=>{
 const {APHRISSA_STATE_STYLES:styles}=await import('../shared/arkpedia/aphrissa-state-presentation.js');let back=false;
 const f=fixture(null,undefined,undefined,({state,owner})=>({root:back?styles.wing.back:styles.wing.root,
  position:[owner.x??3,.4,2],rotation:[0,0,0,1],scale:[1,1,1]})),s={id:'state:wing:1',kind:'wing',root:styles.wing.root,ownerId:1,ownerLife:1,activation:1,startedAt:4};
 f.owner.mem.aphrissaStatePresentation={snapshot:()=>[structuredClone(s)]};f.pass.update(f.battle);await f.pass.ready();f.pass.render(f.renderer,f.camera);
 const front=f.pass.inspect().find(e=>e.kind==='state');assert.equal(front.time,1);assert.equal(front.bornAt,4);
 assert.deepEqual(front.clip.clip,styles.wing.clips);assert.equal(front.instance.updates.at(-1).options.timeline,null);
 f.battle.time=5.2;f.owner.x=3.5;f.pass.update(f.battle);f.pass.render(f.renderer,f.camera);
 back=true;f.pass.update(f.battle);await f.pass.ready();f.pass.render(f.renderer,f.camera);
 const rear=f.pass.inspect().find(e=>e.kind==='state');assert.equal(front.instance.disposed,1);assert.notEqual(rear.instance,front.instance);
 assert.equal(rear.root,styles.wing.back);assert.equal(rear.bornAt,4);assert.equal(rear.time,f.battle.time-4);
 const placement=rear.instance.updates.at(-1).options.placement;assert.equal(placement.sample(0).position[0],3);assert.equal(placement.sample(f.battle.time-4).position[0],3.5);
 assert.deepEqual(rear.clip.clip,styles.wing.clips);f.pass.dispose();
});
test('state mounts require an explicitly bound face prefab before mutating the scene',async()=>{
 let root='foreign';const f=fixture(null,undefined,undefined,()=>({root,position:[3,.4,2],rotation:[0,0,0,1],scale:[1,1,1]}));
 f.owner.mem.aphrissaStatePresentation={snapshot:()=>[{id:'state:s1',kind:'s1',root:'aphris_skill_01_buff_01',ownerId:1,ownerLife:1,activation:1,startedAt:4}]};
 for(const invalid of ['foreign',undefined,null]){root=invalid;assert.throws(()=>f.pass.update(f.battle),/face prefab/);assert.equal(f.pass.scene.children.length,0);}
 root='aphris_skill_01_buff_01';f.pass.update(f.battle);await f.pass.ready();const state=f.pass.inspect().find(e=>e.kind==='state');assert.equal(state.time,1);
 f.owner.mem.aphrissaStatePresentation.snapshot=()=>[];f.pass.update(f.battle);assert.equal(state.instance.disposed,1);f.pass.dispose();
});
