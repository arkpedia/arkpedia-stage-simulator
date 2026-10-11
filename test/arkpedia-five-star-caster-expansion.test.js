// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-caster-expansion-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { absoluteRangeKeys } from '../server/sim/targeting.js';
import { COLS } from '../server/sim/constants.js';
const iris = 'char_338_iris', serum = 'char_489_serum', lion = 'char_373_lionhd';
const harmonie = 'char_297_hamoni', kjera = 'char_4013_kjera';
const near = (a, z, epsilon = 1e-5) => assert.ok(Math.abs(a - z) < epsilon, `${a} != ${z}`);
const bbOf = level => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));
function make(id, { skill = 0, rank = 10, elite = 2, potential = 1, enemies = 1, lowTiles = null } = {}) {
  const src = structuredClone(data), op = src.operators[id];
  src.stage.geometry.waves[0].spawns = enemies ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(src.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, def: 0, magicResistance: 0, moveSpeed: 0 });
  const b = new StandardBattle(src, { operators: [{ ...defaultBuild(op), elite, level: 1, potential,
    skillRank: rank, skillId: op.skills[skill].id }] });
  if (lowTiles != null) {
    const old = b.grid.tile.bind(b.grid), range = absoluteRangeKeys(op.phases[elite].rangeGrid, 1, 7, 'UP');
    const low = new Set(range.slice(0, lowTiles));
    b.grid.tile = (r, c) => ({ ...old(r, c), height: low.has(r * COLS + c) ? 'LOW' : 'HIGH' });
  }
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 1, 7, 'UP'); u.atkCd = 1000; b.step();
  for (const e of b.enemies) pin(b, e, 7, 2);
  b.step(); return { b, u, src };
}
function pin(b, e, x, y) { e.x = x; e.y = y; b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true }, persist: true }); }
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function activate(u) { u.skill.gainSp(u.skill.spCost * u.skill.maxCharges, 'test'); assert.equal(u.skill.activate('test'), true); }
function attack(b, u, target, seconds = 1.5) { const hp = target.hp; b.forceAttack(u, [target]); advance(b, seconds); return hp - target.hp; }
function block(b, e) {
  const blocker = { alive: true, deployed: true, blocking: [e], x: e.x, y: e.y,
    s: { blockCnt: 99, flags: {} }, profile: {} };
  e.blockedBy = blocker; return blocker;
}
function row(rs, id) { const result = rs.find(r => r.pathId === id); assert.ok(result, id); return result; }

test('caster expansion original evidence preserves separate charge contexts, wake collider, cancellation, aura and drone delay', () => {
  assert.equal(evidence.source.tableCommit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(evidence.source.bundles.length, 7);
  const irisStored = row(evidence.characters[iris], '8496592444334088337');
  assert.equal(row(evidence.characters[iris], '3133337179890196625')._chargeAbility.m_PathID, irisStored.pathId);
  assert.equal(row(evidence.characters[harmonie], '-622562832898567667')._feedData, 1);
  near(evidence.projectiles.projectile_chr_iris_s2.find(r => r.type === 'CircleCollider2D').m_Radius, .8);
  assert.equal(row(evidence.skills.skchr_serum_2, '-2968070276066669293')._suspendableLimitedTimes, -1);
  assert.equal(row(evidence.skills.skchr_lionhd_2, '585158219660063168')._waitForAttackEvent, 1);
  assert.equal(row(evidence.skills.skchr_hamoni_2, '-7794264196327067468')._removeBuffWhenAbilityDetached, 1);
  near(row(evidence.projectiles.projectile_chr_kjera_funnel_s2_1, '-7586214494661659385')._preDelay, .6);
  assert.ok(evidence.interpretations.some(s => s.includes('numeric abnormalFlag9')));
});

test('Iris stores up to three shots without targets; only stored attacks receive the unlocked talent multiplier', () => {
  for (const [elite, potential, scale] of [[0, 1, 1], [1, 1, 1.15], [1, 5, 1.19], [2, 1, 1.3], [2, 5, 1.34]]) {
    const { b, u } = make(iris, { elite, potential, rank: 1, enemies: 0 });
    advance(b, u.s.interval * 5); assert.equal(u.trait.stored, 3);
    const target = b.spawnEnemy('enemy_1007_slime', { x: 7, y: 2 }); pin(b, target, 7, 2); b.step();
    target.base.res = 40; target.markDirty();
    near(attack(b, u, target), u.s.atk * (1 + 3 * scale) * .6); assert.equal(u.trait.stored, 0);
    near(attack(b, u, target), u.s.atk * .6);
  }
});

test('Iris and Harmonie S1 all ranks preserve final BAT scaling, changed range, and distinct stored-shot contexts', () => {
  for (const id of [iris, harmonie]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(id, { rank, enemies: 0 }), interval = u.s.interval, range = [...u.rangeKeys];
    advance(b, interval * 3 + b.dt); assert.equal(u.trait.stored, 3);
    const target = b.spawnEnemy('enemy_1007_slime', { x: 7, y: 2 }); pin(b, target, 7, 2); b.step();
    b.addBuff(u, { key: 'outside:bat', mods: { batPct: .3 } });
    activate(u); const bb = bbOf(src.operators[id].skills[0].levels[rank - 1]);
    near(u.s.interval, interval * 1.3 * .2); assert.notDeepEqual(u.rangeKeys, range);
    const storeScale = id === iris ? 1.3 : bb['attack@atk_scale'];
    near(attack(b, u, target), u.s.atk * (bb['attack@atk_scale'] + 3 * storeScale));
    advance(b, 5); near(u.s.interval, interval * 1.3); assert.deepEqual(u.rangeKeys, range);
  }
});

test('Iris S2 launches only two sleep projectiles at the source model event, preserves stored charges and accepts an empty cast', () => {
  const { b, u } = make(iris, { skill: 1, enemies: 3 }), [a, z, out] = b.enemies;
  u.trait.stored = 3; pin(b, z, 7.5, 2); pin(b, out, 6.5, 2); b.step();
  activate(u); advance(b, .333); assert.equal(b.projectiles.list.length, 0);
  advance(b, .067); assert.equal(b.projectiles.list.length, 2); assert.equal(u.skill.pending, false);
  advance(b, .2); assert.equal(b.enemies.filter(e => e.s.flags.sleep).length, 2); near(a.hp, 100000);
  assert.equal(u.trait.stored, 3);
  const empty = make(iris, { skill: 1, enemies: 0 }); activate(empty.u);
  assert.equal(empty.u.skill.active, false); assert.equal(empty.u.skill.charges, 0);
});

test('Iris S2 every rank explodes at wake in radius .8 once per target using current ATK, including after retreat', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(iris, { skill: 1, rank, enemies: 3 }), [a, z, out] = b.enemies;
    pin(b, z, 7, 2); pin(b, out, 7.9, 2); b.step(); activate(u); advance(b, .6);
    const asleep = b.enemies.filter(e => e.s.flags.sleep); assert.equal(asleep.length, 2);
    b.addBuff(u, { key: 'wake:atk', mods: { atkPct: .5 } });
    if (rank === 10) b.retreatOperator(iris);
    const expected = u.s.atk * bbOf(src.operators[iris].skills[1].levels[rank - 1]).atk_scale * 2;
    advance(b, 6.8); near(a.hp, 100000); advance(b, .3);
    near(100000 - a.hp, expected); near(100000 - z.hp, expected); near(out.hp, 100000);
    advance(b, .3); near(100000 - a.hp, expected);
  }
});

test('Iris wake respects sleep immunity and Resist duration; dispelling the owned sleep triggers once', () => {
  const { b, u } = make(iris, { skill: 1, enemies: 2 }), [a, immune] = b.enemies;
  immune.def = { ...immune.def, immune: new Set([...immune.def.immune, 'sleep']) };
  b.applyStatus(a, 'resist', { duration: 10 }); activate(u); advance(b, .6);
  assert.ok(a.s.flags.sleep); assert.ok(!immune.s.flags.sleep); near(immune.hp, 100000);
  near(a.findBuff(`iris:sleep:${u.id}`).duration, 3.5);
  b.removeBuff(a, `iris:sleep:${u.id}`); advance(b, .1);
  near(100000 - a.hp, u.s.atk * 3); near(100000 - immune.hp, u.s.atk * 3);
  advance(b, 4); near(100000 - a.hp, u.s.atk * 3);
});

test('Corroserum source line attacks hit every eligible enemy once at release without a projectile', () => {
  const { b, u } = make(serum, { enemies: 3 }), [a, z, out] = b.enemies;
  pin(b, z, 7, 3); pin(b, out, 6, 2); b.step();
  const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 2);
  b.forceAttack(u, targets); advance(b, .633); near(a.hp, 100000); advance(b, .1);
  near(100000 - a.hp, u.s.atk); near(100000 - z.hp, u.s.atk); near(out.hp, 100000);
  assert.equal(b.projectiles.list.length, 0);
});

test('Corroserum talent unlock/potential waits four seconds and resets on actual attack release', () => {
  for (const [elite, potential, gain] of [[0, 1, 0], [1, 1, .2], [1, 5, .25], [2, 1, .45], [2, 5, .5]]) {
    const { b, u } = make(serum, { elite, potential, rank: 1 }), base = u.s.spRecovery;
    advance(b, 3.8); near(u.s.spRecovery, base); advance(b, .2); near(u.s.spRecovery, base + gain);
    b.forceAttack(u, [b.enemies[0]]); advance(b, .6); near(u.s.spRecovery, base + gain);
    advance(b, .133); near(u.s.spRecovery, base); advance(b, 3.8); near(u.s.spRecovery, base);
    advance(b, .2); near(u.s.spRecovery, base + gain);
  }
});

test('Corroserum S1 all ranks restores ATK and applies its ten-second self-stun only at normal expiry', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(serum, { rank }), atk = u.s.atk;
    activate(u); near(attack(b, u, b.enemies[0]), atk + u.base.atk * bbOf(src.operators[serum].skills[0].levels[rank - 1]).atk);
    advance(b, 29); near(u.s.atk, atk); assert.ok(u.s.flags.stun); advance(b, 10); assert.ok(!u.s.flags.stun);
  }
});

test('Corroserum S2 all ranks applies exact silence to each victim and expires cleanly', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(serum, { skill: 1, rank, enemies: 2 }), [a, z] = b.enemies;
    pin(b, z, 7, 3); b.step(); z.def = { ...z.def, immune: new Set([...z.def.immune, 'silence']) };
    const atk = u.s.atk; activate(u);
    const bb = bbOf(src.operators[serum].skills[1].levels[rank - 1]);
    b.forceAttack(u, acquireTargets(b, u, effectiveProfile(u))); advance(b, .9);
    near(100000 - a.hp, atk + u.base.atk * bb.atk); assert.ok(a.s.flags.silence); assert.ok(!z.s.flags.silence);
    near(a.findBuff('silence').duration, bb['attack@silence']);
    advance(b, 26); near(u.s.atk, atk); assert.equal(u.skill.active, false); assert.ok(!u.s.flags.stun);
  }
});

test('Corroserum actual command toggles S2 cancellation, preserves spent charge and resumes SP without skill damage', () => {
  const { b, u } = make(serum, { skill: 1 }), target = b.enemies[0], atk = u.s.atk;
  const ends = []; b.on('skillEnd', c => { if (c.unit === u) ends.push(c.reason); });
  u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(b.activateOperator(serum), true);
  near(attack(b, u, target), atk + u.base.atk); assert.equal(u.skill.active, true); near(u.skill.sp, 0);
  assert.equal(b.activateOperator(serum), true); assert.equal(u.skill.active, false); near(u.s.atk, atk);
  assert.equal(u.skill.charges, 0); assert.deepEqual(ends, ['manual']); near(attack(b, u, target), atk);
  assert.ok(u.skill.sp > 0); assert.equal(b.activateOperator(serum), false);
  assert.ok(!u.s.flags.stun);
});

test('Leonhardt normal direct AoE does not duplicate splash; talent counts hidden base-range enemies and caps by potential', () => {
  for (const [elite, potential, pct, cap] of [[0, 1, 0, 5], [1, 1, .03, 5], [1, 5, .03, 6], [2, 1, .04, 5], [2, 5, .04, 6]]) {
    const { b, u } = make(lion, { elite, potential, rank: 1, enemies: 7 });
    b.enemies[6].hidden = true; b.step(); near(u.s.atk, u.base.atk * (1 + pct * cap));
    const target = b.enemies[0]; near(attack(b, u, target), u.s.atk);
    for (let i = 0; i < 6; i++) near(100000 - b.enemies[i].hp, u.s.atk);
    near(b.enemies[6].hp, 100000); assert.equal(b.projectiles.list.length, 0);
    b.enemies[6].hidden = false; pin(b, b.enemies[5], 0, 0); pin(b, b.enemies[6], 0, 0); b.step();
    near(u.s.atk, u.base.atk * (1 + pct * 5));
  }
});

test('Leonhardt S1 ATK and S2 instant expanded damage/charge count/RES reduction work at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const first = make(lion, { rank }), atk = first.u.s.atk;
    activate(first.u); near(attack(first.b, first.u, first.b.enemies[0]), atk + first.u.base.atk * bbOf(first.src.operators[lion].skills[0].levels[rank - 1]).atk);
    advance(first.b, 31); near(first.u.s.atk, atk);
    const { b, u, src } = make(lion, { skill: 1, rank, enemies: 2 }), [a, expanded] = b.enemies;
    const skill = src.operators[lion].skills[1].levels[rank - 1], bb = bbOf(skill);
    const extra = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir).find(k => !u.rangeKeySet.has(k));
    assert.notEqual(extra, undefined); pin(b, expanded, extra % COLS, Math.floor(extra / COLS)); b.step();
    a.base.res = 40; expanded.base.res = 40; a.markDirty(); expanded.markDirty();
    activate(u); assert.equal(u.skill.maxCharges, skill.spData.maxChargeTime);
    near(u.s.atk, u.base.atk * 1.08); advance(b, .267); near(a.hp, 100000); advance(b, .1);
    const expected = u.base.atk * 1.08 * bb.atk_scale * .6;
    near(100000 - a.hp, expected); near(100000 - expanded.hp, expected);
    near(a.s.res, 40 * (1 + bb.magic_resistance)); assert.equal(u.skill.active, false);
    near(u.s.atk, u.base.atk * 1.04); advance(b, 6.1); near(a.s.res, 40);
  }
});

test('Leonhardt overlapping RES cuts choose strongest and preserve its remaining duration', () => {
  const { b, u } = make(lion, { skill: 1 }), target = b.enemies[0]; target.base.res = 60; target.markDirty();
  activate(u); advance(b, .4); near(target.s.res, 51);
  b.applyStrongest(target, 'leonhardt:res-down', { duration: 8, value: -.05, mods: v => ({ resMul: 1 + v }) });
  near(target.s.res, 51); advance(b, 6); near(target.s.res, 57); advance(b, 2.1); near(target.s.res, 60);
});

test('Iris and Leonhardt instant casts lock normal attacks through their original clips; Leonhardt cannot spend another stored charge early', () => {
  for (const [id, lock] of [[iris, .8], [lion, 1.067]]) {
    const { b, u } = make(id, { skill: 1, enemies: id === iris ? 3 : 1 }); u.atkCd = 0;
    const casts = []; b.on('attack', c => { if (c.attacker === u) casts.push([b.time, c.isSkill]); });
    u.skill.gainSp(u.skill.spCost * u.skill.maxCharges, 'test'); const start = b.time;
    assert.equal(b.activateOperator(id), true); advance(b, .5);
    assert.equal(casts.length, 1); assert.equal(casts[0][1], true);
    if (id === iris) u.skill.gainSp(u.skill.spCost, 'test');
    const charges = u.skill.charges;
    assert.equal(b.activateOperator(id), false); assert.equal(u.skill.charges, charges);
    advance(b, lock - .5 - b.dt); assert.equal(casts.length, 1);
    if (id === lion) {
      advance(b, b.dt * 2); assert.equal(b.activateOperator(id), true);
      assert.equal(u.skill.charges, charges - 1);
    }
    assert.ok(u.mem.casterCastUntil >= start + lock);
  }
});

test('Harmonie talent affects only blocked attack damage, uses elite/potential scale and does not scale fixed pool damage', () => {
  for (const [elite, potential, scale] of [[0, 1, 1], [1, 1, 1.12], [1, 5, 1.15], [2, 1, 1.17], [2, 5, 1.2]]) {
    const { b, u } = make(harmonie, { elite, potential, rank: 1 }), target = b.enemies[0];
    block(b, target); near(attack(b, u, target), u.s.atk * scale);
    target.blockedBy = null; near(attack(b, u, target), u.s.atk);
  }
  const { b, u } = make(harmonie, { skill: 1 }), target = b.enemies[0]; block(b, target); activate(u);
  near(100000 - target.hp, 250);
});

test('Harmonie S2 all ranks targets only blocked enemies, stores while unblocked and keeps already-fired shots after unblock', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(harmonie, { skill: 1, rank, enemies: 2 }), [a, z] = b.enemies;
    const interval = u.s.interval, bb = bbOf(src.operators[harmonie].skills[1].levels[rank - 1]); activate(u);
    near(u.s.interval, interval * bb.base_attack_time); assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []);
    advance(b, u.s.interval * 3 + b.dt); assert.equal(u.trait.stored, 3); block(b, a);
    assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), [a]);
    const hits = []; b.on('damaged', c => { if (c.source === u && c.dmg.isAttack) hits.push(c.amount); });
    b.forceAttack(u, [a]); advance(b, .633); a.blockedBy = null; advance(b, .2);
    assert.equal(hits.length, 4); near(hits.reduce((sum, v) => sum + v, 0), u.s.atk * 4);
    assert.equal(u.trait.stored, 0); assert.ok(z.hp < 100000); advance(b, 31); near(u.s.interval, interval);
  }
});

test('Harmonie pool has separate per-enemy one-second clocks, ground eligibility and immediate leave/end cleanup', () => {
  const { b, u } = make(harmonie, { skill: 1, enemies: 3 }), [a, hidden, air] = b.enemies;
  hidden.hidden = true; air.motion = 'FLY'; pin(b, air, 7, 2); b.step();
  a.base.moveSpeed = 1; a.markDirty(); activate(u); near(100000 - a.hp, 250); near(a.s.moveSpeed, .4);
  near(hidden.hp, 100000); near(air.hp, 100000); advance(b, .9); near(100000 - a.hp, 250);
  hidden.hidden = false; b.step(); near(100000 - hidden.hp, 250);
  advance(b, .1); near(100000 - a.hp, 500); near(100000 - hidden.hp, 250);
  pin(b, a, 0, 0); b.step(); near(a.s.moveSpeed, 1); const hp = a.hp; advance(b, 1.1); near(a.hp, hp);
  pin(b, a, 7, 2); b.step(); near(hp - a.hp, 250); near(a.s.moveSpeed, .4);
  u.skill.end('test'); near(a.s.moveSpeed, 1); const ends = a.hp; advance(b, 1.1); near(a.hp, ends);
});

test('Kjera terrain talent selects one replacement modifier by promotion/potential and two-LOWLAND threshold', () => {
  for (const [elite, potential, low, high] of [[0, 1, 0, 0], [1, 1, .05, .11], [1, 5, .08, .14], [2, 1, .1, .16], [2, 5, .13, .19]]) {
    for (const count of [0, 1, 2, 3]) {
      const { b, u } = make(kjera, { elite, potential, rank: 1, lowTiles: count }); b.rng.chance = () => false;
      near(u.s.atk, u.base.atk * (1 + (count >= 2 ? high : low)));
      near(attack(b, u, b.enemies[0]), u.s.atk * 1.2);
    }
  }
});

test('Kjera normal funnel ramps and resets by target; S1 all ranks scales both releases and restores ATK', () => {
  const x = make(kjera, { enemies: 2 }); x.b.rng.chance = () => false;
  for (const scale of [1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.1]) near(attack(x.b, x.u, x.b.enemies[0]), x.u.s.atk * scale);
  near(attack(x.b, x.u, x.b.enemies[1]), x.u.s.atk * 1.2);
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(kjera, { rank }); b.rng.chance = () => false; const atk = u.s.atk; activate(u);
    near(attack(b, u, b.enemies[0]), (atk + u.base.atk * bbOf(src.operators[kjera].skills[0].levels[rank - 1]).atk) * 1.2);
    advance(b, 31); near(u.s.atk, atk);
  }
});

test('Kjera S2 two drones obey original initial delay, independent ramps, target lock outside range and cleanup at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, src } = make(kjera, { skill: 1, rank }), target = b.enemies[0]; b.rng.chance = () => false;
    activate(u); const bb = bbOf(src.operators[kjera].skills[1].levels[rank - 1]);
    const hits = []; b.on('damaged', c => { if (c.source === u) hits.push([b.time, c.amount]); });
    b.forceAttack(u, [target]); advance(b, .9); assert.equal(hits.length, 1); near(hits[0][1], u.s.atk);
    advance(b, .167); assert.equal(hits.length, 3); near(hits[1][1], u.s.atk * .2); near(hits[2][1], u.s.atk * .2);
    pin(b, target, 0, 0); advance(b, u.s.interval + .1); assert.equal(hits.length, 5);
    near(hits[3][1], u.s.atk * .35); near(hits[4][1], u.s.atk * .35);
    assert.equal(u.mem.kjeraDrones.filter(Boolean).length, 2);
    u.skill.end('test'); assert.equal(u.mem.kjeraDrones.filter(Boolean).length, 0);
    const hp = target.hp; advance(b, 2); near(target.hp, hp);
    near(u.s.atk, u.base.atk * 1.16); assert.ok(bb['attack@cold'] > 0);
  }
});

test('Kjera S2 Cold rolls per actual hit, freeze follows repeated Cold and hidden periods never queue a return burst', () => {
  const { b, u } = make(kjera, { skill: 1 }), target = b.enemies[0]; const rolls = [];
  b.rng.chance = probability => { rolls.push(probability); return true; }; activate(u);
  b.forceAttack(u, [target]); advance(b, 1.1); assert.equal(rolls.length, 3); assert.deepEqual(rolls, [.22, .22, .22]);
  assert.ok(target.s.flags.cold); assert.ok(target.s.flags.freeze);
  b.rng.chance = () => false; target.hidden = true; const hp = target.hp; advance(b, 4); near(target.hp, hp);
  const hits = []; b.on('damaged', c => { if (c.source === u) hits.push(b.time); }); target.hidden = false;
  advance(b, .1); assert.equal(hits.length, 2); advance(b, .8); assert.equal(hits.length, 2);
  advance(b, u.s.interval); assert.equal(hits.length, 4);
});
