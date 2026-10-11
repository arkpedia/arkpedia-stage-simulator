// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-caster-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const minimalist = 'char_4054_malist', amiya = 'char_002_amiya', skyfire = 'char_166_skfire';
const leizi = 'char_306_leizi', astgenne = 'char_135_halo';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
const bbOf = level => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));
function make(id, { skill = 0, rank = 10, elite = 2, potential = 1, enemies = 1 } = {}) {
  const src = structuredClone(data), op = src.operators[id];
  src.stage.geometry.waves[0].spawns = enemies ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(src.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, def: 0, magicResistance: 0, moveSpeed: 0 });
  const b = new StandardBattle(src, { operators: [{ ...defaultBuild(op), elite, level: 1, potential,
    skillRank: rank, skillId: op.skills[skill].id }] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 1, 7, 'UP'); u.atkCd = 1000; b.step();
  for (const e of b.enemies) pin(b, e, 7, 2);
  b.step(); return { b, u, src };
}
function pin(b, e, x, y) { e.x = x; e.y = y; b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true }, persist: true }); }
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function activate(u) { u.skill.gainSp(u.skill.spCost * u.skill.maxCharges, 'test'); assert.equal(u.skill.activate('test'), true); }
function attack(b, u, target, seconds = 1.5) { const hp = target.hp; b.forceAttack(u, [target]); advance(b, seconds); return hp - target.hp; }

test('five-star caster evidence preserves original burst, area, chain, fixed-flight and dispatch fields', () => {
  assert.equal(evidence.source.tableCommit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(evidence.source.bundles.length, 7);
  assert.ok(evidence.characters[skyfire].some(r => r._damageType === 2 && !r._projectileKey && r._maxAnimScale === 1));
  const multi = evidence.skills.skchr_malist_2.find(r => r._additionalTimes === 1);
  assert.equal(multi._waitAttackEventForAllAttacks, 1); assert.equal(multi._onlyFeedActionsToFirstOne, 0);
  assert.ok(evidence.projectiles.projectile_amiya_s2.some(r => Math.abs(r._time - .15) < 1e-6));
  assert.ok(evidence.projectiles.projectile_skfire_s2.some(r => r._lifeTime === 1.5 && r._alwaysReachInTheEnd === 1));
  assert.ok(evidence.projectiles.projectile_leizi_s2.some(r => r._atkScale === 1 && r._interval === 0));
  assert.ok(evidence.projectiles.projectile_chr_halo.some(r => r._speed === 8));
  assert.ok(evidence.interpretations.some(s => s.includes('dispatch lifecycle')));
});

test('Minimalist normal caster plus funnel ramps only its consecutive target and crit uses per-hit pre-mitigation ATK', () => {
  const { b, u } = make(minimalist, { enemies: 2 }), [a, z] = b.enemies;
  b.rng.chance = () => false;
  for (const scale of [1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.1]) near(attack(b, u, a), u.s.atk * scale);
  near(attack(b, u, z), u.s.atk * 1.2);
  a.base.res = 40; a.markDirty();
  const rolls = []; b.rng.chance = p => { rolls.push(p); return true; };
  near(attack(b, u, a), u.s.atk * 1.2 * 1.5 * .6); assert.deepEqual(rolls, [.25, .25]);
});

test('Minimalist talent unlock and potential chance are source-selected for real caster and drone hits', () => {
  for (const [elite, potential, chance] of [[0, 1, null], [1, 1, .1], [1, 5, .15], [2, 1, .25], [2, 5, .3]]) {
    const { b, u } = make(minimalist, { elite, potential, rank: 1 });
    const rolls = []; b.rng.chance = p => { rolls.push(p); return true; };
    near(attack(b, u, b.enemies[0]), u.s.atk * 1.2 * (chance == null ? 1 : 1.5));
    assert.deepEqual(rolls, chance == null ? [] : [chance, chance]);
  }
});

test('Minimalist both source skills work at every rank, consume one charge per double shot and restore S1 stats', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const x = make(minimalist, { rank }), bb = bbOf(x.src.operators[minimalist].skills[0].levels[rank - 1]);
    x.b.rng.chance = () => false; const atk = x.u.s.atk, aspd = x.u.s.aspd; activate(x.u);
    near(attack(x.b, x.u, x.b.enemies[0]), (atk + x.u.base.atk * bb.atk) * 1.2);
    near(x.u.s.aspd, aspd + bb.attack_speed); advance(x.b, 36); near(x.u.s.atk, atk); near(x.u.s.aspd, aspd);
    const y = make(minimalist, { skill: 1, rank }), second = bbOf(y.src.operators[minimalist].skills[1].levels[rank - 1]);
    y.b.rng.chance = () => false; activate(y.u); const charges = y.u.skill.charges;
    near(attack(y.b, y.u, y.b.enemies[0]), y.u.s.atk * second.atk_scale * (1.2 + 1.35));
    assert.equal(y.u.skill.charges, charges); // activation spent exactly one; double release spends none.
    assert.equal(y.u.skill.pending, false);
  }
});

test('Minimalist second source-timed release is interrupted by control while already-fired projectiles land', () => {
  const { b, u } = make(minimalist, { skill: 1 }), t = b.enemies[0]; b.rng.chance = () => false; activate(u);
  b.forceAttack(u, [t]); advance(b, .367); b.applyStatus(u, 'stun', { duration: 2 }); advance(b, .5);
  near(100000 - t.hp, u.s.atk * 2 * 1.2);
});

test('Amiya normal attack has only one damaging projectile with fixed .15s flight despite visual empty releases', () => {
  const { b, u } = make(amiya), t = b.enemies[0]; b.forceAttack(u, [t]);
  advance(b, .533); near(t.hp, 100000); assert.equal(b.projectiles.list.length, 1);
  pin(b, t, u.x + .01, u.y); advance(b, .067); near(t.hp, 100000);
  advance(b, .067); near(100000 - t.hp, u.s.atk);
  advance(b, 1); near(100000 - t.hp, u.s.atk);
});

test('Amiya talent unlock restores attack or killing SP separately and active duration blocks its grants', () => {
  for (const [elite, potential, hitSp, killSp] of [[1, 1, 0, 0], [2, 1, 2, 8], [2, 6, 3, 10]]) {
    const { b, u } = make(amiya, { elite, potential, rank: 1 }); const t = b.enemies[0];
    u.skill.sp = 0; u.skill.charges = 0; b.dealDamage(u, t, { amount: 10, type: 'arts', isAttack: true }); near(u.skill.sp, hitSp);
    u.skill.sp = 0; t.hp = 1; b.dealDamage(u, t, { amount: 10, type: 'arts', isAttack: true }); near(u.skill.sp, killSp);
    const next = b.spawnEnemy('enemy_1007_slime', { x: 7, y: 2 }); pin(b, next, 7, 2); activate(u);
    b.dealDamage(u, next, { amount: 10, type: 'arts', isAttack: true }); near(u.skill.sp, 0);
  }
});

test('Amiya S1 source ASPD and S2 burst count/scale/random selection hold at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const x = make(amiya, { rank }), aspd = x.u.s.aspd, bb = bbOf(x.src.operators[amiya].skills[0].levels[rank - 1]);
    activate(x.u); near(x.u.s.aspd, aspd + bb.attack_speed); near(attack(x.b, x.u, x.b.enemies[0]), x.u.s.atk);
    advance(x.b, 31); near(x.u.s.aspd, aspd);
    const y = make(amiya, { rank, skill: 1, enemies: 2 }), sb = bbOf(y.src.operators[amiya].skills[1].levels[rank - 1]);
    activate(y.u); let index = 0; y.b.rng.pick = candidates => candidates[(index++) % candidates.length];
    const hits = []; y.b.on('damaged', c => { if (c.source === y.u) hits.push([c.target, c.amount, y.b.time]); });
    y.b.forceAttack(y.u, [y.b.enemies[0]]); advance(y.b, 2);
    assert.equal(hits.length, sb['attack@times']); assert.ok(new Set(hits.map(x => x[0])).size === 2);
    for (const [, amount] of hits) near(amount, y.u.s.atk * sb['attack@atk_scale']);
    assert.ok(hits[1][2] - hits[0][2] >= .1 - y.b.dt - 1e-8); near(y.u.skill.sp, 0);
  }
});

test('Amiya interrupted burst loses unreleased shots; normal S2 expiry applies ten-second self-stun', () => {
  const { b, u } = make(amiya, { skill: 1 }), t = b.enemies[0]; activate(u); b.forceAttack(u, [t]);
  advance(b, .733); b.applyStatus(u, 'stun', { duration: .2 }); advance(b, 1);
  near(100000 - t.hp, u.s.atk * .6); advance(b, 24);
  assert.equal(u.skill.active, false); assert.ok(u.s.flags.stun); advance(b, 10); assert.ok(!u.s.flags.stun);
});

test('Amiya S3 expands range, scales max HP preserving ratio, deals true damage and force-retreats without refund', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(amiya, { rank, skill: 2 }), t = b.enemies[0];
    const bb = bbOf(src.operators[amiya].skills[2].levels[rank - 1]), atk = u.s.atk, hp = u.s.maxHp;
    t.base.res = 95; t.base.def = 10000; t.markDirty(); u.hp = hp / 2; const range = u.rangeKeys.length; activate(u);
    near(u.s.maxHp, hp + u.base.maxHp * bb.max_hp); near(u.hpRatio, .5); assert.ok(u.rangeKeys.length > range);
    near(attack(b, u, t), atk + u.base.atk * bb.atk); const dp = b.dp; b.flags.dpPerSec = 0; advance(b, 31);
    assert.equal(u.alive, false); assert.equal(u.removeReason, 'skill'); near(b.dp, dp);
    assert.ok(b.bench[amiya].readyAt > b.time); // ordinary new placement becomes possible after cooldown.
  }
});

test('Skyfire normal source area hits directly once at release; talent boosts only Arts on currently blocked enemies', () => {
  const { b, u } = make(skyfire, { enemies: 3 }), [a, z, out] = b.enemies;
  pin(b, z, 7.8, 2); pin(b, out, 8.3, 2); b.step();
  b.forceAttack(u, [a]); advance(b, .733); near(100000 - a.hp, u.s.atk); near(100000 - z.hp, u.s.atk); near(out.hp, 100000);
  assert.equal(b.projectiles.list.length, 0);
  a.blockedBy = { alive: true }; near(b.dealDamage(null, a, { amount: 100, type: 'arts' }), 115);
  near(b.dealDamage(null, a, { amount: 100, type: 'phys' }), 100); a.blockedBy = null;
  near(b.dealDamage(null, a, { amount: 100, type: 'arts' }), 100);
  b.retreatOperator(skyfire); a.blockedBy = { alive: true }; near(b.dealDamage(null, a, { amount: 100, type: 'arts' }), 100);
});

test('Skyfire distant normal area attack lands at its model release without an added flight delay', () => {
  const { b, u } = make(skyfire), target = b.enemies[0]; pin(b, target, 7, 4); b.step();
  const hits = [], projectiles = []; b.on('damaged', c => { if (c.source === u) hits.push(b.time); });
  b.on('tick', () => projectiles.push(...b.projectiles.list));
  const start = b.time; b.forceAttack(u, [target]); advance(b, .633); near(target.hp, 100000);
  advance(b, .1); assert.equal(hits.length, 1); near(100000 - target.hp, u.s.atk);
  assert.ok(hits[0] <= start + .667 + b.dt * 2); assert.equal(projectiles.length, 0);
});

test('Skyfire S1 and fixed-area delayed meteors obey all ranks, additive BAT, single damage and source stun', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const x = make(skyfire, { rank }), atk = x.u.s.atk, bb = bbOf(x.src.operators[skyfire].skills[0].levels[rank - 1]);
    activate(x.u); near(attack(x.b, x.u, x.b.enemies[0]), atk + x.u.base.atk * bb.atk); advance(x.b, 31); near(x.u.s.atk, atk);
    const { b, u, src } = make(skyfire, { rank, skill: 1, enemies: 3 }), [a, z, out] = b.enemies;
    const sb = bbOf(src.operators[skyfire].skills[1].levels[rank - 1]); pin(b, z, 8.5, 2); pin(b, out, 4, 2); b.step();
    b.addBuff(u, { key: 'outside:bat', mods: { batPct: .3 } }); activate(u); near(u.s.bat, u.base.bat * 2);
    b.forceAttack(u, [a]); advance(b, .4); pin(b, a, 11, 4); advance(b, 1.3); near(z.hp, 100000);
    const statuses = []; b.on('statusApplied', c => { if (c.source === u && c.status === 'stun') statuses.push(c); });
    advance(b, .2); near(100000 - z.hp, u.s.atk * sb['attack@atk_scale']); near(a.hp, 100000); near(out.hp, 100000);
    assert.equal(statuses.length, 1); advance(b, src.operators[skyfire].skills[1].levels[rank - 1].duration + 1); near(u.s.bat, u.base.bat * 1.3);
  }
});

test('chain casters preserve promotion count, no repetition, radius, first flight, Sluggish and per-victim Leizi talent', () => {
  for (const id of [leizi, astgenne]) for (const [elite, count] of [[0, 3], [1, 3], [2, 4]]) {
    const { b, u } = make(id, { elite, rank: 1, enemies: 5 });
    b.enemies.forEach((e, i) => pin(b, e, 7 + i * .3, 2)); b.step();
    // Independently blocked second victim must not get Leizi's unblocked ATK scale.
    const t = b.enemies[0]; b.enemies[1].blockedBy = { alive: true, deployed: true, blocking: [b.enemies[1]],
      x: b.enemies[1].x, y: b.enemies[1].y, s: { blockCnt: 1, flags: {} }, profile: {} };
    b.forceAttack(u, [t]); advance(b, id === leizi ? .3 : .7); near(t.hp, 100000);
    advance(b, .5);
    for (let i = 0; i < count; i++) {
      const talent = id === leizi && elite > 0 && i !== 1 ? (elite === 1 ? 1.1 : 1.2) : 1;
      near(100000 - b.enemies[i].hp, u.s.atk * Math.pow(.85, i) * talent);
      assert.ok(b.enemies[i].findBuff('sluggish'));
    }
    near(b.enemies[4].hp, 100000); assert.equal(u.mem.chainProjectiles.size, 0);
  }
});

test('Leizi S2 removes jump falloff and S1/S2 ATK applies at every rank and expires; fizzles release cast lock', () => {
  for (let rank = 1; rank <= 10; rank++) for (const skill of [0, 1]) {
    const { b, u, src } = make(leizi, { skill, rank, enemies: 4 }), atk = u.s.atk;
    b.enemies.forEach((e, i) => pin(b, e, 7 + i * .3, 2)); b.step(); activate(u);
    const bb = bbOf(src.operators[leizi].skills[skill].levels[rank - 1]); b.forceAttack(u, [b.enemies[0]]); advance(b, 1);
    for (let i = 0; i < 4; i++) near(100000 - b.enemies[i].hp, (atk + u.base.atk * bb.atk) * (skill ? 1 : Math.pow(.85, i)) * 1.2);
    advance(b, 36); near(u.s.atk, atk);
  }
  const { b, u } = make(leizi); pin(b, b.enemies[0], 7, 4); b.step(); b.forceAttack(u, b.enemies);
  advance(b, .367); assert.equal(u.mem.chainProjectiles.size, 1); b.kill(b.enemies[0], u); advance(b, .1); assert.equal(u.mem.chainProjectiles.size, 0);
});

test('Astgenne S1 independent two-target chains may overlap, source count stays four at E0 and each cast spends one charge', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(astgenne, { rank, elite: rank > 4 ? 2 : 0, enemies: 4 });
    b.enemies.forEach((e, i) => pin(b, e, 7 + i * .3, 2)); b.step(); activate(u);
    const bb = bbOf(src.operators[astgenne].skills[0].levels[rank - 1]), targets = acquireTargets(b, u, effectiveProfile(u));
    assert.equal(targets.length, 2); const hp = b.enemies.reduce((sum, e) => sum + e.hp, 0), charges = u.skill.charges;
    b.forceAttack(u, targets); advance(b, 1.5);
    near(hp - b.enemies.reduce((sum, e) => sum + e.hp, 0), u.s.atk * bb.atk_scale * 2 * (1 + .85 + .85 ** 2 + .85 ** 3));
    assert.equal(u.skill.charges, charges); assert.equal(u.mem.chainProjectiles.size, 0);
  }
});

test('Astgenne talent waits first fifteen seconds, caps five stacks by promotion and resets after withdrawal', () => {
  for (const [elite, amount] of [[0, 0], [1, 3], [2, 4]]) {
    const { b, u } = make(astgenne, { elite, rank: 1, enemies: 0 }), aspd = u.s.aspd;
    advance(b, 14.8); near(u.s.aspd, aspd); advance(b, .2); near(u.s.aspd, aspd + amount);
    advance(b, 65); near(u.s.aspd, aspd + 5 * amount); b.retreatOperator(astgenne);
    advance(b, 80); const next = b.deployOperator(astgenne, 1, 7, 'UP'); next.atkCd = 1000;
    near(next.s.aspd, aspd); advance(b, 15 + b.dt); near(next.s.aspd, aspd + amount);
  }
});

test('Astgenne S2 expands range, fires two source-sized chains and expires with outside buffs intact at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(astgenne, { rank, skill: 1, enemies: 4 });
    b.enemies.forEach((e, i) => pin(b, e, 7 + i * .3, 2)); b.step();
    const range = u.rangeKeys.length, atk = u.s.atk, bb = bbOf(src.operators[astgenne].skills[1].levels[rank - 1]);
    b.addBuff(u, { key: 'outside:atk', mods: { atkPct: .2 } }); activate(u);
    assert.ok(u.rangeKeys.length > range); const hp = b.enemies.reduce((sum, e) => sum + e.hp, 0);
    b.forceAttack(u, acquireTargets(b, u, effectiveProfile(u))); advance(b, 1.5);
    near(hp - b.enemies.reduce((sum, e) => sum + e.hp, 0), (atk + u.base.atk * (bb.atk + .2)) * 2 * (1 + .85 + .85 ** 2 + .85 ** 3));
    advance(b, 26); near(u.s.atk, atk + u.base.atk * .2); assert.equal(u.rangeKeys.length, range);
  }
});
