// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-yu-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { OB_BLOCK, OB_CRATE } from '../server/sim/grid.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { YU_ID as ID, selectedYuBuild } from '../server/sim/content/arkpedia-yu.js';
import { YU_SKILL_CONTRACT as CONTRACT, prepareYuSkills, yuGroundReachable, yuWallCrosses } from '../server/sim/content/arkpedia-yu-skills.js';

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
function make({ skill = 1, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_yu_${skill}` };
  const r = selectedYuBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareYuSkills(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function ally(f, { id = 'char_196_sunbr', row = 5, col = 7, kind = 'op', flags = {}, defer = false } = {}) {
  const def = normalizeChess(recordFor(defaultBuild(f.d.operators[id]), f.d));
  const a = f.b._makeAlly(f.b.getPlayer('arkpedia'), def, kind, row, col, { dir: 'RIGHT' });
  f.b._setupUnit(a, { trait: { noAttack: true }, talents: [], skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } });
  if (!defer) assert.ok(f.b._deploy(a, { initial: false }));
  f.b.addBuff(a, { key: 'fixture:flags', flags });
  return a;
}
function enemy(f, { row = 5, col = 5, hp = 1e7, def = 0, res = 0, fly = false, flags = {}, block = true } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags, ...(!block ? { unblockable: true } : {}) } });
  f.b._buildEnemyIndex(); if (block) f.b._checkBlock(t); return t;
}
const hpKey = f => `yu:market:hp:${f.u.id}`, epKey = f => `yu:market:ep:${f.u.id}`;
const blockKey = f => `yu:block:damage:${f.u.id}`, sanctuaryKey = f => `yu:block:sanctuary:${f.u.id}`;
const ordinary = f => f.hits.filter(h => h.dmg.tags.includes('yu:ordinary'));
const periodic = f => f.hits.filter(h => h.dmg.tags.some(t => t.startsWith('yu:blocked:')));
function four(f) { return [ally(f, { col: 7 }), ally(f, { col: 8 }), ally(f, { col: 9 })]; }

const skillHits = (f, tag) => f.hits.filter(h => h.dmg.tags.includes(tag));
function ready(f) {
  if (f.record.index === 0) {
    const t = enemy(f, { col: 12, block: false });
    for (let n = 0; n < f.u.skill.spCost; n++) f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true });
  } else until(f, () => f.u.skill.ready, 60);
  assert.ok(f.u.skill.ready); assert.ok(f.u.skill.activate());
}
function wall(f) { ready(f); until(f, () => f.skills.wallReady); }

test('all thirty ranks consume natural selected SP, apply exact modifiers and expire without stat leakage', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), hp = f.u.s.maxHp, atk = f.u.s.atk, def = f.u.s.def, block = f.u.s.blockCnt;
    const outside = { atkPct: .1, defPct: .2 }; f.b.addBuff(f.u, { key: 'outside', mods: outside });
    ready(f); const bb = f.record.bb;
    near(f.u.s.maxHp, hp * (1 + bb.max_hp));
    near(f.u.s.atk, atk * (1.1 + (bb.atk ?? 0))); near(f.u.s.def, def * (1.2 + (bb.def ?? 0)));
    near(f.u.s.blockCnt, block + (bb.block_cnt ?? 0)); near(f.u.skill.spTotal, 0);
    assert.equal(f.u.skill.gainSp(100, 'grant'), 0);
    const start = f.u.skill.lastStart;
    until(f, () => !f.u.skill.active, 46); near(f.b.time - start, f.record.source.duration, .06);
    near(f.u.s.maxHp, hp); near(f.u.s.atk, atk * 1.1); near(f.u.s.def, def * 1.2); near(f.u.s.blockCnt, block);
    assert.deepEqual(f.u.findBuff('outside').mods, outside); assert.equal(f.skills.pending.size, 0); assert.equal(f.skills.wall.size, 0);
  }
});

test('source skill contract is identity checked and abnormal/disarmed casts preserve ready SP; silence does not block Yu skills', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); f.u.skill.setSpTotal(f.u.skill.spCost);
    for (const flags of [{ stun: true }, { disarm: true }]) {
      f.b.addBuff(f.u, { key: 'control', flags }); assert.equal(f.u.skill.activate(), false); assert.ok(f.u.skill.ready);
      f.b.removeBuff(f.u, 'control');
    }
    f.b.addBuff(f.u, { key: 'silence', flags: { silence: true } }); assert.equal(f.u.skill.silenceBlocked, false);
    assert.ok(f.u.skill.activate());
  }
});

test('S1 can cast during Born, restarts to its original one-input Physical attack and retains passive taunt after expiry', () => {
  const f = make({ skill: 1, elite: 0 }); const t = enemy(f), other = enemy(f);
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.ok(f.u.skill.activate());
  advance(f.b, .5); assert.equal(skillHits(f, 'yu:s1:attack').length, 0);
  advance(f.b, f.b.dt); assert.equal(skillHits(f, 'yu:s1:attack').length, 1);
  const hit = skillHits(f, 'yu:s1:attack')[0]; assert.equal(hit.target, t); assert.equal(hit.type, 'phys'); near(hit.amount, f.u.s.atk);
  assert.equal(other.hp, other.s.maxHp); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
  f.u.skill.end(); near(f.u.s.taunt, f.record.bb.taunt_level); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
  until(f, () => ordinary(f).length > 0); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
});

test('S1 inverse Burn uses current Yu ATK, not enemy ATK or incoming damage, and retains native broad enemy HP-damage filter', () => {
  const f = make({ skill: 1, elite: 0 }); ready(f); const t = enemy(f, { col: 12, block: false });
  f.b.addBuff(f.u, { key: 'atk', mods: { atkPct: .4 } });
  for (const [type, attack] of [['phys', true], ['arts', true], ['true', false], ['arts', false]]) {
    const before = skillHits(f, 'yu:s1:inverse').length;
    f.b.dealDamage(t, f.u, { amount: 7, type, isAttack: attack });
    assert.equal(skillHits(f, 'yu:s1:inverse').length, before + 1);
    near(skillHits(f, 'yu:s1:inverse').at(-1).amount, f.u.s.atk * f.record.bb.ep_damage_ratio);
  }
  const n = skillHits(f, 'yu:s1:inverse').length;
  f.b.dealDamage(t, f.u, { amount: 1, type: 'element', element: 'nervous' });
  f.b.loseHp(f.u, 1, t); f.b.dealDamage(f.u, f.u, { amount: 1, type: 'true' });
  assert.equal(skillHits(f, 'yu:s1:inverse').length, n);
  f.u.skill.end(); f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true });
  assert.equal(skillHits(f, 'yu:s1:inverse').length, n);
});

test('S1 inverse output survives fully absorbed HP damage but misses and stale/dead sources create no injury', () => {
  const f = make({ skill: 1, elite: 0 }); ready(f); const t = enemy(f, { col: 12, block: false });
  f.b.addBuff(f.u, { key: 'dodge', mods: { dodgePhys: 1 } });
  f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true }); assert.equal(skillHits(f, 'yu:s1:inverse').length, 0);
  f.b.removeBuff(f.u, 'dodge'); f.b.addBuff(f.u, { key: 'shield', shield: 1000 });
  f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true }); assert.equal(skillHits(f, 'yu:s1:inverse').length, 1);
  f.b.kill(t, f.u); f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true });
  assert.equal(skillHits(f, 'yu:s1:inverse').length, 1);
});

test('S2 native ground burst is unlimited, uses current selected ATK and waits separately before teleport', () => {
  const f = make({ skill: 2 }); ready(f);
  const a = enemy(f, { row: 5, col: 6, block: false }), z = enemy(f, { row: 6, col: 5, block: false });
  const fly = enemy(f, { row: 4, col: 5, fly: true, block: false }), outside = enemy(f, { row: 5, col: 8, block: false });
  const before = { x: a.x, y: a.y }; const teleports = []; f.b.on('yuTeleport', ctx => teleports.push(ctx));
  f.b.addBuff(f.u, { key: 'lateatk', mods: { atkPct: .1 } });
  until(f, () => skillHits(f, 'yu:s2:burst').length > 0, 1);
  assert.equal(skillHits(f, 'yu:s2:burst').length, 2); near(skillHits(f, 'yu:s2:burst')[0].amount, f.u.s.atk * f.record.bb.atk_scale);
  assert.equal(fly.hp, fly.s.maxHp); assert.equal(outside.hp, outside.s.maxHp);
  assert.deepEqual({ x: a.x, y: a.y }, before); assert.equal(teleports.length, 0);
  advance(f.b, .1); assert.equal(teleports.length, 0); advance(f.b, f.b.dt);
  assert.equal(teleports.length, 2);
  for (const t of [a, z]) for (const offset of [t.x - f.u.tileC, t.y - f.u.tileR])
    assert.ok(Math.abs(offset) >= .3 && Math.abs(offset) <= .450001);
  near(teleports[0].nativeOffset, .15000000596046448); near(teleports[0].nativeInnerRange, .30000001192092896);
  assert.equal(f.skills.pending.size, 0);
});

test('S2 delayed teleport rechecks original immunity, visibility, living life and self-bound flags while root reachability avoids crates', () => {
  for (const flag of ['immune_shu_blink', 'immune_yu_blink', 'selfBound', 'hidden', 'dead', 'newLife', 'teleportImmune']) {
    const f = make({ skill: 2 }); ready(f); const t = enemy(f, { col: 6, block: false });
    until(f, () => f.skills.pending.size > 0, 1); const from = { x: t.x, y: t.y };
    if (flag.startsWith('immune_')) f.b.addBuff(t, { key: flag });
    else if (flag === 'selfBound') f.b.addBuff(t, { key: flag, flags: { selfBound: true } });
    else if (flag === 'hidden') t.hidden = true;
    else if (flag === 'dead') f.b.kill(t, f.u);
    else if (flag === 'newLife') t.deploySeq++;
    else t.def.immune.add('be_teleported');
    advance(f.b, .2); assert.deepEqual({ x: t.x, y: t.y }, from); assert.equal(f.skills.pending.size, 0);
  }
  const f = make({ skill: 2 }); const t = enemy(f, { col: 7, block: false }); assert.ok(yuGroundReachable(f.b, t, 5, 5));
  for (let r = f.b.grid.rect.r0; r <= f.b.grid.rect.r1; r++) f.b.grid.obstacle[r * 21 + 6] = 1;
  assert.equal(yuGroundReachable(f.b, t, 5, 5), false);
});

test('S2 teleport releases both blocker ends, preserves passed route/wait and selects static-body enemies independently of physical displacement', () => {
  const f = make({ skill: 2 }); ready(f); const a = ally(f, { col: 6 }), t = enemy(f, { col: 6 });
  f.b._unblock(t); t.blockedBy = a; a.blocking.push(t);
  t.def = { ...t.def, staticBody: true }; t.route = { legIdx: 2, waitLeft: 3, pts: [[5, 6], [5, 8]] };
  let releasedAt; f.b.on('unblocked', ({ enemy }) => { if (enemy === t) releasedAt = [t.x, t.y]; });
  assert.ok(f.skills.teleport(t)); assert.equal(t.blockedBy, null); assert.ok(!a.blocking.includes(t));
  assert.deepEqual(releasedAt, [6, 5]);
  assert.equal(t.route.legIdx, 2); assert.equal(t.route.waitLeft, 3); assert.equal(t.route.pts, null);
});

test('S2 landing occupies each corner region and never the centre or intervening strips', () => {
  const f = make({ skill: 2 }); ready(f); const t = enemy(f, { col: 6, block: false });
  for (let corner = 0; corner < 4; corner++) for (const edge of [0, .5, 1 - Number.EPSILON]) {
    const draws = [(corner + .5) / 4, edge, 1 - Number.EPSILON - edge];
    let n = 0; f.b.rng = () => draws[n++];
    assert.ok(f.skills.teleport(t)); assert.equal(n, 3);
    assert.equal(Math.sign(t.x - 5), corner & 1 ? 1 : -1);
    assert.equal(Math.sign(t.y - 5), corner & 2 ? 1 : -1);
    for (const offset of [t.x - 5, t.y - 5]) assert.ok(Math.abs(offset) >= .3 && Math.abs(offset) <= .450001);
  }
});

test('S2 reachability excludes only start cost, allows a walkable start crate, and rejects intermediate crates or hard roots', () => {
  const f = make({ skill: 2 }), t = enemy(f, { col: 7, block: false });
  const set = (r, c, bit) => { f.b.grid.obstacle[r * 21 + c] = bit; };
  set(5, 7, OB_CRATE); assert.ok(yuGroundReachable(f.b, t, 5, 5));
  assert.ok(yuGroundReachable(f.b, t, 5, 7));
  set(5, 7, OB_BLOCK); assert.equal(yuGroundReachable(f.b, t, 5, 5), false);
  set(5, 7, OB_CRATE); set(5, 5, OB_BLOCK); assert.equal(yuGroundReachable(f.b, t, 5, 5), false);
  set(5, 5, 0);
  for (let r = f.b.grid.rect.r0; r <= f.b.grid.rect.r1; r++) set(r, 6, OB_CRATE);
  assert.equal(yuGroundReachable(f.b, t, 5, 5), false);
  set(5, 6, 0); assert.ok(yuGroundReachable(f.b, t, 5, 5));
});

test('S2 ordinary mode deals one Arts hit, respects original clock and drops excess blocks when it ends', () => {
  const f = make({ skill: 2 }); ready(f); advance(f.b, 2);
  const enemies = Array.from({ length: 5 }, () => enemy(f)); assert.equal(f.u.blocking.length, 5);
  until(f, () => skillHits(f, 'yu:s2:attack').length > 0); const hit = skillHits(f, 'yu:s2:attack')[0];
  assert.equal(hit.type, 'arts'); near(hit.amount, f.u.s.atk); assert.ok(enemies.includes(hit.target));
  f.u.skill.end(); assert.equal(f.u.blocking.length, 3); assert.equal(enemies.filter(t => t.blockedBy === f.u).length, 3);
  until(f, () => ordinary(f).length > 0); assert.equal(ordinary(f).at(-1).type, 'phys');
});

test('S2 range selection happens at native release and interrupted burst never damages or teleports', () => {
  const f = make({ skill: 2 }); ready(f); const leaving = enemy(f, { col: 6, block: false }), arriving = enemy(f, { col: 8, block: false });
  leaving.x = 8; arriving.x = 6; until(f, () => skillHits(f, 'yu:s2:burst').length > 0, 1);
  assert.equal(skillHits(f, 'yu:s2:burst').length, 1); assert.equal(skillHits(f, 'yu:s2:burst')[0].target, arriving);
  const g = make({ skill: 2 }); ready(g); enemy(g, { col: 6, block: false });
  g.b.addBuff(g.u, { key: 'brief', duration: .1, flags: { stun: true } }); advance(g.b, 2);
  assert.equal(skillHits(g, 'yu:s2:burst').length, 0); assert.equal(g.skills.pending.size, 0);
});

test('S3 global second talent waits for native mode release, includes isolated deployed operators and excludes summons/devices/bench', () => {
  const f = make({ skill: 3 }); const ops = four(f); const token = ally(f, { col: 10, kind: 'token' });
  const device = ally(f, { col: 11, kind: 'device' }), bench = ally(f, { col: 12, defer: true });
  f.b.addBuff(ops[0], { key: 'isolated', flags: { isolated: true, healFree: true, noHeal: true } });
  ready(f); assert.equal(ops[0].s.epRegen, 0); until(f, () => f.skills.wallReady);
  for (const a of [f.u, ...ops]) { near(a.s.epRegen, a.s.maxHp * f.record.market.ep_heal_ratio); assert.ok(a.s.hpRegen > 0); }
  for (const a of [token, device, bench]) { near(a.s.epRegen, 0); near(a.s.hpRegen, 0); }
  f.u.skill.end(); for (const a of ops) { near(a.s.epRegen, 0); near(a.s.hpRegen, 0); }
  assert.ok(f.u.s.epRegen > 0); // own talent persists after S3
});

test('S3 all facing root boundaries are literal and accept all-field ally Arts outputs with current Yu ATK', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ skill: 3, dir }); wall(f); const column = ['LEFT', 'RIGHT'].includes(dir), positive = ['RIGHT', 'UP'].includes(dir);
    const source = ally(f, { row: column ? 9 : 5, col: column ? 5 : 9 });
    const target = enemy(f, { row: column ? 9 : positive ? 6 : 4, col: column ? positive ? 6 : 4 : 9, block: false });
    assert.ok(yuWallCrosses(f.u, source, target));
    f.b.addBuff(f.u, { key: 'atk', mods: { atkPct: .1 } });
    f.b.dealDamage(source, target, { amount: 1, type: 'arts', isAttack: false });
    near(skillHits(f, 'yu:s3:wall')[0].amount, f.u.s.atk * f.record.bb.ep_damage_ratio);
    assert.equal(target.findBuff(f.skills.auraKey).source, f.u);
    const n = skillHits(f, 'yu:s3:wall').length;
    f.b.dealDamage(source, target, { amount: 1, type: 'phys' }); f.b.dealDamage(f.u, target, { amount: 1, type: 'arts' });
    f.b.dealDamage(target, target, { amount: 1, type: 'arts' }); assert.equal(skillHits(f, 'yu:s3:wall').length, n);
    source.x = target.x; source.y = target.y; f.b.dealDamage(source, target, { amount: 1, type: 'arts' });
    assert.equal(skillHits(f, 'yu:s3:wall').length, n);
  }
});

test('S3 asymmetric owner-root inclusion differs for positive/negative facing and reverse direction is supported', () => {
  const f = make({ skill: 3 });
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    f.u.dir = dir; const column = ['LEFT', 'RIGHT'].includes(dir), p = { x: 5, y: 5 }, low = { ...p }, high = { ...p };
    if (column) { low.x--; high.x++; } else { low.y--; high.y++; }
    const positive = ['RIGHT', 'UP'].includes(dir);
    assert.equal(yuWallCrosses(f.u, p, high), positive); assert.equal(yuWallCrosses(f.u, p, low), !positive);
    assert.equal(yuWallCrosses(f.u, high, p), positive); assert.equal(yuWallCrosses(f.u, low, p), !positive);
  }
});

function projectile(f, { source, from, to, speed = 1000, flightTime, onMove, onHit } = {}) {
  return f.b.addProjectile({ source, from: from ?? { x: 4, y: 5 }, to: to ?? { x: 7, y: 5 }, speed,
    flightTime, onMove, onHit, maxAge: 2 });
}

test('S3 intercepts fast and fixed-time enemy projectiles before impact in every facing, while friendly/sourceless projectiles survive', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) for (const fixed of [false, true]) {
    const f = make({ skill: 3, dir }); wall(f); f.b.rng = () => 0;
    const column = ['RIGHT', 'LEFT'].includes(dir), from = column ? { x: 3, y: 10 } : { x: 10, y: 3 }, to = column ? { x: 7, y: 10 } : { x: 10, y: 7 };
    const source = enemy(f, { col: 12, block: false }); let hits = 0, moves = 0;
    const p = projectile(f, { source, from, to, flightTime: fixed ? .05 : undefined, onHit: () => hits++, onMove: () => moves++ });
    f.b.projectiles.update(.05); assert.equal(p.removed, true); assert.equal(hits, 0); assert.equal(moves, 0);
    projectile(f, { source: f.u, from, to, onHit: () => hits++ }); projectile(f, { source: null, from, to, onHit: () => hits++ });
    f.b.projectiles.update(.05); assert.equal(hits, 2);
  }
});

test('S3 probability draws only on wall entry; lingering projectiles do not reroll, and leaving/reentering rolls again', () => {
  const f = make({ skill: 3 }); wall(f); const source = enemy(f, { col: 12, block: false });
  let rolls = 0; f.b.rng = () => { rolls++; return .9; };
  const p = projectile(f, { source, from: { x: 5.5, y: 2 }, to: { x: 5.5, y: 10 }, speed: 1 });
  for (let n = 0; n < 10; n++) f.b.projectiles.update(.05);
  assert.equal(rolls, 1); assert.ok(!p.removed);
  p.x = 7; p.tx = 7; f.b.projectiles.update(.05); assert.equal(rolls, 1);
  p.tx = 4; p.speed = 100; f.b.projectiles.update(.05); assert.equal(rolls, 2);
});

test('S3 interception reports the first wall contact instead of the tick endpoint, in both crossing directions', () => {
  const f = make({ skill: 3 }); wall(f); const source = enemy(f, { col: 12, block: false });
  f.b.rng = () => 0; const points = []; f.b.on('yuIntercept', e => points.push(e.point));
  projectile(f, { source, from: { x: 4, y: 5 }, to: { x: 7, y: 5 } });
  projectile(f, { source, from: { x: 7, y: 6 }, to: { x: 4, y: 6 } });
  f.b.projectiles.update(.05); assert.equal(points.length, 2);
  near(points[0].x, 5.35); near(points[1].x, 5.65); near(points[0].y, 5); near(points[1].y, 6);
});

test('S3 interception uses forward offset slab independently of the owner-root Arts boundary and can remove projectiles already inside on start', () => {
  const f = make({ skill: 3 }); ready(f); const source = enemy(f, { col: 12, block: false }); f.b.rng = () => 0;
  const p = projectile(f, { source, from: { x: 5.5, y: 2 }, to: { x: 5.5, y: 10 }, speed: .001 }); until(f, () => f.skills.wallReady);
  assert.equal(p.removed, true);
  let hits = 0;
  projectile(f, { source, from: { x: 5, y: 2 }, to: { x: 5, y: 10 }, speed: 1000, onHit: () => hits++ });
  f.b.projectiles.update(.05); assert.equal(hits, 1); // owner-centred line lies outside projectile slab
});

test('S3 original loop is one Physical CAST input and end uses original mix-out clip before ordinary mode resumes', () => {
  const f = make({ skill: 3 }); wall(f); advance(f.b, 2);
  const t = enemy(f), other = enemy(f); until(f, () => f.controller.phase?.kind === 'yu:attack');
  f.b.kill(t, f.u); until(f, () => skillHits(f, 'yu:s3:attack').length > 0);
  assert.equal(skillHits(f, 'yu:s3:attack')[0].target, other); assert.equal(skillHits(f, 'yu:s3:attack')[0].type, 'phys');
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Loop'); f.u.skill.end();
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_End'); until(f, () => ordinary(f).length > 0);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
});

test('skill end, owner removal and battle end clear pending teleport, wall listeners/interceptors and extended recovery', () => {
  for (const reason of ['end', 'retreat', 'battle']) for (const skill of [2, 3]) {
    const f = make({ skill }); const ops = four(f); ready(f);
    if (skill === 2) { enemy(f, { col: 6, block: false }); until(f, () => f.skills.pending.size > 0, 1); }
    else until(f, () => f.skills.wallReady);
    if (reason === 'end') f.u.skill.end(); else if (reason === 'retreat') f.b.retreat(f.u); else f.b.forceEnd('test');
    assert.equal(f.skills.pending.size, 0); assert.equal(f.skills.wall.size, 0); assert.equal(f.skills.entries.size, 0);
    assert.equal(f.b.projectiles.interceptors.size, 0);
    for (const a of ops) { near(a.s.hpRegen, 0); near(a.s.epRegen, 0); }
    if (reason !== 'end') assert.equal(f.skills.handles.length, 0);
    advance(f.b, .3); assert.equal(f.skills.pending.size, 0);
  }
});

test('S2 missed damage still schedules a nonmissable teleport and control after release does not cancel the attached buff', () => {
  const f = make({ skill: 2 }); ready(f); const t = enemy(f, { col: 6, block: false, flags: {} });
  f.b.addBuff(t, { key: 'dodge', mods: { dodgeArts: 1 } });
  until(f, () => f.skills.pending.size > 0, 1); assert.equal(skillHits(f, 'yu:s2:burst').length, 0);
  f.b.addBuff(f.u, { key: 'control', flags: { stun: true } }); advance(f.b, .2);
  assert.ok(Math.abs(t.x - 5) >= .3 && Math.abs(t.x - 5) <= .450001); assert.equal(f.skills.pending.size, 0);
});

test('S3 enemy aura tracks disappearance/new lives and rejected recipient attachment produces no wall injury', () => {
  const f = make({ skill: 3 }); wall(f); const a = ally(f, { row: 9, col: 5 }), t = enemy(f, { row: 9, col: 6, block: false });
  f.skills.syncWall(); const old = t.findBuff(f.skills.auraKey); assert.ok(old);
  t.hidden = true; f.b.emit('enemyHidden', { enemy: t, hidden: true }); assert.equal(t.findBuff(f.skills.auraKey), null);
  t.hidden = false; f.skills.syncWall(); assert.notEqual(t.findBuff(f.skills.auraKey), old);
  t.deploySeq++; f.skills.syncWall(); assert.equal(f.skills.wall.get(t).seq, t.deploySeq);
  f.b.removeBuff(t, f.skills.auraKey);
  const hook = f.b.on('beforeBuff', ctx => { if (ctx.unit === t && ctx.buff.key === f.skills.auraKey) ctx.cancel = true; });
  f.b.dealDamage(a, t, { amount: 1, type: 'arts' }); assert.equal(skillHits(f, 'yu:s3:wall').length, 0);
  assert.equal(f.skills.wall.has(t), false); f.b.off(hook); f.b.dealDamage(a, t, { amount: 1, type: 'arts' });
  assert.equal(skillHits(f, 'yu:s3:wall').length, 1);
});

test('S3 wall persists through stun but disappears while Yu is hidden and recovers without duplicated hooks on reappearance', () => {
  const f = make({ skill: 3 }); wall(f); const a = ally(f, { row: 9, col: 5 }), t = enemy(f, { row: 9, col: 6, block: false });
  f.b.addBuff(f.u, { key: 'stun', flags: { stun: true } });
  f.b.dealDamage(a, t, { amount: 1, type: 'arts' }); assert.equal(skillHits(f, 'yu:s3:wall').length, 1);
  f.u.hidden = true; advance(f.b, .1); f.b.dealDamage(a, t, { amount: 1, type: 'arts' });
  assert.equal(skillHits(f, 'yu:s3:wall').length, 1); assert.equal(t.findBuff(f.skills.auraKey), null);
  f.u.hidden = false; advance(f.b, .1); f.b.dealDamage(a, t, { amount: 1, type: 'arts' });
  assert.equal(skillHits(f, 'yu:s3:wall').length, 2); assert.equal(f.b.projectiles.interceptors.size, 1);
  f.b.rng = () => 0; let hits = 0; projectile(f, { source: t, onHit: () => hits++ });
  f.b.projectiles.update(.05); assert.equal(hits, 0);
});

test('projectile interception cancellation and owner life changes do not affect other projectiles or leave registry entries', () => {
  const f = make(); let calls = 0, hits = 0;
  const h = f.b.projectiles.registerInterceptor({ owner: f.u, intercept: () => { calls++; return true; } });
  h.cancel(); projectile(f, { onHit: () => hits++ }); f.b.projectiles.update(.05); assert.equal(calls, 0); assert.equal(hits, 1);
  f.b.projectiles.registerInterceptor({ owner: f.u, intercept: () => { calls++; return true; } });
  f.u.deploySeq++; projectile(f, { onHit: () => hits++ }); f.b.projectiles.update(.05);
  assert.equal(calls, 0); assert.equal(hits, 2); assert.equal(f.b.projectiles.interceptors.size, 0);
  assert.throws(() => f.b.projectiles.registerInterceptor({ owner: null, intercept() {} }), /Invalid/);
  assert.throws(() => f.b.projectiles.registerInterceptor({ owner: f.u, intercept: null }), /Invalid/);
});
