// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { TRAGODIA_LURE_CONTRACT as CONTRACT, prepareTragodiaLure as prepareTragodiaCore } from '../server/sim/content/arkpedia-tragodia-lure.js';

import { TRAGODIA_ID as ID, selectedTragodiaBuild } from '../server/sim/content/arkpedia-tragodia-source.js';

const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, condition, seconds = 12) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 2, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_phatm2_${skill}` };
  const r = selectedTragodiaBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareTragodiaCore(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, res = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const arts = f => f.hits.filter(h => h.type === 'arts');
const injury = (f, tag) => f.hits.filter(h => h.type === 'element' && (!tag || h.dmg.tags.includes(`tragodia:${tag}`)));
const disarmOwner = f => f.b.addBuff(f.u, { key: 'fixture:owner-pin', flags: { disarm: true } });
function attackContext(f, t, change = {}) {
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, unblockable: true } });
  return { attacker: t, targets: [f.u], isSkill: false, profile: {}, ...change };
}

const refill = f => f.u.skill.setSpTotal(f.u.skill.spCost);
const cast = f => { refill(f); assert.ok(f.u.skill.activate('manual')); };
const skillArts = (f, n = f.skills.index) => arts(f).filter(h => h.dmg.tags.includes(`tragodia:s${n}`));


const place = (f, row = 8, col = 8) => f.deck.place(row, col);
const activate = f => { cast(f); disarmOwner(f); };
const dots = f => f.hits.filter(h => h.dmg.tags.includes('tragodia:s2-lure-dot'));
const end = f => { f.deck.beginEnd(f.deck.point, 'fixture'); until(f, () => !f.deck.point, 3); };
function sibling(f) {
  const u = f.b._makeAlly(f.b.getPlayer('arkpedia'), f.u.def, 'op', 6, 5, { dir: 'RIGHT' });
  const p = prepareTragodiaCore(f.b, u, { contract: CONTRACT });
  f.b._setupUnit(u, p.kit); p.controller.install(); assert.ok(f.b._deploy(u, { initial: false }));
  u.skill.setSpTotal(u.skill.spCost); assert.ok(u.skill.activate('manual'));
  f.b.addBuff(u, { key: 'fixture:owner-pin', flags: { disarm: true } });
  return { ...p, u };
}

test('lure is explicit S2-only and remains absent from public roster', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /lure contract/);
  assert.throws(() => make({ skill: 1 }), /selected S2/);
  assert.throws(() => make({ skill: 3 }), /selected S2/);
  assert.ok(data.operators[ID]);
  const f = make(); assert.equal(f.deck.stock, 1);
  assert.match(f.deck.placementError(8, 8), /Activate S2/);
});
for (let rank = 1; rank <= 10; rank++) test(`lure rank ${rank} uses token stats, selected ATK scales and native clocks`, () => {
  const f = make({ rank }); activate(f);
  const atk = f.u.s.atk, dp = f.b.dp, slots = f.b.deployedSlots(), t = enemy(f, { row: 8, col: 9 });
  const token = place(f), point = f.deck.point;
  assert.equal(token.s.atk, 100); assert.equal(token.s.maxHp, 100); assert.equal(token.s.blockCnt, 0);
  assert.equal(f.b.deployedSlots(), slots); near(f.b.dp, dp - 5);
  assert.equal(point.targets.size, 1); assert.equal(t.s.flags.attract, true);
  near(t.findBuff(`tragodia:lure:${token.id}:attract`).timeLeft, 10);
  end(f); assert.equal(token.alive, false); assert.equal(t.s.flags.attract, undefined);
  const finishedAt = f.b.time; assert.equal(dots(f).length, 0);
  until(f, () => dots(f).length === 2);
  const first = dots(f); assert.equal(first[0].type, 'element'); assert.equal(first[1].type, 'arts');
  near(first[0].amount, atk * f.record.bb.ep_damage_ratio_token);
  near(first[1].hpLoss, atk * f.record.bb.atk_scale);
  assert.equal(first[1].dmg.isAttack, false); assert.equal(first[1].dmg.isSkill, true);
  assert.equal(first[1].dmg.canDodge, false); assert.equal(f.attacks.length, 0);
  near(first[0].time - finishedAt, .1, f.b.dt + 1e-6);
  until(f, () => dots(f).length === 4);
  near(dots(f)[2].time - first[0].time, .5, f.b.dt + 1e-6);
  near(f.deck.readyAt - finishedAt, 25, f.b.dt + 1e-6);
});
test('deck permits low ground outside host range with an enemy and no spare deployment slots', () => {
  const f = make(); activate(f); enemy(f, { row: 8, col: 8 });
  f.b.unitLimit = f.b.deployedSlots(); assert.ok(!f.u.rangeKeySet.has(8 * 21 + 8));
  const t = place(f); assert.ok(t.alive); assert.equal(f.deck.point.mode, 'ending');
  assert.equal(t.dir, 'RIGHT'); near(f.b.dp, 94);
});
test('deck rejects portrait, blocked terrain, occupancy, reservations and low DP', () => {
  const f = make(); activate(f);
  f.b.setViewport('inline'); assert.match(f.deck.placementError(8, 8), /fullscreen/); f.b.setViewport('fullscreen-workspace');
  assert.match(f.deck.placementError(-1, 8), /map/);
  const tile = f.b.grid.tile(8, 8), previous = { ...tile };
  tile.height = 'HIGH'; assert.match(f.deck.placementError(8, 8), /low-ground/); Object.assign(tile, previous);
  tile.build = 'NONE'; assert.match(f.deck.placementError(8, 8), /low-ground/); Object.assign(tile, previous);
  f.b.grid.setObstacle(8, 8, true, 'crate'); assert.match(f.deck.placementError(8, 8), /low-ground/); f.b.grid.setObstacle(8, 8, false, 'crate');
  assert.match(f.deck.placementError(5, 5), /occupied/);
  assert.ok(f.b.reserveTile(f.u, 8, 8, 'test:reserved'));
  assert.match(f.deck.placementError(8, 8), /occupied/); f.b.releaseTileReservations(f.u);
  f.u.player.dp = 4; assert.match(f.deck.placementError(8, 8), /DP/);
  f.u.player.dp = 99; place(f); assert.throws(() => place(f), /already placed/);
});
test('placement pays before deploy hooks and rolls back a rejected or reentrant owner retirement', () => {
  for (const action of ['spawn-null', 'retire', 'duplicate']) {
    const f = make(); activate(f); const dp = f.b.dp;
    if (action === 'spawn-null') f.b.spawnToken = () => null;
    else f.b.on('deploy', ({ unit }) => {
      if (unit.kind !== 'token') return;
      near(f.b.dp, dp - 5);
      if (action === 'retire') f.b.retreat(f.u, { permanent: true });
      else assert.throws(() => place(f), /already placed/);
    });
    if (action === 'duplicate') { place(f); near(f.b.dp, dp - 5); }
    else { assert.throws(() => place(f), /failed/); near(f.b.dp, dp); assert.equal(f.deck.own().length, 0); }
  }
});
test('independent 25-second recharge neither resets S2 nor refunds withdrawal DP', () => {
  const f = make(); activate(f); const t = place(f), at = f.b.time, dp = f.b.dp;
  f.deck.retreat(t); near(f.b.dp, dp); assert.equal(f.u.skill.active, true); assert.equal(f.deck.stock, 1);
  assert.match(f.deck.placementError(8, 8), /redeploying/);
  advance(f.b, 24.9); assert.match(f.deck.placementError(8, 8), /redeploying/);
  until(f, () => !f.deck.placementError(8, 8), 1); near(f.b.time - at, 25, f.b.dt);
  place(f); assert.equal(f.u.skill.activations, 1);
});
test('native scan acquires four distinct targets with elite/leader priority and no replacement', () => {
  const f = make(); activate(f);
  const normal = Array.from({ length: 4 }, () => enemy(f, { row: 8, col: 9 }));
  const elite = enemy(f, { row: 9, col: 8 }), boss = enemy(f, { row: 8, col: 10 });
  elite.def = { ...elite.def, rank: 'ELITE' }; boss.isBoss = true;
  place(f); const s = f.deck.point;
  assert.equal(s.targets.size, 4); assert.ok(s.targets.has(elite)); assert.ok(s.targets.has(boss));
  assert.equal(normal.filter(t => s.targets.has(t)).length, 2);
  f.b.kill(elite); advance(f.b, .25); assert.equal(s.targets.size, 3); assert.equal(s.seen.size, 4);
});
test('later entrants use original scan interval; acquired targets remain outside acquisition range', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 13 }); place(f);
  assert.equal(f.deck.point.targets.size, 0); t.x = 9; t.y = 8;
  advance(f.b, .05); assert.equal(f.deck.point.targets.size, 0);
  advance(f.b, .1); assert.equal(f.deck.point.targets.size, 1);
  t.x = 15; advance(f.b, .2); assert.equal(f.deck.point.targets.size, 1);
});
test('selectors reject immunity, hidden, camouflage and target-free without consuming capacity', () => {
  const f = make(); activate(f);
  const immune = enemy(f, { row: 8, col: 9 }), hidden = enemy(f, { row: 8, col: 9 });
  immune.def = { ...immune.def, immune: new Set(['attract']) }; f.b._setHidden(hidden, true);
  enemy(f, { row: 8, col: 9, flags: { camou: true } }); enemy(f, { row: 8, col: 9, flags: { untargetable: true } });
  place(f); assert.equal(f.deck.point.seen.size, 0);
  const flyer = enemy(f, { row: 8, col: 9, fly: true }); advance(f.b, .15);
  assert.ok(f.deck.point.targets.has(flyer)); assert.equal(f.deck.point.seen.size, 1);
});
test('attraction is not resistance-shortened and its own removal preserves foreign attraction', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 });
  f.b.applyStatus(t, 'resist', { duration: 30 });
  f.b.applyStatus(t, 'attract', { key: 'foreign-attract', duration: 30, point: [8, 12] });
  const token = place(f), buff = t.findBuff(`tragodia:lure:${token.id}:attract`);
  near(buff.timeLeft, 10); f.b._setHidden(t, true);
  assert.equal(t.findBuff(buff.key), null); assert.ok(t.findBuff('foreign-attract'));
  assert.equal(f.deck.point.targets.size, 0);
});
test('a status hook that removes owner or target leaves no orphan attraction', () => {
  for (const action of ['owner', 'target', 'reject']) {
    const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 });
    f.b.on('beforeStatus', ctx => {
      if (ctx.status !== 'attract') return;
      if (action === 'owner') f.b.retreat(f.u, { permanent: true });
      else if (action === 'target') f.b.kill(t); else ctx.cancel = true;
    });
    place(f); assert.equal(t.buffs.some(v => v.status === 'attract'), false);
    assert.equal(f.deck.point?.targets.size ?? 0, 0); assert.deepEqual(f.b.errors, []);
  }
});
test('strict attraction rejects walled routes and crates but flyers can reach the lure', () => {
  const f = make(); activate(f);
  for (let r = 0; r < 19; r++) f.b.grid.setObstacle(r, 9, true, 'crate');
  const ground = enemy(f, { row: 8, col: 10 }), flyer = enemy(f, { row: 8, col: 10, fly: true });
  place(f); assert.equal(f.deck.point.targets.has(ground), false); assert.equal(f.deck.point.targets.has(flyer), true);
  assert.ok(f.b.grid.waypoints(8, 10, 8, 8));
  assert.equal(f.b.grid.waypoints(8, 10, 8, 8, { avoidObstacleLike: true }), null);
  assert.equal(f.b.grid.findPath(8, 10, 8, 8, { avoidObstacleLike: true }), null);
  assert.notEqual(f.b.grid.flowField(8, 8), f.b.grid.flowField(8, 8, { avoidObstacleLike: true }));
  assert.equal(f.b.grid.flowField(8, 9, { avoidObstacleLike: true }).dist[8 * 21 + 10], -1);
});
test('actual attracted movement detours around obstacles, then resumes its original route', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 10 });
  f.b.removeBuff(t, 'fixture:pin'); t.base.moveSpeed = 1; t.markDirty();
  f.b.addBuff(t, { key: 'test:disarm', flags: { disarm: true } });
  // Native route is intentionally away from the lure; attraction overrides it.
  t.route = { legs: [{ t: 'move', c: 17, r: 8 }], legIdx: 0, pts: null, ptIdx: 0, version: -1 };
  f.b.grid.setObstacle(8, 9, true); place(f); const s = f.deck.point, ys = [];
  f.b.on('enemyMoved', ({ enemy }) => { if (enemy === t) ys.push(t.y); });
  advance(f.b, 2.4); assert.ok(t.x < 10); assert.ok(ys.some(y => Math.abs(y - 8) > .1));
  assert.ok(!(Math.round(t.y) === 8 && Math.round(t.x) === 9));
  f.deck.dropTarget(s, t); const x = t.x; advance(f.b, .3); assert.ok(t.x > x);
});
test('new walls cancel an owned tether without obstacle-ignoring movement', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 10 }); place(f);
  assert.ok(t.s.flags.attract);
  for (let r = 0; r < 19; r++) f.b.grid.setObstacle(r, 9, true);
  const x = t.x; advance(f.b, .2); assert.equal(t.s.flags.attract, undefined); near(t.x, x);
});
test('shared strict movement holds an unreachable walker; ordinary attraction keeps its fallback', () => {
  for (const strict of [true, false]) {
    const f = make(); activate(f); const t = enemy(f, { row: 8, col: 10 });
    f.b.removeBuff(t, 'fixture:pin'); t.base.moveSpeed = 1; t.markDirty();
    f.b.addBuff(t, { key: 'test:disarm', flags: { disarm: true } });
    for (let r = 0; r < 19; r++) f.b.grid.setObstacle(r, 9, true, 'crate');
    f.b.applyStatus(t, 'attract', { duration: 10, point: [8, 8], strictReachable: strict });
    advance(f.b, .2);
    if (strict) { near(t.x, 10); near(t.y, 8); assert.equal(t.moving, false); }
    else assert.ok(t.x < 10);
  }
});
test('a fast attracted walker stops at the accepted waypoint when a movement callback changes its route', () => {
  for (const reason of ['wall', 'status']) {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 10 });
  f.b.removeBuff(t, 'fixture:pin'); t.base.moveSpeed = 300; t.markDirty();
  f.b.addBuff(t, { key: 'test:disarm', flags: { disarm: true } });
  f.b.grid.setObstacle(8, 9, true, 'crate'); place(f);
  let moved;
  f.b.on('enemyMoved', ctx => {
    if (ctx.enemy !== t || moved) return;
    moved = { x: t.x, y: t.y };
    if (reason === 'wall') for (let r = 0; r < 19; r++) f.b.grid.setObstacle(r, 9, true);
    else f.deck.dropTarget(f.deck.point, t);
  });
  f.b.step(); assert.ok(moved); near(t.x, moved.x); near(t.y, moved.y);
  assert.ok(t.x > 9); assert.equal(t.route.pts, null); assert.deepEqual(f.b.errors, []);
  }
});
test('arrival and timeout use one End event; no early damage or repeated explosion', () => {
  for (const reason of ['arrival', 'timeout']) {
    const f = make(); activate(f); const t = enemy(f, { row: 8, col: reason === 'arrival' ? 8 : 9 }); place(f);
    const s = f.deck.point;
    if (reason === 'timeout') { advance(f.b, 9.9); assert.notEqual(s.mode, 'ending'); until(f, () => s.mode === 'ending', 1); }
    assert.equal(s.reason, reason); const release = s.releaseAt;
    advance(f.b, 1.4); assert.equal(s.finished, false); assert.equal(dots(f).length, 0);
    until(f, () => s.finished, .3); near(f.b.time, release, f.b.dt * 2);
    assert.equal(s.targets.size, 0); assert.equal(t.s.flags.attract, undefined);
    const buffs = t.buffs.filter(v => v.key.includes(':damage')); assert.equal(buffs.length, 1);
    f.deck.finish(s, 'duplicate'); assert.equal(t.buffs.filter(v => v.key.includes(':damage')).length, 1);
  }
});
test('detonation uses x-1 body range, not the small arrival circle or host attack range', () => {
  const f = make(); activate(f); const inside = enemy(f, { row: 8, col: 10 }), outside = enemy(f, { row: 10, col: 10 });
  const large = enemy(f, { row: 8, col: 11 }); large.hitArea = { w: 2.1, h: 1, dx: 0, dy: 0 };
  place(f); end(f); until(f, () => dots(f).length === 4);
  assert.ok(dots(f).some(h => h.target === inside)); assert.ok(dots(f).some(h => h.target === large));
  assert.equal(dots(f).some(h => h.target === outside), false);
});
test('detonation caches current host ATK once, honors RES and persists outside range and after host retreat', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9, res: 40 }); place(f);
  f.b.addBuff(f.u, { key: 'test:atk', mods: { atkPct: .5 } }); const cached = f.u.s.atk; end(f);
  f.b.removeBuff(f.u, 'test:atk'); f.b.retreat(f.u, { permanent: true }); t.x = 15;
  until(f, () => dots(f).length === 2);
  near(dots(f)[0].amount, cached * f.record.bb.ep_damage_ratio_token);
  near(dots(f)[1].hpLoss, cached * f.record.bb.atk_scale * .6);
  advance(f.b, 6); assert.equal(dots(f).filter(h => h.type === 'arts').length, 12); assert.equal(f.deck.dots.size, 0);
  assert.equal(f.b.regularSummons.has(f.deck.state.key), false);
});
test('Slow and damage lifetime resist independently from attraction and immunity does not erase damage', () => {
  const f = make(); activate(f); const resistant = enemy(f, { row: 8, col: 9 }), immune = enemy(f, { row: 8, col: 9 });
  f.b.applyStatus(resistant, 'resist', { duration: 20 }); immune.def = { ...immune.def, immune: new Set(['sluggish']) };
  place(f); end(f);
  near(resistant.findBuff('sluggish').timeLeft, 3, f.b.dt * 2); assert.equal(immune.findBuff('sluggish'), null);
  advance(f.b, 6.2);
  assert.equal(dots(f).filter(h => h.target === resistant && h.type === 'arts').length, 6);
  assert.equal(dots(f).filter(h => h.target === immune && h.type === 'arts').length, 12);
});
test('owner finish detonates one lure, keeps independent damage, and battle end admits nothing', () => {
  for (const reason of ['retreat', 'battle']) {
    const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }), token = place(f);
    if (reason === 'retreat') {
      f.b.retreat(f.u, { permanent: true }); assert.equal(token.alive, false);
      until(f, () => dots(f).length === 2); assert.ok(t.findBuff('sluggish'));
    } else {
      f.b.forceEnd('fixture'); assert.equal(token.alive, false); assert.equal(dots(f).length, 0); assert.equal(f.deck.dots.size, 0);
    }
    assert.equal(f.b.regularSummons.has(f.deck.state.key), false);
  }
});
test('damage callback that removes target suppresses its following Arts receipt', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }); place(f); end(f);
  f.b.on('damaged', ctx => { if (ctx.type === 'element' && ctx.dmg.tags.includes('tragodia:s2-lure-dot')) f.b.kill(t); });
  until(f, () => !t.alive); assert.equal(dots(f).length, 1); assert.equal(dots(f)[0].type, 'element');
  assert.equal(f.deck.dots.size, 0);
});
for (const elite of [1, 2]) for (const level of [1, e.tables.character.phases[elite].maxLevel])
  test(`E${elite} level ${level} keeps token stats separate from host level, trust and potential`, () => {
    const f = make({ elite, level, rank: elite === 1 ? 7 : 10, trust: 200, potential: 6 }); activate(f);
    const token = place(f); assert.equal(token.s.maxHp, 100); assert.equal(token.s.atk, 100); assert.equal(token.s.def, 0);
    assert.equal(token.base.respawnTime, 25); assert.equal(token.s.blockCnt, 0);
    assert.notEqual(token.s.atk, f.u.s.atk); assert.notEqual(token.s.maxHp, f.u.s.maxHp);
    assert.deepEqual(f.deck.record.rangeGrid, e.tables.ranges['x-1'].grids.map(g => [g.row, g.col]));
  });
test('multiple lures retain one non-refreshing attraction slot and independent damage layers', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }), other = sibling(f);
  place(f); const first = f.deck.point, buff = [...first.targets.values()][0].buff;
  advance(f.b, .2); const remaining = buff.timeLeft;
  other.deck.place(8, 10); assert.equal(other.deck.point.targets.size, 0);
  assert.equal(t.buffs.filter(v => v.status === 'attract').length, 1); near(buff.timeLeft, remaining);
  const atk = f.u.s.atk, otherAtk = other.u.s.atk;
  const received = []; f.b.on('damaged', ctx => {
    if (ctx.type === 'arts' && ctx.dmg.tags.includes('tragodia:s2-lure-dot')) received.push(ctx);
  });
  f.deck.retreat(first.unit); other.deck.retreat(other.deck.point.unit);
  assert.equal(t.buffs.filter(v => v.key.includes(':damage')).length, 2);
  until(f, () => received.length === 2); near(received[0].hpLoss + received[1].hpLoss, (atk + otherAtk) * f.record.bb.atk_scale);
  f.b.retreat(f.u, { permanent: true }); assert.equal(f.b.regularSummons.get(other.deck.state.key), other.deck.state);
});
test('reentrant attraction admission cannot steal the first native slot', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }), other = sibling(f);
  f.b.on('beforeStatus', ctx => {
    if (ctx.status === 'attract' && ctx.source.ownerUnit === f.u && !other.deck.point) other.deck.place(8, 10);
  });
  place(f); assert.equal(f.deck.point.targets.size, 1); assert.equal(other.deck.point.targets.size, 0);
  assert.equal(t.buffs.filter(v => v.status === 'attract').length, 1);
});
test('arrival accepts another lure’s named marker without requiring the same source', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }), other = sibling(f); place(f);
  t.x = 9.7; other.deck.place(8, 10);
  assert.equal(other.deck.point.targets.size, 0); assert.equal(other.deck.point.reason, 'arrival');
});
test('immune element and dodged HP damage do not change the independent non-missable Arts clock', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 });
  f.b.addBuff(t, { key: 'test:dodge', mods: { dodgeArts: 1 } });
  f.b.on('elementHit', ctx => { if (ctx.dmg.tags.includes('tragodia:s2-lure-dot')) ctx.dmg.cancel = true; });
  place(f); end(f); until(f, () => dots(f).length === 1);
  assert.equal(dots(f)[0].type, 'arts'); near(dots(f)[0].hpLoss, f.u.s.atk * f.record.bb.atk_scale);
});
test('later enemies entering the explosion range receive neither Slow nor its periodic damage', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 13 }); place(f); end(f);
  t.x = 9; advance(f.b, 1); assert.equal(dots(f).length, 0); assert.equal(t.findBuff('sluggish'), null);
});
test('enemy lifetimes changed during status acceptance leave no orphan marker', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 });
  f.b.on('statusApplied', ctx => { if (ctx.status === 'attract') t.deploySeq++; });
  place(f); assert.equal(f.deck.point.targets.size, 0); assert.equal(t.buffs.some(v => v.status === 'attract'), false);
});
test('retired decks dispose their hooks once all non-derived damage expires', () => {
  const f = make(); activate(f); enemy(f, { row: 8, col: 9 }); place(f); f.b.retreat(f.u, { permanent: true });
  assert.ok(f.deck.handles.length); advance(f.b, 6.2); assert.equal(f.deck.dots.size, 0); assert.equal(f.deck.handles.length, 0);
});
test('battle end clears already admitted damage and releases all lure hooks', () => {
  const f = make(); activate(f); const t = enemy(f, { row: 8, col: 9 }); place(f); end(f);
  assert.ok(f.deck.dots.size); f.b.forceEnd('fixture');
  assert.equal(f.deck.dots.size, 0); assert.equal(t.buffs.some(v => v.key.includes(':damage')), false);
  assert.equal(f.deck.handles.length, 0); assert.deepEqual(f.b.errors, []);
});
