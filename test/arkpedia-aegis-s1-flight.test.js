// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/aegis-fixture.js';
import {AegisSkillOneFlight,AEGIS_S1_FLIGHT_CONTRACT,verifyAegisS1Flight} from '../server/sim/content/arkpedia-aegis-s1-flight.js';
import {aegisNativeInputs,aegisSourceComponent} from '../server/sim/content/arkpedia-aegis-source.js';
import {explicitBlockMode,commandBlockMode} from '../server/sim/block-mode.js';
import {canTargetAlly} from '../server/sim/targeting.js';
const fs=[],make=opts=>{const f=fixture({skillFlight:true,...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const start=f=>{assert.equal(f.flight.beginSkillOne(),true);assert.equal(f.flight.completeLanding(),true);};
const end=f=>{start(f);assert.equal(f.flight.endSkillOne(),true);assert.equal(f.flight.mode,3);};
const own=f=>f.u.buffs.filter(x=>x.data?.aegisS1State);
test('Exact selected S1 and original state contract are required',()=>{
 verifyAegisS1Flight();assert.throws(()=>make({skill:2}),/Fresh selected S1/);
 assert.throws(()=>make({flightContract:{...AEGIS_S1_FLIGHT_CONTRACT}}),/exact Aegis state/);
 const f=make();assert.throws(()=>new AegisSkillOneFlight(f.b,f.u,{contract:AEGIS_S1_FLIGHT_CONTRACT}),/Fresh selected/);
});
for(const what of['mode','immune','stats','event','height','stun','resistance','derived','forceTrigger','order','restore'])test(`Changed ${what} cannot retain Aegis S1 state approval`,()=>{
 const n=structuredClone(aegisNativeInputs()),read=(...args)=>structuredClone(aegisSourceComponent(...args));
 const altered=(group,key,id)=>{const v=read(group,key,id);
  if(id==='2358012540008865552'){if(what==='mode')v._buffs[0].blackboard[0].value=2;if(what==='immune')v._buffs[0].attributes.abnormalImmunes=[];if(what==='stats')v._buffs[0].attributes.attributeModifiers[0].formulaItem=0;}
  if(id==='-3543158957696141307'){if(what==='event')v._runActionOnEvent=3;if(what==='height')v._buffs[0].blackboard[1].value=.8;}return v;};
 const h=n.templates.aigis_s1_holder.eventToActions,s=h.ON_BUFF_FINISH[1]._buff;
 if(what==='stun')s.attributes.abnormalImmunes=[];if(what==='resistance')s.statusResistable='NO';if(what==='derived')h.ON_BUFF_FINISH[1]._isDerivedBuff=true;
 if(what==='forceTrigger')n.templates['aigis_s1_takeoff[begin]'].eventToActions.ON_BUFF_START[3]._forceTrigger=false;
 if(what==='order')n.templates['aigis_s1_landing[end]'].eventToActions.ON_BUFF_START.reverse();
 if(what==='restore')n.templates['aigis_s1_takeoff[end]'].eventToActions.ON_BUFF_START[2]._restoreDefault=false;
 assert.throws(()=>verifyAegisS1Flight(n,altered));
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} grants its selected timed ATK/DEF holder, independently of talent`,()=>{
 const f=make({rank}),atk=f.u.s.atk,def=f.u.s.def,account=f.u.skill.activations;assert.equal(f.flight.beginSkillOne(),true);
 near(f.u.s.atk,atk*(1+f.record.bb.atk));near(f.u.s.def,def*(1+f.record.bb.def));near(f.flight.holder.buff.timeLeft,f.record.source.duration);
 assert.equal(f.u.s.flags.groundEvadeImmune,true);assert.equal(f.flight.mode,1);assert.equal(explicitBlockMode(f.u),'FLY');
 assert.equal(f.u.skill.activations,account);assert.equal(f.flight.beginSkillOne(),false);assert.equal(own(f).length,1);
});
test('Landing height, ground evasion and WALK blocking have separate source callbacks',()=>{
 const f=make(),g=enemy(f,{col:5.2});near(f.flight.heightNow(),.4000000059604645);assert.equal(canTargetAlly(g,f.u,true),false);
 assert.ok(f.flight.beginSkillOne());assert.equal(canTargetAlly(g,f.u,true),true);near(f.flight.heightNow(),.4000000059604645);
 assert.equal(f.b._checkBlock(g),false);advance(f.b,.1);near(f.flight.heightNow(),.26666667,1e-6);assert.equal(explicitBlockMode(f.u),'FLY');
 assert.ok(f.flight.completeLanding());near(f.flight.heightNow(),0);assert.equal(explicitBlockMode(f.u),'WALK');assert.ok(f.b._checkBlock(g));
 assert.equal(f.flight.completeLanding(),false);assert.equal(f.u.motion,'GROUND');
});
test('Landing on high terrain never invents ground blocking',()=>{
 const f=make(),i=f.u.tileR*21+f.u.tileC;f.b.grid.tiles[i]={...f.b.grid.tiles[i],height:'HIGH',pass:'FLY',build:'RANGED'};
 start(f);assert.equal(f.b._checkBlock(enemy(f,{col:5.1})),false);
});
test('Self-stun stops actions while its native motion-target-free immunity retains the ground block',()=>{
 const f=make();start(f);const g=enemy(f,{col:5.2});assert.ok(f.b._checkBlock(g));f.flight.endSkillOne();
 assert.equal(f.u.canAct,false);assert.equal(!!f.u.s.flags.noBlock,false);assert.equal(f.u.s.flags.groundEvadeImmune,undefined);
 assert.equal(g.blockedBy?.id,f.u.id);assert.equal(explicitBlockMode(f.u),'WALK');assert.equal(f.flight.holder,null);assert.equal(own(f).length,1);
 near(f.flight.stun.buff.timeLeft,10);assert.equal(f.flight.stun.buff.status,'stun');
 // An independent catalogue stun still supplies noBlock and releases it.
 f.b.applyStatus(f.u,'stun',{key:'foreign:stun',duration:1,source:f.u});assert.equal(g.blockedBy,null);
});
test('Holder expiry creates a non-derived stun that survives independent deployment-parent dispel',()=>{
 const f=make();start(f);advance(f.b,f.record.source.duration+.01);assert.equal(f.flight.mode,3);assert.equal(f.flight.holder,null);assert.ok(f.flight.stun);
 const p=f.flight.stun.buff;f.b.removeBuff(f.u,f.flight.parent.buff);assert.equal(f.u.buffs.includes(p),true);assert.equal(f.u.canAct,false);
 assert.equal(f.flight.beginSkillOne(),false);assert.equal(f.flight.endSkillOne(),false);
});
test('Cleanse executes WALK only; the ability owner separately returns through FLY/tween/mode0',()=>{
 const f=make();end(f);const p=f.flight.stun.buff;f.b.removeBuff(f.u,p);assert.equal(f.flight.stun,null);assert.equal(f.u.canAct,true);
 assert.equal(f.flight.mode,3);assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);
 assert.ok(f.flight.beginTakeoff());assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.flight.mode,3);advance(f.b,.1);near(f.flight.heightNow(),.13333333,1e-6);
 assert.ok(f.flight.completeTakeoff());assert.equal(f.flight.mode,0);near(f.flight.heightNow(),.4000000059604645);assert.equal(f.flight.phase,null);assert.equal(own(f).length,0);
 assert.equal(f.flight.completeTakeoff(),false);assert.ok(f.flight.beginSkillOne());
});
test('An explicitly early takeoff callback preserves FLY then forced-stun WALK ordering',()=>{
 const f=make();end(f);const modes=[];f.b.on('blockModeChanged',c=>{if(c.unit===f.u)modes.push(c.mode);});
 assert.ok(f.flight.beginTakeoff());assert.deepEqual(modes,['FLY','WALK']);assert.equal(explicitBlockMode(f.u),'WALK');
 assert.equal(f.flight.completeTakeoff(),false);assert.equal(f.flight.mode,3);advance(f.b,.4);near(f.flight.heightNow(),.4000000059604645);
 assert.ok(f.u.s.flags.stun);f.b.removeBuff(f.u,f.flight.stun.buff);assert.equal(explicitBlockMode(f.u),'WALK');
 assert.ok(f.flight.completeTakeoff());assert.equal(explicitBlockMode(f.u),'WALK'); // no invented second FLY
});
test('Automatic resistance shortens once; the live slowdown clock remains independent',()=>{
 const f=make();start(f);f.b.applyStatus(f.u,'resist',{duration:30,value:.5,source:f.u});
 f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});f.flight.endSkillOne();near(f.flight.stun.buff.timeLeft,5);
 advance(f.b,4);near(f.flight.stun.buff.timeLeft,3,1e-6);f.b.removeBuff(f.u,'fixture:slow');advance(f.b,3.01);
 assert.equal(f.flight.stun,null);assert.equal(f.flight.mode,3);assert.equal(explicitBlockMode(f.u),'WALK');
});
for(const kind of['cancel','duration','retreat','replacement','immune'])test(`${kind} at self-stun admission cannot fabricate mode3 or a return command`,()=>{
 const f=make();start(f);f.b.on('beforeStatus',c=>{if(c.target!==f.u||c.status!=='stun')return;
  if(kind==='cancel')c.cancel=true;if(kind==='duration')c.duration=0;if(kind==='retreat')f.b.retreat(f.u);if(kind==='replacement')f.u.deploySeq++;
 });if(kind==='immune')f.u.def.immune.add('stun');f.flight.endSkillOne();advance(f.b,.01);
 assert.equal(f.flight.stun,null);assert.equal(f.flight.mode,2);assert.equal(f.flight.beginTakeoff(),false);assert.equal(f.flight.completeTakeoff(),false);
});
test('beforeStatus duration edits are resisted once and reported after accepted admission',()=>{
 const f=make();start(f);const applied=[];f.b.applyStatus(f.u,'resist',{duration:30,value:.5,source:f.u});
 f.b.on('beforeStatus',c=>{if(c.target===f.u&&c.status==='stun')c.duration=4;});f.b.on('statusApplied',c=>{if(c.status==='stun')applied.push(c);});
 f.flight.endSkillOne();near(f.flight.stun.buff.timeLeft,2);assert.equal(applied.length,1);near(applied[0].duration,2);
});
for(const kind of['veto','prefinish','source','data','flag','mods','status','stack','duration'])test(`${kind} while admitting the holder cannot land, buff or self-stun later`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('aigis_s1_holder:'))return;
  if(kind==='veto')c.cancel=true;if(kind==='prefinish')c.buff.onRemove();if(kind==='source')c.buff.source={};if(kind==='data')c.buff.data={};
  if(kind==='flag')c.buff.flags.groundEvadeImmune=false;if(kind==='mods')c.buff.mods.atkPct=99;if(kind==='status')c.buff.status='stun';
  if(kind==='stack')c.buff.stacks=2;if(kind==='duration')c.buff.timeLeft=1;
 });assert.equal(f.flight.beginSkillOne(),false);advance(f.b,31);assert.equal(f.flight.mode,0);assert.equal(own(f).length,0);
 assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.flight.phase,null);assert.equal(f.u.s.atk,f.u.base.atk);
});
for(const key of['landing[begin]','landing[end]','takeoff[begin]','takeoff[end]'])test(`Refused ${key} callback cannot synthesize its native commands`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('aigis_s1_'+key+':'))c.cancel=true;});
 assert.ok(f.flight.beginSkillOne());
 if(key==='landing[begin]'){assert.equal(f.flight.height,null);near(f.flight.heightNow(),.4000000059604645);return;}
 if(key==='landing[end]'){assert.equal(f.flight.completeLanding(),false);assert.equal(f.flight.mode,1);assert.equal(explicitBlockMode(f.u),'FLY');return;}
 assert.ok(f.flight.completeLanding());f.flight.endSkillOne();f.b.removeBuff(f.u,f.flight.stun.buff);
 if(key==='takeoff[begin]'){assert.equal(f.flight.beginTakeoff(),false);assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);return;}
 assert.ok(f.flight.beginTakeoff());assert.equal(f.flight.completeTakeoff(),false);assert.equal(f.flight.mode,3);
});
test('Holder finish inside the WALK callback invalidates the old landing completion',()=>{
 const f=make();assert.ok(f.flight.beginSkillOne());f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode==='WALK'&&f.flight.holder)f.flight.endSkillOne();});
 assert.equal(f.flight.completeLanding(),false);assert.equal(f.flight.mode,3);assert.equal(f.flight.phase.kind,'return');assert.ok(f.flight.stun);
});
for(const stage of['holder','landing','stun','takeoff','finish'])test(`Retirement during ${stage} callback leaves no late state or command`,()=>{
 const f=make();if(stage==='holder'){f.flight.onMode=mode=>{if(mode===1)f.b.retreat(f.u);};f.flight.beginSkillOne();}
 else{start(f);if(stage==='landing'){
   f.flight.endSkillOne();f.b.removeBuff(f.u,f.flight.stun.buff);f.flight.beginTakeoff();f.flight.completeTakeoff();f.flight.beginSkillOne();
   f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode==='WALK')f.b.retreat(f.u);});f.flight.completeLanding();
  }else if(stage==='stun'){f.flight.onMode=mode=>{if(mode===3)f.b.retreat(f.u);};f.flight.endSkillOne();}
  else{f.flight.endSkillOne();f.b.removeBuff(f.u,f.flight.stun.buff);
   if(stage==='takeoff'){f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode==='FLY')f.b.retreat(f.u);});f.flight.beginTakeoff();}
   else{f.flight.beginTakeoff();f.flight.onMode=mode=>{if(mode===0)f.b.retreat(f.u);};f.flight.completeTakeoff();}
  }
 }advance(f.b,40);assert.equal(own(f).length,0);assert.equal(f.flight.grants.size,0);assert.equal(f.flight.handles.length,0);assert.equal(explicitBlockMode(f.u),null);
});
for(const why of['stop','death','retreat','replacement','battleEnd'])test(`${why} cancels held and non-derived stun resources without erasing foreign state`,()=>{
 const f=make();end(f);const foreign=f.b.addBuff(f.u,{key:'foreign:stun',flags:{stun:true},duration:40}),command=commandBlockMode(f.b,f.u,'FLY',{});
 f.u.mem.regularFormVisual={clip:'Idle',heightOffset:.9,playId:'foreign'};
 if(why==='stop')f.flight.stop();if(why==='death')f.b.kill(f.u,null);if(why==='retreat')f.b.retreat(f.u);
 if(why==='replacement'){f.u.deploySeq++;advance(f.b,.01);}if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}
 assert.equal(own(f).length,0);assert.equal(f.flight.grants.size,0);assert.equal(f.flight.handles.length,0);assert.equal(f.flight.phase,null);
 assert.equal(f.u.mem.regularBlockMode,command);assert.equal(f.u.mem.regularFormVisual.playId,'foreign');
 if(why==='stop'||why==='replacement'||why==='battleEnd')assert.ok(f.u.buffs.includes(foreign));
});
