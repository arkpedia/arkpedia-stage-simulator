// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { steamKnightNative, steamKnightParams } from '../shared/arkpedia/enemy-steam-knight-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

const id = 'enemy_1533_stmkgt', entry = ENEMY_RECORDS.enemies[id];
const PREFAB = 'dyn/battle/prefabs/enemies/enemy_1533_stmkgt.prefab';
const withComponent = (pick, edit) => { const n = structuredClone(native); for (const row of n.prefabs[PREFAB]) { const d = JSON.parse(row.originalJson); if (pick(d)) { edit(d); row.originalJson = JSON.stringify(d); } } return nativeComponents(n, id); };
const bomb = (key, extra = []) => ({ prefabKey: key, priority: 0, cooldown: 99999, initCooldown: key.includes('first') ? 0 : 99999, spCost: 0,
  blackboard: [{ key: 'is_hard_level', value: 0, valueStr: 'false' }, { key: 'mark_duration', value: 8, valueStr: null },
    { key: 'atk_scale', value: key.includes('first') ? .5 : .4, valueStr: null }, ...extra] });
// The original 11-20, H11-2 adverse and H11-4 adverse overrides.
const STAGE = {
  '11-20': r => applyStageEnemyBlackboard(r, { level: 0, spData: null, blackboard: [{ key: 'reborn.is_hard_level', value: 0, valueStr: 'false' }],
    skills: [bomb('HeroBomb[first_state]'), bomb('HeroBomb[second_state]')] }),
  'h11-2': r => applyStageEnemyBlackboard(r, { level: 1, spData: null, blackboard: [],
    skills: [{ ...bomb('HeroBomb[first_state]'), initCooldown: 99999 }, bomb('HeroBomb[second_state]')] }),
  'h11-4': r => applyStageEnemyBlackboard(r, { level: 1, spData: null, blackboard: [{ key: 'reborn.move_speed', value: .5, valueStr: null }],
    skills: [{ prefabKey: 'Boost', priority: 1, cooldown: 40, initCooldown: 25, spCost: 0, blackboard: [
      { key: 'move_speed', value: .3, valueStr: null }, { key: 'attack_speed', value: 100, valueStr: null }, { key: 'boost_duration', value: 15, valueStr: null },
      { key: 'stun', value: 5, valueStr: null }, { key: 'damage_resistance', value: .3, valueStr: null }, { key: 'is_hard_level', value: 0, valueStr: 'true' }] }] }),
};

test('both levels are admitted from the pinned native tree; changed kits are refused', () => {
  assert.ok(enemySupport(entry, clocks.prefabs, native).policy);
  const n = nativeComponents(native, id);
  for (const r of Object.values(entry.levels)) assert.equal(steamKnightNative(r, n), true, `level ${r.level}`);
  const r0 = entry.levels[0];
  assert.equal(steamKnightNative({ ...r0, talents: { ...r0.talents, bb: { ...r0.talents.bb, 'TriggerHeroBomb.hp_ratio': .4 } } }, n), false);
  assert.equal(steamKnightNative(r0, withComponent(d => d._maxRespawnCnt === 1, d => { d._maxRespawnCnt = 2; })), false, 'two revives');
  assert.equal(steamKnightNative(r0, withComponent(d => d._maxNum === 2 && d._postFilter === 19 && d._buffs, d => { d._maxNum = 3; })), false, 'three bomb targets');
});

test('parameters: level 0 database, level 1 read over level 0, and the stage overrides', () => {
  const p0 = steamKnightParams(entry.levels[0]);
  assert.deepEqual(p0.debut, { aspd: -50, move: -.5 });
  assert.deepEqual([p0.boost.cooldown, p0.boost.initial, p0.boost.duration, p0.boost.aspd, p0.boost.move, p0.boost.stun, p0.boost.hard], [45, 25, 15, 100, .3, 5, false]);
  assert.deepEqual([p0.zantetsuken.cost, p0.zantetsuken.times, p0.zantetsuken.scale, p0.zantetsuken.duration], [4, 3, 1.25, 7]);
  assert.deepEqual([p0.bomb.first.threshold, p0.bomb.first.targets, p0.bomb.first.scale, p0.bomb.first.hard], [.5, 1, .5, true]);
  assert.deepEqual([p0.bomb.second.threshold, p0.bomb.second.targets, p0.bomb.second.scale, p0.bomb.second.hard], [.3, 2, .4, true]);
  assert.deepEqual(p0.revive, { duration: 8, invincible: 15, aspd: 100, move: .3, def: -1500, res: -40, resistance: .3, hard: true, bombDelay: .1, moveMul: 0 });
  const p1 = steamKnightParams(entry.levels[1]);
  assert.deepEqual([p1.boost.cooldown, p1.boost.initial, p1.boost.hard, p1.revive.def, p1.bomb.first.hard, p1.debut.aspd], [40, 40, true, -2000, true, -50]);
  const s20 = steamKnightParams(STAGE['11-20'](entry.levels[0]));
  assert.deepEqual([s20.revive.hard, s20.bomb.first.hard, s20.bomb.second.hard, s20.boost.hard, s20.boost.cooldown], [false, false, false, false, 45]);
  const h2 = steamKnightParams(STAGE['h11-2'](entry.levels[1]));
  assert.deepEqual([h2.revive.hard, h2.bomb.first.hard, h2.bomb.second.hard, h2.boost.hard, h2.revive.def], [true, false, false, true, -2000]);
  const h4 = steamKnightParams(STAGE['h11-4'](entry.levels[1]));
  assert.deepEqual([h4.boost.initial, h4.boost.cooldown, h4.revive.move, h4.bomb.first.hard, h4.boost.hard], [25, 40, .5, true, true]);
  // Strings are accepted only for the reviewed keys and values.
  const bad = (bb, skills = null) => applyStageEnemyBlackboard(entry.levels[0], { level: 0, spData: null, blackboard: bb, skills });
  assert.throws(() => bad([{ key: 'reborn.is_hard_level', value: 0, valueStr: 'maybe' }]), /Unsupported original enemy parameter/);
  assert.throws(() => bad([{ key: 'reborn.branch_id', value: 0, valueStr: 'x' }]), /Unsupported original enemy parameter/);
  assert.throws(() => bad([], [{ ...bomb('HeroBomb[first_state]'), initCooldown: 5 }]), /Unsupported original enemy skill/);
});

/** The knight at row 2, col 6 (held still unless `free`); operators at the given tiles on a 5x10 map. */
function fixture(tiles, { rec = STAGE['11-20'](entry.levels[0]), hp = 1e7, free = false } = {}) {
  const op = chessRec({ id: 'stmkgt_target', stats: { maxHp: hp, atk: 0, def: 0, res: 0, blockCnt: 1 } });
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op }, enemies: { [id]: rec } },
    units: tiles.map((_, i) => ({ chessId: op.chessId, row: 10, col: 2 + i, dir: 'RIGHT' })), setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); b.regularMapSize = { rows: 5, cols: 10 };
  const ops = h.allies(); ops.forEach((u, i) => { u.y = tiles[i][0]; u.x = tiles[i][1]; });
  const releases = []; b.stageWaveScheduler = { releaseCurrentWave: (...args) => { releases.push(args); return true; } };
  const e = b.spawnEnemy(id, { pos: [2, 6], route: 0 }); e.y = 2; e.x = 6;
  if (!free) b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true } });
  const ab = e.mem.ab.list.find(a => a.stmkgt);
  const hits = []; b.on('damaged', c => { if (c.dmg?.tags?.some(t => t.startsWith('stmkgt'))) hits.push({ target: c.target, amount: c.dmg.amount, type: c.dmg.type, tag: c.dmg.tags.find(t => t.startsWith('stmkgt')), t: b.time }); });
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) { const t = b.time; b.step(); if (!(b.time > t)) throw Error(`battle time stuck at ${t}`); } };
  return { ...h, b, e, ops, ab, hits, releases, run, p: steamKnightParams(rec) };
}

test('debut slow until the first Boost at 25 s; Boost lasts 15 s, then a 5 s self-stun (normal level)', () => {
  const { b, e, ab, run } = fixture([]);
  const aspd0 = e.s.aspd;
  assert.ok(e.findBuff('stmkgt_t_debuff'));
  run(24.9); assert.ok(!e.findBuff('stmkgt_t_boost'));
  run(.2); assert.ok(e.findBuff('stmkgt_t_boost')); assert.ok(!e.findBuff('stmkgt_t_debuff'));
  assert.equal(e.s.aspd, aspd0 + 50 + 100);
  assert.ok(e.def.immune.has('stun'));
  assert.equal(b.applyStatus(e, 'stun', { duration: 3 }), false, 'control immunity');
  run(15); assert.ok(!e.findBuff('stmkgt_t_boost')); assert.ok(e.findBuff('stun'), 'self-stun');
  assert.ok(!e.def.immune.has('stun'));
  run(5.1); assert.ok(!e.findBuff('stun'));
  // The next Boost comes 45 s after the first cast.
  run(45 - 15 - 5.1 - .3); assert.ok(!e.findBuff('stmkgt_t_boost')); run(.5); assert.ok(e.findBuff('stmkgt_t_boost'));
  assert.equal(ab.form, 'first');
});

test('a hard Boost (level 1) gives 30% damage resistance and no stun', () => {
  const { b, e, run } = fixture([], { rec: STAGE['h11-4'](entry.levels[1]) });
  run(25.1); assert.ok(e.findBuff('stmkgt_t_boost'));
  assert.equal(e.findBuff('stmkgt_t_boost').mods.dmgTakenMul, .7);
  const before = e.hp; b.dealDamage(null, e, { amount: 1000, type: 'true', sourceless: true });
  assert.ok(Math.abs(before - e.hp - 700) < 1e-6, '30% less damage taken');
  run(15); assert.ok(!e.findBuff('stmkgt_t_boost')); assert.ok(!e.findBuff('stun'));
});

test('Zantetsuken: after four attacks he charges the blocked operator and hits it three times at 125% at 5.2 s', () => {
  const { b, e, ops: [op], ab, hits, run } = fixture([[2, 5]]);
  for (let i = 0; i < 4; i++) e.mem.ab.list.find(a => a.attack).attack({ targets: [op] }, b, e, ab);
  assert.equal(ab.sp, 4);
  e.blockedBy = op; const t0 = b.time; hits.length = 0;
  run(.1); assert.equal(ab.cast?.kind, 'zantetsuken'); assert.equal(ab.sp, 0);
  run(5); assert.equal(hits.filter(h => h.tag === 'stmkgtZantetsuken').length, 0);
  run(.3);
  const z = hits.filter(h => h.tag === 'stmkgtZantetsuken');
  assert.equal(z.length, 3); assert.ok(z.every(h => Math.abs(h.t - t0 - 5.2) < .05 && h.type === 'phys'));
  run(2); assert.equal(ab.cast, null);
});

test('HeroBomb: at 50% HP he leaves the ground, marks for 8 s, then bombards the 3x3 around the highest max-HP operator', () => {
  const { b, e, ops, ab, hits, run } = fixture([[2, 2], [2, 3], [0, 8]]);
  ops[0].s.maxHp = 2e7; ops[0].hp = 1e7; // highest max HP; 50% ratio
  // ops[1] is in the area at 100%; ops[2] is far.
  b.dealDamage(null, e, { amount: e.s.maxHp * .5 + 1, type: 'true', sourceless: true });
  run(.1); assert.ok(ab.bomb); assert.ok(e.s.flags.invulnerable); assert.ok(e.def.immune.has('palsy'));
  run(1.2 + 8 + .05); assert.equal(ab.bomb.phase, 'bomb'); hits.length = 0;
  run(5.6);
  const bomb = hits.filter(h => h.tag === 'stmkgtBomb');
  assert.equal(bomb.length, 8, 'at most 8 hits');
  assert.ok(bomb.every(h => h.type === 'arts' && Math.abs(h.amount - e.s.atk * .5) < 1e-6));
  assert.ok(bomb.every(h => h.target !== ops[2]));
  assert.equal(bomb[0].target, ops[1], 'the highest HP ratio in the area first');
  assert.ok(!b.noDeployTiles?.size, 'not a hard level');
  run(1.6); assert.equal(ab.bomb, null); assert.ok(!e.s.flags.invulnerable);
  assert.ok(Math.abs(ab.mark - e.hp / e.s.maxHp) < 1e-9);
});

test('a hard HeroBomb seals the empty buildable tiles of its area', () => {
  // The harness grid's rect is rows 9-12, so the operator stands at row 10.
  const { b, e, ops: [op], ab, run } = fixture([[10, 2]], { rec: STAGE['h11-4'](entry.levels[1]) });
  const tile = b.grid.tile.bind(b.grid); b.grid.tile = (r, c) => ({ ...tile(r, c), build: 'MELEE' });
  b.dealDamage(null, e, { amount: e.s.maxHp * .5 + 1, type: 'true', sourceless: true });
  run(1.3 + 8 + .1);
  assert.deepEqual([...b.noDeployTiles].sort(), ['10,1', '10,3', '11,1', '11,2', '11,3', '9,1', '9,2', '9,3'], 'the occupied centre stays open');
});

test('Zantetsuken delays the HeroBomb until the cast ends', () => {
  const { b, e, ops: [op], ab, run } = fixture([[2, 5]]);
  ab.sp = 4; e.blockedBy = op; run(.1); assert.equal(ab.cast?.kind, 'zantetsuken');
  b.dealDamage(null, e, { amount: e.s.maxHp * .5 + 1, type: 'true', sourceless: true });
  run(1); assert.equal(ab.bomb, null); assert.ok(ab.pendingBomb);
  run(6.2); assert.ok(ab.bomb);
});

test('revive: the wave is released, 8 s later the second form with 15 s invincibility, the permanent boost and a HeroBomb', () => {
  const { b, e, ops, ab, releases, run } = fixture([[2, 2], [2, 4]]);
  const def0 = e.s.def;
  b.dealDamage(null, e, { amount: e.s.maxHp * .4, type: 'true', sourceless: true });
  ab.mark = 0; // no first-form HeroBomb in this test
  b.dealDamage(null, e, { amount: e.hp + 10, type: 'true', sourceless: true });
  assert.ok(e.alive); assert.equal(ab.form, 'reviving'); assert.equal(releases.length, 1);
  run(7.9); assert.equal(ab.form, 'reviving'); run(.2);
  assert.equal(ab.form, 'second'); assert.equal(e.hp, e.s.maxHp);
  assert.ok(e.findBuff('stmkgt_t_state_2[reborn_invincible]'));
  assert.equal(e.s.def, def0 - 1500);
  assert.ok(e.def.immune.has('stun'));
  run(.2); assert.ok(ab.bomb, 'HeroBomb on entering the second form');
  run(1.2 + 8 + .1); assert.equal(ab.bomb.areas.length, 2, 'two targets');
  run(7.5); assert.equal(ab.bomb, null);
  // A second knock-out is his death.
  b.dealDamage(null, e, { amount: e.hp + 10, type: 'true', sourceless: true });
  run(16); b.dealDamage(null, e, { amount: e.hp + 10, type: 'true', sourceless: true }); run(.1);
  assert.ok(!e.alive);
});

// Literal per-stage expectations, observed in the compiled stage (level 1 x 1.2 from the adverse rune: 96,000 HP).
for (const [stageId, expect] of [
  ['h11-2_adverse_environment', { level: 1, hp: 96000, boost: [40, 40, true], bombs: [false, false], revive: [.3, -2000, true] }],
  ['h11-4_adverse_environment', { level: 1, hp: 96000, boost: [25, 40, true], bombs: [true, true], revive: [.5, -2000, true] }],
  ['11-20', { level: 0, hp: 65000, boost: [25, 45, false], bombs: [false, false], revive: [.3, -1500, false] }],
  ['11-20_adverse_environment', { level: 0, hp: 78000, boost: [25, 45, false], bombs: [false, false], revive: [.3, -1500, false] }]])
  test(`compiled ${stageId}: level ${expect.level} at ${expect.hp} HP, Boost ${expect.boost.join('/')}, sealing ${expect.bombs[0]}`, async () => {
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const found = manifest.stages.find(s => s.id === stageId);
    assert.equal(found.availability, 'available');
    const stage = await loader.load(found), rec = stage.enemies[id];
    assert.equal(rec.level, expect.level); assert.equal(rec.stats.maxHp, expect.hp);
    // 11-20's Twigs payload branches compile as no-ops: nothing spawns a Corrupted Seed.
    if (stageId.startsWith('11-20')) for (const branch of Object.values(stage.waveProgram?.branches ?? {}))
      assert.ok(!branch.spawns?.some(x => x.enemyKey === 'enemy_1266_nhapos'));
    const p = rec.runtimeFeatures.entries.find(x => x.ability?.kind === 'steamKnight').ability.params;
    assert.deepEqual([p.boost.initial, p.boost.cooldown, p.boost.hard], expect.boost);
    assert.deepEqual([p.bomb.first.hard, p.bomb.second.hard], expect.bombs);
    assert.deepEqual([p.revive.move, p.revive.def, p.revive.hard], expect.revive);
    assert.deepEqual([p.bomb.first.threshold, p.bomb.second.threshold, p.zantetsuken.scale], [.5, .3, 1.25]);
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    for (let i = 0; i < 200; i++) b.step();
    assert.deepEqual(b.errors, []);
  });

test('inert Twigs payload: only one-seed branches in a level that places no Twigs', async () => {
  const { inertTwigsPayload } = await import('../tools/arkpedia/stage-branches.mjs');
  const seed = r => ({ phases: [{ preDelay: 0, actions: [{ actionType: 'SPAWN', key: 'enemy_1266_nhapos', count: 1, routeIndex: r }] }] });
  const level = { branches: { route1: seed(0), route2: seed(1) }, predefines: { tokenInsts: [], tokenCards: [{ inst: { characterKey: 'trap_087_allady' } }] },
    hardPredefines: { tokenInsts: [], tokenCards: [] } };
  assert.equal(inertTwigsPayload(level), true);
  const twig = { inst: { characterKey: 'trap_086_larva' } };
  assert.equal(inertTwigsPayload({ ...level, predefines: { ...level.predefines, tokenInsts: [twig] } }), false, 'Twigs placed');
  assert.equal(inertTwigsPayload({ ...level, hardPredefines: { tokenInsts: [], tokenCards: [twig] } }), false, 'Twigs card on hard');
  const other = structuredClone(level); other.branches.route2.phases[0].actions[0].key = 'enemy_1267_nhpbr_2';
  assert.equal(inertTwigsPayload(other), false, 'another enemy');
  const two = structuredClone(level); two.branches.route1.phases[0].actions[0].count = 2;
  assert.equal(inertTwigsPayload(two), false, 'two seeds');
  assert.equal(inertTwigsPayload({ ...level, branches: {} }), false, 'no branches');
});

test("11-19's turret: the Cannon's first cast at 1 s and 50% ATK are accepted; its cooldown stays the database's", () => {
  const r = ENEMY_RECORDS.enemies.enemy_1273_stmgun_2.levels[0];
  const cannon = over => ({ prefabKey: 'Cannon', priority: 0, cooldown: 25, initCooldown: 1, spCost: 0,
    blackboard: [{ key: 'atk_scale', value: .5, valueStr: null }], ...over });
  const out = applyStageEnemyBlackboard(r, { level: 0, blackboard: [], spData: null, skills: [cannon()] });
  assert.deepEqual([out.skills[0].initCooldown, out.skills[0].cooldown, out.skills[0].bb.atk_scale], [1, 25, .5]);
  assert.throws(() => applyStageEnemyBlackboard(r, { level: 0, blackboard: [], spData: null, skills: [cannon({ cooldown: 10 })] }), /Unsupported/);
});

// ---- Steam Knight S (11-19) ----
import { steamKnightSNative, steamKnightSParams } from '../shared/arkpedia/enemy-steam-knight-features.js';
const sid = 'enemy_1534_stmkgt2', sentry = ENEMY_RECORDS.enemies[sid];

test('Steam Knight S: admitted from his pinned tree; scripted entry, 999 s boost, checkpoint branch, HeroBomb[failure]', () => {
  assert.ok(enemySupport(sentry, clocks.prefabs, native).policy);
  const r = sentry.levels[0], n = nativeComponents(native, sid);
  assert.equal(steamKnightSNative(r, n), true);
  assert.equal(steamKnightSNative({ ...r, talents: { ...r.talents, bbStr: { ...r.talents.bbStr, 'reborn.branch_id': 'x' } } }, n), false);
  const p = steamKnightSParams(r);
  assert.deepEqual([p.entry, p.checkpoint.fromEnd, p.checkpoint.branch, p.boost, p.debut], ['reviving', 1, 'allady', null, null]);
  assert.deepEqual([p.revive.duration, p.revive.invincible, p.revive.aspd, p.revive.moveMul, p.revive.boostDuration, p.revive.after.def, p.revive.after.res, p.revive.bombDelay],
    [8, 0, 200, .3, 999, -1400, -40, null]);
  assert.deepEqual([p.zantetsuken.cost, p.zantetsuken.times, p.zantetsuken.scale, p.zantetsuken.duration], [3, 3, 1.2, 8]);
  assert.deepEqual([p.bomb.second.threshold, p.bomb.second.targets, p.bomb.second.scale, p.bomb.second.hard], [.5, 1, .2, false]);
});

test('Steam Knight S spawns into his 8 s revive, then fights boosted and control-immune; past his checkpoint the branch advances once', () => {
  const op = chessRec({ id: 'stmkgt2_target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 1 } });
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op }, enemies: { [sid]: sentry.levels[0] } },
    units: [], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start();
  const advanced = []; b.stageBranches = { branches: { allady: {} }, advance: k => advanced.push([k, b.time]) };
  const e = b.spawnEnemy(sid, { pos: [10, 0], route: 0 }), a = e.mem.ab.list.find(x => x.stmkgt);
  const aspd0 = e.s.aspd;
  b.step(); assert.equal(a.form, 'reviving'); assert.ok(e.s.flags.invulnerable && e.s.flags.noMove);
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) b.step(); };
  run(7.8); assert.equal(a.form, 'reviving'); run(.3);
  assert.equal(a.form, 'second'); assert.equal(e.hp, e.s.maxHp); assert.ok(!e.s.flags.invulnerable, 'no reborn invincibility (0 s)');
  assert.equal(e.s.aspd, aspd0 + 200); assert.ok(e.def.immune.has('stun'));
  // Route: 7 checkpoints, the end repeated as a leg, then the final leg; checkpoint 1 from the end is index 5.
  e.route.legs = [...Array.from({ length: 8 }, (_, i) => ({ t: 'move', r: 10, c: i === 7 ? 9 : i })), { t: 'move', r: 10, c: 9, final: true }];
  e.route.legIdx = 5; run(.2); assert.deepEqual(advanced, []);
  e.route.legIdx = 6; run(.2); e.route.legIdx = 7; run(.2);
  assert.equal(advanced.length, 1); assert.equal(advanced[0][0], 'allady');
});

test('compiled 11-19: three hidden Guards (two on one tile), the allady branch, the scripted knight; the run clears without errors', async () => {
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const found = manifest.stages.find(s => s.id === '11-19');
  assert.equal(found.availability, 'available');
  const stage = await loader.load(found);
  const guards = stage.devices.filter(d => d.key === 'trap_087_allady');
  assert.deepEqual(guards.map(d => [d.alias, d.row, d.col, d.instance.skillIndex, !!d.branchActivated, !!d.scheduledActivation]).sort(),
    [['trap_087_allady#1', 5, 6, 0, false, true], ['trap_087_allady#3', 2, 9, 0, false, true], ['trap_087_allady', 5, 6, 1, true, false]]);
  assert.deepEqual(stage.waveProgram.branches.allady.phases, [['trap_087_allady']]);
  const make = () => { const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [] }, { seed: 1 });
    b.setViewport('fullscreen-workspace'); b.life = 99; return b; };
  // Guard #1 (56 s, facing Siege): Siege and Dagda (in Siege's 3x3) are shielded at 59.2 s. Operators held alive here.
  const b1 = make(); b1.step(); for (const u of b1.allies()) b1.addBuff(u, { key: 'probe', persist: true, flags: { invulnerable: true } });
  while (b1.time < 59.1) b1.step();
  const shielded = () => b1.allies().filter(u => u.findBuff('allady_shield')).map(u => u.defId).sort();
  assert.deepEqual(shielded(), []); while (b1.time < 59.4) b1.step();
  assert.deepEqual(shielded(), ['char_112_siege', 'char_157_dagda']);
  // Unassisted (no skills, the preplaced operators fall): the knight revives, passes (5,4), the protection-point Guard
  // appears, he walks in (no life lost) and the stage clears.
  const b = make(), acts = [], act = b.activateStagePredefined.bind(b);
  b.activateStagePredefined = k => { acts.push([k, Math.round(b.time)]); return act(k); };
  while (!b.finished && b.time < 600) b.step();
  assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
  assert.deepEqual(acts.map(x => x[0]), ['trap_087_allady#1', 'trap_087_allady#3', 'trap_087_allady']);
  assert.equal(acts[0][1], 56);
});
