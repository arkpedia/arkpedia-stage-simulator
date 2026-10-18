// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance,until} from './helpers/botany-fixture.js';
import {prepareBotanyS1,BOTANY_S1_CONTRACT,verifyBotanyS1} from '../server/sim/content/arkpedia-botany-s1.js';
import {botanyNativeInputs} from '../server/sim/content/arkpedia-botany-source.js';
const make=opts=>fixture({prepare:(b,u)=>prepareBotanyS1(b,u,{contract:BOTANY_S1_CONTRACT}),...opts});
const hp=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s1'));
const extra=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s1-extra'));
const injury=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s1-injury'));
const extraInjury=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s1-extra-injury'));
const ready=f=>f.u.skill.setSpTotal(f.u.skill.spCost);
const begin=f=>until(f,()=>!!f.controller.reservation);
const born=f=>until(f,()=>f.controller.flights.size>0);
const landed=f=>until(f,()=>injury(f).length>0);
const clean=t=>assert.ok(!t.buffs.some(b=>b.key.startsWith('botany_s1_extra:')));
test('Botany S1 requires selected original input and its exact controller contract',()=>{
 assert.throws(()=>fixture({prepare:(b,u)=>prepareBotanyS1(b,u,{contract:{...BOTANY_S1_CONTRACT}})}),/exact controller contract/);
 assert.throws(()=>make({skill:2}),/selected Botany S1/);verifyBotanyS1();
 for(const change of[n=>n.s1._earlySkillFinishAtAttackFinished=1,n=>n.s1Attack._activeBuffs[0].isDamageMissable=1,
  n=>n.templates.botany_s1_extra.eventToActions.ON_BUFF_START[0]._elementType='FIRE']){
  const n=structuredClone(botanyNativeInputs());change(n);assert.throws(()=>verifyBotanyS1(n),/Changed original/);
 }
});
for(let rank=1;rank<=10;rank++)test(`Botany S1 rank${rank} uses one real attack and its selected primary/extra Arts and erosion`,()=>{
 const f=make({rank}),t=enemy(f),bb=f.record.bb;ready(f);landed(f);
 assert.equal(f.receipts.length,1);assert.equal(f.u.skill.activations,1);assert.equal(f.u.skill.maxCharges,1);
 near(hp(f)[0].amount,f.u.s.atk*bb.atk_scale);near(extra(f)[0].amount,f.u.s.atk*bb['botany_s1_extra.atk_scale']);
 near(injury(f)[0].amount,f.u.s.atk*bb.ep_damage_ratio);near(extraInjury(f)[0].amount,f.u.s.atk*bb['botany_s1_extra.ep_damage_ratio']);
 assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.pending,true);clean(t);
});
test('A healthy full-HP enemy permits automatic S1; no half-HP condition or manual cast is inherited',()=>{
 const f=make(),t=enemy(f);ready(f);assert.equal(f.u.skill.activate('manual'),false);begin(f);
 near(t.hp,t.s.maxHp);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1');assert.equal(f.u.skill.sp,0);
 advance(f.b,.75);assert.equal(f.receipts.length,0);born(f);assert.equal(f.receipts.length,1);assert.equal(hp(f).length,0);
});
test('Natural timed SP leaves ordinary Arts attacks available and actually casts the selected S1',()=>{
 const f=make();enemy(f);until(f,()=>f.u.skill.activations===1,20);assert.ok(f.b.time>=f.record.source.spData.spCost);
 assert.ok(f.hits.some(h=>h.dmg.tags.includes('botany:ordinary')));landed(f);assert.equal(f.receipts.filter(r=>r.isSkill).length,1);
});
test('No target preserves the single ready charge without creating a cast or attack',()=>{
 const f=make();advance(f.b,10);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);assert.equal(f.receipts.length,0);
 enemy(f);begin(f);assert.equal(f.u.skill.activations,1);
});
test('Original early-finish-zero account holds SP through the full S1 clip even at high ASPD',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:200}});ready(f);begin(f);const start=f.b.time;
 advance(f.b,1);assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.sp,0);assert.equal(f.u.skill.gainSp(5,'fixture'),0);
 assert.equal(f.receipts.length,1);until(f,()=>!f.u.skill.active);assert.ok(f.b.time-start>=1.6-1e-7);advance(f.b,.1);assert.ok(f.u.skill.sp>0);
});
test('S1 erosion ratios use ATK while the independent attack-scale multiplier changes only HP damage',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(f.u,{key:'fixture:scale',mods:{atkScaleMul:2}});ready(f);landed(f);const bb=f.record.bb;
 near(hp(f)[0].amount,f.u.s.atk*2*bb.atk_scale);near(extra(f)[0].amount,f.u.s.atk*2*bb['botany_s1_extra.atk_scale']);
 near(t.elem.erosion,f.u.s.atk*(bb.ep_damage_ratio+bb['botany_s1_extra.ep_damage_ratio']));
});
test('Already injured erosion recipients receive primary S1 output without the untouched-gauge bonus',()=>{
 const f=make(),t=enemy(f);f.b.dealDamage(null,t,{amount:10,type:'element',element:'erosion'});ready(f);landed(f);
 assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,0);near(t.elem.erosion,10+f.u.s.atk*f.record.bb.ep_damage_ratio);clean(t);
});
test('The template checks current erosion at arrival after accepted primary HP callbacks',()=>{
 const f=make(),t=enemy(f);f.b.on('damaged',c=>{if(c.dmg.tags.includes('botany:s1'))f.b.dealDamage(null,t,{amount:10,type:'element',element:'erosion'});});
 ready(f);landed(f);assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,0);near(t.elem.erosion,10+f.u.s.atk);
});
test('An erosion burst blocks fresh injury and the untouched-gauge bonus but does not cancel primary Arts',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'erosionBurst',duration:8,flags:{burstLock:true}});ready(f);until(f,()=>hp(f).length===1);
 assert.equal(extra(f).length,0);assert.equal(injury(f).length,0);assert.equal(extraInjury(f).length,0);clean(t);
});
test('A different burst does not itself count as erosion injury; its shared lock still prevents both injury packets',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'burnBurst',duration:10,flags:{burstLock:true}});ready(f);until(f,()=>extra(f).length===1);
 assert.equal(hp(f).length,1);assert.equal(injury(f).length,0);assert.equal(extraInjury(f).length,0);near(t.elem.erosion,0);clean(t);
});
test('Dodged Arts do not cancel the independent non-missable buff or either erosion action',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'fixture:dodge',mods:{dodgeArts:1}});ready(f);landed(f);
 assert.equal(hp(f).length,0);assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,1);near(t.hp,t.s.maxHp);assert.ok(t.elem.erosion>0);clean(t);
});
test('A full HP shield does not replace primary or extra erosion with actual-HP-damage scaling',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'fixture:shield',shield:1e7});ready(f);landed(f);
 near(t.hp,t.s.maxHp);near(t.elem.erosion,f.u.s.atk*(f.record.bb.ep_damage_ratio+f.record.bb['botany_s1_extra.ep_damage_ratio']));clean(t);
});
test('Refusing the extra buff preserves primary Arts and erosion without inventing an extra receipt',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s1_extra:'))c.cancel=true;});ready(f);landed(f);
 assert.equal(hp(f).length,1);assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,0);assert.equal(f.receipts.length,1);near(t.elem.erosion,f.u.s.atk);clean(t);
});
test('A pre-finished extra resource cannot execute late actions or remain attached',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s1_extra:'))c.buff.onRemove();});ready(f);landed(f);
 assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,0);clean(t);
});
test('Unfired transient control cancels the shot but holds its account until the existing full-clip deadline',()=>{
 const f=make();enemy(f);ready(f);begin(f);f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,1);
 assert.equal(f.receipts.length,0);assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.sp,0);
 until(f,()=>!f.u.skill.active);assert.equal(f.u.skill.ready,false);assert.equal(hp(f).length,0);assert.equal(injury(f).length,0);
});
test('An accepted projectile survives later control and still delivers its selected source payload',()=>{
 const f=make(),t=enemy(f);ready(f);born(f);f.b.applyStatus(f.u,'stun',{duration:.5});landed(f);
 assert.equal(hp(f).length,1);assert.equal(extra(f).length,1);assert.equal(f.u.skill.sp,0);clean(t);
});
for(const replace of[false,true])test(`Lost input before projectile birth refunds one charge (${replace?'replacement':'death'})`,()=>{
 const f=make(),t=enemy(f);ready(f);begin(f);if(replace){t.deploySeq++;t.x=18;t.tileC=18;}else f.b.kill(t,null);
 until(f,()=>!f.u.skill.active);assert.equal(f.u.skill.ready,true);assert.equal(f.receipts.length,0);assert.equal(injury(f).length,0);
});
test('A born projectile losing its input does not refund the already accepted source charge',()=>{
 const f=make(),t=enemy(f);ready(f);born(f);f.b.kill(t,null);until(f,()=>!f.u.skill.active);
 assert.equal(f.u.skill.ready,false);assert.equal(hp(f).length,0);assert.equal(f.controller.flights.size,0);assert.equal(f.controller.watchers.length,0);
});
test('Recipient replacement inside primary damage cannot inherit the extra buff or elemental packets',()=>{
 const f=make(),t=enemy(f);f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('botany:s1')){t.deploySeq++;t.hp=t.s.maxHp;}});ready(f);born(f);advance(f.b,.5);
 near(t.hp,t.s.maxHp);near(t.elem.erosion,0);assert.equal(extra(f).length,0);clean(t);
});
test('Recipient replacement inside extra damage suppresses both later injury packets and removes the old instant resource',()=>{
 const f=make(),t=enemy(f);f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('botany:s1-extra')){t.deploySeq++;t.hp=t.s.maxHp;}});ready(f);born(f);advance(f.b,.5);
 near(t.hp,t.s.maxHp);near(t.elem.erosion,0);assert.equal(injury(f).length,0);assert.equal(extraInjury(f).length,0);clean(t);
});
test('Source retirement in primary damage cannot donate replacement ATK or outgoing modifiers to later payload actions',()=>{
 const f=make(),t=enemy(f),atk=f.u.s.atk;f.b.on('damaged',c=>{if(c.dmg.tags.includes('botany:s1')){f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=9999;
  f.b.addBuff(f.u,{key:'fixture:new-life',mods:{dmgDealtMul:9}});f.u.markDirty();}});ready(f);landed(f);
 near(extra(f)[0].amount,atk*f.record.bb['botany_s1_extra.atk_scale']);near(t.elem.erosion,atk*(f.record.bb.ep_damage_ratio+f.record.bb['botany_s1_extra.ep_damage_ratio']));
 assert.equal(f.controller.handles.length,0);assert.equal(f.talent.handles.length,0);clean(t);
});
test('Withdrawal before arrival leaves finite original S1 transport with old attributes and no owned source hooks',()=>{
 const f=make(),t=enemy(f),atk=f.u.s.atk;ready(f);born(f);f.b.retreat(f.u);f.u.base.atk=9999;f.u.markDirty();landed(f);
 near(hp(f)[0].amount,atk*f.record.bb.atk_scale);assert.equal(f.controller.handles.length,0);assert.equal(f.talent.handles.length,0);
 assert.equal(f.controller.flights.size,0);assert.equal(f.controller.watchers.length,0);clean(t);
});
test('Reentrant arrival during extra-resource admission cannot duplicate its primary or extra action',()=>{
 const f=make(),t=enemy(f);ready(f);born(f);const p=[...f.controller.flights.keys()][0];
 f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s1_extra:'))p.onHit({target:t});});landed(f);
 assert.equal(hp(f).length,1);assert.equal(extra(f).length,1);assert.equal(injury(f).length,1);assert.equal(extraInjury(f).length,1);assert.equal(f.receipts.length,1);clean(t);
});
test('Battle end in primary damage stops later extra/element actions and drains every owned handle',()=>{
 const f=make(),t=enemy(f);f.b.on('damaged',c=>{if(c.dmg.tags.includes('botany:s1')){f.b.finished=true;f.b.emit('battleEnd',{});}});ready(f);born(f);advance(f.b,.5);
 assert.equal(extra(f).length,0);assert.equal(injury(f).length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.watchers.length,0);clean(t);
});
test('Natural S1 casts really cause erosion burst and the separate source talent grants its selected ASPD',()=>{
 const f=make(),t=enemy(f);ready(f);until(f,()=>!!f.talent.gift,25);
 assert.ok(f.u.skill.activations>=2);assert.ok(t.findBuff('erosionBurst'));near(f.u.s.aspd,106);
 assert.equal(f.talent.gift.stacks,1);assert.equal(extra(f).length,1);assert.ok(f.u.stats.elem>=t.gaugeMax);clean(t);
});
test('A foreign same-key instant resource is neither adopted nor removed by this arrival',()=>{
 const f=make(),t=enemy(f);let foreign,entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key.startsWith('botany_s1_extra:')){entered=true;foreign=f.b.addBuff(t,{key:c.buff.key,source:{},duration:99,data:{foreign:true}});}});
 ready(f);landed(f);assert.equal(extra(f).length,0);assert.equal(extraInjury(f).length,0);assert.ok(t.buffs.includes(foreign));near(t.elem.erosion,f.u.s.atk);
});
test('Lethal primary Arts cannot donate extra damage or elemental injury to a corpse',()=>{
 const f=make(),t=enemy(f,{hp:100});ready(f);until(f,()=>!t.alive);assert.equal(hp(f).length,1);
 assert.equal(extra(f).length,0);assert.equal(injury(f).length,0);assert.equal(extraInjury(f).length,0);assert.equal(f.u.stats.elem??0,0);clean(t);
});
test('An early-promotion S1 retains its selected source stats and has no unearned burst talent',()=>{
 const f=make({elite:0,rank:4}),t=enemy(f);ready(f);landed(f);near(hp(f)[0].amount,297*f.record.bb.atk_scale);
 assert.equal(f.talent.records.size,0);near(f.u.s.aspd,100);clean(t);
});
test('Removing the matching source controller ends its owned account and SP lock without leaving callbacks',()=>{
 const f=make();enemy(f);ready(f);begin(f);assert.equal(f.u.skill.active,true);f.controller.stop();
 assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.pending,false);assert.equal(!!f.u.s.flags.noSp,false);
 assert.equal(f.controller.handles.length,0);assert.equal(f.talent.handles.length,0);advance(f.b,.1);assert.ok(f.u.skill.sp>0);
});
test('An old controller cannot finish a replacement source life account',()=>{
 const f=make();enemy(f);ready(f);begin(f);let ends=0;f.u.deploySeq++;
 const replacement={active:true,activations:f.u.skill.activations,end(){ends++;}};f.u.skill=replacement;f.controller.stop();
 assert.equal(ends,0);assert.equal(replacement.active,true);assert.equal(f.controller.handles.length,0);assert.equal(f.talent.handles.length,0);
});
