// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-tippi-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
import { absoluteRangeKeys, canTargetAlly } from '../server/sim/targeting.js';
import { regularVisualHeight } from '../public/arkpedia/regular-form-visual.js';
const ID = 'char_4191_tippi';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, sec) { for (let i = 0; i < Math.ceil(sec / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; u.profile.canAttack = () => false;
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  return { b, u, receipts };
}
function enemy(b, { x = 6, y = 5, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function incoming(b, u, { type = 'phys', amount = 100, source = null, ...rest } = {}) {
  return b.dealDamage(source, u, { type, amount, isAttack: true, applyWay: 'ranged', ...rest });
}
function start(b, u) {
  u.skill.setSpTotal(u.skill.spCost);
  if (u.skill.manual) assert.equal(b.activateOperator(ID), true);
  else { incoming(b, u); assert.equal(u.skill.active, true); }
}
function shot(b, u, e) { performAttack(b, u, effectiveProfile(u), [e]); u.atkCd = 1000; }
const hits = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');

test('Tippi retains five original bundles, fourteen templates, all ranks, seven modes and explicit fidelity limits', () => {
  assert.equal(evidence.source.bundles.length, 5); assert.equal(evidence.frameParity, false);
  assert.equal(evidence.moduleSupport, false); assert.equal(evidence.nativeParticleSupport, false);
  assert.equal(Object.keys(evidence.templates).length, 14); assert.equal(evidence.verificationLimits.length, 5);
  assert.equal(Object.values(evidence.tables.skills).flatMap(s => s.levels).length, 20);
  for (const f of ['Front', 'Back']) {
    assert.equal(evidence.models[ID][f].sha256, evidence.officialSkeletonBindings[ID][f].sha256);
    assert.deepEqual(evidence.models[ID][f].hits.Skill_2_Loop, [0, .2, .567]);
    assert.equal(evidence.models[ID][f].durations.Skill_Begin, 1);
  }
  const comps = evidence.characters[ID].flatMap(g => g.components.map(c => c.data));
  assert.ok(comps.some(c => c._modes?.length === 7));
  assert.ok(comps.some(c => c._additionalTimes === 2 && c._waitAttackEventForAllAttacks === 1
    && c._limitToOneTargetAfterFirstRound === 0 && c._triggerDelta === 0));
  assert.equal(evidence.templates['tippi_s_2[trigger]'].eventToActions.ON_APPLYING_MODIFIER[1]._checkCurModeIndex, 0);
});
for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) test(`S${skill + 1} rank${rank}: source ATK, flight range, duration and shots`, () => {
  const { b, u, receipts } = make({ skill, rank }); const e = enemy(b), atk = u.s.atk;
  const level = evidence.tables.skills[`skchr_tippi_${skill + 1}`].levels[rank - 1];
  near(u.skill.spCost, level.spData.spCost); near(u.skill.initSp, level.spData.initSp);
  start(b, u); near(u.s.atk, atk * (1 + u.skill.bb.atk));
  assert.equal(u.mem.tippiMode, skill ? 4 : 1); assert.equal(u.s.flags.disarm, true);
  assert.equal(u.s.flags.liftoff, true);
  assert.deepEqual(u.rangeKeys, absoluteRangeKeys(u.def.skill.rangeGrid, 5, 5, 'RIGHT', 0));
  advance(b, .5); near(regularVisualHeight(u.mem.regularFormVisual, b.time), .5 / .833299994468689 * u.skill.bb['attack@height_offset']);
  advance(b, .534); assert.equal(u.mem.tippiMode, skill ? 5 : 2); assert.equal(!!u.s.flags.disarm, false);
  u.atkCd = 1000; shot(b, u, e); advance(b, .8);
  assert.equal(hits(receipts, u).length, skill ? 3 : 1);
  for (const hit of hits(receipts, u)) near(hit.amount, atk * (1 + u.skill.bb.atk));
  advance(b, u.skill.timeLeft + .034); u.atkCd = 1000;
  assert.equal(u.skill.active, false); assert.equal(u.mem.tippiMode, skill ? 6 : 3);
  assert.equal(u.s.flags.liftoff, true); near(u.s.atk, atk);
  advance(b, 1.034); assert.equal(u.mem.tippiMode, 0); assert.equal(!!u.s.flags.liftoff, false);
  assert.deepEqual(u.rangeGrid, u.def.rangeGrid); assert.equal(u.mem.regularFormVisual, null);
});
test('S2 never auto-starts on full SP or an available attack; direct activation is unavailable', () => {
  const { b, u } = make({ skill: 1 }); enemy(b); u.skill.setSpTotal(u.skill.spCost);
  advance(b, 2); assert.equal(u.skill.active, false); assert.equal(b.activateOperator(ID), false);
  u.profile.canAttack = () => true; u.atkCd = 0; advance(b, .1); assert.equal(u.skill.active, false); assert.ok(u.stats.attacks > 0);
});
for (const type of ['phys', 'arts', 'true']) test(`S2 incoming ${type} triggers before damage; only Physical/Arts is evaded`, () => {
  const { b, u } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost); const hp = u.hp;
  near(incoming(b, u, { type }), type === 'true' ? 100 : 0);
  near(u.hp, hp - (type === 'true' ? 100 : 0)); assert.equal(u.mem.tippiMode, 4);
  assert.equal(u.skill.activations, 1); assert.equal(u.skill.spTotal, 0);
});
test('S2 accepts zero damage modifiers, but HP loss and elemental injury do not trigger it', () => {
  const { b, u } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost);
  b.loseHp(u, 1); assert.equal(u.skill.activations, 0);
  incoming(b, u, { type: 'element', element: 'burn', amount: 1 }); assert.equal(u.skill.activations, 0);
  incoming(b, u, { amount: 0 }); assert.equal(u.skill.activations, 1);
});
for (const status of ['stun', 'freeze', 'silence']) test(`S2 cannot cast while ${status}; rejected activation keeps SP`, () => {
  const { b, u } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost);
  b.applyStatus(u, status, { duration: 2 }); incoming(b, u);
  assert.equal(u.skill.activations, 0); near(u.skill.spTotal, u.skill.spCost);
});
test('undodgeable damage can trigger S2 but is not erased; mode gating prevents casting during landing', () => {
  const { b, u } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost);
  assert.ok(incoming(b, u, { canDodge: false }) > 0); assert.equal(u.mem.tippiMode, 4);
  advance(b, 1.034); u.atkCd = 1000; u.skill.end('test'); u.skill.setSpTotal(u.skill.spCost);
  const fly = enemy(b, { fly: true }); incoming(b, u, { source: fly }); assert.equal(u.skill.activations, 1);
  advance(b, 1.034); incoming(b, u, { source: fly }); assert.equal(u.skill.activations, 2);
});
test('takeoff releases ground blocking while retaining aerial blocks and ground targeting immunity through landing', () => {
  const { b, u } = make(); const g = enemy(b), a = enemy(b, { fly: true, x: 5 });
  u.blocking = [g, a]; g.blockedBy = u; a.blockedBy = u; start(b, u);
  assert.equal(g.blockedBy, null); assert.equal(a.blockedBy, u); assert.deepEqual(u.blocking, [a]);
  assert.equal(canTargetAlly(g, u, true), false); assert.equal(canTargetAlly(a, u, true), true);
  advance(b, 1.034); u.atkCd = 1000; u.skill.end('test'); assert.equal(canTargetAlly(g, u, true), false);
  advance(b, 1.034); assert.equal(canTargetAlly(g, u, true), true);
});
for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) test(`source clip aliases and rotated flight range for ${dir}`, () => {
  const { b, u } = make({ skill: 1, dir }); start(b, u);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  assert.deepEqual(u.rangeKeys, absoluteRangeKeys(u.def.skill.rangeGrid, 5, 5, dir, 0));
  advance(b, 1.034); assert.equal(u.mem.regularFormVisual.attack, 'Skill_2_Loop');
  u.atkCd = 1000; u.skill.end('test'); assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_End');
});
test('S2 shots release on all three native events, not as simultaneous damage', () => {
  const { b, u, receipts } = make({ skill: 1 }); const e = enemy(b); start(b, u); advance(b, 1.034);
  u.atkCd = 1000; const t = b.time; shot(b, u, e); advance(b, .167); assert.equal(hits(receipts, u).length, 1);
  advance(b, .2); assert.equal(hits(receipts, u).length, 2);
  advance(b, .4); assert.equal(hits(receipts, u).length, 3);
  const times = hits(receipts, u).map(r => r.time - t);
  near(times[1] - times[0], .2); assert.ok(times[2] - times[1] > .33);
  assert.equal(new Set(hits(receipts, u).map(r => r.dmg.attackId)).size, 1);
});
test('S2 reselects later release targets if the first dies, still selecting only one enemy per shot', () => {
  const { b, u, receipts } = make({ skill: 1 }); const a = enemy(b, { x: 5.6 }), z = enemy(b, { x: 6, y: 6 });
  start(b, u); advance(b, 1.034); u.atkCd = 1000; a.hp = 1; shot(b, u, a); advance(b, .8);
  assert.equal(a.alive, false); assert.deepEqual(hits(receipts, u).map(r => r.target.id), [a.id, z.id, z.id]);
});
for (const action of ['stun', 'end', 'retreat']) test(`S2 ${action} cancels unfired subshots while launched projectiles persist`, () => {
  const { b, u, receipts } = make({ skill: 1 }); const e = enemy(b, { x: 7 });
  start(b, u); advance(b, 1.034); u.atkCd = 1000; shot(b, u, e);
  if (action === 'stun') b.applyStatus(u, 'stun', { duration: 1 });
  else if (action === 'end') u.skill.end('test'); else b.retreat(u);
  advance(b, .9); assert.equal(hits(receipts, u).length, 1);
});
test('native max animation scale caps positive ASPD without compressing S2 release events', () => {
  const { b, u, receipts } = make({ skill: 1 }); const e = enemy(b); start(b, u); advance(b, 1.034); u.atkCd = 1000;
  b.addBuff(u, { key: 'test:aspd', mods: { aspd: 200 } }); shot(b, u, e);
  advance(b, .2); assert.equal(hits(receipts, u).length, 1); advance(b, .2); assert.equal(hits(receipts, u).length, 2);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 2, 3, 4, 5, 6]) test(`E${elite} potential${potential} uses the selected native talent timer`, () => {
  const { b, u } = make({ elite, potential });
  if (!elite) { advance(b, 20); assert.equal(u.mem.tippiEvade, false); return; }
  const time = elite === 1 ? potential >= 5 ? 12 : 13 : potential >= 5 ? 8 : 9;
  assert.equal(u.def.talents[0].bb.stack_time, time); advance(b, time - .1); assert.equal(u.mem.tippiEvade, false);
  advance(b, .134); assert.equal(u.mem.tippiEvade, true); advance(b, 10); assert.equal(u.mem.tippiEvade, true);
});
for (const type of ['phys', 'arts']) test(`talent evades exactly one ${type} damage instance then recharges`, () => {
  const { b, u } = make(); advance(b, 9.034); near(incoming(b, u, { type }), 0); assert.equal(u.mem.tippiEvade, false);
  assert.ok(incoming(b, u, { type }) > 0); advance(b, 8.9); assert.equal(u.mem.tippiEvade, false);
  advance(b, .134); assert.equal(u.mem.tippiEvade, true);
});
test('damage resets an unfinished timer; HP loss does not; true damage cannot consume ready evade', () => {
  const { b, u } = make(); advance(b, 8); incoming(b, u, { type: 'true', amount: 1 });
  advance(b, 1.034); assert.equal(u.mem.tippiEvade, false); b.loseHp(u, 1);
  advance(b, 8.034); assert.equal(u.mem.tippiEvade, true); incoming(b, u, { type: 'true', amount: 1 });
  assert.equal(u.mem.tippiEvade, true); incoming(b, u, { canDodge: false }); assert.equal(u.mem.tippiEvade, true);
});
test('S2 trigger cancellation preserves ready talent; an aerial hit during flight consumes it once', () => {
  const { b, u } = make({ skill: 1 }); const a = enemy(b, { fly: true }); advance(b, 9.034);
  assert.equal(u.mem.tippiEvade, true); incoming(b, u); assert.equal(u.skill.active, true);
  assert.equal(u.mem.tippiEvade, true); incoming(b, u, { source: a }); assert.equal(u.mem.tippiEvade, false);
});
test('removal invalidates phase, subshot and talent timers across redeployment', () => {
  const { b, u } = make(); start(b, u); advance(b, .4); b.retreat(u); advance(b, 71);
  b.addDp('arkpedia', 99); const z = b.deployOperator(ID, 5, 5, 'RIGHT'); z.atkCd = 1000;
  assert.equal(z.mem.tippiMode, 0); assert.equal(!!z.s.flags.liftoff, false); assert.equal(z.mem.tippiEvade, false);
  advance(b, 1.034); assert.equal(z.mem.tippiMode, 0); assert.equal(z.mem.regularFormVisual, null);
});
