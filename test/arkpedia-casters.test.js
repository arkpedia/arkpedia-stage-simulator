import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-caster-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const ids = ['char_141_nights', 'char_109_fmout', 'char_253_greyy'];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const blackboard = (level) => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));

function make(id, { elite = 2, level, potential = 1, skill = 1, rank = 10, enemies = 0, seed = 1 } = {}) {
  const source = structuredClone(data), op = source.operators[id];
  assert.ok(op, `Missing supported snapshot operator ${id}`);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0 });
  const build = { ...defaultBuild(op), elite, level: level ?? op.phases[elite].maxLevel,
    potential, skillId: op.skills[skill - 1].id, skillRank: rank };
  const b = new StandardBattle(source, { operators: [build] }, { seed });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  return { b, source, build };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function deploy(b, id) {
  const u = b.deployOperator(id, 1, 7, 'UP'); u.atkCd = 100; b.step(); return u;
}
function pin(b, enemy, x, y, res = 0) {
  enemy.x = x; enemy.y = y; enemy.base.def = 100000; enemy.base.res = res;
  b.addBuff(enemy, { key: 'test:pin', flags: { noMove: true }, persist: true });
}
function activate(b, id, u) {
  u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(b.activateOperator(id), true);
}

test('caster source evidence records the distinct selectors and Haze RES multiplier', () => {
  assert.equal(evidence.sourceBundles.length, 5);
  assert.equal(evidence.haze.additiveActiveBuffs[0].attributes.attributeModifiers[0].formulaItem, 3);
  near(evidence.gitano.normalAttack.selectorRadius, 1.1);
  assert.equal(evidence.gitano.destinyAttack.limitTargetNum, 0);
  assert.equal(evidence.gitano.afterSkill[0].durationKey, 'time');
  assert.deepEqual(evidence.gitano.afterSkill[0].attributes.abnormalFlags, [0]);
  assert.equal(evidence.greyy.projectileHitRadius, 1);
  assert.equal(evidence.greyy.s2AttackModeIndex, 1);
});

test('all three casters select both source skills and S1 modifiers expire correctly at every rank including masteries', () => {
  for (const id of ids) for (let rank = 1; rank <= 10; rank++) {
    const { b, source, build } = make(id, { rank }), u = deploy(b, id);
    const baseline = { atk: u.s.atk, aspd: u.s.aspd }, level = source.operators[id].skills[0].levels[rank - 1];
    const bb = blackboard(level);
    assert.equal(recordFor(build, source).skill.skillId, source.operators[id].skills[0].id);
    activate(b, id, u);
    near(u.s.atk, baseline.atk + u.base.atk * (bb.atk ?? 0));
    near(u.s.aspd, baseline.aspd + (bb.attack_speed ?? 0));
    advance(b, level.duration + 0.1);
    near(u.s.atk, baseline.atk); near(u.s.aspd, baseline.aspd);
    assert.equal(u.skill.active, false);
  }
});

test('Haze applies her source RES reduction to the hit itself, refreshes one nonstacking debuff, and loses it after one second', () => {
  const id = 'char_141_nights';
  for (const [elite, potential, reduction] of [[0, 1, 0], [1, 1, 0.1], [1, 6, 0.13], [2, 1, 0.2], [2, 6, 0.23]]) {
    const { b } = make(id, { elite, potential, rank: elite === 0 ? 4 : 7, enemies: 1 });
    const u = deploy(b, id), target = b.enemies[0]; pin(b, target, 7, 2, 50);
    let dealt = 0; b.on('damaged', (ctx) => { if (ctx.source === u) dealt += ctx.amount; });
    b.forceAttack(u, [target]); advance(b, 0.5);
    near(dealt, u.s.atk * (1 - 0.5 * (1 - reduction)));
    near(target.s.res, 50 * (1 - reduction));
    b.forceAttack(u, [target]); advance(b, 0.5);
    assert.equal(target.buffs.filter(x => x.key === 'haze:res').length, reduction ? 1 : 0);
    near(target.s.res, 50 * (1 - reduction));
    advance(b, 1.1); near(target.s.res, 50);
  }
});

test('Haze Crimson Eyes lowers max HP rather than dealing HP loss, preserves HP ratio, and restores all stats on expiry at every rank', () => {
  const id = 'char_141_nights';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill: 2, rank }), u = deploy(b, id);
    const level = source.operators[id].skills[1].levels[rank - 1], bb = blackboard(level);
    u.hp = u.s.maxHp / 2; const original = { hp: u.hp, maxHp: u.s.maxHp, atk: u.s.atk, aspd: u.s.aspd };
    let losses = 0; b.on('damaged', ({ target }) => { if (target === u) losses++; });
    activate(b, id, u);
    near(u.s.maxHp, original.maxHp * 0.25); near(u.hp, original.hp * 0.25);
    near(u.hpRatio, 0.5); near(u.s.atk, original.atk * (1 + bb.atk));
    near(u.s.aspd, original.aspd + bb.attack_speed);
    advance(b, level.duration + 0.1);
    near(u.s.maxHp, original.maxHp); near(u.hp, original.hp);
    near(u.s.atk, original.atk); near(u.s.aspd, original.aspd); assert.equal(losses, 0);
  }
});

test('Gitano Divination rolls exactly one permanent deployment buff, is seeded, and is absent before E1', () => {
  const id = 'char_109_fmout';
  const results = new Set();
  for (const [roll, expected] of [[0, 'aspd'], [0.34, 'atkPct'], [0.99999, 'hpPct']]) {
    const { b, source, build } = make(id, { potential: 6 }); b.rng = () => roll;
    const u = deploy(b, id), talent = recordFor(build, source).talents[0].bb;
    assert.equal(u.mem.divination, expected); results.add(expected);
    near(u.s.atk, u.base.atk * (expected === 'atkPct' ? 1 + talent.atk : 1));
    near(u.s.maxHp, u.base.maxHp * (expected === 'hpPct' ? 1 + talent.max_hp : 1));
    near(u.s.aspd, u.base.aspd + (expected === 'aspd' ? talent.attack_speed : 0));
    near(u.hp, u.s.maxHp); advance(b, 40);
    assert.equal(u.findBuff('gitano:divination').timeLeft, Infinity);
  }
  assert.equal(results.size, 3);
  const first = make(id, { seed: 419 }), second = make(id, { seed: 419 });
  assert.equal(deploy(first.b, id).mem.divination, deploy(second.b, id).mem.divination);
  const { b } = make(id, { elite: 0, rank: 4 });
  const u = deploy(b, id); assert.equal(u.mem.divination, undefined);
  near(u.s.atk, u.base.atk); near(u.s.maxHp, u.base.maxHp); near(u.s.aspd, u.base.aspd);
});

test('Gitano Destiny hits every target in expanded range once, avoids overlapping splash, and applies rank-specific post-skill stun while SP recovers', () => {
  const id = 'char_109_fmout';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill: 2, rank, enemies: 4 }), u = deploy(b, id);
    const [a, overlap, extended, outside] = b.enemies;
    pin(b, a, 7, 2); pin(b, overlap, 7.2, 2); pin(b, extended, 7, 4); pin(b, outside, 4, 2);
    b.step(); // Refresh the spatial target index after arranging the test enemies.
    const initialKeys = [...u.rangeKeys], before = b.enemies.map(e => e.hp);
    assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
    activate(b, id, u); const active = effectiveProfile(u);
    assert.equal(active.allInRange, true); assert.equal(active.splashRadius, 0);
    const targets = acquireTargets(b, u, active); assert.deepEqual(new Set(targets), new Set([a, overlap, extended]));
    const atk = u.s.atk; b.forceAttack(u, targets);
    for (let i = 0; i < 3; i++) near(before[i] - b.enemies[i].hp, atk);
    near(outside.hp, before[3]);
    const level = source.operators[id].skills[1].levels[rank - 1], bb = blackboard(level);
    advance(b, level.duration + 0.05);
    assert.equal(u.skill.active, false); assert.equal(u.canAct, false);
    near(u.findBuff('stun').duration, bb.time); assert.deepEqual(u.rangeKeys, initialKeys);
    const sp = u.skill.spTotal; advance(b, bb.time - 0.2);
    assert.equal(u.canAct, false); assert.ok(u.skill.spTotal > sp);
    advance(b, 0.3); assert.equal(u.canAct, true);
  }
});

test('Greyy damages and Slows every splash victim inside the verified 1.0 radius, then S2 scales duration for ranks 1 through M3', () => {
  const id = 'char_253_greyy';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill: 2, rank, enemies: 3 }), u = deploy(b, id);
    const [a, nearby, outside] = b.enemies;
    pin(b, a, 7, 2); pin(b, nearby, 7.9, 2); pin(b, outside, 8.05, 2);
    const applied = []; b.on('statusApplied', (ctx) => { if (ctx.source === u) applied.push(ctx); });
    const before = b.enemies.map(e => e.hp); b.forceAttack(u, [a]); advance(b, 0.5);
    near(before[0] - a.hp, u.s.atk); near(before[1] - nearby.hp, u.s.atk); near(outside.hp, before[2]);
    assert.equal(applied.length, 2); for (const ctx of applied) near(ctx.duration, 0.6);
    applied.length = 0; const bb = blackboard(source.operators[id].skills[1].levels[rank - 1]);
    const aspd = u.s.aspd; activate(b, id, u); near(u.s.aspd, aspd + bb.attack_speed);
    // Fire just before S2 ends; the projectile must retain its enhanced talent.
    u.skill.timeLeft = 0.01; b.forceAttack(u, [a]); advance(b, 0.5);
    assert.equal(u.skill.active, false); near(u.s.aspd, aspd);
    assert.equal(applied.length, 2); for (const ctx of applied) near(ctx.duration, 0.6 * bb.talent_scale);
    assert.equal(outside.findBuff('sluggish'), null);
  }
});
