// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { canTargetEnemy, enemyStealthed } from '../server/sim/targeting.js';

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
