// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-vanguard-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';

const courier = 'char_198_blackd', scavenger = 'char_149_scave', vigna = 'char_290_vigna', myrtle = 'char_151_myrtle';
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const bbOf = level => Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value]));

function make(ids, overrides = {}, { enemies = 0, seed = 1 } = {}) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  source.stage.battle.dp_per_second = 0;
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0, def: 0 });
  const builds = ids.map(id => ({ ...defaultBuild(source.operators[id]), ...overrides[id] }));
  const b = new StandardBattle(source, { operators: builds }, { seed });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  return { b, source, builds };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function deploy(b, id, row = 2, col = 7, dir = 'UP') {
  b.addDp('arkpedia', 99); const u = b.deployOperator(id, row, col, dir); u.atkCd = 100; return u;
}
function activate(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(b.activateOperator(u.defId), true);
}
function resetDp(b) { b.getPlayer('arkpedia').dp = 0; }
function pin(b, enemy, x = 7, y = 2) {
  enemy.x = x; enemy.y = y;
  b.addBuff(enemy, { key: 'test:pin', flags: { noMove: true }, persist: true });
}
function hit(b, u, target) {
  const before = target.hp; b.forceAttack(u, [target]); return before - target.hp;
}

test('vanguard evidence preserves exact prefab bindings, additive Vigna talent, conditional selectors and continuous Myrtle heal', () => {
  assert.equal(evidence.sourceBundles.length, 5);
  assert.equal(evidence.skillBindings[courier][0].skillId, 'skcom_charge_cost[2]');
  assert.equal(evidence.skillBuffs.skcom_charge_cost[0].templateKey, 'charge_cost');
  assert.equal(evidence.skillBuffs.skchr_blackd_2[1].waitFirstTriggerInterval, 1);
  assert.equal(evidence.skillBuffs.skchr_blackd_2[1].stripBlackboardParamsWithBuffKey, 1);
  assert.equal(evidence.courier.talentChecker._blockMinCnt, 2);
  assert.equal(evidence.scavenger.talentChecker._minManhattan, 2);
  assert.equal(evidence.vigna.talentAttributes.attributeModifiers[0].formulaItem, 1);
  assert.equal(evidence.skillBuffs.skchr_vigna_2[0].attributes.attributeModifiers[1].formulaItem, 0);
  assert.equal(evidence.skillBindings[myrtle][0].overridePrefabKey, 'skchr_myrtle_1');
  assert.equal(evidence.skillBuffs.skchr_myrtle_1[0].attributes.attributeModifiers[0].formulaItem, 3);
  assert.equal(evidence.myrtle.healingAbility._isCont, 1);
  assert.equal(evidence.myrtle.healingSelector._maxNum, 1);
  assert.equal(evidence.myrtle.healingSelector._excludeOwner, 0);
});

test('Courier and Scavenger automatic S1 grants exactly nine DP without an enemy at every rank, then recurs after source SP cost', () => {
  for (const id of [courier, scavenger]) for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([id], { [id]: { skillRank: rank } });
    const u = deploy(b, id); resetDp(b);
    assert.equal(u.skill.manual, false);
    u.skill.gainSp(u.skill.spCost, 'test'); b.step(); near(b.dp, 9);
    assert.equal(u.skill.active, false); assert.equal(u.skill.pending, false);
    const sp = source.operators[id].skills[0].levels[rank - 1].spData.spCost;
    advance(b, sp - 0.1); near(b.dp, 9); advance(b, 0.2); near(b.dp, 18);
  }
});

test('Courier S2 grants three DP immediately and eight spaced ticks, adds DEF for fifteen seconds, and stops after retreat', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([courier], { [courier]: { skillId: 'skchr_blackd_2', skillRank: rank } });
    const u = deploy(b, courier), bb = bbOf(source.operators[courier].skills[1].levels[rank - 1]);
    resetDp(b); const baseline = u.s.def; activate(b, u);
    near(b.dp, bb['blackd_s_2[once].cost']);
    near(u.s.def, baseline + u.base.def * bb['blackd_s_2[period].def']);
    advance(b, 1.8); near(b.dp, 3); advance(b, 0.1); near(b.dp, 4);
    advance(b, 13.2); near(b.dp, 11); near(u.s.def, baseline);
    assert.equal(u.skill.active, false); advance(b, 2); near(b.dp, 11);
  }
  const { b } = make([courier], { [courier]: { skillId: 'skchr_blackd_2' } });
  const u = deploy(b, courier); resetDp(b); activate(b, u); advance(b, 2);
  b.retreatOperator(courier); const amount = b.dp; advance(b, 15); near(b.dp, amount);
});

test('Courier talent requires two live blocked enemies, changes incoming Physical damage, and updates after release or a kill', () => {
  for (const [elite, potential, scale] of [[0, 1, 0], [1, 1, 0.08], [1, 6, 0.11], [2, 1, 0.16], [2, 6, 0.19]]) {
    const { b } = make([courier], { [courier]: { elite, level: 1, potential, skillRank: 1 } }, { enemies: 2 });
    const u = deploy(b, courier); b.step(); const [a, second] = b.enemies;
    pin(b, a); pin(b, second, 6, 2); b.step();
    assert.equal(u.blocking.length, 1); near(u.s.def, u.base.def);
    pin(b, second, 7.1, 2); b.step(); assert.equal(u.blocking.length, 2);
    near(u.s.def, u.base.def * (1 + scale));
    u.hp = u.s.maxHp;
    const before = u.hp; b.dealDamage(a, u, { amount: 500, type: 'phys', isAttack: true });
    near(before - u.hp, 500 - u.base.def * (1 + scale));
    b.kill(second, u); near(u.s.def, u.base.def);
    b.releaseBlocked(u); pin(b, a, 6, 2); b.step(); near(u.s.def, u.base.def);
  }
});

test('Scavenger talent ignores diagonals, loses ATK and DEF beside an ally, and returns on ally retreat with additive skill ATK', () => {
  for (const [elite, potential, scale] of [[0, 1, 0], [1, 1, 0.05], [1, 6, 0.07], [2, 1, 0.11], [2, 6, 0.13]]) {
    const { b } = make([scavenger, 'char_117_myrrh', 'char_500_noirc'],
      { [scavenger]: { elite, level: 1, potential, skillRank: 1 } }, { enemies: 1 });
    const u = deploy(b, scavenger); b.step(); const enemy = b.enemies[0]; pin(b, enemy, 7, 3);
    near(hit(b, u, enemy), u.base.atk * (1 + scale)); near(u.s.def, u.base.def * (1 + scale));
    deploy(b, 'char_117_myrrh', 1, 6); near(u.s.atk, u.base.atk * (1 + scale));
    deploy(b, 'char_500_noirc', 2, 6); near(hit(b, u, enemy), u.base.atk); near(u.s.def, u.base.def);
    b.retreatOperator('char_500_noirc'); near(u.s.atk, u.base.atk * (1 + scale));
  }
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([scavenger], { [scavenger]: { skillId: 'skchr_scave_2', skillRank: rank } }, { enemies: 1 });
    const u = deploy(b, scavenger); b.step(); const enemy = b.enemies[0]; pin(b, enemy, 7, 3);
    const baseline = u.s.atk, bb = bbOf(source.operators[scavenger].skills[1].levels[rank - 1]);
    resetDp(b); activate(b, u); near(b.dp, bb.cost);
    near(hit(b, u, enemy), baseline + u.base.atk * bb.atk);
    advance(b, 15.1); near(u.s.atk, baseline); near(b.dp, bb.cost);
  }
});

test('Vigna rolls one additive ATK proc per attack with source normal/skill probabilities and expires it immediately after each attack', () => {
  for (const [elite, potential, bonus] of [[0, 1, 0], [1, 1, 0.5], [1, 6, 0.6], [2, 1, 1], [2, 6, 1.1]]) {
    const { b } = make([vigna], { [vigna]: { elite, level: 1, potential, skillRank: 1 } }, { enemies: 1 });
    const u = deploy(b, vigna); b.step(); const target = b.enemies[0]; pin(b, target, 7, 3);
    const probabilities = []; b.rng.chance = p => { probabilities.push(p); return true; };
    near(hit(b, u, target), u.base.atk * (1 + bonus)); near(u.s.atk, u.base.atk);
    activate(b, u); near(hit(b, u, target), u.base.atk * (1 + 0.2 + bonus));
    near(u.s.atk, u.base.atk * 1.2); assert.equal(u.findBuff('vigna:fierce-stabbing'), null);
    assert.deepEqual(probabilities, bonus ? [0.1, 0.3] : []);
  }
  for (const skill of ['skchr_vigna_1', 'skchr_vigna_2']) for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([vigna], { [vigna]: { skillId: skill, skillRank: rank } }, { enemies: 1 });
    const u = deploy(b, vigna); b.step(); const target = b.enemies[0]; pin(b, target, 7, 3);
    const level = source.operators[vigna].skills.find(s => s.id === skill).levels[rank - 1], bb = bbOf(level);
    let roll = 0.2; b.rng.chance = p => roll < p;
    near(hit(b, u, target), u.base.atk); activate(b, u);
    near(hit(b, u, target), u.base.atk * (2 + bb.atk));
    roll = 0.9; near(hit(b, u, target), u.base.atk * (1 + bb.atk));
    near(u.s.interval, (u.base.bat + (bb.base_attack_time ?? 0)) * 100 / u.s.aspd);
    advance(b, level.duration + 0.1); near(u.s.atk, u.base.atk);
    near(u.s.interval, u.base.bat * 100 / u.s.aspd);
  }
  const sequence = seed => {
    const { b } = make([vigna], {}, { enemies: 1, seed }), u = deploy(b, vigna); b.step();
    return Array.from({ length: 30 }, () => hit(b, u, b.enemies[0]));
  };
  assert.deepEqual(sequence(491), sequence(491));
});

test('Vigna gains DP only for her own kill and refunds original cost on manual retreat, including an inflated redeployment', () => {
  const { b } = make([vigna], {}, { enemies: 2 }); const u = deploy(b, vigna); b.step(); resetDp(b);
  const [first, other] = b.enemies;
  b.kill(other); near(b.dp, 0);
  first.hp = 1; hit(b, u, first); near(b.dp, 1);
  const cost = u.base.cost; b.retreatOperator(vigna); near(b.dp, 1 + cost);
  advance(b, 75); const redeployed = deploy(b, vigna);
  assert.ok(b.bench[vigna].lastCost > cost); resetDp(b); b.retreatOperator(vigna);
  near(b.dp, cost); assert.equal(redeployed.alive, false);
});

test('Myrtle channel sets block to zero immediately, suppresses enemy attacks, grants DP at source intervals and restores attacking/blocking at every rank', () => {
  for (const skill of ['skcom_assist_cost[2]', 'skchr_myrtle_2']) for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([myrtle], { [myrtle]: { skillId: skill, skillRank: rank } }, { enemies: 1 });
    const u = deploy(b, myrtle); b.step(); const enemy = b.enemies[0]; pin(b, enemy); b.step();
    assert.equal(enemy.blockedBy, u);
    b.addBuff(u, { key: 'test:extra-block', mods: { blockCnt: 5 } }); near(u.s.blockCnt, 6);
    resetDp(b); const level = source.operators[myrtle].skills.find(s => s.id === skill).levels[rank - 1], bb = bbOf(level);
    activate(b, u); near(u.s.blockCnt, 0); assert.equal(enemy.blockedBy, null);
    assert.equal(effectiveProfile(u).noAttack, true); const hp = enemy.hp; u.atkCd = 0;
    advance(b, bb.interval - 0.1); near(b.dp, 0); near(enemy.hp, hp);
    advance(b, 0.2); near(b.dp, 1); near(enemy.hp, hp);
    advance(b, level.duration - bb.interval - 0.1);
    near(b.dp, bb.value); assert.equal(u.skill.active, false); near(u.s.blockCnt, 6);
    advance(b, 0.1); assert.equal(enemy.blockedBy, u); assert.ok(enemy.hp < hp);
  }
});

test('Myrtle S2 continuously heals one injured nearby ally, respects the source wind-up and heal restriction, and permits self healing', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make([myrtle, 'char_500_noirc', 'char_122_beagle', 'char_289_gyuki'],
      { [myrtle]: { skillId: 'skchr_myrtle_2', skillRank: rank } });
    const u = deploy(b, myrtle), low = deploy(b, 'char_500_noirc', 2, 6), high = deploy(b, 'char_122_beagle', 3, 7), far = deploy(b, 'char_289_gyuki', 2, 2);
    low.hp = 1; high.hp = high.s.maxHp * 0.9; far.hp = 1;
    const beforeHigh = high.hp, bb = bbOf(source.operators[myrtle].skills[1].levels[rank - 1]);
    activate(b, u); advance(b, 0.5); near(low.hp, 1);
    advance(b, 0.5); near(low.hp, 1 + u.s.atk * bb['attack@heal_scale'] * (1 - evidence.myrtle.healingAbility._preDelay));
    near(high.hp, beforeHigh); near(far.hp, 1);
    b.addBuff(low, { key: 'test:noheal', flags: { noHeal: true } }); u.hp = 1;
    const amount = low.hp; advance(b, 1); near(low.hp, amount);
    near(u.hp, 1 + u.s.atk * bb['attack@heal_scale'] + 25);
    // DP keeps generating under Stun, while the interruptible heal cannot run.
    b.applyStatus(u, 'stun', { duration: 1.1, source: low }); const stopped = u.hp, dp = b.dp;
    advance(b, 1); near(u.hp, stopped + 25); assert.ok(b.dp > dp);
    b.retreatOperator(myrtle); const end = high.hp; advance(b, 20); near(high.hp, end);
  }
});

test('Myrtle talent regenerates only deployed Vanguards including self and later deployments, and cleans up on death or retreat', () => {
  for (const [elite, potential, rate] of [[1, 1, 0], [2, 1, 25], [2, 6, 28]]) {
    const { b, source, builds } = make([myrtle, courier, scavenger, 'char_500_noirc'],
      { [myrtle]: { elite, level: 1, potential, skillRank: 1 } });
    const before = deploy(b, courier, 2, 6), guard = deploy(b, 'char_500_noirc', 2, 2), u = deploy(b, myrtle);
    before.hp = guard.hp = u.hp = 1;
    advance(b, 1); near(before.hp, 1 + rate); near(u.hp, 1 + rate); near(guard.hp, 1);
    const late = deploy(b, scavenger, 3, 7); late.hp = 1;
    b.addBuff(late, { key: 'test:unhealable', flags: { noHeal: true } }); advance(b, 1); near(late.hp, 1 + rate);
    if (rate) near(recordFor(builds[0], source).talents[0].bb.hp_recovery_per_sec, rate);
    b.retreatOperator(myrtle); const hp = late.hp; advance(b, 2); near(late.hp, hp);
    near(late.s.hpRegen, 0); near(before.s.hpRegen, 0);
  }
  const { b } = make([myrtle, courier]); const ally = deploy(b, courier, 2, 6), u = deploy(b, myrtle);
  near(ally.s.hpRegen, 25); b.kill(u); near(ally.s.hpRegen, 0);
});

test('Vigna S2 native flat BAT addition composes before external BAT percentage/final scale and changes actual attack cadence', () => {
  const { b, source } = make([vigna], { [vigna]: { skillId: 'skchr_vigna_2', skillRank: 10 } }, { enemies: 1 });
  const u = deploy(b, vigna); b.step(); const e = b.enemies[0]; pin(b, e, 7, 3);
  const bb = bbOf(source.operators[vigna].skills[1].levels[9]);
  b.addBuff(u, { key: 'test:BAT-composition', mods: { batFlat: .2, batPct: .3, batMul: .8, aspd: 20 } });
  activate(b, u);
  const interval = (u.base.bat + .2 + bb.base_attack_time) * 1.3 * .8 * 100 / u.s.aspd;
  near(u.s.interval, interval); assert.equal(u.skill.spec.mods.batPct, undefined); near(u.skill.spec.mods.batFlat, bb.base_attack_time);
  const releases = []; b.on('attack', ({ attacker }) => { if (attacker === u) releases.push(b.time); });
  u.atkCd = 0; advance(b, interval * 3.1);
  assert.ok(releases.length >= 3); for (let n = 1; n < releases.length; n++) {
    assert.ok(releases[n] - releases[n - 1] >= interval - 1e-9);
    assert.ok(releases[n] - releases[n - 1] < interval + b.dt + 1e-9);
  }
  u.atkCd = 1000; advance(b, 31);
  near(u.s.interval, (u.base.bat + .2) * 1.3 * .8 * 100 / u.s.aspd);
});
