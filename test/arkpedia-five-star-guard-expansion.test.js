// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-expansion-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_EXPANSION_OPERATORS } from '../shared/arkpedia/five-star-guard-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { COLS } from '../server/sim/constants.js';

const SAVAGE = 'char_230_savage', INDRA = 'char_155_tiger', SIDEROCA = 'char_333_sidero';
const FLINT = 'char_415_flint', AKAFUYU = 'char_475_akafyu';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(id, options = {}, allies = []) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(src, { operators: [id, ...allies].map(k => ({
    ...defaultBuild(src.operators[k]), ...(k === id ? options : {}),
  })) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99); return b;
}
function deploy(b, id, r = 2, c = 7) {
  b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, 'RIGHT'); u.atkCd = 1000; return u;
}
function enemy(b, x = 8, y = 2) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = e.hp = 100000; e.base.def = e.base.res = e.base.moveSpeed = e.base.massLevel = 0; e.markDirty();
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []);
}
function cast(u) { u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(u.skill.activate('test'), true); }
function strike(b, u, e, seconds = 1) { const hp = e.hp; b.forceAttack(u, [e]); advance(b, seconds); return hp - e.hp; }

test('guard expansion retains verified bundles, original attack families, skill dependencies and typed source events', () => {
  assert.equal(evidence.sourceVersion, '26-09-23-17-49-43_b9cc4a');
  for (const id of Object.keys(FIVE_STAR_GUARD_EXPANSION_OPERATORS)) {
    assert.match(evidence.sourceBundles.find(v => v.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.characters[id].length); assert.equal(data.operators[id].skills.length, 2);
  }
  const evade = evidence.buffTemplates.evade_physical_melee.eventToActions.ON_TAKE_DAMAGE[0];
  assert.equal(evade._damageMask, 'PHYSICAL'); assert.equal(evade._applyWayFilter, 'MELEE');
  assert.ok(evidence.skills.skchr_savage_2.some(row => row.components.some(c => c._maxNum === 5)));
  assert.equal(evidence.buffTemplates.akafyu_trait.eventToActions.ON_OUTPUT_DAMAGE[1]._ignoreHealFree, true);
  assert.equal(evidence.buffTemplates['akafyu_s_2[dmg_bubble]'].eventToActions.ON_BUFF_START[0]._skipModifierEvent, true);
});

test('both original guard expansion skills resolve source SP, duration and blackboards at all ten ranks', () => {
  for (const [id, support] of Object.entries(FIVE_STAR_GUARD_EXPANSION_OPERATORS)) for (const skillId of support.skillIds)
    for (let rank = 1; rank <= 10; rank++) {
      const b = make(id, { skillId, skillRank: rank }), u = deploy(b, id);
      assert.equal(u.skill.id, skillId); near(u.skill.spCost, u.def.skill.spCost);
      near(u.skill.duration, u.def.skill.duration); assert.equal(u.skill.noSkill, false);
    }
});

test('Savage Valley counts exactly cardinal HIGH deployable tiles, activates at source count2 and responds to removal', () => {
  const b = make(SAVAGE), u = deploy(b, SAVAGE), atk = u.base.atk, def = u.base.def;
  const positions = [[3, 7], [1, 7], [2, 8], [2, 6]];
  const tile = (r, c, change) => { b.grid.tiles[r * COLS + c] = { ...b.grid.tile(r, c), ...change }; };
  for (const [r, c] of positions) tile(r, c, { height: 'LOW', build: 'ALL' });
  advance(b, b.dt); near(u.s.atk, atk);
  tile(3, 7, { height: 'HIGH', build: 'RANGED' }); advance(b, b.dt); near(u.s.atk, atk);
  tile(1, 7, { height: 'HIGH', build: 'NONE' }); advance(b, b.dt); near(u.s.atk, atk);
  tile(1, 7, { build: 'ALL' }); advance(b, b.dt); near(u.s.atk, atk * 1.1); near(u.s.def, def * 1.1);
  tile(3, 7, { height: 'LOW' }); advance(b, b.dt); near(u.s.atk, atk); near(u.s.def, def);
});

test('Savage S1 replaces one attack at the current block-capacity target count and independently mitigates each victim', () => {
  const b = make(SAVAGE), u = deploy(b, SAVAGE), enemies = Array.from({ length: 4 }, () => enemy(b));
  enemies.forEach(e => { e.base.def = 100; e.markDirty(); }); cast(u);
  const chosen = acquireTargets(b, u, effectiveProfile(u)); assert.equal(chosen.length, 3);
  b.forceAttack(u, chosen); advance(b, .45);
  for (let i = 0; i < 3; i++) near(100000 - enemies[i].hp, u.s.atk * 2.3 - 100);
  near(enemies[3].hp, 100000); assert.equal(u.skill.pending, false); near(u.skill.spTotal, 0);
});

test('Savage S2 attacks immediately after its source hit frame, caps five on extended range and gains no attack SP', () => {
  const b = make(SAVAGE, { skillId: 'skchr_savage_2' }), u = deploy(b, SAVAGE), oldRange = [...u.rangeKeys];
  const enemies = Array.from({ length: 6 }, () => enemy(b, 10, 2));
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 0); cast(u); assert.equal(u.skill.pending, true);
  advance(b, .55); enemies.forEach(e => near(e.hp, 100000)); advance(b, .1);
  assert.equal(enemies.filter(e => e.hp < 100000).length, 5);
  for (const e of enemies.filter(e => e.hp < 100000)) near(100000 - e.hp, u.s.atk * 4);
  assert.deepEqual(u.rangeKeys, oldRange); near(u.skill.spTotal, 0); assert.equal(u.skill.pending, false);
});

test('Savage S2 empty casts finish immediately instead of holding a next-attack indefinitely', () => {
  const b = make(SAVAGE, { skillId: 'skchr_savage_2' }), u = deploy(b, SAVAGE); cast(u);
  assert.equal(u.skill.pending, false); assert.equal(u.skill.active, false); near(u.skill.spTotal, 0);
});

test('Indra talent only evades physical MELEE apply way, never adjacent ranged, Arts or unsourced ability damage', () => {
  const b = make(INDRA, { potential: 6 }), u = deploy(b, INDRA), e = enemy(b); b.rng = () => 0;
  const hp = u.hp; near(b.dealDamage(e, u, { amount: 1000, type: 'phys', applyWay: 'melee', isAttack: true }), 0);
  near(u.hp, hp); assert.ok(u.findBuff('indra:next-attack'));
  assert.ok(b.dealDamage(e, u, { amount: 100, type: 'phys', applyWay: 'ranged', isAttack: true }) > 0);
  assert.ok(b.dealDamage(e, u, { amount: 100, type: 'arts', applyWay: 'melee', isAttack: true }) > 0);
  assert.ok(b.dealDamage(e, u, { amount: 100, type: 'phys' }) > 0);
  assert.ok(b.dealDamage(e, u, { amount: 100, type: 'phys', applyWay: 'melee', canDodge: false }) > 0);
});

test('Indra dodge charge does not stack, combines additively with S1 and outside ATK, then expires after one damaging attack', () => {
  const b = make(INDRA), u = deploy(b, INDRA), e = enemy(b); b.rng = () => 0;
  for (let i = 0; i < 2; i++) b.dealDamage(e, u, { amount: 100, type: 'phys', applyWay: 'melee' });
  near(u.s.atk, u.base.atk * 2); b.addBuff(u, { key: 'outside:ATK', mods: { atkPct: .2 } });
  e.base.def = 100; e.markDirty(); cast(u); const atk = u.base.atk * 3.6; near(u.s.atk, atk);
  near(strike(b, u, e), atk - 40); assert.equal(u.findBuff('indra:next-attack'), null); near(u.s.atk, u.base.atk * 1.2);
  near(strike(b, u, e), u.base.atk * 1.2 - 100);
});

test('Indra charged attack remains available when a victim evades the entire damage instance', () => {
  const b = make(INDRA), u = deploy(b, INDRA), e = enemy(b); b.rng = () => 0;
  b.dealDamage(e, u, { amount: 100, type: 'phys', applyWay: 'melee' }); b.addBuff(e, { key: 'evade', mods: { dodgePhys: 1 } });
  near(strike(b, u, e), 0); assert.ok(u.findBuff('indra:next-attack')); b.removeBuff(e, 'evade');
  near(strike(b, u, e), u.base.atk * 2); assert.equal(u.findBuff('indra:next-attack'), null);
});

test('Indra S2 uses Arts mitigation and heals the full output damage including overkill, with ordinary healing bans', () => {
  const b = make(INDRA, { skillId: 'skchr_tiger_2' }), u = deploy(b, INDRA), e = enemy(b);
  e.base.def = 10000; e.base.res = 25; e.markDirty(); e.hp = 10; u.hp = 1; cast(u);
  const amount = u.s.atk * .75; strike(b, u, e); near(u.hp, 1 + amount * .25);
  b.addBuff(u, { key: 'test:heal-ban', flags: { healFree: true } }); u.hp = 1;
  strike(b, u, enemy(b)); near(u.hp, 1); advance(b, 26); assert.equal(effectiveProfile(u).dmgType, 'phys');
});

test('Sideroca S1 restores source maxHP ratio immediately and obeys direct-heal bans', () => {
  const b = make(SIDEROCA), u = deploy(b, SIDEROCA); u.hp = 1; cast(u); near(u.hp, 1 + u.s.maxHp * .7);
  u.hp = 1; b.addBuff(u, { key: 'test:heal-ban', flags: { healFree: true } }); cast(u); near(u.hp, 1);
});

test('Sideroca S2 reduces range to her own tile, boosts Arts ATK and regenerates while controlled or forbidden to heal', () => {
  const b = make(SIDEROCA, { skillId: 'skchr_sidero_2' }), u = deploy(b, SIDEROCA), e = enemy(b), normalRange = [...u.rangeKeys];
  cast(u); assert.equal(u.rangeKeys.length, 1); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 0);
  near(u.s.atk, u.base.atk * 2.1); u.hp = 1; b.addBuff(u, { key: 'test:ban', flags: { healFree: true, noHeal: true, stun: true } });
  advance(b, 1); near(u.hp, 1 + u.s.maxHp * .08); advance(b, 30);
  near(u.s.hpRegen, 0); near(u.s.atk, u.base.atk); assert.deepEqual(u.rangeKeys, normalRange);
  assert.equal(effectiveProfile(u).dmgType, 'arts'); near(e.hp, 100000);
});

test('Sideroca own-kill threshold and potential grant permanent ASPD/resistance, excluding allies and clearing at withdrawal', () => {
  for (const [potential, threshold] of [[1, 7], [6, 5]]) {
    const b = make(SIDEROCA, { potential }, ['char_122_beagle']), u = deploy(b, SIDEROCA), ally = deploy(b, 'char_122_beagle', 2, 6);
    b.dealDamage(ally, enemy(b), { amount: 200000, type: 'true' }); near(u.s.aspd, u.base.aspd);
    for (let i = 1; i <= threshold; i++) {
      b.dealDamage(u, enemy(b), { amount: 200000, type: 'true' }); near(u.s.aspd, u.base.aspd + (i === threshold ? 15 : 0));
    }
    near(b.resistOf(u), .5); b.applyStatus(u, 'stun', { duration: 10 }); near(u.findBuff('stun').timeLeft, 5);
    b.retreatOperator(SIDEROCA); advance(b, u.base.respawnTime + .1); const again = deploy(b, SIDEROCA); near(again.s.aspd, again.base.aspd); near(b.resistOf(again), 0);
  }
});

test('Flint talent amplifies damage after DEF only when the victim is not blocked by Flint herself', () => {
  const b = make(FLINT, { potential: 6 }, ['char_122_beagle']), u = deploy(b, FLINT), ally = deploy(b, 'char_122_beagle', 2, 6), e = enemy(b); e.base.def = 100; e.markDirty();
  near(strike(b, u, e), (u.s.atk - 100) * 1.45); e.blockedBy = u; u.blocking = [e];
  near(strike(b, u, e), u.s.atk - 100); e.blockedBy = ally; ally.blocking = [e]; u.blocking = [];
  near(strike(b, u, e), (u.s.atk - 100) * 1.45);
});

test('Flint S1 applies actual source force0 directional push and one-second Sluggish, including no movement against weight3', () => {
  const b = make(FLINT), u = deploy(b, FLINT), e = enemy(b), x = e.x; cast(u); strike(b, u, e, .45);
  assert.ok(e.x > x); assert.ok(e.findBuff('sluggish')); advance(b, 1.1); assert.equal(e.findBuff('sluggish'), null);
  const heavy = enemy(b); heavy.base.massLevel = 3; heavy.markDirty(); cast(u); strike(b, u, heavy, .45);
  near(heavy.x, 8); assert.ok(heavy.findBuff('sluggish'));
});

test('Flint S2 forces final block0, releases enemies, uses nonrepeating source variants and restores on expiry', () => {
  const b = make(FLINT, { skillId: 'skchr_flint_2' }), u = deploy(b, FLINT), e = enemy(b);
  e.blockedBy = u; u.blocking = [e]; b.addBuff(u, { key: 'outside:block', mods: { blockCnt: 2 } }); cast(u); near(u.s.blockCnt, 0);
  advance(b, b.dt); assert.equal(e.blockedBy, null); const visuals = []; b.rng.pick = v => v[0];
  const original = b._ev.bind(b); b._ev = v => { if (v[0] === 'atk' && v[1] === u.id) visuals.push(v[4]?.animation); original(v); };
  for (let i = 0; i < 3; i++) {
    const before = e.hp; b.forceAttack(u, [e]); advance(b, .3); near(e.hp, before); advance(b, .15); assert.ok(e.hp < before);
  }
  assert.deepEqual(visuals, ['Skill2_A', 'Skill2_B', 'Skill2_A']); assert.ok(e.findBuff('sluggish'));
  advance(b, 21); near(u.s.blockCnt, 3); near(u.s.atk, u.base.atk); near(u.s.aspd, u.base.aspd);
});

test('Akafuyu promotion healing rejects other units but ignores healFree and samples the exact HP-ratio ASPD curve', () => {
  for (const [elite, level, value, max, threshold] of [[0, 50, 30, 50, .5], [1, 70, 50, 75, .4], [2, 80, 70, 100, .3]]) {
    const b = make(AKAFUYU, { elite, level, skillRank: 4 }, ['char_120_hibisc']), u = deploy(b, AKAFUYU), medic = deploy(b, 'char_120_hibisc', 1, 7), e = enemy(b);
    b.addBuff(u, { key: 'test:ban', flags: { healFree: true } }); u.hp = u.s.maxHp * (1 + threshold) / 2; advance(b, .3);
    near(u.s.aspd, u.base.aspd + max / 2); const hp = u.hp; strike(b, u, e, .6); near(u.hp - hp, value);
    near(b.heal(medic, u, 100), 0); u.hp = u.s.maxHp * threshold; advance(b, .3); near(u.s.aspd, u.base.aspd + max);
    u.hp = u.s.maxHp; advance(b, .3); near(u.s.aspd, u.base.aspd);
  }
});

test('Akafuyu S1 doubles full independently mitigated hits at source .03 delta, heals each and cannot block', () => {
  const b = make(AKAFUYU), u = deploy(b, AKAFUYU), e = enemy(b); e.base.def = 100; e.markDirty();
  u.hp = u.s.maxHp / 2; advance(b, .3); cast(u); near(u.s.blockCnt, 0); const hp = u.hp, hits = [];
  b.on('damaged', c => { if (c.source === u && c.target === e) hits.push([b.time, c.amount]); });
  b.forceAttack(u, [e]); advance(b, .3 + b.dt); assert.equal(hits.length, 1); advance(b, .05); assert.equal(hits.length, 2);
  hits.forEach(([, amount]) => near(amount, u.base.atk * 1.8 - 100)); assert.ok(hits[1][0] - hits[0][0] >= .03 - 1e-8);
  near(u.hp - hp, 140); advance(b, 13); near(u.s.blockCnt, 1); near(u.s.atk, u.base.atk);
});

test('Akafuyu second skill strike is interrupted while the first hit and its healing remain', () => {
  const b = make(AKAFUYU), u = deploy(b, AKAFUYU), e = enemy(b); u.hp = u.s.maxHp / 2; advance(b, .3); cast(u);
  const hp = u.hp; b.forceAttack(u, [e]); advance(b, .3 + b.dt); b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .1);
  near(100000 - e.hp, u.base.atk * 1.8); near(u.hp - hp, 70);
});
test('Akafuyu queued second hit remembers control shorter than one frame', () => {
  const b = make(AKAFUYU), u = deploy(b, AKAFUYU), e = enemy(b); u.hp = u.s.maxHp / 2; advance(b, .3); cast(u);
  const hp = u.hp; b.forceAttack(u, [e]); advance(b, .3 + b.dt); b.applyStatus(u, 'stun', { duration: .03 }); advance(b, .1);
  assert.equal(Boolean(u.s.flags.stun), false); near(100000 - e.hp, u.base.atk * 1.8); near(u.hp - hp, 70);
});

test('Akafuyu S2 halves currentHP before its one-hit shield, bypasses other modifiers and removes only its barrier at expiry', () => {
  const b = make(AKAFUYU, { skillId: 'skchr_akafyu_2' }), u = deploy(b, AKAFUYU), e = enemy(b);
  b.addBuff(u, { key: 'outside:shield', shield: 700 }); b.addBuff(u, { key: 'outside:damage', mods: { trueTakenMul: .2, dmgDealtMul: .1 } });
  u.hp = 1000; cast(u); near(u.hp, 500); near(u.findBuff('outside:shield').shield, 700);
  assert.equal(u.findBuff('akafuyu:skill-shield').shieldHits, 1); near(u.s.atk, u.base.atk * 2); near(u.s.def, u.base.def * 2.2);
  near(b.dealDamage(e, u, { amount: 10000, type: 'true' }), 0); near(u.hp, 500); assert.equal(u.findBuff('akafuyu:skill-shield'), null);
  near(u.findBuff('outside:shield').shield, 700); advance(b, 21); near(u.s.atk, u.base.atk); near(u.s.def, u.base.def);
  assert.ok(u.findBuff('outside:shield')); assert.ok(u.findBuff('outside:damage'));
});
