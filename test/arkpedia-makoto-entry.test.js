// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-native-operators/char_4217_makoto.json' with {type: 'json'};
import clocks from '../data/arkpedia-makoto-clocks.json' with {type: 'json'};
import {MakotoPersonaEntry, MAKOTO_ENTRY_CONTRACT, makotoEntryPlans} from '../server/sim/content/arkpedia-makoto-entry.js';
import {make as ordinaryFixture, advance, near, until} from './helpers/makoto-fixture.js';

const active = new Set();
test.afterEach(() => {for (const f of active) {assert.deepEqual(f.b.errors, []); f.entry.stop(); f.controller.stop();} active.clear();});
function make({skill = 1, onAction, currentMode, defer = false, ...build} = {}) {
  const f = ordinaryFixture({skill, defer: true, ...build});
  // Isolate entry timing: this recorder is not a composed public Makoto kit.
  f.controller.stop();
  f.mode = 0; f.actions = [];
  f.entry = new MakotoPersonaEntry(f.b, f.u, {contract: MAKOTO_ENTRY_CONTRACT,
    currentMode: currentMode ? () => currentMode(f) : () => f.mode,
    // This is deliberately an instruction recorder, not a fake native buff
    // interpreter. The test commits only its diagnostic external mode.
    applySource(kind, plan, input) {
      f.actions.push({kind, plan, input, at: f.b.time});
      if (kind === 'commit') f.mode = plan.to;
      return onAction ? onAction(f, kind, plan, input) : true;
    }});
  f.entry.install(); active.add(f);
  if (!defer) f.deploy();
  return f;
}
const part = (e, id) => e.characters.char_4217_makoto.flatMap(r => r.components).find(c => c.pathId === id).data;
const count = (f, kind) => f.actions.filter(a => a.kind === kind).length;

test('Each original entry keeps its own three source subabilities, force-Front clips and cast-start producer', () => {
  const plans = makotoEntryPlans();
  assert.deepEqual(plans.map(p => [p.from, p.to, p.fireCastStart]), [[0,1,false],[0,2,false],[0,3,true],[3,4,true]]);
  assert.deepEqual(plans.map(p => p.out.duration), [1,1,1,.5]);
  assert.deepEqual(plans.map(p => p.delay), Array(4).fill(0.9900000095367432));
  assert.ok(plans.every(p => p.duration === 20 && p.healBuff.blackboard[0].value === 1));
  assert.deepEqual(plans.map(p => p.producerBuffs.some(b => b.buffKey === 'makoto_stand[block_zero]')), [true,true,true,false]);
  assert.equal(plans[3].producerBuffs.find(b => b.buffKey === 'makoto_delayed_switchend').blackboard[0].value, 1);
  assert.deepEqual(plans[3].beginBuffs.map(b => b.buffKey), ['makoto_switchbegin','makoto_s3_2_mod_block_cnt']);
  for (const p of plans) {
    assert.equal(p.beginActions.find(a => a.$type.includes('+ClearAllBuffs,'))._alsoRemoveDurableBuff, false);
    assert.equal(p.beginActions.find(a => a.$type.includes('+ClearCharacterSp,'))._forceFlag, false);
    assert.equal(p.healActions[0]._ignoreHealFree, false);
    assert.equal(p.healActions[0]._skipModifierEvent, true);
  }
  assert.ok(Object.isFrozen(plans[3].beginBuff.attributes.abnormalFlags));
  assert.throws(() => {plans[0].delay = 0;}, TypeError);
});

const changes = [
  ['chain order', e => part(e, '9010935887596408357')._abilities.reverse()],
  ['normal branch alias', e => part(e, '9010935887596408357')._metadata.namedAsAlias = 'other'],
  ['source S3 cast-start', e => part(e, '-5036944756814066139')._fireCastStartEventWhenCast = 0],
  ['new abnormal interpretation', e => part(e, '8100680329917746725')._buffs[0].attributes.abnormalFlags.pop()],
  ['transition pre-delay', e => part(e, '8100680329917746725')._preDelay = 1],
  ['attack-speed clock', e => part(e, '-3264811659591823835')._timeMode = 0],
  ['invented Back clip', e => part(e, '-3264811659591823835')._faceToFront = 0],
  ['lost live slow', e => part(e, '-3264811659591823835')._affectedBySlowDown = 0],
  ['changed full heal', e => part(e, '-3264811659591823835')._activeBuffs[0].blackboard[0].value = .5],
  ['marker dispatch instead of cast-start', e => part(e, '1268721692273724965')._runActionOnEvent = 4],
  ['rounded switch delay', e => part(e, '1268721692273724965')._buffs[1].lifeTime = 1],
  ['lost delayed-duration key', e => part(e, '1268721692273724965')._buffs[1].durationKey = 'duration'],
  ['lost P2 snapshot discriminator', e => part(e, '-5264945501409128923')._buffs[1].blackboard = []],
  ['fabricated S1 SwitchIn marker', e => e.models.char_4217_makoto.Front.eventPayloads.Doll_Skill_1_SwitchIn = [{name:'OnAttack',time:0}]],
];
for (const [label, change] of changes) test(`Changed ${label} fails original entry verification`, () => {
  const e = structuredClone(evidence); change(e); assert.throws(() => makotoEntryPlans(e), /Changed original/);
});
test('Changed literal entry clock or receipt fails closed', () => {
  for (const edit of [c => c.models.Front.exactDurations.SwitchOut = .9, c => c.receiptSha256 = 'other']) {
    const c = structuredClone(clocks); edit(c); assert.throws(() => makotoEntryPlans(evidence, c), /Changed original/);
  }
});

for (const skill of [1,2,3]) for (const dir of ['RIGHT','UP']) test(`S${skill} ${dir} emits source instructions once at original fixed-clock boundaries`, () => {
  const f = make({skill, dir}), {entry: c, b, u} = f;
  b.addBuff(u, {key:'fixture:aspd', mods:{aspd:900}});
  assert.equal(c.start({to:skill}), true);
  assert.deepEqual(f.actions.map(a => a.kind), ['begin','heal']);
  assert.equal(u.mem.regularFormVisual.clip, 'SwitchOut');
  assert.equal(u.mem.regularFormVisual.forceFront, true);
  assert.equal(c.start({to:skill}), false);
  advance(b,.95); assert.equal(count(f,'switchIn'),0);
  until(f, () => count(f,'switchIn') === 1);
  near(f.actions[2].at,1,b.dt + 1e-6);
  assert.equal(u.mem.regularFormVisual.clip, ['Doll_Skill_1_SwitchIn','Doll_Skill_2_SwitchIn','Doll_Skill_3_P1_SwitchIn'][skill-1]);
  advance(b,.9); assert.equal(f.mode,0);
  until(f, () => count(f,'commit') === 1);
  assert.ok(f.actions[3].at - f.actions[2].at >= .9900000095367432 - 1e-8);
  assert.ok(f.actions[3].at - f.actions[2].at <= .9900000095367432 + b.dt);
  assert.deepEqual(f.actions.map(a => a.kind), ['begin','heal','switchIn','commit']);
  assert.equal(f.actions[3].input.remaining,20); assert.equal(f.mode,skill);
  assert.equal(c.phase,null); advance(b,2); assert.equal(f.actions.length,4);
});

test('S3 P1 to P2 captures the old remaining time before begin can clear the external timer', () => {
  let remaining = 7.25;
  const f = make({skill:3, onAction(f, kind) {if (kind === 'begin') remaining = 0; return true;}});
  f.mode = 3;
  assert.equal(f.entry.start({to:4, remaining, duration:20}), true);
  assert.equal(remaining,0);
  assert.equal(f.u.mem.regularFormVisual.clip,'Doll_Skill_3_P1toP2_ChangeBegin');
  advance(f.b,.45); assert.equal(count(f,'switchIn'),0);
  until(f, () => count(f,'switchIn') === 1);
  near(f.actions[2].at,.5,f.b.dt + 1e-6);
  until(f, () => count(f,'commit') === 1);
  assert.deepEqual(f.actions[3].input,{from:3,to:4,remaining:7.25,duration:20,seq:f.u.deploySeq});
  assert.equal(f.mode,4);
});

test('Live slow delays the outgoing animation once; ASPD does not retime either fixed phase', () => {
  const f = make(); f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5,aspd:700}});
  assert.ok(f.entry.start({to:1})); advance(f.b,1.5); assert.equal(count(f,'switchIn'),0);
  until(f,()=>count(f,'switchIn')===1);
  near(f.actions[2].at,2,f.b.dt + 1e-6);
  f.b.addBuff(f.u,{key:'fixture:moreSlow',mods:{slowDownMul:.1,aspd:-500}});
  until(f,()=>count(f,'commit')===1);
  // Delayed buff time is not a second slowed animation clock.
  near(f.actions[3].at - f.actions[2].at,1,f.b.dt + 1e-6);
});

test('Changing slow during outgoing phase applies the new elapsed rate without restarting the phase', () => {
  const f = make(); assert.ok(f.entry.start({to:1})); advance(f.b,.5);
  f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});
  until(f,()=>count(f,'switchIn')===1); near(f.actions[2].at,1.5,f.b.dt + 1e-6);
});
test('Zero slow freezes the outgoing source clock and resumes its remaining progress', () => {
  const f=make(); assert.ok(f.entry.start({to:1})); advance(f.b,.4);
  f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});
  const age=f.entry.phase.age; advance(f.b,2); near(f.entry.phase.age,age);
  assert.equal(count(f,'switchIn'),0); near(f.u.mem.regularFormVisual.speed,0);
  f.b.removeBuff(f.u,'fixture:zero'); until(f,()=>count(f,'switchIn')===1);
  near(f.actions[2].at,3,f.b.dt + 1e-6);
});
test('Zero animation rate during SwitchIn does not freeze the independent delayed buff', () => {
  const f=make(); assert.ok(f.entry.start({to:1})); until(f,()=>count(f,'switchIn')===1);
  f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});
  advance(f.b,.5); near(f.u.mem.regularFormVisual.speed,0);
  until(f,()=>count(f,'commit')===1); near(f.actions[3].at-f.actions[2].at,1,f.b.dt+1e-6);
});

for (const stage of ['out','in']) for (const exit of ['retreat','death','replacement','hidden','stop','battleEnd']) test(`${exit} during ${stage} cancels unborn entry work and preserves foreign visuals`, () => {
  const f = make(); assert.ok(f.entry.start({to:1}));
  if (stage === 'in') until(f,()=>count(f,'switchIn')===1);
  const before = f.actions.length, foreign = {clip:'foreign'}; f.u.mem.regularFormVisual=foreign;
  if(exit==='retreat') f.b.retreat(f.u);
  if(exit==='death') f.b.kill(f.u,null);
  if(exit==='replacement') f.u.deploySeq++;
  if(exit==='hidden') f.u.hidden=true;
  if(exit==='stop') f.entry.stop();
  if(exit==='battleEnd') {f.b.finished=true; f.b.emit('battleEnd',{});}
  advance(f.b,3); assert.equal(f.actions.length,before); assert.equal(f.entry.phase,null);
  assert.equal(f.entry.handles.length,0); assert.equal(f.u.mem.regularFormVisual===foreign,true);
});

for (const kind of ['begin','heal','switchIn','commit']) for (const action of ['replace','stop','reject','recursive']) test(`${action} in ${kind} cannot multiply or donate entry work to another life`, () => {
  const f = make({onAction(f,k) {
    if(k!==kind) return true;
    if(action==='replace') {f.u.deploySeq++; f.u.mem.regularFormVisual={clip:'new-life'};}
    if(action==='stop') f.entry.stop();
    if(action==='reject') return false;
    if(action==='recursive') assert.equal(f.entry.start({to:1}),false);
    return true;
  }});
  f.entry.start({to:1}); advance(f.b,3);
  assert.equal(count(f,kind),1);
  if(action==='recursive') assert.equal(f.actions.length,4);
  else assert.equal(f.actions.length,['begin','heal','switchIn','commit'].indexOf(kind)+1);
  if(action==='replace') assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});

test('A throwing adapter cancels its phase before propagating the failure', () => {
  const f = make({onAction(){throw Error('diagnostic adapter');}});
  assert.throws(()=>f.entry.start({to:1}),/diagnostic adapter/); assert.equal(f.entry.phase,null);
  advance(f.b,3); assert.equal(f.actions.length,1);
});
test('External mode departure cancels the old clock before producer/commit', () => {
  for(const stage of ['out','in']) {
    const f=make(); assert.ok(f.entry.start({to:1})); if(stage==='in') until(f,()=>count(f,'switchIn')===1);
    const n=f.actions.length; f.mode=5; advance(f.b,2); assert.equal(f.actions.length,n); assert.equal(f.entry.phase,null);
  }
});
test('Mode-query replacement cannot write new-life presentation or emit begin', () => {
  let replace=false;
  const f=make({currentMode(f){if(replace) {f.u.deploySeq++; f.u.mem.regularFormVisual={clip:'new-life'};} return 0;}});
  replace=true; assert.equal(f.entry.start({to:1}),false); assert.equal(f.actions.length,0);
  assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
test('Mode-query replacement during tick cannot give the next life a delayed producer', () => {
  let replace=false;
  const f=make({currentMode(f){if(replace) {replace=false; f.u.deploySeq++; f.u.mem.regularFormVisual={clip:'new-life'};} return f.mode;}});
  assert.ok(f.entry.start({to:1})); replace=true; advance(f.b,3);
  assert.equal(f.actions.length,2); assert.equal(f.entry.phase===null,true);
  assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
test('Explicit cancellation clears only entry-owned presentation and permits a fresh same-life entry', () => {
  const f=make(); assert.ok(f.entry.start({to:1})); f.entry.cancel();
  assert.equal(f.u.mem.regularFormVisual,undefined); advance(f.b,2); assert.equal(f.actions.length,2);
  assert.ok(f.entry.start({to:1})); until(f,()=>count(f,'commit')===1); assert.equal(f.actions.length,6);
});
test('An adapter without an explicit acknowledgement cannot silently commit the mode', () => {
  const f=make({onAction(){}});
  assert.equal(f.entry.start({to:1}),false); advance(f.b,3);
  assert.equal(f.actions.length,1); assert.equal(f.entry.phase===null,true); assert.equal(f.mode,0);
});
for (const kind of ['begin','heal','switchIn']) test(`External mode change inside ${kind} cannot emit another old-form instruction`, () => {
  const foreign={clip:'other-mode'};
  const f=make({onAction(f,k){if(k===kind) {f.mode=5; f.u.mem.regularFormVisual=foreign;} return true;}});
  f.entry.start({to:1}); advance(f.b,3);
  assert.equal(f.actions.length,['begin','heal','switchIn'].indexOf(kind)+1);
  assert.equal(f.entry.phase,null); assert.equal(f.u.mem.regularFormVisual===foreign,true);
});
test('A throwing mode query cancels pending work before propagating once', () => {
  let throwing=false;
  const f=make({currentMode(f){if(throwing) throw Error('diagnostic mode query'); return f.mode;}});
  assert.ok(f.entry.start({to:1})); throwing=true;
  assert.throws(()=>f.entry.tick(),/diagnostic mode query/); assert.equal(f.entry.phase,null);
  throwing=false; advance(f.b,3); assert.equal(f.actions.length,2);
});
test('Entry requires the selected skill and legal source modes, and never invents a P2 timer', () => {
  for(const skill of [1,2,3]) {
    const f=make({skill});
    for(const to of [0,1,2,3,4,5,99]) if(to!==skill) assert.equal(f.entry.start({to}),false);
    f.mode=5; assert.equal(f.entry.start({to:skill}),false);
  }
  const f=make({skill:3}); f.mode=3;
  for(const remaining of [undefined,NaN,Infinity,0,-1,21]) assert.equal(f.entry.start({to:4,remaining}),false);
  for(const duration of [0,-1,NaN,Infinity]) assert.equal(f.entry.start({to:4,remaining:1,duration}),false);
});
test('Entry remains independent of skill SP, health, buff clearing and ordinary attacks until the action owner is reviewed', () => {
  const f=make(); f.u.hp=100; f.u.skill.sp=3;
  f.b.addBuff(f.u,{key:'foreign:durable',persist:true}); f.b.addBuff(f.u,{key:'foreign:ordinary'});
  assert.ok(f.entry.start({to:1})); until(f,()=>count(f,'commit')===1);
  assert.equal(f.u.hp,100); assert.ok(f.u.buffs.some(b=>b.key==='foreign:durable'));
  assert.ok(f.u.buffs.some(b=>b.key==='foreign:ordinary')); assert.equal(f.hits.length,0);
});
test('Fresh identity, exact contract, adapters and single installation are required', () => {
  const f=make({defer:true});
  assert.throws(()=>new MakotoPersonaEntry(f.b,f.u),/Fresh selected/);
  assert.throws(()=>new MakotoPersonaEntry(f.b,f.u,{contract:{...MAKOTO_ENTRY_CONTRACT},currentMode:()=>0,applySource:()=>true}),/Fresh selected/);
  assert.throws(()=>f.entry.install(),/reinstalled/);
  const another=new MakotoPersonaEntry(f.b,f.u,{contract:MAKOTO_ENTRY_CONTRACT,currentMode:()=>0,applySource:()=>true});
  assert.throws(()=>another.install(),/reinstalled/);
  f.deploy(); assert.throws(()=>new MakotoPersonaEntry(f.b,f.u,{contract:MAKOTO_ENTRY_CONTRACT,currentMode:()=>0,applySource:()=>true}),/Fresh selected/);
});
