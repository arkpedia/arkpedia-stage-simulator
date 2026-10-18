// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, near, until} from './helpers/skybox-fixture.js';
import {SKYBOX_ORDINARY_CONTRACT, verifySkyboxOrdinarySource} from '../server/sim/content/arkpedia-skybox-ordinary.js';
import {skyboxNativeInputs} from '../server/sim/content/arkpedia-skybox-source.js';

const fixtures=[];const make=opts=>{const f=fixture({ordinary:true,...opts});fixtures.push(f);return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const target = (f, opts) => enemy(f, {hp:1e7,motion:'FLY',...opts});
const hits = f => f.hits.filter(h => h.dmg.tags.includes('skybox:ordinary'));
const begun = f => until(f, () => !!f.attacks.phase);
const airborne = f => until(f, () => f.attacks.flights.size > 0);

test('Skybox ordinary component requires its original contract and separate skill-composition predicate', () => {
  assert.throws(() => make({ordinaryContract: {...SKYBOX_ORDINARY_CONTRACT}}), /exact ordinary contract/);
  assert.throws(() => make({mayBegin: null}), /composition predicate/);
  const n = structuredClone(skyboxNativeInputs()); n.modes[0].attack._projectileKey = 'made-up';
  assert.throws(() => verifySkyboxOrdinarySource(n), /Changed original/);
});

test('Skybox respects the original Start and .3333333432674408 attack marker, then emits one Physical ranged receipt', () => {
  const f = make(), e = target(f); advance(f.b, .9);
  assert.equal(f.attacks.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
  begun(f); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
  advance(f.b, .30); assert.equal(f.receipts.length, 0); assert.equal(hits(f).length, 0);
  airborne(f); assert.equal(f.receipts.length, 1); assert.equal(e.hp, e.s.maxHp);
  until(f, () => hits(f).length === 1);
  near(hits(f)[0].amount, f.u.s.atk); assert.equal(hits(f)[0].type,'phys'); assert.equal(hits(f)[0].dmg.applyWay, 'ranged');
  assert.equal(hits(f)[0].dmg.isAttack, true); assert.equal(hits(f)[0].dmg.isSkill, false);
});

test('New ordinary acquisition uses shared normal-path priority and does not inherit Ju wound exclusion',()=>{
 const f=make(),first=target(f),heavy=target(f);heavy.base.massLevel=9;heavy.markDirty();f.b.addBuff(first,{key:'cripple'});
 begun(f);assert.equal(f.attacks.phase.target.id,first.id);until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,first.id);
});

test('Skybox can attack its own blocker outside the ordinary long-range grid', () => {
  const f = make(), e = target(f, {col: 4.2});
  e.blockedBy = f.u; f.u.blocking.push(e); begun(f);
  assert.equal(f.attacks.phase.target.id, e.id); until(f, () => hits(f).length === 1);
});

for (const [dir, row, col, face] of [['RIGHT',5,7,'Front'], ['LEFT',5,3,'Front'], ['UP',7,5,'Back'], ['DOWN',3,5,'Front']])
  test(`Original ordinary attack clocks remain available for ${dir}`, () => {
    const f = make({dir}); target(f, {row, col}); begun(f);
    assert.equal(f.u.mem.regularVisualDirection, dir);
    near(f.attacks.model().eventPayloads.Attack[0].time, .3333333432674408);
    assert.equal(f.attacks.model().exactDurations.Die, face === 'Front' ? 1 : undefined);
    until(f, () => hits(f).length === 1);
  });

test('Ordinary Skybox attacks add no elemental injury or phantom skill rider',()=>{
 const f=make(),e=target(f);until(f,()=>hits(f).length===3);
 assert.equal(e.elem.erosion,0);assert.ok(hits(f).every(h=>h.type==='phys'&&!h.dmg.isSkill));
 assert.equal(f.hits.filter(h=>h.type==='element').length,0);
});

for (const flag of ['stealth', 'untargetable', 'sleep']) test(`New acquisition rejects ${flag} recipients`, () => {
  const f = make(); target(f, {flags: {[flag]: true}}); advance(f.b, 2);
  assert.equal(f.receipts.length, 0); assert.equal(f.attacks.flights.size, 0);
});

test('ASPD accelerates the cycle but the original max-animation-scale one keeps the release marker', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'fast', mods: {aspd: 100}});
  begun(f); near(f.attacks.phase.speed, 1);
  advance(f.b, .30); assert.equal(f.receipts.length, 0);
  until(f, () => f.receipts.length >= 2);
  near(f.receipts[1].time-f.receipts[0].time,1.05,.04);
});

test('A slow attack stat is sampled at phase start without a second slowdown multiplier', () => {
  const f = make(); target(f); f.b.addBuff(f.u, {key: 'slow', mods: {aspd: -50, slowDownMul: .2}});
  begun(f); near(f.attacks.phase.speed, .5);
  advance(f.b, .60); assert.equal(f.receipts.length, 0); airborne(f);
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
 const f=make(),e=target(f);e.base.def=50;e.markDirty();
 f.b.addBuff(f.u,{key:'fixture:launch',mods:{atkPct:1,dmgDealtMul:2,physDealtMul:1.5,defIgnoreFlat:30}});
 airborne(f);const launchAtk=f.u.s.atk*f.u.s.atkScaleMul,ledger=f.u.stats;
 f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=9999;f.u.stats={...ledger,dmg:0};
 f.b.addBuff(f.u,{key:'fixture:new-life',mods:{dmgDealtMul:multiplier,physDealtMul:multiplier,defIgnoreFlat:100}});f.u.markDirty();
 until(f,()=>hits(f).length===1);const h=hits(f)[0];near(h.amount,(launchAtk-20)*3);
 assert.notEqual(h.source,f.u);assert.equal(h.source.alive,false);assert.equal(h.source.deployed,false);
 assert.equal(typeof h.source.findBuff,'function');assert.equal(h.source.stats,ledger);assert.ok(ledger.dmg>0);assert.equal(f.u.stats.dmg,0);
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
test('Current same-life outgoing multipliers and penetration remain live at arrival',()=>{
 const f=make(),e=target(f);e.base.def=50;e.markDirty();airborne(f);
 f.b.addBuff(f.u,{key:'fixture:live',mods:{dmgDealtMul:2,physDealtMul:1.5,defIgnoreFlat:30}});
 until(f,()=>hits(f).length===1);near(hits(f)[0].amount,(f.u.s.atk*f.u.s.atkScaleMul-20)*3);assert.equal(hits(f)[0].source,f.u);
});
test('The native one-hit arrival is claimed before reentrant damage callbacks can replay it',()=>{
 const f=make(),e=target(f);airborne(f);const p=[...f.attacks.flights.keys()][0];
 f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('skybox:ordinary'))p.onHit({target:e});});
 until(f,()=>hits(f).length===1);assert.equal(f.receipts.length,1);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);
});
for(const event of['outputDamage','hit','damageFinal','calculatedDamage'])test(`Recipient replacement inside ${event} cannot accept the old ordinary output`,()=>{
 const f=make(),e=target(f);f.b.on(event,c=>{if(c.dmg.tags.includes('skybox:ordinary'))e.deploySeq++;});
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
test('Airborne enemies remain legal while ordinary acquisition excludes every ground recipient',()=>{
 const f=make(),e=target(f,{motion:'FLY'}),ground=target(f,{motion:'WALK'});until(f,()=>hits(f).length===1);assert.equal(ground.hp,ground.s.maxHp);assert.equal(hits(f)[0].target.id,e.id);assert.equal(hits(f)[0].type,'phys');
});
test('A source replaced in beforeAttack cannot launch an old-life ordinary projectile',()=>{
 const f=make();target(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.u.deploySeq++;});advance(f.b,2);
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.handles.length,0);assert.equal(hits(f).length,0);
});

for(const field of['motion','cap','free','cache','type','speed'])test(`Changed ordinary ${field} inputs cannot retain original approval`,()=>{
 const n=structuredClone(skyboxNativeInputs());
 if(field==='motion')n.ordinarySelector._targetMotion=0;if(field==='cap')n.ordinarySelector._maxNum=2;
 if(field==='free')n.ordinarySelector._ignoreTargetFree=1;if(field==='cache')n.modes[0].attack._useCachedAtkOnly=1;
 if(field==='type')n.modes[0].attack._damageType=2;
 if(field==='speed')n.projectiles.projectile_chr_skybx.flatMap(r=>r.components).find(p=>p.data._speed!=null).data._speed=8;
 assert.throws(()=>verifySkyboxOrdinarySource(n),/Changed original/);
});
test('Ground-only candidates never manufacture an ordinary attack, damage or Silence',()=>{
 const f=make(),ground=target(f,{motion:'WALK'});advance(f.b,6);assert.equal(f.receipts.length,0);assert.equal(hits(f).length,0);
 assert.equal(!!ground.s.flags.silence,false);assert.equal(f.talent.records.size,0);
});
test('Two available flyers receive exactly one ordinary projectile per attack, with no area splash',()=>{
 const f=make(),a=target(f),b=target(f);until(f,()=>hits(f).length===1);
 assert.equal(f.receipts.length,1);assert.equal(hits(f).length,1);const targetId=hits(f)[0].target.id;
 assert.equal((targetId===a.id?b:a).hp,a.s.maxHp);
});
test('The first live physical projectile applies the selected talent at arrival and later hits do not refresh it',()=>{
 const f=make(),e=target(f);airborne(f);assert.equal(!!e.s.flags.silence,false);assert.equal(f.talent.records.size,0);
 until(f,()=>hits(f).length===1);assert.equal(e.s.flags.silence,true);assert.equal(f.talent.records.size,1);
 const silence=e.findBuff(f.talent.silenceKey(e,e.deploySeq)),remaining=silence.timeLeft;
 until(f,()=>hits(f).length===2);assert.ok(silence.timeLeft<remaining-1);assert.equal(f.talent.records.size,1);
});
test('Retired source transport keeps its Physical damage but cannot originate a new live-parent Silence',()=>{
 const f=make(),e=target(f);airborne(f);f.b.retreat(f.u);until(f,()=>hits(f).length===1);
 assert.equal(!!e.s.flags.silence,false);assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);
});
test('Ordinary dodge skips missable Silence while spending one derived first-target mark',()=>{
 const f=make(),e=target(f,{flags:{}});f.b.addBuff(e,{key:'fixture:always-dodge',mods:{dodgePhys:1}});
 until(f,()=>f.receipts.length===1);advance(f.b,.4);assert.equal(hits(f).length,0);assert.equal(!!e.s.flags.silence,false);
 assert.equal(f.talent.records.size,1);f.b.removeBuff(e,'fixture:always-dodge');until(f,()=>hits(f).length===1);
 assert.equal(!!e.s.flags.silence,false);
});
test('A complete physical shield still accepts first-target Silence and a mark independently of zero HP loss',()=>{
 const f=make(),e=target(f);f.b.addBuff(e,{key:'fixture:shield',shield:1e6});airborne(f);advance(f.b,.4);
 assert.equal(e.hp,e.s.maxHp);assert.equal(e.s.flags.silence,true);assert.equal(f.talent.records.size,1);
});
for(const motion of['float','levitate'])test(`Ordinary acquisition recognizes actual ${motion} aerial state without changing route motion`,()=>{
 const f=make(),e=target(f,{motion:'WALK'});f.b.addBuff(e,{key:'fixture:aerial',flags:{[motion]:true}});
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,e.id);assert.equal(e.motion,'WALK');
});
test('Real original clips retain the independent takeoff height and use Front Attack_Down for a downward target',()=>{
 const f=make({dir:'DOWN'});target(f,{row:3,col:5});begun(f);assert.equal(f.u.mem.regularFormVisual.clip,'Attack_Down');
 near(f.u.mem.regularFormVisual.height.to,.4000000059604645);airborne(f);
 assert.equal(f.attacks.phase.shot.clip,'Attack_Down');near(f.attacks.phase.releaseAge,.3333333432674408);
});
