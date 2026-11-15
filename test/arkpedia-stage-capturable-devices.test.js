// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { CapturableStageDevices } from '../server/sim/content/arkpedia-stage-capturable-devices.js';
import { capturableDeviceNativeReviewed, capturableDeviceDefinition } from '../shared/arkpedia/stage-capturable-devices.js';
import { enemyAmmo } from '../server/sim/content/arkpedia-enemy-ammo.js';
import { canTargetEnemy, canTargetAlly } from '../server/sim/targeting.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };

function fixture(side = 'ally', count = 1) {
  const op = chessRec({ id: 'supplier_test', stats: { atk: 0, maxHp: 10000, def: 0, res: 20 } });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { target: enemyRec({ hp: 10000, speed: 0, res: 20 }) } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }] });
  const b = h.b; b.start(); const ally = b.allyUnits[0];
  b.addBuff(ally, { key: 'test:stationary', flags: { disarm: true, noBlock: true } });
  const devices = Array.from({ length: count }, (_, i) => ({ name: "'Gelato Stop'", key: 'trap_057_wpnsts',
    row: 9 + i, col: 7, kind: 'device', hidden: false, instance: { level: 1, skillLevel: 1, skillIndex: side === 'ally' ? 0 : 1 } }));
  const controller = new CapturableStageDevices(b, devices), d = [...controller.entries.values()][0];
  const enemy = b.spawnEnemy('target', { pos: [9, 8] });
  b.addBuff(enemy, { key: 'test:stationary', flags: { disarm: true, noMove: true } });
  return { h, b, ally, enemy, controller, d };
}

test('Gelato admission checks original modes, status definitions, respawn and SP actions', () => {
  assert.equal(capturableDeviceNativeReviewed('trap_057_wpnsts'), true);
  for (const mutate of [
    n => n.prefabs.trap_057_wpnsts.components.find(c => '_maxRespawnCnt' in c.data).data._hpRechargeRatio = .5,
    n => n.templates['modify_sp[trigger]'].eventToActions.ON_BUFF_TRIGGER[0]._forceFlag = true,
    n => n.statusDefinitions.ELEMENT_FREE_ALL = 8,
  ]) {
    const n = structuredClone(native); mutate(n); assert.equal(capturableDeviceNativeReviewed('trap_057_wpnsts', n), false);
  }
  for (const skillIndex of [0, 1]) {
    const spec = capturableDeviceDefinition('trap_057_wpnsts', { level: 1, skillLevel: 1, skillIndex });
    assert.equal(spec.side, skillIndex ? 'enemy' : 'ally'); assert.equal(spec.stats.hp, 25000); assert.equal(spec.duration, 20);
  }
});

test('Gelato feeds real operator and ammunition accounts without bypassing active-skill locks or capacity', () => {
  const { h, ally, enemy, b, d } = fixture('ally');
  // Use the real SkillRuntime account; the content-free fixture has no kit.
  Object.assign(ally.skill, { noSkill: false, spType: 'attack', kind: 'duration' });
  b.addBuff(ally, { key: 'test:unhealable', flags: { noHeal: true, healFree: true } });
  ally.skill.setSpTotal(0); h.run(2); assert.equal(ally.skill.spTotal, 1);
  ally.skill.active = true; ally.skill.timeLeft = 20;
  h.run(2); assert.equal(ally.skill.spTotal, 1);
  ally.skill.active = false;
  enemy.mem.enemyAmmo = enemyAmmo(2, 0);
  b.changeDeviceSide(d.unit, 'enemy'); h.run(2); assert.equal(enemy.mem.enemyAmmo.current, 1);
  h.run(4); assert.equal(enemy.mem.enemyAmmo.current, 2); assert.equal(enemy.mem.enemyAmmo.gained, 2);
  assert.deepEqual(b.errors, []);
});

test('overlapping Gelato auras refill once per recipient, wait two seconds and reset on leaving range', () => {
  const { h, b, ally, enemy, controller } = fixture('ally', 2);
  const gains = []; ally.skill.gainSp = (amount, reason) => { gains.push({ amount, reason }); return amount; };
  enemy.mem.enemyAmmo = enemyAmmo(3, 0);
  h.run(1.9); assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 0);
  h.run(.1); assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 1);
  assert.equal(enemy.mem.enemyAmmo.current, 0);
  ally.x = 3; h.run(.1); ally.x = 6; h.run(1.9);
  assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 1);
  h.run(.1); assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 2);
  b.addBuff(ally, { key: 'test:noSp', flags: { noSp: true } }); h.run(2);
  assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 2);
  b.removeBuff(ally, 'test:noSp');
  b._remove([...controller.entries.values()][0].unit, 'expired'); h.run(2);
  assert.equal(gains.filter(g => g.reason === 'stage:supplyStation').length, 3, 'surviving overlapping station retains the recipient clock');
  assert.deepEqual(b.errors, []);
});

test('capture blasts the former faction, changes targeting immediately, reboots and can repeat without wave credit', () => {
  const { h, b, ally, enemy, d } = fixture('enemy');
  enemy.mem.enemyAmmo = enemyAmmo(2, 0);
  h.run(2); assert.equal(enemy.mem.enemyAmmo.current, 1);
  assert.equal(canTargetEnemy(ally, d.unit, {}), true);
  const before = enemy.hp, killed = b.killed, life = b.life;
  const damage = b.dealDamage(ally, d.unit, { amount: 30000, type: 'true' });
  assert.equal(damage, 25000); assert.equal(d.state, 'rebooting'); assert.equal(d.unit.hp, 1);
  assert.equal(enemy.hp, before - 800); assert.equal(enemy.s.flags.stun, true);
  assert.equal(ally.hp, 10000); assert.equal(d.unit.side, 'ally');
  assert.equal(b.enemies.includes(d.unit), false); assert.equal(b.allyUnits.includes(d.unit), true);
  assert.equal(b.enemiesInKeys(d.unit.rangeKeys, ally, {}).includes(d.unit), false);
  assert.equal(canTargetAlly(enemy, d.unit, true), false);
  assert.equal(b._occ[9 * b.grid.cols + 7], d.unit);
  h.run(19.9); assert.equal(d.unit.hp, 1); assert.equal(d.state, 'rebooting');
  h.run(.1); assert.equal(d.unit.hp, 25000); assert.equal(d.state, 'active');
  assert.equal(canTargetAlly(enemy, d.unit, true), true);
  b.addBuff(ally, { key: 'test:evade', mods: { dodgeArts: 1 } });
  b.dealDamage(enemy, d.unit, { amount: 30000, type: 'true' });
  assert.equal(ally.hp, 10000, 'capture Arts damage may be evaded'); assert.equal(ally.s.flags.stun, true, 'the status is independently unmissable');
  assert.equal(d.unit.side, 'enemy'); assert.equal(d.captures, 2);
  assert.equal(b.killed, killed); assert.equal(b.life, life);
  assert.equal(h.hooksOf('death').some(e => e.unit === d.unit), false);
  h.run(20); assert.equal(d.unit.hp, 25000); assert.deepEqual(b.errors, []);
});

test('Gelato regeneration, displacement/status/element/environment immunity and enemy-side removal use common bookkeeping', () => {
  const { h, b, ally, d } = fixture('enemy');
  const u = d.unit; u.hp -= 300; h.run(2); assert.equal(u.hp, 24850);
  assert.equal(b.heal(ally, u, 200), 0);
  assert.equal(b.displace(u, { x: -1, y: 0 }, 2), 0);
  for (const key of ['stun', 'freeze', 'silence', 'cold', 'disarm', 'sleep']) assert.equal(b.applyStatus(u, key, { duration: 10 }), false, key);
  assert.equal(b.dealDamage(ally, u, { amount: 200, type: 'element', element: 'burn' }), 0);
  assert.equal(b.dealDamage(null, u, { amount: 200, type: 'true', isEnvironment: true }), 0);
  assert.equal(b.dealDamage(null, u, { amount: 200, type: 'true', sourceless: true }), 200);
  b._remove(u, 'expired'); assert.equal(b._occ[9 * b.grid.cols + 7], null);
  assert.equal(b.grid.tile(9, 7).pass, 'ALL'); assert.equal(d.state, 'spent');
  assert.deepEqual(b.errors, []);
});

test('enemy-held stations do not keep an otherwise completed stage open', () => {
  const { h, b, enemy, d } = fixture('enemy');
  b.autoFinish = true; b.kill(enemy); h.run(.1);
  assert.equal(b.reason, 'cleared'); assert.equal(d.unit.alive, true); assert.equal(b.killed, 1);
});

test('original Gelato skill index is retained without copying device source per stage', async () => {
  const c = await loadContentContext();
  for (const [id, skillIndex] of [['ga-4', 1], ['ga-5', 0]]) {
    const p = await planStage(c, id); assert.deepEqual(p.blockers, []);
    assert.ok(p.stage.devices.filter(d => d.key === 'trap_057_wpnsts').every(d => d.instance.skillIndex === skillIndex));
    assert.ok(p.localSources.some(s => s.path === 'data/arkpedia-device-native-source.json'));
  }
});
