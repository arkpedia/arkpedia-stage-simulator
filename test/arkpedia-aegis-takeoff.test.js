// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/aegis-fixture.js';
import {AegisTakeoff,AEGIS_TAKEOFF_CONTRACT,verifyAegisTakeoff} from '../server/sim/content/arkpedia-aegis-takeoff.js';
import {aegisNativeInputs} from '../server/sim/content/arkpedia-aegis-source.js';
import {explicitBlockMode,commandBlockMode} from '../server/sim/block-mode.js';
import {canTargetAlly,areaSelectable} from '../server/sim/targeting.js';
const fs=[];const make=opts=>{const f=fixture({talent:false,...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const owned=f=>f.u.buffs.filter(x=>x.data?.aegisTakeoff);
test('Deployment uses the original direct height/default-zero duration and exact selected contract',()=>{
 assert.deepEqual(verifyAegisTakeoff(),{heightOffset:.4000000059604645,heightDuration:0});assert.throws(()=>make({flightContract:{...AEGIS_TAKEOFF_CONTRACT}}),/exact takeoff/);
 const f=make();assert.throws(()=>new AegisTakeoff(f.b,f.u,{contract:AEGIS_TAKEOFF_CONTRACT}),/Fresh selected/);
});
for(const key of['height','duration','block','event','motion','tile'])test(`Changed ${key} source cannot retain original deployment approval`,()=>{
 const n=structuredClone(aegisNativeInputs());if(key==='height')n.takeoff._buffs[0].blackboard[0].value=.5;
 if(key==='duration')n.templates.aigis_tr.eventToActions.ON_OWNER_BORN[0]._duration=.8;
 if(key==='block')n.templates.aigis_tr.eventToActions.ON_BUFF_START[0]._blockMode='WALK';
 if(key==='event')n.templates.aigis_tr.eventToActions.ON_OWNER_BORN.push({});if(key==='motion')n.root._motionMode=1;if(key==='tile')n.root._buildCondition.buildableType=1;
 assert.throws(()=>verifyAegisTakeoff(n),/Changed original/);
});
for(const skill of[1,2])for(const dir of['RIGHT','UP'])test(`S${skill} ${dir} commands FLY and snaps height without a Skybox-style timer or flying motion`,()=>{
 const f=make({skill,dir});assert.equal(f.u.s.flags.liftoff,true);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.u.motion,'GROUND');assert.equal(f.u.isFlying,false);
 near(f.flight.heightNow(),.4000000059604645);assert.equal(f.flight.height,null);assert.equal(owned(f).length,1);advance(f.b,.1);near(f.flight.heightNow(),.4000000059604645);
 const v=f.flight.decorate({clip:'Attack',playId:'fixture'});assert.equal(v.clip,'Attack');near(v.heightOffset,.4000000059604645);
});
test('Original one-unit air blocking works on high terrain while ground enemies pass and cannot select the parent',()=>{
 const f=make(),i=f.u.tileR*21+f.u.tileC;f.b.grid.tiles[i]={...f.b.grid.tiles[i],height:'HIGH',pass:'FLY',build:'RANGED'};
 const g=enemy(f,{col:5.2}),a=enemy(f,{col:5.8,motion:'FLY'}),far=enemy(f,{col:5.9,motion:'FLY'}),second=enemy(f,{col:5.1,motion:'FLY'});
 assert.equal(f.b._checkBlock(g),false);assert.equal(f.b._checkBlock(far),false);assert.equal(f.b._checkBlock(a),true);assert.equal(f.b._checkBlock(second),false);
 assert.equal(canTargetAlly(g,f.u,true),false);assert.equal(areaSelectable(g,f.u),false);assert.equal(canTargetAlly(a,f.u,true),true);assert.equal(areaSelectable(a,f.u),true);
});
test('Parent dispel removes evasion but cannot undo already issued FLY and graphic commands',()=>{
 const f=make(),g=enemy(f);f.b.removeBuff(f.u,f.flight.parent.buff);assert.equal(!!f.u.s.flags.liftoff,false);assert.equal(explicitBlockMode(f.u),'FLY');
 near(f.flight.heightNow(),.4000000059604645);assert.equal(canTargetAlly(g,f.u,true),true);f.flight.start();advance(f.b,1);assert.equal(owned(f).length,0);
});
test('Control, silence, hiding and stats cannot fabricate a delayed deployment animation clock',()=>{
 const f=make();f.u.hidden=true;f.b.addBuff(f.u,{key:'fixture:control',flags:{silence:true,stun:true,disarm:true},mods:{aspd:300,slowDownMul:.1}});
 advance(f.b,1);near(f.flight.heightNow(),.4000000059604645);assert.equal(f.flight.height,null);assert.equal(explicitBlockMode(f.u),'FLY');
});
for(const kind of['veto','retreat','replace','finish','data','source','flag','mods','status','stack','duration'])test(`${kind} during passive admission cannot issue late commands or height`,()=>{
 const f=make({beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('aigis_tr:'))return;
  if(kind==='veto')c.cancel=true;if(kind==='retreat')b.retreat(u);if(kind==='replace')u.deploySeq++;if(kind==='finish')c.buff.onRemove();
  if(kind==='data')c.buff.data={foreign:true};if(kind==='source')c.buff.source={};if(kind==='flag')c.buff.flags.liftoff=false;
  if(kind==='mods')c.buff.mods={atkPct:9};if(kind==='status')c.buff.status='stun';if(kind==='stack')c.buff.stacks=2;if(kind==='duration')c.buff.timeLeft=1;
 })});advance(f.b,.1);assert.equal(owned(f).length,0);assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),0);
});
for(const kind of['retreat','replace','dispel'])test(`${kind} during the accepted FLY command cannot synthesize a later owner-born height`,()=>{
 const f=make({beforeInstall:(b,u,flight)=>b.on('blockModeChanged',c=>{if(c.unit!==u||c.mode!=='FLY')return;
  if(kind==='retreat')b.retreat(u);if(kind==='replace')u.deploySeq++;if(kind==='dispel')b.removeBuff(u,flight.parent.buff);
 })});advance(f.b,.1);near(f.flight.heightNow(),0);assert.equal(owned(f).length,0);
 if(kind==='dispel')assert.equal(explicitBlockMode(f.u),'FLY');else assert.equal(explicitBlockMode(f.u),null);
});
for(const why of['retreat','death','replacement','battleEnd','stop'])test(`${why} drains owned parent/command/listeners without removing a newer foreign command`,()=>{
 const f=make(),foreign=commandBlockMode(f.b,f.u,'WALK',{});if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);
 if(why==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(why==='stop')f.flight.stop();
 assert.equal(owned(f).length,0);assert.equal(f.flight.handles.length,0);assert.equal(f.u.mem.regularBlockMode,foreign);assert.equal(f.flight.stopped,true);
 if(why==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');assert.throws(()=>f.flight.install(),/cannot be reinstalled/);
});
test('Owned height cleanup retains the clip, while foreign presentation is neither adopted nor stripped',()=>{
 const f=make();f.u.mem.regularFormVisual=f.flight.decorate({clip:'Attack',playId:'ours'});f.flight.stop();assert.deepEqual(f.u.mem.regularFormVisual,{clip:'Attack',playId:'ours'});
 const g=make(),v={clip:'Idle',heightOffset:.9,playId:'foreign'};g.u.mem.regularFormVisual=v;g.flight.heightCommand(.2);assert.equal(g.u.mem.regularFormVisual,v);g.flight.stop();assert.equal(g.u.mem.regularFormVisual,v);
});
test('Height commands preserve an owned animation identity for its live speed and cleanup owner',()=>{
 const f=make(),v=f.flight.decorate({clip:'Attack',playId:'owned',speed:1});f.u.mem.regularFormVisual=v;
 f.flight.heightCommand(0,.3);assert.equal(f.u.mem.regularFormVisual===v,true);assert.ok(v.height);assert.equal(v.heightOffset,undefined);
 v.speed=.5;f.flight.heightCommand(.4);assert.equal(f.u.mem.regularFormVisual===v,true);assert.equal(v.height,undefined);near(v.heightOffset,.4);assert.equal(v.speed,.5);
});
test('Foreign same-key admission collision retains its own lifetime and is never adopted',()=>{
 let once=false,foreign;const f=make({beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(once||!c.buff.key.startsWith('aigis_tr:'))return;once=true;
  foreign=b.addBuff(u,{key:c.buff.key,source:{},duration:5,data:{foreign:true}});})});advance(f.b,.1);assert.equal(f.u.findBuff(foreign.key),foreign);
 assert.equal(owned(f).length,0);assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),0);
});
test('Duplicate deploy cannot recreate a dispelled parent, and a replacement deploy cannot rebind the old controller',()=>{
 const f=make();f.b.removeBuff(f.u,f.flight.parent.buff);f.b.emit('deploy',{unit:f.u});assert.equal(owned(f).length,0);
 f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};f.b.emit('deploy',{unit:f.u});assert.equal(f.flight.stopped,true);assert.equal(f.flight.handles.length,0);
 assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
