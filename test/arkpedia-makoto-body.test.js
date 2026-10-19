// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import {MakotoPersonaBody,MAKOTO_BODY_CONTRACT as CONTRACT,makotoBodyInputs} from '../server/sim/content/arkpedia-makoto-body.js';
import {MakotoSkillThreePermission,MAKOTO_S3_PERMISSION_CONTRACT} from '../server/sim/content/arkpedia-makoto-s3-permission.js';
import {MakotoPersonaReturn,MAKOTO_RETURN_CONTRACT} from '../server/sim/content/arkpedia-makoto-return.js';
import {SkillRuntime} from '../server/sim/skills.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {make as base,advance,near,until,enemy} from './helpers/makoto-fixture.js';
const active=new Set();
test.afterEach(()=>{for(const f of active){assert.deepEqual(f.b.errors,[]);f.body.stop();f.permission?.stop();f.ret?.stop();f.controller.stop();}active.clear();});
function make({defer=false,mayEnter,onExpired,permission=false,...build}={}){
  const f=base({...build,defer:true});f.controller.stop();f.expired=[];f.allow=true;
  f.body=new MakotoPersonaBody(f.b,f.u,{contract:CONTRACT,mayEnter:i=>mayEnter?mayEnter(f,i):f.allow,
    onExpired:i=>{f.expired.push({...i,at:f.b.time});onExpired?.(f,i);}});
  if(permission){
    f.permission=new MakotoSkillThreePermission(f.b,f.u,{contract:MAKOTO_S3_PERMISSION_CONTRACT,inPersona:()=>f.body.phase?.mode===3&&f.body.owns(f.body.phase?.parent)});
    const spec=f.permission.prepareSpec({kind:'instant',trigger:'NEVER',canActivate:()=>!f.body.castBlocked(),formCountdown:()=>f.body.countdown()});
    f.b._setupUnit(f.u,{trait:{noAttack:true},skill:spec});
  }else f.u.skill.spec.canActivate=()=>!f.body.castBlocked();
  f.body.install();f.permission?.install();active.add(f);if(!defer)f.deploy();return f;
}
const enter=(f,mode=f.record.index+1,ticket={})=>{assert.equal(f.body.enter({mode,ticket}),true);return ticket;};
const bodyBuff=(f,name)=>f.u.buffs.find(b=>b.data?.makotoBody===f.body&&b.data.nativeKey===name);
const part=(e,id)=>e.characters.char_4217_makoto.flatMap(r=>r.components).find(p=>p.pathId===id).data;
test('Original body producers preserve independent zero/P2 block, trait duration and native stats instructions',()=>{
  const n=makotoBodyInputs();assert.equal(n.duration,20);assert.equal(n.parents.length,3);assert.equal(n.zeros.length,3);
  assert.equal(n.block[1]._buff.attributes.attributeModifiers[0].value,-2);
  assert.equal(n.block[2]._valueKey,'attack@block_cnt');
});
for(const [i,edit]of[
  e=>part(e,'-6032850912082670043')._buffs[0].attributes.abnormalFlags=[1],
  e=>part(e,'-3466145529244168667')._buffs[0].durationKey='other',
  e=>part(e,'-1294480160937161179')._buffs[1].buffKey='other',
  e=>part(e,'1268721692273724965')._buffs.find(b=>b.buffKey==='makoto_stand[block_zero]').attributes.attributeModifiers[0].formulaItem=0,
  e=>e.templates.makoto_standin.eventToActions.ON_BUFF_START[2]._formulaType='ADDITION',
  e=>e.templates.makoto_standin.eventToActions.ON_BUFF_START[3]._valueKey='attack_speed',
  e=>e.templates.makoto_standin.eventToActions.ON_BUFF_START.at(-1)._finishDerivedBuffIfParentFinish=false,
  e=>e.templates.makoto_standin.eventToActions.ON_BUFF_START.at(-1)._buff.lifeTime=20,
  e=>e.templates.makoto_standin_t1_max_hp.eventToActions.ON_BUFF_START[0]._defaultValue=.35,
  e=>e.templates.makoto_standin.eventToActions.ON_BUFF_FINISH[0]._conditionNode._condType='GE',
  e=>e.templates.makoto_s3_2_mod_block_cnt.eventToActions.ON_BUFF_START[0]._buffKey='other',
  e=>e.templates.makoto_s3_2_mod_block_cnt.eventToActions.ON_BUFF_START[1]._buff.attributes.attributeModifiers[0].value=0,
  e=>e.templates.makoto_s3_2_mod_block_cnt.eventToActions.ON_BUFF_START[3]._isDerivedBuff=true,
  e=>e.templates.makoto_s3_1_standin.eventToActions.ON_BUFF_START[0]._formulaType='MULTIPLIER',
  e=>e.tables.character.trait.candidates[0].blackboard.push({key:'max_hp',value:.5,valueStr:null}),
].entries())test(`Changed source Persona body claim ${i+1} is rejected`,()=>{const e=structuredClone(evidence);edit(e);assert.throws(()=>makotoBodyInputs(e),/Changed original/);});

for(const elite of [0,1,2])for(const potential of [1,5])test(`E${elite} P${potential} real body buffs use selected talent stats and preserve HP ratio`,()=>{
  const f=make({elite,potential}),{u,b,body}=f;const base={...u.s};u.hp=base.maxHp*.4;
  b.addBuff(u,{key:'fixture:outside',mods:{atkPct:.25,hpPct:.2,batFlat:.15,blockCnt:3}});void u.s;
  enter(f);near(u.s.atk,u.base.atk*(1+.25+f.record.talentBb[0].atk));near(u.s.maxHp,u.base.maxHp*1.55);
  near(u.hp/u.s.maxHp,.4);near(u.s.bat,u.base.bat+.15+.4);assert.equal(u.s.blockCnt,0);assert.equal(u.s.flags.noSp,true);
  assert.equal(body.castBlocked(),true);assert.deepEqual(body.countdown(),{remaining:20,duration:20,canActivate:false});
  const life=u.deploySeq,skill=u.skill;body.clear();near(u.s.atk,u.base.atk*1.25);near(u.s.maxHp,u.base.maxHp*1.2);
  near(u.hp/u.s.maxHp,.4);assert.equal(u.s.blockCnt,base.blockCnt+3);assert.equal(u.deploySeq,life);assert.equal(u.skill===skill,true);
  assert.equal(f.expired.length,0);assert.equal(body.countdown(),null);assert.equal(body.castBlocked(),false);
});
for(const skill of [1,2,3])test(`S${skill} stops all ordinary SP gain without filling or consuming the real account`,()=>{
  const f=make({skill});f.u.skill.setSpTotal(0);enter(f);advance(f.b,1);
  assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.gainSp(2,'attack'),0);assert.equal(f.u.skill.gainSp(2,'damaged'),0);assert.equal(f.u.skill.gainSp(2,'skill'),0);
  f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.castEligible,skill===3);assert.equal(f.u.skill.activations,0);
  f.body.clear();f.u.skill.setSpTotal(0);advance(f.b,1);near(f.u.skill.spTotal,1,f.b.dt+1e-6);
});
for(const skill of [1,2,3])test(`S${skill} parent expiry is one real world-clock finish independent of slow/control/ASPD`,()=>{
  const f=make({skill});f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:0,aspd:800},flags:{stun:true,silence:true}});
  const ticket=enter(f);advance(f.b,19.9);assert.equal(f.expired.length,0);assert.ok(f.body.countdown().remaining>0);
  until(f,()=>f.expired.length===1);near(f.expired[0].at,20,f.b.dt+1e-6);assert.equal(f.expired[0].ticket===ticket,true);
  assert.equal(f.body.phase,null);assert.equal(f.body.lastExpiry.ticket===ticket,true);assert.equal(bodyBuff(f,'makoto_standin_t1_max_hp'),undefined);
  advance(f.b,2);assert.equal(f.expired.length,1);
});
test('Early parent dispel finishes the HP child but keeps independently born block/ASPD buffs',()=>{
  const f=make({skill:3});enter(f);advance(f.b,2);const p=f.body.phase;
  f.b.removeBuff(f.u,p.parent);assert.equal(f.body.phase,null);assert.equal(f.expired.length,0);assert.equal(bodyBuff(f,'makoto_standin_t1_max_hp'),undefined);
  near(f.u.s.maxHp,f.u.base.maxHp);assert.equal(f.u.s.aspd,160);assert.equal(f.u.s.blockCnt,0);assert.equal(f.u.s.flags.noSp,true);
  advance(f.b,18.1);assert.equal(f.u.s.aspd,100);assert.equal(f.expired.length,0);assert.equal(f.u.s.blockCnt,0);
});
test('Dispelled HP child is not re-created or treated as a parent finish',()=>{
  const f=make();enter(f);f.b.removeBuff(f.u,f.body.phase.hp);advance(f.b,1);
  near(f.u.s.maxHp,f.u.base.maxHp);assert.ok(f.body.phase);assert.equal(f.expired.length,0);assert.equal(bodyBuff(f,'makoto_standin_t1_max_hp'),undefined);
});
test('Refused parent does not fabricate HP/countdown, while independently admitted zero-block and ASPD still exist',()=>{
  const f=make({skill:3});f.b.on('beforeBuff',ctx=>{if(ctx.buff.data?.nativeKey==='makoto_standin')ctx.cancel=true;});
  assert.equal(f.body.enter({mode:3,ticket:{}}),false);assert.equal(f.body.phase,null);assert.equal(f.body.countdown(),null);
  assert.equal(bodyBuff(f,'makoto_standin_t1_max_hp'),undefined);near(f.u.s.maxHp,f.u.base.maxHp);
  assert.equal(f.u.s.blockCnt,0);assert.equal(f.u.s.aspd,160);assert.equal(f.u.s.flags.noSp,true);
  advance(f.b,20.1);assert.equal(f.u.s.aspd,100);assert.equal(f.expired.length,0);
});
for(const rank of Array.from({length:10},(_,i)=>i+1))test(`S3 rank${rank} P6 max-trust body and P2 block use the selected source operands`,()=>{
  const f=make({skill:3,rank,potential:6,trust:200});enter(f);near(f.u.s.atk,f.u.base.atk*(1+f.record.talentBb[0].atk));
  near(f.u.s.aspd,100+f.record.bb['talent@attack_speed']);near(f.u.s.maxHp,f.u.base.maxHp*(1+f.record.talentBb[0].max_hp_t1));
  const saved=f.body.prepareP2({});assert.ok(saved);assert.equal(f.u.s.blockCnt,f.record.bb['attack@block_cnt']);
  assert.equal(f.body.enter({mode:4,...saved}),true);assert.equal(f.u.s.aspd,100);
});
test('S3 P2 captures the old timer, applies separate block additions immediately, and keeps captured time through transition',()=>{
  const f=make({skill:3});enter(f);advance(f.b,4);f.b.addBuff(f.u,{key:'fixture:outside-block',mods:{blockCnt:1}});
  const ticket={},saved=f.body.prepareP2(ticket);near(saved.remaining,16,f.b.dt+1e-6);assert.equal(saved.duration,20);assert.equal(saved.ticket===ticket,true);
  assert.equal(f.body.phase,null);assert.equal(f.expired.length,0);assert.equal(f.u.s.blockCnt,3);assert.equal(f.u.s.aspd,100);
  assert.equal(bodyBuff(f,'makoto_stand[block_dec]').mods.blockCnt,-2);assert.equal(bodyBuff(f,'makoto_stand[s3_2_block]').mods.blockCnt,2);
  advance(f.b,1.5);assert.equal(f.body.enter({mode:4,...saved}),true);
  near(f.body.countdown().remaining,16,f.b.dt+1e-6);assert.equal(f.body.countdown().duration,20);assert.equal(f.body.castBlocked(),true);
  assert.equal(f.u.s.blockCnt,3);assert.equal(f.u.s.aspd,100);until(f,()=>f.expired.length===1);
  near(f.expired[0].at,21.5,2*f.b.dt+1e-6);assert.equal(f.expired[0].mode,4);
});
test('P2 refuses arbitrary/reset/borrowed times and a mode not selected by the real build',()=>{
  const f=make({skill:3}),ticket={};assert.equal(f.body.enter({mode:4,ticket,remaining:20,duration:20}),false);
  enter(f);advance(f.b,2);const saved=f.body.prepareP2(ticket);
  for(const input of [{...saved,remaining:20},{...saved,duration:18},{...saved,ticket:{}},{ticket,remaining:-1,duration:20}])assert.equal(f.body.enter({mode:4,...input}),false);
  assert.equal(f.body.enter({mode:4,...saved}),true);
  const g=make();assert.equal(g.body.enter({mode:2,ticket:{}}),false);assert.equal(g.body.prepareP2({}),null);
  assert.equal(g.body.enter({mode:1,ticket:{},remaining:20,duration:20}),false);
});
test('A return expiry ticket is emitted once, and used form tickets cannot open another parent',()=>{
  const f=make();const ticket=enter(f),old=f.body.phase.parent;
  f.body.clear();assert.equal(f.body.enter({mode:1,ticket}),false);enter(f);
  old.timeLeft=0;old.onExpire();assert.equal(f.expired.length,0);assert.ok(f.body.phase);
});
test('Actual P1 SP-free permission and form HUD coexist with the real body timer, then disappear for P2',()=>{
  const f=make({skill:3,permission:true});f.u.skill.setSpTotal(0);enter(f);until(f,()=>f.u.skill.ready,1);
  assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.castEligible,true);const h=skillHud(f.u.skill);
  assert.equal(h.ready,true);assert.equal(h.canActivate,true);assert.equal(h.state,'active');assert.ok(h.fraction>0&&h.fraction<1);
  const saved=f.body.prepareP2({});assert.equal(f.u.skill.ready,false);assert.equal(f.body.enter({mode:4,...saved}),true);
  advance(f.b,.2);assert.equal(f.u.skill.ready,false);assert.equal(f.u.skill.castEligible,false);assert.equal(skillHud(f.u.skill).canActivate,false);
});
test('P1 actual manual activation consumes no SP or charge while the real noSp parent keeps recovering nothing',()=>{
  const f=make({skill:3,permission:true});f.u.skill.setSpTotal(0);enter(f);until(f,()=>f.u.skill.ready,1);
  const before=f.body.countdown().remaining;assert.equal(f.u.skill.activate('manual'),true);
  assert.equal(f.u.skill.activations,1);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.skill.charges,0);
  advance(f.b,1);assert.ok(f.body.countdown().remaining<before);assert.equal(f.u.skill.spTotal,0);
});
test('Actual natural body expiry starts the source return clock without early all-out expiry guessing',()=>{
  let mode=1;
  const f=make({defer:true,onExpired(f,info){assert.equal(f.body.lastExpiry===info,true);assert.equal(f.ret.start({allOut:true}),true);}});
  f.ret=new MakotoPersonaReturn(f.b,f.u,{contract:MAKOTO_RETURN_CONTRACT,currentMode:()=>mode,
    mayBegin:()=>!!f.body.lastExpiry,hasEnterNormal:()=>false,applySource(kind){if(kind==='loop')mode=5;if(kind==='normal')mode=0;return true;}});
  f.ret.install();f.deploy();enter(f);advance(f.b,19.9);assert.equal(f.ret.phase,null);
  until(f,()=>f.expired.length===1);assert.equal(f.ret.phase.step,'out');until(f,()=>mode===0);
  assert.equal(f.expired.length,1);near(f.b.time,22.43333327770233,3*f.b.dt+1e-6);
});

for(const name of ['makoto_standin','makoto_standin_t1_max_hp','makoto_stand[block_zero]','makoto_s3_1_standin'])for(const mutation of ['reject','mods','time','name'])test(`Body ${name}/${mutation} admission cannot change source operands`,()=>{
  const f=make({skill:3});f.b.on('beforeBuff',ctx=>{if(ctx.buff.data?.nativeKey!==name)return;
    if(mutation==='reject')ctx.cancel=true;if(mutation==='mods')ctx.buff.mods.atkPct=9;
    if(mutation==='time')ctx.buff.timeLeft=1;if(mutation==='name')ctx.buff.data.nativeKey='forged';
  });const yes=f.body.enter({mode:3,ticket:{}});assert.equal(yes,name!=='makoto_standin');assert.equal(bodyBuff(f,name),undefined);
  assert.equal(f.u.buffs.some(b=>b.mods?.atkPct===9),false);assert.equal(f.u.buffs.some(b=>b.data?.nativeKey==='forged'),false);
  if(name==='makoto_standin_t1_max_hp')near(f.u.s.maxHp,f.u.base.maxHp);
  if(name==='makoto_stand[block_zero]')assert.equal(f.u.s.blockCnt,f.u.base.blockCnt);
});
for(const which of ['makoto_stand[block_dec]','makoto_stand[s3_2_block]'])test(`Independent P2 ${which} refusal does not fabricate its missing operand`,()=>{
  const f=make({skill:3});enter(f);f.b.on('beforeBuff',ctx=>{if(ctx.buff.data?.nativeKey===which)ctx.cancel=true;});
  const saved=f.body.prepareP2({});assert.ok(saved);assert.equal(bodyBuff(f,which),undefined);
  assert.equal(f.u.s.blockCnt,which==='makoto_stand[block_dec]'?4:0);
});
for(const which of ['makoto_stand[block_dec]','makoto_stand[s3_2_block]'])test(`Reentrant clear within P2 ${which} cannot leave unborn block grants or authorize old entry`,()=>{
  const f=make({skill:3});enter(f);f.b.on('beforeBuff',ctx=>{if(ctx.buff.data?.nativeKey===which)f.body.clear();});
  assert.equal(f.body.prepareP2({}),null);assert.equal(f.body.prepared,null);assert.equal(f.body.buffs.size,0);assert.equal(f.u.s.blockCnt,f.u.base.blockCnt);
});
for(const name of ['makoto_standin','makoto_standin_t1_max_hp','makoto_stand[block_zero]','makoto_s3_1_standin'])test(`A source clear during ${name} admission cancels the old form producer`,()=>{
  const f=make({skill:3});f.b.on('beforeBuff',ctx=>{if(ctx.buff.data?.nativeKey===name)f.body.clear();});
  assert.equal(f.body.enter({mode:3,ticket:{}}),false);assert.equal(f.body.phase,null);assert.equal(f.body.buffs.size,0);
  assert.equal(f.u.buffs.some(b=>b.data?.makotoBody===f.body),false);assert.equal(f.expired.length,0);
});
test('A retained old HP-child callback and parent finish cannot clear a new form or invoke another expiry',()=>{
  const f=make({skill:3});enter(f);const old=f.body.phase;f.body.clear();enter(f);const current=f.body.phase;
  old.parent.timeLeft=0;old.parent.onExpire();old.parent.onRemove();old.hp.onRemove();
  assert.equal(f.body.phase===current,true);assert.equal(f.body.owns(current.parent),true);assert.equal(f.body.owns(current.hp),true);
  assert.equal(f.expired.length,0);near(f.u.s.maxHp,f.u.base.maxHp*1.35);
});
test('Clearing after P2 preparation revokes the captured entry without damaging foreign block buffs',()=>{
  const f=make({skill:3});enter(f);const saved=f.body.prepareP2({});f.b.addBuff(f.u,{key:'fixture:foreign-block',mods:{blockCnt:2}});
  f.body.clear();assert.equal(f.body.enter({mode:4,...saved}),false);assert.equal(f.u.s.blockCnt,4);assert.equal(f.body.buffs.size,0);
});
for(const how of ['retreat','death','life','account','hidden','end','stop'])test(`${how} cancels owned body work without expiry or removal of a foreign buff`,()=>{
  const f=make({skill:3});enter(f);f.b.addBuff(f.u,{key:'fixture:foreign',mods:{atkPct:.1},persist:true});
  if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='life')f.u.deploySeq++;
  if(how==='account')f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'instant'},f.u.def.skill.bb);
  if(how==='hidden')f.u.hidden=true;if(how==='end'){f.b.finished=true;f.b.emit('battleEnd',{});}if(how==='stop')f.body.stop();
  advance(f.b,21);assert.equal(f.expired.length,0);assert.equal(f.body.phase,null);assert.equal(f.body.handles.length,0);
  assert.equal(f.u.buffs.some(b=>b.key==='fixture:foreign'),true);
});
for(const how of ['replace','stop','clear','recursive'])test(`${how} inside entry admission cannot duplicate or donate buffs`,()=>{
  const f=make({mayEnter(f){if(how==='replace')f.u.deploySeq++;if(how==='stop')f.body.stop();if(how==='clear')f.body.clear();
    if(how==='recursive')assert.equal(f.body.enter({mode:1,ticket:{}}),false);return true;}});
  const yes=f.body.enter({mode:1,ticket:{}});assert.equal(yes,how==='recursive'||how==='clear');
  assert.equal(f.u.buffs.filter(b=>b.data?.nativeKey==='makoto_standin').length,yes?1:0);
});
test('Throwing owner queries clear owned state before propagating',()=>{
  const f=make({mayEnter(){throw Error('diagnostic owner');}});assert.throws(()=>f.body.enter({mode:1,ticket:{}}),/diagnostic owner/);
  assert.equal(f.body.phase,null);assert.equal(f.body.buffs.size,0);
});
test('A replaced parent cannot keep its derived HP child or remove a foreign replacement',()=>{
  const f=make();enter(f);const old=f.body.phase.parent;
  const foreign=f.b.addBuff(f.u,{key:old.key,source:null,mods:{defFlat:19}});advance(f.b,f.b.dt);
  assert.equal(f.body.phase,null);assert.equal(bodyBuff(f,'makoto_standin_t1_max_hp'),undefined);assert.equal(f.u.buffs.includes(foreign),true);assert.equal(f.expired.length,0);
});
test('Fresh exact constructor and installation ownership are required',()=>{
  const f=make({defer:true});assert.throws(()=>f.body.install(),/cannot be reinstalled/);
  assert.throws(()=>new MakotoPersonaBody(f.b,f.u,{contract:{...CONTRACT},mayEnter:()=>true,onExpired(){}}),/exact body/);
  f.deploy();assert.throws(()=>new MakotoPersonaBody(f.b,f.u,{contract:CONTRACT,mayEnter:()=>true,onExpired(){}}),/Fresh selected/);
});
test('Body installation requires the actual selected account, not a missing or borrowed skill',()=>{
  for(const how of ['none','wrong-id','other-unit']){
    const f=base({defer:true});f.controller.stop();const c=new MakotoPersonaBody(f.b,f.u,{contract:CONTRACT,mayEnter:()=>true,onExpired(){}});
    if(how==='none')f.u.skill=null;if(how==='wrong-id')f.u.skill.id='other';if(how==='other-unit')f.u.skill.unit={};
    assert.throws(()=>c.install(),/real selected account/);assert.deepEqual(f.b.errors,[]);
  }
});
test('Persona stat attachment preserves injured HP ratio and literal source healing still honors transition HEAL_FREE',()=>{
  const f=make();f.u.hp=f.u.s.maxHp*.2;enter(f);near(f.u.hpRatio,.2);
  f.b.addBuff(f.u,{key:'fixture:source-transition-heal-free',flags:{healFree:true}});
  const native=evidence.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START[0],before=f.u.hp;
  assert.equal(f.b.heal(f.u,f.u,f.u.s.maxHp,{ignoreHealFree:native._ignoreHealFree,skipModifierEvent:native._skipModifierEvent}),0);
  near(f.u.hp,before);assert.equal(f.expired.length,0);
});
test('Entering zero-block releases actual blocked enemies but does not damage or withdraw either life',()=>{
  const f=make();const e=enemy(f,{row:5,col:5});f.b._checkBlock(e);assert.equal(e.blockedBy===f.u,true);
  const hp=e.hp,seq=f.u.deploySeq;enter(f);assert.equal(e.blockedBy,null);assert.equal(e.hp,hp);assert.equal(f.u.deploySeq,seq);assert.equal(f.u.deployed,true);
});
test('Early zero-block has its own source ticket and does not create a Persona timer or stats before the mode changes',()=>{
 const f=make(),ticket={};assert.equal(f.body.produceZeroBlock(ticket),true);assert.equal(f.u.s.blockCnt,0);assert.equal(f.body.phase,null);
 near(f.u.s.atk,f.u.base.atk);near(f.u.s.maxHp,f.u.base.maxHp);advance(f.b,1);
 assert.equal(f.body.enter({mode:1,ticket}),true);near(f.body.countdown().remaining,20);near(f.u.s.maxHp,f.u.base.maxHp*1.35);
 assert.equal(f.body.produceZeroBlock(ticket),false);
});
test('A refused early zero-block producer is not retried when the later mode-bound parent is admitted',()=>{
 const f=make(),ticket={};const h=f.b.on('beforeBuff',c=>{if(c.buff.data?.nativeKey==='makoto_stand[block_zero]')c.cancel=true;});
 assert.equal(f.body.produceZeroBlock(ticket),false);f.b.off(h);assert.equal(f.body.enter({mode:1,ticket}),true);assert.equal(f.u.s.blockCnt,2);
});
test('P2 before-block boundary runs after timer capture and before independent block admission',()=>{
 const f=make({skill:3});enter(f);advance(f.b,2);let called=false;
 const saved=f.body.prepareP2({}, {beforeBlock:input=>{called=true;near(input.remaining,18,f.b.dt+1e-6);assert.equal(f.body.phase,null);assert.equal(bodyBuff(f,'makoto_stand[block_dec]'),undefined);return true;}});
 assert.equal(called,true);assert.ok(saved);assert.equal(f.u.s.blockCnt,2);
});
test('A refused or throwing P2 source boundary cannot leave a captured ticket or later block grant',()=>{
 for(const fail of['reject','clear','throw']){const f=make({skill:3});enter(f);const invoke=()=>f.body.prepareP2({}, {beforeBlock:()=>{if(fail==='throw')throw Error('boundary');if(fail==='clear')f.body.clear();return fail!=='reject';}});
  if(fail==='throw')assert.throws(invoke,/boundary/);else assert.equal(invoke(),null);assert.equal(f.body.prepared,null);assert.equal(f.body.buffs.size,0);
 }
});
test('Original parent producer must remain under its corresponding mode Talents/Body hierarchy',()=>{
 const n=structuredClone(evidence),r=n.characters.char_4217_makoto.find(r=>r.components.some(p=>p.pathId==='-1294480160937161179'));
 r.components.find(p=>p.type==='Transform').data.m_Father.m_PathID='0';assert.throws(()=>makotoBodyInputs(n),/Changed original/);
});
