// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, near, until} from './helpers/botany-fixture.js';
import {BOTANY_ORDINARY_CONTRACT, verifyBotanyOrdinarySource} from '../server/sim/content/arkpedia-botany-ordinary.js';
import {botanyNativeInputs} from '../server/sim/content/arkpedia-botany-source.js';

const make = opts => fixture({ordinary: true, ...opts});
const target = (f, opts) => enemy(f, {hp: 1e7, ...opts});
const hits = f => f.hits.filter(h => h.dmg.tags.includes('botany:ordinary'));
const begun = f => until(f, () => !!f.attacks.phase);
const airborne = f => until(f, () => f.attacks.flights.size > 0);

test('Botany ordinary component requires its original contract and separate skill-composition predicate', () => {
  assert.throws(() => make({ordinaryContract: {...BOTANY_ORDINARY_CONTRACT}}), /exact ordinary contract/);
  assert.throws(() => make({mayBegin: null}), /composition predicate/);
  const n = structuredClone(botanyNativeInputs()); n.modes[0].attack._projectileKey = 'made-up';
  assert.throws(() => verifyBotanyOrdinarySource(n), /Changed original/);
});

test('Botany respects the original Start and .5 attack marker, then emits one Arts ranged receipt', () => {
  const f = make(), e = target(f); advance(f.b, .9);
  assert.equal(f.attacks.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
  begun(f); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
  advance(f.b, .45); assert.equal(f.receipts.length, 0); assert.equal(hits(f).length, 0);
  airborne(f); assert.equal(f.receipts.length, 1); assert.equal(e.hp, e.s.maxHp);
  until(f, () => hits(f).length === 1);
  near(hits(f)[0].amount, f.u.s.atk); assert.equal(hits(f)[0].type,'arts'); assert.equal(hits(f)[0].dmg.applyWay, 'ranged');
  assert.equal(hits(f)[0].dmg.isAttack, true); assert.equal(hits(f)[0].dmg.isSkill, false);
});

test('New ordinary acquisition uses shared normal-path priority and does not inherit Ju wound exclusion',()=>{
 const f=make(),first=target(f),heavy=target(f);heavy.base.massLevel=9;heavy.markDirty();f.b.addBuff(first,{key:'cripple'});
 begun(f);assert.equal(f.attacks.phase.target.id,first.id);until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,first.id);
});

test('Botany can attack its own blocker outside the ordinary long-range grid', () => {
  const f = make(), e = target(f, {col: 5});
  e.blockedBy = f.u; f.u.blocking.push(e); begun(f);
  assert.equal(f.attacks.phase.target.id, e.id); until(f, () => hits(f).length === 1);
});

for (const [dir, row, col, face] of [['RIGHT',5,7,'Front'], ['LEFT',5,3,'Front'], ['UP',7,5,'Back'], ['DOWN',3,5,'Front']])
  test(`Original ordinary attack clocks remain available for ${dir}`, () => {
    const f = make({dir}); target(f, {row, col}); begun(f);
    assert.equal(f.u.mem.regularVisualDirection, dir);
    near(f.attacks.model().eventPayloads.Attack[0].time, .5);
    assert.equal(f.attacks.model().exactDurations.Die, face === 'Front' ? 1 : undefined);
    until(f, () => hits(f).length === 1);
  });

test('Ordinary Botany attacks add no elemental injury or phantom skill rider',()=>{
 const f=make(),e=target(f);until(f,()=>hits(f).length===3);
 assert.equal(e.elem.erosion,0);assert.ok(hits(f).every(h=>h.type==='arts'&&!h.dmg.isSkill));
 assert.equal(f.hits.filter(h=>h.type==='element').length,0);
});

for (const flag of ['stealth', 'untargetable', 'sleep']) test(`New acquisition rejects ${flag} recipients`, () => {
  const f = make(); target(f, {flags: {[flag]: true}}); advance(f.b, 2);
  assert.equal(f.receipts.length, 0); assert.equal(f.attacks.flights.size, 0);
});

test('ASPD accelerates the cycle but the original max-animation-scale one keeps the release marker', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'fast', mods: {aspd: 100}});
  begun(f); near(f.attacks.phase.speed, 1);
  advance(f.b, .45); assert.equal(f.receipts.length, 0);
  until(f, () => f.receipts.length >= 2);
  near(f.receipts[1].time - f.receipts[0].time, .8);
});

test('A slow attack stat is sampled at phase start without a second slowdown multiplier', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'slow', mods: {aspd: -50, slowDownMul: .2}});
  begun(f); near(f.attacks.phase.speed, .5);
  advance(f.b, .9); assert.equal(f.receipts.length, 0); airborne(f);
  assert.equal(f.receipts.length, 1);
});

test('A target replaced or killed during windup is never redirected to a different enemy', () => {
  for (const replace of [true, false]) {
    const f = make(), e = target(f), other = target(f); begun(f);
    const selected = f.attacks.phase.target, untouched = selected === e ? other : e;
    if (replace) selected.deploySeq++; else f.b.kill(selected);
    advance(f.b, .8); assert.equal(f.receipts.length, 0); assert.equal(untouched.hp, untouched.s.maxHp);
  }
});

test('A stun that ends before the release still invalidates the unfired phase', () => {
  const f = make(); target(f); begun(f);
  f.b.applyStatus(f.u, 'stun', {duration: .01}); advance(f.b, .7);
  assert.equal(f.receipts.length, 0); assert.ok(f.u.atkCd > 0);
});

test('The composition predicate yields presentation and does not manufacture a skill substitute', () => {
  let enabled = true; const f = make({mayBegin: () => enabled}); target(f); begun(f);
  enabled = false; f.u.mem.regularFormVisual = {clip: 'Skill_1', loop: false};
  advance(f.b, .9); assert.equal(f.receipts.length, 0); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
  enabled = true; until(f, () => f.receipts.length > 0);
});

test('Before-attack veto and reentrant forcing cannot duplicate or replace the retained receipt', () => {
  for (const veto of [true, false]) {
    const f = make(), e = target(f);
    f.b.on('beforeAttack', c => { if (c.attacker !== f.u) return;
      if (veto) c.targets = []; else f.b.forceAttack(f.u, [e]); });
    advance(f.b, 2); assert.equal(f.receipts.length, veto ? 0 : 1);
  }
});

for (const flag of ['stealth', 'untargetable']) test(`A born projectile retains its recipient after ${flag}`, () => {
  const f = make(), e = target(f); airborne(f);
  f.b.addBuff(e, {key: 'late-state', flags: {[flag]: true}});
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk);
});

test('Born ordinary arrows survive source withdrawal with finite launch-ATK fallback', () => {
  const f = make(), e = target(f); airborne(f); const atk = f.u.s.atk;
  f.b.retreat(f.u); f.u.base.atk = 9999; f.u.markDirty();
  assert.equal(f.attacks.stopped, true); until(f, () => hits(f).length === 1);
  near(hits(f)[0].amount, atk); assert.equal(f.attacks.flights.size, 0); assert.equal(f.attacks.watchers.length, 0);
});

test('Live original ATK changes are evaluated at impact while the same source life remains', () => {
  const f = make(), e = target(f); airborne(f);
  f.b.addBuff(f.u, {key: 'late-atk', mods: {atkPct: 1}});
  until(f, () => hits(f).length === 1); near(hits(f)[0].amount, f.u.s.atk);
});

test('A born arrow cannot hit a replacement recipient life or adopt another target', () => {
  const f = make(), e = target(f), other = target(f); begun(f); const selected = f.attacks.phase.target;
  airborne(f); selected.deploySeq++; advance(f.b, .8);
  assert.equal(hits(f).length, 0); assert.equal(e.hp, e.s.maxHp); assert.equal(other.hp, other.s.maxHp);
});

test('External projectile removal and battle end release every finite watcher', () => {
  for (const end of [true, false]) {
    const f = make(); target(f); airborne(f);
    if (end) { f.b.finished = true; f.b.emit('battleEnd', {}); }
    else { f.b.removeProjectiles(p => f.attacks.flights.has(p)); advance(f.b, .05); }
    assert.equal(f.attacks.flights.size, 0); assert.equal(f.attacks.watchers.length, 0);
  }
});

for(const multiplier of[0,9])test(`A replaced source with output multiplier ${multiplier} cannot donate its ATK, penetration or ledger to old transport`,()=>{
 const f=make(),e=target(f);e.base.res=50;e.markDirty();
 f.b.addBuff(f.u,{key:'fixture:launch',mods:{atkPct:1,dmgDealtMul:2,artsDealtMul:1.5,resIgnoreFlat:30}});
 airborne(f);const launchAtk=f.u.s.atk*f.u.s.atkScaleMul,ledger=f.u.stats;
 f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=9999;f.u.stats={...ledger,dmg:0};
 f.b.addBuff(f.u,{key:'fixture:new-life',mods:{dmgDealtMul:multiplier,artsDealtMul:multiplier,resIgnoreFlat:100}});f.u.markDirty();
 until(f,()=>hits(f).length===1);const h=hits(f)[0];near(h.amount,launchAtk*.8*3);
 assert.notEqual(h.source,f.u);assert.equal(h.source.alive,false);assert.equal(h.source.deployed,false);
 assert.equal(typeof h.source.findBuff,'function');assert.equal(h.source.stats,ledger);assert.ok(ledger.dmg>0);assert.equal(f.u.stats.dmg,0);
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
test('Current same-life outgoing multipliers and penetration remain live at arrival',()=>{
 const f=make(),e=target(f);e.base.res=50;e.markDirty();airborne(f);
 f.b.addBuff(f.u,{key:'fixture:live',mods:{dmgDealtMul:2,artsDealtMul:1.5,resIgnoreFlat:30}});
 until(f,()=>hits(f).length===1);near(hits(f)[0].amount,f.u.s.atk*f.u.s.atkScaleMul*.8*3);assert.equal(hits(f)[0].source,f.u);
});
test('The native one-hit arrival is claimed before reentrant damage callbacks can replay it',()=>{
 const f=make(),e=target(f);airborne(f);const p=[...f.attacks.flights.keys()][0];
 f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('botany:ordinary'))p.onHit({target:e});});
 until(f,()=>hits(f).length===1);assert.equal(f.receipts.length,1);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
for(const event of['outputDamage','hit','damageFinal','calculatedDamage'])test(`Recipient replacement inside ${event} cannot accept the old ordinary output`,()=>{
 const f=make(),e=target(f);f.b.on(event,c=>{if(c.dmg.tags.includes('botany:ordinary'))e.deploySeq++;});
 airborne(f);advance(f.b,.4);near(e.hp,e.s.maxHp);assert.equal(hits(f).length,0);
});
test('Hidden source cancels an unfired phase while retaining its independent cooldown',()=>{
 const f=make();target(f);begun(f);f.u.hidden=true;advance(f.b,.1);assert.equal(f.attacks.phase,null);assert.ok(f.u.atkCd>0);
 f.u.hidden=false;advance(f.b,.5);assert.equal(f.receipts.length,0);until(f,()=>f.receipts.length===1);
});
test('Native always-hit-at-end resolves a distant retained recipient once at the finite lifetime boundary',()=>{
 const f=make(),e=target(f);airborne(f);e.x=1000;f.b.retreat(f.u);advance(f.b,10.2);
 assert.equal(hits(f).length,1);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
test('An airborne enemy remains a legal ordinary Arts recipient',()=>{
 const f=make(),e=target(f,{motion:'FLY'});until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,e.id);assert.equal(hits(f)[0].type,'arts');
});
test('A source replaced in beforeAttack cannot launch an old-life ordinary projectile',()=>{
 const f=make();target(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.u.deploySeq++;});advance(f.b,2);
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.handles.length,0);assert.equal(hits(f).length,0);
});
