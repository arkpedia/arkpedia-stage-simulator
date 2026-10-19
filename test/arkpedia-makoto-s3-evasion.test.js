// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as base,enemy,advance,near} from './helpers/makoto-fixture.js';
import {MakotoSkillThreeEvasion,MAKOTO_S3_EVASION_CONTRACT as CONTRACT,verifyMakotoS3Evasion} from '../server/sim/content/arkpedia-makoto-s3-evasion.js';
import {makotoS3EvasionInputs} from '../server/sim/content/arkpedia-makoto-source.js';
const active=new Set();test.afterEach(()=>{for(const f of active){f.combat.stop();assert.deepEqual(f.b.errors,[]);}active.clear();});
function make({inPersona,defer=false,...build}={}){
 const f=base({...build,skill:3,defer:true});f.controller.stop();f.allow=false;
 f.combat=new MakotoSkillThreeEvasion(f.b,f.u,{contract:CONTRACT,inPersona:inPersona?()=>inPersona(f):()=>f.allow});
 f.b._setupUnit(f.u,{trait:{noAttack:true},talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});f.combat.install();active.add(f);if(!defer)f.deploy();return f;
}
function ally(f,{row=5,col=6,flags={},kind='op'}={}){
 const t=f.b._makeAlly(f.u.player,f.u.def,kind,row,col,{dir:'RIGHT'});f.b._setupUnit(t,{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}});
 f.u.player.dp=99;assert.ok(f.b._deploy(t,{initial:false}));Object.assign(t.base,{maxHp:10000,def:0,res:0});t.markDirty();t.hp=t.s.maxHp;
 f.b.addBuff(t,{key:'fixture:recipient',flags});return t;
}
const enter=f=>{f.allow=true;advance(f.b,f.b.dt);};
const member=(f,t)=>f.combat.members.get(t);
for(const rank of Array.from({length:10},(_,i)=>i+1))test(`P2 rank${rank} derives independent selected-probability Physical/Arts evasion on both self and operator recipients`,()=>{
 const f=make({rank}),t=ally(f);enter(f);for(const a of [t,f.u]){const p=member(f,a);assert.ok(p);assert.ok(p.parent);assert.ok(p.child);assert.notEqual(p.parent,p.child);near(a.s.dodgePhys,f.record.bb['attack@prob']);near(a.s.dodgeArts,f.record.bb['attack@prob']);assert.equal(p.child.source,f.u);}
 assert.equal(f.receipts.length,0);assert.equal(f.b.projectiles.list.length,0);
});
for(const type of ['phys','arts'])for(const applyWay of ['melee','ranged','none'])test(`P2 ${type}/${applyWay} uses one normal dodge/missed receipt and prevents HP/shield damage`,()=>{
 const f=make(),t=ally(f),e=enemy(f);enter(f);let rolls=0,dodges=0;const outcomes=[];f.b.rng=()=>{rolls++;return .1;};
 f.b.on('dodge',h=>{if(h.target===t)dodges++;});f.b.on('beforeTargetModifier',h=>{if(h.target===t)outcomes.push(h.outcome);});const shield=f.b.addBuff(t,{key:'fixture:shield',shield:100});
 assert.equal(f.b.dealDamage(e,t,{amount:100,type,applyWay}),0);assert.equal(rolls,1);assert.equal(dodges,1);assert.deepEqual(outcomes,['missed']);near(t.hp,10000);near(shield.shield,100);near(t.stats.taken,0);
});
for(const type of ['true','elemental'])test(`P2 does not grant ${type} immunity`,()=>{
 const f=make(),t=ally(f),e=enemy(f);enter(f);let rolls=0;f.b.rng=()=>{rolls++;return 0;};assert.equal(f.b.dealDamage(e,t,{amount:100,type}),100);assert.equal(rolls,0);near(t.hp,9900);
});
for(const type of ['phys','arts'])test(`Unmissable ${type} bypasses the P2 dodge probability`,()=>{
 const f=make(),t=ally(f),e=enemy(f);enter(f);let rolls=0;f.b.rng=()=>{rolls++;return 0;};assert.equal(f.b.dealDamage(e,t,{amount:100,type,canDodge:false}),100);assert.equal(rolls,0);
});
test('A failed hit-rate roll does not add a P2 evasion roll or duplicate the missed receipt',()=>{
 const f=make(),t=ally(f),e=enemy(f);enter(f);f.b.addBuff(e,{key:'fixture:inaccuracy',mods:{hitRatePhys:-.5}});let rolls=0;f.b.rng=()=>{rolls++;return .9;};
 assert.equal(f.b.dealDamage(e,t,{amount:100,type:'phys'}),0);assert.equal(rolls,1);
});
test('Existing unrelated evasion combines failure probabilities instead of becoming additive certainty',()=>{
 const f=make(),t=ally(f),e=enemy(f);enter(f);f.b.addBuff(t,{key:'foreign:dodge',mods:{dodgePhys:.5,dodgeArts:.5}});near(t.s.dodgePhys,.7);near(t.s.dodgeArts,.7);
 f.b.rng=()=>.71;assert.equal(f.b.dealDamage(e,t,{amount:100,type:'phys'}),100);f.b.rng=()=>.69;assert.equal(f.b.dealDamage(e,t,{amount:100,type:'arts'}),0);
 f.allow=false;advance(f.b,f.b.dt);near(t.s.dodgePhys,.5);assert.ok(t.findBuff('foreign:dodge'));
});
test('P2 aura is not a healing selector: heal-free and noHeal operators remain eligible',()=>{
 const f=make(),h=ally(f,{flags:{healFree:true}}),n=ally(f,{col:4,flags:{noHeal:true}});enter(f);assert.ok(member(f,h)?.child);assert.ok(member(f,n)?.child);
});
for(const how of ['token','device','hidden','isolated','target-free','far'])test(`Original friendly operator selector excludes ${how}`,()=>{
 const f=make(),t=ally(f,{kind:['token','device'].includes(how)?how:'op',col:how==='far'?10:6,flags:how==='isolated'?{isolated:true}:how==='target-free'?{untargetable:true}:{}});
 if(how==='hidden')t.hidden=true;f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:10}});enter(f);assert.equal(member(f,t),undefined);near(t.s.dodgePhys,0);
});
test('Airborne operators receive the original ALL-motion aura',()=>{const f=make(),t=ally(f);t.motion='FLY';enter(f);assert.ok(member(f,t)?.child);});
test('Range exit finishes the owned parent and child; reentry can create a new pair',()=>{
 const f=make(),t=ally(f);enter(f);const old=member(f,t),x=t.x,c=t.tileC;t.x+=10;t.tileC+=10;advance(f.b,f.b.dt);assert.equal(old.finished,true);assert.equal(t.buffs.includes(old.child),false);near(t.s.dodgePhys,0);
 t.x=x;t.tileC=c;advance(f.b,f.b.dt);assert.ok(member(f,t)?.child);assert.notEqual(member(f,t),old);
});
for(const how of ['mode','retreat','death','replace','stop','end'])test(`Source ${how} removes only its owned parent/derived child`,()=>{
 const f=make(),t=ally(f);f.b.addBuff(t,{key:'foreign',mods:{dodgeArts:.25}});enter(f);const p=member(f,t);
 if(how==='mode')f.allow=false;if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replace')f.u.deploySeq++;if(how==='stop')f.combat.stop();if(how==='end'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,f.b.dt);
 assert.equal(p.finished,true);assert.equal(t.buffs.includes(p.parent),false);assert.equal(t.buffs.includes(p.child),false);near(t.s.dodgePhys,0);near(t.s.dodgeArts,.25);assert.ok(t.findBuff('foreign'));
});
for(const part of ['parent','child'])test(`Ordinary ${part} dispel respects source-derived lifetime and does not fabricate a child under a surviving parent`,()=>{
 const f=make(),t=ally(f);enter(f);const p=member(f,t);f.b.removeBuff(t,p[part]);advance(f.b,f.b.dt);
 if(part==='parent'){assert.equal(p.finished,true);assert.ok(member(f,t)?.child);assert.notEqual(member(f,t),p);}else{assert.equal(member(f,t),p);assert.equal(t.buffs.includes(p.child),false);near(t.s.dodgePhys,0);}
});
for(const which of ['parent','child'])for(const how of ['reject','source','recipient','metadata','probability'])test(`beforeBuff ${which}/${how} cannot install inherited evasion`,()=>{
 const f=make(),t=ally(f);f.b.on('beforeBuff',h=>{if(h.unit!==t||!h.buff.key.startsWith('makoto:s3-evade:')||h.buff.key.endsWith(':child')!==(which==='child'))return;
 if(how==='reject')h.cancel=true;if(how==='source')f.u.deploySeq++;if(how==='recipient')t.deploySeq++;if(how==='metadata')h.buff.key='foreign-substitution';if(how==='probability')h.buff.mods={dodgePhys:1,dodgeArts:1};
 });enter(f);near(t.s.dodgePhys,0);near(t.s.dodgeArts,0);assert.equal(t.buffs.some(b=>b.key==='foreign-substitution'),false);
});
test('Repeated aura samples keep the same parent/child and do not stack the probability',()=>{
 const f=make(),t=ally(f);enter(f);const p=member(f,t);advance(f.b,2);assert.equal(member(f,t),p);near(t.s.dodgePhys,.4);assert.equal(t.buffs.filter(b=>b.key.endsWith(':child')).length,1);
});
test('Two original caster sources own separate parents and compound independent failure probabilities',()=>{
 const f=make(),other=f.b._makeAlly(f.u.player,f.u.def,'op',5,4,{dir:'RIGHT'});let allowed=true;
 const second=new MakotoSkillThreeEvasion(f.b,other,{contract:CONTRACT,inPersona:()=>allowed});f.b._setupUnit(other,{trait:{noAttack:true},talents:[],skill:{kind:'passive'}});second.install();
 f.u.player.dp=99;assert.ok(f.b._deploy(other,{initial:false}));active.add({b:f.b,combat:second});const t=ally(f);enter(f);near(t.s.dodgePhys,.64);assert.ok(member(f,t)?.child);assert.ok(second.members.get(t)?.child);
 f.allow=false;advance(f.b,f.b.dt);near(t.s.dodgePhys,.4);assert.ok(second.members.get(t)?.child);allowed=false;advance(f.b,f.b.dt);near(t.s.dodgePhys,0);
});
test('Recursive attachment callbacks cannot create extra aura resources',()=>{
 const f=make(),t=ally(f);f.b.on('beforeBuff',h=>{if(h.unit===t&&h.buff.key.startsWith('makoto:s3-evade:'))assert.equal(f.combat.attach(t),null);});enter(f);assert.ok(member(f,t)?.child);near(t.s.dodgePhys,.4);
});
test('A throwing source mode query clears owned resources before propagating the error',()=>{
 let fail=false;const f=make({inPersona:f=>{if(fail)throw Error('fixture query');return f.allow;}}),t=ally(f);enter(f);fail=true;assert.throws(()=>f.combat.active(),/fixture query/);near(t.s.dodgePhys,0);assert.equal(f.combat.members.size,0);
});
for(const [label,edit]of[
 ['shared parent',n=>n.aura._buffs[0].independentCharacterSource=0],['shared child',n=>n.templates.makoto_s3_2_aura.eventToActions.ON_BUFF_START[0]._buff.independentCharacterSource=false],
 ['missing derived finish',n=>n.templates.makoto_s3_2_aura.eventToActions.ON_BUFF_START[0]._finishDerivedBuffIfParentFinish=false],
 ['True immunity',n=>n.templates.evade.eventToActions.ON_TAKE_DAMAGE[0]._damageMask='ALL'],['ground-only',n=>n.validator._targetOptions.targetMotion=1],
])test(`Changed original P2 ${label} is rejected`,()=>{const n=structuredClone(makotoS3EvasionInputs());edit(n);assert.throws(()=>verifyMakotoS3Evasion(n),/Changed original/);});
