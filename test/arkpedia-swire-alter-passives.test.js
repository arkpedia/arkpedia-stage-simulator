// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { COLS } from '../server/sim/constants.js';
import { SWIRE_ALTER_ID as ID } from '../server/sim/content/arkpedia-swire-alter-economy.js';
import { SWIRE_BOMB_ID as BOMB, SWIRE_PASSIVE_CONTRACT as CONTRACT,
  prepareSwirePassives } from '../server/sim/content/arkpedia-swire-alter-passives.js';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function until(f, predicate, seconds = 10) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), `Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', defer = false,
  battle = null, contract = CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = e.tables.character, phase = c.phases[elite], skillId = `skchr_swire2_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillId, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = e.tables.skills[skillId].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: e.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId,
      rangeGrid: e.tables.ranges[level.rangeId].grids.map(g => [g.row, g.col]), trigger: { rule: 'NEVER' } },
    arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareSwirePassives(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => { assert.equal(b._deploy(u, { initial: false }), true); b.getPlayer('arkpedia').dp = 99; };
  if (!defer) deploy();
  const hits = [], heals = [], attacks = [], births = [], triggers = [], bombHits = [];
  b.on('damaged', ctx => { if (ctx.source === u || ctx.source?.defId === BOMB) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u || ctx.attacker?.defId === BOMB) attacks.push({ ...ctx, time: b.time }); });
  b.on('swireHeal', ctx => heals.push({ ...ctx, time: b.time }));
  b.on('swireBombBirth', ctx => births.push({ ...ctx, time: b.time }));
  b.on('swireBombTrigger', ctx => triggers.push({ ...ctx, time: b.time }));
  b.on('swireBombHit', ctx => bombHits.push({ ...ctx, time: b.time }));
  return { b, u, build, deploy, hits, heals, attacks, births, triggers, bombHits, ...prepared };
}
function enemy(f, { row = 5, col = 6, fly = false, def = 0, hp = 1e7, area, taunt = 0 } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 500, def, res: 0, moveSpeed: 0, tauntLevel: taunt });
  t.markDirty(); t.hp = hp; if (fly) t.motion = 'FLY'; if (area) t.hitArea = area;
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return t;
}
function ally(f, { row = 4, col = 5, ratio = .5, flags = {} } = {}) {
  const def = normalizeChess({ chessId: `fixture:${row}:${col}`, charId: 'fixture',
    stats: { maxHp: 10000, atk: 0, def: 0, blockCnt: 0 }, rangeGrid: [[0, 0]], skill: null });
  const t = f.b._makeAlly(f.u.player, def, 'op', row, col);
  f.b._setupUnit(t, { trait: { noAttack: true }, skill: null });
  assert.ok(f.b._deploy(t)); t.hp = t.s.maxHp * ratio;
  if (Object.keys(flags).length) f.b.addBuff(t, { key: 'fixture:flags', flags });
  return t;
}
function place(f, tile = { row: 5, col: 7 }) {
  const t = f.controller.bombs.place(tile); assert.ok(t);
  // Hold this fixture owner without stopping its already placed independent device.
  f.b.addBuff(f.u, { key: 'fixture:hold', flags: { disarm: true } });
  f.controller.wallet.upkeep.cancel(); return t;
}

test('partial passives stay private and reject S3, missing contracts and malformed selected builds before hooks', () => {
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.deepEqual(e.enabledOperators, []); assert.equal(e.runtimeMapping, undefined);
  assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ skill: 3 }), /Incomplete/);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  const f = make({ defer: true });
  for (const mutate of [d => { d.skill.rangeGrid = []; }, d => { d.rangeGrid = [[0, 4]]; },
    d => { d.raw.arkpedia.module = 'merchant-x'; }, d => { d.raw.arkpedia.skillRank = 11; },
    d => { d.skill.id = 'skchr_swire2_2'; }, d => { d.skill.skillType = 'MANUAL'; },
    d => { d.skill.spType = 'time'; }, d => { d.skill.spCost = 1; }, d => { d.skill.initSp = 1; },
    d => { d.skill.maxCharges = 2; }, d => { d.skill.duration = 1; }, d => { d.skill.bb.sp = 10; }]) {
    const def = structuredClone(f.u.def); mutate(def); const u = f.b._makeAlly(f.u.player, def, 'op', 7, 7);
    const count = Object.values(f.b._hooks).flat().length;
    assert.throws(() => prepareSwirePassives(f.b, u, { contract: CONTRACT }));
    assert.equal(Object.values(f.b._hooks).flat().length, count);
  }
  assert.throws(() => prepareSwirePassives(f.b, f.u, { contract: CONTRACT }), /fresh/);
});

test('all twenty ranks preserve source heal/bomb coefficients, passive activation and isolated capacities', () => {
  const heals = [.25, .3, .35, .4, .45, .5, .55, .6, .7, .8];
  const bombs = [1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.8, 1.9, 2];
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), a = ally(f); until(f, () => f.heals.length === 1);
    near(f.heals[0].healed, 810 * heals[rank - 1]); assert.equal(f.heals[0].target, a);
    assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.manual, false);
    assert.equal(f.controller.wallet.coins, 0);
    assert.equal(f.record.capacity, [1, 1, 1, 2, 2, 2, 2, 3, 3, 3][rank - 1]);
    const g = make({ skill: 2, rank }), t = place(g); enemy(g, { col: 7 });
    until(g, () => g.bombHits.length === 1); near(g.hits[0].amount, 810 * bombs[rank - 1]);
    assert.equal(g.hits[0].source, t); assert.equal(t.alive, false);
    assert.equal(g.record.capacity, [3, 3, 3, 3, 3, 3, 4, 4, 5, 5][rank - 1]);
  }
});

test('ordinary attacks wait for original entrance/OnAttack, target only one enemy and spend no coin', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ dir });
    const coordinates = { RIGHT: [5, 6], UP: [6, 5], LEFT: [5, 4], DOWN: [4, 5] }[dir];
    const a = enemy(f, { row: coordinates[0], col: coordinates[1] });
    const z = enemy(f, { row: coordinates[0], col: coordinates[1] });
    advance(f.b, 1.1); assert.equal(f.hits.length, 0);
    until(f, () => f.hits.length === 1); near(f.hits[0].time, 1.2, f.b.dt * 2);
    near(f.hits[0].amount, 810); assert.equal(f.hits[0].target, a); near(z.hp, 1e7);
    assert.equal(f.controller.wallet.coins, 1);
  }
});

test('uncapped ASPD scaling accelerates native events and keeps one damage event per ordinary input', () => {
  const f = make(); enemy(f); f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 100 } });
  until(f, () => f.hits.length === 3);
  near(f.hits[0].time, 1.1, f.b.dt * 2); near(f.hits[2].time - f.hits[0].time, 1, f.b.dt * 2);
  near(f.u.mem.regularFormVisual.speed, 2); assert.equal(f.attacks.length, 3);
});

test('ordinary PRECAST input survives a later higher-priority enemy but cannot substitute a dead input', () => {
  const f = make(), first = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const later = enemy(f, { taunt: 10 }); until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].target, first); near(later.hp, 1e7);
  const g = make(), lost = enemy(g); until(g, () => g.controller.phase?.kind === 'attack');
  g.b.kill(lost); const other = enemy(g); advance(g.b, .4);
  assert.equal(g.hits.length, 0); near(other.hp, 1e7);
});

test('S1 chooses lowest HP ratio, replaces ordinary damage, and needs no enemy', () => {
  const f = make(), a = ally(f, { ratio: .6 }), z = ally(f, { row: 6, ratio: .2 }); enemy(f);
  until(f, () => f.heals.length === 1);
  assert.equal(f.heals[0].target, z); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 1);
  near(a.hp, 6000); near(z.hp, 2648); assert.equal(f.controller.wallet.coins, 0);
  const g = make(); const only = ally(g); until(g, () => g.heals.length === 1);
  assert.equal(g.heals[0].target, only); assert.equal(g.hits.length, 0);
});

test('native S1 center and excludeOwner=0 permit self-healing; literal 70% and outside range do not qualify', () => {
  const f = make(); f.u.hp *= .5; until(f, () => f.heals.length === 1);
  assert.equal(f.heals[0].target, f.u); near(f.heals[0].healed, 648);
  const g = make(); const equal = ally(g, { ratio: .7 }); ally(g, { row: 3, ratio: .01 }); enemy(g);
  until(g, () => g.hits.length === 1); assert.equal(g.heals.length, 0); near(equal.hp, 7000);
  assert.equal(g.controller.wallet.coins, 1);
});

test('S1 respects heal-free/isolation/target-free/sleep and ordinary healing modifiers', () => {
  for (const flag of ['healFree', 'isolated', 'untargetable', 'sleep', 'noHeal']) {
    const f = make(); ally(f, { flags: { [flag]: true } }); enemy(f);
    until(f, () => f.hits.length === 1); assert.equal(f.heals.length, 0); assert.equal(f.controller.wallet.coins, 1);
  }
  const f = make(), a = ally(f);
  f.b.addBuff(f.u, { key: 'fixture:healing', mods: { healingDealtMul: .5 } });
  f.b.addBuff(a, { key: 'fixture:received', mods: { healingTakenMul: 1.5 } });
  until(f, () => f.heals.length === 1); near(f.heals[0].healed, 648 * .75);
});

test('S1 PRECAST does not substitute a different injured ally at birth or spend on an invalid recipient', () => {
  for (const invalidate of ['full', 'leave', 'withdraw', 'heal-free']) {
    const f = make(), a = ally(f, { ratio: .1 }), other = ally(f, { row: 6, ratio: .2 });
    until(f, () => f.controller.phase?.kind === 'heal');
    if (invalidate === 'full') a.hp = a.s.maxHp;
    if (invalidate === 'leave') a.tileR = a.y = 2;
    if (invalidate === 'withdraw') f.b.retreat(a, { permanent: true });
    if (invalidate === 'heal-free') f.b.addBuff(a, { key: 'fixture:blocked', flags: { healFree: true } });
    advance(f.b, .4); assert.equal(f.heals.length, 0); near(other.hp, 2000);
    assert.equal(f.controller.wallet.coins, 1);
  }
});

test('interrupted or hook-rejected S1 actions preserve coins; accepted canceled healing still spends once', () => {
  for (const flag of ['stun', 'disarm', 'freeze', 'sleep']) {
    const f = make(); ally(f); until(f, () => f.controller.phase?.kind === 'heal');
    f.b.addBuff(f.u, { key: 'fixture:interrupt', flags: { [flag]: true } }); advance(f.b, .5);
    assert.equal(f.heals.length, 0); assert.equal(f.controller.wallet.coins, 1);
  }
  const f = make(); ally(f);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = []; });
  advance(f.b, 1.7); assert.equal(f.heals.length, 0); assert.equal(f.controller.wallet.coins, 1);
  const g = make(); ally(g); g.b.on('heal', ctx => { if (ctx.source === g.u) ctx.amount = 0; });
  until(g, () => g.heals.length === 1); assert.equal(g.heals[0].healed, 0); assert.equal(g.controller.wallet.coins, 0);
});

test('no-coin S1 falls back to normal attack; accepted heal uses current ATK and later upkeep replenishes coins', () => {
  const f = make(), a = ally(f); enemy(f); f.controller.wallet.spend();
  until(f, () => f.hits.length === 1); assert.equal(f.heals.length, 0);
  until(f, () => f.heals.length === 1, 6); assert.equal(f.heals[0].target, a);
  near(f.heals[0].healed, 810 * 1.04 * .8); assert.equal(f.controller.wallet.stacks, 1);
});

test('S2 automatically prefers an enemy root tile, then deterministic legal random ground; no deck or slot payment', () => {
  const f = make({ skill: 2 }), target = enemy(f, { col: 7, taunt: 2 }); enemy(f, { row: 6, col: 5 });
  until(f, () => f.births.length === 1);
  assert.deepEqual(f.births[0].tile, { row: 5, col: 7 }); assert.equal(f.triggers.length, 0);
  const t = f.births[0].token;
  assert.equal(t.defId, BOMB); assert.equal(t.kind, 'device'); assert.equal(t.deploymentSlotCost, 0);
  near(t.base.atk, 100); near(t.s.maxHp, 1000); near(t.base.cost, 0); near(f.b.dp, 99);
  assert.equal(f.b.regularSummons?.has(`summon:${ID}`) ?? false, false);
  until(f, () => f.bombHits.length === 1); assert.equal(f.bombHits[0].target, target);
  const g = make({ skill: 2 }); g.b.rng = () => 0;
  until(g, () => g.births.length === 1); assert.deepEqual(g.births[0].tile, { row: 7, col: 5 });
});

test('S2 placement rejects high, unbuildable, impassable, obstacle, occupied, reserved and down tiles without spending', () => {
  const f = make({ skill: 2 }), deck = f.controller.bombs, row = 5, col = 7, k = row * COLS + col;
  const original = { ...f.b.grid.tile(row, col) };
  for (const bad of [{ height: 'HIGH' }, { build: 'RANGED' }, { build: 'NONE' }, { pass: 'FLY' }]) {
    Object.assign(f.b.grid.tile(row, col), bad); assert.equal(deck.place({ row, col }), null);
    assert.equal(f.controller.wallet.coins, 1); Object.assign(f.b.grid.tile(row, col), original);
  }
  f.b.grid.obstacle[k] = 1; assert.equal(deck.place({ row, col }), null); f.b.grid.obstacle[k] = 0;
  const a = ally(f, { row, col }); assert.equal(deck.place({ row, col }), null); f.b.retreat(a, { permanent: true });
  const reservation = f.b.reserveTile(f.u, row, col, 'fixture:reserve');
  assert.ok(reservation); assert.equal(deck.place({ row, col }), null); f.b.releaseTileReservations(f.u, 'fixture:reserve');
  assert.equal(deck.place({ row: -1, col }), null); assert.equal(f.controller.wallet.coins, 1);
  for (const badRow of [NaN, 5.5, undefined]) assert.equal(deck.place({ row: badRow, col }), null);
  const old = f.b.downOn; f.b.downOn = () => true;
  assert.equal(deck.place({ row, col }), null); f.b.downOn = old;
});

test('S2 rechecks CAST tile legality and falls back to normal attacking when every bomb tile is invalid', () => {
  const f = make({ skill: 2 }); enemy(f, { col: 7 });
  until(f, () => f.controller.phase?.kind === 'bomb');
  const tile = f.controller.phase.tile;
  Object.assign(f.b.grid.tile(tile.row, tile.col), { build: 'NONE' });
  until(f, () => f.births.length === 1); assert.notDeepEqual(f.births[0].tile, tile);
  const g = make({ skill: 2 }); enemy(g);
  g.b.grid.tiles.forEach(t => { t.build = 'NONE'; });
  until(g, () => g.hits.length === 1); assert.equal(g.births.length, 0); assert.equal(g.controller.wallet.coins, 1);
});

test('interrupted/hook-rejected S2 windups and failed synchronous spawns leave no token or coin loss', () => {
  const f = make({ skill: 2 }); until(f, () => f.controller.phase?.kind === 'bomb');
  f.b.addBuff(f.u, { key: 'fixture:interrupt', flags: { stun: true } }); advance(f.b, .5);
  assert.equal(f.births.length, 0); assert.equal(f.controller.wallet.coins, 1);
  const g = make({ skill: 2 }); g.b.on('beforeAttack', ctx => { if (ctx.attacker === g.u) ctx.targets = []; });
  advance(g.b, 1.8); assert.equal(g.births.length, 0); assert.equal(g.controller.wallet.coins, 1);
  const h = make({ skill: 2 }), spawn = h.b.spawnToken; h.b.spawnToken = () => null;
  assert.equal(h.controller.bombs.place({ row: 5, col: 7 }), null); assert.equal(h.controller.wallet.coins, 1);
  h.b.spawnToken = spawn;
});

test('young bomb arms before its original OnStart, hits one victim, applies Slow and withdraws once', () => {
  const f = make({ skill: 2 }), t = place(f), a = enemy(f, { col: 7 }), z = enemy(f, { col: 7 });
  until(f, () => f.bombHits.length === 1);
  assert.ok(f.triggers[0].time < .3); assert.equal(f.triggers[0].aged, false);
  assert.equal(f.bombHits[0].target, a); near(z.hp, 1e7); assert.equal(f.bombHits.length, 1);
  near(f.hits[0].amount, 1620); near(a.buffs.find(b => b.status === 'sluggish').mods.moveMul, .2);
  assert.equal(t.alive, false); assert.equal(f.controller.bombs.tokens.size, 0);
});

test('aged bomb gives two distinct Physical receipts with one identity and Slow only on the first', () => {
  const f = make({ skill: 2 }), t = place(f); advance(f.b, 3.1);
  const target = enemy(f, { col: 7, def: 500 }); let slows = 0;
  const status = f.b.applyStatus.bind(f.b); f.b.applyStatus = (u, key, args) => {
    if (u === target && key === 'sluggish') slows++; return status(u, key, args);
  };
  until(f, () => f.bombHits.length === 2);
  assert.equal(f.triggers[0].aged, true); assert.equal(slows, 1); assert.equal(t.alive, false);
  assert.equal(f.hits.length, 2); near(f.hits[0].amount, 1120); near(f.hits[1].amount, 1120);
  assert.equal(f.hits[0].dmg.attackId, f.hits[1].dmg.attackId);
  near(f.bombHits[1].time - f.bombHits[0].time, .1, f.b.dt * 1.01);
  assert.equal(f.attacks.filter(a => a.attacker === t).length, 1); assert.equal(t.stats.attacks, 1);
});

test('bomb age is captured on trigger, and losing its first input does not spend another coin or arm again', () => {
  const f = make({ skill: 2 }); const t = place(f); advance(f.b, 2.8); enemy(f, { col: 7 });
  until(f, () => f.triggers.length === 1); assert.equal(f.triggers[0].aged, false);
  until(f, () => f.bombHits.length === 1); advance(f.b, .3);
  assert.equal(f.bombHits.length, 1); assert.equal(t.alive, false);
  const g = make({ skill: 2 }); const lost = place(g), victim = enemy(g, { col: 7 });
  until(g, () => g.triggers.length === 1); g.b.kill(victim); enemy(g, { col: 7 });
  advance(g.b, .5); assert.equal(g.bombHits.length, 0); assert.equal(lost.alive, false);
  assert.equal(g.controller.wallet.coins, 0); assert.equal(g.births.length, 1);
});

test('one source selector can detect a large grounded body touching the bomb without selecting nearby ordinary bodies', () => {
  const f = make({ skill: 2 }); place(f);
  const distant = enemy(f, { col: 8 }); advance(f.b, .5); assert.equal(f.triggers.length, 0);
  const huge = enemy(f, { col: 8, area: { w: 2, h: 1, dx: 0, dy: 0 } });
  until(f, () => f.bombHits.length === 1); assert.equal(f.bombHits[0].target, huge); near(distant.hp, 1e7);
});

test('bomb dodge/shield cancellation keeps first-hit Slow independent and damage credit on the actual token', () => {
  for (const kind of ['dodge', 'shield']) {
    const f = make({ skill: 2 }), t = place(f), target = enemy(f, { col: 7 });
    f.b.addBuff(target, { key: 'fixture:block-damage',
      ...(kind === 'dodge' ? { mods: { dodgePhys: 1 } } : { shield: 1e5 }) });
    until(f, () => f.bombHits.length === 1); near(target.hp, 1e7);
    assert.ok(target.buffs.some(b => b.status === 'sluggish')); near(t.base.atk, 100);
    assert.equal(t.stats.attacks, 1); assert.equal(f.attacks.filter(a => a.attacker === t).length, 1);
  }
});

test('bombs preserve captured owner damage despite later buffs; Physical DEF and minimum damage remain ordinary', () => {
  const f = make({ skill: 2 }); f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  const t = place(f); near(t.base.atk, 100);
  f.b.removeBuff(f.u, 'fixture:atk'); f.b.addBuff(f.u, { key: 'fixture:later', mods: { atkPct: 10 } });
  enemy(f, { col: 7, def: 1e5 }); until(f, () => f.bombHits.length === 1);
  near(f.hits[0].amount, 810 * 1.5 * 2 * .05); near(t.base.atk, 100);
});

test('a bomb ignores air, camouflage, stealth, sleep and target-free until a legal grounded victim enters', () => {
  for (const flag of ['fly', 'camou', 'stealth', 'sleep', 'untargetable']) {
    const f = make({ skill: 2 }); place(f); const bad = enemy(f, { col: 7, fly: flag === 'fly' });
    if (flag !== 'fly') f.b.addBuff(bad, { key: 'fixture:conceal', flags: { [flag]: true } });
    advance(f.b, .8); assert.equal(f.triggers.length, 0);
    const good = enemy(f, { col: 7 }); until(f, () => f.bombHits.length === 1);
    assert.equal(f.bombHits[0].target, good);
  }
});

test('bomb PRECAST loses a departed/dead input without replacing it; aged second receipt never retargets after a kill', () => {
  const f = make({ skill: 2 }); place(f); const a = enemy(f, { col: 7 });
  until(f, () => f.triggers.length === 1); a.x = 12; a.y = 12;
  enemy(f, { col: 7 }); advance(f.b, .4); assert.equal(f.bombHits.length, 0);
  const g = make({ skill: 2 }); place(g); advance(g.b, 3.1);
  const first = enemy(g, { col: 7, hp: 100 }), other = enemy(g, { col: 7 });
  until(g, () => g.bombHits.length === 1); assert.equal(first.alive, false);
  advance(g.b, .2); near(other.hp, 1e7); assert.equal(g.bombHits.length, 1);
});

test('owner finish clears idle/unborn bombs; an accepted aged second receipt survives removal of its owner and token', () => {
  const f = make({ skill: 2 }), idle = place(f); f.b.retreat(f.u, { permanent: true });
  assert.equal(idle.alive, false); assert.equal(f.controller.bombs.finishHook, null);
  const g = make({ skill: 2 }), unborn = place(g); enemy(g, { col: 7 });
  until(g, () => g.triggers.length === 1); g.b.retreat(g.u, { permanent: true });
  advance(g.b, .4); assert.equal(g.bombHits.length, 0); assert.equal(unborn.alive, false);
  const h = make({ skill: 2 }), born = place(h); advance(h.b, 3.1); enemy(h, { col: 7 });
  until(h, () => h.bombHits.length === 1); h.b.retreat(h.u, { permanent: true });
  assert.equal(born.alive, false); until(h, () => h.bombHits.length === 2);
  assert.equal(h.controller.bombs.outputs.size, 0); assert.equal(h.controller.bombs.finishHook, null);
});

test('battle finish cancels accepted delayed outputs; fresh placement resets economy and cannot inherit old bombs', () => {
  const f = make({ skill: 2 }); place(f); advance(f.b, 3.1); enemy(f, { col: 7 });
  until(f, () => f.bombHits.length === 1); f.b.forceEnd('fixture');
  assert.equal(f.controller.bombs.outputs.size, 0); assert.equal(f.controller.bombs.finishHook, null);
  const g = make({ skill: 2 }); place(g); g.b.retreat(g.u, { permanent: true });
  advance(g.b, .1); const fresh = make({ battle: g.b, skill: 2 });
  assert.equal(fresh.controller.wallet.coins, 1); assert.equal(fresh.controller.wallet.stacks, 0);
  assert.equal(fresh.controller.bombs.tokens.size, 0); assert.notEqual(fresh.u, g.u);
  advance(fresh.b, 1.5); assert.equal(fresh.births.length, 1); assert.equal(g.controller.stopped, true);
});

test('installed bench owner stays ready until its first deployment', () => {
  const f = make({ defer: true }); advance(f.b, 2);
  assert.equal(f.controller.stopped, false); f.deploy(); ally(f);
  until(f, () => f.heals.length === 1); assert.equal(f.controller.wallet.coins, 0);
});
