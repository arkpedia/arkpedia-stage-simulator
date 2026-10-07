// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-sniper-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const ids = ['char_235_jesica', 'char_126_shotst', 'char_190_clour', 'char_133_mm'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const blackboard = (level) => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));
function make(id, { elite = 2, potential = 1, skill = 1, rank = elite === 2 ? 10 : elite === 1 ? 7 : 4, enemies = 1, seed = 1 } = {}) {
  const source = structuredClone(data), op = source.operators[id];
  assert.ok(op, `Missing registered sniper ${id}`);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0 });
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel,
    potential, skillId: op.skills[skill - 1].id, skillRank: rank };
  const b = new StandardBattle(source, { operators: [build] }, { seed });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 1, 7, 'UP'); u.atkCd = 100; b.step();
  for (const [index, target] of b.enemies.entries()) {
    target.x = 6 + index * .4; target.y = 2; target.base.def = 100; target.base.res = 0;
    b.addBuff(target, { key: 'test:pin', persist: true, flags: { noMove: true } });
  }
  b.step();
  return { b, u, source, build, level: op.skills[skill - 1].levels[rank - 1] };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function activate(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  if (u.skill.manual) assert.equal(b.activateOperator(u.defId), true);
  else assert.equal(u.skill.onAboutToAttack(), true);
}
function hit(b, u, target) {
  const before = target.hp; assert.equal(b.forceAttack(u, [target]), true); advance(b, .5);
  return before - target.hp;
}

test('source prefab evidence proves dodge masks, Meteor target count and multiplicative DEF, and May percentage BAT', () => {
  assert.equal(evidence.sourceBundles.length, 5);
  assert.equal(evidence.jessica.evadeTemplate.eventToActions.ON_TAKE_DAMAGE[0]._damageMask, 'PHYSICAL_AND_MAGICAL');
  assert.equal(evidence.meteor.s2Selector.maxNum, 5);
  assert.equal(evidence.meteor.s1[0].buffs[0].attributeModifiers[0].formulaItem, 3);
  assert.equal(evidence.meteor.s1[0].buffs[0].attributeModifiers[0].attributeType, 2);
  assert.equal(evidence.may.s2[0].buffs[0].attributeModifiers[0].attributeType, 8);
  assert.equal(evidence.may.s2[0].buffs[0].attributeModifiers[0].formulaItem, 1);
  assert.equal(evidence.vermeil.talent[0].buffs[0].attributeModifiers[0].attributeType, 14);
});

test('all four snipers select both real skills, all source ranks and only unlocked promotions', () => {
  for (const id of ids) {
    const op = data.operators[id]; assert.ok(op, id);
    assert.equal(op.skills.length, 2); assert.equal(defaultBuild(op).skillRank, 10);
    for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
      const { source, build } = make(id, { skill, rank, enemies: 0 });
      assert.equal(recordFor(build, source).skill.skillId, op.skills[skill - 1].id);
    }
    assert.throws(() => recordFor({ ...defaultBuild(op), elite: 0, level: 45, skillId: op.skills[1].id, skillRank: 4 }, data), /Unavailable skill/);
  }
});

test('Jessica talent grants source ASPD by promotion, and each Power Strike rank modifies one attack without refunding its attack SP', () => {
  const id = 'char_235_jesica';
  for (const [elite, speed] of [[0, 0], [1, 6], [2, 12]]) {
    const { u } = make(id, { elite }); near(u.s.aspd, u.base.aspd + speed);
  }
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make(id, { rank }), target = b.enemies[0];
    const bb = blackboard(level);
    near(hit(b, u, target), u.s.atk - target.s.def);
    assert.equal(u.skill.spTotal, 1);
    activate(b, u);
    assert.equal(u.skill.active, true);
    near(hit(b, u, target), u.s.atk * bb.atk_scale - target.s.def);
    assert.equal(u.skill.active, false); assert.equal(u.skill.spTotal, 0);
    near(hit(b, u, target), u.s.atk - target.s.def);
    assert.equal(u.skill.spTotal, 1);
  }
});

test('Jessica Smokescreen buffs ATK at every rank, dodges physical and Arts with 75% chance, never true damage, and restores stats', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_235_jesica', { skill: 2, rank, enemies: 0 });
    const atk = u.s.atk, bb = blackboard(level); activate(b, u);
    near(u.s.atk, atk * (1 + bb.atk)); near(u.s.dodgePhys, .75); near(u.s.dodgeArts, .75);
    if (rank === 10) for (const proc of [true, false]) {
      b.rng = () => proc ? .749999 : .75;
      for (const type of ['phys', 'arts', 'true']) {
        u.hp = u.s.maxHp;
        const dealt = b.dealDamage(null, u, { amount: 500, type });
        assert.equal(dealt === 0, proc && type !== 'true');
      }
    }
    advance(b, level.duration + .1); near(u.s.atk, atk);
    near(u.s.dodgePhys, 0); near(u.s.dodgeArts, 0);
  }
});

test('Meteor anti-air talent scales ATK before DEF only for aerial targets at the source elite and potential thresholds', () => {
  const id = 'char_126_shotst';
  for (const [elite, potential, scale] of [[0, 1, 1], [1, 1, 1.2], [1, 6, 1.25], [2, 1, 1.35], [2, 6, 1.4]]) {
    const { b, u } = make(id, { elite, potential, enemies: 2 });
    const [ground, air] = b.enemies; air.motion = 'FLY'; b.step();
    assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], air);
    near(hit(b, u, ground), u.s.atk - ground.s.def);
    near(hit(b, u, air), u.s.atk * scale - air.s.def);
  }
});

test('Meteor Armor Breaker reduces only target DEF multiplicatively, refreshes without stacking and expires at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_126_shotst', { rank }), target = b.enemies[0];
    const bb = blackboard(level), ownDef = u.s.def;
    activate(b, u); near(hit(b, u, target), u.s.atk * bb.atk_scale - 100 * (1 + bb.def));
    near(target.s.def, 100 * (1 + bb.def)); near(u.s.def, ownDef);
    activate(b, u); hit(b, u, target);
    assert.equal(target.buffs.filter((buff) => buff.key.startsWith('meteor:def:')).length, 1);
    near(target.s.def, 100 * (1 + bb.def));
    advance(b, bb.duration + .1); near(target.s.def, 100);
  }
});

test('Meteor Spread hits at most five distinct targets, keeps its aerial modifier, leaves a sixth untouched and preserves fired effects on retreat', () => {
  const { b, u, level } = make('char_126_shotst', { skill: 2, enemies: 6 });
  const bb = blackboard(level); b.enemies[0].motion = 'FLY'; b.step();
  activate(b, u);
  const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 5);
  const before = b.enemies.map((target) => target.hp);
  assert.equal(b.forceAttack(u, targets), true); assert.equal(u.skill.active, false);
  b.retreatOperator(u.defId); advance(b, .5);
  for (const [i, target] of b.enemies.entries()) {
    if (targets.includes(target)) {
      near(target.s.def, 100 * (1 + bb.def));
      near(before[i] - target.hp, u.base.atk * bb.atk_scale * (target.isFlying ? 1.35 : 1) - target.s.def);
    } else near(before[i] - target.hp, 0);
  }
});

test('Vermeil gains 15/30% faster time SP from her promotion talent and cannot recover SP during either active skill', () => {
  for (const [elite, recovery] of [[0, 1], [1, 1.15], [2, 1.3]]) for (const skill of elite ? [1, 2] : [1]) {
    const { b, u } = make('char_190_clour', { elite, skill, enemies: 0 });
    near(u.s.spRecovery, recovery);
    const sp = u.skill.spTotal; advance(b, 2); near(u.skill.spTotal - sp, recovery * 2);
    activate(b, u); advance(b, 2); near(u.skill.spTotal, 0);
  }
});

test('Vermeil Double Shot attacks two distinct targets without splash, then restores single-target and ATK at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_190_clour', { skill: 2, rank, enemies: 3 });
    const bb = blackboard(level), atk = u.s.atk;
    assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
    activate(b, u); near(u.s.atk, atk * (1 + bb.atk));
    const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 2);
    const before = b.enemies.map((target) => target.hp); b.forceAttack(u, targets); advance(b, .5);
    assert.equal(b.enemies.filter((target, i) => target.hp < before[i]).length, 2);
    advance(b, level.duration + .1); near(u.s.atk, atk);
    assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
  }
});

test('May has her source ATK/ASPD talent and Paralyzing Shell affects one skill attack, including its Slow after instant completion', () => {
  for (const [elite, potential, atk, aspd] of [[0, 1, 0, 0], [1, 1, .04, 4], [1, 6, .05, 5], [2, 1, .07, 7], [2, 6, .08, 8]]) {
    const { u } = make('char_133_mm', { elite, potential });
    near(u.s.atk, u.base.atk * (1 + atk)); near(u.s.aspd, u.base.aspd + aspd);
  }
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, level } = make('char_133_mm', { rank }), target = b.enemies[0];
    const bb = blackboard(level); target.base.moveSpeed = 1; target.markDirty(); activate(b, u);
    near(hit(b, u, target), u.s.atk * bb.atk_scale - target.s.def);
    assert.equal(u.skill.active, false); assert.ok(target.findBuff('sluggish'));
    near(target.s.moveSpeed, target.base.moveSpeed * .2);
    advance(b, bb.sluggish + .1); assert.equal(target.findBuff('sluggish'), null);
    hit(b, u, target); assert.equal(target.findBuff('sluggish'), null);
  }
});

test('May Binding Shock always Slows, independently rolls 30% Stun, uses percentage BAT and restores all stats', () => {
  for (let rank = 1; rank <= 10; rank++) for (const proc of rank === 10 ? [false, true] : [false]) {
    const { b, u, level } = make('char_133_mm', { skill: 2, rank }), target = b.enemies[0];
    const bb = blackboard(level), atk = u.s.atk, bat = u.s.bat, aspd = u.s.aspd;
    activate(b, u); near(u.s.atk, atk + u.base.atk * bb.atk);
    near(u.s.bat, bat * 1.5); near(u.s.interval, bat * 1.5 * 100 / aspd);
    let rolls = 0; b.rng.chance = (prob) => { near(prob, .3); rolls++; return proc; };
    hit(b, u, target);
    assert.equal(rolls, 1); assert.ok(target.findBuff('sluggish'));
    assert.equal(!!target.findBuff('stun'), proc);
    advance(b, Math.max(bb['attack@sluggish'], bb['attack@stun']) + .1);
    assert.equal(target.findBuff('sluggish'), null); assert.equal(target.findBuff('stun'), null);
    advance(b, level.duration + .1); near(u.s.atk, atk); near(u.s.bat, bat);
  }
});
