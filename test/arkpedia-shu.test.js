// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { SHU_ID as ID, SHU_CORE_CONTRACT as CONTRACT, selectedShuBuild, prepareShuCore } from '../server/sim/content/arkpedia-shu.js';

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
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate,
  squad = ['char_289_gyuki'] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: squad.map(id => defaultBuild(d.operators[id])) });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_shu_${skill}` };
  const r = selectedShuBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareShuCore(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [], sowings = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  b.on('shuSowing', ctx => sowings.push({ ...ctx, time: b.time }));
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, sowings, ...prepared };
}
function ally(f, { id = 'char_196_sunbr', row = 5, col = 7, token = false, flags = {}, defer = false } = {}) {
  const def = normalizeChess(recordFor(defaultBuild(f.d.operators[id]), f.d));
  const a = f.b._makeAlly(f.b.getPlayer('arkpedia'), def, token ? 'token' : 'op', row, col, { dir: 'RIGHT' });
  f.b._setupUnit(a, { trait: { noAttack: true }, talents: [], skill: { kind: 'duration', duration: 5, trigger: { rule: 'NEVER' } } });
  if (!defer) assert.ok(f.b._deploy(a, { initial: false }));
  f.b.addBuff(a, { key: 'fixture:flags', flags });
  return a;
}
function enemy(f, { row = 5, col = 5, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const regenKey = f => `shu:sowing:regen:${f.u.id}`;
const sanctuaryKey = f => `shu:sowing:sanctuary:${f.u.id}`;
const sui = ['char_2014_nian', 'char_2015_dusk', 'char_2023_ling'];

test('Shu core-only contract preserves all ranks/SP without enabling active skills', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.u.skill.spCost, f.record.source.spData.spCost);
    assert.equal(f.u.skill.maxCharges, f.record.source.spData.maxChargeTime);
    until(f, () => f.u.skill.ready, 50);
    const sp = f.u.skill.spTotal;
    assert.equal(f.u.skill.activate(), false); near(f.u.skill.spTotal, sp);
  }
});

test('selected source stats separate trust cap, promotion and additive potential bonuses', () => {
  const a = make({ potential: 1, trust: 0 }), b = make({ potential: 6, trust: 100 }), c = make({ potential: 6, trust: 200 });
  const favor = e.tables.character.favorKeyFrames.at(-1).data;
  near(b.u.base.maxHp - a.u.base.maxHp, favor.maxHp + 200);
  near(b.u.base.atk - a.u.base.atk, favor.atk + 25);
  near(b.u.base.def - a.u.base.def, favor.def);
  near(b.u.base.cost - a.u.base.cost, -2);
  assert.deepEqual(b.record.stats, c.record.stats);
  assert.equal(make({ elite: 0 }).record.talents.length, 0);
  assert.equal(make({ elite: 1 }).record.talents.length, 1);
  assert.deepEqual(b.record.sowing, { hp_recovery_per_sec: 75, damage_resistance: .12 });
});

test('core rejects unsourced builds, locked skills, modules and altered definition data', () => {
  for (const change of [{ elite: -1 }, { elite: .5 }, { level: 0 }, { level: 91 }, { potential: 7 },
    { trust: 201 }, { trust: .5 }, { skillRank: 0 }, { skillRank: 11 }, { module: 'gua-x' }, { skillId: 'fake' }]) {
    assert.throws(() => selectedShuBuild({ elite: 2, level: 90, potential: 1, trust: 0, skillRank: 10, skillId: 'skchr_shu_1', ...change }));
  }
  assert.throws(() => make({ elite: 0, skill: 2 }), /Locked/);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.heal_scale++, d => d.skill.spCost++,
    d => d.tags.push('invented'), d => d.talents[0].bb.damage_resistance = .99])
    assert.throws(() => make({ mutate }), /Incomplete/);
});

test('ordinary attacks wait for original Born and one precise Physical hit in every facing', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }), t = enemy(f, { def: 100 });
    enemy(f, { def: 100 });
    advance(f.b, .9); assert.equal(f.hits.length, 0);
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    near(p.releaseAt - (p.readyAt - f.u.s.interval), .5333333611488342);
    until(f, () => f.hits.length > 0);
    assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, t);
    near(f.hits[0].amount, f.u.s.atk - 100); assert.equal(f.hits[0].type, 'phys');
    assert.equal(f.attacks.length, 1); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack_1');
  }
});

test('ordinary attack speed is uncapped and source current ATK is read at release', () => {
  const f = make(); enemy(f);
  f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 100 } });
  until(f, () => f.controller.phase?.kind === 'attack');
  near(f.u.mem.regularFormVisual.speed, 2);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  until(f, () => f.hits.length > 0);
  near(f.hits[0].amount, f.u.base.atk * 1.5);
});

test('flying, invisible and sleeping enemies are excluded; blocked camouflage remains selectable', () => {
  const f = make(); const fly = enemy(f, { fly: true }), camo = enemy(f, { col: 6, flags: { camou: true } });
  const sleep = enemy(f); f.b.applyStatus(sleep, 'sleep', { source: f.u, duration: 99 });
  advance(f.b, 3); assert.equal(f.hits.length, 0);
  camo.blockedBy = f.u; assert.equal(f.controller.targets()[0], camo);
  assert.equal(f.controller.targets().includes(fly), false);
});

test('brief control cancels an unborn hit even after control expires', () => {
  const f = make(); enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase;
  f.b.applyStatus(f.u, 'stun', { source: null, duration: .05 });
  advance(f.b, .1); assert.notEqual(f.controller.phase, p);
  advance(f.b, .5); assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length > 0);
});

test('dead/stale target never redirects the accepted attack to a new life or neighbour', () => {
  const f = make(), t = enemy(f), other = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase; f.b.kill(t, null);
  advance(f.b, .6); assert.equal(f.hits.length, 0); assert.equal(other.hp, other.s.maxHp);
  assert.equal(p.released, true);
  until(f, () => f.hits.length > 0); assert.equal(f.hits[0].target, other);
});

test('accepted direct heal sows exactly five tiles even on a full-HP recipient', () => {
  const f = make(), a = ally(f); assert.equal(f.b.heal(f.u, a, 10), 0);
  assert.deepEqual([...f.controller.tiles].sort(), [[5, 7], [4, 7], [6, 7], [5, 6], [5, 8]].map(([r, c]) => f.b.grid.key(r, c)).sort());
  assert.equal(f.sowings.length, 1); near(a.s.hpRegen, 70);
  assert.equal(a.findBuff(sanctuaryKey(f)).source, f.u);
  f.b.heal(f.u, a, 10); near(a.s.hpRegen, 70);
  assert.equal(a.buffs.filter(b => b.key === regenKey(f)).length, 1);
});

test('sowing excludes forbidden tiles but includes deployable high-ground and passable roads', () => {
  const f = make(), a = ally(f);
  f.b.grid.tiles[f.b.grid.key(5, 8)] = { height: 'HIGH', build: 'NONE', pass: 'FLY' };
  f.b.grid.tiles[f.b.grid.key(4, 7)] = { height: 'HIGH', build: 'RANGED', pass: 'FLY' };
  f.b.grid.tiles[f.b.grid.key(6, 7)] = { height: 'LOW', build: 'NONE', pass: 'ALL' };
  f.b.heal(f.u, a, 10);
  assert.equal(f.controller.tiles.has(f.b.grid.key(5, 8)), false);
  assert.equal(f.controller.tiles.has(f.b.grid.key(4, 7)), true);
  assert.equal(f.controller.tiles.has(f.b.grid.key(6, 7)), true);
});

test('no talent or rejected external healing cannot sow, and natural regeneration creates no heal output', () => {
  const f = make({ elite: 0 }), a = ally(f); f.b.heal(f.u, a, 10);
  assert.equal(f.controller.tiles.size, 0);
  const g = make(), blocked = ally(g, { flags: { healFree: true } });
  assert.equal(g.b.heal(g.u, blocked, 10), 0); assert.equal(g.controller.tiles.size, 0);
  let outputs = 0; g.b.on('heal', () => outputs++); g.b.on('calculatedHeal', () => outputs++);
  g.u.hp -= 500; g.b.addBuff(g.u, { key: 'fixture:regen', mods: { hpRegen: 30 } });
  advance(g.b, 1); near(g.u.s.maxHp - g.u.hp, 470); assert.equal(outputs, 0);
  assert.equal(g.controller.tiles.size, 0);
});

test('sowing regeneration bypasses noHeal/healFree and healing modifiers without stacking', () => {
  const f = make(), a = ally(f), token = ally(f, { row: 5, col: 8, token: true, flags: { noHeal: true, healFree: true } });
  f.b.heal(f.u, a, 10);
  f.b.addBuff(token, { key: 'fixture:healing', mods: { healingDealtMul: 2, healingTakenMul: 3 } });
  token.hp -= 300; assert.equal(f.b.heal(f.u, token, 100), 0);
  advance(f.b, 1); near(token.s.maxHp - token.hp, 230);
  assert.equal(f.sowings.length, 1); near(token.s.hpRegen, 70);
});

test('regeneration API bypasses healability/multipliers/listeners while direct healing retains them', () => {
  const f = make(), a = ally(f, { flags: { noHeal: true, healFree: true } });
  f.b.addBuff(f.u, { key: 'fixture:outgoing-heal', mods: { healingDealtMul: 2 } });
  f.b.addBuff(a, { key: 'fixture:incoming-heal', mods: { healingTakenMul: 3 } });
  let outputs = 0; f.b.on('heal', () => outputs++); f.b.on('calculatedHeal', () => outputs++);
  const receipts = []; f.b.on('regenerated', c => {
    receipts.push(c); assert.ok(Object.isFrozen(c));
    assert.throws(() => { c.amount = 999; }, TypeError);
  });
  a.hp -= 200; near(f.b.heal(f.u, a, 10, { regen: true }), 10); assert.equal(outputs, 0);
  assert.equal(receipts.length, 1); near(receipts[0].amount, 10); near(receipts[0].actual, 10);
  assert.equal(f.controller.tiles.size, 0); assert.equal(f.b.heal(f.u, a, 10), 0);
  f.b.removeBuff(a, 'fixture:flags'); near(f.b.heal(f.u, a, 10), 60); assert.equal(outputs, 2);
  assert.equal(f.controller.tiles.size, 5);
});

test('Sowing Sanctuary chooses the strongest source, excludes true damage and HP loss', () => {
  const f = make({ potential: 5 }), a = ally(f), t = enemy(f);
  f.b.heal(f.u, a, 1);
  const before = a.hp; f.b.dealDamage(t, a, { amount: 100, type: 'arts' });
  near(before - a.hp, 88 * (1 - a.s.res / 100));
  f.b.applyStatus(a, 'sanctuary', { key: 'fixture:stronger', value: .5 });
  const second = a.hp; f.b.dealDamage(t, a, { amount: 100, type: 'arts' });
  near(second - a.hp, 50 * (1 - a.s.res / 100));
  const third = a.hp; f.b.dealDamage(t, a, { amount: 100, type: 'true' }); near(third - a.hp, 100);
  const fourth = a.hp; f.b.loseHp(a, 100, { source: t }); near(fourth - a.hp, 100);
});

test('allies leaving and entering a sowed tile update effects and recipient removal retains tile state', () => {
  const f = make(), a = ally(f), moved = ally(f, { row: 5, col: 9 });
  f.b.heal(f.u, a, 1); assert.equal(f.b.relocate(a, 6, 9), true); advance(f.b, f.b.dt);
  assert.equal(a.findBuff(regenKey(f)), null); assert.equal(a.findBuff(sanctuaryKey(f)), null);
  assert.equal(f.b.relocate(moved, 5, 7), true); advance(f.b, f.b.dt); near(moved.s.hpRegen, 70);
  f.b.retreat(moved, { permanent: true }); assert.equal(f.controller.tiles.size, 5);
  const newcomer = ally(f, { row: 5, col: 7 }); near(newcomer.s.hpRegen, 70);
});

test('three distinct deployed classes add max HP, preserving current HP ratio and excluding tokens', () => {
  const f = make(), a = ally(f, { id: 'char_123_fang', row: 4, col: 4 });
  a.hp = a.s.maxHp / 2; const original = a.s.maxHp;
  const medic = ally(f, { id: 'char_120_hibisc', row: 4, col: 6 });
  near(a.s.maxHp, original * 1.12); near(a.hpRatio, .5);
  const token = ally(f, { row: 3, col: 4, token: true }); near(token.s.maxHp, token.base.maxHp);
  f.b.retreat(medic, { permanent: true }); near(a.s.maxHp, original); near(a.hpRatio, .5);
});

test('three same-class deployed operators add ASPD independently and lose it on departure', () => {
  const f = make(), a = ally(f, { row: 4, col: 4 }), z = ally(f, { row: 4, col: 6 });
  near(f.u.s.aspd, f.u.base.aspd + 12); near(a.s.aspd, a.base.aspd + 12);
  f.b.retreat(z, { permanent: true }); near(a.s.aspd, a.base.aspd);
  assert.equal(f.u.findBuff(`shu:seasons:hp:${f.u.id}`), null);
});

test('Sui squad count includes the undeployed Shu and undeployed squad members, not live token copies', () => {
  const f = make({ squad: sui, defer: true }), a = ally(f);
  assert.equal(f.b.shuSquad.suiCount, 4); assert.equal(f.b.shuSquad.enabled, true);
  near(a.s.atk, a.base.atk * 1.12);
  assert.equal(f.u.alive, false);
  const token = ally(f, { token: true, row: 4, col: 7 }); near(token.s.atk, token.base.atk);
  const g = make({ squad: sui.slice(0, 2), defer: true }); ally(g, { id: sui[0] }); ally(g, { id: sui[0], row: 6 });
  assert.equal(g.b.shuSquad.suiCount, 3); assert.equal(g.b.shuSquad.enabled, false);
});

test('Sui SP pulses use independent deployment clocks and honour suppression without delayed awards', () => {
  const f = make({ squad: sui, defer: true }), a = ally(f);
  a.skill.setSpTotal(0); f.b.addBuff(a, { key: 'fixture:no-natural-sp', mods: { spRecoveryMul: 0 } });
  advance(f.b, 2); const z = ally(f, { row: 6, col: 7 }); z.skill.setSpTotal(0);
  f.b.addBuff(z, { key: 'fixture:no-natural-sp', mods: { spRecoveryMul: 0 } });
  advance(f.b, 2.1); near(a.skill.spTotal, 1); near(z.skill.spTotal, 0);
  f.b.addBuff(a, { key: 'fixture:no-sp', flags: { noSp: true } });
  advance(f.b, 4); near(a.skill.spTotal, 1); near(z.skill.spTotal, 1);
  f.b.removeBuff(a, 'fixture:no-sp'); advance(f.b, 3.9); near(a.skill.spTotal, 1);
  advance(f.b, .1); near(a.skill.spTotal, 2);
});

test('Shu removal clears Sowing and field auras but retains squad bonus; battle end removes all hooks', () => {
  const f = make({ squad: sui }), a = ally(f), z = ally(f, { row: 6, col: 7 });
  f.b.heal(f.u, a, 10); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  f.b.retreat(f.u, { permanent: true }); advance(f.b, 1);
  assert.equal(f.hits.length, 0); assert.equal(f.controller.tiles.size, 0); assert.equal(f.controller.handles.length, 0);
  assert.equal(a.findBuff(regenKey(f)), null); assert.equal(a.findBuff(sanctuaryKey(f)), null);
  near(a.s.aspd, a.base.aspd); near(a.s.atk, a.base.atk * 1.12);
  f.b.forceEnd('fixture'); assert.equal(f.b.shuSquad.stopped, true);
  assert.equal(f.b.shuSquad.handles.length, 0); assert.equal(f.b.shuSquad.entries.size, 0);
  assert.equal(a.findBuff('shu:seasons:squad'), null); assert.equal(z.findBuff('shu:seasons:squad'), null);
});
