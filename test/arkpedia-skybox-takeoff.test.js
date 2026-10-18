// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/skybox-fixture.js';
import {SkyboxTakeoff,SKYBOX_TAKEOFF_CONTRACT,verifySkyboxTakeoff} from '../server/sim/content/arkpedia-skybox-takeoff.js';
import {skyboxNativeInputs} from '../server/sim/content/arkpedia-skybox-source.js';
import {canTargetAlly,areaSelectable} from '../server/sim/targeting.js';
const fixtures=[];
function make(opts={}){const f=fixture({...opts,defer:true});fixtures.push(f);
 const takeoff=new SkyboxTakeoff(f.b,f.u,{contract:SKYBOX_TAKEOFF_CONTRACT});takeoff.install();
 opts.beforeDeploy?.({...f,takeoff});f.deploy();return{...f,takeoff};}
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const owned=f=>f.u.buffs.filter(b=>b.data?.skyboxTakeoff?.owner===f.takeoff);
test('Takeoff binds original passive and delay/height clocks and requires a fresh selected source',()=>{
 assert.deepEqual(verifySkyboxTakeoff(),{delay:0.20000000298023224,height_offset:0.4000000059604645,height_duration:0.800000011920929});
 const f=fixture({defer:true});assert.throws(()=>new SkyboxTakeoff(f.b,f.u),/exact takeoff contract/);f.deploy();
 assert.throws(()=>new SkyboxTakeoff(f.b,f.u,{contract:SKYBOX_TAKEOFF_CONTRACT}),/Fresh selected/);
});
for(const field of['block','height','delay','derived','motion','tile'])test(`Changed ${field} source cannot silently retain deployment approval`,()=>{
 const n=structuredClone(skyboxNativeInputs());
 if(field==='block')n.templates.skybx_t_0.eventToActions.ON_BUFF_START[0]._blockMode='WALK';
 if(field==='height')n.takeoff._buffs[0].blackboard[0].value=.5;
 if(field==='delay')n.templates.skybx_t_0.eventToActions.ON_OWNER_BORN[0]._buff.lifeTime=.3;
 if(field==='derived')n.templates.skybx_t_0.eventToActions.ON_OWNER_BORN[0]._isDerivedBuff=false;
 if(field==='motion')n.root._motionMode=1;
 if(field==='tile')n.root._buildCondition.buildableType=1;
 assert.throws(()=>verifySkyboxTakeoff(n),/Changed original/);
});
for(const skill of[1,2])for(const dir of['RIGHT','UP'])test(`S${skill} ${dir} air blocking precedes its separately delayed graphic rise`,()=>{
 const f=make({skill,dir});assert.equal(f.u.s.flags.liftoff,true);assert.equal(f.u.s.flags.blockFly,true);assert.equal(f.u.isFlying,false);
 assert.equal(f.u.def.position,'RANGED');near(f.takeoff.heightNow(),0);assert.equal(owned(f).length,2);
 advance(f.b,.18);near(f.takeoff.heightNow(),0);advance(f.b,.13);assert.ok(f.takeoff.heightNow()>0&&f.takeoff.heightNow()<.4);
 advance(f.b,1);near(f.takeoff.heightNow(),.4000000059604645);assert.equal(f.takeoff.timer,null);assert.equal(owned(f).length,1);
 assert.equal(f.u.mem.regularFormVisual.clip,undefined);const v=f.takeoff.decorate({clip:'Attack',loop:false});
 assert.equal(v.clip,'Attack');near(v.height.to,.4000000059604645);
});
test('Air blocking works from a high impassable tile while ground enemies pass and cannot select the owner',()=>{
 const f=make(),u=f.u;
 // Use the actual tile-index slot rather than changing unit motion/position.
 const i=u.tileR*21+u.tileC;f.b.grid.tiles[i]={...f.b.grid.tiles[i],height:'HIGH',pass:'FLY',build:'RANGED'};
 const ground=enemy(f,{row:5,col:5.2}),air=enemy(f,{row:5,col:5.8,motion:'FLY'});
 assert.equal(f.b._checkBlock(ground),false);assert.equal(f.b._checkBlock(air),true);assert.equal(air.blockedBy.id,u.id);
 assert.equal(canTargetAlly(ground,u,true),false);assert.equal(areaSelectable(ground,u),false);
 assert.equal(canTargetAlly(air,u,true),true);assert.equal(areaSelectable(air,u),true);assert.equal(u.motion,'GROUND');
});
test('The original one-block capacity and 0.8944 air radius remain in force',()=>{
 const f=make(),far=enemy(f,{row:5,col:5.9,motion:'FLY'}),one=enemy(f,{row:5,col:5.8,motion:'FLY'}),two=enemy(f,{row:5,col:5.1,motion:'FLY'});
 assert.equal(f.b._checkBlock(far),false);assert.equal(f.b._checkBlock(one),true);assert.equal(f.b._checkBlock(two),false);
 f.b._unblock(one);assert.equal(f.b._checkBlock(two),true);
});
test('Silence, control, ASPD, slowdown and source hiding do not rescale or cancel the accepted world-clock rise',()=>{
 const f=make();f.b.addBuff(f.u,{key:'fixture:controls',flags:{silence:true,stun:true,disarm:true},mods:{aspd:300,slowDownMul:.1}});
 f.u.hidden=true;advance(f.b,1.2);near(f.takeoff.heightNow(),.4000000059604645);assert.equal(f.u.s.flags.liftoff,true);
});
for(const kind of['parent','height'])test(`A refused ${kind} cannot synthesize a late owned resource`,()=>{
 const f=make({beforeDeploy:({b})=>b.on('beforeBuff',c=>{if(c.buff.key.startsWith(kind==='parent'?'skybx_t_0:':'skybx_t_0[height]:'))c.cancel=true;})});
 advance(f.b,1.2);near(f.takeoff.heightNow(),0);assert.equal(owned(f).length,kind==='parent'?0:1);
 assert.equal(!!f.u.s.flags.liftoff,kind!=='parent');
});
for(const kind of['parent','height'])test(`An externally removed ${kind} does not masquerade as natural height-timer completion`,()=>{
 const f=make();f.b.removeBuff(f.u,f.takeoff[kind==='height'?'timer':'parent'].buff);advance(f.b,1.2);
 near(f.takeoff.heightNow(),0);assert.equal(owned(f).length,kind==='parent'?0:1);
});
test('An already released graphic rise remains independent of later parent removal',()=>{
 const f=make();advance(f.b,.35);assert.ok(f.takeoff.heightNow()>0);f.b.removeBuff(f.u,f.takeoff.parent.buff);
 advance(f.b,1);near(f.takeoff.heightNow(),.4000000059604645);assert.equal(!!f.u.s.flags.liftoff,false);assert.equal(owned(f).length,0);
});
for(const boundary of['parent','height'])for(const mutation of['retreat','replace','finish','transform'])test(`${mutation} during ${boundary} admission leaves no late takeoff grant`,()=>{
 const f=make({beforeDeploy:({b,u})=>b.on('beforeBuff',c=>{
  if(!c.buff.key.startsWith(boundary==='parent'?'skybx_t_0:':'skybx_t_0[height]:'))return;
  if(mutation==='retreat')b.retreat(u);if(mutation==='replace')u.deploySeq++;
  if(mutation==='finish')c.buff.onRemove();if(mutation==='transform')c.buff.data={foreign:true};
 })});advance(f.b,1.2);near(f.takeoff.heightNow(),0);
 assert.equal(owned(f).length,boundary==='height'&&['finish','transform'].includes(mutation)?1:0);
});
for(const reason of['retreat','death','battleEnd','stop'])test(`${reason} cancels pending commands, owned state and listeners without touching foreign flight`,()=>{
 const f=make(),foreign=f.b.addBuff(f.u,{key:'fixture:foreign-flight',flags:{liftoff:true,blockFly:true}});
 if(reason==='retreat')f.b.retreat(f.u);if(reason==='death'){f.u.alive=false;f.b.emit('death',{unit:f.u});}
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(reason==='stop')f.takeoff.stop();
 assert.equal(owned(f).length,0);assert.equal(f.takeoff.handles.length,0);assert.equal(f.takeoff.timer,null);near(f.takeoff.heightNow(),0);
 if(['battleEnd','stop'].includes(reason))assert.equal(f.u.findBuff(foreign.key),foreign);
 assert.throws(()=>f.takeoff.install(),/cannot be reinstalled/);
});
test('A replacement life keeps its own visual and the old source cannot restart',()=>{
 const f=make();advance(f.b,.4);f.u.deploySeq++;const fresh={clip:'Idle',heightOffset:.9,playId:'replacement'};f.u.mem.regularFormVisual=fresh;
 advance(f.b,.2);assert.equal(f.u.mem.regularFormVisual,fresh);assert.equal(owned(f).length,0);assert.equal(f.takeoff.stopped,true);
});
test('Stopping a live takeoff removes only its height decoration and preserves the current attack clip',()=>{
 const f=make();advance(f.b,.4);f.u.mem.regularFormVisual=f.takeoff.decorate({clip:'Attack',playId:'released',loop:false});
 f.takeoff.stop();assert.deepEqual(f.u.mem.regularFormVisual,{clip:'Attack',playId:'released',loop:false});
});

test('Duplicate deployment notifications and explicit starts do not recreate a removed original passive',()=>{
 const f=make();f.b.removeBuff(f.u,f.takeoff.parent.buff);f.takeoff.start();f.b.emit('deploy',{unit:f.u,move:true});advance(f.b,1.2);
 assert.equal(owned(f).length,0);near(f.takeoff.heightNow(),0);
});
test('Natural parent expiry cancels its derived timer without issuing a rise',()=>{
 const f=make();f.takeoff.parent.buff.timeLeft=.05;advance(f.b,1.2);assert.equal(owned(f).length,0);near(f.takeoff.heightNow(),0);
});
test('Foreign same-key parent or timer collisions retain their lifetime and never become owned',()=>{
 for(const kind of['parent','height']){
  let foreign,once=false;const f=make({beforeDeploy:({b,u})=>b.on('beforeBuff',c=>{
   if(once||!c.buff.key.startsWith(kind==='parent'?'skybx_t_0:':'skybx_t_0[height]:'))return;
   once=true;foreign=b.addBuff(u,{key:c.buff.key,duration:5,source:{},data:{foreign:true}});
  })});advance(f.b,1.2);assert.ok(once);assert.equal(f.u.findBuff(foreign.key),foreign);assert.ok(foreign.timeLeft>3);
  near(f.takeoff.heightNow(),0);assert.equal(owned(f).length,kind==='parent'?0:1);
 }
});
test('Stopping never strips a foreign visual with coincidentally matching height values',()=>{
 const f=make();advance(f.b,.4);const foreign={clip:'Idle',height:{...f.takeoff.height}};f.u.mem.regularFormVisual=foreign;
 f.takeoff.stop();assert.equal(f.u.mem.regularFormVisual,foreign);
});
