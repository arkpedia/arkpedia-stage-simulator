// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-fiammetta-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { COLS } from '../server/sim/constants.js';
const ID = 'char_300_phenxi';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] }, { seed: 1 });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID, 5, 5, dir); assert.ok(u);
  u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts };
}
function enemy(b, { x = 8, y = 5, fly = false, hp = 100000 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u, target) { performAttack(b, u, effectiveProfile(u), target ? [target] : acquireTargets(b, u, effectiveProfile(u))); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_phenxi_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
const comp = (key, field) => source.projectiles[key].flatMap(g => g.components).map(c => c.data).find(c => c[field] != null);
function sustain(b, u) { b.every(.05, () => { if (u.alive && u.deployed) u.hp = u.s.maxHp; }); }

test('source retains native damage/bleed fields, seven templates, all ranks and both original skeletons', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 7);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  const bleed = source.templates['phenxi_t_1[bleeding]'].eventToActions.ON_BUFF_TRIGGER[1];
  assert.equal(bleed._damageType, 'PURE'); assert.equal(bleed._skipModifierEvent, true);
  assert.equal(bleed._ceilingDamageToInt, true); assert.equal(bleed._isUndeadable, true);
  assert.equal(bleed._ignoreForSp, true);
  near(comp('projectile_chr_phenxi', 'm_Radius').m_Radius, 1);
  near(comp('projectile_chr_phenxi_s2', '_speed')._speed, 8);
  near(comp('projectile_chr_phenxi_s2', 'm_Radius').m_Radius, 1.5);
  near(comp('projectile_chr_phenxi_s2_2', '_lifeTime')._lifeTime, .8);
  near(comp('projectile_chr_phenxi_s2_2', 'm_Radius').m_Radius, 1.1);
  near(comp('projectile_chr_phenxi_s3', '_delayToStart')._delayToStart, .5);
  near(comp('projectile_chr_phenxi_s3', 'm_Radius').m_Radius, 2);
  for (const face of ['Front', 'Back']) {
    assert.equal(source.models[ID][face].sha256, source.officialSkeletonBindings[ID][face].sha256);
    near(source.models[ID][face].hits.Attack[0], .833);
    near(source.models[ID][face].hits.Skill_Loop[0], .833);
    near(source.models[ID][face].hits.Skill_2_Loop[0], .033);
  }
});
for (const elite of [0, 1, 2]) for (const potential of [1, 5, 6]) test(`HP drain/Vigor/Herald E${elite} P${potential}`, () => {
  const { b, u, receipts } = make({ elite, potential });
  const peak = [.15, .2, .25][elite], aspd = elite < 2 ? 100 : potential < 5 ? 127 : 130;
  near(u.s.atk, u.base.atk * (1 + 2 * peak)); near(u.s.aspd, aspd);
  const hp = u.hp; advance(b, .15); near(u.hp, hp - Math.ceil(hp * .005));
  const drain = receipts.filter(r => r.target === u); assert.equal(drain.length, 1);
  assert.equal(drain[0].dmg.type, 'true'); assert.equal(drain[0].dmg.noSp, true);
  near(u.skill.spTotal, 5);
  u.hp = u.s.maxHp * .8; advance(b, .1); near(u.s.atk, u.base.atk * (1 + peak));
  u.hp = u.s.maxHp * .5; advance(b, .1); near(u.s.atk, u.base.atk);
  u.hp = 1.2; advance(b, .1); near(u.hp, 1); assert.equal(u.alive, true);
  advance(b, .4); near(u.hp, 1);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: selected additive ATK/range, offensive SP and restoration`, () => {
  const { b, u, receipts } = make({ rank }); sustain(b, u);
  const e = enemy(b), baseRange = [...u.rangeKeys], bb = bbFor(0, rank);
  u.skill.setSpTotal(0); shot(b, u, e); advance(b, 1.3);
  near(u.skill.spTotal, 1); assert.equal(outgoing(receipts, u).length, 1);
  cast(b, u); near(u.s.atk, u.base.atk * (1.5 + bb.atk)); near(u.s.aspd, 100);
  advance(b, b.dt); assert.ok(u.rangeKeys.length > baseRange.length);
  assert.equal(u.rangeKeySet.has(5 * COLS + 10), true);
  receipts.length = 0; shot(b, u, e); advance(b, 1.3);
  near(outgoing(receipts, u)[0].amount, u.base.atk * (1.5 + bb.atk)); near(u.skill.spTotal, 0);
  u.skill.end('test'); near(u.s.atk, u.base.atk * 1.5); near(u.s.aspd, 127);
  advance(b, b.dt); assert.deepEqual(u.rangeKeys, baseRange);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: fixed endpoint, six trails, delayed independent burst receipts`, () => {
  const { b, u, receipts } = make({ skill: 1, rank }); sustain(b, u);
  const e = enemy(b, { x: 9 }), bb = bbFor(1, rank); cast(b, u);
  const start = b.time; near(u.s.aspd, 100);
  advance(b, 1); assert.equal(outgoing(receipts, u).length, 0);
  advanceTo(b, start + 1.6);
  const traces = b.projectiles.list.filter(p => p.flightTime > .7);
  assert.equal(traces.length, 6);
  for (let i = 0; i < 6; i++) near(traces[i].tx, 5 + .66 * (i + 1));
  const hit = outgoing(receipts, u); assert.equal(hit.length, 1);
  near(hit[0].amount, u.base.atk * 1.5 * bb.atk_scale);
  advanceTo(b, start + 2.5);
  const all = outgoing(receipts, u); assert.equal(all.length, 3);
  for (const child of all.slice(1)) near(child.amount, u.base.atk * 1.5 * bb.atk_scale_2);
  assert.equal(new Set(all.map(c => c.dmg.attackId)).size, 1);
  assert.equal(u.skill.active, false); near(u.s.aspd, 127); near(u.skill.spTotal, 0);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: empty tile targeting, strict centre/outer scale and manual stop`, () => {
  const { b, u, receipts } = make({ skill: 2, rank }); sustain(b, u);
  cast(b, u); advance(b, .25);
  const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  assert.equal(targets.length, 1); assert.equal(targets[0].kind, 'tile'); near(targets[0].x, 9);
  const central = enemy(b, { x: 10.1 }), outer = enemy(b, { x: 10.101, fly: true });
  const edge = enemy(b, { x: 11 }), outside = enemy(b, { x: 11.001 });
  shot(b, u); advance(b, .6);
  const bb = bbFor(2, rank), hits = outgoing(receipts, u); assert.equal(hits.length, 3);
  near(hits.find(c => c.target === central).amount, u.base.atk * 1.5 * bb['attack@atk_scale']);
  near(hits.find(c => c.target === outer).amount, u.base.atk * 1.5 * bb['attack@atk_scale_2']);
  near(hits.find(c => c.target === edge).amount, u.base.atk * 1.5 * bb['attack@atk_scale_2']);
  assert.equal(hits.some(c => c.target === outside), false); near(u.skill.spTotal, 0);
  assert.equal(b.activateOperator(ID), true); assert.equal(u.skill.active, false); near(u.s.aspd, 127);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_End'); advance(b, .65);
  assert.equal(u.mem.regularFormVisual, null);
});
for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) test(`S3 fixed tile rotates with ${dir}`, () => {
  const { b, u } = make({ skill: 2, dir }); cast(b, u); advance(b, .25);
  const tile = acquireTargets(b, u, effectiveProfile(u))[0];
  const expected = { UP: [5, 9], DOWN: [5, 1], LEFT: [1, 5], RIGHT: [9, 5] }[dir];
  near(tile.x, expected[0]); near(tile.y, expected[1]); shot(b, u);
  advance(b, .1); const flight = b.projectiles.list[0]; near(flight.tx, tile.x); near(flight.ty, tile.y);
});
test('tile selectors require explicit opt-in, valid stage centres and deduplicate coordinates', () => {
  const { b, u } = make();
  const tile = { id: 'tile:5,9', kind: 'tile', side: 'tile', tileR: 5, tileC: 9, x: 9, y: 5, alive: true, deployed: true };
  const p = { ...effectiveProfile(u), acquireTargets: () => [tile, { ...tile }] };
  assert.deepEqual(acquireTargets(b, u, p), []);
  assert.equal(acquireTargets(b, u, { ...p, tileTargets: true }).length, 1);
  for (const bad of [{ ...tile, x: 9.01 }, { ...tile, tileR: -1, y: -1 }, { ...tile, tileC: 21, x: 21 },
    { ...tile, tileC: 9.5, x: 9.5 }, { ...tile, alive: false }, { ...tile, deployed: false }])
    assert.deepEqual(acquireTargets(b, u, { ...p, tileTargets: true, acquireTargets: () => [bad] }), []);
});
test('ordinary radius uses all legal current centre occupants, including aerial and camouflage but excluding stealth/sleep', () => {
  const { b, u, receipts } = make(); sustain(b, u);
  const primary = enemy(b), aerial = enemy(b, { x: 9, fly: true }), camouflage = enemy(b, { x: 8, y: 6 });
  b.addBuff(camouflage, { key: 'test:cam', flags: { camouflage: true } });
  const outside = enemy(b, { x: 9.001 }), hidden = enemy(b, { x: 8.2 }), sleeping = enemy(b, { x: 8.3 });
  b.addBuff(hidden, { key: 'test:stealth', flags: { stealth: true } }); b.applyStatus(sleeping, 'sleep', { duration: 10 });
  shot(b, u, primary); advance(b, 1.3);
  const hits = outgoing(receipts, u); assert.deepEqual(new Set(hits.map(r => r.target)), new Set([primary, aerial, camouflage]));
  assert.equal(hits.some(r => r.target === outside), false); assert.equal(hits.some(r => r.target === hidden || r.target === sleeping), false);
});
test('normal hit retains its input, replaces dead inputs and still lands at a dead trace position after firing', () => {
  const { b, u, receipts } = make(); sustain(b, u);
  const a = enemy(b), z = enemy(b, { x: 8.1 });
  a.remainingDist = 100; z.remainingDist = 1; shot(b, u, a);
  advance(b, .9); b.kill(a, null); advance(b, .5);
  assert.equal(outgoing(receipts, u).some(r => r.target === z), true);
  receipts.length = 0; shot(b, u, z); advance(b, .4); b.kill(z, null);
  const replacement = enemy(b); advance(b, 1);
  assert.equal(outgoing(receipts, u).some(r => r.target === replacement), true);
});
for (const control of ['stun', 'freeze', 'sleep', 'death', 'retreat']) test(`unfired normal/S2 shots are cancelled by ${control}`, () => {
  for (const skill of [0, 1]) {
    const { b, u, receipts } = make({ skill }); const e = enemy(b);
    if (skill === 0) shot(b, u, e); else cast(b, u);
    advance(b, .2);
    if (control === 'death') b.kill(u, null);
    else if (control === 'retreat') b.retreat(u);
    else b.applyStatus(u, control, { duration: .1 });
    advance(b, 2.7); assert.equal(outgoing(receipts, u).length, 0); assert.equal(b.projectiles.list.length, 0);
  }
});
test('fired S2/child shells persist after retirement and lose the removed Vigor ATK', () => {
  const { b, u, receipts } = make({ skill: 1 }); sustain(b, u);
  const e = enemy(b, { x: 9 }); cast(b, u); advance(b, 1.15);
  assert.equal(b.projectiles.list.length > 0, true); b.retreat(u);
  advance(b, 1.5); const hits = outgoing(receipts, u); assert.equal(hits.length, 3);
  near(hits[0].amount, u.base.atk * 4);
  for (const child of hits.slice(1)) near(child.amount, u.base.atk * 2);
});
test('S3 fires repeatedly without enemies and restores offensive SP only after stopping', () => {
  const { b, u } = make({ skill: 2 }); sustain(b, u);
  u.profile.canAttack = null; u.atkCd = 0; cast(b, u); advance(b, 10);
  assert.ok(u.stats.attacks >= 4); assert.equal(u.skill.active, true); near(u.skill.spTotal, 0);
  assert.equal(b.activateOperator(ID), true); const e = enemy(b); advance(b, 3);
  assert.ok(u.skill.spTotal >= 1); assert.equal(u.skill.active, false);
});
test('Vigor checks strict HP thresholds every tenth second and takes only the highest named contribution', () => {
  const { b, u } = make();
  u.hp = u.s.maxHp * .4; advance(b, .15); near(u.s.atk, u.base.atk);
  b.heal(u, u, u.s.maxHp, { self: true }); near(u.s.atk, u.base.atk); advance(b, .1);
  near(u.s.atk, u.base.atk * 1.5);
  b.applyStatus(u, 'vigor', { key: 'external:vigor', value: .7 }); near(u.s.atk, u.base.atk * 1.7);
  cast(b, u); near(u.s.atk, u.base.atk * 2.7);
  b.removeBuff(u, 'external:vigor'); near(u.s.atk, u.base.atk * 2.5);
});
test('native direct drain bypasses shields, damage reductions and invulnerability and grants no defensive SP', () => {
  const { b, u } = make();
  b.addBuff(u, { key: 'test:resist', flags: { invulnerable: true }, mods: { dmgTakenMul: 0, trueTakenMul: 0 } });
  b.addBuff(u, { key: 'test:shield', shield: 100000 });
  u.skill.spType = 'hurt'; u.skill.setSpTotal(0);
  const hp = u.hp; advance(b, .15); near(u.hp, hp - Math.ceil(hp * .005)); near(u.skill.spTotal, 0);
  assert.equal(u.findBuff('test:shield').shield, 100000);
});
test('S3 ignores range extension for its destination and damage does not inherit ordinary splash', () => {
  const { b, u, receipts } = make({ skill: 2 }); sustain(b, u);
  b.addBuff(u, { key: 'test:range', mods: { rangeExtend: 3 } }); cast(b, u); advance(b, .25);
  const target = acquireTargets(b, u, effectiveProfile(u))[0]; near(target.x, 9);
  enemy(b, { x: 11.1 }); shot(b, u); advance(b, .6); assert.equal(outgoing(receipts, u).length, 0);
});
test('retirement clears owned aura and cast clocks, redeployment supplies fresh HP/ASPD and one drain timer', () => {
  const { b, u } = make({ skill: 1 }); cast(b, u); advance(b, .2); b.retreatOperator(ID);
  assert.equal(u.mem.regularFormVisual, null); assert.equal(u.findBuff('phenxi:vigor'), null);
  assert.equal(u.findBuff('phenxi:herald'), null); advance(b, 75); b.addDp('arkpedia', 99);
  const z = b.deployOperator(ID, 5, 5, 'RIGHT'); assert.ok(z); z.profile.canAttack = () => false;
  const hp = z.hp; advance(b, .15); near(z.hp, hp - Math.ceil(hp * .005)); near(z.s.aspd, 127);
});

// The engine executes due callbacks before advancing its clock at the end of a
// 1/30-second step. Observe the first callback on the step after its deadline.
test('ten scheduled HP-loss pulses use the current HP and round each loss upward', () => {
  const { b, u, receipts } = make(); let expected = u.hp;
  for (let i = 0; i < 10; i++) expected -= Math.ceil(expected * .005);
  advance(b, 1 + b.dt); near(u.hp, expected);
  assert.equal(receipts.filter(r => r.target === u).length, 10);
  b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .1);
  near(u.hp, expected - Math.ceil(expected * .005));
});
test('a fired S2 shell reads changed ATK while its source remains deployed', () => {
  const { b, u, receipts } = make({ skill: 1 }); sustain(b, u);
  enemy(b, { x: 9 }); cast(b, u); advance(b, 1.15);
  b.addBuff(u, { key: 'test:atk', mods: { atkPct: 1 } }); advance(b, 1.5);
  const hits = outgoing(receipts, u); assert.equal(hits.length, 3);
  near(hits[0].amount, u.base.atk * 2.5 * 4);
  for (const child of hits.slice(1)) near(child.amount, u.base.atk * 2.5 * 2);
});
for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) test(`S2 six delayed trail locations rotate with ${dir}`, () => {
  const { b, u } = make({ skill: 1, dir }); cast(b, u); advance(b, 1.6);
  const traces = b.projectiles.list.filter(p => p.flightTime > .7); assert.equal(traces.length, 6);
  const [dx, dy] = { UP: [0, 1], DOWN: [0, -1], LEFT: [-1, 0], RIGHT: [1, 0] }[dir];
  for (let i = 0; i < 6; i++) {
    near(traces[i].tx, 5 + dx * .66 * (i + 1)); near(traces[i].ty, 5 + dy * .66 * (i + 1));
  }
});
for (const retirement of ['stop', 'death', 'retreat']) test(`fired S3 shell survives ${retirement} without a second damage application`, () => {
  const { b, u, receipts } = make({ skill: 2 }); sustain(b, u); enemy(b, { x: 9 });
  cast(b, u); advance(b, .25); shot(b, u); advance(b, .1);
  assert.equal(b.projectiles.list.length, 1);
  if (retirement === 'stop') b.activateOperator(ID);
  else if (retirement === 'death') b.kill(u, null); else b.retreat(u);
  advance(b, .8); const hits = outgoing(receipts, u); assert.equal(hits.length, 1);
  near(hits[0].amount, u.base.atk * (retirement === 'stop' ? 1.5 : 1) * 2.2);
  advance(b, 1); assert.equal(outgoing(receipts, u).length, 1);
});
test('S1 expires naturally and returns its range, ATK, ASPD and offensive SP recovery', () => {
  const { b, u } = make(); sustain(b, u); const range = [...u.rangeKeys]; cast(b, u);
  advance(b, 30 + b.dt); assert.equal(u.skill.active, false);
  assert.deepEqual(u.rangeKeys, range); near(u.s.atk, u.base.atk * 1.5); near(u.s.aspd, 127);
  const e = enemy(b); shot(b, u, e); advance(b, 1.3); near(u.skill.spTotal, 1);
});

test('S3 destination also ignores permanent range extension and falls back to actual edge tiles', () => {
  const { b, u } = make({ skill: 2 });
  b.addBuff(u, { key: 'test:permanent-range', persist: true, mods: { rangeExtend: 3 } }); b.refreshRange(u);
  assert.equal(u.baseRangeKeys.includes(5 * COLS + 12), true);
  cast(b, u); advance(b, .25);
  near(acquireTargets(b, u, effectiveProfile(u))[0].x, 9);
  b.grid.inRect = (r, c) => r >= 0 && r < 19 && c >= 0 && c < 8;
  near(acquireTargets(b, u, effectiveProfile(u))[0].x, 7);
});
