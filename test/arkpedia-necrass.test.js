// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NECRASS_ID as ID, selectedNecrassBuild } from '../server/sim/content/arkpedia-necrass-source.js';
import { NECRASS_CORE_CONTRACT as CORE, prepareNecrassCore } from '../server/sim/content/arkpedia-necrass.js';
import { NECRASS_SERVANT_CONTRACT as SERVANTS, prepareNecrassServants }
  from '../server/sim/content/arkpedia-necrass-servants.js';
const TOKEN = 'token_10043_necras_skeltn';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, fn, seconds = 12) {
  const end = f.b.time + seconds;
  while (!fn() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(fn(), `Missing condition at ${f.b.time}`);
}
function make({ skill = 1, rank = 10, elite = 2, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', servants = false, defer = false,
  contract = servants ? SERVANTS : CORE, mutate } = {}) {
  const d = structuredClone(publicData); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillId: `skchr_necras_${skill}`, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const r = selectedNecrassBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid,
      trigger: { rule: 'NEVER' } } });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = (servants ? prepareNecrassServants : prepareNecrassCore)(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source?.def?.charId === ID || ctx.source?.defId === TOKEN) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u || ctx.attacker.defId === TOKEN) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, res = 0, fly = false, blockable = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def: 0, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: !blockable, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const ordinary = f => f.hits.filter(h => h.dmg.tags.includes('necrass:ordinary'));
const servantHits = f => f.hits.filter(h => h.dmg.tags.includes('necrass:servant-ordinary'));
const bursts = f => f.hits.filter(h => h.dmg.tags.includes('necrass:s1-passive'));
const pinOwner = f => f.b.addBuff(f.u, { key: 'fixture:owner-pin', flags: { disarm: true } });

test('source contracts reject altered records and duplicate/retired installations', () => {
  assert.throws(() => make({ contract: { ...CORE } }), /reviewed core/);
  assert.throws(() => make({ servants: true, contract: { ...SERVANTS } }), /reviewed servant/);
  assert.throws(() => make({ skill: 3, servants: true }), /S3 special servant remains held/);
  for (const mutate of [d => d.charId = 'unknown', d => d.stats.atk++, d => d.skill.spCost++,
    d => d.skill.initSp++, d => d.skill.duration++, d => d.skill.bb.atk_scale++,
    d => d.rangeGrid = [[0, 99]], d => d.tags.push('fake'), d => d.talents[0].bb.max_token_cnt++])
    assert.throws(() => make({ mutate }));
  const f = make({ defer: true });
  assert.throws(() => prepareNecrassCore(f.b, f.u, { contract: CORE }), /fresh original/);
  assert.throws(() => f.controller.install(), /twice/);
  f.controller.stop(); assert.throws(() => f.controller.install(), /retirement/);
});

for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
  test(`owner S${skill} rank ${rank} fires real ordinary projectiles without activating held skills`, () => {
    const f = make({ skill, rank }), t = enemy(f);
    until(f, () => f.b.projectiles.list.length > 0);
    const p = f.b.projectiles.list[0];
    assert.equal(p.speed, 10); assert.equal(p.maxAge, 10); assert.equal(p.target, t);
    assert.equal(p.data.projectileKey, 'projectile_chr_necras'); assert.equal(f.hits.length, 0);
    until(f, () => ordinary(f).length === 1);
    near(ordinary(f)[0].hpLoss, f.u.s.atk); assert.equal(ordinary(f)[0].target, t);
    assert.equal(f.u.skill.activate('manual'), false); assert.equal(f.u.skill.active, false);
  });
}

test('ordinary attacks retain exactly one target and impact uses live same-life ATK and RES', () => {
  const f = make(), a = enemy(f, { res: 50 }), z = enemy(f, { col: 6.1, res: 50 });
  until(f, () => f.controller.clock.phase?.kind === 'attack');
  const p = f.controller.clock.phase; near(p.releaseAt - p.startedAt, .5);
  until(f, () => f.b.projectiles.list.length > 0);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: 1 } });
  until(f, () => ordinary(f).length === 1);
  assert.equal(ordinary(f)[0].target, p.target); near(ordinary(f)[0].hpLoss, f.u.s.atk * .5);
  assert.equal(f.hits.some(h => h.target === (p.target === a ? z : a)), false);
  assert.equal(f.attacks.length, 1); assert.equal(f.controller.clock.release(p.target, {}), false);
});

test('every facing and ground/flying target retains its source range and attack event', () => {
  for (const fly of [false, true]) for (const [dir, row, col, face] of [
    ['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'], ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ dir }), t = enemy(f, { row, col, fly });
    until(f, () => ordinary(f).length === 1); assert.equal(ordinary(f)[0].target, t);
    assert.equal(f.controller.clock.model(), e.models[ID][face]);
  }
});

test('unsolicited attacks and interrupted or changed-life windups cannot deal damage', () => {
  for (const flag of ['stun', 'disarm', 'hidden', 'target-life']) {
    const f = make(), t = enemy(f);
    f.b.forceAttack(f.u, [t]); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
    until(f, () => f.controller.clock.phase?.kind === 'attack');
    const p = f.controller.clock.phase;
    if (flag === 'stun') f.b.applyStatus(f.u, 'stun', { duration: .05 });
    if (flag === 'disarm') f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
    if (flag === 'hidden') f.u.hidden = true;
    if (flag === 'target-life') t.deploySeq++;
    while (f.b.time <= p.releaseAt + .2) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0); assert.equal(f.b.projectiles.list.length, 0);
  }
});

test('sleep, stealth and camouflage are rechecked before birth and on impact', () => {
  for (const phase of ['windup', 'flight']) for (const flag of ['sleep', 'stealth', 'camou']) {
    const f = make(), t = enemy(f);
    until(f, () => phase === 'windup' ? f.controller.clock.phase?.kind === 'attack' : f.b.projectiles.list.length > 0);
    if (flag === 'sleep') f.b.applyStatus(t, 'sleep', { duration: 99 });
    else f.b.addBuff(t, { key: 'fixture:target-free', flags: { [flag]: true } });
    advance(f.b, 1); assert.equal(f.hits.length, 0);
  }
});

test('ASPD changes retain capped native playback and independently repeated release clocks', () => {
  for (const [aspd, speed] of [[300, 1], [-50, .5]]) {
    const f = make(); enemy(f); f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd } });
    until(f, () => f.controller.clock.phase?.kind === 'attack');
    const p = f.controller.clock.phase;
    near(f.u.mem.regularFormVisual.speed, speed); near(p.releaseAt - p.startedAt, .5 / speed);
    until(f, () => ordinary(f).length === 2);
    assert.ok(ordinary(f)[1].time - ordinary(f)[0].time >= .5 / speed - f.b.dt - 1e-8);
    if (speed === 1) assert.ok(ordinary(f)[1].time - ordinary(f)[0].time < 1);
  }
});

test('retired projectile survives, carries launch attributes and cannot borrow a new owner life', () => {
  const f = make(), t = enemy(f);
  until(f, () => f.b.projectiles.list.length > 0);
  const launchAtk = f.u.s.atk;
  f.b.retreat(f.u, { permanent: true });
  f.u.deploySeq++; f.u.alive = true; f.u.deployed = true;
  f.b.addBuff(f.u, { key: 'fixture:new-life', mods: { atkPct: 100, dmgDealtMul: 100 } });
  until(f, () => ordinary(f).length === 1);
  near(ordinary(f)[0].hpLoss, launchAtk); assert.notEqual(ordinary(f)[0].source, f.u);
  assert.equal(ordinary(f)[0].source.stats, f.u.stats);
  assert.equal(f.controller.stopped, true);
});

test('fizzled target and expired flight records clean up within the native lifetime', () => {
  const f = make(), t = enemy(f);
  until(f, () => f.b.projectiles.list.length > 0); pinOwner(f); f.b.kill(t);
  advance(f.b, 11); assert.equal(f.hits.length, 0); assert.equal(f.controller.flights.size, 0);
  assert.equal(f.b.projectiles.list.length, 0);
});

test('E2 output talent uses a strict live HP boundary and selected potential for every damage receipt', () => {
  for (const [potential, threshold, scale] of [[1, .5, 1.4], [3, .6, 1.45]]) {
    const f = make({ potential }), t = enemy(f); pinOwner(f);
    for (const [ratio, multiplier] of [[threshold, 1], [threshold - .001, scale], [threshold + .001, 1]]) {
      t.hp = t.s.maxHp * ratio;
      near(f.b.dealDamage(f.u, t, { amount: 100, type: 'arts' }), 100 * multiplier);
    }
    t.hp = 100; f.b.addBuff(t, { key: 'fixture:shield', shield: 10000 });
    assert.equal(f.b.dealDamage(f.u, t, { amount: 100, type: 'arts' }), 0);
    const out = f.hits.at(-1); near(out.dmg.mul, scale); assert.equal(out.hpLoss, 0);
  }
  const f = make({ elite: 1 }), t = enemy(f, { hp: 10000 }); pinOwner(f); t.hp = 1000;
  near(f.b.dealDamage(f.u, t, { amount: 100, type: 'arts' }), 100);
});

for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
  test(`S${skill} rank ${rank} servant factory preserves source stats, zero cost and S1-only birth damage`, () => {
    const f = make({ skill, rank, servants: true, trust: 200, potential: 6 }); pinOwner(f);
    const target = enemy(f, { col: 6.2 }), slots = f.b.deployedSlots(), dp = f.u.player.dp;
    const t = enemy(f); f.b.kill(t);
    assert.equal(f.servants.all().length, 0); assert.equal(f.servants.pending.length, 1);
    until(f, () => f.servants.all().length === 1);
    const token = f.servants.all()[0];
    assert.deepEqual([token.tileR, token.tileC], [5, 6]);
    assert.equal(token.deploymentSlotCost, 0); assert.equal(f.b.deployedSlots(), slots);
    assert.equal(f.u.player.dp, dp); assert.equal(token.base.maxHp, 1850);
    assert.equal(token.base.atk, 308); assert.equal(token.base.def, 255);
    assert.equal(token.mem.regularFormVisual.clip, 'Start_2');
    assert.equal(bursts(f).length, skill === 1 ? 1 : 0);
    if (skill === 1) near(bursts(f)[0].hpLoss, f.u.s.atk * f.controller.record.bb.atk_scale);
    assert.equal(token.skill.activate('manual'), false); assert.equal(target.alive, true);
  });
}

test('death by another ally creates a servant, while out-of-range deaths, leaks and cancelled deaths do not', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const a = enemy(f), z = enemy(f, { col: 15 });
  f.b.kill(z, f.u); assert.equal(f.servants.pending.length, 0);
  f.b.retreat(f.u, { permanent: true }); f.b.kill(a); advance(f.b, 1);
  assert.equal(f.servants.all().length, 0);
  const g = make({ servants: true, skill: 2 }); pinOwner(g);
  const t = enemy(g), other = g.b.allyUnits.find(u => u !== g.u);
  g.b.kill(t, other); until(g, () => g.servants.all().length === 1);
  const h = make({ servants: true, skill: 2 }); pinOwner(h);
  const revived = enemy(h);
  h.b.on('kill', ({ victim }) => { if (victim === revived) victim.hp = 100; });
  h.b.kill(revived); advance(h.b, 1); assert.equal(h.servants.all().length, 0);
  const leaked = enemy(h); h.b._remove(leaked, 'leak'); advance(h.b, 1);
  assert.equal(h.servants.all().length, 0);
});

test('factory respects low melee terrain, live occupancy and return reservations, with no forced overlay', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const tiles = [...f.controller.clock.keys()].map(k => [Math.floor(k / 21), k % 21]);
  for (const [r, c] of tiles) f.b.grid.tile(r, c).build = 'NONE';
  f.b.kill(enemy(f)); advance(f.b, .5); assert.equal(f.servants.all().length, 0);
  const [row, col] = [5, 6]; f.b.grid.tile(row, col).build = 'MELEE';
  f.b.grid.tile(row, col).height = 'HIGH';
  assert.equal(f.servants.create(row, col), null);
  f.b.grid.tile(row, col).height = 'LOW';
  const blocker = f.b.spawnDevice('fixture:occupied', row, col);
  assert.equal(f.servants.create(row, col), null);
  f.b.retreat(blocker, { permanent: true });
  const t = f.servants.create(row, col); assert.ok(t);
  assert.equal(f.servants.create(row, col), null); assert.equal(f.servants.tileEligible(99, 99), false);
});

test('promotion cap and unique upgrades do not accumulate repeatedly or switch normal form', () => {
  for (const elite of [0, 1, 2]) {
    const f = make({ servants: true, elite }); pinOwner(f);
    const limit = elite === 0 ? 2 : 3;
    const spots = [[5, 6], [5, 7], [6, 6]];
    for (let i = 0; i < limit; i++) assert.ok(f.servants.create(...spots[i]));
    assert.equal(f.servants.create(4, 6), null);
    const t = f.servants.upgradeOrHeal();
    near(t.s.maxHp, t.base.maxHp * (elite === 2 ? 2 : 1.5));
    near(t.s.atk, t.base.atk * (elite === 2 ? 2 : 1.5));
    near(t.s.def, t.base.def * (elite === 2 ? 1.4 : 1.2));
    assert.equal(t.s.blockCnt, elite === 0 ? 1 : 2);
    assert.equal(t.mem.necrassServantClock.clip('attack'), 'Attack_2');
    while (f.servants.all().some(t => !f.servants.units.get(t).upgraded)) f.servants.upgradeOrHeal();
    const hp = t.s.maxHp, atk = t.s.atk;
    for (let i = 0; i < 8; i++) f.servants.upgradeOrHeal();
    near(t.s.maxHp, hp); near(t.s.atk, atk);
  }
});

test('upgrade heal uses host max HP and ignores HealFree and healing modifiers', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const t = f.servants.create(5, 6); t.hp = 1;
  f.b.addBuff(t, { key: 'fixture:heal-block', flags: { healFree: true }, mods: { healingTakenMul: 0 } });
  let heals = 0; f.b.on('heal', () => heals++);
  f.servants.upgradeOrHeal(); near(t.hp, 2 + f.u.s.maxHp);
  assert.equal(heals, 0); near(f.u.stats.heal, f.u.s.maxHp);
  assert.ok(t.hp < t.s.maxHp);
});

test('S1 bursts occur at creation and each successful upgrade, not at repeated fallback healing', () => {
  const f = make({ servants: true }); pinOwner(f); const enemyTarget = enemy(f, { col: 6.2 });
  for (const spot of [[5, 6], [5, 7], [6, 6]]) f.servants.create(...spot);
  assert.equal(bursts(f).length, 3);
  for (let i = 0; i < 3; i++) f.servants.upgradeOrHeal();
  assert.equal(bursts(f).length, 6);
  f.servants.upgradeOrHeal(); assert.equal(bursts(f).length, 6); assert.equal(enemyTarget.alive, true);
});

test('servant birth completes before one ground Arts attack, even after upgrading', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const t = f.servants.create(5, 6), a = enemy(f, { col: 7 }), z = enemy(f, { row: 6, col: 6 });
  f.servants.upgradeOrHeal();
  until(f, () => servantHits(f).length === 1);
  const hit = servantHits(f)[0]; assert.ok([a, z].includes(hit.target));
  near(hit.hpLoss, t.s.atk); assert.equal(hit.type, 'arts'); assert.equal(hit.dmg.applyWay, 'melee');
  assert.equal(hit.time >= 1.5 - 1e-8, true); assert.equal(t.mem.regularFormVisual.clip, 'Attack_2');
  assert.equal(t.mem.necrassServantClock.phase.releaseAt - t.mem.necrassServantClock.phase.startedAt, .5);
  const g = make({ servants: true, skill: 2 }); pinOwner(g); g.servants.create(5, 6); enemy(g, { col: 7, fly: true });
  advance(g.b, 4); assert.equal(servantHits(g).length, 0);
});

test('host can target an enemy outside its grid blocked by an in-range owned servant', () => {
  const f = make({ servants: true, skill: 2 }); const t = f.servants.create(5, 7);
  const a = enemy(f, { row: 7, col: 7 });
  assert.equal(f.controller.clock.keys().has(7 * 21 + 7), false);
  a.blockedBy = t; assert.deepEqual(f.controller.clock.targets(), [a]);
  t.ownerUnit = f.b.allyUnits.find(u => u !== f.u); assert.deepEqual(f.controller.clock.targets(), []);
  t.ownerUnit = f.u; t.hidden = true; assert.deepEqual(f.controller.clock.targets(), []);
  t.hidden = false; t.x = 15; t.y = 15; assert.deepEqual(f.controller.clock.targets(), []);
});

test('a brief servant stun interrupts its old release even when it expires before the strike', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const t = f.servants.create(5, 6); enemy(f, { col: 7 });
  until(f, () => t.mem.necrassServantClock.phase?.kind === 'attack');
  const p = t.mem.necrassServantClock.phase;
  f.b.applyStatus(t, 'stun', { duration: .01 });
  while (f.b.time <= p.releaseAt + .05) advance(f.b, f.b.dt);
  assert.equal(servantHits(f).length, 0);
  until(f, () => servantHits(f).length === 1);
});

test('servant output gets its owning talent once; unrelated summons do not get it', () => {
  const f = make({ servants: true, skill: 2, potential: 3 }); pinOwner(f);
  const t = f.servants.create(5, 6), a = enemy(f); a.hp = 10000;
  near(f.b.dealDamage(t, a, { amount: 100, type: 'arts' }), 145);
  const g = make({ servants: true, skill: 2 }); const foreign = g.servants.create(5, 6);
  near(f.b.dealDamage(foreign, a, { amount: 100, type: 'arts' }), 100);
});

test('queued deaths revalidate range/tiles and owner finish removes every servant and timer', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const t = f.servants.create(5, 6); f.b.kill(enemy(f, { col: 7 }));
  assert.equal(f.servants.pending.length, 1);
  f.b.retreat(f.u, { permanent: true }); advance(f.b, 2);
  assert.equal(t.alive, false); assert.equal(f.servants.pending.length, 0); assert.equal(f.servants.units.size, 0);
  assert.equal(f.controller.handles.length, 0); assert.equal(f.servants.handles.length, 0);
  assert.equal(f.controller.clock.phase, null);
});

test('real death dispatch upgrades at the cap while an owner stun does not silence the factory', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  for (const spot of [[5, 6], [5, 7], [6, 6]]) f.servants.create(...spot);
  f.b.applyStatus(f.u, 'stun', { duration: 10 });
  f.b.kill(enemy(f, { row: 4, col: 6 }));
  assert.equal(f.servants.pending.length, 1);
  until(f, () => f.servants.all().some(t => f.servants.units.get(t).upgraded));
  const t = f.servants.all().find(t => f.servants.units.get(t).upgraded);
  near(t.s.atk, t.base.atk * 2); assert.equal(f.servants.all().length, 3);
  assert.equal(f.servants.pending.length, 0);
});

test('captured corpse tile becoming occupied falls back legally; a full unavailable range creates nothing', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  f.b.kill(enemy(f)); f.b.spawnDevice('fixture:occupied-later', 5, 6);
  until(f, () => f.servants.all().length === 1);
  const t = f.servants.all()[0]; assert.notDeepEqual([t.tileR, t.tileC], [5, 6]);
  assert.ok(f.controller.clock.keys().has(t.tileR * 21 + t.tileC));
  assert.equal(f.b.grid.tile(t.tileR, t.tileC).height, 'LOW');
  const g = make({ servants: true, skill: 2 }); pinOwner(g);
  g.b.kill(enemy(g));
  for (const k of g.controller.clock.keys()) g.b.grid.tile(Math.floor(k / 21), k % 21).build = 'NONE';
  advance(g.b, 1); assert.equal(g.servants.pending.length, 0); assert.equal(g.servants.all().length, 0);
});

test('return reservations cannot be overwritten by servant creation', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  assert.ok(f.b.reserveTile(f.u, 5, 6, 'fixture:return'));
  assert.equal(f.servants.create(5, 6), null);
  f.b.releaseTileReservations(f.u, 'fixture:return');
  assert.ok(f.servants.create(5, 6));
});

test('an under-cap factory with no legal spawn tile falls back to upgrading its existing servant', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const token = f.servants.create(5, 6);
  for (const k of f.controller.clock.keys()) f.b.grid.tile(Math.floor(k / 21), k % 21).build = 'NONE';
  f.b.kill(enemy(f, { col: 7 }));
  until(f, () => f.servants.units.get(token).upgraded);
  assert.equal(f.servants.all().length, 1); near(token.s.atk, token.base.atk * 2);
});

test('a defeated servant is replaced by a later enemy kill and never resurrects its previous life', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  const old = f.servants.create(5, 6); f.b.kill(old);
  assert.equal(f.servants.all().length, 0);
  f.b.kill(enemy(f)); until(f, () => f.servants.all().length === 1);
  const replacement = f.servants.all()[0];
  assert.notEqual(replacement, old); assert.equal(old.alive, false);
  assert.equal(old.mem.necrassServantClock.stopped, true);
});

test('reentrant owner retirement during token deployment leaves no orphan servant', () => {
  const f = make({ servants: true, skill: 2 }); pinOwner(f);
  f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) f.b.retreat(f.u, { permanent: true }); });
  assert.equal(f.servants.create(5, 6), null);
  assert.equal(f.b.allyUnits.some(t => t.defId === TOKEN && t.alive), false);
  assert.equal(f.servants.units.size, 0); assert.deepEqual(f.b.errors, []);
});

test('battle end retires all diagnostic servants without changing public records', () => {
  const f = make({ servants: true, skill: 2 }); const t = f.servants.create(5, 6);
  f.b.forceEnd('timeout'); assert.equal(t.alive, false); assert.equal(f.controller.stopped, true);
  assert.ok(publicData.operators[ID]); assert.ok(publicData.tokens[TOKEN]);
});
