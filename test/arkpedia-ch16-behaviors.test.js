// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { chapter16Environment, pollute, beamIntersection } from '../server/sim/content/chapter16.js';
import { canTargetEnemy } from '../server/sim/targeting.js';
import { battle, keys } from './helpers/ch17Harness.js';

test('miner gets independent range healing from Medics, without using their attack cooldown', () => {
  const { h, e } = battle(keys[0], [{ profession: 'MEDIC', stats: { atk: 400 }, rangeGrid: [[0, 0], [0, 1]] }]);
  e.hp = 1000; h.run(1.01); assert.equal(e.hp, 1200);
  assert.equal(e.profile.friendly, true); assert.equal(e.s.flags.unblockable, true);
  assert.equal(canTargetEnemy(h.allies()[0], e), false);
});

test('miner suppresses nine tiles for three seconds, stops refreshing when feared, loses true HP only while injured', () => {
  const { h, b, e } = battle(keys[0]);
  h.run(0.31); const env = chapter16Environment(b);
  assert.equal(env.shadowSuppressedUntil.size, 9);
  const until = env.shadowSuppressedUntil.get(10 * 21 + 6);
  b.applyStatus(e, 'fear', { duration: 5 }); h.run(1.5); assert.equal(e.hp, 3000);
  assert.equal(env.shadowSuppressedUntil.get(10 * 21 + 6), until);
  e.hp = 2000; h.run(1.01); assert.equal(e.hp, 1800);
});

test('Trimortalis retaliates without a damage source and pollution changes damage/radius for five seconds', () => {
  const { h, b, e } = battle(keys[2], [{ stats: { atk: 0, def: 0, maxHp: 10000 } }, { stats: { atk: 0, def: 0, maxHp: 10000 } }]);
  const [u, v] = h.allies();
  b.dealDamage(u, e, { amount: 1, type: 'true' }); assert.equal(u.hp, 9650); assert.equal(v.hp, 10000);
  pollute(b, e); b.dealDamage(u, e, { amount: 1, type: 'true' }); assert.equal(u.hp, 9100); assert.equal(v.hp, 9450);
  h.run(5.1); const before = v.hp; b.dealDamage(u, e, { amount: 1, type: 'true' }); assert.equal(v.hp, before);
});

test('war caster raw threshold breaks the shield without swallowing the breaking hit; true damage bypasses it', () => {
  const { b, e } = battle(keys[4]);
  assert.equal(e.s.def, 1080); assert.equal(e.s.res, 20);
  b.dealDamage(null, e, { amount: 1199, type: 'arts' }); assert.equal(e.hp, 38000);
  b.dealDamage(null, e, { amount: 10, type: 'true' }); assert.equal(e.hp, 37990);
  b.dealDamage(null, e, { amount: 1200, type: 'arts' }); assert.equal(e.hp, 37270);
  assert.equal(e.s.def, 900); assert.equal(e.s.res, 40);
});

test('war caster restores shield only from a Leak Source and steals ATK during its channel', () => {
  const { h, b, e, a } = battle(keys[4], [{ stats: { atk: 500, def: 0, maxHp: 50000 }, rangeGrid: [[0, 0]] }]);
  const u = h.allies()[0];
  b.dealDamage(null, e, { amount: 1200, type: 'arts' }); h.run(5.1);
  assert.equal(e.mem.ch16Shield, false); pollute(b, e); assert.equal(e.mem.ch16Shield, true);
  a.left = 0; h.run(.3); assert.equal(u.s.atk, 450); assert.equal(e.s.atk, 800);
  b.kill(e, null); assert.equal(u.s.atk, 500);
});

test('Leak Source binds the earliest operator, grants eight SP and exits at four seconds', () => {
  const { h, b, e, a } = battle(keys[5], [{ stats: { atk: 0, maxHp: 10000, spRecovery: 0 } }, { stats: { atk: 0, maxHp: 10000, spRecovery: 0 } }]);
  const [u, v] = h.allies(); h.run(0.1);
  assert.equal(a.target, u); assert.equal(u.s.flags.stun, true); assert.ok(!v.s.flags.stun);
  h.run(4.01); assert.equal(e.alive, false); assert.equal(u.skill.sp, 8); assert.equal(v.skill.sp, 8); assert.ok(!u.s.flags.stun);
  assert.equal(h.hooksOf('enemyLeak').length, 0);
});

test('Leak Source naturally reveals at fifty SP and exits twenty seconds later', () => {
  const { h, e, a } = battle(keys[5]);
  h.run(49.9); assert.ok(!a.levelled); h.run(0.2); assert.equal(a.levelled, true); assert.equal(e.s.atk, 22.5);
  h.run(20.1); assert.equal(e.alive, false);
});

test('beam collision uses swept segments, including targets between frames', () => {
  assert.equal(beamIntersection(0, 0, 10, 0, { x: 5, y: 0 }), 0.44);
  assert.equal(beamIntersection(0, 0, 10, 0, { x: 5, y: 1 }), null);
});

test('ChargeRift waits five seconds, channels marker SP, and ends when full', () => {
  const { h, b, e, a } = battle(keys[1]);
  const marker = { alive: true, x: e.x, y: e.y, sp: 0, spCost: 2, gainSp(n) { this.sp += n; } };
  chapter16Environment(b).rifts.push(marker);
  h.run(4.9); assert.equal(marker.sp, 0); h.run(.3); assert.equal(marker.sp, 1); assert.equal(e.s.def, 2100);
  h.run(1.1); assert.equal(marker.sp, 2); assert.ok(!a.target); assert.equal(e.s.def, 700);
});

test('Likho death uses map-validated tiles and creates one canonical Leak Source', () => {
  const { b, e } = battle(keys[3]);
  chapter16Environment(b).summonTiles = () => [[10, 7]];
  b.kill(e, null);
  const children = b.enemies.filter(u => u.defId === keys[5]);
  assert.equal(children.length, 1); assert.equal(children[0].tileC, 7); assert.ok(children[0].mem.ch16Leak);
});

test('ranged enemies select a neutral miner, while its elemental gauge is immune', () => {
  const { h, b, e } = battle(keys[0]);
  const attacker = h.spawn('enemy_1108_uterer', { pos: [10, 5], def: { key: 'ranged-probe', applyWay: 'RANGED', stats: { maxHp: 10000, atk: 1000, def: 0, res: 0, rangeRadius: 3, bat: 1, moveSpeed: 0 } } });
  b.dealDamage(attacker, e, { amount: 100, type: 'element', element: 'burn' }); assert.equal(e.elem.burn, 0);
  const before = e.hp; h.run(1.1); assert.ok(e.hp < before);
});

test('ChargeRift ends its fifteen-second channel even if the marker is not full', () => {
  const { h, b, e, a } = battle(keys[1]);
  const marker = { alive: true, x: e.x, y: e.y, sp: 0, spCost: 100, gainSp(n) { this.sp += n; } };
  chapter16Environment(b).rifts.push(marker); h.run(20.2);
  assert.equal(marker.sp, 15); assert.ok(!a.target); assert.equal(e.s.def, 700);
});

test('Likho default tile filter includes deployable walkable tiles and excludes an existing Leak Source', () => {
  const { h, b, e } = battle(keys[3]);
  h.spawn(keys[5], { pos: [10, 7] });
  const tiles = chapter16Environment(b).summonTiles(e);
  assert.ok(tiles.some(([r, c]) => r === 10 && c === 6));
  assert.ok(!tiles.some(([r, c]) => r === 10 && c === 7));
});
