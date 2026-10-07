// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { canTargetEnemy, enemyStealthed } from '../server/sim/targeting.js';
import { Unit } from '../server/sim/units.js';
import { makeBuff } from '../server/sim/buffs.js';
import { performAttack } from '../server/sim/ai.js';

function make() {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = [{ enemy_id: 'enemy_1007_slime', count: 1, time: 0, interval: 0, route: 1 }];
  Object.assign(source.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0 });
  const b = new StandardBattle(source, { operators: [defaultBuild(source.operators.char_122_beagle)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const unit = b.deployOperator('char_122_beagle', 2, 7, 'RIGHT'); unit.atkCd = 100;
  b.step(); const enemy = b.enemies[0]; enemy.x = 7; enemy.y = 2;
  b.addBuff(enemy, { key: 'test:pin', flags: { noMove: true } });
  return { b, unit, enemy };
}

test('final block scaling overrides additional block buffs, releases blocked enemies, and restores capacity on expiry', () => {
  const { b, unit, enemy } = make();
  b.addBuff(unit, { key: 'test:extra-block', mods: { blockCnt: 5 } });
  assert.equal(unit.s.blockCnt, 8);
  unit.blocking = [enemy]; enemy.blockedBy = unit;
  b.addBuff(unit, { key: 'test:channel', duration: .1, mods: { blockCntMul: 0 } });
  assert.equal(unit.s.blockCnt, 0); assert.equal(b._blockerFor(unit, enemy, 1), false);
  b.step(); assert.equal(enemy.blockedBy, null); assert.deepEqual(unit.blocking, []);
  for (let i = 0; i < 10; i++) b.step();
  assert.equal(unit.s.blockCnt, 8); assert.equal(enemy.blockedBy, unit);
  assert.equal(b._blockerFor(unit, enemy, 7), true);
  assert.equal(b._blockerFor(unit, enemy, 8), false, 'the reblocked enemy uses one slot');
  assert.deepEqual(b.errors, []);
});

test('ignoring stealth is confined to an attack profile and does not bypass other targeting restrictions', () => {
  const { b, unit, enemy } = make();
  b.addBuff(enemy, { key: 'test:stealth', flags: { stealth: true } });
  assert.equal(enemyStealthed(enemy), true);
  const normal = { canHitFly: true }, ignoresStealth = { ...normal, ignoreStealth: true };
  assert.equal(canTargetEnemy(unit, enemy, normal), false);
  assert.equal(canTargetEnemy(unit, enemy, ignoresStealth), true);
  assert.equal(enemyStealthed(enemy), true, 'does not reveal the enemy to other operators');
  assert.equal(canTargetEnemy(unit, enemy, normal), false);
  b.addBuff(enemy, { key: 'test:untargetable', flags: { untargetable: true } });
  assert.equal(canTargetEnemy(unit, enemy, ignoresStealth), false);
  b.removeBuff(enemy, 'test:untargetable');
  b.addBuff(enemy, { key: 'test:sleep', flags: { sleep: true } });
  assert.equal(canTargetEnemy(unit, enemy, ignoresStealth), false);
  b.removeBuff(enemy, 'test:sleep'); enemy.motion = 'FLY';
  assert.equal(canTargetEnemy(unit, enemy, { ignoreStealth: true }), false);
  assert.equal(canTargetEnemy(unit, enemy, { ...ignoresStealth, groundOnly: true }), false);
  enemy.hidden = true; assert.equal(canTargetEnemy(unit, enemy, ignoresStealth), false);
});

test('owned cloud statuses do not compound Sluggish or erase another source on exit', () => {
  const { b, unit, enemy } = make(); enemy.base.moveSpeed = 1; enemy.markDirty();
  b.applyStatus(enemy, 'sluggish', { duration: 1, source: unit });
  b.applyStatus(enemy, 'sluggish', { key: 'cloud:a:sluggish', duration: 2, source: unit });
  b.applyStatus(enemy, 'sluggish', { key: 'cloud:b:sluggish', duration: 3, source: unit });
  b.applyStatus(enemy, 'silence', { key: 'cloud:a:silence', duration: 2, source: unit });
  b.applyStatus(enemy, 'silence', { key: 'cloud:b:silence', duration: 3, source: unit });
  assert.equal(enemy.s.moveSpeed, .2);
  b.removeBuff(enemy, 'cloud:a:sluggish'); b.removeBuff(enemy, 'cloud:a:silence');
  assert.equal(enemy.s.moveSpeed, .2); assert.equal(enemy.s.flags.silence, true);
  b.removeBuff(enemy, 'cloud:b:sluggish'); b.removeBuff(enemy, 'cloud:b:silence');
  assert.equal(enemy.s.moveSpeed, .2); assert.equal(enemy.s.flags.silence, undefined);
  for (let i = 0; i < Math.ceil(1.1 / b.dt); i++) b.step();
  assert.equal(enemy.s.moveSpeed, 1); assert.equal(enemy.findBuff('sluggish'), null);
  b.addBuff(enemy, { key: 'test:unrelated-speed', mods: { moveMul: .5 } });
  b.applyStatus(enemy, 'sluggish', { key: 'cloud:c:sluggish', duration: 1, source: unit });
  assert.equal(enemy.s.moveSpeed, .1, 'an independent speed modifier keeps its own formula');
});

test('final DEF/MAX_HP additions follow percentage/scaler modifiers and preserve existing wounded HP ratio', () => {
  const u = new Unit({ id: 'inspire-test', base: { maxHp: 1000, atk: 200, def: 100 } });
  void u.s; u.hp = 400;
  u.buffs = [makeBuff({ key: 'ordinary', mods: { atkFlat: 20, atkPct: .5, atkMul: 2,
    defFlat: 10, defPct: 1, defMul: .5, hpFlat: 100, hpPct: .5, hpMul: 2 } }),
    makeBuff({ key: 'final', mods: { atkFinalFlat: 70, defFinalFlat: 80, hpFinalFlat: 500 } })];
  u.markDirty(); assert.equal(u.s.atk, 730); assert.equal(u.s.def, 190);
  assert.equal(u.s.maxHp, 3800); assert.equal(u.hp, 1520);
  u.buffs.pop(); u.markDirty(); assert.equal(u.s.maxHp, 3300); assert.equal(u.hp, 1320);
  u.buffs = []; u.markDirty(); assert.equal(u.s.maxHp, 1000); assert.equal(u.hp, 400);
});

test('owned Inspire chooses highest per attribute with weaker fallback and independent additive channels', () => {
  const u = new Unit({ id: 'inspire-test', base: { maxHp: 1000, atk: 200, def: 100 } });
  u.buffs = [makeBuff({ key: 'sora', tags: ['inspire'], mods: { atkFinalFlat: 100 } }),
    makeBuff({ key: 'heidi-a', tags: ['inspire'], mods: { atkFinalFlat: 200, defFinalFlat: 40, hpFinalFlat: 300 } }),
    makeBuff({ key: 'heidi-b', tags: ['inspire'], mods: { atkFinalFlat: 150, defFinalFlat: 80, hpFinalFlat: 200 } }),
    makeBuff({ key: 'other-final', mods: { atkFinalFlat: 10, defFinalFlat: 20, hpFinalFlat: 50 } })];
  u.markDirty(); assert.equal(u.s.atk, 410); assert.equal(u.s.def, 200); assert.equal(u.s.maxHp, 1350);
  u.buffs = u.buffs.filter(b => b.key !== 'heidi-a'); u.markDirty();
  assert.equal(u.s.atk, 360); assert.equal(u.s.def, 200); assert.equal(u.s.maxHp, 1250);
  u.buffs = u.buffs.filter(b => b.key !== 'heidi-b'); u.markDirty();
  assert.equal(u.s.atk, 310); assert.equal(u.s.def, 120); assert.equal(u.s.maxHp, 1050);
  u.buffs = u.buffs.filter(b => b.key !== 'sora'); u.markDirty(); assert.equal(u.s.atk, 210);
});

test('Vigor keeps strongest owned ATK bonus, unrelated percentage buffs, and weaker fallback', () => {
  const { b, unit } = make(), base = unit.base.atk;
  b.addBuff(unit, { key: 'self:vigor', status: 'vigor', data: { value: .2 }, mods: { atkPct: .2 } });
  b.addBuff(unit, { key: 'pallas:vigor', status: 'vigor', duration: .1, data: { value: .5 }, mods: { atkPct: .5 } });
  b.addBuff(unit, { key: 'ordinary:atk', mods: { atkPct: .3 } });
  assert.equal(unit.s.atk, base * 1.8);
  for (let i = 0; i < 4; i++) b.step();
  assert.equal(unit.s.atk, base * 1.5); assert.ok(unit.findBuff('self:vigor'));
  b.removeBuff(unit, 'self:vigor'); assert.equal(unit.s.atk, base * 1.3);
});

test('damage HP floor limits post-shield damage, never raises low HP, and HP loss bypasses it', () => {
  const { b, unit, enemy } = make(), hp = unit.s.maxHp;
  b.addBuff(unit, { key: 'floor', mods: { damageHpFloorRatio: .5 } });
  b.addBuff(unit, { key: 'shield', shield: hp });
  b.dealDamage(enemy, unit, { amount: hp * 2, type: 'true' });
  assert.equal(unit.hp, hp * .5); assert.equal(unit.findBuff('shield'), null);
  b.dealDamage(enemy, unit, { amount: hp, type: 'true' }); assert.equal(unit.hp, hp * .5);
  unit.hp = hp * .3;
  b.dealDamage(enemy, unit, { amount: hp, type: 'true' }); assert.equal(unit.hp, hp * .3);
  b.loseHp(unit, hp * .2, { source: enemy }); assert.ok(Math.abs(unit.hp - hp * .1) < 1e-7);
  b.loseHp(unit, hp, { source: enemy }); assert.equal(unit.alive, false);
});

test('multiple damage floors take highest ratio with expiry fallback, while scripted kill still removes the unit', () => {
  const { b, unit, enemy } = make(), hp = unit.s.maxHp;
  b.addBuff(unit, { key: 'low-floor', mods: { damageHpFloorRatio: .2 } });
  b.addBuff(unit, { key: 'high-floor', duration: .1, mods: { damageHpFloorRatio: .5 } });
  assert.equal(unit.s.damageHpFloorRatio, .5);
  for (let i = 0; i < 4; i++) b.step(); assert.equal(unit.s.damageHpFloorRatio, .2);
  b.dealDamage(enemy, unit, { amount: hp * 2, type: 'true' });
  assert.ok(Math.abs(unit.hp - hp * .2) < 1e-7);
  b.kill(unit, enemy); assert.equal(unit.alive, false);
});

test('accepted action-stopping effects interrupt an unfired attack even when shorter than one tick', () => {
  for (const status of ['stun', 'freeze', 'sleep', 'levitate']) {
    const { b, unit, enemy } = make(); unit.atkCd = 1000;
    performAttack(b, unit, { ...unit.profile, windup: .2 }, [enemy]);
    assert.equal(b.applyStatus(unit, status, { duration: .001, source: enemy }), true);
    for (let i = 0; i < 7; i++) b.step();
    assert.equal(unit.canAct, true); assert.equal(enemy.hp, 100000);
    performAttack(b, unit, { ...unit.profile, windup: .1 }, [enemy]);
    for (let i = 0; i < 4; i++) b.step();
    assert.ok(enemy.hp < 100000, `${status} cannot cancel subsequent attacks`);
    assert.deepEqual(b.errors, []);
  }
});

test('only accepted action-stopping buffs advance interruption; removed controls still cancel pending attacks', () => {
  const { b, unit, enemy } = make(); unit.atkCd = 1000;
  b.addBuff(unit, { key: 'test:resist', status: 'resist', data: { value: .5 } });
  const epoch = unit.attackControlEpoch;
  b.addBuff(unit, { key: 'test:slow', mods: { aspd: -10 } });
  b.applyStatus(unit, 'bind', { duration: .001 });
  assert.equal(unit.attackControlEpoch, epoch);
  b.on('beforeStatus', c => { if (c.status === 'stun') c.cancel = true; });
  assert.equal(b.applyStatus(unit, 'stun', { duration: .1 }), false);
  assert.equal(unit.attackControlEpoch, epoch);
  performAttack(b, unit, { ...unit.profile, windup: .2 }, [enemy]);
  b.addBuff(unit, { key: 'test:disarm', flags: { disarm: true }, duration: 1 });
  b.removeBuff(unit, 'test:disarm');
  for (let i = 0; i < 7; i++) b.step();
  assert.equal(unit.canAct, true); assert.equal(enemy.hp, 100000);
  b.addBuff(unit, { key: 'test:keep', refresh: 'keep' });
  const accepted = unit.attackControlEpoch;
  b.addBuff(unit, { key: 'test:keep', flags: { stun: true }, refresh: 'keep' });
  assert.equal(unit.attackControlEpoch, accepted);
});

test('owned Weightless instances do not compound and preserve an unrelated mass modifier', () => {
  const { b, unit } = make(); unit.base.massLevel = 5; unit.markDirty();
  b.applyStatus(unit, 'weightless', { key: 'angelina:a:weightless', duration: 1, value: 1 });
  b.applyStatus(unit, 'weightless', { key: 'angelina:b:weightless', duration: 2, value: 1 });
  b.addBuff(unit, { key: 'ordinary:mass', mods: { massFlat: -1 } });
  assert.equal(unit.s.massLevel, 3);
  b.removeBuff(unit, 'angelina:a:weightless'); assert.equal(unit.s.massLevel, 3);
  b.removeBuff(unit, 'angelina:b:weightless'); assert.equal(unit.s.massLevel, 4);
  b.removeBuff(unit, 'ordinary:mass'); assert.equal(unit.s.massLevel, 5);
});
