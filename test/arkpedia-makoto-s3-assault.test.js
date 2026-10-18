// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as base,enemy,advance,near,until} from './helpers/makoto-fixture.js';
import {MakotoSkillThreeAssault,MAKOTO_S3_ASSAULT_CONTRACT as CONTRACT,verifyMakotoS3Assault} from '../server/sim/content/arkpedia-makoto-s3-assault.js';
import {makotoS3AssaultInputs} from '../server/sim/content/arkpedia-makoto-source.js';
const active=new Set(),A='Doll_Skill_3_P1_Attack_A',B='Doll_Skill_3_P1_Attack_B';
test.afterEach(()=>{for(const f of active){f.combat.stop();assert.deepEqual(f.b.errors,[]);}active.clear();});
function make({pickClip,inPersona,defer=false,...build}={}){
 const f=base({...build,skill:3,defer:true});f.controller.stop();f.allow=true;
 f.combat=new MakotoSkillThreeAssault(f.b,f.u,{contract:CONTRACT,inPersona:inPersona?()=>inPersona(f):()=>f.allow,pickClip:pickClip?()=>pickClip(f):()=>A});
 f.b._setupUnit(f.u,{trait:f.combat.trait(),talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});f.combat.install();active.add(f);if(!defer)f.deploy();return f;
}
const attacks=f=>f.hits.filter(h=>h.dmg.tags.includes('makoto:s3-p1'));
const stat=(f,t,changes)=>{Object.assign(t.base,changes);t.markDirty();void t.s;};
const flag=(f,t,n)=>f.b.addBuff(t,{key:'common_weak_damage_flag',data:{weak_damage_type:n}});
for(const rank of Array.from({length:10},(_,i)=>i+1))for(const dir of ['RIGHT','UP'])for(const clip of [A,B])test(`S3 rank${rank} ${dir} ${clip.slice(-1)}: four original inputs, one receipt, exact selected coefficient`,()=>{
 const f=make({rank,dir,pickClip:()=>clip});Array.from({length:6},(_,i)=>enemy(f,{motion:i%2?'FLY':'WALK'}));until(f,()=>!!f.combat.phase);
 const inputs=f.combat.phase.inputs.map(i=>i.target);assert.equal(inputs.length,f.record.bb['attack@max_target']);assert.equal(f.u.mem.regularFormVisual.clip,clip);
 advance(f.b,.7);assert.equal(attacks(f).length,0);until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).length,inputs.length);assert.equal(new Set(attacks(f).map(h=>h.dmg.attackId)).size,1);
 for(const h of attacks(f)){near(h.amount,f.u.s.atk*f.record.bb['attack@atk_scale']);assert.equal(h.type,'arts');assert.equal(h.dmg.isSkill,false);assert.equal(h.dmg.isProjectile,false);assert.ok(inputs.includes(h.target));}
 assert.equal(f.b.projectiles.list.length,0);
});
for(const [label,stats,expected]of[
 ['high DEF',{def:2000,res:0},'arts'],['high RES',{def:0,res:90},'phys'],['equal mitigation',{def:0,res:0},'arts'],
 ['both damage floors',{def:1e9,res:100},'arts'],
])test(`Weakness uses ${expected} for ${label}, exactly one normal HP-damage instance`,()=>{
 const f=make(),t=enemy(f);stat(f,t,stats);let outputs=0;f.b.on('outputDamage',h=>{if(h.source===f.u)outputs++;});until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(outputs,1);assert.equal(attacks(f).length,1);assert.equal(attacks(f)[0].type,expected);
});
test('Recipients resolve weakness independently without mutating a shared DamageInfo',()=>{
 const f=make(),a=enemy(f),z=enemy(f);stat(f,a,{def:2000,res:0});stat(f,z,{def:0,res:90});until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).find(h=>h.target===a).type,'arts');assert.equal(attacks(f).find(h=>h.target===z).type,'phys');
});
for(const n of [0,1,2,3])test(`Logical weakness flag${n} honors only its source-defined forced Physical/Arts values`,()=>{
 const f=make(),t=enemy(f);stat(f,t,{res:90});flag(f,t,n);until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(attacks(f)[0].type,n===2?'arts':'phys');
});
test('Weakness flag from a foreign source is accepted; unrelated buff data cannot force the type',()=>{
 const f=make(),t=enemy(f);stat(f,t,{res:90});f.b.addBuff(t,{key:'unrelated',data:{weak_damage_type:2}});until(f,()=>f.receipts.length===1);assert.equal(attacks(f)[0].type,'phys');
 flag(f,t,2);until(f,()=>f.receipts.length===2);f.allow=false;assert.equal(attacks(f).at(-1).type,'arts');
});
test('Weakness compares the final default-priority amount and typed outgoing/incoming multipliers',()=>{
 const f=make(),t=enemy(f);stat(f,t,{def:500,res:50});f.b.on('hit',h=>{if(h.source===f.u)h.dmg.amount=100;});until(f,()=>f.receipts.length===1);assert.equal(attacks(f)[0].type,'arts');
 f.b.addBuff(f.u,{key:'fixture:phys',mods:{physDealtMul:20}});until(f,()=>f.receipts.length===2);f.allow=false;assert.equal(attacks(f).at(-1).type,'phys');
});
test('DEF ignore participates in the weakness comparison',()=>{
 const f=make(),t=enemy(f);stat(f,t,{def:2000,res:50});f.b.addBuff(f.u,{key:'fixture:ignore',mods:{defIgnorePct:1}});until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(attacks(f)[0].type,'phys');
});
test('A foreign direct attack with copied tags is not retyped by the owned weakness scope',()=>{
 const f=make(),t=enemy(f);stat(f,t,{res:90});f.b.dealDamage(f.u,t,{amount:100,type:'arts',tags:['makoto:s3-p1']});assert.equal(f.hits[0].type,'arts');
});
test('Retyped damage rolls accuracy and the selected channel evasion only once',()=>{
 const f=make(),t=enemy(f);stat(f,t,{res:90});f.b.addBuff(t,{key:'fixture:evade',mods:{dodgeArts:1}});let outputs=0;f.b.on('outputDamage',()=>outputs++);
 until(f,()=>f.receipts.length===1);assert.equal(attacks(f).length,1);assert.equal(attacks(f)[0].type,'phys');assert.equal(outputs,1);
 f.b.addBuff(t,{key:'fixture:phys-evade',mods:{dodgePhys:1}});until(f,()=>f.receipts.length===2);f.allow=false;assert.equal(attacks(f).length,1);assert.equal(outputs,2);
});
test('Lost or replaced captured inputs do not acquire replacements or suppress remaining victims',()=>{
 const f=make(),ts=Array.from({length:5},()=>enemy(f));until(f,()=>!!f.combat.phase);const old=f.combat.phase.inputs.map(i=>i.target),extra=ts.find(t=>!old.includes(t));old[0].deploySeq++;
 until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(attacks(f).length,3);near(extra.hp,extra.s.maxHp);
});
for(const how of ['subset','duplicate','reverse','foreign','recursive'])test(`beforeAttack ${how} cannot fabricate victims or additional receipts`,()=>{
 const f=make(),ts=Array.from({length:5},()=>enemy(f));until(f,()=>!!f.combat.phase);const extra=ts.find(t=>!f.combat.phase.inputs.some(i=>i.target===t));
 f.b.on('beforeAttack',h=>{if(h.attacker!==f.u)return;if(how==='subset')h.targets=h.targets.slice(1);if(how==='duplicate')h.targets=[h.targets[0],h.targets[0]];if(how==='reverse')h.targets.reverse();if(how==='foreign')h.targets=[extra];if(how==='recursive')assert.equal(f.b.forceAttack(f.u,h.targets),false);});
 advance(f.b,.95);f.allow=false;assert.equal(f.receipts.length,['duplicate','reverse','foreign'].includes(how)?0:1);assert.equal(attacks(f).length,how==='subset'?3:how==='recursive'?4:0);near(extra.hp,extra.s.maxHp);
});
for(const how of ['retreat','death','replace','stop','end','mode'])test(`Source ${how} cancels unborn S3 assault output`,()=>{
 const f=make();enemy(f);until(f,()=>!!f.combat.phase);if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replace')f.u.deploySeq++;if(how==='stop')f.combat.stop();if(how==='end')f.b.finished=true;if(how==='mode')f.allow=false;
 advance(f.b,1);assert.equal(attacks(f).length,0);
});
test('Live slowDown freezes and resumes the sampled attack clock without a new ASPD sample',()=>{
 const f=make();enemy(f);until(f,()=>!!f.combat.phase);const speed=f.combat.phase.speed;f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:0,aspd:500}});advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.combat.phase.speed,speed);
 f.b.removeBuff(f.u,'fixture:slow');until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(attacks(f).length,1);
});
test('An explicit begin cannot bypass a positive attack cooldown',()=>{const f=make();enemy(f);f.u.atkCd=10;assert.equal(f.combat.begin(),false);});
test('Clip callback replacement cannot give a new input life an old acquisition',()=>{
 const f=make({pickClip:f=>{f.victim.deploySeq++;return A;}});f.victim=enemy(f);assert.equal(f.combat.begin(),false);assert.equal(f.combat.phase,null);
});
test('A reentrant clip callback cannot start a second phase',()=>{
 const f=make({pickClip:f=>{assert.equal(f.combat.begin(),false);return B;}});enemy(f);assert.equal(f.combat.begin(),true);assert.equal(f.combat.phase.clip,B);
});
test('Foreign presentation survives component cleanup',()=>{const f=make();enemy(f);until(f,()=>!!f.combat.phase);const v={clip:'foreign'};f.u.mem.regularFormVisual=v;f.combat.stop();assert.equal(f.u.mem.regularFormVisual,v);});
for(const[label,edit]of[
 ['ground selector',n=>n.selector._targetMotion=1],['rounded clock',n=>n.attack._preDelay=.8],['removed weakness',n=>n.templates.makoto_s3_1_standin.eventToActions.ON_BUFF_START[2]._buffKey='other'],
 ['forced True',n=>n.templates.common_weak_damage_buff.eventToActions.ON_CALCULATE_DAMAGE[1]._succeedNodes[1]._succeedNodes[0]._damageType='PURE'],
 ['missing fallback',n=>n.templates.common_weak_damage_buff.eventToActions.ON_CALCULATE_DAMAGE.pop()],['guessed clip loop',n=>n.replacement._loopType=1],
])test(`Changed original S3 ${label} is rejected`,()=>{const n=structuredClone(makotoS3AssaultInputs());edit(n);assert.throws(()=>verifyMakotoS3Assault(n),/Changed original/);});
for(const how of ['veto','source','control','mode'])test(`Final beforeAttack ${how} cancels unborn output`,()=>{
 const f=make();enemy(f);f.b.on('beforeAttack',h=>{if(h.attacker!==f.u)return;if(how==='veto')h.targets=[];if(how==='source')f.u.deploySeq++;if(how==='control')f.b.applyStatus(f.u,'stun',{duration:.2});if(how==='mode')f.allow=false;});
 advance(f.b,1.05);assert.equal(f.receipts.length,0);assert.equal(attacks(f).length,0);
});
test('Stored silence/palsy do not invent a native attack interruption; triggered palsy does',()=>{
 for(const trigger of [false,true]){const f=make();enemy(f);until(f,()=>!!f.combat.phase);f.b.applyStatus(f.u,'palsy',{duration:10,value:1});f.b.applyStatus(f.u,'silence',{duration:10});
 if(trigger)f.b.emit('palsyTriggered',{unit:f.u});advance(f.b,.85);assert.equal(f.receipts.length,trigger?0:1);}
});
test('Source replacement during the final form check cannot lend an old command to a new life',()=>{
 let checks=0;const f=make({inPersona:f=>{if(f.combat?.accepting&&++checks===2){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'new-life'};}return f.allow;}});enemy(f);
 advance(f.b,1.05);assert.equal(f.receipts.length,0);assert.equal(attacks(f).length,0);assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
test('No target-free, hidden, invulnerable or out-of-range inputs; range extension cannot change the native selector',()=>{
 const f=make(),a=enemy(f,{flags:{untargetable:true}}),z=enemy(f,{flags:{invulnerable:true}}),h=enemy(f),far=enemy(f,{col:10});h.hidden=true;
 f.b.addBuff(f.u,{key:'fixture:extension',mods:{rangeExtend:10}});assert.equal(f.combat.begin(),false);assert.equal(f.combat.choices().length,0);assert.ok([a,z,h,far].every(t=>t.hp===t.s.maxHp));
});
test('Form change from an accepted recipient stops the remaining unborn outputs',()=>{
 const f=make();Array.from({length:4},()=>enemy(f));f.b.on('damaged',h=>{if(h.source===f.u)f.allow=false;});until(f,()=>f.receipts.length===1);assert.equal(attacks(f).length,1);
});
test('Retained inputs can leave range without redirecting a released command',()=>{
 const f=make(),t=enemy(f);until(f,()=>!!f.combat.phase);t.x+=8;t.tileC+=8;until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(attacks(f).length,1);assert.equal(attacks(f)[0].target,t);
});
test('Fresh selected S3 and both explicit form/clip dispatchers are required',()=>{
 const f=make({defer:true});assert.throws(()=>new MakotoSkillThreeAssault(f.b,f.u),/Fresh selected/);assert.throws(()=>new MakotoSkillThreeAssault(f.b,f.u,{contract:CONTRACT,inPersona:()=>true}),/Fresh selected/);assert.throws(()=>f.combat.install(),/reinstalled/);
 const other=base({skill:2,defer:true});other.controller.stop();assert.throws(()=>new MakotoSkillThreeAssault(other.b,other.u,{contract:CONTRACT,inPersona:()=>true,pickClip:()=>A}),/Fresh selected/);
});
