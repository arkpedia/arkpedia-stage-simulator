// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { StageGramophones } from '../server/sim/content/arkpedia-stage-gramophones.js';
import { gramophoneDefinition, gramophoneNativeReviewed } from '../shared/arkpedia/stage-gramophones.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const close = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
function fixture(rank = 1) {
  const op = chessRec({ id: 'gramophone_test', stats: { atk: 0, maxHp: 10000, def: 0, res: 20 } });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { target: enemyRec({ hp: 10000, speed: 0, res: 20 }) } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }] });
  const b = h.b; b.start(); const ally = b.allyUnits[0];
  b.addBuff(ally, { key: 'test:hold', flags: { disarm: true, noBlock: true } });
  const controller = new StageGramophones(b, [{ name: "L-44 'Gramophone'", key: 'trap_014_tower',
    row: 9, col: 7, kind: 'device', hidden: false, instance: { level: 1, skillLevel: rank } }]);
  const d = [...controller.entries.values()][0], enemy = b.spawnEnemy('target', { pos: [9, 8] });
  b.addBuff(enemy, { key: 'test:hold', flags: { disarm: true, noMove: true } });
  return { h, b, ally, enemy, controller, d };
}
test('Gramophone native admission retains three modes, charge/target selectors and projectile contracts', () => {
  assert.equal(gramophoneNativeReviewed(), true);
  assert.deepEqual([1, 2, 3].map(skillLevel => gramophoneDefinition({ level: 1, skillLevel }).initSp), [50, 0, 100]);
  assert.throws(() => gramophoneDefinition({ level: 1, skillLevel: 4 }), /Unsupported/);
  for (const mutate of [
    n => n.prefabs.trap_014_tower.components.find(c => '_sideType' in c.data).data._sideType = 1,
    n => n.prefabs.trap_014_tower.components.find(c => c.data._postFilter === 19).data._postFilter = 17,
    n => n.templates['tower_t_4[attack]'].eventToActions.ON_BUFF_FINISH[0]._attributeType = 'ATK',
    n => n.prefabs.projectile_chr_tower_1.components.find(c => '_speed' in c.data).data._speed = 20,
  ]) { const changed = structuredClone(native); mutate(changed); assert.equal(gramophoneNativeReviewed(changed), false); }
});
test('each adjacent operator or summon charges once per second, including target-free states, but traps do not', () => {
  const { h, b, ally, d } = fixture();
  b.addBuff(ally, { key: 'test:hidden', flags: { untargetable: true, isolated: true, sleep: true } });
  const summon = b.spawnDevice('test:summon', 10, 7, { hp: 100 }); summon.mem.regularSummonCard = 'test';
  b.spawnDevice('test:ordinary-trap', 8, 7, { hp: 100 });
  h.run(.9); assert.equal(d.sp, 50); h.run(.1); assert.equal(d.sp, 52);
  summon.x = 3; h.run(.9); assert.equal(d.sp, 52); h.run(.1); assert.equal(d.sp, 53);
  assert.equal(d.unit.side, 'enemy'); assert.equal(d.unit.counted, false); assert.equal(d.unit.deploymentSlotCost, 0);
  assert.deepEqual(b.errors, []);
});
test('neutral capture and recapture retain faction, cancel casts and wait for the one-second transition', () => {
  const { h, b, ally, enemy, controller, d } = fixture();
  controller.modifySp(d.id, 50); h.run(.2); assert.equal(d.control, 'ally'); assert.equal(d.unit.side, 'enemy');
  h.run(.8); assert.equal(enemy.hp, 10000); assert.equal(b.projectiles.list.length, 0);
  h.run(1); close(enemy.hp, 9600); close(ally.hp, 10000);
  controller.modifySp(d.id, -100); h.run(.2); assert.equal(d.control, 'enemy'); assert.equal(d.cast, null);
  h.run(1.8); close(ally.hp, 9600); assert.equal(d.unit.side, 'enemy'); assert.deepEqual(b.errors, []);
});
test('attack chooses highest taunt then maximum HP, uses shared RES and follows the selected target', () => {
  const { h, b, enemy, d } = fixture(3);
  const larger = b.spawnEnemy('target', { pos: [10, 8], mods: { hpMul: 2 } });
  b.addBuff(larger, { key: 'test:hold', flags: { disarm: true, noMove: true } });
  h.run(2); close(larger.hp, 19200); close(enemy.hp, 10000);
  b.addBuff(enemy, { key: 'test:taunt', mods: { taunt: 1 } });
  h.run(1.5); close(enemy.hp, 9600); close(larger.hp, 19200);
  assert.equal(d.control, 'ally'); assert.deepEqual(b.errors, []);
});
test('fixed enemy faction means allied camouflage blocks even healing, while enemy target-free states do not', () => {
  const { b, ally, enemy, controller, d } = fixture(3);
  d.control = 'ally'; ally.hp = 5000; enemy.hp = 5000;
  const camou = b.addBuff(ally, { key: 'test:camou', flags: { camou: true } });
  b.addBuff(enemy, { key: 'test:hidden', flags: { camou: true, untargetable: true } });
  assert.equal(controller.target(d, true), undefined); assert.equal(controller.target(d, false), enemy);
  b.removeBuff(ally, camou); b.addBuff(ally, { key: 'test:isolation', flags: { isolated: true } });
  assert.equal(controller.target(d, true), ally);
  b.addBuff(enemy, { key: 'test:isolation', flags: { isolated: true } }); assert.equal(controller.target(d, false), undefined);
  b.addBuff(ally, { key: 'test:noHeal', flags: { healFree: true } }); assert.equal(controller.target(d, true), undefined);
  assert.deepEqual(b.errors, []);
});
test('periodic healing selects the lowest HP ratio and releases ten percent maximum HP after the cast delay', () => {
  const { h, b, ally, enemy, controller, d } = fixture(3);
  const other = b.spawnDevice('test:building', 10, 7, { hp: 20000 }); other.profile.enemyTargetableDevice = true; other.hp = 15000;
  ally.hp = 5000; enemy.y = 0;
  h.run(5); close(ally.hp, 5000); h.run(.7); close(ally.hp, 6000);
  controller.modifySp(d.id, -100); enemy.y = 9; enemy.hp = 5000;
  h.run(5); close(enemy.hp, 6000); assert.deepEqual(b.errors, []);
});
test('released projectiles survive a control switch, while pending cast target lives do not follow redeploys', () => {
  const { h, b, enemy, controller, d } = fixture(3);
  h.run(1.4); assert.equal(d.cast?.target, enemy);
  const cast = d.cast; enemy.deploySeq++; controller.release(d, cast); assert.equal(b.projectiles.list.length, 0);
  d.cast = null; controller.release(d, { target: enemy, life: enemy.deploySeq, healing: false });
  controller.switchMode(d, 'enemy'); h.run(.2); close(enemy.hp, 9600);
  assert.deepEqual(b.errors, []);
});
