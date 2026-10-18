// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/aegis-fixture.js';
import {AegisSkillTwoFlight,AEGIS_S2_FLIGHT_CONTRACT,verifyAegisS2Flight} from '../server/sim/content/arkpedia-aegis-s2-flight.js';
import {aegisNativeInputs,aegisSourceComponent} from '../server/sim/content/arkpedia-aegis-source.js';
import {explicitBlockMode,commandBlockMode} from '../server/sim/block-mode.js';import {canTargetAlly} from '../server/sim/targeting.js';
const fs=[],make=opts=>{const f=fixture({skill:2,skillFlight:2,...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const own=f=>f.u.buffs.filter(b=>b.data?.aegisS2Flight),begin=f=>assert.equal(f.flight.beginSkillTwo(),true);
test('Exact fresh selected S2, native command facts and finish callback are required',()=>{
 verifyAegisS2Flight();assert.throws(()=>make({skill:1}),/Fresh selected S2/);assert.throws(()=>make({flightContract:{...AEGIS_S2_FLIGHT_CONTRACT}}),/exact Aegis flight/);
 const f=make();assert.throws(()=>new AegisSkillTwoFlight(f.b,f.u,{contract:AEGIS_S2_FLIGHT_CONTRACT}),/Fresh selected/);
});
for(const what of['parent','immune','height','start','normal','branch','finish','flyEvent','flyHeight'])test(`Changed ${what} rejects original S2 flight approval`,()=>{
 const n=structuredClone(aegisNativeInputs()),read=(...args)=>{const v=structuredClone(aegisSourceComponent(...args));
  if(args[2]==='-3561545585881019870'){if(what==='parent')v._buffs[0].lifeTimeType=1;if(what==='immune')v._buffs[0].attributes.abnormalImmunes=[];if(what==='height')v._buffs[0].blackboard[1].value=.8;}
  if(args[2]==='-1310678009104856542'){if(what==='flyEvent')v._runActionOnEvent=3;if(what==='flyHeight')v._buffs[0].blackboard[0].value=.8;}return v;};
 const t=n.templates.aigis_s2_block_walk.eventToActions;
 if(what==='start')t.ON_BUFF_START[2]._blockMode='FLY';if(what==='normal')t.ON_BUFF_FINISH[1]._finishReason='INTERRUPTED';
 if(what==='branch')t.ON_BUFF_FINISH[2].$type='wrong';if(what==='finish')t.ON_BUFF_FINISH[5]._durationKey='height_duration';
 assert.throws(()=>verifyAegisS2Flight(n,read),/Changed original/);
});
test('WALK, evasion immunity and a graphic lowering tween do not change native motion, tile or owner mode',()=>{
 const f=make(),g=enemy(f,{col:5.2}),air=enemy(f,{col:5.1,motion:'FLY'}),x=f.u.x,y=f.u.y;
 assert.equal(canTargetAlly(g,f.u,true),false);begin(f);assert.equal(f.u.s.flags.groundEvadeImmune,true);assert.equal(canTargetAlly(g,f.u,true),true);
 assert.equal(explicitBlockMode(f.u),'WALK');assert.equal(f.flight.mode,undefined);assert.equal(f.u.motion,'GROUND');assert.deepEqual([f.u.x,f.u.y],[x,y]);
 assert.ok(f.b._checkBlock(g));assert.equal(f.b._checkBlock(air),false);advance(f.b,.1);near(f.flight.heightNow(),.26666667,1e-6);
 advance(f.b,.3);near(f.flight.heightNow(),0);assert.equal(f.flight.beginSkillTwo(),false);assert.equal(own(f).length,1);
});
test('A high tile cannot gain ground blocking from the accepted WALK command',()=>{
 const f=make(),i=f.u.tileR*21+f.u.tileC;f.b.grid.tiles[i]={...f.b.grid.tiles[i],height:'HIGH',pass:'FLY',build:'RANGED'};begin(f);
 assert.equal(f.b._checkBlock(enemy(f,{col:5.1})),false);
});
test('End separately commands FLY/rise while the still-live WALK parent continues suppressing evasion',()=>{
 const done=[],f=make({onFinish:r=>done.push(r)}),g=enemy(f,{col:5.2});begin(f);advance(f.b,.4);assert.ok(f.b._checkBlock(g));
 assert.ok(f.flight.beginEnd());assert.equal(g.blockedBy,null);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.u.s.flags.groundEvadeImmune,true);
 assert.equal(canTargetAlly(g,f.u,true),true);advance(f.b,.1);near(f.flight.heightNow(),.13333333,1e-6);advance(f.b,.3);near(f.flight.heightNow(),.4000000059604645);
 assert.equal(f.flight.beginEnd(),false);assert.deepEqual(done,[]);const command=f.u.mem.regularBlockMode;
 assert.ok(f.flight.finishSkillTwo());assert.deepEqual(done,['NORMAL_EXIT']);assert.equal(f.u.mem.regularBlockMode,command);assert.equal(!!f.u.s.flags.groundEvadeImmune,false);
 assert.equal(canTargetAlly(g,f.u,true),false);assert.equal(f.flight.skillPhase,null);assert.equal(own(f).length,0);
});
test('NORMAL_EXIT without an accepted End grant removes immunity without inventing FLY or a height reset',()=>{
 const f=make();begin(f);advance(f.b,.4);f.flight.finishSkillTwo('NORMAL_EXIT');assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);
});
for(const reason of['INTERRUPTED','DISPELLED','TARGET_LOST'])test(`${reason} parent finish commands FLY and snaps without a normal End tween`,()=>{
 const done=[],f=make({onFinish:r=>done.push(r)});begin(f);advance(f.b,.1);assert.ok(f.flight.finishSkillTwo(reason));
 assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.flight.height,null);near(f.flight.heightNow(),.4000000059604645);assert.deepEqual(done,[reason]);assert.equal(own(f).length,0);
});
test('External parent dispel follows the non-normal finish branch exactly once',()=>{
 const done=[],f=make({onFinish:r=>done.push(r)});begin(f);const p=f.flight.walkParent;f.b.removeBuff(f.u,p.buff);f.b.removeBuff(f.u,p.buff);
 assert.deepEqual(done,['INTERRUPTED']);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);
 assert.equal(f.flight.finishSkillTwo(),false);assert.throws(()=>f.flight.finishSkillTwo('guess'),/Explicit Aegis/);
});
test('A refused End callback cannot synthesize its command through normal parent finish',()=>{
 const f=make();begin(f);advance(f.b,.4);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('aigis_s2_block_fly:'))c.cancel=true;});
 assert.equal(f.flight.beginEnd(),false);assert.equal(f.flight.beginEnd(),false);f.flight.finishSkillTwo();assert.equal(explicitBlockMode(f.u),'WALK');near(f.flight.heightNow(),0);
});
for(const kind of['veto','prefinish','source','data','flag','mods','status','stack','duration','retreat','replacement'])test(`${kind} parent admission cannot issue late WALK or lowering`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('aigis_s2_block_walk:'))return;
  if(kind==='veto')c.cancel=true;if(kind==='prefinish')c.buff.onRemove();if(kind==='source')c.buff.source={};if(kind==='data')c.buff.data={};
  if(kind==='flag')c.buff.flags.groundEvadeImmune=false;if(kind==='mods')c.buff.mods={atkPct:9};if(kind==='status')c.buff.status='stun';
  if(kind==='stack')c.buff.stacks=2;if(kind==='duration')c.buff.timeLeft=1;if(kind==='retreat')f.b.retreat(f.u);if(kind==='replacement')f.u.deploySeq++;
 });assert.equal(f.flight.beginSkillTwo(),false);advance(f.b,.1);assert.equal(own(f).length,0);assert.equal(f.flight.skillPhase,null);
 if(kind!=='retreat'&&kind!=='replacement'){assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);}
});
test('Foreign same-key parent collision is preserved without adopting its mode, lifetime or identity',()=>{
 const f=make();let foreign,once=false;f.b.on('beforeBuff',c=>{if(once||!c.buff.key.startsWith('aigis_s2_block_walk:'))return;once=true;
  foreign=f.b.addBuff(f.u,{key:c.buff.key,source:{},duration:5,data:{foreign:true}});});assert.equal(f.flight.beginSkillTwo(),false);
 assert.equal(f.u.findBuff(foreign.key),foreign);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(own(f).length,0);
});
test('Dispel inside accepted WALK invalidates the remaining phase without undoing the native interrupt return',()=>{
 const done=[],f=make({onFinish:r=>done.push(r)});f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode==='WALK'&&f.flight.walkParent)f.b.removeBuff(f.u,f.flight.walkParent.buff);});
 assert.equal(f.flight.beginSkillTwo(),false);assert.deepEqual(done,['INTERRUPTED']);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);
});
test('Dispel inside End FLY cannot leave an orphaned command grant or late graphic tween',()=>{
 const f=make();begin(f);f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode==='FLY'&&f.flight.walkParent)f.b.removeBuff(f.u,f.flight.walkParent.buff);});
 assert.equal(f.flight.beginEnd(),false);assert.equal(f.flight.grants.size,0);assert.equal(own(f).length,0);assert.equal(f.flight.height,null);near(f.flight.heightNow(),.4000000059604645);
});
for(const stage of['walk','abort','end'])test(`Owner replacement during ${stage} command cannot issue later height or finish callbacks`,()=>{
 const done=[],f=make({onFinish:r=>done.push(r)});if(stage!=='walk'){begin(f);advance(f.b,.4);}
 f.b.on('blockModeChanged',c=>{if(c.unit===f.u&&c.mode===(stage==='walk'?'WALK':'FLY')){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}});
 if(stage==='walk')f.flight.beginSkillTwo();if(stage==='abort')f.flight.finishSkillTwo('INTERRUPTED');if(stage==='end')f.flight.beginEnd();advance(f.b,.1);
 assert.equal(f.flight.stopped,true);assert.equal(f.flight.grants.size,0);assert.deepEqual(done,[]);assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('A finish callback can start a new owned parent without the old finish overwriting its WALK/height',()=>{
 const f=make();let once=false;f.flight.onFinish=()=>{if(!once){once=true;assert.ok(f.flight.beginSkillTwo());}};begin(f);advance(f.b,.4);f.flight.finishSkillTwo('INTERRUPTED');
 assert.equal(once,true);assert.equal(explicitBlockMode(f.u),'WALK');assert.equal(own(f).length,1);assert.ok(f.flight.walkParent);assert.ok(f.flight.skillPhase);
});
for(const why of['stop','retreat','death','replacement','battleEnd'])test(`${why} drains owned S2 states while preserving newer foreign command/presentation`,()=>{
 const done=[],f=make({onFinish:r=>done.push(r)});begin(f);const foreign=commandBlockMode(f.b,f.u,'FLY',{});f.u.mem.regularFormVisual={clip:'Idle',heightOffset:.9,playId:'foreign'};
 if(why==='stop')f.flight.stop();if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);if(why==='replacement'){f.u.deploySeq++;advance(f.b,.1);}
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}assert.equal(own(f).length,0);assert.equal(f.flight.grants.size,0);assert.equal(f.flight.handles.length,0);
 assert.equal(f.u.mem.regularBlockMode,foreign);assert.equal(f.u.mem.regularFormVisual.playId,'foreign');assert.deepEqual(done,[]);
});
