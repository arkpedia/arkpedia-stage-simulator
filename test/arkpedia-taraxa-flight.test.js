// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,advance,near,until} from './helpers/taraxa-fixture.js';
import {TaraxaFlight,TARAXA_FLIGHT_CONTRACT,verifyTaraxaFlight} from '../server/sim/content/arkpedia-taraxa-flight.js';
import {taraxaNativeInputs,taraxaSourceComponent,TARAXA_ID as ID} from '../server/sim/content/arkpedia-taraxa-source.js';
const owned=f=>f.u.buffs.filter(x=>x.data?.taraxaFlight===f.flight);
function make(opts={}){
 const f=fixture({...opts,defer:true}),modes=[];
 const flight=new TaraxaFlight(f.b,f.u,{contract:TARAXA_FLIGHT_CONTRACT,onMode:m=>modes.push(m)});
 flight.install();f.deploy();return{...f,flight,modes};
}
const raised=f=>{assert.equal(f.flight.start(),true);until(f,()=>f.flight.mode===(f.build.skillId.endsWith('1')?2:5));};
test('Flight requires fresh selected source and an explicit transition contract',()=>{
 verifyTaraxaFlight();const f=fixture({defer:true});assert.throws(()=>new TaraxaFlight(f.b,f.u),/exact flight contract/);
 f.deploy();assert.throws(()=>new TaraxaFlight(f.b,f.u,{contract:TARAXA_FLIGHT_CONTRACT}),/Fresh selected/);
});
test('Altered callback enum or destination mode cannot silently retain source approval',()=>{
 assert.throws(()=>verifyTaraxaFlight(taraxaNativeInputs(),id=>{const p=structuredClone(taraxaSourceComponent('characters',ID,id));
  if(id==='2318190540492437692')p._runActionOnEvent=4;return p;}),/Changed original/);
 const n=structuredClone(taraxaNativeInputs());n.templates.taraxa_fly.eventToActions.ON_BUFF_START[0]._durationKey='guessed';
 assert.throws(()=>verifyTaraxaFlight(n),/Changed original/);
});
for(const skill of[1,2])for(const dir of['RIGHT','UP'])test(`S${skill} ${dir} retains separate FLY, attack-marker height and completed mode clocks`,()=>{
 const f=make({skill,dir});assert.equal(f.flight.start(),true);assert.equal(f.u.s.flags.liftoff,true);near(f.flight.heightNow(),0);
 assert.equal(f.flight.mode,skill===1?1:4);assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_Begin`);
 advance(f.b,.3);near(f.flight.heightNow(),0);advance(f.b,1/30);near(f.flight.heightNow(),0);
 advance(f.b,.25);assert.ok(f.flight.heightNow()>0&&f.flight.heightNow()<.4);
 until(f,()=>f.flight.mode===(skill===1?2:5));near(f.flight.heightNow(),.4);assert.equal(f.u.s.flags.liftoff,true);
 assert.equal(f.u.mem.regularFormVisual.clip,skill===1?'Skill_1_Loop':'Skill_2_Idle');
 assert.equal(f.flight.land(),true);assert.equal(f.flight.mode,skill===1?3:6);advance(f.b,.13);near(f.flight.heightNow(),.4);
 advance(f.b,.1);assert.ok(f.flight.heightNow()<.4);assert.equal(f.u.s.flags.liftoff,true);
 until(f,()=>f.flight.mode===0);near(f.flight.heightNow(),0);assert.equal(!!f.u.s.flags.liftoff,false);
 assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.deepEqual(f.modes,skill===1?[1,2,3,0]:[4,5,6,0]);assert.equal(owned(f).length,0);
});
test('Flight immediately participates in its own source-selected Sanctuary and block aura',()=>{
 const f=make();const base=f.u.s.blockCnt;f.flight.start();advance(f.b,1/30);
 near(f.u.s.physTakenMul,.9);near(f.u.s.blockCnt,base+1);f.flight.land();advance(f.b,1.04);
 near(f.u.s.physTakenMul,1);near(f.u.s.blockCnt,base);
});
test('ASPD and slowdown do not rescale the original transition or graphic-height duration',()=>{
 const f=make();f.b.addBuff(f.u,{key:'fixture:speed',mods:{aspd:300,slowDownMul:.1}});f.flight.start();
 advance(f.b,.9);assert.equal(f.flight.mode,1);near(f.flight.heightNow(),.4);advance(f.b,.14);assert.equal(f.flight.mode,2);
});
test('Source control cannot strand the selected world-clock transition',()=>{
 const f=make();f.flight.start();f.b.applyStatus(f.u,'stun',{duration:5});advance(f.b,1.04);
 assert.equal(f.flight.mode,2);assert.equal(f.u.canAct,false);assert.equal(f.u.s.flags.liftoff,true);assert.equal(f.flight.land(),true);
 advance(f.b,1.04);assert.equal(f.flight.mode,0);assert.equal(!!f.u.s.flags.liftoff,false);
});
test('Duplicate starts and lands neither restart the clock nor attach extra flight resources',()=>{
 const f=make();f.flight.start();advance(f.b,.2);assert.equal(f.flight.start(),false);near(f.flight.phase.start,0);assert.equal(owned(f).length,1);
 f.flight.land();const start=f.flight.phase.start;assert.equal(f.flight.land(),false);near(f.flight.phase.start,start);
 advance(f.b,1.1);assert.equal(f.flight.mode,0);assert.equal(owned(f).length,0);
});
test('Skill ending during takeoff cancels its pending rise/completion and finishes original End',()=>{
 const f=make();f.flight.start();advance(f.b,.1);f.flight.land();advance(f.b,1.1);
 assert.equal(f.flight.mode,0);near(f.flight.heightNow(),0);assert.deepEqual(f.modes,[1,3,0]);assert.equal(owned(f).length,0);
});
test('A rejected flight buff cannot invent airborne Sanctuary while the independent rise command still runs',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_fly_mode:'))c.cancel=true;});raised(f);
 assert.equal(!!f.u.s.flags.liftoff,false);near(f.u.s.physTakenMul,1);near(f.flight.heightNow(),.4);assert.equal(owned(f).length,0);
});
test('Rejecting both graphic commands cannot cancel flight or synthesize visible height',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(/^taraxa:(rise|loop):/.test(c.buff.key))c.cancel=true;});raised(f);
 assert.equal(f.u.s.flags.liftoff,true);near(f.flight.heightNow(),0);assert.equal(owned(f).length,1);
});
test('An externally removed flight buff is not recreated by later ticks or height commands',()=>{
 const f=make();f.flight.start();f.b.removeBuff(f.u,f.flight.flight);advance(f.b,1.1);
 assert.equal(!!f.u.s.flags.liftoff,false);assert.equal(owned(f).length,0);near(f.u.s.physTakenMul,1);
});
test('Grounding preserves foreign flight and its ownership',()=>{
 const f=make(),foreign=f.b.addBuff(f.u,{key:'fixture:foreign-flight',flags:{liftoff:true}});raised(f);f.flight.land();advance(f.b,1.04);
 assert.equal(f.u.findBuff(foreign.key),foreign);assert.equal(f.u.s.flags.liftoff,true);assert.equal(owned(f).length,0);
});
for(const when of['flight','rise','lower'])test(`Source retreat in ${when} admission leaves no late owned buff or transition`,()=>{
 const f=make();let once=false;const key=when==='flight'?'taraxa_fly_mode:':`taraxa:${when}:`;
 f.b.on('beforeBuff',c=>{if(!once&&c.buff.key.startsWith(key)){once=true;f.b.retreat(f.u);}});
 if(when==='lower'){raised(f);f.flight.land();}else f.flight.start();advance(f.b,1.1);
 assert.ok(once);assert.equal(f.flight.stopped,true);assert.equal(owned(f).length,0);assert.equal(f.flight.handles.length,0);assert.equal(f.flight.phase,null);
});
test('A replacement source life retains its presentation while the old transition is retired',()=>{
 const f=make();f.flight.start();f.u.deploySeq++;const fresh={clip:'Idle',playId:'replacement'};
 f.u.mem.regularFormVisual=fresh;f.u.mem.regularVisualDirection='UP';advance(f.b,.5);
 assert.equal(f.u.mem.regularFormVisual,fresh);assert.equal(f.u.mem.regularVisualDirection,'UP');assert.equal(owned(f).length,0);
});
for(const reason of['death','retreat','battleEnd','stop'])test(`${reason} clears flight state, pending height and component listeners`,()=>{
 const f=make();raised(f);
 if(reason==='death'){f.u.alive=false;f.b.emit('death',{unit:f.u});}else if(reason==='retreat')f.b.retreat(f.u);
 else if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}else f.flight.stop();
 assert.equal(owned(f).length,0);assert.equal(f.flight.phase,null);assert.equal(f.flight.height,null);assert.equal(f.flight.handles.length,0);
 advance(f.b,.5);assert.equal(owned(f).length,0);assert.throws(()=>f.flight.install(),/cannot be reinstalled/);
});
test('Completed transitions notify once even when a callback reentrantly requests landing',()=>{
 const f=fixture({defer:true});let flight;const modes=[];flight=new TaraxaFlight(f.b,f.u,{contract:TARAXA_FLIGHT_CONTRACT,
  onMode:m=>{modes.push(m);if(m===2)flight.land();}});flight.install();f.deploy();flight.start();advance(f.b,2.1);
 assert.deepEqual(modes,[1,2,3,0]);assert.equal(flight.mode,0);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('Height decoration carries accepted source height across independently chosen attack clips',()=>{
 const f=make();raised(f);const visual=f.flight.decorate({clip:'Skill_2_Loop',loop:false});near(visual.heightOffset,.4);
 assert.equal(visual.clip,'Skill_2_Loop');assert.equal(visual.loop,false);assert.equal(f.u.mem.regularDeathVisual.clip,'Skill_Die');
});

test('The original loop-entry zero-duration height command is independent of rejected rise',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa:rise:'))c.cancel=true;});f.flight.start();advance(f.b,.9);near(f.flight.heightNow(),0);
 until(f,()=>f.flight.mode===2);near(f.flight.heightNow(),.4);assert.equal(owned(f).length,1);
});
