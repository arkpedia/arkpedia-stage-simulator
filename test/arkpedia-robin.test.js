// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-robin-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
const ID = 'char_451_robin', TOKEN = 'token_10013_robin_mine', KEY = `summon:${ID}`;
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

test('Robin retains six verified bundles, all forty owner/token ranks, original facings and explicit fidelity limits', () => {
  assert.equal(evidence.combatEnabled, true); assert.equal(evidence.frameParity, false);
  assert.equal(evidence.source.bundles.length, 6); assert.equal(evidence.limitations.length, 6);
  for (const id of [ID, TOKEN]) assert.equal(Object.values(evidence.tables[id].skills).flatMap(s => s.levels).length, 20);
  for (const f of ['Front', 'Back']) assert.equal(evidence.models[ID][f].sha256, evidence.originalFacingBindings[ID][f].sha256);
  assert.equal(evidence.buffTemplates['charge_token[refresh]'].eventToActions.ON_OWNER_BORN[0]._refreshRemainingCnt, true);
  assert.equal(evidence.buffTemplates['robin_token[withdraw]'].eventToActions.ON_BUFF_FINISH[0]._switchToDeadState, false);
});
test('all promotions and potentials use source initial supply and total stock capacities', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const { state } = make({ elite, potential });
    assert.equal(state.stock, [4, 6, 8][elite] + (potential >= 5 ? 2 : 0));
    assert.equal(state.record.stats.maxDeckStackCnt, [6, 8, 10][elite]);
    assert.equal(state.record.stats.maxDeployCount, [6, 8, 10][elite]);
    assert.equal(state.record.stats.cost, 3); assert.equal(state.record.stats.respawnTime, 5);
  }
});
test('all twenty selected ranks map to matching token data, physical damage and source control', () => {
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, receipts } = make({ skill, rank }); u.skill.rule = 'NEVER';
    assert.deepEqual(state.record.skill.bb, u.def.skill.bb);
    const t = place(b), e = enemy(b, { x: 7.1, def: 200 }); advance(b, .734);
    const rs = hits(receipts, t, e); assert.equal(rs.length, 1);
    near(rs[0].amount, Math.max(t.base.atk * u.skill.bb.atk_scale - 200, .05 * t.base.atk * u.skill.bb.atk_scale));
    assert.equal(rs[0].dmg.isSkill, true); assert.equal(rs[0].dmg.applyWay, 'ranged');
    assert.equal(t.alive, false); assert.equal(!!e.s.flags.root, skill === 0);
    if (skill === 0) { advance(b, u.skill.bb.constraint + .1); assert.equal(!!e.s.flags.root, false); }
    else assert.ok(e.x > 7.1);
  }
});
test('source validation rejects incompatible capacity, token rank or blackboard', () => {
  const { build } = make();
  assert.throws(() => summonRecordFor(ID, { ...build, skillId: 'skchr_fake_1' }, data.tokens), /Unsupported Robin/);
  const raw = structuredClone(data.tokens); raw[TOKEN].phases[2].attributesKeyFrames.forEach(k => k.data.maxDeckStackCnt = 12);
  assert.throws(() => summonRecordFor(ID, build, raw), /capacity/);
  const other = structuredClone(data.tokens); other[TOKEN].skills[0].levels[9].blackboard.push({ key: 'unsupported', value: 1 });
  assert.throws(() => summonRecordFor(ID, build, other), /Unreviewed/);
});
test('automatic recovery replenishes one trap and pauses SP at full stock until placement', () => {
  const { b, u, state } = make(); assert.equal(state.stock, 8);
  advance(b, 24.1); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
  const sp = u.skill.spTotal; advance(b, 20); near(u.skill.spTotal, sp);
  place(b); assert.equal(state.stock, 9); assert.equal(!!u.s.flags.noSp, false);
  advance(b, 12.1); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
});
test('full initial supply gates SP on the deployment frame and cannot consume a recharge', () => {
  const { b, u, state } = make({ potential: 5 }); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
  u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), false);
  near(u.skill.spTotal, u.skill.spCost); assert.equal(state.stock, 10);
});
test('trap placement charges 3 DP and one stock with a five-second cooldown and zero unit slots', () => {
  const { b, state } = make(); b.unitLimit = b.deployedSlots();
  const dp = b.dp, stock = state.stock; const t = deployRegularSummon(b, KEY, 5, 7);
  near(b.dp, dp - 3); assert.equal(state.stock, stock - 1); assert.equal(t.deploymentSlotCost, 0);
  near(state.readyAt, b.time + 5); assert.equal(t.dir, 'RIGHT');
  assert.throws(() => deployRegularSummon(b, KEY, 5, 8), /redeploying/);
  advance(b, 5.1); assert.equal(summonPlacementError(b, KEY, 5, 8), null);
});
test('failed placement leaves DP, stock and cooldown unchanged; ground occupation rejects but air does not', () => {
  const { b, state } = make(); const e = enemy(b), before = [b.dp, state.stock, state.readyAt];
  assert.throws(() => deployRegularSummon(b, KEY, 5, 7), /ground enemy/);
  assert.deepEqual([b.dp, state.stock, state.readyAt], before);
  e.motion = 'FLY'; assert.equal(summonPlacementError(b, KEY, 5, 7), null);
  b.grid.tile(5, 7).build = 'RANGED'; assert.match(summonPlacementError(b, KEY, 5, 7), /melee/);
  b.grid.tile(5, 7).build = 'NONE'; assert.ok(summonPlacementError(b, KEY, 5, 7));
  assert.ok(summonPlacementError(b, KEY, -1, 7));
});
test('trap waits for its exact entrance and OnAttack event, then affects one victim without splash or ordinary attacks', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b, { x: 7.1 }), z = enemy(b, { x: 7.2 });
  advance(b, .466); assert.equal(t.mem.regularFormVisual.clip, 'Start_01'); assert.equal(receipts.length, 0);
  advance(b, .067); assert.equal(t.mem.regularFormVisual.clip, 'Skill_01'); assert.equal(receipts.length, 0);
  advance(b, .1); assert.equal(receipts.length, 0); advance(b, .034);
  assert.equal(hits(receipts, t, e).length, 1); near(z.hp, 100000); assert.equal(t.dir, 'RIGHT');
  advance(b, 4); assert.equal(hits(receipts, t, e).length, 1);
});
test('air, sleeping, camouflaged, invisible and target-free enemies cannot trigger a trap', () => {
  for (const flag of ['air', 'sleep', 'camou', 'stealth', 'untargetable']) {
    const { b, receipts } = make(); const t = place(b), e = enemy(b);
    if (flag === 'air') e.motion = 'FLY'; else b.addBuff(e, { key: 'concealed', flags: { [flag]: true } });
    advance(b, 1); assert.equal(receipts.length, 0); assert.equal(t.alive, true);
  }
});
test('a triggered trap consumes itself if its victim becomes invalid and never substitutes another', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b, { x: 7.1 }), z = enemy(b, { x: 7.2 });
  advance(b, .534); b.addBuff(e, { key: 'free', flags: { untargetable: true } });
  advance(b, .2); assert.equal(t.alive, false); assert.equal(receipts.length, 0); near(z.hp, 100000);
});
test('a control rejection does not suppress physical damage or trap consumption', () => {
  const { b, receipts } = make(); const t = place(b), e = enemy(b);
  b.on('beforeStatus', ctx => { if (ctx.status === 'root') ctx.cancel = true; });
  advance(b, .734); assert.equal(hits(receipts, t, e).length, 1); assert.equal(!!e.s.flags.root, false); assert.equal(t.alive, false);
});
test('push is radial and follows source force, enemy weight and displacement immunity', () => {
  for (const x of [6.9, 7.1]) for (const mass of [0, 6]) {
    const { b, receipts } = make({ skill: 1 }); const t = place(b), e = enemy(b, { x, mass });
    advance(b, .734); assert.equal(hits(receipts, t, e).length, 1);
    if (mass === 6) near(e.x, x); else assert.ok(x < 7 ? e.x < x : e.x > x);
  }
  const { b } = make({ skill: 1 }); place(b); const e = enemy(b); b.addBuff(e, { key: 'immune', flags: { noDisplace: true } });
  advance(b, .734); near(e.x, 7);
});
test('trap uses owner ATK at placement including current buffs, while later buffs do not alter it', () => {
  const { b, u, receipts } = make(); b.addBuff(u, { key: 'before', mods: { atkPct: .5, atkScaleMul: 1.2 } });
  const sampled = u.s.atk * u.s.atkScaleMul, t = place(b); near(t.base.atk, sampled); assert.notEqual(t.base.atk, 100);
  b.addBuff(u, { key: 'after', mods: { atkPct: 1 } }); const e = enemy(b); advance(b, .734);
  near(hits(receipts, t, e)[0].amount, sampled * u.skill.bb.atk_scale);
});
test('manual trap retreat refunds no DP and never restores stock', () => {
  const { b, state } = make(); const t = place(b), dp = b.dp, stock = state.stock;
  retreatRegularSummon(b, `token:${t.id}`); near(b.dp, dp); assert.equal(state.stock, stock); assert.equal(t.alive, false);
  assert.throws(() => retreatRegularSummon(b, `token:${t.id}`), /not deployed/);
});
test('owner withdrawal cancels pending trap impacts; redeployment refreshes rather than adds initial supply', () => {
  const { b, u, state, deploy, receipts } = make(); const t = place(b); enemy(b); advance(b, .534);
  b.retreatOperator(ID); assert.equal(t.alive, false); advance(b, 100); assert.equal(receipts.length, 0);
  const fresh = deploy(), next = b.regularSummons.get(KEY); assert.notEqual(fresh, u); assert.notEqual(next, state);
  assert.equal(next.stock, 8); near(next.readyAt, b.time); assert.equal(!!fresh.s.flags.noSp, false);
});
test('ordinary Robin shots retain one source projectile, hit aerial targets and do not turn into trap damage', () => {
  for (const dir of ['LEFT', 'RIGHT', 'UP', 'DOWN']) {
    const { b, u, receipts } = make({ dir }); const e = enemy(b, { x: dir === 'LEFT' ? 4 : 6, fly: true });
    assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000;
    advance(b, .2); assert.equal(b.projectiles.list.length, 0); advance(b, .334);
    assert.equal(hits(receipts, u, e).length, 1); near(hits(receipts, u, e)[0].amount, u.s.atk * u.s.atkScaleMul);
    assert.equal(hits(receipts, u, e)[0].dmg.isSkill, false); assert.equal(!!e.s.flags.root, false);
  }
});
