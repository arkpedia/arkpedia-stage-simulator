// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, until, near} from './helpers/ju-fixture.js';
import {JuExtraDamage, JU_EXTRA_CONTRACT, verifyJuExtra} from '../server/sim/content/arkpedia-ju-extra.js';
import {juNativeInputs} from '../server/sim/content/arkpedia-ju-source.js';

function make(opts = {}) {
  let extra; const state = {active: true};
  const f = fixture({skill: 2, ...opts, beforeInstall: (b, u) => {
    extra = new JuExtraDamage(b, u, {contract: JU_EXTRA_CONTRACT, affecting: () => state.active}); extra.install();
  }});
  return {...f, extra, state};
}
const target = (f, {ratio = .49, ...opts} = {}) => { const e = enemy(f, {hp: 1e7, ...opts}); e.hp = e.s.maxHp * ratio; return e; };
const hits = f => f.hits.filter(h => h.dmg.tags.includes('ju_s2_extra'));
const queued = f => until(f, () => f.extra.pending.size > 0);
const damaging = f => until(f, () => [...f.extra.pending].some(p => p.stage === 'damage'));

test('S2 extra verifies original polling, delay, retry, source gate and physical NONE packet', () => {
  const times = verifyJuExtra(); near(times.poll, .2); near(times.delay, .6); near(times.damage, .3); near(times.retry, .01);
  for (const mutate of [n => n.s2Aura._removeBuffWhenTargetLeave = 0,
    n => n.templates['ju_s_2[damage]'].eventToActions.ON_BUFF_FINISH[0]._succeedNodes[0]._applyWay = 'RANGED',
    n => n.templates.ju_s_2.eventToActions.ON_BUFF_TRIGGER[0]._failNodes[0]._conditionNode._checkBuffSource = true]) {
    const n = structuredClone(juNativeInputs()); mutate(n); assert.throws(() => verifyJuExtra(n), /Changed original/);
  }
  assert.throws(() => fixture({beforeInstall: (b,u) => new JuExtraDamage(b,u,{contract:JU_EXTRA_CONTRACT,affecting:()=>true})}), /S2 required/);
});

test('The aura has a strict half-HP boundary and no normal attack receipt', () => {
  const f = make(), half = target(f, {ratio: .5}), below = target(f);
  queued(f); assert.equal(f.extra.pending.size, 1); assert.equal([...f.extra.pending][0].target, below);
  assert.equal(half.findBuff('ju_s_2[done]'), null);
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk * f.record.bb.atk_scale_s2_extra);
  assert.equal(hits(f)[0].dmg.applyWay, 'none'); assert.equal(hits(f)[0].dmg.isAttack, false);
  assert.equal(f.receipts.length, 0);
});

test('One extra follows the original delay and additional source-gated damage stage', () => {
  const f = make(); target(f); queued(f); const p = [...f.extra.pending][0], admitted = p.until - f.extra.times.delay;
  advance(f.b, .5); assert.equal(hits(f).length, 0); assert.equal(p.stage, 'delay');
  damaging(f); assert.equal(f.u.findBuff('ju_s_2[source]'), f.extra.gate);
  assert.ok(p.until >= admitted + .9 - 1e-6); assert.equal(hits(f).length, 0);
  until(f, () => hits(f).length === 1); assert.ok(hits(f)[0].time >= admitted + .9 - 1e-6);
  assert.equal(f.extra.pending.size, 0); assert.equal(f.extra.watchers.length, 0);
});

test('Multiple eligible enemies share one caster gate and receive spaced extra hits', () => {
  const f = make(); for (let i = 0; i < 3; i++) target(f);
  queued(f); assert.equal(f.extra.pending.size, 3); until(f, () => hits(f).length === 3);
  for (let i = 1; i < 3; i++) assert.ok(hits(f)[i].time - hits(f)[i-1].time >= .3 - 1e-6);
  assert.equal(new Set(hits(f).map(h => h.target)).size, 3);
});

test('The permanent done key survives aura exit, skill end and a new active window', () => {
  const f = make(), e = target(f); until(f, () => hits(f).length === 1);
  const done = e.findBuff('ju_s_2[done]'); assert.ok(done); assert.equal(done.timeLeft, Infinity);
  f.state.active = false; advance(f.b, .3); assert.equal(e.findBuff('ju_s_2'), null);
  f.state.active = true; advance(f.b, 3); assert.equal(hits(f).length, 1); assert.equal(e.findBuff('ju_s_2[done]'), done);
});

test('Another source\'s done key prevents admission without being adopted or removed', () => {
  const f = make(), e = target(f), other = {};
  const done = f.b.addBuff(e, {key:'ju_s_2[done]', source:other}); advance(f.b, 2);
  assert.equal(f.extra.pending.size, 0); assert.equal(hits(f).length, 0);
  f.extra.stop(); assert.equal(e.findBuff('ju_s_2[done]'), done);
});

test('Removing a done tag permits another delayed hit after the previous chain finishes', () => {
  const f = make(), e = target(f); until(f, () => hits(f).length === 1);
  f.b.removeBuff(e, 'ju_s_2[done]'); until(f, () => hits(f).length === 2);
});

test('Accepted non-derived delay survives aura removal and skill end', () => {
  const f = make(), e = target(f); queued(f); f.state.active = false; e.x = 18; e.y = 17;
  until(f, () => hits(f).length === 1); assert.equal(e.findBuff('ju_s_2'), null);
});

test('Healing an admitted recipient does not cancel or reselect its extra hit', () => {
  const f = make(), e = target(f); queued(f); e.hp = e.s.maxHp;
  until(f, () => hits(f).length === 1); assert.equal(hits(f)[0].target, e);
});

for (const stage of ['delay', 'trigger', 'damage']) test(`External ${stage} removal cancels only that pending chain and preserves done`, () => {
  const f = make(), e = target(f); queued(f);
  if (stage === 'trigger') {
    f.b.addBuff(f.u, {key:'ju_s_2[source]'}); until(f, () => [...f.extra.pending][0]?.stage === 'trigger');
  } else if (stage === 'damage') damaging(f);
  const p = [...f.extra.pending][0]; f.b.removeBuff(e, p.buff); advance(f.b, 2);
  assert.equal(hits(f).length, 0); assert.equal(f.extra.pending.size, 0); assert.equal(f.extra.watchers.length, 0);
  assert.ok(e.findBuff('ju_s_2[done]'));
});

for (const stage of ['delay', 'damage']) test(`Replacing a recipient during ${stage} cannot carry old output into its new life`, () => {
  const f = make(), e = target(f); queued(f); if (stage === 'damage') damaging(f);
  e.deploySeq++; e.hp = e.s.maxHp; f.state.active = false; advance(f.b, 2);
  assert.equal(hits(f).length, 0); assert.equal(e.hp, e.s.maxHp);
  assert.equal(f.extra.pending.size, 0); assert.equal(f.extra.watchers.length, 0);
});

test('Withdrawal before the source gate cancels waiting chains and all owned aura handles', () => {
  const f = make(), e = target(f); queued(f); f.b.retreat(f.u); advance(f.b, 2);
  assert.equal(hits(f).length, 0); assert.equal(f.extra.pending.size, 0); assert.equal(f.extra.watchers.length, 0);
  assert.equal(f.extra.handles.length, 0); assert.equal(e.findBuff('ju_s_2'), null); assert.ok(e.findBuff('ju_s_2[done]'));
});

test('An accepted damage stage survives withdrawal using its own start-ATK fallback', () => {
  const f = make(); target(f); damaging(f); const atk = f.u.s.atk;
  f.b.retreat(f.u); f.u.base.atk = 99999; f.u.markDirty();
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, atk * f.record.bb.atk_scale_s2_extra);
  assert.equal(f.extra.watchers.length, 0);
});

test('A matching live source supplies current damage-stage ATK at finish', () => {
  const f = make(); target(f); damaging(f); f.b.addBuff(f.u, {key:'fixture:atk', mods:{atkMul:2}});
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk * f.record.bb.atk_scale_s2_extra);
});

for (const kind of ['hidden','untargetable']) test(`The final original target-free check rejects ${kind} without retargeting or retry`, () => {
  const f = make(), e = target(f); damaging(f);
  if (kind === 'hidden') e.hidden = true; else f.b.addBuff(e,{key:'fixture:free',flags:{untargetable:true}});
  advance(f.b, 2); assert.equal(hits(f).length, 0); assert.equal(f.extra.pending.size, 0);
  assert.ok(e.findBuff('ju_s_2[done]'));
});

test('Rejected delay still executes the separate original done action', () => {
  const f = make(), e = target(f);
  f.b.on('beforeBuff', c => { if (c.buff.key === 'ju_s_2[damage_dalay]') c.cancel = true; }); advance(f.b, 2);
  assert.ok(e.findBuff('ju_s_2[done]')); assert.equal(f.extra.pending.size,0); assert.equal(hits(f).length,0);
});

test('Rejected damage admission spends the trigger without creating a source gate', () => {
  const f = make(); target(f);
  f.b.on('beforeBuff', c => { if (c.buff.key === 'ju_s_2[damage]') c.cancel = true; }); advance(f.b, 2);
  assert.equal(f.u.findBuff('ju_s_2[source]'),null); assert.equal(f.extra.pending.size,0); assert.equal(hits(f).length,0);
});

test('Reentrant polling during delay admission cannot create a duplicate chain', () => {
  const f = make(); target(f); let entered = false;
  f.b.on('beforeBuff', c => { if (!entered && c.buff.key === 'ju_s_2[damage_dalay]') {entered=true;f.extra.scan();} });
  until(f, () => hits(f).length === 1); advance(f.b, 2); assert.equal(hits(f).length,1);
});

test('A replacement recipient during buff admission cannot inherit an old done mark or chain', () => {
  const f = make(), e = target(f); let entered = false;
  f.b.on('beforeBuff', c => { if (!entered && c.buff.key === 'ju_s_2[damage_dalay]') {entered=true;e.deploySeq++;f.state.active=false;} });
  advance(f.b, 2); assert.equal(e.findBuff('ju_s_2[done]'),null); assert.equal(f.extra.pending.size,0); assert.equal(hits(f).length,0);
});

test('Battle end drains owned stages and watchers without damaging or deleting permanent done tags', () => {
  const f = make(), e = target(f); queued(f); f.b.finished=true; f.b.emit('battleEnd',{});
  assert.equal(f.extra.pending.size,0); assert.equal(f.extra.watchers.length,0); assert.equal(f.extra.handles.length,0);
  assert.equal(e.findBuff('ju_s_2[damage_dalay]'),null); assert.ok(e.findBuff('ju_s_2[done]')); assert.equal(hits(f).length,0);
});

test('Reentrant aura admission is serialized without recursion or duplicate polling', () => {
  const f = make(); target(f); let calls=0;
  f.b.on('beforeBuff', c => { if (c.buff.key === 'ju_s_2') {calls++;f.extra.scan();} });
  until(f, () => hits(f).length === 1); assert.equal(calls,1); assert.equal(f.extra.pending.size,0);
});

test('Replacement during done-tag admission removes the late old-life tag and pending delay', () => {
  const f = make(), e = target(f); let entered=false;
  f.b.on('beforeBuff', c => { if (!entered && c.buff.key === 'ju_s_2[done]') {entered=true;e.deploySeq++;f.state.active=false;} });
  advance(f.b,2); assert.equal(e.findBuff('ju_s_2[done]'),null); assert.equal(f.extra.pending.size,0);
  assert.equal(e.findBuff('ju_s_2[damage_dalay]'),null); assert.equal(hits(f).length,0);
});

test('Another source\'s aura is neither adopted nor removed during shutdown', () => {
  const f = make(), e = target(f), foreign = f.b.addBuff(e,{key:'ju_s_2',source:{}});
  advance(f.b,2); assert.equal(f.extra.auras.size,0); assert.equal(f.extra.pending.size,0);
  f.extra.stop(); assert.equal(e.findBuff('ju_s_2'),foreign);
});

test('Source life replacement during damage admission cannot create a gate on the new life', () => {
  const f = make(); target(f); let entered=false;
  f.b.on('beforeBuff', c => { if (!entered && c.buff.key === 'ju_s_2[damage]') {
    entered=true;f.u.deploySeq++;f.u.base.atk=99999;f.u.markDirty();
  } });
  until(f, () => hits(f).length===1); assert.equal(f.u.findBuff('ju_s_2[source]'),null);
  near(hits(f)[0].amount,f.record.stats.atk * f.record.bb.atk_scale_s2_extra);
});

test('Reentrant processing during gate admission cannot start a second damage stage', () => {
  const f=make();target(f);target(f);let calls=0;
  f.b.on('beforeBuff',c=>{if(c.buff.key==='ju_s_2[source]'){calls++;f.extra.process();}});
  until(f,()=>hits(f).length===2);assert.equal(calls,2);assert.ok(hits(f)[1].time-hits(f)[0].time>=.3-1e-6);
});

test('Delay admission during source withdrawal remains target-owned but cannot start damage', () => {
  const f=make(),e=target(f);let entered=false;
  f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key==='ju_s_2[damage_dalay]'){entered=true;f.b.retreat(f.u);}});
  advance(f.b,2);assert.equal(hits(f).length,0);assert.equal(f.extra.pending.size,0);assert.equal(f.extra.watchers.length,0);
  assert.equal(e.findBuff('ju_s_2'),null);assert.ok(e.findBuff('ju_s_2[done]'));
});

test('Battle end during separate done admission cannot attach a late pending chain',()=>{
  const f=make(),e=target(f);let entered=false;
  f.b.on('beforeBuff',c=>{if(!entered&&c.buff.key==='ju_s_2[done]'){
    entered=true;f.b.finished=true;f.b.emit('battleEnd',{});
  }});
  f.extra.scan();assert.equal(f.extra.pending.size,0);assert.equal(f.extra.watchers.length,0);
  assert.equal(e.findBuff('ju_s_2[done]'),null);assert.equal(e.findBuff('ju_s_2[damage_dalay]'),null);
});

test('Rejected source gates follow the literal admission result and do not invent a hidden cooldown',()=>{
  const f=make();target(f);target(f);
  f.b.on('beforeBuff',c=>{if(c.buff.key==='ju_s_2[source]')c.cancel=true;});
  until(f,()=>hits(f).length===2);near(hits(f)[0].time,hits(f)[1].time);
  assert.equal(f.extra.pending.size,0);assert.equal(f.extra.watchers.length,0);
});

test('A foreign delay is not adopted or removed while the separate done action still runs',()=>{
  const f=make(),e=target(f),foreign=f.b.addBuff(e,{key:'ju_s_2[damage_dalay]',source:{}});
  advance(f.b,2);assert.equal(f.extra.pending.size,0);assert.ok(e.findBuff('ju_s_2[done]'));
  f.extra.stop();assert.equal(e.findBuff('ju_s_2[damage_dalay]'),foreign);
});

test('An accepted damage stage cannot inherit a fresh life\'s ATK when the source object is reused',()=>{
  const f=make();target(f);damaging(f);const atk=f.u.s.atk;f.u.deploySeq++;f.u.base.atk=999999;f.u.markDirty();
  until(f,()=>hits(f).length===1);near(hits(f)[0].amount,atk*f.record.bb.atk_scale_s2_extra);
  assert.equal(f.extra.handles.length,0);assert.equal(f.extra.watchers.length,0);
});
