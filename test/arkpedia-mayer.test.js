// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-mayer-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
const ID = 'char_242_otter', TOKEN = 'token_10004_otter_motter', KEY = `summon:${ID}`;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, level, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: level ?? o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const deploy = () => { b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; return u; };
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = deploy(); return { b, u, deploy, receipts, build, state: b.regularSummons.get(KEY) };
}
function enemy(b, { x = 7, y = 5, def = 0, res = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def, res, moveSpeed: 0 }); e.markDirty(); void e.s;
  e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function place(b, row = 5, col = 7) { b.addDp('arkpedia', 99); const t = deployRegularSummon(b, KEY, row, col); t.atkCd = 1000; return t; }
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), true); }
const hits = (rs, t, e) => rs.filter(r => r.source === t && r.target === e);

test('Mayer retains full native source, missing Back Skill and original single Robotter binding', () => {
  assert.equal(evidence.source.bundles.length, 6); assert.equal(evidence.frameParity, false);
  assert.deepEqual(evidence.enabledOperators, [ID]); assert.equal(evidence.sourceInvestigations.length, 4);
  for (const f of ['Front', 'Back']) assert.equal(evidence.models[ID][f].sha256, evidence.originalFacingBindings[ID][f].sha256);
  assert.equal(evidence.models[ID].Back.durations.Skill, undefined);
  assert.equal(evidence.models[TOKEN].Original.hits.Blast[0], .567);
  assert.deepEqual(evidence.models[TOKEN].Original.originalPathIds, evidence.originalTokenBindings.original);
  const actions = evidence.buffTemplates.motter_s_2_fixed.eventToActions.ON_BUFF_FINISH;
  assert.ok(actions[0].$type.includes('RechargeToken')); assert.ok(actions[2].$type.includes('Withdraw'));
});
test('all source ranks independently map Robotter S1/S2 and reject invented ranks/blackboards', () => {
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { u, state } = make({ skill, rank });
    assert.deepEqual(state.record.skill.bb, u.def.skill.bb);
    assert.equal(state.record.skill.rangeGrid.length, skill ? 9 : rank >= 8 ? 5 : 1);
  }
  const { build } = make();
  assert.throws(() => summonRecordFor(ID, { ...build, skillRank: 11 }, data.tokens), /Unsupported Mayer/);
  const raw = structuredClone(data.tokens); raw[TOKEN].skills[0].levels[9].blackboard.push({ key: 'cnt', value: 100 });
  assert.throws(() => summonRecordFor(ID, build, raw), /Unreviewed Mayer/);
});
test('all promotions/potentials keep source own stats, born stock, raw caps and DP/slot/cooldown', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 6]) for (const level of [1, [50, 70, 80][elite]]) {
    const { b, u, state } = make({ elite, potential, level });
    assert.equal(state.stock, [3, 4, 5][elite]); assert.equal(state.stockBudget, state.stock);
    assert.equal(state.record.stats.maxDeployCount, [4, 5, 6][elite]); assert.equal(state.record.stats.maxDeckStackCnt, 0);
    const dp = b.dp, slots = b.deployedSlots(), t = deployRegularSummon(b, KEY, 5, 7);
    assert.equal(t.dir, 'RIGHT'); near(dp - b.dp, 5); assert.equal(b.deployedSlots(), slots + 1); near(state.readyAt, 10);
    assert.equal(t.base.atk, state.record.stats.atk); assert.notEqual(t.base.atk, u.base.atk);
    assert.equal(t.s.flags.healFree, true); assert.equal(t.def.skill.id, 'sktok_motter_1');
    assert.throws(() => deployRegularSummon(b, KEY, 5, 8), /redeploying/);
  }
});
test('S1 every rank gives only original self or four-adjacent dodge, with no SP or activation', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state } = make({ rank }), t = place(b);
    const nearAlly = b.spawnToken(u, TOKEN, 5, 8, { def: state.record, kit: { skill: null, trait: { noAttack: true } } });
    const diagonal = b.spawnToken(u, TOKEN, 6, 8, { def: state.record, kit: { skill: null, trait: { noAttack: true } } });
    // Foreign same-art summons are recipients, never additional aura sources.
    nearAlly.ownerUnit = null; diagonal.ownerUnit = null;
    advance(b, .1); const prob = state.record.skill.bb.prob;
    near(t.s.dodgePhys, prob); near(t.s.dodgeArts, prob); near(u.s.dodgePhys, 0);
    near(nearAlly.s.dodgePhys, rank >= 8 ? prob : 0); near(diagonal.s.dodgePhys, 0);
    assert.equal(u.skill.spTotal, 0); assert.equal(b.activateOperator(ID), false);
  }
});
test('overlapping Robotters share one evade roll, unrelated dodge remains independent, removal falls back', () => {
  const { b, u, state } = make(), t = place(b, 5, 6); advance(b, 10); const q = place(b, 6, 5);
  advance(b, .1); near(u.s.dodgePhys, .35);
  b.addBuff(u, { key: 'foreign', mods: { dodgePhys: .2 } }); near(u.s.dodgePhys, 1 - .65 * .8);
  b.kill(t, null); advance(b, .1); assert.equal(u.findBuff(`mayer:dodge:${u.id}`).source, q);
  near(u.s.dodgeArts, .35); b.kill(q, null); advance(b, .1); near(u.s.dodgePhys, .2);
  assert.equal(state.stock, 3);
});
test('Robotter blocked ASPD uses source promotion value and leaves unrelated debuffs intact', () => {
  for (const elite of [0, 1, 2]) {
    const { b } = make({ elite }), t = place(b), e = enemy(b); advance(b, .1);
    assert.equal(e.blockedBy, t); near(e.s.aspd, 100 + [-10, -25, -25][elite]);
    b.addBuff(e, { key: 'foreign', mods: { aspd: -15 } });
    e.x = 15; e.blockedBy = null; t.blocking = []; b._buildEnemyIndex(); advance(b, .1);
    near(e.s.aspd, 85); assert.equal(e.findBuff(`mayer:block:${t.ownerUnit.id}`), null);
  }
});
test('S2 all ranks use the original two release clocks, owner Arts damage and stun, then recycle once', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, receipts } = make({ skill: 1, rank }), t = place(b), e = enemy(b, { res: 20, fly: true });
    cast(b, u); advance(b, .466); assert.equal(t.mem.mayerBlast, undefined); assert.equal(receipts.length, 0);
    advance(b, .067); assert.equal(t.mem.regularFormVisual.clip, 'Blast'); assert.equal(state.stock, 4);
    advance(b, .5); assert.equal(receipts.length, 0); advance(b, .1);
    assert.equal(hits(receipts, t, e).length, 1); near(hits(receipts, t, e)[0].amount, u.s.atk * u.s.atkScaleMul * u.def.skill.bb.atk_scale * .8);
    assert.equal(e.s.flags.stun, true); assert.equal(t.alive, true);
    advance(b, .8); assert.equal(t.alive, false); assert.equal(state.stock, 5);
    advance(b, 2.1); assert.equal(state.stock, 5); assert.equal(!!e.s.flags.stun, false);
  }
});
test('S2 uses current owner ATK at hit, never Robotter ATK; area captures only initial eligible targets', () => {
  const { b, u, receipts } = make({ skill: 1 }), t = place(b), e = enemy(b, { x: 8 }), outside = enemy(b, { x: 10 });
  b.addBuff(t, { key: 'buffToken', mods: { atkPct: 10 } }); cast(b, u); advance(b, .6);
  const late = enemy(b, { x: 8.1 }); b.addBuff(u, { key: 'buffOwner', mods: { atkPct: .5 } }); advance(b, .6);
  near(hits(receipts, t, e)[0].amount, u.s.atk * 6); near(outside.hp, 100000); near(late.hp, 100000);
});
test('all facings use explicit Front command clock without fabricating a Back animation', () => {
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
    const { b, u, receipts } = make({ skill: 1, dir }), t = place(b), e = enemy(b); cast(b, u);
    assert.equal(u.mem.regularFormVisual.clip, dir === 'UP' ? 'Idle' : 'Skill');
    advance(b, 1.2); assert.equal(hits(receipts, t, e).length, 1); assert.equal(u.mem.mayerCommand, null);
  }
});
test('command accepts zero targets, consumes source SP, and does not create or refund summons', () => {
  const { b, u, state } = make({ skill: 1 }); cast(b, u); assert.equal(u.skill.spTotal, 0);
  assert.equal(state.stock, 5); assert.equal(b.activateOperator(ID), false);
  advance(b, 1.1); assert.equal(state.stock, 5); assert.ok(u.skill.spTotal < .2);
});
test('token death/manual withdrawal loses supply; detonation returns only surviving original tokens with no DP refund', () => {
  const { b, u, state } = make({ skill: 1 }), t = place(b); advance(b, 10); const q = place(b, 5, 8);
  const dp = b.dp; retreatRegularSummon(b, `token:${t.id}`); near(b.dp - dp, 2); assert.equal(state.stock, 3);
  const before = b.dp; cast(b, u); advance(b, 2); assert.equal(q.alive, false); near(b.dp, before); assert.equal(state.stock, 4);
  advance(b, 10); const z = place(b); b.kill(z, null); assert.equal(state.stock, 3);
});
test('owner withdrawal cancels pending command, removes owned summons and bounded redeploy stock never duplicates', () => {
  const { b, u, state, deploy, receipts } = make({ skill: 1 }), t = place(b); enemy(b); cast(b, u);
  b.retreatOperator(ID); advance(b, 2); assert.equal(t.alive, false); assert.equal(receipts.length, 0); assert.equal(state.stock, 4);
  advance(b, 100); const fresh = deploy(), next = b.regularSummons.get(KEY);
  assert.notEqual(fresh, u); assert.equal(next.stock, 5); assert.equal(next.stockBudget, 5);
});
test('new control cancels unborn blast/recycle; pre-existing control does not block the forced trigger', () => {
  const a = make({ skill: 1 }), t = place(a.b), e = enemy(a.b); cast(a.b, a.u); advance(a.b, .6);
  a.b.applyStatus(t, 'stun', { duration: 2 }); advance(a.b, 2); assert.equal(hits(a.receipts, t, e).filter(r => r.dmg.isSkill).length, 0); assert.equal(t.alive, true); assert.equal(a.state.stock, 4);
  const z = make({ skill: 1 }), q = place(z.b), victim = enemy(z.b); z.b.applyStatus(q, 'stun', { duration: 5 });
  cast(z.b, z.u); advance(z.b, 2); assert.equal(hits(z.receipts, q, victim).length, 1); assert.equal(q.alive, false); assert.equal(z.state.stock, 5);
});
test('ordinary owner and Robotter hits remain separate, single-target and use original Attack events', () => {
  const { b, u, receipts } = make(), t = place(b), e = enemy(b, { x: 7.1, def: 100 }), z = enemy(b, { x: 7.2 });
  assert.equal(b.forceAttack(t, [e]), true); advance(b, .367); assert.equal(receipts.length, 0); advance(b, .067);
  assert.equal(hits(receipts, t, e).length, 1); near(hits(receipts, t, e)[0].amount, t.s.atk - 100); near(z.hp, 100000);
  assert.equal(b.forceAttack(u, [e]), true); advance(b, .4); assert.equal(hits(receipts, u, e).length, 0);
  advance(b, .3); assert.equal(hits(receipts, u, e).length, 1); near(hits(receipts, u, e)[0].amount, u.s.atk);
});

test('simultaneous recycling conserves multiple summons and invalidates withdrawn originals, never newly placed tokens', () => {
  const { b, u, state, receipts } = make({ skill: 1 });
  const a = place(b, 5, 7); advance(b, 10); const z = place(b, 6, 7); advance(b, 10);
  const e = enemy(b, { x: 7.1, y: 5.1 }); cast(b, u);
  retreatRegularSummon(b, `token:${a.id}`); const late = place(b, 7, 7);
  advance(b, 2); assert.equal(z.alive, false); assert.equal(late.alive, true);
  assert.equal(hits(receipts, a, e).length, 0); assert.equal(hits(receipts, z, e).filter(r => r.dmg.isSkill).length, 1);
  assert.equal(state.stock, 3); assert.equal(state.stock + 1, 4, 'manual withdrawal consumes one of the five budget');
  advance(b, 3); cast(b, u); advance(b, 2); assert.equal(late.alive, false); assert.equal(state.stock, 4);
});
