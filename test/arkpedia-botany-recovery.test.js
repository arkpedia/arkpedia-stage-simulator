// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,addOwner,enemy,burst,near,advance} from './helpers/botany-fixture.js';
import {BotanyBurstRecovery,BOTANY_RECOVERY_CONTRACT,verifyBotanyRecoverySource} from '../server/sim/content/arkpedia-botany-recovery.js';
import {botanyNativeInputs} from '../server/sim/content/arkpedia-botany-source.js';
function setup({active=true,contract=BOTANY_RECOVERY_CONTRACT,affecting,...opts}={}){
 const state={active};let recovery;
 const f=fixture({skill:2,...opts,beforeInstall:(b,u)=>{recovery=new BotanyBurstRecovery(b,u,{contract,affecting:affecting===undefined?()=>state.active:affecting});recovery.install();}});
 return{...f,recovery,state};
}
const timer=t=>t.findBuff('erosionBurst');
test('Recovery requires selected S2, the exact contract and an explicit source-mode/account predicate',()=>{
 assert.throws(()=>setup({contract:{...BOTANY_RECOVERY_CONTRACT}}),/exact recovery contract/);
 assert.throws(()=>setup({affecting:null}),/predicate/);assert.throws(()=>setup({skill:1}),/original Botany S2/);verifyBotanyRecoverySource();
 const n=structuredClone(botanyNativeInputs());n.modes[1].abilities[0]._buffs[0].attributes.attributeModifiers[0].attributeType=34;
 assert.throws(()=>verifyBotanyRecoverySource(n),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Selected S2 rank${rank} accelerates the actual erosion-burst timer by its own source value`,()=>{
 const f=setup({rank}),t=enemy(f);burst(f,t);assert.ok(f.recovery.records.get(t));advance(f.b,1);
 near(timer(t).timeLeft,8-(1+f.record.bb['attack@ep_break_recover_speed']));
});
for(const element of['burn','neural','apoptosis'])test(`The original erosion-only filter does not accelerate ${element}`,()=>{
 const f=setup(),t=enemy(f);burst(f,t,{element});const lock=t.findBuff(element+'Burst'),before=lock.timeLeft;advance(f.b,1);
 near(lock.timeLeft,before-1);assert.equal(f.recovery.records.size,0);
});
test('Partial erosion receives its range resource without erasing injury or creating a burst',()=>{
 const f=setup(),t=enemy(f);f.b.dealDamage(null,t,{amount:10,type:'element',element:'erosion'});f.recovery.tick();
 assert.ok(f.recovery.records.get(t));advance(f.b,1);near(t.elem.erosion,10);assert.equal(timer(t),null);
});
test('Untouched enemies do not receive a fabricated elemental recovery resource',()=>{
 const f=setup(),t=enemy(f);f.recovery.tick();assert.equal(f.recovery.records.size,0);assert.equal(timer(t),null);
});
test('The finite original erosion burst really ends sooner and resets gauges through its normal removal path',()=>{
 const f=setup(),t=enemy(f);burst(f,t);advance(f.b,6.45);assert.equal(timer(t),null);near(t.elem.erosion,0);assert.equal(f.recovery.records.size,0);
});
for(const highFirst of[false,true])test(`Overlapping producers use the strongest recovery speed without double-counting (${highFirst?'high first':'low first'})`,()=>{
 const f=setup({rank:highFirst?10:1});let otherRecovery;
 const other=addOwner(f.b,{skill:2,rank:highFirst?1:10,row:5,col:4,beforeInstall:(b,u)=>{
  otherRecovery=new BotanyBurstRecovery(b,u,{contract:BOTANY_RECOVERY_CONTRACT,affecting:()=>true});otherRecovery.install();}}),t=enemy(f,{col:6});
 burst(f,t);advance(f.b,1);const max=Math.max(f.record.bb['attack@ep_break_recover_speed'],other.record.bb['attack@ep_break_recover_speed']);
 near(timer(t).timeLeft,8-(1+max));assert.equal(f.recovery.records.size,1);assert.equal(otherRecovery.records.size,1);
 const high=highFirst?f.recovery:otherRecovery,low=highFirst?otherRecovery:f.recovery,lowSpeed=low.record.bb['attack@ep_break_recover_speed'];
 high.stop();const before=timer(t).timeLeft;advance(f.b,1);near(timer(t).timeLeft,before-(1+lowSpeed));
});
test('A fixed independent duration reduction remains separate from accelerated recovery speed',()=>{
 const f=setup(),t=enemy(f);burst(f,t);timer(t).timeLeft-=.5;advance(f.b,1);near(timer(t).timeLeft,7.5-1.25);
});
test('Range exit removes the owned resource and only future recovery returns to baseline',()=>{
 const f=setup(),t=enemy(f);burst(f,t);advance(f.b,1);const before=timer(t).timeLeft;
 t.x=18;t.y=17;t.tileR=17;t.tileC=18;f.recovery.tick();advance(f.b,1);near(timer(t).timeLeft,before-1);assert.equal(f.recovery.records.size,0);
});
test('An inactive account/mode predicate cannot accelerate a burst; later activation and expiry are independent',()=>{
 const f=setup({active:false}),t=enemy(f);burst(f,t);advance(f.b,1);near(timer(t).timeLeft,7);
 f.state.active=true;f.recovery.tick();advance(f.b,1);near(timer(t).timeLeft,5.75);
 f.state.active=false;f.recovery.tick();advance(f.b,1);near(timer(t).timeLeft,4.75);assert.equal(f.recovery.records.size,0);
});
test('A hidden source suspends its aura and can resume the same current burst after reappearing',()=>{
 const f=setup(),t=enemy(f);burst(f,t);f.u.hidden=true;f.recovery.tick();advance(f.b,1);near(timer(t).timeLeft,7);
 f.u.hidden=false;f.recovery.tick();advance(f.b,1);near(timer(t).timeLeft,5.75);
});
test('Source silence/stun does not disable this original unsilenceable mode-owned aura',()=>{
 const f=setup(),t=enemy(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{silence:true,stun:true}});burst(f,t);advance(f.b,1);near(timer(t).timeLeft,6.75);
});
test('Recipient target-free state removes its current resource without cancelling the original burst',()=>{
 const f=setup(),t=enemy(f);burst(f,t);f.b.addBuff(t,{key:'fixture:target-free',flags:{untargetable:true}});f.recovery.tick();advance(f.b,1);
 near(timer(t).timeLeft,7);assert.equal(f.recovery.records.size,0);
});
test('Rejected range-resource admission does not accelerate or remove the existing elemental burst',()=>{
 const f=setup(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s2_recover:'))c.cancel=true;});burst(f,t);advance(f.b,1);
 near(timer(t).timeLeft,7);assert.equal(f.recovery.records.size,0);
});
test('Foreign same-key resources are never adopted, changed or removed',()=>{
 const f=setup(),t=enemy(f),foreign=f.b.addBuff(t,{key:`botany_s2_recover:${f.u.id}:${f.u.deploySeq}`,duration:99,source:{}});
 burst(f,t);advance(f.b,1);near(timer(t).timeLeft,7);assert.equal(f.recovery.records.size,0);f.recovery.stop();assert.ok(t.buffs.includes(foreign));
});
test('A range resource finished before admission returns cannot leave late old-life output',()=>{
 const f=setup(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s2_recover:'))c.buff.onRemove();});burst(f,t);advance(f.b,1);
 near(timer(t).timeLeft,7);assert.equal(f.recovery.records.size,0);assert.ok(!t.buffs.some(b=>b.key.startsWith('botany_s2_recover:')));
});
test('Retirement during range-resource admission cannot leave late aura output',()=>{
 const f=setup(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s2_recover:'))f.b.retreat(f.u);});burst(f,t);advance(f.b,1);
 near(timer(t).timeLeft,7);assert.equal(f.recovery.records.size,0);assert.equal(f.recovery.handles.length,0);
});
test('Current burst identity is read afresh; an ended burst does not donate its sampled speed to a replacement',()=>{
 const f=setup(),t=enemy(f);burst(f,t);advance(f.b,1);const old=timer(t);burst(f,t);assert.notEqual(timer(t),old);
 near(timer(t).timeLeft,8);advance(f.b,1);near(timer(t).timeLeft,6.75);
});
test('Old recipient callbacks cannot advance a later life current burst',()=>{
 const f=setup(),t=enemy(f);burst(f,t);const p=f.recovery.records.get(t);t.deploySeq++;f.recovery.tick();const newer=f.recovery.records.get(t),before=timer(t).timeLeft;
 assert.notEqual(p,newer);f.recovery.recover(p,1);near(timer(t).timeLeft,before);assert.ok(t.buffs.includes(newer.buff));
});
for(const kind of['retreat','death','replacement','battleEnd'])test(`Source ${kind} drains only its owned recovery resources and callbacks`,()=>{
 const f=setup(),t=enemy(f);burst(f,t);const original=timer(t);
 if(kind==='retreat')f.b.retreat(f.u);else if(kind==='death')f.b.kill(f.u,null);else if(kind==='replacement'){f.u.deploySeq++;advance(f.b,f.b.dt);}
 else{f.b.finished=true;f.b.emit('battleEnd',{});}
 assert.equal(f.recovery.records.size,0);assert.equal(f.recovery.handles.length,0);assert.equal(timer(t),original);
 assert.ok(!t.buffs.some(b=>b.data?.botanyRecovery));assert.throws(()=>f.recovery.install(),/cannot be reinstalled/);
});
