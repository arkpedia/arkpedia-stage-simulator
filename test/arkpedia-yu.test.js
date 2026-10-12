// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-yu-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { YU_ID as ID, YU_CORE_CONTRACT as CONTRACT, selectedYuBuild, prepareYuCore } from '../server/sim/content/arkpedia-yu.js';

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
  const prepared = prepareYuCore(b, u, { contract });
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

test('Yu selected stats retain promotion, trust cap and exact additive potentials', () => {
  const a = make({ potential: 1, trust: 0 }), b = make({ potential: 6, trust: 100 }), c = make({ potential: 6, trust: 200 });
  near(b.u.base.maxHp - a.u.base.maxHp, 300 + 270);
  near(b.u.base.atk - a.u.base.atk, 30); near(b.u.base.def - a.u.base.def, 30);
  near(b.u.base.cost - a.u.base.cost, -2); assert.deepEqual(b.record.stats, c.record.stats);
  assert.equal(make({ elite: 0 }).record.talents.length, 0); assert.equal(make({ elite: 1 }).record.talents.length, 1);
  near(a.record.block.damage_resistance, .25); near(b.record.block.damage_resistance, .3);
  near(a.record.market.ep_heal_ratio, .015); near(b.record.market.ep_heal_ratio, .02);
});

test('Yu rejects unsourced builds, locked skills, modules and altered selected records', () => {
  for (const change of [{ elite: -1 }, { elite: .5 }, { level: 0 }, { level: 91 }, { potential: 7 },
    { trust: 201 }, { trust: .5 }, { skillRank: 0 }, { skillRank: 11 }, { module: 'prime-x' }, { skillId: 'fake' }])
    assert.throws(() => selectedYuBuild({ elite: 2, level: 90, potential: 1, trust: 0, skillRank: 10, skillId: 'skchr_yu_1', ...change }));
  assert.throws(() => make({ elite: 0, skill: 2 }), /Locked/);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.max_hp++, d => d.skill.spCost++,
    d => d.tags.push('invented'), d => d.talents[0].bb.damage_resistance = .99, d => d.skill.spType = 'time'])
    assert.throws(() => make({ mutate }), /Incomplete/);
});

test('all thirty selected ranks preserve natural time/hurt SP while active skills remain held', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.u.skill.spCost, f.record.source.spData.spCost);
    if (skill === 1) {
      advance(f.b, 2); near(f.u.skill.spTotal, 0);
      const t = enemy(f, { col: 12 });
      for (let n = 0; n < f.u.skill.spCost; n++) f.b.dealDamage(t, f.u, { amount: 1, type: 'phys', isAttack: true });
    } else until(f, () => f.u.skill.ready, 60);
    assert.equal(f.u.skill.ready, true); const sp = f.u.skill.spTotal;
    assert.equal(f.u.skill.activate(), false); near(f.u.skill.spTotal, sp);
  }
});

test('S1 passive taunt exists while the carried skill is inactive and is absent with S2/S3', () => {
  const f = make({ skill: 1, elite: 0 }); near(f.u.s.taunt, f.record.bb.taunt_level);
  assert.equal(f.u.skill.active, false);
  for (const skill of [2, 3]) near(make({ skill }).u.s.taunt, 0);
  f.b.retreat(f.u); assert.equal(f.u.findBuff(`yu:passive:taunt:${f.u.id}`), null);
});

test('ordinary attacks respect original Born and one precise Physical hit in all four facings', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir, elite: 0 }), t = enemy(f, { def: 100 }); enemy(f, { def: 100 });
    advance(f.b, .9); assert.equal(ordinary(f).length, 0);
    until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
    near(p.releaseAt - (p.readyAt - f.u.s.interval), .5);
    until(f, () => ordinary(f).length > 0);
    assert.equal(ordinary(f).length, 1); assert.equal(ordinary(f)[0].target, t);
    near(ordinary(f)[0].amount, f.u.s.atk - 100); assert.equal(ordinary(f)[0].type, 'phys');
    assert.equal(f.attacks.length, 1); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
    assert.equal(f.u.mem.regularDeathVisual?.die, ['LEFT', 'UP'].includes(dir) ? undefined : 'Die');
  }
});

test('ordinary hit reads current ATK and uses the original uncapped speed', () => {
  const f = make({ elite: 0 }); enemy(f);
  f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 100 } });
  until(f, () => f.controller.phase?.kind === 'attack'); near(f.u.mem.regularFormVisual.speed, 2);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  until(f, () => ordinary(f).length > 0); near(ordinary(f)[0].amount, f.u.base.atk * 1.5);
});

test('brief control invalidates an unborn hit and dead targets do not redirect it', () => {
  const f = make({ elite: 0 }), t = enemy(f), other = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
  f.b.applyStatus(f.u, 'stun', { source: null, duration: .05 }); advance(f.b, .1);
  assert.notEqual(f.controller.phase, p); advance(f.b, .5); assert.equal(ordinary(f).length, 0);
  until(f, () => f.controller.phase?.kind === 'attack'); f.b.kill(t, null);
  advance(f.b, .55); assert.equal(ordinary(f).length, 0); near(other.hp, other.s.maxHp);
  until(f, () => ordinary(f).length > 0); assert.equal(ordinary(f)[0].target, other);
});

test('flying, sleeping and unblocked camouflage inputs are rejected; blocked camouflage is targetable', () => {
  const f = make({ elite: 0 }), fly = enemy(f, { fly: true }), camo = enemy(f, { col: 6, flags: { camou: true }, block: false });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { source: f.u, duration: 99 });
  advance(f.b, 3); assert.equal(ordinary(f).length, 0);
  camo.blockedBy = f.u; assert.equal(f.controller.targets()[0], camo);
  assert.equal(f.controller.targets().includes(fly), false);
});

test('each blocked enemy receives a half-second first pulse, then current-ATK Burn before Arts', () => {
  const f = make(), t = enemy(f, { res: 20 });
  advance(f.b, .5); assert.equal(periodic(f).length, 0);
  advance(f.b, f.b.dt); assert.deepEqual(periodic(f).map(h => h.type), ['element', 'arts']);
  near(periodic(f)[0].amount, f.u.s.atk * .12); near(periodic(f)[1].amount, f.u.s.atk * .4 * .8);
  near(t.elem.burn, f.u.s.atk * .12);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  advance(f.b, .95); assert.equal(periodic(f).length, 2);
  advance(f.b, f.b.dt); assert.equal(periodic(f).length, 4);
  near(periodic(f)[2].amount, f.u.s.atk * .12);
});

test('blocked enemies have independent clocks and nonmissable buff output; fly/unblocked enemies gain no dot', () => {
  const f = make(), first = enemy(f); advance(f.b, .25);
  const second = enemy(f); const fly = enemy(f, { fly: true }), outside = enemy(f, { col: 12 });
  f.b.addBuff(first, { key: 'fixture:dodge', mods: { dodgeArts: 1 } });
  advance(f.b, .3); assert.deepEqual(periodic(f).map(h => h.target), [first, first]);
  advance(f.b, .25); assert.deepEqual(periodic(f).map(h => h.target), [first, first, second, second]);
  assert.equal(fly.findBuff(blockKey(f)), null); assert.equal(outside.findBuff(blockKey(f)), null);
});

test('unblocking removes Sanctuary/dot immediately and reblocking starts a fresh first-pulse clock', () => {
  const f = make(), t = enemy(f); assert.ok(f.u.findBuff(sanctuaryKey(f))); assert.ok(t.findBuff(blockKey(f)));
  advance(f.b, .3); f.b._unblock(t); f.b.addBuff(t, { key: 'fixture:no-block', flags: { unblockable: true } });
  assert.equal(f.u.findBuff(sanctuaryKey(f)), null); assert.equal(t.findBuff(blockKey(f)), null);
  advance(f.b, .6); assert.equal(periodic(f).length, 0);
  f.b.removeBuff(t, 'fixture:no-block'); f.b._checkBlock(t);
  advance(f.b, .5); assert.equal(periodic(f).length, 0);
  advance(f.b, f.b.dt); assert.equal(periodic(f).length, 2);
});

test('Sanctuary chooses the strongest source and leaves true/elemental HP damage unchanged', () => {
  const f = make(), t = enemy(f);
  near(f.u.s.physTakenMul, .75); near(f.u.s.artsTakenMul, .75);
  f.b.applyStatus(f.u, 'sanctuary', { key: 'fixture:strong', value: .4, source: t });
  near(f.u.s.physTakenMul, .6); near(f.u.s.artsTakenMul, .6);
  for (const type of ['true', 'elemental']) near(f.b.dealDamage(t, f.u, { amount: 100, type }), 100);
  f.b.removeBuff(f.u, 'fixture:strong'); near(f.u.s.physTakenMul, .75);
  f.b._unblock(t); near(f.u.s.physTakenMul, 1);
});

test('a killed blocked life loses its owned buff and never damages the next life or a neighbour', () => {
  const f = make(), t = enemy(f), other = enemy(f); advance(f.b, .3); f.b.kill(t);
  assert.equal(t.findBuff(blockKey(f)), null); assert.equal(f.controller.blocked.has(t), false);
  advance(f.b, .25); assert.deepEqual(periodic(f).map(h => h.target), [other, other]);
});

test('rejected blocked-buff attachment leaves no null owner or invented periodic output', () => {
  const f = make(); f.b.on('beforeBuff', ctx => { if (ctx.buff.key === blockKey(f)) ctx.cancel = true; });
  enemy(f); advance(f.b, 2); assert.equal(periodic(f).length, 0); assert.equal(f.controller.blocked.size, 0);
});

test('four selected friendly operators including Yu enable recovery; bench, devices and tokens do not count', () => {
  const f = make(); ally(f); ally(f, { col: 8 });
  ally(f, { col: 9, kind: 'token' }); ally(f, { col: 10, kind: 'device' }); ally(f, { col: 11, defer: true });
  advance(f.b, .1); near(f.u.s.hpRegen, 0); near(f.u.s.epRegen, 0);
  const fourth = ally(f, { col: 12 });
  near(f.u.s.hpRegen, f.u.s.maxHp * .015); near(f.u.s.epRegen, f.u.s.maxHp * .015);
  f.b.retreat(fourth); assert.equal(f.u.findBuff(hpKey(f)), null); assert.equal(f.u.findBuff(epKey(f)), null);
});

test('recovery is owner-only before S3 and uses two independent attributes, not direct healing', () => {
  const f = make(); const allies = four(f); f.u.hp -= 500;
  for (const key of Object.keys(f.u.elem)) f.u.elem[key] = 300;
  for (const a of allies) { a.hp -= 500; a.elem.burn = 300; }
  let outputs = 0; f.b.on('heal', () => outputs++); f.b.on('calculatedHeal', () => outputs++);
  advance(f.b, 1); near(f.u.s.maxHp - f.u.hp, 500 - f.u.s.maxHp * .015, 1);
  for (const amount of Object.values(f.u.elem)) near(amount, 300 - f.u.s.maxHp * .015);
  for (const a of allies) { near(a.s.maxHp - a.hp, 500); near(a.elem.burn, 300); }
  assert.equal(outputs, 0); assert.equal(f.u.buffs.filter(b => b.key === hpKey(f)).length, 1);
});

test('recovery bypasses heal-free/noHeal/multipliers and control; HP prohibition is independent of EP recovery', () => {
  const f = make(); four(f); f.u.hp -= 500; f.u.elem.burn = 300;
  f.b.addBuff(f.u, { key: 'fixture:healing', flags: { noHeal: true, healFree: true },
    mods: { healingDealtMul: 3, healingTakenMul: 4 } });
  f.b.applyStatus(f.u, 'stun', { source: null, duration: 2 }); advance(f.b, 1);
  near(f.u.s.maxHp - f.u.hp, 500 - f.u.s.maxHp * .015, 1); near(f.u.elem.burn, 300 - f.u.s.maxHp * .015);
  f.b.addBuff(f.u, { key: 'fixture:critical', flags: { noHpRecovery: true } }); const hp = f.u.hp, ep = f.u.elem.burn;
  advance(f.b, 1); near(f.u.hp, hp); near(f.u.elem.burn, ep - f.u.s.maxHp * .015);
});

test('elemental recovery tracks current max HP at the original refresh cadence and selected potential', () => {
  const f = make({ potential: 6 }); four(f); const before = f.u.s.maxHp;
  f.b.addBuff(f.u, { key: 'fixture:maxhp', mods: { hpPct: 1 } });
  near(f.u.s.hpRegen, f.u.s.maxHp * .02); near(f.u.s.epRegen, before * .02);
  advance(f.b, .3); near(f.u.s.epRegen, f.u.s.maxHp * .02);
  f.b.removeBuff(f.u, 'fixture:maxhp'); advance(f.b, .3); near(f.u.s.epRegen, before * .02);
});

test('the shared EP attribute combines additive sources but does not recover any gauge during a burst', () => {
  const f = make({ elite: 0 });
  f.b.addBuff(f.u, { key: 'fixture:ep1', mods: { epRegen: 20 } });
  f.b.addBuff(f.u, { key: 'fixture:ep2', mods: { epRegen: 30 } }); near(f.u.s.epRegen, 50);
  for (const k of Object.keys(f.u.elem)) f.u.elem[k] = 200;
  f.b.addBuff(f.u, { key: 'burnBurst', duration: 2, flags: { burstLock: true } });
  advance(f.b, 1); assert.ok(Object.values(f.u.elem).every(v => v === 200));
  f.b.removeBuff(f.u, 'burnBurst'); advance(f.b, 1); assert.ok(Object.values(f.u.elem).every(v => Math.abs(v - 150) < 1e-5));
  f.b.removeBuff(f.u, 'fixture:ep1'); near(f.u.s.epRegen, 30);
  f.b.removeBuff(f.u, 'fixture:ep2'); near(f.u.s.epRegen, 0);
});

test('pre-E2 builds never gain second-talent recovery and E0 gains no block damage/Sanctuary', () => {
  for (const elite of [0, 1]) {
    const f = make({ elite }); four(f); enemy(f); advance(f.b, .6);
    near(f.u.s.hpRegen, 0); near(f.u.s.epRegen, 0);
    if (!elite) { assert.equal(periodic(f).length, 0); assert.equal(f.u.findBuff(sanctuaryKey(f)), null); }
    else assert.equal(periodic(f).length, 2);
  }
});

test('owner retreat and battle end clear blocked recipients, recovery, visuals and installed hooks', () => {
  for (const end of ['retreat', 'battleEnd']) {
    const f = make(); four(f); const t = enemy(f); advance(f.b, .3);
    if (end === 'retreat') f.b.retreat(f.u); else f.b.emit('battleEnd', {});
    assert.equal(f.controller.stopped, true); assert.equal(f.controller.handles.length, 0);
    assert.equal(f.controller.blocked.size, 0); assert.equal(f.controller.recovery.size, 0);
    assert.equal(t.findBuff(blockKey(f)), null); assert.equal(f.u.findBuff(hpKey(f)), null);
    assert.equal(f.u.findBuff(epKey(f)), null); assert.equal(f.u.mem.regularFormVisual, null);
    advance(f.b, 1); assert.equal(periodic(f).length, 0);
  }
});
