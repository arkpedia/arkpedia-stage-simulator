// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rockbreaker } from '../server/sim/content/chapter17-rockbreaker.js';
import { pollute, leakSource } from '../server/sim/content/chapter17.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { makeBattle } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { parseSkel } from '../tools/assets/skel.mjs';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const contract = read('candidates/arkpedia-ch17-rockbreaker-contract.json');
const proof = read('candidates/arkpedia-ch17-rockbreaker-animation-source.json');
const key = 'enemy_10204_mudia', flag = 'enemy_mudia_casted_flag';
const hash = x => createHash('sha256').update(x).digest('hex');
function fixture(variant = false, seed = 19) {
  const id = key + (variant ? '_2' : '');
  const h = makeBattle({ seed, content: 'generic', autoFinish: false, setup: installFeatureDispatch,
    defs: { enemies: Object.fromEntries([id, 'enemy_10211_murad'].map(k => [k, records[k].levels[0]])) } });
  const b = h.b;
  b.on('enemySpawn', ({ enemy }) => {
    if (enemy.defId === id) attach(b, enemy, [rockbreaker(records[id].levels[0])]);
  });
  b.start();
  const e = h.spawn(id, { pos: [10, 7] });
  e.route = { legs: [{ t: 'wait', time: 10 }, { t: 'move', r: 11, c: 8 }, { t: 'move', r: 9, c: 2, final: true }],
    legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: 3, goal: { x: 2, y: 9 }, visitEveryCheckPoint: true };
  return { h, b, e, a: e.mem.ab.list[0], children: () => b.enemies.filter(u => u.mem.ch17RockbreakerParent === e.id) };
}

test('both native prefab skeleton bindings reproduce the exact Skill hit/end times', () => {
  for (const file of Object.values(contract.sources)) assert.equal(hash(readFileSync(new URL('../' + file.path, import.meta.url))), file.sha256);
  assert.equal(proof.source.bundle.manifestSha256, read('arkpedia-cn-native-source.json').source.manifestSha256);
  for(const enemy of Object.values(contract.enemies)){
    const skills=enemy.native.map(JSON.parse).filter(c=>c._animKey==='Skill');assert.equal(skills.length,1);
    assert.equal(skills[0]._affectedBySlowDown,1);assert.equal(skills[0]._timeMode,1);assert.equal(skills[0]._maxAnimScale,1);assert.equal(skills[0]._waitForAttackEvent,1);
  }
  for (const row of Object.values(proof.enemies)) {
    const raw = Buffer.from(row.base64, 'base64');
    assert.equal(raw.length, row.bytes); assert.equal(hash(raw), row.sha256);
    assert.equal(hash(row.skeletonDataOriginalJson), row.skeletonDataSha256);
    assert.equal(row.prefabBinding.m_PathID, row.skeletonDataPathId);
    const decoded = parseSkel(raw, undefined, { includeExactDurations: true, includeEventPayloads: true });
    assert.equal(decoded.exactDurations.Skill, contract.defaults.skillDuration);
    assert.equal(decoded.eventPayloads.Skill.length, 1);
    assert.equal(decoded.eventPayloads.Skill[0].name, 'OnAttack');
    assert.equal(decoded.eventPayloads.Skill[0].time, contract.defaults.skillHit);
  }
});

const slow=f=>applySourceSlowDown(f.b,{id:'fixture:source-slow'},f.e,{key:'rockbreaker-clock',increment:.5,maxStrength:.5,
  maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});
for(const variant of [false,true])test(`native slow_down delays both split release and completion for variant ${variant}`,()=>{
  const f=fixture(variant);assert.ok(slow(f));assert.equal(f.e.s.slowDownRate,.5);pollute(f.b,f.e);
  f.h.run(2.25);assert.equal(f.children().length,0);assert.ok(f.a.pending);
  f.h.run(.12);assert.equal(f.children().length,1);assert.ok(f.a.pending);assert.ok(f.e.s.flags.noMove);
  f.h.run(1.5);assert.ok(f.a.pending);f.h.run(.2);assert.equal(f.a.pending,null);assert.equal(f.children().length,1);
  assert.ok(!f.e.s.flags.noMove);assert.deepEqual(f.b.errors,[]);
});

test('live slowdown changes consume only remaining split work before and after the release marker',()=>{
  const f=fixture();pollute(f.b,f.e);f.h.run(.4);const p=f.a.pending,start=p.age,first=slow(f);
  f.h.run(.8);assert.ok(Math.abs(p.age-start-.4)<f.b.dt);assert.equal(f.children().length,0);
  f.b.removeBuff(f.e,first);f.h.run(.4);assert.equal(f.children().length,1);assert.ok(f.a.pending);
  const second=slow(f),hitAge=p.age;f.h.run(.4);assert.ok(Math.abs(p.age-hitAge-.2)<f.b.dt);assert.equal(f.children().length,1);
  assert.equal(f.a.pending,p);f.b.removeBuff(f.e,second);f.h.run(.65);assert.equal(f.a.pending,null);assert.equal(f.children().length,1);assert.deepEqual(f.b.errors,[]);
});

for(const aspd of [900,-50])test(`fixed-time native Skill ignores ordinary ASPD delta ${aspd}`,()=>{
  const f=fixture();f.b.addBuff(f.e,{key:'fixture:aspd',mods:{aspd}});pollute(f.b,f.e);
  f.h.run(1.13);assert.equal(f.children().length,0);f.h.run(.07);assert.equal(f.children().length,1);
  f.h.run(.85);assert.equal(f.a.pending,null);assert.deepEqual(f.b.errors,[]);
});

for(const stop of ['death','battleEnd','control'])test(`${stop} retires a slowed split without a later world-time callback`,()=>{
  const f=fixture();slow(f);pollute(f.b,f.e);f.h.run(.4);
  if(stop==='death')f.b.kill(f.e,null);else if(stop==='battleEnd')f.b.emit('battleEnd',{});else f.b.applyStatus(f.e,'stun',{duration:.1});
  f.h.run(6);assert.equal(f.children().length,0);assert.equal(f.a.pending,null);assert.ok(!f.e.findBuff('enemy_mudia_summon_ing'));assert.deepEqual(f.b.errors,[]);
});

for (const variant of [false, true]) test(`split releases at the native event, marks both bodies once, and preserves variant ${variant}`, () => {
  const { h, b, e, a, children } = fixture(variant);
  e.hp = 1000; pollute(b, e); pollute(b, e);
  assert.ok(a.pending); assert.ok(e.s.flags.noMove); assert.equal(children().length, 0);
  h.run(1.13); assert.equal(children().length, 0);
  h.run(.07); const child = children()[0];
  assert.ok(child); assert.equal(child.defId, e.defId); assert.equal(child.hp, child.s.maxHp); assert.equal(e.hp, 1000);
  assert.ok(child.findBuff(flag)); assert.ok(e.findBuff(flag)); assert.equal(b.total, 2);
  assert.ok(child.counted); assert.notEqual(child.holdsBattle, false);
  pollute(b, child); pollute(b, e); h.run(3);
  assert.equal(children().length, 1); assert.equal(b.enemies.length, 2);
  assert.equal(a.pending, null); assert.ok(!e.s.flags.noMove); assert.ok(!e.s.flags.disarm);
  assert.deepEqual(b.errors, []);
});

test('split child keeps the unconsumed wait/checkpoint chain and independent route state', () => {
  const { h, b, e, children } = fixture(); let remainingAtBirth;
  b.on('enemySpawn', ({ enemy }) => { if (enemy !== e) remainingAtBirth = e.route.waitLeft; });
  pollute(b, e); h.run(1.2);
  const child = children()[0];
  assert.equal(child.route.legs[0].t, 'wait');
  assert.equal(child.route.legs[0].time, remainingAtBirth);
  assert.ok(remainingAtBirth > 0 && remainingAtBirth < 10, 'remaining time, not the original wait duration');
  assert.deepEqual(child.route.legs.slice(1), e.route.legs.slice(1));
  assert.equal(child.route.visitEveryCheckPoint, true); assert.deepEqual(child.route.goal, e.route.goal);
  child.route.legs[1].r = 3; assert.equal(e.route.legs[1].r, 11);
});

test('seeded split positions stay inside the documented current-tile square', () => {
  const positions = [];
  for (let i = 0; i < 2; i++) {
    const { h, b, e, children } = fixture(); e.x = 7.3; e.y = 10.2; pollute(b, e); h.run(1.2);
    const child = children()[0];
    assert.ok(Math.abs(child.x - 7) <= .5); assert.ok(Math.abs(child.y - 10) <= .5);
    positions.push([child.x, child.y]);
  }
  assert.deepEqual(positions[0], positions[1]);
});

test('a brief new control effect interrupts a pending candidate cast without marking or spawning', () => {
  const { h, b, e, a, children } = fixture(); pollute(b, e); h.run(.4);
  b.applyStatus(e, 'stun', { duration: .01 }); b.removeBuff(e, 'stun'); h.run(2);
  assert.equal(children().length, 0); assert.equal(a.pending, null); assert.equal(e.findBuff(flag), null);
  assert.ok(!e.s.flags.disarm); pollute(b, e); h.run(1.2); assert.equal(children().length, 1);
});

for (const stop of ['death', 'battleEnd']) test(`${stop} cancels release and removes the owned reaction hook`, () => {
  const { h, b, e, a, children } = fixture(); pollute(b, e); h.run(.2);
  const hook = e.mem.ch17PollutionReaction;
  if (stop === 'death') b.kill(e, null); else b.emit('battleEnd', {});
  hook(); h.run(3); assert.equal(children().length, 0); assert.equal(a.pending, null);
  assert.equal(e.mem.ch17PollutionReaction, undefined); assert.deepEqual(b.errors, []);
});

test('the real Leak Source beam collision starts the Rockbreaker reaction', () => {
  const { h, b, e, children } = fixture();
  e.route.waitLeft = 100;
  const source = h.spawn('enemy_10211_murad', { pos: [10, 5] });
  attach(b, source, [leakSource(records.enemy_10211_murad.levels[0])]);
  h.run(8); assert.equal(children().length, 1); assert.ok(e.findBuff(flag)); assert.deepEqual(b.errors, []);
});

test('a rejected child spawn does not consume the one-time split and can retry after recovery', () => {
  const { h, b, e, children } = fixture(); const spawn = b.spawnEnemy;
  b.spawnEnemy = () => null; pollute(b, e); h.run(2.1);
  assert.equal(children().length, 0); assert.equal(e.findBuff(flag), null);
  b.spawnEnemy = spawn; pollute(b, e); h.run(1.2); assert.equal(children().length, 1);
});


test('the hostile split child survives parent death and holds completion until it leaves', () => {
  const { h, b, e, children } = fixture(); pollute(b, e); h.run(1.2);
  const child = children()[0]; b.autoFinish = true; b.kill(e, null); h.run(.1);
  assert.equal(b.finished, false); assert.equal(child.alive, true);
  assert.ok(child.findBuff(flag)); assert.equal(b.total, 2);
  b.kill(child, null); h.run(.1); assert.equal(b.result().reason, 'cleared');
});


test('feature dispatch installs the reviewed controller on parent and child without manual attachment', () => {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [key]: records[key].levels[0] } } });
  h.b.start(); const e = h.spawn(key, { pos: [10, 7] });
  assert.equal(typeof e.mem.ch17PollutionReaction, 'function');
  pollute(h.b, e); h.run(1.2);
  const child = h.b.enemies.find(u => u.mem.ch17RockbreakerParent === e.id);
  assert.ok(child); assert.equal(typeof child.mem.ch17PollutionReaction, 'function');
  pollute(h.b, child); h.run(3); assert.equal(h.b.enemies.length, 2);
  assert.deepEqual(h.b.errors, []);
});

test('candidate support rejects absent family proof, changed native components, wrappers and record signatures', () => {
  const native = read('candidates/arkpedia-ch17-rockbreaker-native.json'), index = read('arkpedia-enemy-clock-source.json');
  const entries = Object.fromEntries(Object.keys(contract.enemies).map(k => [k, records[k]]));
  const evidence = { ...native, chapter16Families: { rockbreaker: { graphSha256: contract.sources.graph.sha256 } } };
  for (const k of Object.keys(entries)) {
    const decision = deriveEnemySupport(entries, index.prefabs, evidence)[k];
    assert.equal(decision.policy, 'stats-attacks-and-features');
    assert.equal(decision.native[k].claimedWrappers, contract.enemies[k].counts.enemyAbilityWrappers);
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[k].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(k)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[k].policy, null);
    const changedIndex = structuredClone(index.prefabs);
    changedIndex[prefabPath(k)].clockComponents.push({ fields: { _familyMask: 1, _trigger: {} } });
    assert.equal(deriveEnemySupport(entries, changedIndex, evidence)[k].policy, null);
    const wrong = structuredClone(entries); wrong[k].levels[0].skills[0].cooldown = 0;
    assert.equal(deriveEnemySupport(wrong, index.prefabs, evidence)[k].policy, null);
  }
});

test('silence and ordinary-attack disarm do not remove the nonsilenceable pollution reaction', () => {
  const { h, b, e, children } = fixture();
  b.applyStatus(e, 'silence', { duration: 5 }); b.applyStatus(e, 'disarm', { duration: 5 });
  pollute(b, e); h.run(1.2);
  assert.equal(children().length, 1); assert.ok(e.findBuff(flag)); assert.deepEqual(b.errors, []);
});

test('forced split clears palsy and leaves the independent ordinary Combat cooldown running', () => {
  const { h, b, e, children } = fixture(); e.atkCd = 7;
  b.applyStatus(e, 'palsy', { value: 3 }); assert.ok(e.findBuff('palsy'));
  pollute(b, e); assert.equal(e.findBuff('palsy'), null); h.run(2.1);
  assert.equal(children().length, 1); assert.ok(Math.abs(e.atkCd - 4.9) < 1e-7);
});
