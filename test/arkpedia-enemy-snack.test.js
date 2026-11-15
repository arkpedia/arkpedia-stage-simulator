// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { CapturableStageDevices } from '../server/sim/content/arkpedia-stage-capturable-devices.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

function fixture(id) {
  const target = chessRec({ id: 'snack_target', stats: { atk: 0, maxHp: 1e6, def: 100, res: 20 } });
  const keys = [id, 'enemy_1218_bomscr', 'enemy_1218_bomscr_2'];
  const enemies = Object.fromEntries(keys.map(k => [k, structuredClone(ENEMY_RECORDS.enemies[k].levels[0])]));
  enemies[id].stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120, captureNoisy: true,
    defs: { chess: { [target.chessId]: target }, enemies },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  b.addBuff(u, { key: 'test:noBlock', flags: { disarm: true, noBlock: true } });
  const e = b.spawnEnemy(id, { pos: [9, 7], route: { motion: 'WALK', start: [9, 7], end: [9, 2], checkpoints: [[9, 5]] } });
  return { h, b, u, e };
}

test('Dessert Vendors spend exactly three rounds on route-following children and can reload through a Gelato aura', () => {
  for (const id of ['enemy_1217_rescar', 'enemy_1217_rescar_2']) {
    const { h, b, e } = fixture(id), children = [];
    b.on('enemySpawn', ({ enemy }) => { if (enemy !== e) children.push(enemy); });
    b.applyStatus(e, 'silence', { duration: 60 }); h.run(4.9); assert.equal(children.length, 0);
    h.run(35); assert.equal(children.length, 3); assert.equal(e.mem.enemyAmmo.current, 0);
    assert.ok(children.every(c => c.defId === (id.endsWith('_2') ? 'enemy_1218_bomscr_2' : 'enemy_1218_bomscr')));
    assert.ok(children.every(c => c.route.legs.at(-1).c === 2 && c.counted));
    h.run(5); assert.equal(children.length, 3);
    new CapturableStageDevices(b, [{ key: 'trap_057_wpnsts', name: "'Gelato Stop'", hidden: false,
      row: 10, col: 7, instance: { level: 1, skillIndex: 1, skillLevel: 1 } }]);
    assert.ok(h.runUntil(() => children.length > 3, 8)); assert.ok(e.mem.enemyAmmo.gained >= 1);
    assert.deepEqual(b.errors, []);
  }
});

test('a released vendor summon holds battle completion and survives source death during its scheduler delay', () => {
  const { h, b, e } = fixture('enemy_1217_rescar');
  assert.ok(h.runUntil(() => b._sched.some(s => s.holdsBattle && !s.cancelled), 8));
  b.autoFinish = true; b.kill(e); h.step(1); assert.equal(b.finished, false);
  assert.ok(h.runUntil(() => b.enemies.some(c => c.defId === 'enemy_1218_bomscr'), 1));
  assert.equal(b.total, 2); assert.deepEqual(b.errors, []);
});

test('vendor melee damage uses its native multiplier before DEF while its ranged projectile uses ordinary ATK', () => {
  const { h, b, u, e } = fixture('enemy_1217_rescar');
  e.mem.enemyAmmo.modify(-3); // Isolate combat from independently damaging children.
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 2)); h.run(.5);
  assert.equal(u.stats.taken, e.s.atk - 100);
  b.removeBuff(u, 'test:noBlock'); b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  e.x = u.x + .3;
  assert.ok(h.runUntil(() => e.stats.attacks === 2, 6));
  assert.equal(u.stats.taken, e.s.atk - 100 + e.s.atk * 2.5 - 100);
  assert.deepEqual(b.errors, []);
});

test('Snack Cart detonates once when blocked, applies independent fixed Burn, and uses replacement damage for Gelato', () => {
  for (const id of ['enemy_1218_bomscr', 'enemy_1218_bomscr_2']) {
    const { h, b, u, e } = fixture(id);
    const controller = new CapturableStageDevices(b, [{ key: 'trap_057_wpnsts', name: "'Gelato Stop'", hidden: false,
      row: 10, col: 6, instance: { level: 1, skillIndex: 0, skillLevel: 1 } }]);
    const station = [...controller.entries.values()][0].unit;
    const ordinary = id.endsWith('_2') ? 550 : 375, element = id.endsWith('_2') ? 350 : 250;
    b.addBuff(u, { key: 'test:dodge', mods: { dodgeArts: 1 } });
    b.removeBuff(u, 'test:noBlock'); b.addBuff(u, { key: 'test:hold', flags: { disarm: true } }); e.x = u.x + .3;
    assert.ok(h.runUntil(() => !e.alive, 3));
    assert.equal(u.stats.taken, ordinary * .8); assert.equal(u.elem.burn, element);
    assert.equal(station.stats.taken, id.endsWith('_2') ? 7500 : 5000); assert.equal(station.elem.burn, 0);
    assert.equal(b.killed, 1); assert.equal(h.hooksOf('death').filter(c => c.unit === e).length, 1);
    assert.equal(h.hooksOf('damaged').find(c => c.target === u && c.dmg.type === 'element').source, u);
    h.run(2); assert.equal(u.stats.taken, ordinary * .8); assert.deepEqual(b.errors, []);
  }
});

test('Silence suppresses cart arming, ordinary combat is Physical, and an unblocked killed cart never explodes', () => {
  const { h, b, u, e } = fixture('enemy_1218_bomscr');
  b.applyStatus(e, 'silence', { duration: 30 }); b.removeBuff(u, 'test:noBlock');
  b.addBuff(u, { key: 'test:hold', flags: { disarm: true } }); e.x = u.x + .3;
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); assert.equal(u.stats.taken, e.s.atk - 100); assert.equal(e.alive, true);
  b.removeBuff(e, 'silence'); assert.ok(h.runUntil(() => !e.alive, 3));
  const other = fixture('enemy_1218_bomscr'); other.b.kill(other.e); other.h.run(1);
  assert.equal(other.u.stats.taken, 0); assert.equal(other.u.elem.burn, 0); assert.deepEqual(b.errors, []);
});

test('Snack contracts reject altered child scheduling and explosion damage branches', () => {
  for (const [id, mutate] of [
    ['enemy_1217_rescar', n => { n.templates['enemy_rescar_skill[summon]'].eventToActions.ON_BUFF_START[0]._stopSummonIfHostDead = true; }],
    ['enemy_1218_bomscr', n => { n.templates.enemy_bomscr_boom_damage.eventToActions.ON_BUFF_START[0]._succeedNodes[0]._damageKey = 'boom_atk'; }],
  ]) {
    const n = structuredClone(native); mutate(n);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, n).policy, null);
  }
});


test('vendor cast releases on its marker, scales with slow-down, and loses spent ammunition when interrupted', () => {
  const { h, b, e } = fixture('enemy_1217_rescar');
  assert.ok(h.runUntil(() => e.profile.noAttack, 6));
  const a = e.mem.ab.list.find(a => a.cast);
  assert.equal(e.mem.enemyAmmo.current, 2);
  b.addBuff(e, { key: 'test:slow', data: { nativeSlowDown: { increment: .5, maxStrength: .8 } }, stacks: 1 });
  h.run(.6); assert.equal(a.cast.released, false);
  b.applyStatus(e, 'stun', { duration: 1 });
  assert.equal(a.cast, null); assert.equal(e.profile.noAttack, false);
  h.run(2); assert.equal(b.total, 1); assert.equal(e.mem.enemyAmmo.current, 2);
  b.removeBuff(e, 'test:slow');
  assert.ok(h.runUntil(() => !!a.cast, 12));
  h.run(.4); assert.equal(a.cast.released, false);
  h.run(.1); assert.equal(a.cast.released, true);
  assert.ok(h.runUntil(() => b.total === 2, .2));
  assert.deepEqual(b.errors, []);
});

test('armed carts wait for the marker and survive interrupted attacks without a premature explosion', () => {
  const { h, b, u, e } = fixture('enemy_1218_bomscr');
  b.removeBuff(u, 'test:noBlock'); b.addBuff(u, { key: 'test:hold', flags: { disarm: true } }); e.x = u.x + .3;
  assert.ok(h.runUntil(() => e.profile.noAttack, 3));
  const a = e.mem.ab.list.find(a => a.cast);
  h.run(.2); assert.equal(e.alive, true); assert.equal(u.stats.taken, 0);
  b.applyStatus(e, 'stun', { duration: 1 }); assert.equal(a.cast, null);
  h.run(.5); assert.equal(e.alive, true); assert.equal(u.stats.taken, 0);
  b.applyStatus(e, 'silence', { duration: 10 });
  assert.ok(h.runUntil(() => !e.alive, 5)); // Silence cannot undo the already switched mode.
  assert.equal(u.stats.taken, 375 * .8); assert.equal(u.elem.burn, 250);
  assert.deepEqual(b.errors, []);
});
