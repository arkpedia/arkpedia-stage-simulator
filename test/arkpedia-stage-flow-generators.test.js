// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { flowGeneratorDefinition, flowGeneratorNativeReviewed } from '../shared/arkpedia/stage-flow-generators.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), p = await planStage(c, 'mn-1');
assert.deepEqual(p.blockers, []);
const close = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
function setup({ rank = 1, overlap = false } = {}) {
  const stage = structuredClone(p.stage); stage.devices = [stage.devices[1]];
  stage.devices[0].instance.skillLevel = rank;
  if (overlap) stage.devices.push({ ...structuredClone(stage.devices[0]), col: 5 });
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: ['char_123_fang', 'char_124_kroos'].map(id => defaultBuild(c.mvp.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const controller = b.stageFlowGenerators, d = [...controller.entries.values()][0];
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  const operator = (dir = 'RIGHT') => {
    const u = b.deployOperator('char_123_fang', 3, 7, dir);
    b.addBuff(u, { key: 'test:hold', flags: { disarm: true } }); return u;
  };
  const enemy = (start = [3, 7], end = [3, 9]) => {
    const u = b.spawnEnemy('enemy_1099_nbkght', { pos: start, route: { motion: 'FLY', start, end } });
    u.motion = 'FLY';
    b.addBuff(u, { key: 'test:hold', flags: { disarm: true, unblockable: true } }); return u;
  };
  return { b, d, controller, advance, operator, enemy };
}
test('Flow Generators admit only reviewed native range, direction and two skill ranks', () => {
  assert.equal(flowGeneratorNativeReviewed(), true);
  assert.equal(flowGeneratorDefinition({ level: 1, skillLevel: 1, direction: 'RIGHT' }).speedBonus, .8);
  assert.equal(flowGeneratorDefinition({ level: 30, skillLevel: 2, direction: 'UP' }).speedBonus, .5);
  for (const instance of [{ level: 1, skillLevel: 3, direction: 'RIGHT' }, { level: 1, skillLevel: 1 }, { level: 0, skillLevel: 1, direction: 'UP' }])
    assert.throws(() => flowGeneratorDefinition(instance), /Unsupported/);
  for (const [key, field, value] of [['trap_013_blower', '_rewriteTileOptions', 1], ['trap_013_blower', '_occupiedRemainingCharacterCnt', 1],
    ['sktok_blower', '_removeBuffWhenTargetLeave', 0]]) {
    const changed = structuredClone(native); changed.prefabs[key].components.find(c => field in c.data).data[field] = value;
    assert.equal(flowGeneratorNativeReviewed(changed), false);
  }
});
test('operator bonuses add to ATK buffs, penalties multiply final ATK, and perpendicular facing has no effect', () => {
  for (const [direction, factor] of [['RIGHT', 1.8], ['LEFT', 1.5 * .7], ['UP', 1.5], ['DOWN', 1.5]]) {
    const { b, controller, operator } = setup(), u = operator(direction), base = u.s.atk;
    b.addBuff(u, { key: 'test:atk', mods: { atkPct: .5 } }); controller.tick(b.dt);
    close(u.s.atk, base * factor);
    assert.equal(u.buffs.filter(b => b.key === 'blower_s[atk]').length, direction === 'RIGHT' || direction === 'LEFT' ? 1 : 0);
    assert.deepEqual(b.errors, []);
  }
});
test('overlap has one owner; retreat hands off or cleans up without changing deployment tiles or consuming slots', () => {
  const { b, d, controller, operator } = setup({ overlap: true }), u = operator(), base = u.s.atk;
  const tile = structuredClone(b.grid.tile(3, 6)), dp = b.dp;
  controller.tick(b.dt); close(u.s.atk, base * 1.3);
  assert.equal(d.unit.deploymentSlotCost, 0); assert.equal(d.unit.def.profession, 'TRAP');
  controller.retreat(d.id); close(u.s.atk, base * 1.3);
  assert.equal(u.buffs.filter(b => b.key === 'blower_s[atk]').length, 1);
  controller.retreat([...controller.entries.keys()][1]); close(u.s.atk, base);
  assert.equal(b.dp, dp); assert.deepEqual(b.grid.tile(3, 6), tile);
  assert.throws(() => controller.retreat(d.id), /no longer available/); assert.deepEqual(b.errors, []);
});
test('ally aura excludes devices and isolation, reaches airborne operators, and releases departed targets', () => {
  const { b, controller, operator } = setup(), u = operator(), base = u.s.atk;
  u.motion = 'FLY'; b.addBuff(u, { key: 'test:camou', flags: { camou: true } });
  const device = b.spawnDevice('test:flow-target', 3, 8, { atk: 100 });
  controller.tick(b.dt); close(u.s.atk, base * 1.3); close(device.s.atk, 100);
  const isolation = b.addBuff(u, { key: 'test:isolate', flags: { isolated: true } });
  controller.tick(b.dt); close(u.s.atk, base);
  b.removeBuff(u, isolation); controller.tick(b.dt); close(u.s.atk, base * 1.3);
  u.y = 5; controller.tick(b.dt); close(u.s.atk, base);
  assert.deepEqual(b.errors, []);
});
test('enemy movement is polled after 0.3s, with additive tailwind and final headwind at both ranks', () => {
  for (const rank of [1, 2]) for (const forward of [true, false]) {
    const { b, controller, advance, enemy } = setup({ rank });
    const u = enemy([3, forward ? 7 : 8], [3, forward ? 9 : 6]), base = u.s.moveSpeed;
    b.addBuff(u, { key: 'test:speed', mods: { movePct: .2 } });
    advance(.2); close(u.s.moveSpeed, base * 1.2);
    advance(.2); close(u.s.moveSpeed, base * (forward ? 1.2 + (rank === 1 ? .8 : .5) : 1.2 * .5));
    assert.equal(controller.moveDirection(u), forward ? 'RIGHT' : 'LEFT'); assert.deepEqual(b.errors, []);
  }
});
test('enemy turns clear or reverse speed modifiers, and untargetable/healer recipients are excluded', () => {
  const { b, controller, advance, enemy } = setup(), u = enemy(), base = u.s.moveSpeed;
  advance(.4); close(u.s.moveSpeed, base * 1.8);
  // Keep the same recipient in range while changing its actual displacement.
  u.moving = true; u.x -= .1; controller.tick(.31); close(u.s.moveSpeed, base * .5);
  u.y += .1; controller.tick(.31); close(u.s.moveSpeed, base);
  u.x += .1; controller.tick(.31); close(u.s.moveSpeed, base * 1.8);
  const hidden = b.addBuff(u, { key: 'test:hidden', flags: { untargetable: true } });
  controller.tick(.31); close(u.s.moveSpeed, base);
  b.removeBuff(u, hidden); u.def = { ...u.def, dmgType: 'heal' }; controller.tick(.31); close(u.s.moveSpeed, base);
  assert.deepEqual(b.errors, []);
});
