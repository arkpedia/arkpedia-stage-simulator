// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance} from './helpers/skybox-fixture.js';
import {commandBlockMode,clearBlockMode,explicitBlockMode} from '../server/sim/block-mode.js';
import {airBlockMode,canTargetAlly,areaSelectable} from '../server/sim/targeting.js';
import {make as taraxaFixture,ally} from './helpers/taraxa-fixture.js';
const fixtures=[],make=()=>{const f=fixture();fixtures.push(f);f.b.addBuff(f.u,{key:'fixture:flight',flags:{liftoff:true,blockFly:true}});return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
test('Ground-evasion immunity suppresses targeting/damage/status evasion but leaves FLY blocking and the source passive',()=>{
 const f=make(),ground=enemy(f,{col:5.2}),air=enemy(f,{col:5.3,motion:'FLY'}),parent=f.u.findBuff('fixture:flight');
 assert.equal(canTargetAlly(ground,f.u,true),false);assert.equal(f.b._checkBlock(ground),false);
 const immune=f.b.addBuff(f.u,{key:'fixture:immunity',flags:{groundEvadeImmune:true}});
 assert.equal(airBlockMode(f.u),true);assert.equal(canTargetAlly(ground,f.u,true),true);assert.equal(areaSelectable(ground,f.u),true);
 assert.equal(f.b._checkBlock(ground),false);assert.equal(f.b._checkBlock(air),true);
 const hp=f.u.hp;assert.ok(f.b.dealDamage(ground,f.u,{amount:1000,type:'true'})>0);near(f.u.hp,hp-1000);
 assert.equal(f.b.applyStatus(f.u,'silence',{source:ground,duration:1}),true);
 f.b.removeBuff(f.u,immune);assert.equal(f.u.findBuff(parent.key),parent);assert.equal(canTargetAlly(ground,f.u,true),false);
});
test('WALK overrides persistent FLY blocking and ground evasion without changing route motion or removing the passive',()=>{
 const f=make(),ground=enemy(f,{col:5.2}),air=enemy(f,{col:5.3,motion:'FLY'}),parent=f.u.findBuff('fixture:flight');
 const walk=commandBlockMode(f.b,f.u,'WALK',{});
 assert.equal(airBlockMode(f.u),false);assert.equal(f.b._checkBlock(air),false);assert.equal(f.b._checkBlock(ground),true);
 assert.equal(canTargetAlly(ground,f.u,true),true);assert.equal(f.u.isFlying,false);assert.equal(f.u.motion,'GROUND');
 f.b.releaseBlocked(f.u);clearBlockMode(f.b,f.u,walk);assert.equal(f.u.findBuff(parent.key),parent);
 assert.equal(airBlockMode(f.u),true);assert.equal(f.b._checkBlock(ground),false);assert.equal(f.b._checkBlock(air),true);
});
test('A landed unit on a high or fenced tile cannot invent ground blocking capacity',()=>{
 const f=make(),ground=enemy(f,{col:5.1});commandBlockMode(f.b,f.u,'WALK',{});
 f.u.ground=false;assert.equal(f.b._checkBlock(ground),false);f.u.ground=true;
 const k=f.u.tileR*21+f.u.tileC;f.b.grid.tiles[k]={...f.b.grid.tiles[k],pass:'FLY'};assert.equal(f.b._checkBlock(ground),false);
});
test('WALK overrides also apply to profile-only air blocking and still respect noBlock',()=>{
 const f=fixture();fixtures.push(f);f.u.profile.blockFly=true;const air=enemy(f,{col:5.1,motion:'FLY'});
 assert.equal(f.b._blockerFor(f.u,air,1),true);commandBlockMode(f.b,f.u,'WALK',{});
 assert.equal(f.b._blockerFor(f.u,air,1),false);const ground=enemy(f,{col:5.2});f.b.addBuff(f.u,{key:'fixture:no-block',flags:{noBlock:true}});
 assert.equal(f.b._blockerFor(f.u,ground,1),false);
});
test('Taraxacum conditional Sanctuary/block gifts leave on WALK and resume on FLY without replacing the recipient passive',()=>{
 const f=taraxaFixture();fixtures.push(f);const t=ally(f,{flags:{liftoff:true}});f.aura.tick();near(t.s.blockCnt,1);near(t.s.physTakenMul,.9);
 const walk=commandBlockMode(f.b,t,'WALK',{});f.aura.tick();near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
 clearBlockMode(f.b,t,walk);f.aura.tick();near(t.s.blockCnt,1);near(t.s.physTakenMul,.9);
});

test('A mode command outlives the initiating timer and releases incompatible blockers without inventing new contact',()=>{
 const f=make(),air=enemy(f,{col:5.1,motion:'FLY'}),ground=enemy(f,{col:5.2});assert.equal(f.b._checkBlock(air),true);
 const p=commandBlockMode(f.b,f.u,'WALK',{});assert.equal(air.blockedBy,null);assert.equal(ground.blockedBy,null);
 assert.equal(explicitBlockMode(f.u),'WALK');assert.equal(airBlockMode(f.u),false);assert.equal(canTargetAlly(ground,f.u,true),true);
 assert.equal(f.b._checkBlock(ground),true);commandBlockMode(f.b,f.u,'FLY',{});assert.equal(ground.blockedBy,null);
 assert.equal(clearBlockMode(f.b,f.u,p),false);assert.equal(explicitBlockMode(f.u),'FLY');
});
test('Current-life mode commands are independently owned and cannot mutate a replacement life or another command',()=>{
 const f=make(),p=commandBlockMode(f.b,f.u,'WALK',{});f.u.deploySeq++;
 assert.equal(explicitBlockMode(f.u),null);const fresh=commandBlockMode(f.b,f.u,'FLY',{});
 assert.equal(clearBlockMode(f.b,f.u,p),false);assert.equal(f.u.mem.regularBlockMode,fresh);
 assert.equal(clearBlockMode(f.b,f.u,fresh),true);assert.equal(f.u.mem.regularBlockMode,undefined);
});
test('An explicit FLY block command does not fabricate ground-target evasion without its separate passive',()=>{
 const f=fixture();fixtures.push(f);const ground=enemy(f,{col:5.1}),air=enemy(f,{col:5.2,motion:'FLY'});
 commandBlockMode(f.b,f.u,'FLY',{});assert.equal(f.b._checkBlock(ground),false);assert.equal(f.b._checkBlock(air),true);
 assert.equal(canTargetAlly(ground,f.u,true),true);assert.equal(f.u.isFlying,false);
});
test('Source block-mode notifications immediately refresh Taraxacum conditional gifts',()=>{
 const f=taraxaFixture();fixtures.push(f);const t=ally(f,{flags:{liftoff:true}});f.aura.tick();near(t.s.physTakenMul,.9);
 commandBlockMode(f.b,t,'WALK',{});near(t.s.physTakenMul,1);near(t.s.blockCnt,0);
 commandBlockMode(f.b,t,'FLY',{});near(t.s.physTakenMul,.9);near(t.s.blockCnt,1);
});

test('Absent recipients have no explicit block mode and cannot become air blockers',()=>{assert.equal(explicitBlockMode(null),null);assert.equal(explicitBlockMode(undefined),null);assert.equal(airBlockMode(null),false);assert.equal(airBlockMode(undefined),false);});
