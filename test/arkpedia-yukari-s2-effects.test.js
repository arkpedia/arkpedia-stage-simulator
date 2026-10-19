// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,addOwner,ally,enemy,near,advance} from './helpers/yukari-fixture.js';
import {SkillRuntime} from '../server/sim/skills.js';
import {YukariSkillTwoEffects,YUKARI_S2_EFFECTS_CONTRACT,verifyYukariS2Effects} from '../server/sim/content/arkpedia-yukari-s2-effects.js';
import {yukariNativeInputs,yukariSourceComponent} from '../server/sim/content/arkpedia-yukari-source.js';
const fs=[],make=opts=>{const f=fixture({skill:2,...opts,defer:true}),effects=new YukariSkillTwoEffects(f.b,f.u,{contract:YUKARI_S2_EFFECTS_CONTRACT});fs.push(f);f.allEffects=[effects];f.effects=effects;f.deploy();effects.bind();return f;};
test.afterEach(()=>{for(const f of fs.splice(0)){assert.deepEqual(f.b.errors,[]);for(const fx of f.allEffects??[]){fx.drain();assert.equal(fx.grants.size,0);assert.equal(fx.watchers.length,0);}}});
function account(f,u){u.skill=new SkillRuntime(f.b,u,{id:'fixture:receiver-skill',skillType:'MANUAL',spType:'time',spCost:10,maxCharges:1},{kind:'instant',attack:{},completeOnAttack:false,trigger:{rule:'NEVER'}});u.skill.reset();return u.skill;}
function receiver(f,opts){const a=ally(f,opts);account(f,a);return a;}
function cast(u,{end=true}={}){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('fixture'),true);if(end&&u.skill.active)u.skill.end('fixture');}
const outputs=(fx,u)=>[...fx.grants].filter(p=>p.kind==='output'&&p.unit===u);
function producer(f,rank){const g=addOwner(f.b,{skill:2,rank,row:4,col:5,defer:true}),fx=new YukariSkillTwoEffects(f.b,g.u,{contract:YUKARI_S2_EFFECTS_CONTRACT});g.deploy();fx.bind();f.allEffects.push(fx);return{...g,effects:fx};}
test('Only fresh selected S2 and the exact original effects contract bind one deployment',()=>{
 verifyYukariS2Effects();const f=fixture({skill:2,defer:true});fs.push(f);assert.throws(()=>new YukariSkillTwoEffects(f.b,f.u),/exact effects/);assert.throws(()=>make({skill:1}),/selected Yukari S2/);const g=make();assert.throws(()=>g.effects.bind(),/one living/);assert.throws(()=>new YukariSkillTwoEffects(g.b,g.u,{contract:YUKARI_S2_EFFECTS_CONTRACT}),/Fresh selected/);
});
for(const what of['base','calculate','compare','lookup','clear','unique','derived','duration','nextSkill','type','stack','override','priority','silence','control'])test(`Changed ${what} cannot retain source S2 marker/output approval`,()=>{
 const n=structuredClone(yukariNativeInputs()),a=n.templates['yukari_s_2[check]'].eventToActions.ON_BUFF_START,s=a[1]._succeedNodes,tr=n.templates.yukari_s_2.eventToActions.ON_SKILL_START,read=(...args)=>{const v=structuredClone(yukariSourceComponent(...args));if(what==='base'&&args[2]==='991671031988104758')v._activeBuffs[0].blackboard[0].value=2;return v;};
 if(what==='calculate')a[0]._addParamKey=null;if(what==='compare')s[1]._condType='GT';if(what==='lookup')s[0]._filterBuffSource=true;if(what==='clear')s[2]._buffKey='different';if(what==='unique')s[3]._buff.overrideType='DEFAULT';
 if(what==='derived')tr[0]._isDerivedBuff=true;if(what==='duration')tr[0]._buff.durationKey='duration2';if(what==='nextSkill')tr.pop();if(what==='type')n.templates['damage_scale[out_mag]'].eventToActions.ON_OUTPUT_DAMAGE[0]._damageMask='ALL';
 if(what==='stack')n.templates['damage_scale[out_mag]'].eventToActions.ON_OUTPUT_DAMAGE[0]._isStackable=true;if(what==='override')tr[0]._buff.overrideKey='atk_bonus';if(what==='priority')tr[0]._buff.priorityBBKeys=[];if(what==='silence')tr[0]._buff.isSilenceable=true;if(what==='control')tr[0]._buff.isStunnable=true;
 assert.throws(()=>verifyYukariS2Effects(n,read),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} stores a persistent marker then grants selected Arts output only after the receiver starts its next skill`,()=>{
 const f=make({rank}),a=receiver(f),power=1+f.record.bb.damage_up,p=f.effects.grant(a);assert.ok(p);assert.equal(p.kind,'marker');near(p.power,power);near(a.s.artsDealtMul,1);advance(f.b,20);assert.equal(f.effects.marker(a)===p,true);
 cast(a);assert.equal(f.effects.marker(a),null);assert.equal(outputs(f.effects,a).length,1);near(a.s.artsDealtMul,power);assert.equal(f.heals.length,0);assert.equal(f.receipts.length,0);assert.equal(a.skill.activations,1);
 advance(f.b,14.9);near(a.s.artsDealtMul,power);advance(f.b,.2);near(a.s.artsDealtMul,1);assert.equal(f.effects.watchers.length,0);
});
test('The output multiplier changes Arts only, preserving printed ATK, unrelated output, healing and receiver credit',()=>{
 const f=make(),a=receiver(f),t=enemy(f);f.b.addBuff(a,{key:'fixture:unrelated',mods:{artsDealtMul:2,dmgDealtMul:1.5}});f.effects.grant(a);cast(a);near(a.s.atk,100);
 const hit=type=>f.b.dealDamage(a,t,{amount:100,type,applyWay:'ranged',tags:['fixture:typed']});near(hit('arts'),100*f.effects.power*3);near(hit('phys'),150);near(hit('true'),150);near(hit('elemental'),150);near(f.b.heal(a,a,50),50);near(f.u.stats.dmg,0);assert.ok(a.stats.dmg>0);
});
test('Original durable marker/output survive a source non-durable clear and retain their own expiry',()=>{
 const f=make(),a=receiver(f);const p=f.effects.grant(a);assert.equal(p.buff.persist,true);
 for(const buff of a.buffs.slice())if(!buff.persist)f.b.removeBuff(a,buff);
 assert.equal(f.effects.marker(a),p);cast(a);const [out]=outputs(f.effects,a);assert.equal(out.buff.persist,true);
 for(const buff of a.buffs.slice())if(!buff.persist)f.b.removeBuff(a,buff);
 assert.equal(a.buffs.includes(out.buff),true);advance(f.b,15.1);assert.equal(a.buffs.includes(out.buff),false);
});
for(const where of['marker','output'])test(`Altered ${where} durability cannot gain source approval`,()=>{
 const f=make(),a=receiver(f);f.b.on('beforeBuff',c=>{if(c.buff.data?.yukariS2?.kind===where)c.buff.persist=false;});
 const p=f.effects.grant(a);if(where==='marker')assert.equal(p,null);else{assert.ok(p);cast(a);assert.equal(outputs(f.effects,a).length,0);}
});
test('A marker granted during an active cast ignores that activation and consumes the following start exactly once',()=>{
 const f=make(),a=receiver(f);cast(a,{end:false});const p=f.effects.grant(a),ctx={unit:a,skill:a.skill,activation:a.skill.activations};assert.ok(p);f.b.emit('skillStart',ctx);assert.equal(outputs(f.effects,a).length,0);a.skill.end();cast(a);assert.equal(outputs(f.effects,a).length,1);f.b.emit('skillStart',ctx);assert.equal(outputs(f.effects,a).length,1);
});
test('Skill starts inside marker admission are part of its watermark, not future triggers',()=>{
 const f=make(),a=receiver(f);let once=false;f.b.on('beforeBuff',c=>{if(!once&&c.buff.key==='yukari_s_2'){once=true;cast(a);}});const p=f.effects.grant(a);assert.ok(p);assert.equal(p.after,1);f.b.emit('skillStart',{unit:a,skill:a.skill,activation:1});assert.equal(outputs(f.effects,a).length,0);cast(a);assert.equal(outputs(f.effects,a).length,1);
});
test('A current future skill account on the same receiver life can consume the skill-ID-independent native marker',()=>{
 const f=make(),a=receiver(f);cast(a);f.effects.grant(a);const old=a.skill;account(f,a);advance(f.b,.1);f.b.emit('skillStart',{unit:a,skill:old,activation:old.activations+1});assert.equal(outputs(f.effects,a).length,0);cast(a);assert.equal(outputs(f.effects,a).length,1);const buff=outputs(f.effects,a)[0].buff;account(f,a);advance(f.b,.1);assert.equal(a.buffs.includes(buff),true);
});
for(const context of['zero','future','foreign','null','other'])test(`A ${context} receipt cannot consume a marker`,()=>{
 const f=make(),a=receiver(f),z=receiver(f);f.effects.grant(a);const ctx={unit:a,skill:a.skill,activation:1};if(context==='zero')ctx.activation=0;if(context==='future')ctx.activation=99;if(context==='foreign')ctx.skill=z.skill;if(context==='null')ctx.skill=null;if(context==='other')ctx.unit=z;f.b.emit('skillStart',ctx);assert.ok(f.effects.marker(a));assert.equal(outputs(f.effects,a).length,0);
});
test('Equal/stronger checks replace a verified marker; a weaker check retains its source and does not stack',()=>{
 const f=make({rank:1}),a=receiver(f),first=f.effects.grant(a),g=producer(f,10),strong=g.effects.grant(a);assert.ok(first.finished);assert.ok(strong);assert.equal(f.effects.grant(a),null);assert.equal(g.effects.marker(a)===strong,true);const equal=g.effects.grant(a);assert.ok(strong.finished);assert.ok(equal);cast(a);near(a.s.artsDealtMul,g.effects.power);assert.equal(outputs(g.effects,a).length,1);assert.equal(f.effects.watchers.length,0);
});
test('Timed outputs keep independent lifetimes, choose the strongest bonus and resume a later weaker source',()=>{
 const f=make({rank:1}),g=producer(f,10),a=receiver(f);g.effects.grant(a);cast(a);advance(f.b,5);f.effects.grant(a);cast(a);near(a.s.artsDealtMul,g.effects.power);advance(f.b,10.1);near(a.s.artsDealtMul,f.effects.power);advance(f.b,5);near(a.s.artsDealtMul,1);
});
test('Two equal active output sources never multiply into a stronger bonus',()=>{
 const f=make(),g=producer(f,10),a=receiver(f);f.effects.grant(a);cast(a);g.effects.grant(a);cast(a);near(a.s.artsDealtMul,f.effects.power);assert.equal(outputs(f.effects,a).length+outputs(g.effects,a).length,2);
});
for(const flag of['stun','silence','hidden','healFree'])test(`An already granted marker/output survives receiver ${flag} without becoming a new source ability`,()=>{
 const f=make(),a=receiver(f);f.effects.grant(a);if(flag==='hidden')a.hidden=true;else f.b.addBuff(a,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,.1);assert.ok(f.effects.marker(a));if(flag==='hidden')a.hidden=false;cast(a);near(a.s.artsDealtMul,f.effects.power);advance(f.b,.1);near(a.s.artsDealtMul,f.effects.power);
});
test('Resist, ASPD and source slowdown do not stretch or shorten the positive duration-key output',()=>{
 const f=make(),a=receiver(f);f.b.addBuff(a,{key:'fixture:clock',mods:{slowDownMul:.1,aspd:400}});f.b.applyStatus(a,'resist',{duration:99,value:.5});f.effects.grant(a);cast(a);advance(f.b,15.1);near(a.s.artsDealtMul,1);assert.equal(f.effects.watchers.length,0);
});
for(const how of['retreat','death','replacement','retire'])test(`Source ${how} prevents new checks while nonderived receiver markers and output remain independent`,()=>{
 const f=make(),a=receiver(f),z=receiver(f);f.effects.grant(a);f.effects.grant(z);cast(z);if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replacement')f.u.deploySeq++;f.effects.retire();assert.equal(f.effects.grant(a),null);cast(a);near(a.s.artsDealtMul,f.effects.power);near(z.s.artsDealtMul,f.effects.power);advance(f.b,15.1);near(a.s.artsDealtMul,1);assert.equal(f.effects.watchers.length,0);
});
for(const how of['retreat','death','replacement'])for(const active of[false,true])test(`Receiver ${how} clears only its ${active?'active output':'pending marker'} and cannot donate it to a new life`,()=>{
 const f=make(),a=receiver(f),z=receiver(f);f.effects.grant(a);f.effects.grant(z);if(active)cast(a);if(how==='retreat')f.b.retreat(a);if(how==='death')f.b.kill(a,null);if(how==='replacement')a.deploySeq++;advance(f.b,.1);assert.equal([...f.effects.grants].some(p=>p.unit===a),false);assert.ok(f.effects.marker(z));
});
for(const where of['check','marker','output'])for(const mutation of['veto','mods','flags','duration','prefinish','replacement'])test(`${mutation} during ${where} admission cannot fabricate an output`,()=>{
 const f=make(),a=receiver(f);f.b.on('beforeBuff',c=>{const p=c.buff.data?.yukariS2;if(p?.kind!==where)return;if(mutation==='veto')c.cancel=true;if(mutation==='mods')c.buff.mods={atkPct:99};if(mutation==='flags')c.buff.flags={noSp:true};if(mutation==='duration')c.buff.duration=99;if(mutation==='prefinish')c.buff.onRemove();if(mutation==='replacement')a.deploySeq++;});const p=f.effects.grant(a);if(where==='output'){assert.ok(p);cast(a);}else assert.equal(p,null);advance(f.b,.1);near(a.s.artsDealtMul,1);near(a.s.atk,100);assert.equal(a.s.flags.noSp,undefined);assert.equal(f.effects.grants.size,0);
});
test('A source removed during immediate check admission cannot leave a later receiver marker',()=>{
 const f=make(),a=receiver(f);f.b.on('beforeBuff',c=>{if(c.buff.data?.yukariS2?.kind==='check')f.b.retreat(f.u);});assert.equal(f.effects.grant(a),null);assert.equal(a.findBuff('yukari_s_2'),null);assert.equal(f.effects.grants.size,0);
});
test('A recursive first skill receipt is claimed before output admission and cannot duplicate the grant',()=>{
 const f=make(),a=receiver(f);f.effects.grant(a);f.b.on('beforeBuff',c=>{if(c.buff.data?.yukariS2?.kind==='output')f.b.emit('skillStart',{unit:a,skill:a.skill,activation:a.skill.activations});});cast(a);assert.equal(outputs(f.effects,a).length,1);near(a.s.artsDealtMul,f.effects.power);
});
test('Parent dispel during a claimed nonderived output does not cancel it or remove a foreign replacement marker',()=>{
 const f=make(),a=receiver(f),p=f.effects.grant(a);let foreign;f.b.on('beforeBuff',c=>{if(c.buff.data?.yukariS2?.kind==='output'){f.effects.finish(p);foreign=f.b.addBuff(a,{key:'yukari_s_2',mods:{defPct:.2}});}});cast(a);assert.equal(outputs(f.effects,a).length,1);assert.equal(a.buffs.includes(foreign),true);assert.equal(f.effects.grant(a),null);
});
test('Foreign marker state is never interpreted, adopted or deleted by a source checker',()=>{
 const f=make(),a=receiver(f),foreign=f.b.addBuff(a,{key:'yukari_s_2',data:{damage_scale:1.1}});assert.equal(f.effects.grant(a),null);assert.equal(a.findBuff('yukari_s_2')===foreign,true);cast(a);near(a.s.artsDealtMul,1);
});
test('A marker replaced reentrantly during admission wins without being adopted by the outer grant',()=>{
 const f=make(),a=receiver(f);let once=false,inner;f.b.on('beforeBuff',c=>{if(!once&&c.buff.key==='yukari_s_2'){once=true;inner=f.effects.grant(a);}});assert.equal(f.effects.grant(a),null);assert.ok(inner);assert.equal(f.effects.marker(a)===inner,true);cast(a);assert.equal(outputs(f.effects,a).length,1);
});
test('Retirement and battle-end drain are idempotent and preserve unrelated modifiers',()=>{
 const f=make(),a=receiver(f),z=receiver(f);const foreign=f.b.addBuff(a,{key:'fixture:foreign',mods:{defPct:.2}});f.effects.grant(a);f.effects.grant(z);cast(a);f.effects.retire();f.b.finished=true;f.b.emit('battleEnd',{});f.effects.drain();assert.equal(f.effects.grants.size,0);assert.equal(f.effects.watchers.length,0);assert.equal(a.buffs.includes(foreign),true);near(a.s.artsDealtMul,1);
});
