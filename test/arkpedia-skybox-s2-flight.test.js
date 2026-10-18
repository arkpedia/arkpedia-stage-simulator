// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/skybox-fixture.js';
import {SkyboxSkillTwoFlight,SKYBOX_S2_FLIGHT_CONTRACT,verifySkyboxS2Flight} from '../server/sim/content/arkpedia-skybox-s2-flight.js';
import {skyboxNativeInputs,skyboxSourceComponent,SKYBOX_ID} from '../server/sim/content/arkpedia-skybox-source.js';
import {explicitBlockMode,commandBlockMode} from '../server/sim/block-mode.js';
import {canTargetAlly} from '../server/sim/targeting.js';
const fixtures=[];
function make(opts={}){const f=fixture({...opts,skill:2,defer:true});fixtures.push(f);const modes=[],clips=[];
 const flight=new SkyboxSkillTwoFlight(f.b,f.u,{contract:SKYBOX_S2_FLIGHT_CONTRACT,onMode:m=>{modes.push(m);opts.onMode?.(m,f,flight);},onClip:c=>clips.push(c)});
 flight.install();f.deploy();return{...f,flight,modes,clips};}
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const active=f=>{assert.equal(f.flight.begin(),true);until(f,()=>f.flight.mode===2);};
const owned=f=>f.u.buffs.filter(x=>x.data?.skyboxS2Flight);
test('S2 flight requires the selected skill and exact contract; original callback/timer/mode mutations fail closed',()=>{
 verifySkyboxS2Flight();const f=fixture({defer:true});assert.throws(()=>new SkyboxSkillTwoFlight(f.b,f.u,{contract:SKYBOX_S2_FLIGHT_CONTRACT}),/selected S2/);
 for(const mutate of[n=>n.modes[1].attack._preDelay=0,n=>n.templates['skybx_s_2[switch_mode]'].eventToActions.ON_BUFF_FINISH[2]._blockMode='WALK']){
  const n=structuredClone(skyboxNativeInputs());mutate(n);assert.throws(()=>verifySkyboxS2Flight(n),/Changed original/);
 }
 assert.throws(()=>verifySkyboxS2Flight(skyboxNativeInputs(),id=>{const p=structuredClone(skyboxSourceComponent('characters',SKYBOX_ID,id));
  if(id==='1985564271953116431')p._runActionOnEvent=2;return p;}),/Changed original/);
});
for(const dir of['RIGHT','UP'])test(`${dir} retains distinct predelay, original clips, landing completion and immediate combat FLY before graphic return`,()=>{
 const f=make({dir}),g=enemy(f,{col:5.2});const start=f.b.time;assert.equal(f.flight.begin(),true);
 assert.equal(f.flight.mode,1);assert.equal(f.u.s.flags.groundEvadeImmune,true);assert.equal(canTargetAlly(g,f.u,true),true);
 advance(f.b,.1);assert.equal(f.clips.length,0);advance(f.b,1/30);assert.equal(f.clips.length,0);advance(f.b,1/30);assert.deepEqual(f.clips,['Skill_2_Begin']);
 advance(f.b,.15);assert.equal(f.flight.mode,1);assert.equal(explicitBlockMode(f.u),null);
 until(f,()=>f.flight.mode===2);near(f.b.time-start,1+5/30);near(f.flight.heightNow(),0);assert.equal(explicitBlockMode(f.u),'WALK');
 assert.equal(f.flight.modeParent.times,10);assert.equal(f.flight.end(),true);assert.equal(f.flight.mode,3);assert.equal(explicitBlockMode(f.u),'FLY');
 assert.equal(canTargetAlly(g,f.u,true),false);near(f.flight.heightNow(),0);advance(f.b,.25);near(f.flight.heightNow(),0);
 advance(f.b,.1);assert.ok(f.flight.heightNow()>0);until(f,()=>f.flight.mode===0);near(f.flight.heightNow(),.4000000059604645);
 assert.deepEqual(f.modes,[1,2,3,0]);assert.deepEqual(f.clips,['Skill_2_Begin','Skill_2_Idle','Skill_2_End','Idle']);assert.equal(owned(f).length,0);
});
test('Accepted S2 can interrupt Born without a fabricated one-second deployment gate',()=>{
 const f=make();advance(f.b,.04);assert.equal(f.flight.begin(),true);until(f,()=>f.flight.mode===2);near(f.flight.heightNow(),0);
});
for(const at of[.05,.2,.6])test(`Early parent finish at${at} cancels pending Begin and never commands a late WALK`,()=>{
 const f=make();f.flight.begin();advance(f.b,at);f.flight.end();assert.equal(f.flight.mode,3);advance(f.b,1.3);
 assert.deepEqual(f.modes,[1,3,0]);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);assert.equal(owned(f).length,0);
});
test('Control, silence, hiding and stats do not rescale accepted world-clock transitions',()=>{
 const f=make();f.flight.begin();f.u.hidden=true;f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true,silence:true,disarm:true},mods:{aspd:300,slowDownMul:.1}});
 until(f,()=>f.flight.mode===2);near(f.b.time,1+5/30);f.flight.end();until(f,()=>f.flight.mode===0);near(f.flight.heightNow(),.4000000059604645);
});
for(const key of['skybx_s_2[switch_mode]','skybx_height_ctrl[tween]','skybx_height_ctrl[finish]','sky_s2_landing_end[block_walk]'])test(`Refused ${key} cannot synthesize its distinct effect`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith(key+':'))c.cancel=true;});const ok=f.flight.begin();
 if(key==='skybx_s_2[switch_mode]'){assert.equal(ok,false);assert.equal(f.flight.mode,0);assert.equal(owned(f).length,0);return;}
 advance(f.b,1.2);if(key==='skybx_height_ctrl[finish]')assert.equal(f.flight.mode,1);else assert.equal(f.flight.mode,2);
 if(key==='sky_s2_landing_end[block_walk]')assert.equal(explicitBlockMode(f.u),null);
 f.flight.end();advance(f.b,1.2);assert.equal(f.flight.mode,key==='skybx_height_ctrl[finish]'?3:0);
});
for(const mutate of['retreat','replacement','finish','transform'])test(`${mutate} during mode-parent admission leaves no late parent or mode`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('skybx_s_2[switch_mode]:'))return;
  if(mutate==='retreat')f.b.retreat(f.u);if(mutate==='replacement')f.u.deploySeq++;if(mutate==='finish')c.buff.onRemove();if(mutate==='transform')c.buff.data={foreign:true};});
 assert.equal(f.flight.begin(),false);advance(f.b,1.5);assert.equal(f.flight.mode,0);assert.equal(owned(f).length,0);
});
for(const point of['tween','finish'])test(`Retirement during Begin ${point} admission cannot leave source resources`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith(`skybx_height_ctrl[${point}]:`))f.b.retreat(f.u);});
 f.flight.begin();advance(f.b,1.3);assert.equal(f.flight.stopped,true);assert.equal(owned(f).length,0);assert.equal(f.flight.s2Grants.size,0);
});
for(const reason of['retreat','death','replacement','battleEnd','stop'])test(`${reason} drains owned mode, pending callbacks and listeners`,()=>{
 const f=make();active(f);f.flight.end();if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);
 if(reason==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(reason==='stop')f.flight.stop();
 assert.equal(owned(f).length,0);assert.equal(f.flight.s2Grants.size,0);assert.equal(f.flight.handles.length,0);assert.equal(f.flight.modeParent,null);
 if(reason==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('A reentrant close at mode2 cannot issue the obsolete Begin WALK command',()=>{
 const f=make({onMode:(m,f,flight)=>{if(m===2)flight.end();}});f.flight.begin();advance(f.b,2.5);
 assert.deepEqual(f.modes,[1,2,3,0]);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(owned(f).length,0);
});
test('A new foreign command remains owned by its producer after S2 cleanup',()=>{
 const f=make();active(f);const p=commandBlockMode(f.b,f.u,'FLY',{});f.flight.stop();assert.equal(f.u.mem.regularBlockMode,p);
});
test('Mode callbacks changing owner life cannot leave the just-created parent attached',()=>{
 const f=make({onMode:(m,f)=>{if(m===1)f.u.deploySeq++;}});assert.equal(f.flight.begin(),false);assert.equal(owned(f).length,0);advance(f.b,.1);
 assert.equal(f.flight.stopped,true);
});
