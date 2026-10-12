// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonUnitId } from '../shared/arkpedia/summons.js';
import { regularSummonCards, selectedRegularSummon, retreatRegularSummon,
  deployRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { MITM_ID as ID, selectedMitmBuild } from '../server/sim/content/arkpedia-mitm.js';
import { MITM_DEVICE_CONTRACT as CONTRACT, prepareMitmDevices } from '../server/sim/content/arkpedia-mitm-devices.js';

const TOKEN = 'token_10037_mitm_trshrb', CARD = `summon:${ID}`;
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(f, seconds) {
  for (let n = 0; n < Math.ceil(seconds / f.b.dt - 1e-9); n++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
function until(f, condition, seconds = 25) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 1, elite = 2, rank = 10, dir = 'RIGHT', defer = false, contract = CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential: 1, trust: 0,
    skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_mitm_${skill}` };
  const r = selectedMitmBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareMitmDevices(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, hits, deploy, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
function point(f, row = 5, col = 6) {
  const t = f.deck.place(row, col); until(f, () => t.mem.mitmMode === 1); return t;
}
function defeat(f, t, source = enemy(f, { row: 10, col: 10 })) {
  return f.b.dealDamage(source, t, { amount: t.hp + 1e5, type: 'true' });
}
function wastes(f) { return [...f.deck.tokens.values()].filter(s => s.mode === 2).map(s => s.unit); }

test('device contract and all twenty selected ranks keep active skills held', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed device contract/);
  for (let skill = 1; skill <= 2; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.deck.stock, 1); assert.equal(f.u.skill.activate('manual', { free: true }), false);
    assert.equal(f.deck.record.skill.skillType, 'PASSIVE');
    assert.equal(f.deck.record.skill.prefabId, null);
  }
});

test('one independent tactical point costs no DP or slots and needs no facing choice', () => {
  const f = make(), slots = f.b.deployedSlots(); f.u.player.dp = 0;
  const t = deployRegularSummon(f.b, CARD, 5, 6, 'UP');
  assert.equal(t.ownerUnit, f.u); assert.equal(t.defId, TOKEN); assert.equal(t.dir, 'RIGHT');
  assert.equal(f.deck.stock, 0); assert.equal(f.deck.own().length, 1);
  assert.equal(f.b.deployedSlots(), slots); near(f.b.dp, 0);
  assert.equal(t.deploymentSlotCost, 0); assert.equal(t.s.blockCnt, 0);
  assert.equal(t.mem.regularFormVisual.clip, 'Start');
  near(t.s.maxHp, f.record.token.stats.maxHp); near(t.s.atk, f.record.token.stats.atk);
  near(t.s.def, f.record.token.stats.def);
  assert.throws(() => f.deck.place(5, 7), /already placed/);
  until(f, () => t.mem.mitmMode === 1);
  assert.equal(t.s.blockCnt, 1); assert.equal(t.mem.regularFormVisual.clip, 'Idle_1');
  assert.equal(t.mem.regularFormVisual.loop, true);
});

test('placement rejects invalid terrain, host range, occupancy, reservation and viewport atomically', () => {
  const f = make(), dp = f.b.dp;
  for (const coords of [[5, 5], [-1, 0], [5.5, 6], [21, 0], [12, 12]])
    assert.throws(() => f.deck.place(...coords));
  f.b.grid.tile(5, 6).build = 'RANGED'; assert.throws(() => f.deck.place(5, 6), /melee/);
  f.b.grid.tile(5, 6).build = 'ALL';
  f.b.reserveTile(f.u, 5, 6, 'fixture:reservation'); assert.throws(() => f.deck.place(5, 6), /reserved/);
  f.b.releaseTileReservations(f.u);
  f.b.setViewport('embedded'); assert.throws(() => f.deck.place(5, 6), /fullscreen/);
  f.b.setViewport('fullscreen-workspace');
  assert.throws(() => deployRegularSummon(f.b, CARD, 5, 6, 'bad'), /facing/);
  assert.equal(f.deck.stock, 1); assert.equal(f.deck.tokens.size, 0); near(f.b.dp, dp);
  const z = make({ defer: true }); assert.throws(() => z.deck.place(5, 6), /Deploy Mitm first/);
});

test('host placement range rotates with all four facings', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['UP', 6, 5], ['LEFT', 5, 4], ['DOWN', 4, 5]]) {
    const f = make({ dir }); assert.ok(f.deck.place(row, col));
  }
});

test('accepted fatal HP loss preserves the tactical tile, releases blocking and spawns eligible wreckages', () => {
  const f = make(), t = point(f), a = enemy(f);
  advance(f, .1); assert.equal(a.blockedBy, t);
  const slots = f.b.deployedSlots(), hp = t.hp;
  near(defeat(f, t), hp); assert.equal(t.alive, true); assert.equal(t.deployed, true);
  assert.equal(t.hp, 1); assert.equal(t.mem.mitmMode, 0); assert.equal(t.s.blockCnt, 0);
  assert.equal(a.blockedBy, null); assert.equal(f.b.unitAt(5, 6), t);
  assert.equal(t.s.flags.invulnerable, true); assert.equal(t.s.flags.untargetable, true);
  assert.equal(t.mem.regularFormVisual.clip, 'Die');
  assert.deepEqual(wastes(f).map(w => [w.tileR, w.tileC]).sort(), [[4, 6], [5, 7], [6, 6]].sort());
  // The source cross includes the centre and host's occupied tile; both skip.
  assert.equal(f.b.deployedSlots(), slots); assert.equal(f.deck.own().length, 1);
  const card = regularSummonCards(f.b).find(c => c.key === CARD);
  assert.equal(card.deployed, 1); assert.equal(card.stock, 0); assert.equal(card.available, false);
  assert.equal(defeat(f, t), 0); assert.equal(wastes(f).length, 3);
});

test('unforced wreckage selector respects low ground and other occupants but is independent of host range', () => {
  const f = make(), t = point(f, 5, 8);
  f.b.grid.tile(4, 8).height = 'HIGH';
  f.b.grid.tile(6, 8).build = 'NONE';
  f.b.reserveTile(f.u, 5, 7, 'fixture:reservation');
  defeat(f, t);
  assert.deepEqual(wastes(f).map(w => [w.tileR, w.tileC]), [[5, 9]]);
  assert.equal(f.u.rangeKeySet.has(5 * 21 + 9), false);
  assert.equal(f.b.unitAt(5, 8), t);
});

test('wreckage has half HP, zero ATK and DEF, one block, static art, no healing or attacks', () => {
  const f = make(), t = point(f); defeat(f, t); const w = wastes(f)[0];
  near(w.s.maxHp, f.record.token.stats.maxHp * .5); near(w.hp, w.s.maxHp);
  near(w.s.atk, 0); near(w.s.def, 0); assert.equal(w.s.blockCnt, 1);
  assert.equal(w.mem.regularFormVisual.clip, 'Waste'); assert.equal(w.mem.regularFormVisual.loop, false);
  const a = enemy(f, { row: w.tileR, col: w.tileC }), z = enemy(f, { row: w.tileR, col: w.tileC });
  advance(f, .1); assert.equal([a, z].filter(e => e.blockedBy === w).length, 1);
  f.b.dealDamage(a, w, { amount: 10, type: 'true' });
  assert.equal(f.b.heal(f.u, w, 100), 0);
  advance(f, 5); assert.equal(w.stats.attacks, 0);
  assert.equal(f.hits.some(h => h.source === w), false);
});

test('wreckage defeat is permanent, releases its block and creates no recursive wreckage', () => {
  const f = make(), t = point(f); defeat(f, t); const w = wastes(f)[0], a = enemy(f, { row: w.tileR, col: w.tileC });
  advance(f, .1); assert.equal(a.blockedBy, w);
  const count = wastes(f).length; defeat(f, w, a);
  assert.equal(w.alive, false); assert.equal(w.deployed, false); assert.equal(a.blockedBy, null);
  assert.equal(wastes(f).length, count - 1); assert.equal(f.deck.tokens.has(w), false);
  advance(f, 23); assert.equal(w.alive, false); assert.equal(wastes(f).length, count - 1);
});

test('promotion-specific recovery waits 20, 17 or 15 seconds then separately plays Start', () => {
  for (let elite = 0; elite <= 2; elite++) {
    const f = make({ elite }), t = point(f), at = f.b.time;
    defeat(f, t); const state = f.deck.point, interval = [20, 17, 15][elite];
    near(state.readyAt, at + interval); near(t.mem.mitmReadyAt, at + interval + 1);
    advance(f, 1.1); assert.equal(t.mem.regularFormVisual.clip, 'Idle_2');
    assert.equal(t.mem.regularFormVisual.loop, false); assert.equal(t.s.blockCnt, 0);
    until(f, () => state.mode === 'warming');
    assert.equal(t.mem.regularFormVisual.clip, 'Start'); assert.equal(t.hp, 1);
    until(f, () => state.mode === 1); near(t.hp, t.s.maxHp); assert.equal(t.s.blockCnt, 1);
    assert.ok(f.b.time >= at + interval + 1 - 1e-9);
    assert.equal(f.deck.stock, 0); assert.equal(f.deck.own()[0], t);
  }
});

test('a second defeat skips old wreckage instead of replacing it or refreshing HP', () => {
  const f = make(), t = point(f); defeat(f, t); const old = wastes(f), first = old[0];
  f.b.dealDamage(enemy(f, { row: 10, col: 10 }), first, { amount: 123, type: 'true' });
  const hp = first.hp; until(f, () => t.mem.mitmMode === 1);
  defeat(f, t); assert.deepEqual(wastes(f), old); near(first.hp, hp);
  assert.equal(f.deck.tokens.size, 4);
});

test('ordinary buggy attacks one ground target at its original event, without a projectile', () => {
  const f = make(), t = point(f), a = enemy(f, { def: 40 }), z = enemy(f);
  until(f, () => f.deck.point.phase);
  const p = f.deck.point.phase; near(p.releaseAt - p.startedAt, .46666666865348816);
  until(f, () => f.hits.some(h => h.source === t));
  const hits = f.hits.filter(h => h.source === t);
  assert.equal(hits.length, 1); assert.ok([a, z].includes(hits[0].target));
  near(hits[0].hpLoss, t.s.atk - hits[0].target.s.def);
  assert.equal(hits[0].dmg.isSkill, false); assert.equal(hits[0].dmg.applyWay, 'melee');
  assert.equal(f.deck.release(f.deck.point, p.target, {}), false);
});

test('token ordinary selection excludes flying, stealth and sleeping inputs', () => {
  const f = make(), t = point(f); enemy(f, { fly: true });
  enemy(f, { flags: { stealth: true, unblockable: true } });
  const sleepy = enemy(f, { flags: { unblockable: true } }); f.b.applyStatus(sleepy, 'sleep', { duration: 99 });
  advance(f, 4); assert.equal(f.hits.some(h => h.source === t), false);
});

test('slowed token animation and reentrant controls cannot release an early or stale hit', () => {
  for (const aspd of [200, -50]) {
    const f = make(), t = point(f); enemy(f);
    f.b.addBuff(t, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.deck.point.phase); const p = f.deck.point.phase;
    const speed = aspd > 0 ? 1 : .5;
    near(t.mem.regularFormVisual.speed, speed);
    near(p.releaseAt - p.startedAt, .46666666865348816 / speed);
    p.target.deploySeq++; advance(f, .5 / speed);
    assert.equal(f.hits.some(h => h.source === t), false);
  }
  const f = make(), t = point(f); enemy(f);
  until(f, () => f.deck.point.phase);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === t) f.b.applyStatus(t, 'stun', { duration: 1 }); });
  advance(f, 1); assert.equal(f.hits.some(h => h.source === t), false);
});

test('owner trait uses actual own wreckage blocking at projectile impact', () => {
  const f = make(), t = point(f); defeat(f, t);
  const w = wastes(f).find(w => w.tileR === 5 && w.tileC === 7), a = enemy(f, { col: 7 });
  until(f, () => f.hits.some(h => h.source === f.u));
  const hit = f.hits.find(h => h.source === f.u);
  assert.equal(a.blockedBy, w); assert.equal(hit.target, a); near(hit.hpLoss, f.u.s.atk * 1.5);
});

test('card and deployed summon inspection keep wreckage independently selectable and retreatable', () => {
  const f = make(), t = point(f), dp = f.b.dp;
  assert.equal(selectedRegularSummon(f.b, CARD).deck, f.deck);
  retreatRegularSummon(f.b, summonUnitId(t)); assert.equal(t.mem.mitmMode, 0); near(f.b.dp, dp);
  const w = wastes(f)[0], key = summonUnitId(w);
  assert.equal(selectedRegularSummon(f.b, key).unit, w);
  retreatRegularSummon(f.b, key); assert.equal(w.alive, false); near(f.b.dp, dp);
  assert.equal(selectedRegularSummon(f.b, key), null);
  assert.equal(regularSummonCards(f.b).find(c => c.key === CARD).deployed, 1);
});

test('owner retirement, forced defeat and battle end remove all token generations and hooks', () => {
  for (const reason of ['retreat', 'kill', 'end']) {
    const f = make(), t = point(f); defeat(f, t); const all = f.deck.all();
    if (reason === 'retreat') f.b.retreat(f.u);
    else if (reason === 'kill') f.b.kill(f.u);
    else { f.b.finished = true; f.b.emit('battleEnd', {}); }
    assert.equal(f.controller.stopped, true); assert.equal(f.deck.stopped, true);
    assert.equal(f.deck.tokens.size, 0); assert.equal(f.deck.stock, 0);
    assert.equal(f.b.regularSummons.has(CARD), false);
    assert.ok(all.every(t => !t.alive && !t.deployed));
    assert.equal(Object.values(f.b._hooks).flat().some(h => h.owner === f.u), false);
    advance(f, 25); assert.equal(f.deck.all().length, 0);
  }
});

test('placement callback cannot recursively place a second point or retain a token after owner retirement', () => {
  const f = make(); let calls = 0;
  f.b.on('deploy', ({ unit }) => {
    if (unit.defId !== TOKEN) return;
    calls++; assert.throws(() => f.deck.place(5, 7), /already placed/);
  });
  assert.ok(f.deck.place(5, 6)); assert.equal(calls, 1); assert.equal(f.deck.all().length, 1);
  const z = make(); z.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) z.b.retreat(z.u); });
  assert.throws(() => z.deck.place(5, 6), /placement failed/);
  assert.equal(z.deck.all().length, 0); assert.equal(z.deck.stock, 0); assert.deepEqual(z.b.errors, []);
});

test('wreckage spawn callback cannot recursively defeat the point or preserve children of a retired owner', () => {
  const f = make(), t = point(f), a = enemy(f, { row: 10, col: 10 });
  f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) defeat(f, t, a); });
  defeat(f, t, a); assert.equal(wastes(f).length, 3); assert.equal(t.hp, 1);
  assert.equal(t.mem.mitmMode, 0); assert.deepEqual(f.b.errors, []);
  const z = make(), q = point(z);
  z.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) z.b.retreat(z.u); });
  defeat(z, q); assert.equal(z.deck.all().length, 0); assert.equal(z.deck.tokens.size, 0);
  assert.deepEqual(z.b.errors, []);
});
