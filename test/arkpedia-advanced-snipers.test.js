// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-advanced-sniper-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { bodyInKeys } from '../server/sim/body.js';
import { canTargetEnemy, enemyStealthed } from '../server/sim/targeting.js';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';

const ids = ['char_118_yuki', 'char_440_pinecn', 'char_302_glaze', 'char_4062_totter'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const blackboard = (level) => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, { elite = 2, potential = 1, skill = 1, rank = elite === 2 ? 10 : elite === 1 ? 7 : 4, enemies = 1, seed = 1 } = {}) {
  const source = structuredClone(data), op = source.operators[id];
  assert.ok(op, `Missing verified advanced sniper ${id}`);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0 });
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel,
    potential, skillId: op.skills[skill - 1].id, skillRank: rank };
  const b = new StandardBattle(source, { operators: [build] }, { seed });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 1, 7, 'UP'); u.atkCd = 1000; b.step();
  for (const [index, target] of b.enemies.entries()) {
    target.x = 7 + ((index % 3) - 1) * .4;
    target.y = (id === 'char_4062_totter' ? 3 : 2) + Math.floor(index / 3) * .4;
    target.base.def = 100; target.base.res = 0;
    b.addBuff(target, { key: 'test:pin', persist: true, flags: { noMove: true } });
  }
  b.step();
  return { b, u, source, build, level: op.skills[skill - 1].levels[rank - 1] };
}
function activate(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  if (u.skill.manual) assert.equal(b.activateOperator(u.defId), true);
  else if (u.skill.rule === 'SP_FULL') { b.step(); assert.equal(u.skill.active, true); }
  else assert.equal(u.skill.onAboutToAttack(), true);
  u.atkCd = 1000;
}
function hit(b, u, target, seconds = 1.1) {
  const before = target.hp; assert.equal(b.forceAttack(u, [target]), true); advance(b, seconds);
  return before - target.hp;
}
function core() {
  const h = makeBattle({
    defs: { chess: { windup: chessRec({ id: 'windup', profession: 'SNIPER', stats: { atk: 300 },
      rangeGrid: [[0, 0], [0, 1], [0, 2]], skill: null }) },
      enemies: { enemy_windup_dummy: enemyRec({ key: 'enemy_windup_dummy', hp: 10000, def: 0, speed: 0 }) } },
    units: [{ chessId: 'windup', row: 11, col: 5 }], enemies: [{ key: 'enemy_windup_dummy', pos: [11, 7] }],
    content: 'none', autoFinish: false, hooks: ['attack', 'damaged'], captureNoisy: true,
  });
  h.step(); const u = h.unit('windup'), e = h.enemy('enemy_windup_dummy'); u.atkCd = 1000;
  u.profile.projectile = 'beam'; h.b.projectiles.clear();
  return { h, b: h.b, u, e };
}

test('attack windup is opt-in: existing attacks remain immediate and nonfinite delays do not hang', () => {
  for (const windup of [undefined, 0, NaN, Infinity]) {
    const { b, u, e } = core(), before = e.hp; u.profile.windup = windup;
    assert.equal(b.forceAttack(u, [e]), true); near(before - e.hp, u.s.atk);
    assert.equal(b.drainEvents().filter(ev => ev[0] === 'atk').at(-1).length, 4,
      'ordinary attacks preserve the original event tuple without extra metadata');
  }
});

test('optional split-hit scaling applies after DEF and the damage floor, with defensive SP only on the first hit', () => {
  for (const defense of [150, 10000]) {
    const { b, u, e, h } = core(), before = e.hp;
    e.base.def = defense; e.markDirty();
    Object.assign(u.profile, { hits: 2, atkScale: 1, hitDamageScale: .5, onlyFirstHitGainsSp: true });
    // A friendly target exercises the existing defensive-SP path independently
    // of Gravel's content installer; foes use the same two damage descriptors.
    e.side = 'ally'; e.skill = {}; let defensiveSp = 0;
    b._skills.onDamaged = target => { assert.equal(target, e); defensiveSp++; };
    b.forceAttack(u, [e]);
    near(before - e.hp, Math.max(u.s.atk - defense, u.s.atk * .05));
    const hits = h.hooksOf('damaged'); assert.equal(hits.length, 2);
    for (const hit of hits) { near(hit.dmg.amount, u.s.atk); near(hit.dmg.mul, .5); }
    assert.equal(hits[0].dmg.noSp, false); assert.equal(hits[1].dmg.noSp, true);
    assert.equal(defensiveSp, 1);
  }
  const { b, u, e, h } = core(), before = e.hp;
  u.profile.hits = 2; b.forceAttack(u, [e]);
  near(before - e.hp, u.s.atk * 2);
  assert.ok(h.hooksOf('damaged').every(hit => hit.dmg.mul === 1 && !hit.dmg.noSp));
});

test('explicit windup releases at its deadline and a brief control effect interrupts the unfired attack', () => {
  for (const interrupt of [false, true]) {
    const { b, u, e } = core(), before = e.hp; u.profile.windup = .5;
    assert.equal(b.forceAttack(u, [e]), true); near(e.hp, before);
    advance(b, .2); near(e.hp, before);
    if (interrupt) b.applyStatus(u, 'stun', { duration: .1 });
    advance(b, .5); near(before - e.hp, interrupt ? 0 : u.s.atk);
  }
});

test('withdrawal cancels an unfired attack, while a custom launched attack keeps one attack ID and ordinary hooks', () => {
  const cancelled = core(), before = cancelled.e.hp;
  cancelled.u.profile.windup = .5; cancelled.b.forceAttack(cancelled.u, [cancelled.e]);
  cancelled.b.retreat(cancelled.u); advance(cancelled.b, 1); near(cancelled.e.hp, before);
  const { h, b, u, e } = core(); let launches = 0, id;
  u.profile.launchAttack = (battle, source, profile, target, info) => {
    launches++; id = info.attackId; battle.dealDamage(source, target, {
      amount: 100, type: 'true', isAttack: true, attackId: id,
    });
  };
  const hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, 100); assert.equal(launches, 1);
  assert.ok(id > 0); assert.equal(h.hooksOf('attack').at(-1).attacker, u);
  assert.equal(h.hooksOf('damaged').at(-1).dmg.attackId, id);
});

test('source CAST target timing selects enemies at release instead of hitting one that already left', () => {
  const { h, b, u, e } = core(); u.profile.windup = .5; u.profile.retargetOnRelease = true;
  const other = h.spawn('enemy_windup_dummy', { pos: [11, 10] }); b.step();
  const before = [e.hp, other.hp]; b.forceAttack(u, [e]);
  e.x = 10; other.x = 6; b.step(); advance(b, .6);
  near(e.hp, before[0]); near(before[1] - other.hp, u.s.atk);
});

test('original evidence preserves flat BAT, Pinecone cast timing/front grid and Shirayuki moving projectile parameters', () => {
  assert.equal(evidence.sourceBundles.length, 6);
  const yuki = evidence.shirayuki.talentBuffs.flatMap(row => row.buffs).find(b => b.buffKey === 'yuki_t_1');
  assert.equal(yuki.attributeModifiers.find(m => m.attributeType === 8).formulaItem, 0);
  const ambriel = evidence.ambriel.skills.skchr_glaze_2[0].buffs[0];
  assert.equal(ambriel.attributeModifiers.find(m => m.attributeType === 8).formulaItem, 0);
  near(evidence.pinecone.preDelay, .533, 1e-6);
  assert.equal(evidence.pinecone.frontRange.rangeId, '1-3'); assert.equal(evidence.pinecone.frontRange.grid.length, 4);
  assert.equal(evidence.shirayuki.projectile.radius, .75); assert.equal(evidence.shirayuki.projectile.speed, 8);
  assert.equal(evidence.shirayuki.projectile.hitCooldown, 1); assert.equal(evidence.shirayuki.projectile.dwell, 2);
  assert.equal(evidence.shirayuki.projectile.stopWhenSourceInvalid, 0);
  assert.deepEqual(evidence.ambriel.hits.Attack, [.6]); assert.deepEqual(evidence.ambriel.hits.Skill, [.9]);
  assert.deepEqual(evidence.ambriel.hits.Attack, evidence.ambriel.backHits.Attack);
  assert.deepEqual(evidence.ambriel.hits.Skill, evidence.ambriel.backHits.Skill);
  assert.ok(evidence.totter.selectors.some(s => s._postFilter === 27 && s._maxNum === 3));
});

test('all four advanced snipers use both exact source skills and all ranks, preserving unlocked trait geometry', () => {
  for (const id of ids) {
    const op = data.operators[id]; assert.ok(op, id); assert.equal(op.skills.length, 2);
    for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
      const { build, source } = make(id, { skill, rank, enemies: 0 });
      assert.equal(recordFor(build, source).skill.skillId, op.skills[skill - 1].id);
    }
    assert.throws(() => recordFor({ ...defaultBuild(op), elite: 0, level: 45,
      skillId: op.skills[1].id, skillRank: 4 }, data), /Unavailable skill/);
  }
  const { u } = make('char_440_pinecn');
  assert.deepEqual(u.profile.frontGrid, evidence.pinecone.frontRange.grid);
});

test('Shirayuki gets E2 ATK plus flat 0.2-second BAT, and Shuriken extends only the running skill range', () => {
  for (const [elite, atk, extra] of [[0, 0, 0], [1, 0, 0], [2, .2, .2]]) {
    const { b, u } = make('char_118_yuki', { elite, enemies: 0 });
    near(u.s.atk, u.base.atk * (1 + atk)); near(u.s.bat, u.base.bat + extra);
    const normal = [...u.rangeKeys]; activate(b, u);
    assert.ok(u.rangeKeys.length > normal.length); assert.equal(u.skill.spec.targeting.rangeExtend, 2);
    advance(b, u.skill.duration + .1); assert.deepEqual(u.rangeKeys, normal);
  }
});

test('Fatal Shuriken deals repeated Arts collision damage and percentage Slow, independently per projectile at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_118_yuki', { skill: 2, rank, enemies: 2 });
    const bb = blackboard(level), [first, second] = b.enemies;
    for (const e of b.enemies) { e.base.moveSpeed = 1; e.base.res = 25; e.markDirty(); }
    const before = b.enemies.map(e => e.hp); activate(b, u); b.forceAttack(u, [first]);
    advance(b, .8);
    const oneHit = u.s.atk * bb['attack@atk_scale'] * .75;
    near(before[0] - first.hp, oneHit); near(before[1] - second.hp, oneHit);
    near(first.s.moveSpeed, 1 + bb['attack@move_speed']); assert.equal(first.findBuff('sluggish'), null);
    advance(b, 1); near(before[0] - first.hp, oneHit * 2);
    advance(b, 2); assert.equal(first.findBuff('shirayuki:slow'), null);
  }
});

test('a flying shuriken survives retreat, keeps its stopped location, and does not hit invisible or out-of-radius enemies', () => {
  const { b, u } = make('char_118_yuki', { skill: 2, enemies: 3 });
  const [target, stealth, outside] = b.enemies;
  stealth.x = target.x; stealth.y = target.y;
  b.addBuff(stealth, { key: 'test:hidden', persist: true, flags: { stealth: true } });
  outside.x = target.x + 1.5; const initial = b.enemies.map(e => e.hp);
  activate(b, u); b.forceAttack(u, [target]); advance(b, .7);
  const struck = target.hp; b.retreatOperator(u.defId); advance(b, 1);
  assert.ok(target.hp < struck); near(stealth.hp, initial[1]); near(outside.hp, initial[2]);
});

test('Shirayuki projectile presentation follows the same source flight, stopped dwell and retreat lifetime', () => {
  const { b, u } = make('char_118_yuki', { skill: 2 });
  const target = b.enemies[0]; target.x = 7; target.y = 4; b.step();
  activate(b, u); b.drainEvents(); b.forceAttack(u, [target]);
  const event = b.drainEvents().find(ev => ev[0] === 'atk');
  assert.equal(event[4].projectile, 'tracked');
  assert.equal(b.regularVisualProjectiles?.size ?? 0, 0, 'no marker before actual release');
  advance(b, .6);
  const [marker] = b.regularVisualProjectiles; assert.ok(marker);
  near(marker.x, 7); assert.ok(marker.y > 1 && marker.y < 4);
  b.retreatOperator(u.defId); advance(b, .4);
  near(marker.x, 7); near(marker.y, 4);
  target.x = 2; target.y = 2; b.step(); advance(b, 1);
  assert.equal(b.regularVisualProjectiles.has(marker), true);
  near(marker.x, 7); near(marker.y, 4);
  advance(b, 1.2); assert.equal(b.regularVisualProjectiles.size, 0);
});

test('Pinecone front-row multiplier covers all three source front tiles, not her entire forward line', () => {
  const { b, u } = make('char_440_pinecn', { enemies: 4 });
  const [left, middle, right, far] = b.enemies;
  left.x = 6; middle.x = 7; right.x = 8; far.x = 7; far.y = 3; b.step();
  const before = b.enemies.map(e => e.hp); b.forceAttack(u); advance(b, .5);
  for (let i = 0; i < 3; i++) near(before[i] - b.enemies[i].hp, u.s.atk * 1.5 - 100);
  near(before[3] - far.hp, u.s.atk - 100);
});

test('Pinecone RMA Spikes fire independently after the prefab delay, ignore only this shot DEF, and preserve stored charges', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_440_pinecn', { rank, enemies: 2 });
    const bb = blackboard(level), target = b.enemies[0], before = target.hp;
    target.base.def = 500; target.markDirty();
    u.skill.gainSp(u.skill.spCost * 3, 'test'); const charges = u.skill.charges;
    assert.equal(b.activateOperator(u.defId), true); assert.equal(u.skill.charges, charges - 1);
    const normalCd = u.atkCd, sp = u.skill.spTotal;
    advance(b, .5); near(target.hp, before); near(u.skill.spTotal, sp);
    advance(b, .1); near(before - target.hp, u.s.atk * 1.5 * bb.atk_scale - (500 - bb.def_penetrate_fixed));
    assert.equal(u.skill.active, false); near(u.s.defIgnoreFlat, 0);
    assert.ok(u.atkCd <= normalCd && u.atkCd > normalCd - 1, 'normal cooldown was not replaced by a full new interval');
    const hp = target.hp; b.forceAttack(u, [target]); advance(b, .5);
    near(hp - target.hp, u.s.atk * 1.5 - 500);
  }
});

test('Pinecone deployment SP talent lasts 60 seconds and uses the correct elite/potential values', () => {
  for (const [elite, potential, rate] of [[0, 1, 1], [1, 1, 1.2], [1, 5, 1.25], [2, 1, 1.45], [2, 5, 1.5]]) {
    const { b, u } = make('char_440_pinecn', { elite, potential, enemies: 0 });
    near(u.s.spRecovery, rate); advance(b, 60.1); near(u.s.spRecovery, 1);
  }
});

test('Electrical Overcharge automatically activates at full SP, shrinks to the front row and advances four source ATK buffs', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_440_pinecn', { skill: 2, rank, enemies: 0 });
    const bb = blackboard(level), range = [...u.rangeKeys];
    for (let cast = 0; cast < 5; cast++) {
      activate(b, u); near(u.s.atk, u.base.atk * (1 + bb[`pinecn_s_2[${'abcd'[Math.min(cast, 3)]}].atk`]));
      assert.equal(u.rangeKeys.length, 4); assert.equal(u.skill.activations, cast + 1);
      advance(b, level.duration + .1); near(u.s.atk, u.base.atk); assert.deepEqual(u.rangeKeys, range);
    }
  }
});

test('Ambriel S1 expands range, Slows only skill hits and can proc E2 Stun outside her original range', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_302_glaze', { rank });
    const target = b.enemies[0], bb = blackboard(level); target.x = 6; target.y = 5;
    b.step(); assert.equal(bodyInKeys(target, u.baseRangeKeys), false);
    const range = [...u.rangeKeys]; activate(b, u); assert.ok(u.rangeKeys.length > range.length);
    let rolls = 0; b.rng.chance = probability => { near(probability, .25); rolls++; return true; };
    hit(b, u, target); assert.equal(rolls, 1); assert.ok(target.findBuff('stun')); assert.ok(target.findBuff('sluggish'));
    advance(b, level.duration + .1); assert.deepEqual(u.rangeKeys, range);
  }
});

test('Radar Sweep has global targeting, flat BAT, low-DEF priority and the actual longer far-target windup without a projectile', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_302_glaze', { skill: 2, rank, enemies: 2 });
    const bb = blackboard(level), [nearby, distant] = b.enemies, atk = u.s.atk;
    nearby.x = 7; nearby.y = 2; nearby.base.def = 100;
    distant.x = 2; distant.y = 4; distant.base.def = 50; distant.markDirty(); b.step();
    activate(b, u); near(u.s.atk, atk * (1 + bb.atk)); near(u.s.bat, u.base.bat + .9);
    assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], distant);
    b.rng.chance = () => false; const before = distant.hp; b.drainEvents(); b.forceAttack(u, [distant]);
    const farEvent = b.drainEvents().find(ev => ev[0] === 'atk');
    assert.deepEqual(farEvent.slice(0, 4), ['atk', u.id, distant.id, 'none']);
    assert.deepEqual(farEvent[4], { windup: .9, animation: 'skill', projectile: 'none' });
    advance(b, .8); near(distant.hp, before); assert.equal(b.projectiles.list.length, 0);
    advance(b, .2); near(before - distant.hp, u.s.atk - distant.s.def);
    const hp = nearby.hp; b.drainEvents(); b.forceAttack(u, [nearby]);
    const nearEvent = b.drainEvents().find(ev => ev[0] === 'atk');
    assert.deepEqual(nearEvent.slice(0, 4), ['atk', u.id, nearby.id, 'arrow']);
    assert.deepEqual(nearEvent[4], { windup: .6, animation: 'attack', projectile: 'tracked' });
    advance(b, .5); near(nearby.hp, hp);
    advance(b, .3); near(hp - nearby.hp, u.s.atk - nearby.s.def);
    advance(b, level.duration + .1); near(u.s.atk, atk); near(u.s.bat, u.base.bat);
    assert.equal(acquireTargets(b, u, effectiveProfile(u)).includes(distant), false);
  }
});

test('Ambriel Stun talent respects promotion/potential and never applies to attacks within her original range', () => {
  for (const [elite, potential, probability] of [[1, 1, 0], [2, 1, .25], [2, 5, .28]]) {
    const { b, u } = make('char_302_glaze', { elite, potential }); const target = b.enemies[0];
    let rolls = 0; b.rng.chance = p => { near(p, probability); rolls++; return true; };
    hit(b, u, target); assert.equal(rolls, 0); assert.equal(target.findBuff('stun'), null);
  }
});

test('Totter alone ignores stealth and gains one multiplicative talent buff for invisible enemies in range', () => {
  for (const [elite, potential, percent] of [[0, 1, .04], [0, 5, .07], [1, 1, .1], [1, 5, .13], [2, 1, .17], [2, 5, .2]]) {
    const { b, u } = make('char_4062_totter', { elite, potential, enemies: 2 }); const [first, second] = b.enemies;
    for (const e of b.enemies) b.addBuff(e, { key: 'test:stealth', persist: true, flags: { stealth: true } });
    advance(b, .2); near(u.s.atk, u.base.atk * (1 + percent));
    assert.equal(enemyStealthed(first), true); assert.equal(canTargetEnemy(u, first, { canHitFly: true }), false);
    assert.equal(canTargetEnemy(u, first, u.profile), true); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
    first.base.massLevel = 1; second.base.massLevel = 5; first.markDirty(); second.markDirty();
    assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], second);
    const before = second.hp; hit(b, u, second); assert.ok(second.hp < before); assert.equal(enemyStealthed(second), true);
    for (const e of b.enemies) b.addBuff(e, { key: 'test:reveal', flags: { reveal: true } });
    advance(b, .2); near(u.s.atk, u.base.atk); assert.equal(u.findBuff('totter:eyes'), null);
  }
});

test('Sunpiercer hits two distinct heavy enemies with one source-scaled attack at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_4062_totter', { rank, enemies: 3 }); const bb = blackboard(level);
    for (const [i, e] of b.enemies.entries()) { e.base.massLevel = i; e.markDirty(); }
    activate(b, u); const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 2);
    const before = b.enemies.map(e => e.hp); b.forceAttack(u, targets); advance(b, .6);
    for (const [i, e] of b.enemies.entries()) near(before[i] - e.hp, targets.includes(e) ? u.s.atk * bb.atk_scale - e.s.def : 0);
    assert.equal(u.skill.active, false); assert.equal(u.skill.spTotal, 0);
  }
});

test('Prism Break targets up to three and only scales a shot selected against one enemy, then restores ASPD', () => {
  for (let rank = 1; rank <= 10; rank++) for (const count of [1, 2, 3, 4]) {
    const { b, u, level } = make('char_4062_totter', { skill: 2, rank, enemies: count }); const bb = blackboard(level);
    activate(b, u); near(u.s.aspd, u.base.aspd + bb.attack_speed);
    const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, Math.min(count, 3));
    const before = b.enemies.map(e => e.hp); b.forceAttack(u, targets); advance(b, .6);
    for (const [i, e] of b.enemies.entries()) near(before[i] - e.hp,
      targets.includes(e) ? u.s.atk * (count === 1 ? bb['attack@s2c.atk_scale'] : 1) - e.s.def : 0);
    advance(b, level.duration + .1); near(u.s.aspd, u.base.aspd);
  }
});
