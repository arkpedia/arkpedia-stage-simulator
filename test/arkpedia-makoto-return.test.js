// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import clocks from '../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_RETURN_CONTRACT,MakotoPersonaReturn,makotoReturnPlans} from '../server/sim/content/arkpedia-makoto-return.js';
import {MAKOTO_ALLOUT_CONTRACT,MakotoAllOutCombat} from '../server/sim/content/arkpedia-makoto-allout.js';
import {make as fixture,advance,until,near,enemy} from './helpers/makoto-fixture.js';

const active=new Set();
test.afterEach(()=>{for(const f of active){assert.deepEqual(f.b.errors,[]);f.ret.stop();f.allout?.stop();f.controller.stop();}active.clear();});
function make({skill=1,mode=skill,onAction,onMode,onPermit,onPresence,defer=false,...build}={}){
  const f=fixture({skill,defer:true,...build});f.controller.stop();f.mode=mode;f.present=true;f.allowed=true;f.actions=[];f.polls=[];
  f.ret=new MakotoPersonaReturn(f.b,f.u,{contract:MAKOTO_RETURN_CONTRACT,
    currentMode:()=>onMode?onMode(f):f.mode,mayBegin:i=>onPermit?onPermit(f,i):f.allowed,
    hasEnterNormal:ticket=>{f.polls.push({at:f.b.time,ticket});return onPresence?onPresence(f,ticket):f.present;},
    applySource(kind,plan,input){
      f.actions.push({kind,plan,input,at:f.b.time});
      if(kind==='loop')f.mode=5;if(kind==='normal')f.mode=0;
      return onAction?onAction(f,kind,plan,input):true;
    }});f.ret.install();active.add(f);if(!defer)f.deploy();return f;
}
const count=(f,kind)=>f.actions.filter(a=>a.kind===kind).length;
const part=(e,id)=>e.characters.char_4217_makoto.flatMap(r=>r.components).find(p=>p.pathId===id).data;
const enterLoop=f=>{assert.equal(f.ret.start({allOut:true}),true);until(f,()=>f.ret.phase?.step==='loop');};
const enterEnd=f=>{enterLoop(f);f.present=false;until(f,()=>f.ret.phase?.step==='end');};

test('Original return plans retain distinct plain-zero and all-out-five commits and native full clocks',()=>{
  const [plain,all]=makotoReturnPlans();
  assert.equal(plain.allOut,false);assert.equal(all.allOut,true);
  assert.deepEqual(plain.beginBuffs[0].attributes.abnormalFlags,[5,18,1,6,7,15]);
  assert.deepEqual(all.beginBuffs[0].attributes.abnormalFlags,[5,18,1,6,7,15,24]);
  assert.equal(all.beginBuffs[1].buffKey,'makoto_forbid_idle');
  assert.equal(plain.normalBuff.blackboard[0].value,0);assert.equal(all.normalBuff.blackboard[0].value,0);
  assert.equal(all.loopBuffs[0].blackboard[0].value,5);
  assert.equal(all.broadcastBuff.durationKey,'enter_normal_duration');assert.equal(all.broadcastBuff.lifeTime,0);
  assert.equal(all.out.duration,1);assert.equal(all.out.cooldown,5);
  assert.equal(all.ending.duration,1.4333332777023315);assert.equal(all.ending.cooldown,.20000000298023224);
  assert.equal(all.pollInterval,.009999999776482582);assert.equal(all.loop.clip,'Skill_AllOutAttack_Loop');
  assert.equal(Object.isFrozen(all.normalActions[0]),true);assert.equal(Object.isFrozen(all.beginBuffs),true);
});

const mutations=[
  e=>part(e,'2240692631751609893')._alwaysNext=0,
  e=>part(e,'-7724450873279001051')._fireCastStartEventWhenCast=1,
  e=>part(e,'-6620331043525112283')._finishAllAbilitiesIfOneFinish=1,
  e=>part(e,'-6620331043525112283')._abilities.reverse(),
  e=>part(e,'1173964339455184421')._buffs[0].attributes.abnormalFlags.push(24),
  e=>part(e,'-7444929567886029275')._buffs.pop(),
  e=>part(e,'-8663945982730842587')._activeBuffs[0].blackboard[0].value=.5,
  e=>part(e,'8808127334714560037')._activeBuffs[1].lifeTime=.2,
  e=>part(e,'-84933387190612443')._faceToFront=0,
  e=>part(e,'6602398469392944677')._cooldown=0,
  e=>part(e,'-1013804012337574363')._onlyCheckOnStopAffect=1,
  e=>part(e,'-1013804012337574363')._buffs[0].blackboard[0].value=5,
  e=>part(e,'-6537069888397455835')._buffs[0].blackboard[0].value=0,
  e=>part(e,'-6537069888397455835')._buffs[1].triggerInterval=.1,
  e=>part(e,'351623471385726501')._buffs[0].lifeTime=1.6,
  e=>part(e,'351623471385726501')._buffs[0].blackboard[0].value=1.6,
  e=>part(e,'3959151697636412965')._animKey='Attack_A',
  e=>part(e,'-2365002026277941723').m_GameObject.m_PathID='foreign',
  e=>part(e,'25925036447354405')._replaceAnimPairs[0].toAnimKey='Idle',
  e=>part(e,'-8446961385296114139')._attack.m_PathID='3959151697636412965',
  e=>e.templates.makoto_switchend2normal.eventToActions.ON_BUFF_START[2]._loadModeFromBlackboard=false,
  e=>e.templates.makoto_switchend2normal_endcheck.eventToActions.ON_BUFF_START[0]._failNodes[0]._abilityName='other',
  e=>e.templates.makoto_switchend2normal_endcheck.eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys=['other'],
  e=>e.models.char_4217_makoto.Front.eventPayloads.Skill_AllOutAttack_End[0].time=.2,
];
for(const [i,mutate] of mutations.entries())test(`Changed original return action/clock claim ${i+1} fails closed`,()=>{
  const e=structuredClone(evidence);mutate(e);assert.throws(()=>makotoReturnPlans(e,clocks),/Changed original/);
});
test('Changed original return animation duration or receipt fails closed',()=>{
  for(const change of [c=>c.models.Front.exactDurations.SwitchOut=.9,c=>c.models.Front.exactDurations.Skill_AllOutAttack_End=.13333334028720856,c=>c.receiptSha256='changed']){
    const c=structuredClone(clocks);change(c);assert.throws(()=>makotoReturnPlans(evidence,c),/Changed original/);
  }
});

for(const [skill,mode] of [[1,1],[2,2],[3,3],[3,4]])for(const dir of ['RIGHT','UP'])test(`S${skill} mode${mode} ${dir} plain return commits once after SwitchOut`,()=>{
  const f=make({skill,mode,dir});assert.equal(f.ret.start({allOut:false}),true);
  assert.deepEqual(f.actions.map(a=>a.kind),['begin','heal']);assert.equal(f.u.mem.regularFormVisual.clip,'SwitchOut');
  assert.equal(f.u.mem.regularFormVisual.forceFront,true);advance(f.b,.95);assert.equal(count(f,'normal'),0);
  until(f,()=>count(f,'normal')===1);near(f.actions.at(-1).at,1,f.b.dt+1e-6);
  assert.equal(f.actions.at(-1).input.to,0);assert.equal(f.mode,0);assert.equal(f.ret.phase,null);assert.equal(f.polls.length,0);
  assert.equal(f.u.mem.regularFormVisual,undefined);advance(f.b,3);assert.equal(count(f,'normal'),1);
});
test('All-out broadcast begins in parallel at time zero; outgoing cooldown5 is not a five-second wait',()=>{
  const f=make();assert.equal(f.ret.start({allOut:true}),true);
  assert.deepEqual(f.actions.map(a=>a.kind),['begin','heal','broadcast']);assert.deepEqual(f.actions.map(a=>a.at),[0,0,0]);
  const ticket=f.actions[2].input.ticket;assert.equal(Object.isFrozen(ticket),true);
  until(f,()=>f.ret.phase?.step==='loop');near(f.actions[3].at,1,f.b.dt+1e-6);assert.equal(f.mode,5);
  assert.equal(f.polls.length,1);assert.equal(f.polls[0].at,f.actions[3].at);assert.equal(f.polls[0].ticket===ticket,true);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_AllOutAttack_Loop');assert.equal(f.u.mem.regularFormVisual.loop,true);
  advance(f.b,3);assert.equal(count(f,'normal'),0);assert.equal(f.mode,5);
});
test('An absent owning buff starts the ending on loop entry; its early OnAttack marker is not finish',()=>{
  const f=make();f.present=false;assert.equal(f.ret.start({allOut:true}),true);until(f,()=>f.ret.phase?.step==='end');
  const start=f.b.time;assert.equal(f.u.mem.regularFormVisual.clip,'Skill_AllOutAttack_End');
  advance(f.b,.2);assert.equal(count(f,'normal'),0);advance(f.b,1.1);assert.equal(count(f,'normal'),0);
  until(f,()=>count(f,'normal')===1);near(f.actions.at(-1).at-start,1.4333332777023315,f.b.dt+1e-6);
  assert.equal(f.mode,0);assert.equal(f.ret.phase,null);assert.deepEqual(f.actions.map(a=>a.kind),['begin','heal','broadcast','loop','normal']);
});
test('Buff departure during the wait triggers ending once; reappearing buff does not restart it',()=>{
  const f=make();enterLoop(f);advance(f.b,2);assert.equal(f.ret.phase.step,'loop');
  f.present=false;until(f,()=>f.ret.phase?.step==='end');const start=f.b.time;f.present=true;
  until(f,()=>count(f,'normal')===1);near(f.actions.at(-1).at-start,1.4333332777023315,f.b.dt+1e-6);assert.equal(count(f,'loop'),1);
});
test('Live slow retimes both fixed clips once, while ASPD does not and world polling keeps running',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5,aspd:700}});enterLoop(f);
  near(f.actions[3].at,2,f.b.dt+1e-6);f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});
  const polls=f.polls.length;advance(f.b,.5);assert.ok(f.polls.length>polls);near(f.u.mem.regularFormVisual.speed,0);
  f.present=false;until(f,()=>f.ret.phase?.step==='end');advance(f.b,2);assert.equal(count(f,'normal'),0);
  f.b.removeBuff(f.u,'fixture:zero');const resume=f.b.time;until(f,()=>count(f,'normal')===1);
  near(f.actions.at(-1).at-resume,2*1.4333332777023315,f.b.dt+1e-6);
});
test('A changed slowdown resumes the existing outgoing progress without restarting',()=>{
  const f=make();assert.ok(f.ret.start({allOut:false}));advance(f.b,.4);const age=f.ret.phase.age;
  f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});advance(f.b,1);near(f.ret.phase.age,age);
  f.b.removeBuff(f.u,'fixture:zero');until(f,()=>count(f,'normal')===1);near(f.actions.at(-1).at,2,f.b.dt+1e-6);
});

for(const stage of ['out','loop','end'])for(const exit of ['retreat','death','replacement','hidden','stop','battleEnd'])test(`${exit} during ${stage} cancels unborn return work and preserves foreign art`,()=>{
  const f=make();if(stage==='out')assert.ok(f.ret.start({allOut:true}));else if(stage==='loop')enterLoop(f);else enterEnd(f);
  const before=f.actions.length,foreign={clip:'foreign'};f.u.mem.regularFormVisual=foreign;
  if(exit==='retreat')f.b.retreat(f.u);if(exit==='death')f.b.kill(f.u,null);if(exit==='replacement')f.u.deploySeq++;
  if(exit==='hidden')f.u.hidden=true;if(exit==='stop')f.ret.stop();if(exit==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}
  advance(f.b,3);assert.equal(f.actions.length,before);assert.equal(f.ret.phase,null);assert.equal(f.ret.handles.length,0);
  assert.equal(f.u.mem.regularFormVisual===foreign,true);
});
for(const kind of ['begin','heal','broadcast','loop','normal'])for(const action of ['replace','stop','reject','recursive'])test(`${action} within ${kind} cannot donate or duplicate return work`,()=>{
  const f=make({onAction(f,k){if(k!==kind)return true;
    if(action==='replace'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'new-life'};}
    if(action==='stop')f.ret.stop();if(action==='reject')return false;if(action==='recursive')assert.equal(f.ret.start({allOut:true}),false);return true;}});
  f.present=false;f.ret.start({allOut:true});advance(f.b,5);assert.equal(count(f,kind),1);
  assert.equal(f.actions.length,action==='recursive'?5:['begin','heal','broadcast','loop','normal'].indexOf(kind)+1);
  if(action==='replace')assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
for(const stage of ['out','loop','end'])test(`External mode departure during ${stage} cancels the old branch`,()=>{
  const f=make();if(stage==='out')f.ret.start({allOut:true});else if(stage==='loop')enterLoop(f);else enterEnd(f);
  const n=f.actions.length;f.mode=2;advance(f.b,3);assert.equal(f.actions.length,n);assert.equal(f.ret.phase,null);
});
test('A claimed return may not start from normal, wait mode, wrong skill mode or unapproved expiry',()=>{
  for(const mode of [0,2,3,4,5]){const f=make({mode});assert.equal(f.ret.start({allOut:true}),false);assert.equal(f.actions.length,0);}
  const f=make();f.allowed=false;assert.equal(f.ret.start({allOut:true}),false);f.allowed=true;
  for(const allOut of [undefined,0,1,'true',null])assert.equal(f.ret.start({allOut}),false);
  assert.equal(f.ret.start({allOut:true}),true);assert.equal(f.ret.start({allOut:true}),false);
});
test('Permission/mode queries cannot replace a life or change modes and then authorize old work',()=>{
  for(const replacement of [false,true]){const f=make({onPermit(f){if(replacement)f.u.deploySeq++;else f.mode=0;return true;}});
    assert.equal(f.ret.start({allOut:true}),false);assert.equal(f.actions.length,0);}
});
test('A commit acknowledgement must actually select its exact destination mode',()=>{
  for(const kind of ['loop','normal']){const f=make({onAction(f,k){if(k===kind)f.mode=3;return true;}});f.present=false;
    f.ret.start({allOut:true});advance(f.b,5);assert.equal(count(f,kind),1);assert.equal(f.ret.phase,null);}
});
test('Throwing adapters cancel before errors propagate and do not leave owned visuals',()=>{
  const f=make({onAction(){throw Error('diagnostic source action');}});assert.throws(()=>f.ret.start({allOut:true}),/diagnostic source action/);
  assert.equal(f.ret.phase,null);assert.equal(f.u.mem.regularFormVisual,undefined);
  const g=make({onMode(f){if(f.actions.length>0)throw Error('diagnostic mode');return f.mode;}});
  assert.throws(()=>g.ret.start({allOut:true}),/diagnostic mode/);assert.equal(g.ret.phase,null);
});
test('Throwing, nonboolean and life-mutating owning-buff queries cannot produce an ending',()=>{
  for(const behavior of ['throw','invalid','replace','mode']){const f=make({onPresence(f){
    if(behavior==='throw')throw Error('diagnostic presence');if(behavior==='invalid')return null;
    if(behavior==='replace')f.u.deploySeq++;if(behavior==='mode')f.mode=0;return false;}});
    assert.ok(f.ret.start({allOut:true}));for(let i=0;i<34;i++)f.b.step();assert.equal(count(f,'normal'),0);
    if(behavior==='throw'||behavior==='invalid'){assert.equal(f.b.errors.length,1);f.b.errors=[];}
    advance(f.b,.1);assert.equal(f.ret.phase,null);}
});
test('Fresh installation, exact contract and owner adapters are required',()=>{
  const f=make({defer:true});assert.throws(()=>f.ret.install(),/cannot reinstall/);
  assert.throws(()=>new MakotoPersonaReturn(f.b,f.u,{contract:{...MAKOTO_RETURN_CONTRACT}}),/explicit owner/);
  f.deploy();assert.throws(()=>new MakotoPersonaReturn(f.b,f.u,{contract:MAKOTO_RETURN_CONTRACT,currentMode(){},mayBegin(){},hasEnterNormal(){},applySource(){}}),/Fresh selected/);
  const g=fixture({defer:true});g.controller.stop();const c=new MakotoPersonaReturn(g.b,g.u,{contract:MAKOTO_RETURN_CONTRACT,currentMode:()=>1,mayBegin:()=>true,hasEnterNormal:()=>false,applySource:()=>true});
  g.deploy();assert.throws(()=>c.install(),/Fresh Makoto/);
});
test('Each return branch supplies a distinct frozen broadcast ticket',()=>{
  const f=make();f.present=false;f.ret.start({allOut:true});advance(f.b,3);const first=f.actions.find(a=>a.kind==='broadcast').input.ticket;
  f.mode=1;assert.ok(f.ret.start({allOut:true}));const second=f.actions.filter(a=>a.kind==='broadcast')[1].input.ticket;
  assert.equal(first===second,false);assert.equal(f.actions.at(-1).input.from,1);
});
test('Actual all-out group damage remains independent of return animation/wait state',()=>{
  const f=make({onAction(f,kind,_plan,input){if(kind==='broadcast')f.allout.begin(input.ticket);return true;},defer:true});
  f.allout=new MakotoAllOutCombat(f.b,f.u,{contract:MAKOTO_ALLOUT_CONTRACT,mayBegin:ticket=>f.ret.phase?.ticket===ticket});f.allout.install();
  f.deploy();const target=enemy(f);const hits=[];f.b.on('damaged',h=>{if(h.target===target)hits.push(h);});
  assert.ok(f.ret.start({allOut:true}));advance(f.b,1.5);assert.equal(hits.length,0);assert.equal(f.mode,5);
  until(f,()=>hits.length===1);assert.equal(f.mode,5);assert.equal(f.ret.phase.step,'loop');near(f.b.time,1.6,f.b.dt+1e-6);
  f.present=false;until(f,()=>f.ret.phase===null);assert.equal(f.mode,0);assert.equal(hits.length,1);
});
