// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,addOwner,enemy,burst,near,advance} from './helpers/botany-fixture.js';
import {BOTANY_TALENT_CONTRACT,verifyBotanyTalentSource} from '../server/sim/content/arkpedia-botany-talent.js';
import {botanyNativeInputs} from '../server/sim/content/arkpedia-botany-source.js';
const refresh=f=>f.talent.tick();
const parent=(f,t)=>f.talent.records.get(t);
test('Botany talent requires a fresh exact component contract and unchanged original event nodes',()=>{
 assert.throws(()=>make({contract:{...BOTANY_TALENT_CONTRACT}}),/exact talent contract/);verifyBotanyTalentSource();
 for(const change of[n=>n.talent._buffs[0].isSilenceable=1,n=>n.templates.botany_t_1.eventToActions.ON_BEFORE_EP_BREAK_START[0]._recoveryType='FIRE',
  n=>n.templates.botany_t_1.eventToActions.ON_BEFORE_EP_BREAK_START[1]._isDerivedBuff=true]){
  const n=structuredClone(botanyNativeInputs());change(n);assert.throws(()=>verifyBotanyTalentSource(n),/Changed original/);
 }
});
for(const[elite,potential,expected]of[[0,1,0],[1,1,4],[1,6,5],[2,1,6],[2,6,7]])test(`Botany E${elite}/P${potential} grants only the selected talent and caps at three source stacks`,()=>{
 const f=make({elite,potential}),t=enemy(f);refresh(f);
 for(let n=0;n<5;n++){burst(f,t);near(f.u.s.aspd,100+expected*Math.min(3,n+1));}
 assert.equal(f.talent.gift?.stacks??0,expected?3:0);assert.equal(f.u.base.aspd,100);
 if(!expected)assert.equal(f.talent.records.size,0);
});
test('Only erosion bursts count; ordinary elemental fills and other complete bursts cannot grant ASPD',()=>{
 const f=make(),t=enemy(f);refresh(f);f.b.dealDamage(null,t,{amount:100,type:'element',element:'erosion'});near(f.u.s.aspd,100);
 for(const element of['burn','neural','apoptosis']){burst(f,t,{element});near(f.u.s.aspd,100);f.b.removeBuff(t,`${element}Burst`);}
 burst(f,t);near(f.u.s.aspd,106);
});
test('Another unit or sourceless damage can trigger the observed range burst; it need not be Botany damage',()=>{
 const f=make(),t=enemy(f);refresh(f);burst(f,t);near(f.u.s.aspd,106);
 const other=addOwner(f.b,{row:5,col:4});burst(f,t,{source:other.u});near(f.u.s.aspd,112);
});
test('Ground and flying enemies can both receive the original range parent',()=>{
 const f=make(),a=enemy(f),z=enemy(f,{row:6,col:7,motion:'FLY'});refresh(f);
 assert.ok(parent(f,a));assert.ok(parent(f,z));burst(f,z);near(f.u.s.aspd,106);
});
for(const kind of['hidden','untargetable','stealth','sleep'])test(`A ${kind} enemy cannot donate a talent burst through the mapped range selector`,()=>{
 const f=make(),t=enemy(f,{flags:kind==='hidden'?{}:{[kind]:true}});if(kind==='hidden')t.hidden=true;
 refresh(f);assert.equal(parent(f,t),undefined);f.b.emit('elementBurst',{target:t,element:'erosion'});near(f.u.s.aspd,100);
});
test('Range departure and reentry are checked against current shared grid selection at the burst',()=>{
 const f=make(),t=enemy(f,{row:5,col:10});refresh(f);assert.equal(parent(f,t),undefined);
 t.x=7;t.tileC=7;burst(f,t);assert.ok(parent(f,t));near(f.u.s.aspd,106);
 t.x=18;t.y=17;t.tileR=17;t.tileC=18;refresh(f);assert.equal(parent(f,t),undefined);
 burst(f,t);near(f.u.s.aspd,106);
});
test('A huge enemy can donate a burst through body overlap while its centre remains outside range',()=>{
 const f=make(),t=enemy(f,{row:5,col:10});refresh(f);assert.equal(parent(f,t),undefined);
 t.hitArea={w:6,h:1,dx:0,dy:0};refresh(f);assert.ok(parent(f,t));burst(f,t);near(f.u.s.aspd,106);
});
test('Changing facing invalidates old range parents before another burst can donate',()=>{
 const f=make(),t=enemy(f);refresh(f);assert.ok(parent(f,t));f.u.dir='LEFT';f.b.refreshRange(f.u);
 burst(f,t);near(f.u.s.aspd,100);assert.equal(parent(f,t),undefined);
 f.u.dir='RIGHT';f.b.refreshRange(f.u);burst(f,t);near(f.u.s.aspd,106);
});
test('Two producers independently earn their selected permanent bonus and remove only their own parents',()=>{
 const f=make(),other=addOwner(f.b,{row:5,col:4,potential:6}),t=enemy(f,{col:6});refresh(f);other.talent.tick();
 assert.ok(parent(f,t));assert.ok(other.talent.records.get(t));burst(f,t);near(f.u.s.aspd,106);near(other.u.s.aspd,107);
 f.talent.stop();near(f.u.s.aspd,100);near(other.u.s.aspd,107);assert.ok(other.talent.records.get(t));
});
test('An undeployed source has no range eligibility or permanent bonus',()=>{
 const f=make({defer:true}),t=enemy(f);burst(f,t);near(f.u.s.aspd,100);assert.equal(f.talent.records.size,0);
 f.deploy();burst(f,t);near(f.u.s.aspd,106);
});
test('Earned nonderived source stacks survive enemy range exit and death while their parent is removed',()=>{
 const f=make(),t=enemy(f);refresh(f);burst(f,t);const gift=f.talent.gift,p=parent(f,t);
 t.x=18;t.tileC=18;refresh(f);assert.equal(p.finished,true);assert.equal(t.buffs.includes(p.parent),false);assert.equal(f.talent.gift,gift);near(f.u.s.aspd,106);
 f.b.kill(t,null);near(f.u.s.aspd,106);assert.ok(f.u.buffs.includes(gift));
});
test('The pre-burst gift survives a lethal erosion explosion on its observed enemy',()=>{
 const f=make(),t=enemy(f,{hp:100});refresh(f);burst(f,t);assert.equal(t.alive,false);near(f.u.s.aspd,106);assert.equal(f.talent.records.size,0);
});
test('A moved or replaced recipient loses only its old source parent and cannot reuse its eligibility',()=>{
 const f=make(),t=enemy(f);refresh(f);const old=parent(f,t);t.deploySeq++;refresh(f);
 assert.notEqual(parent(f,t),old);assert.equal(old.finished,true);assert.equal(t.buffs.includes(old.parent),false);
 t.x=18;t.tileC=18;f.b.emit('elementBurst',{target:t,element:'erosion'});near(f.u.s.aspd,100);
});
test('Parent admission refusal prevents the gift without creating an eligibility record',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('botany_t_1[parent]'))c.cancel=true;});
 refresh(f);assert.equal(parent(f,t),undefined);burst(f,t);near(f.u.s.aspd,100);assert.equal(f.talent.gift,null);
});
test('Gift admission refusal preserves the parent and permits a later independent burst',()=>{
 const f=make(),t=enemy(f);refresh(f);const p=parent(f,t),hook=f.b.on('beforeBuff',c=>{if(c.unit===f.u&&c.buff.key===f.talent.key())c.cancel=true;});
 burst(f,t);near(f.u.s.aspd,100);assert.equal(parent(f,t),p);f.b.off(hook);burst(f,t);near(f.u.s.aspd,106);
});
test('A foreign source gift is never stacked, refreshed, adopted or removed',()=>{
 const f=make(),t=enemy(f);refresh(f);const foreign=f.b.addBuff(f.u,{key:f.talent.key(),mods:{aspd:20},source:{}});
 burst(f,t);near(f.u.s.aspd,120);assert.equal(foreign.stacks,1);assert.equal(f.talent.gift,null);f.talent.stop();assert.ok(f.u.buffs.includes(foreign));
});
test('A foreign enemy parent with the same key is never adopted or removed',()=>{
 const f=make(),t=enemy(f),foreign=f.b.addBuff(t,{key:`botany_t_1[parent]:${f.u.id}:${f.u.deploySeq}`,source:{}});
 refresh(f);assert.equal(parent(f,t),undefined);burst(f,t);near(f.u.s.aspd,100);f.talent.stop();assert.ok(t.buffs.includes(foreign));
});
test('Parent removal during gift admission does not erase the accepted nonderived bonus',()=>{
 const f=make(),t=enemy(f);refresh(f);const p=parent(f,t);f.b.on('beforeBuff',c=>{if(c.unit===f.u&&c.buff.key===f.talent.key())f.b.removeBuff(t,p.parent);});
 burst(f,t);assert.equal(parent(f,t),undefined);near(f.u.s.aspd,106);assert.ok(f.u.buffs.includes(f.talent.gift));
});
test('Recursive burst callbacks during gift admission cannot double grant one in-flight action',()=>{
 const f=make(),t=enemy(f);refresh(f);let calls=0;
 f.b.on('beforeBuff',c=>{if(c.unit===f.u&&c.buff.key===f.talent.key()){calls++;f.b.emit('elementBurst',{target:t,element:'erosion'});}});
 burst(f,t);near(f.u.s.aspd,106);assert.equal(calls,1);assert.equal(f.talent.gift.stacks,1);
});
test('A parent finished before its own admission returns leaves no late owned record or buff',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('botany_t_1[parent]'))c.buff.onRemove();});
 refresh(f);assert.equal(parent(f,t),undefined);assert.ok(!t.buffs.some(b=>b.key.startsWith('botany_t_1[parent]')));burst(f,t);near(f.u.s.aspd,100);
});
test('Source retirement during parent admission cannot leave a late enemy parent',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('botany_t_1[parent]'))f.b.retreat(f.u);});
 refresh(f);assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);assert.ok(!t.buffs.some(b=>b.key.startsWith('botany_t_1[parent]')));
});
for(const change of['retreat','replace'])test(`Source ${change} during gift admission removes late old-life output`,()=>{
 const f=make(),t=enemy(f);refresh(f);let entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.unit===f.u&&c.buff.key===f.talent.key()){entered=true;if(change==='retreat')f.b.retreat(f.u);else f.u.deploySeq++;}});
 burst(f,t);refresh(f);near(f.u.s.aspd,100);assert.ok(!f.u.buffs.some(b=>b.data?.botanyGift===f.talent));advance(f.b,f.b.dt);
 assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);
});
test('Source silence and stun do not suppress its original unsilenceable passive',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{silence:true,stun:true}});refresh(f);burst(f,t);near(f.u.s.aspd,106);
});
test('Hidden source suspends enemy parents, preserves earned bonuses and resumes on the same source life',()=>{
 const f=make(),t=enemy(f);refresh(f);burst(f,t);f.u.hidden=true;refresh(f);assert.equal(f.talent.records.size,0);near(f.u.s.aspd,106);
 burst(f,t);near(f.u.s.aspd,106);f.u.hidden=false;refresh(f);burst(f,t);near(f.u.s.aspd,112);
});
test('External removal of the earned stack buff resets only that bonus and the next burst starts at one',()=>{
 const f=make(),t=enemy(f);refresh(f);burst(f,t);burst(f,t);near(f.u.s.aspd,112);
 f.b.removeBuff(f.u,f.talent.gift);near(f.u.s.aspd,100);burst(f,t);near(f.u.s.aspd,106);assert.equal(f.talent.gift.stacks,1);
});
for(const kind of['retreat','death','replacement','battleEnd'])test(`Source ${kind} clears owned parents, permanent bonus and callbacks`,()=>{
 const f=make(),t=enemy(f);refresh(f);burst(f,t);const gift=f.talent.gift;
 if(kind==='retreat')f.b.retreat(f.u);else if(kind==='death')f.b.kill(f.u,null);else if(kind==='replacement'){f.u.deploySeq++;advance(f.b,f.b.dt);}
 else{f.b.finished=true;f.b.emit('battleEnd',{});}
 assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);assert.equal(f.u.buffs.includes(gift),false);near(f.u.s.aspd,100);
 assert.ok(!t.buffs.some(b=>b.data?.botanyParent?.parent===b));assert.throws(()=>f.talent.install(),/cannot be reinstalled/);
});
