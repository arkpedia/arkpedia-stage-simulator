// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-defender-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, { skill = 0, rank = 10, elite = 2, level = 70, potential = 1,
  enemies = 0, companions = [] } = {}) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, {
    maxHp: 100000, atk: 100, def: 0, magicResistance: 0, moveSpeed: 0,
  });
  const op = source.operators[id];
  const build = { ...defaultBuild(op), skillId: op.skills[skill].id,
    skillRank: rank, elite, level, potential };
  const b = new StandardBattle(source, { operators: [build,
    ...companions.map(id => defaultBuild(source.operators[id]))] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  return { b, source, build };
}
function deploy(b, id, row = 2, col = 7) {
  b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, row, col, 'RIGHT');
  u.atkCd = 1000;
  return u;
}
function activate(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  assert.equal(u.skill.activate('test'), true);
}
function pinEnemies(b) {
  b.step();
  for (const e of b.enemies) {
    b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true, disarm: true } });
    e.x = 8; e.y = 2;
  }
  b.step();
}
const bbAt = (source, id, skill, rank) => Object.fromEntries(
  source.operators[id].skills[skill].levels[rank - 1].blackboard.map(v => [v.key, v.value]));

test('defender source evidence includes exact client bundle hashes, Gummy sequence and Bubble damage filters', () => {
  for (const id of ['char_150_snakek', 'char_381_bubble', 'char_196_sunbr', 'char_260_durnar']) {
    assert.ok(evidence.characters[id]?.length);
    assert.match(evidence.sourceBundles.find(v => v.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
  }
  const children = evidence.skills.gummy_sequence_children;
  assert.ok(children.some(v => v.pathId === '-1633263084332689387'));
  assert.ok(children.some(v => v.pathId === '1520972884057610261'));
  const actions = evidence.templates.bubble_s_2.eventToActions.ON_TAKE_DAMAGE;
  assert.equal(actions.some(v => v.$type.includes('IsAttack')), false);
  assert.equal(actions.find(v => v.$type.includes('DamageViaAttr'))._attributeType, 'DEF');
});

test('Cuora and Bubble S1 use every source rank and restore DEF; passive talent belongs to the correct unit', () => {
  for (const id of ['char_150_snakek', 'char_381_bubble']) for (let rank = 1; rank <= 10; rank++) {
    const { b, source, build } = make(id, { rank });
    const u = deploy(b, id), initial = u.s.def, atk = u.s.atk;
    near(initial, u.base.def * (id === 'char_150_snakek' ? 1.12 : 1));
    activate(b, u);
    near(u.s.def - initial, u.base.def * bbAt(source, id, 0, rank).def);
    assert.equal(Boolean(u.s.flags.disarm), false);
    advance(b, 35.1); near(u.s.def, initial); near(u.s.atk, atk);
    if (id === 'char_381_bubble') assert.equal(recordFor(build, source).arkpedia.modifiers.atkPct, undefined);
  }
});

test('Cuora S2 increases block, stops attacking and regenerates exact max-HP percentage at every rank', () => {
  const id = 'char_150_snakek';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill: 1, rank, enemies: 1 });
    const u = deploy(b, id); pinEnemies(b);
    const normalDef = u.s.def, normalBlock = u.s.blockCnt, bb = bbAt(source, id, 1, rank);
    u.hp = 1; b.addBuff(u, { key: 'test:noheal', flags: { noHeal: true } });
    activate(b, u); near(u.s.def, normalDef + u.base.def * bb.def);
    assert.equal(u.s.blockCnt, normalBlock + 1);
    assert.equal(u.s.flags.disarm, true); assert.equal(effectiveProfile(u).noAttack, true);
    const attacks = u.stats.attacks; u.atkCd = 0; advance(b, 1);
    near(u.hp, 1 + u.s.maxHp * bb.hp_recovery_per_sec_by_max_hp_ratio);
    assert.equal(u.stats.attacks, attacks);
    advance(b, 29.1); near(u.s.def, normalDef); assert.equal(u.s.blockCnt, normalBlock);
    assert.equal(Boolean(u.s.flags.disarm), false);
    assert.equal(Boolean(effectiveProfile(u).noAttack), false);
  }
});

test('Bubble talent targets the enemy source, scales final ATK, refreshes without stacking and expires after five seconds', () => {
  const id = 'char_381_bubble';
  for (const [elite, level, ratio] of [[0, 45, 0], [1, 60, .05], [2, 70, .08]]) {
    const { b } = make(id, { elite, level, rank: 4, enemies: 2 });
    const u = deploy(b, id); pinEnemies(b); const [e, untouched] = b.enemies;
    b.addBuff(e, { key: 'test:atk', mods: { atkPct: .5, atkFlat: 40 } });
    const initial = e.s.atk, own = u.s.atk;
    for (let i = 0; i < 2; i++) b.dealDamage(e, u, { amount: 1, type: 'true', isAttack: true });
    near(e.s.atk, initial * (1 - ratio)); near(u.s.atk, own);
    near(untouched.s.atk, untouched.base.atk);
    advance(b, 4.9); near(e.s.atk, initial * (1 - ratio));
    b.dealDamage(e, u, { amount: 1, type: 'true', isAttack: false });
    advance(b, .2); near(e.s.atk, initial * (1 - ratio));
    advance(b, 4.9); near(e.s.atk, initial);
  }
});

test('Bubble S2 counters physical and Arts enemy damage with current DEF, including shielded/fatal hits, then stops on expiry', () => {
  const id = 'char_381_bubble';
  for (const rank of [1, 7, 10]) {
    const { b, source } = make(id, { skill: 1, rank, enemies: 2 });
    const u = deploy(b, id); pinEnemies(b); const [e, untouched] = b.enemies;
    const def = u.s.def, taunt = u.s.taunt, bb = bbAt(source, id, 1, rank);
    activate(b, u); near(u.s.def, def + u.base.def * bb.def);
    near(u.s.taunt, taunt + 1); assert.equal(u.s.flags.disarm, true);
    for (const type of ['phys', 'arts', 'true']) {
      const hp = e.hp, other = untouched.hp;
      b.dealDamage(e, u, { amount: 1, type, isAttack: type === 'phys' });
      near(hp - e.hp, u.s.def * bb.atk_scale); near(untouched.hp, other);
    }
    b.addBuff(u, { key: 'test:shield', shield: 100 });
    let hp = e.hp, own = u.hp;
    b.dealDamage(e, u, { amount: 1, type: 'true' });
    near(u.hp, own); near(hp - e.hp, u.s.def * bb.atk_scale);
    b.removeBuff(u, 'test:shield');
    hp = e.hp; b.dealDamage(e, u, { amount: 1, type: 'true', sourceless: true }); near(e.hp, hp);
    advance(b, 25.1); near(u.s.def, def); near(u.s.taunt, taunt);
    hp = e.hp; b.dealDamage(e, u, { amount: 1, type: 'true' }); near(e.hp, hp);
    activate(b, u); u.hp = 1; hp = e.hp; const reflect = u.s.def * bb.atk_scale;
    b.dealDamage(e, u, { amount: 2, type: 'true' });
    near(hp - e.hp, reflect); assert.equal(u.alive, false);
  }
});

test('Dur-nar deals physical damage normally and Arts with either skill at every rank; S2 hurt SP stops during its duration', () => {
  const id = 'char_260_durnar';
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill, rank, enemies: 1 });
    const u = deploy(b, id); pinEnemies(b); const e = b.enemies[0];
    e.base.def = 100000; e.base.res = 0; e.markDirty();
    near(u.s.atk, u.base.atk * 1.07); near(u.s.def, u.base.def * 1.07);
    let hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk * .05);
    if (skill === 1) {
      const sp = u.skill.sp; b.dealDamage(e, u, { amount: 1, type: 'true' });
      near(u.skill.sp, sp + 1); assert.equal(u.skill.spType, 'hurt');
    }
    const atk = u.s.atk; activate(b, u);
    near(u.s.atk, atk + u.base.atk * bbAt(source, id, skill, rank).atk);
    hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk);
    if (skill === 1) { b.dealDamage(e, u, { amount: 1, type: 'true' }); near(u.skill.sp, 0); }
    advance(b, source.operators[id].skills[skill].levels[rank - 1].duration + .1);
    assert.equal(effectiveProfile(u).dmgType, 'phys'); near(u.s.atk, atk);
  }
});

test('Dur-nar S2 attacks at most her current block count without splash and returns to one target afterwards', () => {
  const id = 'char_260_durnar';
  const { b } = make(id, { skill: 1, enemies: 4 });
  const u = deploy(b, id); pinEnemies(b);
  for (const e of b.enemies) { e.x = 7; e.y = 2; }
  b.step(); // Rebuild the enemy tile index after the fixture repositioning.
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
  activate(b, u); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 3);
  b.addBuff(u, { key: 'test:blockdown', mods: { blockCnt: -1 } });
  const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 2);
  const hp = b.enemies.map(e => e.hp); b.forceAttack(u, targets);
  assert.equal(b.enemies.filter((e, i) => e.hp < hp[i]).length, 2);
  near(effectiveProfile(u).splashRadius, 0);
  advance(b, 30.1); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
});

test('Gummy normal talent criticals and stuns at source promotion/potential values, without accumulating damage multipliers', () => {
  const id = 'char_196_sunbr';
  for (const [elite, level, potential, prob, scale, stun] of [
    [0, 45, 1, 0, 1, 0], [1, 60, 1, .1, 1.5, .5], [1, 60, 5, .13, 1.5, .5],
    [2, 70, 1, .15, 2, 1], [2, 70, 5, .18, 2, 1],
  ]) {
    const { b, build, source } = make(id, { elite, level, potential, rank: 4, enemies: 1 });
    assert.equal(recordFor(build, source).arkpedia.critical, undefined);
    const u = deploy(b, id); pinEnemies(b); const e = b.enemies[0]; let rolls = 0;
    b.rng.chance = p => { near(p, prob); rolls++; return true; };
    for (let i = 0; i < 2; i++) { const hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk * scale); }
    assert.equal(rolls, prob ? 2 : 0); assert.equal(Boolean(e.s.flags.stun), !!stun);
    if (stun) { advance(b, stun + .1); assert.equal(Boolean(e.s.flags.stun), false); }
    b.rng.chance = () => false;
    const hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk);
  }
});

test('Gummy S1 stores source charges, heals the lowest-ratio nearby ally including herself, and never rolls damage criticals', () => {
  const id = 'char_196_sunbr';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { rank, companions: ['char_289_gyuki', 'char_122_beagle'] });
    const u = deploy(b, id), ally = deploy(b, 'char_289_gyuki', 2, 6), far = deploy(b, 'char_122_beagle', 2, 5);
    const bb = bbAt(source, id, 0, rank);
    b.rng.chance = () => { throw Error('Healing cannot roll Gummy damage criticals'); };
    u.skill.gainSp(100, 'test'); assert.equal(u.skill.charges, bb.ct);
    advance(b, .1); assert.equal(u.skill.pending, false);
    u.hp = u.s.maxHp * .75; ally.hp = 1; far.hp = 1;
    advance(b, .1); assert.equal(u.skill.pending, true);
    const targets = acquireTargets(b, u, effectiveProfile(u)); assert.deepEqual(targets.map(v => v.id), [ally.id]);
    b.forceAttack(u, targets); near(ally.hp, 1 + u.s.atk * bb.heal_scale); near(far.hp, 1);
    assert.equal(u.skill.active, false); assert.equal(u.skill.charges, bb.ct - 1);
    near(u.hp, u.s.maxHp * .75);
    u.skill.gainSp(100, 'test'); ally.hp = ally.s.maxHp; u.hp = 1;
    advance(b, .1); const self = acquireTargets(b, u, effectiveProfile(u));
    assert.deepEqual(self.map(v => v.id), [u.id]);
    b.forceAttack(u, self); near(u.hp, 1 + u.s.atk * bb.heal_scale);
    assert.equal(effectiveProfile(u).dmgType, 'phys');
  }
});

test('Gummy S2 separates ten-second DEF preparation from thirty-second ATK healing, percentage attack time, and full cleanup', () => {
  const id = 'char_196_sunbr';
  for (const rank of [1, 7, 10]) {
    const { b, source } = make(id, { skill: 1, rank, companions: ['char_289_gyuki'] });
    const u = deploy(b, id), ally = deploy(b, 'char_289_gyuki', 2, 6);
    const bb = bbAt(source, id, 1, rank), atk = u.s.atk, def = u.s.def, bat = u.s.bat;
    ally.hp = 1; let rolls = 0; b.rng.chance = () => { rolls++; return true; };
    activate(b, u); near(u.skill.timeLeft, 40);
    near(u.s.def, def + u.base.def * bb.def); near(u.s.atk, atk); near(u.s.bat, bat);
    assert.equal(u.s.flags.disarm, true); u.atkCd = 0;
    advance(b, 9.9); near(ally.hp, 1); assert.equal(u.stats.attacks, 0);
    advance(b, .1); assert.equal(Boolean(u.s.flags.disarm), false);
    near(u.s.def, def); near(u.s.atk, atk + u.base.atk * bb.atk);
    near(u.s.bat, bat * (1 + bb.base_attack_time));
    assert.equal(u.stats.attacks, 1); near(ally.hp, 1 + u.s.atk); assert.equal(rolls, 0);
    u.atkCd = 1000; advance(b, 29.9); assert.equal(u.skill.active, true);
    advance(b, .2); assert.equal(u.skill.active, false);
    near(u.s.atk, atk); near(u.s.def, def); near(u.s.bat, bat);
    assert.equal(effectiveProfile(u).dmgType, 'phys'); assert.equal(u.rangeGrid.length, 1);
    assert.equal(u.buffs.some(v => v.key.startsWith('gummy:cooking')), false);
  }
});

test('Gummy interrupted preparation cannot apply stale heal buffs after stopping, death or redeployment', () => {
  const id = 'char_196_sunbr';
  for (const reason of ['stop', 'death', 'retreat']) {
    const { b } = make(id, { skill: 1 });
    const u = deploy(b, id); activate(b, u); advance(b, 2);
    if (reason === 'stop') u.skill.stop();
    else if (reason === 'death') b.kill(u, null);
    else b.retreatOperator(id);
    advance(b, 9);
    assert.equal(u.buffs.some(v => v.key.startsWith('gummy:cooking')), false);
    assert.equal(u.skill.active, false);
    if (reason !== 'stop') {
      advance(b, 70); const next = deploy(b, id); near(next.s.atk, next.base.atk);
      assert.equal(next.buffs.some(v => v.key.startsWith('gummy:cooking')), false);
    }
  }
});
