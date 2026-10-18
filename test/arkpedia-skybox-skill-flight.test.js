// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/skybox-fixture.js';
import {SkyboxSkillFlight,SKYBOX_SKILL_FLIGHT_CONTRACT,verifySkyboxSkillFlight} from '../server/sim/content/arkpedia-skybox-skill-flight.js';
import {skyboxNativeInputs,skyboxSourceComponent} from '../server/sim/content/arkpedia-skybox-source.js';
import {commandBlockMode,explicitBlockMode} from '../server/sim/block-mode.js';
import {canTargetAlly,airBlockMode} from '../server/sim/targeting.js';
const fixtures=[];
function make(opts={}){const f=fixture({...opts,defer:true});fixtures.push(f);
 const flight=new SkyboxSkillFlight(f.b,f.u,{contract:SKYBOX_SKILL_FLIGHT_CONTRACT});flight.install();opts.beforeDeploy?.({...f,flight});f.deploy();
 advance(f.b,1.1);return{...f,flight};}
const timers=f=>f.u.buffs.filter(b=>b.data?.skyboxSkillFlight?.owner===f.flight);
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
test('Selected skill-flight source requires exact contract and preserves original temporary immunity and command callbacks',()=>{
 verifySkyboxSkillFlight();const f=fixture({defer:true});assert.throws(()=>new SkyboxSkillFlight(f.b,f.u),/Exact Skybox skill-flight contract/);
 for(const field of['enum','delay','immunity'])assert.throws(()=>verifySkyboxSkillFlight(skyboxNativeInputs(),(group,key,id)=>{
  const p=structuredClone(skyboxSourceComponent(group,key,id));if(id==='5418191453246374310'){
   if(field==='enum')p._runActionOnEvent=4;if(field==='delay')p._buffs[0].lifeTime=.3;if(field==='immunity')p._buffs[0].attributes.abnormalImmunes=[];
  }return p;}),/Changed original/);
 const n=structuredClone(skyboxNativeInputs());n.templates['skybx_s_1[block_walk]'].eventToActions.ON_BUFF_FINISH[2]._blockMode='FLY';
 assert.throws(()=>verifySkyboxSkillFlight(n),/Changed original/);
});
for(const dir of['RIGHT','UP','DOWN','LEFT'])test(`${dir} S1 keeps parent, prefix immunity, WALK/FLY commands and height on distinct original clocks`,()=>{
 const f=make({dir}),ground=enemy(f,{col:5.2}),air=enemy(f,{col:5.3,motion:'FLY'}),parent=f.flight.parent.buff;
 assert.equal(f.b._checkBlock(air),true);assert.equal(canTargetAlly(ground,f.u,true),false);const start=f.b.time;
 assert.equal(f.flight.beginSkillOne(),true);assert.equal(airBlockMode(f.u),true);assert.equal(canTargetAlly(ground,f.u,true),true);
 advance(f.b,.15);assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),.4000000059604645);
 advance(f.b,.04);assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.height.start,start+.2);assert.equal(air.blockedBy,null);
 assert.equal(f.u.findBuff(parent.key),parent);assert.equal(!!f.u.s.flags.groundEvadeImmune,false);assert.equal(canTargetAlly(ground,f.u,true),true);
 advance(f.b,.35);near(f.flight.heightNow(),0);assert.equal(f.b._checkBlock(ground),true);assert.equal(f.b._checkBlock(air),false);
 const ending=f.b.time;assert.equal(f.flight.endSkillOne(),true);advance(f.b,.3);assert.equal(explicitBlockMode(f.u),'WALK');
 advance(f.b,.07);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.height.start,ending+11/30);assert.equal(ground.blockedBy,null);
 assert.equal(canTargetAlly(ground,f.u,true),false);advance(f.b,.55);near(f.flight.heightNow(),.4000000059604645);
 assert.equal(f.flight.finishSkillOne(),true);assert.equal(timers(f).length,0);assert.equal(f.u.findBuff(parent.key),parent);
});
test('S1 skill landing works at E0 and cannot masquerade as S2',()=>{
 const low=make({elite:0});assert.equal(low.flight.beginSkillOne(),true);advance(low.b,.6);near(low.flight.heightNow(),0);
 const s2=make({skill:2});assert.equal(s2.flight.beginSkillOne(),false);assert.equal(timers(s2).length,0);
});
test('An early accepted End finishes pending descent before its independently timed return',()=>{
 const f=make(),start=f.b.time;f.flight.beginSkillOne();advance(f.b,.1);assert.equal(f.flight.endSkillOne(),true);
 assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.height.start,start+.1);assert.equal(timers(f).length,1);
 advance(f.b,1);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);
});
test('Duplicate Begin/End/finish attempts cannot restart or duplicate original transition timers',()=>{
 const f=make();f.flight.beginSkillOne();const timer=[...f.flight.skillTimers.keys()][0];
 assert.equal(f.flight.beginSkillOne(),false);assert.equal(f.flight.finishSkillOne(),false);assert.equal([...f.flight.skillTimers.keys()][0],timer);
 advance(f.b,.3);f.flight.endSkillOne();assert.equal(f.flight.endSkillOne(),false);advance(f.b,.5);assert.equal(f.flight.finishSkillOne(),true);
 assert.equal(f.flight.finishSkillOne(),false);
});
test('Control, hiding, ASPD and slowdown do not strand or rescale accepted original landing/return timers',()=>{
 const f=make();f.flight.beginSkillOne();f.b.addBuff(f.u,{key:'fixture:controls',flags:{stun:true,silence:true,disarm:true},mods:{aspd:300,slowDownMul:.1}});
 f.u.hidden=true;advance(f.b,.6);near(f.flight.heightNow(),0);assert.equal(explicitBlockMode(f.u),'WALK');
 f.flight.endSkillOne();advance(f.b,1);near(f.flight.heightNow(),.4000000059604645);assert.equal(explicitBlockMode(f.u),'FLY');
});
for(const kind of['walk','fly'])test(`Refused ${kind} source timer cannot synthesize its finish actions`,()=>{
 const f=make();const hook=f.b.on('beforeBuff',c=>{if(c.buff.data?.skyboxSkillFlight?.kind===kind)c.cancel=true;});
 f.flight.beginSkillOne();advance(f.b,.6);
 if(kind==='walk'){assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),.4000000059604645);}
 else{f.flight.endSkillOne();advance(f.b,1);assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);}
 f.b.off(hook);assert.equal(timers(f).length,0);
});
for(const kind of['walk','fly'])for(const mutation of['retreat','replacement','finish','transform'])test(`${mutation} during ${kind} admission cannot issue late source commands`,()=>{
 const f=make();if(kind==='fly'){f.flight.beginSkillOne();advance(f.b,.6);}
 f.b.on('beforeBuff',c=>{if(c.buff.data?.skyboxSkillFlight?.kind!==kind)return;
  if(mutation==='retreat')f.b.retreat(f.u);if(mutation==='replacement')f.u.deploySeq++;
  if(mutation==='finish')c.buff.onRemove();if(mutation==='transform')c.buff.data={foreign:true};
 });if(kind==='walk')f.flight.beginSkillOne();else f.flight.endSkillOne();advance(f.b,1);
 assert.equal(timers(f).length,0);
 if(['retreat','replacement'].includes(mutation)){assert.equal(f.flight.stopped,true);assert.equal(explicitBlockMode(f.u),null);}
 else if(kind==='walk'){assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),.4000000059604645);}
 else{assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);}
});
for(const kind of['walk','fly'])test(`External finish of ${kind} dispatches original finish actions once`,()=>{
 const f=make();f.flight.beginSkillOne();if(kind==='fly'){advance(f.b,.6);f.flight.endSkillOne();}
 const p=[...f.flight.skillTimers.keys()][0],mode=kind==='walk'?'WALK':'FLY';f.b.removeBuff(f.u,p.buff);
 assert.equal(explicitBlockMode(f.u),mode);const height=f.flight.height;f.b.removeBuff(f.u,p.buff);assert.equal(f.flight.height,height);
});
test('A refused End timer cannot prematurely finish a still-pending Begin timer',()=>{
 const f=make();f.flight.beginSkillOne();advance(f.b,.1);f.b.on('beforeBuff',c=>{if(c.buff.data?.skyboxSkillFlight?.kind==='fly')c.cancel=true;});
 f.flight.endSkillOne();assert.equal(explicitBlockMode(f.u),null);advance(f.b,.11);assert.equal(explicitBlockMode(f.u),'WALK');
});
for(const reason of['retreat','death','replacement','battleEnd','stop'])test(`${reason} cancels owned timers and clears only current owned mode/presentation`,()=>{
 const f=make();f.flight.beginSkillOne();advance(f.b,.3);f.flight.endSkillOne();
 if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);
 if(reason==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(reason==='stop')f.flight.stop();
 assert.equal(f.flight.stopped,true);assert.equal(timers(f).length,0);assert.equal(f.flight.skillTimers.size,0);assert.equal(f.flight.handles.length,0);
 assert.equal(explicitBlockMode(f.u),null);if(reason==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('Stopping cannot clear a newer foreign command or erase its separate takeoff parent',()=>{
 const f=make();f.flight.beginSkillOne();advance(f.b,.3);const foreign=commandBlockMode(f.b,f.u,'FLY',{});
 const passive=f.b.addBuff(f.u,{key:'fixture:foreign-parent',flags:{liftoff:true,blockFly:true}});f.flight.stop();
 assert.equal(f.u.mem.regularBlockMode,foreign);assert.equal(f.u.findBuff(passive.key),passive);assert.equal(airBlockMode(f.u),true);
});
test('Retirement inside a block-mode notification cannot leave the command created before its callback',()=>{
 const f=make();f.b.on('blockModeChanged',()=>f.b.retreat(f.u));f.flight.beginSkillOne();advance(f.b,.3);
 assert.equal(f.flight.stopped,true);assert.equal(f.u.mem.regularBlockMode,undefined);assert.equal(timers(f).length,0);
});
