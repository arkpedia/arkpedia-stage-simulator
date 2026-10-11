// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-frost-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
const ID = 'char_458_rfrost', TOKEN = 'token_10016_rfrost_mine', KEY = `summon:${ID}`;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', defer = false } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const deploy = () => { b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; return u; };
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = defer ? null : deploy(); return { b, u, deploy, receipts, build, state: b.regularSummons?.get(KEY) };
}
function enemy(b, { x = 7, y = 5, def = 0, fly = false, mass = 0 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def, res: 0, moveSpeed: 0, massLevel: mass }); e.markDirty(); void e.s;
  e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function place(b, row = 5, col = 7) { b.addDp('arkpedia', 99); return deployRegularSummon(b, KEY, row, col); }
const hits = (rs, t, e) => rs.filter(r => r.source === t && r.target === e);

test('Frost retains source bundles, all owner/token ranks and native skeleton bindings', () => {
  assert.equal(evidence.source.bundles.length, 6); assert.equal(evidence.frameParity, false);
  for (const id of [ID, TOKEN]) assert.equal(Object.values(evidence.tables[id].skills).flatMap(s => s.levels).length, 20);
  for (const f of ['Front', 'Back']) assert.equal(evidence.models[ID][f].sha256, evidence.originalFacingBindings[ID][f].sha256);
  assert.equal(evidence.originalTokenBinding.sha256, evidence.tokenArtwork.models[TOKEN].files[`${TOKEN}.skel`].sha256);
  assert.equal(evidence.buffTemplates['rfrost_token[withdraw]'].eventToActions.ON_BUFF_FINISH[0]._switchToDeadState, true);
  assert.equal(evidence.buffTemplates['rfrost_s_2[trigger]'].eventToActions.ON_BUFF_START[0]._abilityName, 'FireImmediately');
  assert.equal(evidence.tokenArtwork.models[TOKEN].hits.Attack_Begin[0], .1);
});
test('all source ranks map distinct token and host multipliers and keep the device through its owned control', () => {
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, receipts } = make({ skill, rank }); u.skill.rule = 'NEVER';
    const bb = state.record.skill.bb;
    near(bb.atk_scale, skill ? u.def.skill.bb.trap_atk_scale : u.def.skill.bb.atk_scale);
    const t = place(b), e = enemy(b, { x: 7.1, def: 100 }); advance(b, .667);
    assert.equal(hits(receipts, t, e).length, 1);
    near(hits(receipts, t, e)[0].amount, Math.max(t.base.atk * bb.atk_scale - 100, .05 * t.base.atk * bb.atk_scale));
    assert.equal(!!e.s.flags[skill ? 'root' : 'stun'], true);
    assert.equal(t.alive, true); assert.equal(t.mem.regularFormVisual.clip, 'Attack_Loop');
    advance(b, bb[skill ? 'constraint' : 'stun'] + .1); assert.equal(t.alive, false);
    assert.equal(hits(receipts, t, e).length, 1);
  }
});
test('every promotion and potential keeps source initial stock, 6/8/10 capacity, zero slots and fixed facing', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const { b, state } = make({ elite, potential });
    assert.equal(state.stock, [4, 6, 8][elite] + (potential >= 5 ? 2 : 0));
    assert.equal(state.record.stats.maxDeckStackCnt, [6, 8, 10][elite]);
    const dp = b.dp, slots = b.deployedSlots(), t = deployRegularSummon(b, KEY, 5, 7, 'LEFT');
    assert.equal(t.dir, 'RIGHT'); near(b.dp, dp - 3); assert.equal(b.deployedSlots(), slots);
    near(state.readyAt, b.time + 5); assert.equal(t.kind, 'device');
  }
});
test('invalid selected ranks, token blackboards and source capacities are rejected', () => {
  const { build } = make();
  assert.throws(() => summonRecordFor(ID, { ...build, skillRank: 11 }, data.tokens), /Unsupported Frost/);
  const raw = structuredClone(data.tokens); raw[TOKEN].phases[2].attributesKeyFrames.forEach(k => k.data.maxDeckStackCnt = 15);
  assert.throws(() => summonRecordFor(ID, build, raw), /capacity/);
  const extra = structuredClone(data.tokens); extra[TOKEN].skills[0].levels[9].blackboard.push({ key: 'unsupported', value: 1 });
  assert.throws(() => summonRecordFor(ID, build, extra), /Unreviewed Frost/);
});
test('stock regenerates automatically and SP pauses while full until placement', () => {
  const { b, u, state } = make({ potential: 5 }); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
  u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), false);
  const t = place(b); assert.equal(state.stock, 9); assert.equal(!!u.s.flags.noSp, false);
  advance(b, .067); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
  const sp = u.skill.spTotal; advance(b, 20); near(u.skill.spTotal, sp);
  const dp = b.dp, stock = state.stock; retreatRegularSummon(b, `token:${t.id}`);
  near(b.dp, dp); assert.equal(state.stock, stock);
});
test('placement rejects occupied ground, invalid tiles and cooldown without charging resources', () => {
  const { b, state } = make(); const e = enemy(b), before = [b.dp, state.stock, state.readyAt];
  assert.throws(() => deployRegularSummon(b, KEY, 5, 7), /ground enemy/);
  assert.deepEqual([b.dp, state.stock, state.readyAt], before);
  e.motion = 'FLY'; assert.equal(summonPlacementError(b, KEY, 5, 7), null);
  b.grid.tile(5, 7).build = 'RANGED'; assert.ok(summonPlacementError(b, KEY, 5, 7));
  b.grid.tile(5, 7).build = 'ALL'; place(b);
  assert.throws(() => deployRegularSummon(b, KEY, 5, 8), /redeploying/);
});
test('literal birth and impact events select only one grounded eligible victim', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b, { x: 7.1 }), z = enemy(b, { x: 7.2 });
  advance(b, .466); assert.equal(t.mem.regularFormVisual.clip, 'Start'); assert.equal(receipts.length, 0);
  advance(b, .067); assert.equal(t.mem.regularFormVisual.clip, 'Attack_Begin'); assert.equal(receipts.length, 0);
  advance(b, .1); assert.equal(hits(receipts, t, e).length, 1); near(z.hp, 100000);
});
test('trap cannot trigger on aerial, sleeping, hidden or untargetable targets', () => {
  for (const flag of ['air', 'sleep', 'camou', 'stealth', 'untargetable']) {
    const { b, receipts } = make(); const t = place(b), e = enemy(b);
    if (flag === 'air') e.motion = 'FLY'; else b.addBuff(e, { key: 'conceal', flags: { [flag]: true } });
    advance(b, 1); assert.equal(t.alive, true); assert.equal(receipts.length, 0);
  }
});
test('trap consumes itself without substituting another victim when its initial target becomes invalid', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b), z = enemy(b, { x: 7.2 });
  advance(b, .534); b.addBuff(e, { key: 'hide', flags: { untargetable: true } });
  advance(b, .2); assert.equal(t.alive, false); assert.equal(receipts.length, 0); near(z.hp, 100000);
});
test('control rejection retains damage and dismisses the device; unrelated control does not extend its lifetime', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b);
  b.on('beforeStatus', c => { if (c.status === 'stun') c.cancel = true; });
  advance(b, .667); assert.equal(hits(receipts, t, e).length, 1); assert.equal(t.alive, false);
  const other = make(); const q = place(other.b), victim = enemy(other.b); advance(other.b, .667);
  other.b.applyStatus(victim, 'stun', { duration: 10 }); advance(other.b, 1.6);
  assert.equal(q.alive, false); assert.equal(victim.s.flags.stun, true);
});
test('S2 fires exactly three separate host projectiles using the Skill event and native spacing without spending a recharge', () => {
  const { b, u, state, receipts } = make({ skill: 1 }); u.skill.rule = 'NEVER';
  const shots = []; b.on('attack', c => { if (c.attacker === u) shots.push(b.time); });
  const stock = state.stock, t = place(b), e = enemy(b, { x: 7.1 });
  advance(b, .633); assert.equal(hits(receipts, t, e).length, 1); assert.equal(shots.length, 0);
  advance(b, .234); assert.equal(shots.length, 3); assert.equal(hits(receipts, u, e).length, 3);
  assert.ok(shots[1] - shots[0] >= .033 && shots[1] - shots[0] <= .067);
  assert.ok(shots[2] - shots[1] >= .033 && shots[2] - shots[1] <= .067);
  for (const r of hits(receipts, u, e)) { near(r.amount, u.s.atk * u.s.atkScaleMul * u.def.skill.bb.atk_scale); assert.equal(r.dmg.isSkill, true); }
  assert.equal(state.stock, stock - 1); assert.equal(u.skill.activations, 0);
  advance(b, .4); assert.equal(u.mem.frostBurst, null); assert.equal(u.mem.regularFormVisual, null);
});
test('S2 does not fire host shots outside range, while traps can be placed there', () => {
  const { b, u, receipts } = make({ skill: 1 }); const t = place(b, 5, 12), e = enemy(b, { x: 12.1 });
  advance(b, 1); assert.equal(hits(receipts, t, e).length, 1); assert.equal(hits(receipts, u, e).length, 0);
});
test('host control cancels unreleased S2 shots but does not erase a fired projectile', () => {
  const { b, u, receipts } = make({ skill: 1 }); place(b); const e = enemy(b, { x: 7.1 });
  advance(b, .667); assert.equal(b.projectiles.list.length, 1);
  b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .3);
  assert.equal(hits(receipts, u, e).length, 1); assert.equal(u.mem.frostBurst, null);
});
test('host removal cancels unreleased S2 shots, removes devices and refreshes stock on redeployment', () => {
  const { b, u, deploy, receipts, state } = make({ skill: 1 }); const t = place(b); const e = enemy(b, { x: 7.1 });
  advance(b, .667); b.retreatOperator(ID); advance(b, .3);
  assert.equal(hits(receipts, u, e).length, 1); assert.equal(t.alive, false);
  advance(b, 100); const fresh = deploy(), next = b.regularSummons.get(KEY);
  assert.notEqual(fresh, u); assert.notEqual(next, state); assert.equal(next.stock, 8);
});
test('trap snapshots owner ATK at placement while host shots use the separately documented live ATK', () => {
  const { b, u, receipts } = make({ skill: 1 }); const sample = u.s.atk * u.s.atkScaleMul, t = place(b);
  b.addBuff(u, { key: 'later', mods: { atkPct: .5 } }); const e = enemy(b, { x: 7.1 }); advance(b, .9);
  near(hits(receipts, t, e)[0].amount, sample * u.def.skill.bb.trap_atk_scale);
  for (const r of hits(receipts, u, e)) near(r.amount, u.s.atk * u.s.atkScaleMul * u.def.skill.bb.atk_scale);
});
test('ordinary attacks use the literal Front and Back events, target one aerial enemy and deal no trap control', () => {
  for (const dir of ['LEFT', 'RIGHT', 'UP', 'DOWN']) {
    const { b, u, receipts } = make({ dir }); const e = enemy(b, { x: dir === 'LEFT' ? 4 : 6, fly: true });
    assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000;
    advance(b, .3); assert.equal(b.projectiles.list.length, 0); advance(b, .167);
    assert.equal(hits(receipts, u, e).length, 1); near(hits(receipts, u, e)[0].amount, u.s.atk * u.s.atkScaleMul);
    assert.equal(hits(receipts, u, e)[0].dmg.isSkill, false); assert.equal(!!e.s.flags.stun, false);
  }
});
