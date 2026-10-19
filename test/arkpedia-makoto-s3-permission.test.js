// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as base,advance,near,until} from './helpers/makoto-fixture.js';
import {MakotoSkillThreePermission,MAKOTO_S3_PERMISSION_CONTRACT as CONTRACT,verifyMakotoS3Permission} from '../server/sim/content/arkpedia-makoto-s3-permission.js';
import {makotoS3PermissionInputs} from '../server/sim/content/arkpedia-makoto-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {SkillRuntime} from '../server/sim/skills.js';
const active=new Set();test.afterEach(()=>{for(const f of active){f.combat.stop();assert.deepEqual(f.b.errors,[]);}active.clear();});
function make({inPersona,defer=false,spec={},...build}={}){
 const f=base({...build,skill:3,defer:true});f.controller.stop();f.allow=false;f.uses=0;f.starts=[];
 f.combat=new MakotoSkillThreePermission(f.b,f.u,{contract:CONTRACT,inPersona:inPersona?()=>inPersona(f):()=>f.allow});
 const prepared=f.combat.prepareSpec({kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'},onStart:()=>f.uses++,...spec});
 f.b._setupUnit(f.u,{trait:{noAttack:true},talents:[],skill:prepared});f.combat.install();f.b.bench['diagnostic:makoto']={unit:f.u};
 f.b.on('skillStart',h=>{if(h.unit===f.u)f.starts.push(h);});active.add(f);if(!defer)f.deploy();return f;
}
const enter=f=>{f.u.skill.setSpTotal(0);f.b.addBuff(f.u,{key:'fixture:persona-sp-stop',flags:{noSp:true}});f.allow=true;advance(f.b,f.b.dt);};
const ready=f=>{enter(f);until(f,()=>f.u.skill.ready,1);};
const cast=f=>f.b.activateOperator('diagnostic:makoto');
for(const rank of Array.from({length:10},(_,i)=>i+1))test(`S3 rank${rank} retains the native delayed derived permission and casts at zero real SP`,()=>{
 const f=make({rank});enter(f);const phase=f.combat.phase;assert.ok(f.combat.parent);assert.equal(f.combat.child,null);assert.equal(f.u.skill.ready,false);
 near(phase.nextAt,.07000000029802322);advance(f.b,f.b.dt);assert.equal(f.u.skill.ready,false);until(f,()=>f.u.skill.ready,1);
 assert.ok(f.combat.child);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.charges,0);assert.equal(cast(f),true);assert.equal(f.uses,1);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.charges,0);
 assert.equal(f.starts.length,1);assert.equal(f.starts[0].reason,'manual');assert.equal(f.starts[0].activation,1);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.pending,false);
});
test('The source custom first interval stays on the world clock despite ASPD, slowdown zero and action control',()=>{
 const f=make();f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true,disarm:true,silence:true},mods:{aspd:500,slowDownMul:0}});ready(f);
 assert.equal(f.b.time,4*f.b.dt);assert.equal(f.u.skill.ready,true);assert.equal(cast(f),false);assert.equal(f.uses,0);assert.equal(f.u.skill.spTotal,0);
});
for(const reason of ['SP_FULL','HIT','TAKE_DAMAGE','AUTO_OP','fixture'])test(`Native manual-only permission rejects ${reason} even with a full stored charge or explicit free flag`,()=>{
 const f=make();ready(f);f.u.skill.setSpTotal(f.u.skill.spCost);const stored=f.u.skill.spTotal;
 assert.equal(f.u.skill.activate(reason),false);assert.equal(f.u.skill.activate(reason,{free:true}),false);assert.equal(f.u.skill.spTotal,stored);assert.equal(f.u.skill.activations,0);
});
test('Permission does not consume a charge that was explicitly gifted while SP recovery was stopped',()=>{
 const f=make();ready(f);f.u.skill.setSpTotal(f.u.skill.spCost);const before=f.u.skill.spTotal;assert.equal(cast(f),true);assert.equal(f.u.skill.spTotal,before);assert.equal(f.u.skill.charges,1);
});
test('P1 permission can finish inside onStart while preserving one accepted ordinary skill event',()=>{
 const f=make();f.u.skill.spec.onStart=()=>{f.uses++;f.allow=false;f.combat.clear();};ready(f);assert.equal(cast(f),true);assert.equal(f.starts.length,1);assert.equal(f.uses,1);assert.equal(f.u.skill.ready,false);assert.equal(f.combat.child,null);
});
test('The independent form countdown can expose the actual zero-SP ready action without changing the account',()=>{
 const f=make();f.u.skill.spec.formCountdown=()=>f.allow?{remaining:10,duration:20,label:'Persona',canActivate:f.combat.permitted()}:null;enter(f);
 let hud=skillHud(f.u.skill);assert.equal(hud.canActivate,false);assert.equal(hud.ready,false);near(hud.fraction,.5);until(f,()=>f.u.skill.ready,1);
 hud=skillHud(f.u.skill);assert.equal(hud.canActivate,true);assert.equal(hud.ready,true);assert.equal(hud.state,'active');assert.equal(hud.text,'Persona · 10s · Ready');assert.equal(f.u.skill.spTotal,0);
 delete f.u.skill.spec.formCountdown;hud=skillHud(f.u.skill);assert.equal(hud.ready,true);assert.equal(hud.canActivate,true);assert.match(hud.text,/0 \/ 15 SP/);
});
test('Existing form timers remain inert even when the underlying skill has SP or free permission',()=>{
 const f=make();ready(f);f.u.skill.spec.formCountdown=()=>({remaining:10,duration:20,label:'Persona'});const hud=skillHud(f.u.skill);assert.equal(hud.canActivate,false);assert.equal(hud.ready,false);assert.equal(hud.text,'Persona · 10s');
});
for(const part of ['parent','child'])test(`${part} dispel removes commands and does not fabricate a new permission in the same mode`,()=>{
 const f=make();ready(f);f.b.removeBuff(f.u,f.combat[part]);assert.equal(f.u.skill.ready,false);advance(f.b,.4);assert.equal(f.u.skill.ready,false);assert.equal(f.combat.child,null);
 f.allow=false;advance(f.b,f.b.dt);f.allow=true;until(f,()=>f.u.skill.ready,1);assert.ok(f.combat.child);
});
for(const how of ['mode','retreat','death','replace','account','stop','end'])test(`Source ${how} cannot transfer an old free/manual-only command to a different life/account`,()=>{
 const f=make();ready(f);const account=f.u.skill;
 if(how==='mode')f.allow=false;if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replace')f.u.deploySeq++;if(how==='account')f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'instant',trigger:'NEVER'},f.u.def.skill.bb);
 if(how==='stop')f.combat.stop();if(how==='end'){f.b.finished=true;f.b.emit('battleEnd',{});}assert.equal(account.manualCastWithoutSp,false);advance(f.b,f.b.dt);assert.equal(f.combat.child,null);assert.equal(account.manualCastWithoutSp,false);
});
for(const which of ['parent','child'])for(const how of ['reject','source','account','metadata'])test(`beforeBuff ${which}/${how} cannot install inherited permission`,()=>{
 const f=make();f.b.on('beforeBuff',h=>{if(!h.buff.key.startsWith('makoto:s3-permission:')||h.buff.key.endsWith(':child')!==(which==='child'))return;
 if(how==='reject')h.cancel=true;if(how==='source')f.u.deploySeq++;if(how==='account')f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'instant',trigger:'NEVER'},f.u.def.skill.bb);if(how==='metadata')h.buff.key='foreign';
 });enter(f);advance(f.b,.3);assert.equal(f.u.skill.ready,false);assert.equal(f.combat.child,null);assert.equal(f.u.buffs.some(b=>b.key==='foreign'),false);
});
test('A retained old parent callback cannot clear the new mode entry permission',()=>{
 const f=make();ready(f);const remove=f.combat.parent.onRemove;f.allow=false;advance(f.b,f.b.dt);f.allow=true;until(f,()=>f.u.skill.ready,1);const current=f.combat.child;remove();assert.equal(f.combat.child,current);assert.equal(f.u.skill.ready,true);
});
test('A recursive mode query cannot install a second producer or child',()=>{
 let armed=false;const f=make({inPersona:f=>{if(armed){armed=false;f.combat.tick();}return f.allow;}});armed=true;ready(f);assert.equal(f.u.buffs.filter(b=>b.key.startsWith('makoto:s3-permission:')).length,2);
});
test('Throwing mode queries clear owned permission before propagating',()=>{
 let fail=false;const f=make({inPersona:f=>{if(fail)throw Error('fixture query');return f.allow;}});ready(f);fail=true;assert.throws(()=>f.combat.permitted(),/fixture query/);assert.equal(f.combat.child,null);assert.equal(f.combat.parent,null);
});
for(const [label,edit]of[
 ['rounded first interval',n=>n.producer._buffs[0].firstTriggerInterval=.07],['different wait flag',n=>n.producer._buffs[0].waitFirstTriggerInterval=1],
 ['missing derived lifetime',n=>n.templates.makoto_s3_1_create_allow_cast_skill.eventToActions.ON_BUFF_TRIGGER[0]._finishDerivedBuffIfParentFinish=false],
 ['SP cost at start',n=>n.templates.makoto_s3_1_allow_cast_skill.eventToActions.ON_BUFF_START[0]._noSp=false],['automatic trigger',n=>n.templates.makoto_s3_1_allow_cast_skill.eventToActions.ON_BUFF_START[1]._value=false],
])test(`Changed original S3 permission ${label} is rejected`,()=>{const n=structuredClone(makotoS3PermissionInputs());edit(n);assert.throws(()=>verifyMakotoS3Permission(n),/Changed original/);});
test('A free manual permission alone cannot fund a nonmanual activation with no SP',()=>{
 const f=make();f.u.skill.spec.manualCastWithoutSp=()=>true;f.u.skill.spec.manualTriggerOnly=()=>false;f.u.skill.setSpTotal(0);assert.equal(f.u.skill.ready,true);
 assert.equal(f.u.skill.activate('AUTO_OP'),false);assert.equal(f.u.skill.activations,0);assert.equal(f.u.skill.charges,0);
});
test('Normal fee-based casting resumes without modifying the real SP account after permission ends',()=>{
 const f=make();ready(f);f.combat.clear();assert.equal(f.u.skill.ready,false);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(cast(f),true);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.activations,1);
});
for(const how of ['life','account','control','silence','eligible','exhausted'])test(`Permission query ${how} changes cannot lend a new life/account an accepted cast`,()=>{
 const f=make();f.u.skill.setSpTotal(0);const account=f.u.skill;account.spec.manualTriggerOnly=()=>false;
 account.spec.manualCastWithoutSp=()=>{if(how==='life')f.u.deploySeq++;if(how==='account')f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'instant'},f.u.def.skill.bb);
 if(how==='control')f.b.applyStatus(f.u,'stun',{duration:1});if(how==='silence')f.b.applyStatus(f.u,'silence',{duration:1});if(how==='eligible')account.spec.canActivate=()=>false;if(how==='exhausted')account.spec.isExhausted=()=>true;return true;};
 assert.equal(account.activate('manual'),false);assert.equal(account.activations,0);assert.equal(account.charges,0);assert.equal(f.starts.length,0);
});
test('A permission controller cannot bind after its deployment event or replace foreign spec commands',()=>{
 const f=base({skill:3,defer:true});f.controller.stop();const permission=new MakotoSkillThreePermission(f.b,f.u,{contract:CONTRACT,inPersona:()=>true});
 assert.throws(()=>permission.prepareSpec({manualCastWithoutSp:()=>true}),/foreign native cast/);const spec=permission.prepareSpec({kind:'instant',trigger:'NEVER'});f.b._setupUnit(f.u,{trait:{noAttack:true},skill:spec});f.deploy();assert.throws(()=>permission.install(),/fresh real skill/);assert.deepEqual(f.b.errors,[]);
});
