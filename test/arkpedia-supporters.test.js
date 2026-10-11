// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-support-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';

const earthspirit = 'char_183_skgoat', podenco = 'char_258_podego';
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const bbOf = level => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));
function make(ids, overrides = {}, enemies = 0) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0, def: 100000, magicResistance: 0 });
  const builds = ids.map(id => ({ ...defaultBuild(source.operators[id]), ...overrides[id] }));
  const b = new StandardBattle(source, { operators: builds }); b.autoFinish = false;
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99); return { b, source };
}
function deploy(b, id, row = 1, col = 7, dir = 'UP') {
  b.addDp('arkpedia', 99); const u = b.deployOperator(id, row, col, dir); u.atkCd = 100; return u;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step(); assert.deepEqual(b.errors, []);
}
function pin(b, enemy, x = 7, y = 2) {
  enemy.x = x; enemy.y = y;
  b.addBuff(enemy, { key: 'test:pin', flags: { noMove: true, disarm: true }, persist: true });
}
function activate(b, u) { u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(b.activateOperator(u.defId), true); }

test('support source evidence distinguishes trait-only talent, immediate aura triggers and bound persistent cloud fields', () => {
  assert.equal(evidence.earthspirit.talentBlackboardModifier._influenceSkillBlackboard, 0);
  assert.deepEqual(evidence.earthspirit.talentBlackboardModifier._modifiers, [{ type: 0, key: 'sluggish' }]);
  assert.equal(evidence.earthspirit.s2Aura._buffs[0].waitFirstTriggerInterval, 0);
  assert.equal(evidence.earthspirit.s2Aura._passiveBuffs[0].attributes.abnormalFlags[0], 11);
  assert.equal(evidence.podenco.s2Skill._allowNoTarget, 0);
  assert.equal(evidence.podenco.s2Skill._recoverSpIfNoTarget, 1);
  assert.equal(evidence.podenco.talentAura._onlyDetactTargetWhenStarted, 0);
  assert.equal(evidence.podenco.talentAura._removeBuffWhenAbilityDetached, 1);
  assert.equal(evidence.podenco.talentValidator.ignoreTargetFree, 0);
  assert.equal(evidence.podenco.talentValidator.ignoreAllyTargetFree, 0);
  near(evidence.podenco.projectileCollider.m_Radius, 0.9, 1e-6);
  assert.equal(evidence.podenco.projectileController._keepAlreadyHitTime, 1);
  assert.equal(evidence.podenco.projectileController._stopWhenSourceInvalid, 0);
  assert.equal(evidence.podenco.projectileController._actionController._detachBuffsWhenTargetLeave, 1);
  assert.ok(evidence.unsupported.char_484_robrta.reason.includes('Modeler'));
});

test('Earthspirit normal Arts attacks apply source trait Slow plus additive talent only after E2; S1 scales actual damage at all ranks', () => {
  for (const [elite, potential, duration] of [[0, 1, 0.8], [1, 1, 0.8], [2, 1, 0.9], [2, 6, 0.93]]) {
    const { b } = make([earthspirit], { [earthspirit]: { elite, level: 1, potential, skillRank: 1 } }, 1);
    const u = deploy(b, earthspirit); b.step(); const target = b.enemies[0]; pin(b, target);
    let time; b.on('statusApplied', ctx => { if (ctx.source === u && ctx.status === 'sluggish') time = ctx.duration; });
    const hp = target.hp; b.forceAttack(u, [target]); advance(b, 0.5);
    near(hp - target.hp, u.s.atk); near(time, duration);
    advance(b, duration + 0.1); assert.equal(target.findBuff('sluggish'), null);
  }
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([earthspirit], { [earthspirit]: { skillRank: rank } }, 1);
    const u = deploy(b, earthspirit); b.step(); const target = b.enemies[0]; pin(b, target);
    const baseline = u.s.atk, level = source.operators[earthspirit].skills[0].levels[rank - 1];
    activate(b, u); const hp = target.hp; b.forceAttack(u, [target]); advance(b, 0.5);
    near(hp - target.hp, baseline * (1 + bbOf(level).atk));
    advance(b, level.duration); near(u.s.atk, baseline);
  }
});

test('Earthspirit S2 slows every in-range enemy immediately and per source interval, does no damage, and stops its aura on expiry', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([earthspirit], { [earthspirit]: { skillId: 'skchr_skgoat_2', skillRank: rank } }, 3);
    const u = deploy(b, earthspirit); b.step(); const [first, second, outside] = b.enemies;
    pin(b, first); pin(b, second, 6, 2); pin(b, outside, 2, 2); b.step();
    const bb = bbOf(source.operators[earthspirit].skills[1].levels[rank - 1]);
    const applied = []; b.on('statusApplied', ctx => { if (ctx.source === u) applied.push(ctx); });
    activate(b, u); assert.equal(applied.length, 2); for (const ctx of applied) near(ctx.duration, bb.sluggish);
    assert.equal(effectiveProfile(u).noAttack, true); const hp = first.hp; u.atkCd = 0;
    advance(b, bb.interval - 0.1); assert.equal(first.findBuff('sluggish'), null); near(first.hp, hp);
    advance(b, 0.1); assert.equal(applied.length, 4); assert.ok(first.findBuff('sluggish'));
    pin(b, outside, 7, 3); b.step(); assert.ok(outside.findBuff('sluggish'));
    u.atkCd = 100;
    advance(b, 25); const count = applied.length;
    assert.equal(u.skill.active, false); assert.equal(Boolean(effectiveProfile(u).noAttack), false);
    advance(b, 2); assert.equal(applied.length, count); near(first.hp, hp);
    assert.equal(first.findBuff('sluggish'), null);
  }
});

test('Podenco Gardener buffs only Supporters including self and late deployments, with phase/potential scaling and cleanup', () => {
  for (const [elite, potential, scale] of [[0, 1, 0], [1, 1, 0.05], [1, 6, 0.07], [2, 1, 0.09], [2, 6, 0.11]]) {
    const { b } = make([podenco, earthspirit, 'char_278_orchid', 'char_500_noirc'],
      { [podenco]: { elite, level: 1, potential, skillRank: 1 } });
    const early = deploy(b, 'char_278_orchid', 1, 5), u = deploy(b, podenco), guard = deploy(b, 'char_500_noirc', 2, 2);
    near(u.s.atk, u.base.atk * (1 + scale)); near(early.s.atk, early.base.atk * (1 + scale));
    near(guard.s.atk, guard.base.atk); const late = deploy(b, earthspirit, 1, 6);
    near(late.s.atk, late.base.atk * (1 + scale)); b.retreatOperator(podenco);
    near(late.s.atk, late.base.atk); near(early.s.atk, early.base.atk);
  }
  const { b } = make([podenco, earthspirit]); const target = deploy(b, earthspirit, 1, 6), u = deploy(b, podenco);
  near(target.s.atk, target.base.atk * 1.09); b.kill(u); near(target.s.atk, target.base.atk);
});

test('Podenco S1 heals one lowest-ratio in-range ally, permits self, excludes enemy damage and restores normal Arts attacks at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([podenco, 'char_500_noirc', 'char_122_beagle'], { [podenco]: { skillRank: rank } }, 1);
    const u = deploy(b, podenco), low = deploy(b, 'char_500_noirc', 2, 7), high = deploy(b, 'char_122_beagle', 2, 6);
    b.step(); const enemy = b.enemies[0]; pin(b, enemy, 7, 3); low.hp = 1; high.hp = high.s.maxHp * 0.9;
    const hp = enemy.hp, highHp = high.hp, baseline = u.s.atk;
    const level = source.operators[podenco].skills[0].levels[rank - 1]; activate(b, u);
    const profile = effectiveProfile(u), selected = acquireTargets(b, u, profile);
    assert.equal(profile.dmgType, 'heal'); assert.deepEqual(selected, [low]);
    near(u.s.atk, baseline + u.base.atk * bbOf(level).atk);
    b.forceAttack(u, selected); near(low.hp, 1 + u.s.atk); near(high.hp, highHp); near(enemy.hp, hp);
    low.hp = low.s.maxHp; high.hp = high.s.maxHp; u.hp = 1;
    const self = acquireTargets(b, u, profile); assert.deepEqual(self, [u]);
    b.forceAttack(u, self); near(u.hp, 1 + u.s.atk);
    advance(b, level.duration + 0.1); assert.equal(effectiveProfile(u).dmgType, 'arts'); near(u.s.atk, baseline);
  }
});

test('Podenco Gardener removes and restores its aura as a living Supporter becomes hidden, untargetable or isolated', () => {
  const { b } = make([podenco, earthspirit], {}, 1);
  const u = deploy(b, podenco), ally = deploy(b, earthspirit, 1, 6);
  b.step(); const target = b.enemies[0]; pin(b, target); b.step();
  const key = `podenco:gardener:${u.id}`;
  const check = active => {
    assert.equal(Boolean(ally.findBuff(key)), active);
    near(ally.s.atk, ally.base.atk * (active ? 1.09 : 1));
  };
  const attack = expected => {
    const hp = target.hp; b.forceAttack(ally, [target]); advance(b, 0.5);
    near(hp - target.hp, expected);
  };
  check(true); attack(ally.base.atk * 1.09);
  ally.hidden = true; b.step(); check(false);
  ally.hidden = false; b.step(); check(true);
  for (const flag of ['untargetable', 'isolated']) {
    b.addBuff(ally, { key: 'test:unavailable', flags: { [flag]: true } });
    b.step(); check(false); attack(ally.base.atk);
    b.removeBuff(ally, 'test:unavailable'); b.step(); check(true);
    attack(ally.base.atk * 1.09);
  }
  // Friendly invisibility and a direct-healing restriction do not exclude an
  // ally from a same-side stat aura.
  b.addBuff(ally, { key: 'test:friendly', flags: { stealth: true, noHeal: true } });
  b.step(); check(true);
  assert.equal(ally.buffs.filter(buff => buff.key === key).length, 1);
});

test('Podenco S2 preserves SP without a target, flies before bursting, ticks every second in the source radius and cleans status on expiry at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([podenco], { [podenco]: { skillId: 'skchr_podego_2', skillRank: rank } }, 3);
    const u = deploy(b, podenco); u.skill.gainSp(u.skill.spCost, 'test');
    const sp = u.skill.spTotal; assert.equal(b.activateOperator(podenco), false); near(u.skill.spTotal, sp);
    assert.equal(u.skill.exhausted, false); assert.equal(u.skill.ready, true);
    assert.equal(skillHud(u.skill).ready, true); assert.equal(skillHud(u.skill).canActivate, false);
    assert.equal(skillHud(u.skill).fraction, 1); assert.doesNotMatch(skillHud(u.skill).text, /No skill uses/);
    b.step(); const [first, nearby, outside] = b.enemies;
    pin(b, first); pin(b, nearby, 7.5, 2); pin(b, outside, 8, 2); b.step();
    assert.equal(skillHud(u.skill).canActivate, true);
    const hp = b.enemies.map(e => e.hp), attack = u.s.atk;
    const bb = bbOf(source.operators[podenco].skills[1].levels[rank - 1]); activate(b, u);
    near(first.hp, hp[0]); assert.equal(u.skill.pending, false); assert.equal(u.skill.active, false);
    advance(b, 0.2); near(hp[0] - first.hp, attack * bb.atk_scale);
    near(hp[1] - nearby.hp, attack * bb.atk_scale); near(outside.hp, hp[2]);
    assert.equal(first.s.flags.silence, true); near(first.s.moveSpeed, 0);
    advance(b, bb.projectile_delay_time - 0.2);
    near(hp[0] - first.hp, attack * bb.atk_scale * bb.projectile_delay_time);
    near(hp[1] - nearby.hp, attack * bb.atk_scale * bb.projectile_delay_time);
    advance(b, 0.2); assert.equal(Boolean(first.s.flags.silence), false);
    assert.equal(first.buffs.some(buff => buff.key.startsWith('podenco:cloud:')), false);
    const amount = first.hp; advance(b, 1); near(first.hp, amount);
  }
});

test('Podenco clouds retain per-enemy hit cooldown, remove only their statuses on leaving, respect silence immunity and persist after retreat', () => {
  const { b } = make([podenco], { [podenco]: { skillId: 'skchr_podego_2' } }, 2);
  const u = deploy(b, podenco); b.step(); const [target, outside] = b.enemies;
  pin(b, target); pin(b, outside, 8.1, 2); target.base.moveSpeed = 1; target.markDirty(); b.step();
  activate(b, u); advance(b, 0.2); near(target.s.moveSpeed, 0.2); assert.equal(target.s.flags.silence, true);
  const attack = u.s.atk, once = target.hp;
  b.applyStatus(target, 'sluggish', { duration: 3, source: outside }); near(target.s.moveSpeed, 0.2);
  pin(b, target, 8.1, 2); b.step();
  assert.equal(Boolean(target.s.flags.silence), false); assert.ok(target.findBuff('sluggish'));
  pin(b, target); b.step(); near(target.hp, once); assert.equal(target.s.flags.silence, true);
  outside.def.immune.add('silence'); pin(b, outside, 7.4, 2); b.step();
  assert.equal(Boolean(outside.s.flags.silence), false);
  const beforeBoost = target.hp;
  b.addBuff(u, { key: 'test:live-atk', mods: { atkMul: 2 } }); advance(b, 1);
  near(beforeBoost - target.hp, attack * 2 * 0.8);
  b.removeBuff(u, 'test:live-atk');
  const beforeRetreat = target.hp;
  b.retreatOperator(podenco); advance(b, 1);
  // Gardener's self buff has been removed; the invalid source still falls back
  // to the projectile's launch ATK rather than the now unbuffed attributes.
  near(beforeRetreat - target.hp, attack * 0.8);
  const time = b.time; advance(b, 7 - time);
  assert.equal(target.buffs.some(buff => buff.key.startsWith('podenco:cloud:')), false);
  assert.equal(outside.buffs.some(buff => buff.key.startsWith('podenco:cloud:')), false);
  near(target.s.moveSpeed, 1); assert.equal(Boolean(target.s.flags.silence), false);
});
