// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import {prepareMakotoOwner,MAKOTO_OWNER_CONTRACT,verifyMakotoOwner}from'../server/sim/content/arkpedia-makoto-owner.js';
import {make as base,advance,until,near,enemy}from'./helpers/makoto-fixture.js';
import {addOwner as addYukari,ally}from'./helpers/yukari-fixture.js';
import {YukariSkillTwoEffects,YUKARI_S2_EFFECTS_CONTRACT}from'../server/sim/content/arkpedia-yukari-s2-effects.js';
import {skillHud}from'../shared/arkpedia/skill-hud.js';import {SkillRuntime}from'../server/sim/skills.js';
import e from'../data/arkpedia-native-operators/char_4217_makoto.json'with{type:'json'};
const fs=new Set();
test.afterEach(()=>{for(const f of fs){assert.deepEqual(f.b.errors,[]);f.owner.stop();f.controller.stop();f.fx?.drain();f.yukari?.talent.stop();}fs.clear();});
function make(opts={}){const f=base({...opts,prepare:(b,u)=>prepareMakotoOwner(b,u,{contract:MAKOTO_OWNER_CONTRACT})});f.owner=f.prepared.controller;fs.add(f);return f;}
const cast=f=>{assert.equal(f.u.skill.activate('manual'),true);return f.owner.transition;};
const ready=f=>f.u.skill.setSpTotal(f.u.skill.spCost);
const persona=f=>until(f,()=>!f.owner.transition&&f.owner.mode===f.record.index+1);
const lethal=f=>{const t=enemy(f,{row:5,col:6});return f.b.dealDamage(t,f.u,{amount:1e8,type:'true',canDodge:false,applyWay:'melee'});};
function yukari(f){const y=addYukari(f.b,{skill:2,row:4,col:5,defer:true});const fx=new YukariSkillTwoEffects(f.b,y.u,{contract:YUKARI_S2_EFFECTS_CONTRACT});y.deploy();fx.bind();f.fx=fx;f.yukari=y;return fx;}
for(const skill of[1,2,3])test(`S${skill} installs a source owner with no generic Dollkeeper fatal handler`,()=>{
 const f=make({skill});assert.equal(f.owner.valid(),true);assert.equal(f.u._profInstalled,undefined);assert.equal(f.u.trait.doll,undefined);
 assert.equal(f.u.skill.id,`skchr_makoto_${skill}`);assert.equal(f.u.skill.spTotal,f.record.source.spData.initSp);assert.equal(f.owner.mode,0);
 assert.equal(f.u.profile.install,null);assert.equal(f.u.profile.noAttack,true);
});
for(const skill of[1,2,3])for(const dir of['RIGHT','UP'])test(`S${skill} ${dir} separates early zero-block from mode-bound stat/timer admission`,()=>{
 const f=make({skill,dir}),{owner:c,u}=f;u.hp=u.s.maxHp*.25;ready(f);const life=u.deploySeq,account=u.skill;cast(f);
 assert.equal(u.skill.activations,1);assert.equal(c.mode,0);assert.equal(u.s.flags.invulnerable,true);assert.equal(u.s.flags.healFree,true);
 assert.equal(c.body.phase,null);assert.equal(u.skill.castEligible,false);assert.equal(u.stats.heal,0);assert.equal(u.hpRatio,1);
 advance(f.b,.9);assert.equal(c.entry.phase.step,'out');assert.equal(c.body.phase,null);
 until(f,()=>c.entry.phase?.step==='in');assert.equal(c.body.phase,null);near(u.s.maxHp,u.base.maxHp);assert.equal(u.s.blockCnt,0);
 persona(f);assert.ok(c.body.phase);near(c.body.countdown().remaining,20,f.b.dt+1e-6);near(u.s.maxHp,u.base.maxHp*1.35);
 near(u.s.atk,u.base.atk*(1+f.record.talentBb[0].atk));assert.equal(u.s.flags.invulnerable,undefined);assert.equal(u.s.flags.noSp,true);
 assert.equal(u.deploySeq,life);assert.equal(u.skill===account,true);assert.equal(u.skill.spTotal,0);assert.equal(u.stats.heal,0);
 if(skill===3)near(u.s.aspd,100+f.record.bb['talent@attack_speed']);
});
for(const skill of[1,2,3])test(`S${skill} ordinary combat uses one original receipt before manual Persona entry changes its real profile`,()=>{
 const f=make({skill}),t=enemy(f);until(f,()=>f.receipts.length===1);assert.equal(f.hits.filter(h=>h.dmg.tags.includes('makoto:ordinary')).length,1);
 ready(f);cast(f);persona(f);const before=f.hits.length;advance(f.b,5);
 assert.ok(f.hits.length>before);assert.equal(f.u.profile.dmgType,'arts');assert.equal(f.owner.ordinary.phase,null);assert.equal(t.alive,true);
});
for(const skill of[1,2,3])test(`S${skill} fatal normal-body input starts source Persona without fake casting or cancelling HP loss`,()=>{
 const f=make({skill}),before=f.u.hp;lethal(f);assert.equal(f.u.alive,true);assert.equal(f.u.hp,1);assert.equal(f.owner.transition?.kind,'entry');
 near(f.u.stats.taken,before-1);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.activations,skill===3?1:0);
 persona(f);near(f.u.hp,f.u.s.maxHp);assert.equal(f.u.stats.heal,0);assert.equal(f.owner.mode,skill);
});
for(const skill of[1,2])test(`Fatal S${skill} Persona damage kills instead of a generic automatic toggle back`,()=>{
 const f=make({skill});ready(f);cast(f);persona(f);lethal(f);assert.equal(f.u.alive,false);assert.equal(f.owner.stopped,true);assert.equal(f.owner.mode,skill);
});
for(const forced of[false,true])test(`S3 ${forced?'fatal':'manual'} P1-to-P2 uses one new receipt and captured remaining time`,()=>{
 const f=make({skill:3}),c=f.owner;ready(f);cast(f);persona(f);until(f,()=>f.u.skill.ready);advance(f.b,2);
 const remaining=c.body.countdown().remaining,life=f.u.deploySeq,account=f.u.skill;
 if(forced){lethal(f);assert.equal(f.u.hp,1);}else cast(f);
 assert.equal(c.transition.to,4);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.activations,2);assert.equal(c.body.phase,null);
 assert.equal(f.u.s.blockCnt,2);assert.equal(f.u.s.aspd,100);assert.equal(f.u.skill.ready,false);
 until(f,()=>c.mode===4&&!c.transition);near(c.body.countdown().remaining,remaining,2*f.b.dt+1e-6);
 assert.equal(f.u.skill===account,true);assert.equal(f.u.deploySeq,life);assert.equal(f.u.skill.castEligible,false);assert.equal(skillHud(f.u.skill).canActivate,false);
 assert.equal(f.u.profile.noAttack,true);assert.equal(f.u.hpRatio,1);lethal(f);assert.equal(f.u.alive,false);
});
for(const skill of[1,2,3])test(`S${skill} natural expiry broadcasts real all-out damage and returns through source mode5`,()=>{
 const f=make({skill}),c=f.owner;ready(f);cast(f);persona(f);const t=enemy(f,{row:5,col:5,hp:1e9}),all=[];
 f.b.on('damaged',h=>{if(h.target===t&&h.dmg.tags.includes('makoto:allout'))all.push({at:f.b.time,h});});
 until(f,()=>c.transition?.kind==='return',25);const start=f.b.time;assert.equal(all.length,0);assert.ok(c.ret.phase.plan.allOut);
 assert.ok(f.u.buffs.some(b=>b.data?.nativeKey==='makoto_on_enter_normal'));
 until(f,()=>c.mode===5);assert.equal(c.ret.phase.step,'end');assert.equal(all.length,0);
 until(f,()=>all.length===1);near(all[0].at-start,1.6,f.b.dt+1e-6);assert.equal(c.mode,5);
 until(f,()=>c.mode===0&&!c.transition);assert.equal(c.body.phase,null);assert.equal(f.u.s.blockCnt,2);assert.equal(f.u.s.flags.noSp,undefined);
 near(f.u.s.atk,f.u.base.atk);near(f.u.s.maxHp,f.u.base.maxHp);assert.equal(f.u.hpRatio,1);advance(f.b,1);assert.ok(f.u.skill.spTotal>0);
});
test('Missing talent2 chooses the original plain return with no group broadcast or mode5',()=>{
 const f=make(),c=f.owner;ready(f);cast(f);persona(f);f.b.removeBuff(f.u,c.base.get('makoto_talent_2'));
 until(f,()=>c.transition?.kind==='return',25);assert.equal(c.ret.phase.plan.allOut,false);assert.equal(c.allout.grants.size,0);
 until(f,()=>c.mode===0&&!c.transition);assert.equal(c.allout.grants.size,0);
});
test('Composed S1 actually chooses its injured friendly input and heals through the original Persona marker',()=>{
 const f=make(),a=ally(f,{row:5,col:6,hpRatio:.1});ready(f);cast(f);persona(f);const hp=a.hp;
 until(f,()=>a.hp>hp);assert.equal(f.u.stats.dmg,0);assert.ok(f.u.stats.heal>0);assert.ok(f.receipts.length>0);assert.equal(f.owner.mode,1);
});
test('Composed S2 applies source Fear and its independently ticking execute aura',()=>{
 const f=make({skill:2}),executions=[];f.b.rng.chance=()=>true;const t=enemy(f);f.b.on('damaged',h=>{if(h.dmg.tags.includes('makoto:s2-execution'))executions.push(h);});ready(f);cast(f);persona(f);
 until(f,()=>t.s.flags.fear===true);assert.equal(t.alive,true);t.hp=100;until(f,()=>!t.alive);
 assert.equal(executions.length,1);assert.equal(executions[0].source,null);assert.equal(f.owner.mode,2);
});
test('Composed P2 actually heals a friendly recipient and supplies independent Physical/Arts evasion',()=>{
 const f=make({skill:3}),a=ally(f,{row:5,col:6,hpRatio:.1});ready(f);cast(f);persona(f);until(f,()=>f.u.skill.ready&&f.u.skill.castEligible);cast(f);
 until(f,()=>f.owner.mode===4&&!f.owner.transition);const hp=a.hp;until(f,()=>a.hp>hp);near(a.s.dodgePhys,f.record.bb['attack@prob']);near(a.s.dodgeArts,f.record.bb['attack@prob']);
 const t=enemy(f);f.b.rng=()=>0;assert.equal(f.b.dealDamage(t,a,{amount:100,type:'phys',applyWay:'melee'}),0);
 assert.equal(f.b.dealDamage(t,a,{amount:100,type:'true',applyWay:'melee'}),100);assert.equal(f.u.profile.noAttack,true);
});
test('S3 remainder below the original threshold cannot fund manual or fatal P2 entry',()=>{
 const f=make({skill:3});ready(f);cast(f);persona(f);until(f,()=>f.u.skill.ready&&f.u.skill.castEligible);f.owner.body.phase.parent.timeLeft=.005;
 assert.equal(f.u.skill.activate('manual'),false);assert.equal(f.u.skill.activations,1);lethal(f);assert.equal(f.u.alive,false);
});
for(const forced of[false,true])test(`Durable Yukari marker/output survive source clears and consume one ${forced?'forced S3':'manual'} start`,()=>{
 const f=make({skill:forced?3:1}),fx=yukari(f);assert.ok(fx.grant(f.u));assert.equal(fx.marker(f.u).buff.persist,true);
 if(forced)lethal(f);else{ready(f);cast(f);}assert.equal(fx.marker(f.u),null);
 const outputs=()=>[...fx.grants].filter(p=>p.kind==='output'&&p.unit===f.u);assert.equal(outputs().length,1);assert.equal(outputs()[0].buff.persist,true);
 persona(f);assert.equal(outputs().length,1);near(f.u.s.artsDealtMul,fx.power);assert.equal(f.u.skill.activations,1);
});
test('Fatal S1 does not consume Yukari next-skill marker, because its source chain does not fire CastStart',()=>{
 const f=make(),fx=yukari(f);const marker=fx.grant(f.u);lethal(f);assert.equal(fx.marker(f.u),marker);persona(f);assert.equal(fx.marker(f.u),marker);assert.equal(f.u.skill.activations,0);
});
test('Source clear removes a temporary buff, preserves durable buffs and preserves parent-owned HP after mode admission',()=>{
 const f=make({skill:3});f.b.addBuff(f.u,{key:'fixture:temporary',mods:{defFlat:99}});f.b.addBuff(f.u,{key:'fixture:durable',mods:{hpPct:.2},persist:true});
 ready(f);cast(f);assert.equal(f.u.buffs.some(b=>b.key==='fixture:temporary'),false);persona(f);
 assert.equal(f.u.buffs.some(b=>b.key==='fixture:durable'),true);near(f.u.s.maxHp,f.u.base.maxHp*1.55);assert.equal(f.owner.body.owns(f.owner.body.phase.hp),true);
});
for(const status of['stun','freeze','sleep'])test(`Accepted source transition rejects new ${status} while its own flags exist`,()=>{
 const f=make();ready(f);cast(f);assert.equal(f.b.applyStatus(f.u,status,{duration:1}),false);persona(f);assert.ok(f.b.applyStatus(f.u,status,{duration:1}));
});
for(const how of['retreat','death','life','account','hidden','end','stop'])test(`${how} cancels composed owner callbacks and leaves no borrowed form power`,()=>{
 const f=make({skill:3});ready(f);cast(f);advance(f.b,.5);
 if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='life')f.u.deploySeq++;
 if(how==='account')f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'instant'},f.u.def.skill.bb);if(how==='hidden')f.u.hidden=true;
 if(how==='end'){f.b.finished=true;f.b.emit('battleEnd',{});}if(how==='stop')f.owner.stop();advance(f.b,25);
 assert.equal(f.owner.stopped,true);assert.equal(f.owner.transition,null);assert.equal(f.owner.body.phase,null);assert.equal(f.owner.allout.grants.size,0);
});
test('Native owner action changes cannot certify a fatal toggle or healing bypass',()=>{
 for(const change of[n=>n.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START[0]._ignoreHealFree=true,
  n=>{const walk=x=>{if(!x||typeof x!=='object')return;if(x.$type?.includes('+ConsumeTrySetHpZeroModifier,'))x._blockThisHpSet=true;for(const v of Object.values(x))walk(v);};walk(n.templates.makoto_tr);},
  n=>{const walk=x=>{if(!x||typeof x!=='object')return;if(x.$type?.includes('+CheckBuffRemainingTime,'))x._checkTime=0;for(const v of Object.values(x))walk(v);};walk(n.templates.makoto_tr);}]){
  const n=structuredClone(e);change(n);assert.throws(()=>verifyMakotoOwner(n),/Changed original/);
 }
});
for(const skill of[1,3])test(`S${skill} retains the real source2.11-second escape account independently of mode commit`,()=>{
 const f=make({skill});ready(f);const events=[];f.b.on('skillEnd',c=>{if(c.unit===f.u)events.push({...c,at:f.b.time});});cast(f);persona(f);
 assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.pending,true);assert.equal(f.u.skill.castEligible,false);
 until(f,()=>!f.u.skill.active);assert.equal(events.length,1);assert.equal(events[0].activation,1);near(events[0].at,2.109999895095825,f.b.dt+1e-6);
});
test('S2 ignores its unused escape operand and finishes its account immediately while the entry chain continues',()=>{
 const f=make({skill:2}),events=[];ready(f);f.b.on('skillStart',c=>{if(c.unit===f.u)events.push(['start',c.activation]);});f.b.on('skillEnd',c=>{if(c.unit===f.u)events.push(['end',c.activation]);});
 cast(f);assert.equal(f.u.skill.active,false);assert.equal(f.owner.transition?.kind,'entry');assert.deepEqual(events,[['start',1],['end',1]]);persona(f);
});
test('Fatal S3 reentry during the first cast tail emits native start2 but still finishes ordinary cast1',()=>{
 const f=make({skill:3}),events=[];f.b.on('skillStart',c=>{if(c.unit===f.u)events.push(['start',c.activation]);});f.b.on('skillEnd',c=>{if(c.unit===f.u)events.push(['end',c.activation]);});
 ready(f);cast(f);persona(f);assert.equal(f.u.skill.active,true);lethal(f);assert.equal(f.u.skill.activations,2);
 until(f,()=>!f.u.skill.active);assert.deepEqual(events,[['start',1],['start',2],['end',1]]);until(f,()=>f.owner.mode===4&&!f.owner.transition);assert.equal(f.u.alive,true);
});
test('All thirty selected source ranks compose without resetting stats, account or source form duration',()=>{
 for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++){
  const f=make({skill,rank,potential:6,trust:200});ready(f);const account=f.u.skill;cast(f);persona(f);
  assert.equal(f.u.skill===account,true);assert.equal(f.u.skill.activations,1);near(f.owner.body.countdown().remaining,20,f.b.dt+1e-6);
  near(f.u.s.atk,f.u.base.atk*(1+f.record.talentBb[0].atk));f.owner.stop();
 }
});
for(const phase of['out','in','persona','p2','return'])for(const mutation of['life','spec'])test(`${mutation} replacement at ${phase} cannot inherit composed work`,()=>{
 const f=make({skill:3});ready(f);cast(f);
 if(phase==='in')until(f,()=>f.owner.entry.phase?.step==='in');
 if(['persona','p2','return'].includes(phase))persona(f);
 if(phase==='p2'){until(f,()=>f.u.skill.ready&&f.u.skill.castEligible);cast(f);}
 if(phase==='return')until(f,()=>f.owner.transition?.kind==='return',25);
 if(mutation==='life')f.u.deploySeq++;else f.u.skill.spec={kind:'instant'};
 const n=f.hits.length;advance(f.b,25);assert.equal(f.owner.stopped,true);assert.equal(f.owner.transition,null);assert.equal(f.hits.length,n);
});
for(const nativeKey of['makoto_tr','makoto_talent_1'])test(`Refused required base ${nativeKey} is held instead of inventing a missing passive`,()=>{
 const f=make({defer:true});f.b.on('beforeBuff',c=>{if(c.buff.data?.nativeKey===nativeKey)c.cancel=true;});f.deploy();
 assert.equal(f.owner.stopped,true);assert.equal(f.u.skill.castEligible,false);assert.equal(f.owner.body.phase,null);
});
for(const nativeKey of['makoto_switchbegin','makoto_on_enter_normal'])test(`Changed ${nativeKey} timer/flags cannot manufacture source transition permission or an all-out hold`,()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.data?.nativeKey!==nativeKey)return;if(nativeKey==='makoto_switchbegin')c.buff.flags.undeadable=false;else c.buff.timeLeft=50;});
 ready(f);cast(f);if(nativeKey==='makoto_switchbegin'){assert.equal(f.owner.transition,null);assert.equal(f.owner.body.phase,null);return;}
 persona(f);until(f,()=>f.owner.transition?.kind==='return',25);assert.equal(f.owner.allout.grants.size,0);until(f,()=>f.owner.mode===0);
});
