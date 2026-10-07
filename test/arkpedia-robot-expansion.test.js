// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-robot-expansion-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { ROBOT_EXPANSION_OPERATORS } from '../shared/arkpedia/robot-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';

const PALICO = 'char_4077_palico', ULIKA = 'char_4091_ulika', PHONOR = 'char_4136_phonor';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(ids, overrides = {}) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(source, { operators: ids.map(id => ({
    ...defaultBuild(source.operators[id]), ...overrides[id],
  })) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  return b;
}
function deploy(b, id, r = 1, c = 7, direction = 'UP') {
  b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, r, c, direction);
  assert.ok(u, `${id}: ${b.placementError(id, r, c)}`);
  u.atkCd = 1000; return u;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function enemy(b, x = 7, y = 2, fly = false) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = e.hp = 100000;
  e.base.def = e.base.res = e.base.moveSpeed = 0;
  e.motion = fly ? 'FLY' : 'WALK'; e.markDirty();
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
const characterComponents = id => evidence.characters[id].flatMap(row => row.components);
const projectileComponents = () => evidence.projectiles.flatMap(row => row.components);

test('robot source evidence retains exact prefabs, zero slots, fixed facing and distinct splash colliders', () => {
  for (const id of Object.keys(ROBOT_EXPANSION_OPERATORS)) {
    assert.ok(characterComponents(id).some(c => c._occupiedRemainingCharacterCnt === 0));
    assert.match(evidence.sourceBundles.find(v => v.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.equal(data.operators[id].skills.length, 0);
  }
  assert.ok(characterComponents(ULIKA).some(c => c._isFixedRotation === 1));
  const colliders = projectileComponents().filter(c => c.m_Radius !== undefined);
  assert.ok(colliders.some(c => Math.abs(c.m_Radius - .9) < 1e-6));
  assert.ok(colliders.some(c => Math.abs(c.m_Radius - 1.7) < 1e-6));
  assert.ok(colliders.some(c => Math.abs(c.m_Radius - 1.1) < 1e-6));
  const count = characterComponents(PALICO).find(c => c.pathId === '4778468586526363022');
  assert.equal(count._runActionOnEvent, 5); assert.equal(count._buffs[0].maxStackCnt, 3);
  assert.ok(JSON.stringify(evidence.buffTemplates['phonor_t_1[effector]']).includes('DARK'));
});

test('all three source robots deploy past the deployment limit, have no selectable skills and keep real cooldowns', () => {
  const b = make(['char_122_beagle', PALICO, ULIKA, PHONOR]); b.unitLimit = 1;
  deploy(b, 'char_122_beagle', 2, 7);
  for (const [id, r, c] of [[PALICO, 1, 7], [ULIKA, 1, 6], [PHONOR, 1, 5]]) {
    const u = deploy(b, id, r, c);
    assert.equal(b.deployedSlots(), 1); assert.equal(skillHud(u.skill), null);
    assert.equal(b.activateOperator(id), false); near(u.base.respawnTime, 200);
    b.retreatOperator(id); assert.equal(b.placementError(id, r, c), 'Operator is still redeploying.');
  }
});

test('Palico ordinary bomb has two separately mitigated physical hits, ground-only splash and .15s stop delay', () => {
  const b = make([PALICO]), u = deploy(b, PALICO), e = enemy(b), air = enemy(b, 7, 2, true);
  e.base.def = 20; e.markDirty(); b.rng = () => .9;
  const log = []; b.on('damaged', c => { if (c.source === u && c.target === e) log.push({ time: b.time, amount: c.amount }); });
  b.forceAttack(u, [e]); advance(b, 2);
  near(100000 - e.hp, u.s.atk - 20 + u.s.atk * .5 - 20); near(air.hp, 100000);
  assert.equal(log.length, 2); assert.ok(log[1].time - log[0].time >= .15);
  advance(b, 2); assert.equal(log.length, 2); assert.equal(u.mem.palicoBombs, 0);
});

test('Palico weighted lottery retains all four outcomes and damages a wider area only after its delayed stop', () => {
  for (const roll of [0, .199, .2, .499, .5, .799, .8, .999]) {
    const b = make([PALICO]), u = deploy(b, PALICO), e = enemy(b), wide = enemy(b, 8.4, 2);
    const statuses = []; b.on('beforeStatus', c => { if (c.source === u && c.target === e) statuses.push(c); });
    b.rng = () => roll; b.forceAttack(u, [e]); advance(b, 2.8);
    near(e.hp, 100000 - u.s.atk * 1.5); near(wide.hp, 100000);
    advance(b, .4);
    if (roll < .2) { near(wide.hp, 100000 - u.s.atk * u.def.talents[0].bb['attack@bomb_scale']); assert.equal(u.mem.palicoBombs, 1); }
    else if (roll < .5) { assert.equal(statuses[0]?.status, 'sleep'); near(statuses[0].duration, 1); near(wide.hp, 100000); }
    else if (roll < .8) { assert.equal(statuses[0]?.status, 'stun'); near(statuses[0].duration, .1); near(wide.hp, 100000); }
    else { near(e.hp, 100000 - u.s.atk * 1.5); near(wide.hp, 100000); }
  }
});

test('Palico bonus count caps at three casts, not splash victims, then stops lottery while normal attacks continue', () => {
  const b = make([PALICO], { [PALICO]: { potential: 6 } }), u = deploy(b, PALICO), e = enemy(b), other = enemy(b, 7.4, 2);
  let rolls = 0; b.rng = () => { rolls++; return 0; };
  for (let i = 0; i < 3; i++) { b.forceAttack(u, [e]); advance(b, 4); }
  assert.equal(rolls, 3); assert.equal(u.mem.palicoBombs, 3);
  const hp = e.hp, otherHp = other.hp; b.forceAttack(u, [e]); advance(b, 2);
  assert.equal(rolls, 3); near(hp - e.hp, u.s.atk * 1.5); near(otherHp - other.hp, u.s.atk * 1.5);
});

test('Palico opening has the original begin clip before its first hit and returns after an interrupted engagement', () => {
  const b = make([PALICO]), u = deploy(b, PALICO), e = enemy(b); b.rng = () => .9;
  b.forceAttack(u, [e]); advance(b, 1.3); near(e.hp, 100000); assert.equal(b.projectiles.list.length, 0);
  advance(b, .4); near(e.hp, 100000 - u.s.atk * 1.5);
  const hp = e.hp; b.forceAttack(u, [e]); advance(b, .5); assert.ok(e.hp < hp);
  b.applyStatus(u, 'stun', { duration: .2 }); advance(b, .3);
  const before = e.hp; b.forceAttack(u, [e]); advance(b, 1.3); near(e.hp, before);
  advance(b, .4); near(before - e.hp, u.s.atk * 1.5);
});

test('Palico delayed bomb retains the landing location and survives retreat; sleeping and flying units are excluded', () => {
  const b = make([PALICO]), u = deploy(b, PALICO), e = enemy(b), air = enemy(b, 8.4, 2, true), sleeper = enemy(b, 8.4, 2);
  b.applyStatus(sleeper, 'sleep', { duration: 10 });
  b.rng = () => 0; b.forceAttack(u, [e]); advance(b, 2);
  const location = enemy(b, 8.4, 2), far = enemy(b, 2, 2); b.retreatOperator(PALICO);
  advance(b, 1.5); near(location.hp, 100000 - u.s.atk * u.def.talents[0].bb['attack@bomb_scale']);
  near(air.hp, 100000); near(sleeper.hp, 100000); near(far.hp, 100000);
});

test('U-Official continuously regenerates native HP through direct-healing bans and does not attack', () => {
  const b = make([ULIKA, 'char_122_beagle', 'char_4130_luton']), u = deploy(b, ULIKA);
  const a = deploy(b, 'char_122_beagle', 2, 7), unhealable = deploy(b, 'char_4130_luton', 2, 6);
  advance(b, .1);
  a.hp = unhealable.hp = u.hp = 1;
  b.addBuff(a, { key: 'test:ban', flags: { noHeal: true, healFree: true } });
  b.applyStatus(u, 'stun', { duration: 10 }); u.atkCd = 0;
  advance(b, 1);
  const expected = u.s.atk * .1;
  near(a.hp, 1 + expected); near(unhealable.hp, 1 + expected); near(u.hp, 1 + expected);
  assert.equal(u.stats.attacks, 0); assert.equal(effectiveProfile(u).noAttack, true);
});

test('U-Official regeneration samples source ATK, tracks late arrivals, and cleans its owned effect on leaving/death', () => {
  const b = make([ULIKA, 'char_122_beagle', 'char_500_noirc']), u = deploy(b, ULIKA), a = deploy(b, 'char_122_beagle', 2, 7);
  a.hp = 1; advance(b, .5); near(a.s.hpRegen, u.s.atk * .1);
  const oldRate = a.s.hpRegen; b.addBuff(u, { key: 'test:atk', mods: { atkPct: 1 } });
  advance(b, .3); near(a.s.hpRegen, oldRate); advance(b, .3); near(a.s.hpRegen, u.s.atk * .1);
  const late = deploy(b, 'char_500_noirc', 2, 6); advance(b, .1); near(late.s.hpRegen, u.s.atk * .1);
  a.x = a.tileC = 1; advance(b, .1); near(a.s.hpRegen, 0);
  b.dealDamage(late, u, { amount: 10000, type: 'true' }); near(late.s.hpRegen, 0);
});

test('U-Official inspiration immunity is semantic and does not reject unrelated buffs', () => {
  const b = make([ULIKA]), u = deploy(b, ULIKA), atk = u.s.atk;
  assert.equal(b.addBuff(u, { key: 'producer:one', status: 'inspire', mods: { atkFlat: 500 } }), null);
  assert.equal(b.addBuff(u, { key: 'producer:two', tags: ['inspire'], mods: { atkFlat: 500 } }), null);
  near(u.s.atk, atk); assert.ok(b.addBuff(u, { key: 'test:normal', mods: { atkFlat: 10 } })); near(u.s.atk, atk + 10);
});

test('U-Official source startup stuns friendly and enemy ground/air units once, excluding herself and invalid targets', () => {
  const b = make([ULIKA, 'char_122_beagle'], { [ULIKA]: { potential: 6 } });
  const a = deploy(b, 'char_122_beagle', 2, 7), u = deploy(b, ULIKA), e = enemy(b), air = enemy(b, 6, 2, true), hidden = enemy(b, 7, 2);
  hidden.hidden = true; advance(b, 2.9); assert.equal(Boolean(a.s.flags.stun), false);
  advance(b, .2); assert.equal(a.s.flags.stun, true); assert.equal(e.s.flags.stun, true); assert.equal(air.s.flags.stun, true);
  assert.equal(Boolean(u.s.flags.stun), false); assert.equal(Boolean(hidden.s.flags.stun), false);
  advance(b, 7.6); assert.equal(Boolean(a.s.flags.stun), false); assert.equal(Boolean(e.s.flags.stun), false);
  const late = enemy(b); advance(b, 2); assert.equal(Boolean(late.s.flags.stun), false);
});

test('U-Official retains the permanent pending trigger when control interrupts its startup, then restarts once', () => {
  const b = make([ULIKA]), u = deploy(b, ULIKA), e = enemy(b); advance(b, 2.4);
  b.applyStatus(u, 'stun', { duration: 1 }); advance(b, 1.1); assert.equal(Boolean(e.s.flags.stun), false);
  advance(b, .8); assert.equal(Boolean(e.s.flags.stun), false); advance(b, .2); assert.equal(e.s.flags.stun, true);
  advance(b, 5.2); assert.equal(Boolean(e.s.flags.stun), false); advance(b, 2); assert.equal(Boolean(e.s.flags.stun), false);
});

test('PhonoR-0 deals source-fixed DARK gauge injury before ordinary Arts damage, with original projectile delay', () => {
  const b = make([PHONOR], { [PHONOR]: { potential: 6 } }), u = deploy(b, PHONOR), e = enemy(b);
  e.base.res = 50; e.markDirty(); advance(b, .1);
  b.forceAttack(u, [e]); advance(b, .4); near(e.hp, 100000); near(e.elem.apoptosis, 0);
  advance(b, .2); near(100000 - e.hp, u.s.atk * .5 * 1.1); near(e.elem.apoptosis, 60);
  near(e.s.elementalTakenMul, 1.1); near(e.s.artsTakenMul, 1.1);
  const hp = e.hp; near(b.dealDamage(u, e, { amount: 100, type: 'phys' }), 100); near(hp - e.hp, 100);
});

test('PhonoR-0 boosts elemental HP damage, not fixed buildup; the existing DARK burst deals 800 elemental per second', () => {
  const b = make([PHONOR], { [PHONOR]: { potential: 6 } }), u = deploy(b, PHONOR), e = enemy(b);
  advance(b, .1); e.elem.apoptosis = 940; b.forceAttack(u, [e]); advance(b, .6);
  assert.ok(e.findBuff('apoptosisBurst')); near(e.elem.apoptosis, 1000);
  const hp = e.hp; advance(b, 1); near(hp - e.hp, 800 * 1.1);
  const hp2 = e.hp; b.forceAttack(u, [e]); advance(b, .6); near(e.elem.apoptosis, 1000); near(hp2 - e.hp, u.s.atk * 1.1);
});

test('PhonoR-0 timed aura owns only its effects and restores stronger external statuses through eligibility changes', () => {
  const b = make([PHONOR], { [PHONOR]: { potential: 6 } }), u = deploy(b, PHONOR), e = enemy(b, 7, 2, true);
  advance(b, .1); near(e.s.artsTakenMul, 1.1); near(e.s.elementalTakenMul, 1.1);
  b.applyStatus(e, 'artsFragile', { key: 'test:strong', duration: 100, value: .3 }); near(e.s.artsTakenMul, 1.3);
  e.x = 1; advance(b, .1); near(e.s.artsTakenMul, 1.3); near(e.s.elementalTakenMul, 1);
  e.x = 7; advance(b, .1); near(e.s.elementalTakenMul, 1.1);
  b.addBuff(e, { key: 'test:unselectable', flags: { untargetable: true } }); advance(b, .1); near(e.s.elementalTakenMul, 1);
  b.removeBuff(e, 'test:unselectable'); advance(b, .1); near(e.s.elementalTakenMul, 1.1);
  advance(b, 40); near(e.s.artsTakenMul, 1.3); near(e.s.elementalTakenMul, 1); assert.equal(u.findBuff('phonor:talent'), null);
});

test('PhonoR-0 talent checks at projectile impact, expires at40s and removes owned aura immediately on retreat', () => {
  const b = make([PHONOR]), u = deploy(b, PHONOR), e = enemy(b); advance(b, 39.6);
  b.forceAttack(u, [e]); advance(b, .8); near(e.elem.apoptosis, 0); near(100000 - e.hp, u.s.atk); near(e.s.artsTakenMul, 1);
  const other = make([PHONOR]), unit = deploy(other, PHONOR), target = enemy(other); advance(other, .1);
  near(target.s.artsTakenMul, 1.03); other.retreatOperator(PHONOR); near(target.s.artsTakenMul, 1); near(target.s.elementalTakenMul, 1);
});
