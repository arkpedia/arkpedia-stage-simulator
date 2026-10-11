// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-wulfenite-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const ID = 'char_4171_wulfen', TOKEN = 'token_10044_wulfen_mine', KEY = `summon:${ID}`;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
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
  const deploy = () => { b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; return u; };
  const u = deploy(), receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  return { b, u, receipts, build, deploy, state: b.regularSummons.get(KEY) };
}
function enemy(b, { x = 7, y = 5, def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s;
  e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function place(b, row = 5, col = 7) { b.addDp('arkpedia', 99); return deployRegularSummon(b, KEY, row, col); }
const activate = (b, t) => b.activateOperator(`token:${t.id}`);
const hits = (rs, t, e) => rs.filter(r => r.source === t && r.target === e);

test('Wulfenite retains six original bundles, forty owner/token ranks, native arming/chain/two-hit evidence and fidelity limits', () => {
  assert.equal(evidence.frameParity, false); assert.equal(evidence.moduleSupport, false);
  assert.equal(evidence.source.bundles.length, 6); assert.equal(evidence.verificationLimits.length, 6);
  assert.equal(Object.values(evidence.tables.skills).flatMap(s => s.levels).length, 40);
  for (const f of ['Front', 'Back']) assert.equal(evidence.models[ID][f].sha256, evidence.officialSkeletonBindings[ID][f].sha256);
  const comps = Object.values(evidence.skills).flatMap(gs => gs.flatMap(g => g.components.map(c => c.data)));
  assert.ok(comps.some(c => c._additionalTimes === 1 && c._triggerDelta === 0 && c._onlyFeedActiveBuffToFirstOne === 1));
  assert.equal(evidence.templates['wulfen_token[skill]'].eventToActions.ON_BUFF_START[0]._checkBeforeTrigger, false);
  assert.deepEqual(evidence.models[TOKEN].Front.hits.Die, [.067]);
});
test('all promotions/potentials use source initial supplies and ready-card-inclusive capacities', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const { state, u } = make({ elite, potential });
    assert.equal(state.stock, elite + 1 + (potential >= 5 ? 1 : 0));
    assert.equal(state.record.stats.maxDeckStackCnt, elite + 2);
    assert.equal(state.record.stats.maxDeployCount, elite + 2);
    assert.equal(state.record.stats.cost, 5); assert.equal(state.record.stats.respawnTime, 5);
    assert.equal(!!u.s.flags.noSp, potential >= 5);
  }
});
test('all twenty skill ranks select matching8SP manual token skills and source physical/control values', () => {
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, receipts } = make({ skill, rank }); u.skill.rule = 'NEVER';
    assert.deepEqual(state.record.skill.bb, u.def.skill.bb);
    const t = place(b), e = enemy(b, { def: 200 });
    advance(b, 8.034); assert.equal(t.skill.ready, true); assert.equal(t.skill.manual, true);
    assert.equal(activate(b, t), true); advance(b, .134);
    const rs = hits(receipts, t, e); assert.equal(rs.length, skill ? 2 : 1);
    for (const r of rs) near(r.amount, Math.max(t.base.atk * u.skill.bb.atk_scale - 200 * (skill ? 1 + u.skill.bb.def : 1), .05 * t.base.atk * u.skill.bb.atk_scale));
    assert.equal(t.alive, false); assert.equal(!!e.s.flags.stun, skill === 0);
    if (!skill) { advance(b, u.skill.bb.stun + .1); assert.equal(!!e.s.flags.stun, false); }
    else { near(e.s.def, 200 * (1 + u.skill.bb.def)); advance(b, 5.1); near(e.s.def, 200); }
  }
});
test('stock recovery pauses at full capacity, resumes after placement, and cannot waste a recharge', () => {
  const { b, u, state } = make(); advance(b, 20.1); assert.equal(state.stock, 4);
  assert.equal(u.s.flags.noSp, true); const sp = u.skill.spTotal; advance(b, 30); near(u.skill.spTotal, sp);
  place(b); assert.equal(state.stock, 3); assert.equal(!!u.s.flags.noSp, false);
  advance(b, 20.1); assert.equal(state.stock, 4);
  const full = make({ potential: 5 }); full.u.skill.setSpTotal(full.u.skill.spCost);
  assert.equal(full.u.skill.activate(), false); near(full.u.skill.spTotal, full.u.skill.spCost);
});
test('trap placement charges5DP, one stock and a5s card cooldown, with no deployment slot or facing', () => {
  const { b, state } = make(); b.unitLimit = b.deployedSlots(); const dp = b.dp, stock = state.stock;
  const t = deployRegularSummon(b, KEY, 5, 7); near(b.dp, dp - 5); assert.equal(state.stock, stock - 1);
  assert.equal(t.deploymentSlotCost, 0); assert.equal(t.dir, 'RIGHT'); near(state.readyAt, b.time + 5);
  assert.throws(() => place(b, 5, 8), /redeploying/); advance(b, 5); assert.equal(summonPlacementError(b, KEY, 5, 8), null);
});
test('bad placement preserves stock/DP/cooldown and rejects occupied ground but permits aerial enemies', () => {
  const { b, state } = make(); const e = enemy(b), before = [b.dp, state.stock, state.readyAt];
  assert.throws(() => deployRegularSummon(b, KEY, 5, 7), /ground enemy/); assert.deepEqual([b.dp, state.stock, state.readyAt], before);
  e.motion = 'FLY'; assert.equal(summonPlacementError(b, KEY, 5, 7), null);
  b.grid.tile(5, 7).build = 'RANGED'; assert.match(summonPlacementError(b, KEY, 5, 7), /melee/);
  assert.ok(summonPlacementError(b, KEY, -1, 7));
});
test('SP bar/ready icon appear after8SP; mere enemy contact never detonates; impact waits for native event', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b);
  advance(b, 7.9); assert.equal(skillHud(t.skill).ready, false); assert.equal(activate(b, t), false);
  advance(b, .167); assert.equal(skillHud(t.skill).canActivate, true); assert.equal(receipts.length, 0);
  advance(b, 3); assert.equal(t.alive, true); assert.equal(receipts.length, 0);
  assert.equal(activate(b, t), true); assert.equal(t.mem.regularFormVisual.clip, 'Die');
  assert.equal(activate(b, t), false); advance(b, .066); assert.equal(receipts.length, 0);
  advance(b, .034); assert.equal(hits(receipts, t, e).length, 1); assert.equal(t.alive, false);
});
test('manual activation requires a selectable ground target and retains ready SP on rejection', () => {
  for (const flag of ['empty', 'air', 'sleep', 'stealth', 'untargetable']) {
    const { b } = make(); const t = place(b); if (flag !== 'empty') {
      const e = enemy(b); if (flag === 'air') e.motion = 'FLY'; else b.addBuff(e, { key: 'concealed', flags: { [flag]: true } });
    }
    advance(b, 8.034); assert.equal(activate(b, t), false); near(t.skill.spTotal, 8);
    assert.equal(skillHud(t.skill).ready, true); assert.equal(skillHud(t.skill).canActivate, false);
  }
});
test('S1 hits all eligible bodies on its own tile, not neighbouring tiles; keeps traps independent', () => {
  const { b, receipts } = make(); const t = place(b); advance(b, 5); const z = place(b, 5, 9);
  const e = enemy(b, { x: 7.1 }), e2 = enemy(b, { x: 7.2 }), outside = enemy(b, { x: 8 });
  advance(b, 8.034); assert.equal(activate(b, t), true); advance(b, .134);
  assert.equal(hits(receipts, t, e).length, 1); assert.equal(hits(receipts, t, e2).length, 1);
  near(outside.hp, 100000); assert.equal(z.alive, true); assert.equal(z.skill.ready, true);
});
test('S2 chains all armed siblings exactly once even with no target, excludes unarmed sibling and diagonals', () => {
  const { b, receipts } = make({ skill: 1 }); const t = place(b); advance(b, 5);
  const empty = place(b, 9, 9); advance(b, 8.034); const unarmed = place(b, 12, 12);
  const centre = enemy(b), neighbour = enemy(b, { x: 8 }), diagonal = enemy(b, { x: 8, y: 6 });
  assert.equal(activate(b, t), true); assert.equal(empty.skill.activations, 1); assert.equal(unarmed.skill.activations, 0);
  advance(b, .134); assert.equal(t.skill.activations, 1); assert.equal(empty.alive, false); assert.equal(unarmed.alive, true);
  assert.equal(hits(receipts, t, centre).length, 2); assert.equal(hits(receipts, t, neighbour).length, 2); near(diagonal.hp, 100000);
});
test('overlapping S2 blasts refresh one DEF reduction instead of stacking, each applies two hits', () => {
  const { b, receipts } = make({ skill: 1 }); const t = place(b); advance(b, 5); const z = place(b, 5, 8);
  const e = enemy(b, { def: 400 }); advance(b, 8.034); activate(b, t); advance(b, .134);
  assert.equal(hits(receipts, t, e).length, 2); assert.equal(hits(receipts, z, e).length, 2); near(e.s.def, 300);
  assert.equal(e.buffs.filter(x => x.key === 'wulfenite:def').length, 1); advance(b, 5.1); near(e.s.def, 400);
});
test('a removed owner cancels chained impacts; redeployment refreshes initial stock', () => {
  const { b, u, state, receipts, deploy } = make({ skill: 1 }); const t = place(b); advance(b, 5); const z = place(b, 5, 8);
  enemy(b); advance(b, 8.034); activate(b, t); b.retreatOperator(ID); advance(b, .134);
  assert.equal(t.alive, false); assert.equal(z.alive, false); assert.equal(receipts.length, 0);
  advance(b, 100); const fresh = deploy(); assert.notEqual(fresh, u); const next = b.regularSummons.get(KEY);
  assert.notEqual(next, state); assert.equal(next.stock, 3); near(next.readyAt, b.time);
});
test('ATK inheritance is explicitly placement-sampled; later owner buffs do not alter placed mines', () => {
  const { b, u, receipts } = make(); b.addBuff(u, { key: 'before', mods: { atkPct: .5, atkScaleMul: 1.2 } });
  const sampled = u.s.atk * u.s.atkScaleMul, t = place(b); near(t.base.atk, sampled);
  b.addBuff(u, { key: 'after', mods: { atkPct: 1 } }); const e = enemy(b); advance(b, 8.034); activate(b, t); advance(b, .134);
  near(hits(receipts, t, e)[0].amount, sampled * u.skill.bb.atk_scale);
});
test('ordinary shots retain one Physical aerial-capable projectile and source release event', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const { b, u, receipts } = make({ dir }); const e = enemy(b, { x: dir === 'LEFT' ? 4 : dir === 'RIGHT' ? 6 : 5,
      y: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5, fly: true });
    assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000;
    advance(b, .2); assert.equal(b.projectiles.list.length, 0); advance(b, .234);
    assert.equal(hits(receipts, u, e).length, 1); near(hits(receipts, u, e)[0].amount, u.s.atk * u.s.atkScaleMul);
    assert.equal(hits(receipts, u, e)[0].dmg.isSkill, false);
  }
});
test('manual retreat refunds noDP/stock and invalid or removed token keys cannot activate', () => {
  const { b, state } = make(); const t = place(b), dp = b.dp, stock = state.stock;
  retreatRegularSummon(b, `token:${t.id}`); near(b.dp, dp); assert.equal(state.stock, stock);
  assert.equal(activate(b, t), false); assert.equal(b.activateOperator('token:999999'), false);
  b.setViewport('inline-preview'); assert.equal(b.activateOperator(ID), false);
});
test('source validation rejects mismatched skill, rank, arming rules and total stock capacity', () => {
  const { build } = make(); assert.throws(() => summonRecordFor(ID, { ...build, skillId: 'fake' }, data.tokens), /Unsupported Wulfenite/);
  for (const field of ['spCost', 'initSp', 'maxChargeTime']) {
    const raw = structuredClone(data.tokens); raw[TOKEN].skills[0].levels[9].spData[field]++;
    assert.throws(() => summonRecordFor(ID, build, raw), /Unreviewed/);
  }
  const raw = structuredClone(data.tokens); raw[TOKEN].phases[2].attributesKeyFrames.forEach(k => k.data.maxDeckStackCnt = 12);
  assert.throws(() => summonRecordFor(ID, build, raw), /capacity/);
});
test('target leaving before impact causes no ghost hit and still consumes the detonated trap', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b); advance(b, 8.034);
  assert.equal(activate(b, t), true); e.x = 9; b._buildEnemyIndex(); advance(b, .134);
  assert.equal(receipts.length, 0); assert.equal(t.alive, false);
});
test('brief control cancels unreleased blast damage even if control ends before the event', () => {
  const { b, receipts } = make(); const t = place(b); enemy(b); advance(b, 8.034); activate(b, t);
  b.applyStatus(t, 'stun', { duration: .01 }); advance(b, .134);
  assert.equal(receipts.length, 0); assert.equal(t.alive, false);
});
test('a rejected stun does not cancel physical blast damage', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b); advance(b, 8.034);
  b.on('beforeStatus', c => { if (c.status === 'stun' && c.target === e) c.cancel = true; });
  activate(b, t); advance(b, .134); assert.equal(hits(receipts, t, e).length, 1);
  assert.equal(!!e.s.flags.stun, false); assert.equal(t.alive, false);
});
test('fullscreen and control checks protect token skills without spending ready SP', () => {
  for (const flag of ['stun', 'silence', 'preview']) {
    const { b } = make(); const t = place(b); enemy(b); advance(b, 8.034);
    if (flag === 'preview') b.setViewport('inline-preview');
    else b.addBuff(t, { key: 'test:control', flags: { [flag]: true } });
    assert.equal(activate(b, t), false); near(t.skill.spTotal, 8); assert.equal(t.skill.activations, 0);
  }
});
