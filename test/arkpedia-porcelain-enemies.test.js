// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { attachRampingDot } from '../server/sim/content/arkpedia-enemy-ramping-dot.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1205_sfpin', 'enemy_1205_sfpin_2'];
function fixture(id = ids[0]) {
  const record = ENEMY_RECORDS.enemies[id].levels[0], child = record.talents.bbStr['DeadSpawn.enemy_key'];
  const op = chessRec({ id: 'porcelain_target', stats: { maxHp: 100000, atk: 0, def: 0, res: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 120, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record, [child]: ENEMY_RECORDS.enemies[child].levels[0] }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 10, col: 6 }] });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [10, 5] }), target = b.allyUnits[0];
  b.addBuff(e, { key: 'stationary', flags: { noMove: true } });
  return { h, b, e, target, record, child };
}
const dot = (b, target, overrides = {}) => attachRampingDot(b, target, {
  key: 'test:ramp', amount: 400, initial: .3, increment: .3, every: 4, duration: 20, ...overrides,
});
test('both casters use initial attack SP, normal charging through silence, and an independent skill projectile payload', () => {
  for (const id of ids) {
    const { h, b, e, target } = fixture(id);
    h.run(3.3); assert.equal(e.mem.porcelainCaster.sp, 5); assert.equal(target.findBuff('ab:porcelainDot'), null);
    b.applyStatus(e, 'silence', { duration: 4 }); h.run(3.1);
    assert.equal(e.mem.porcelainCaster.sp, 5); assert.equal(target.findBuff('ab:porcelainDot'), null);
    h.run(3); assert.equal(e.mem.porcelainCaster.sp, 0); assert.ok(target.findBuff('ab:porcelainDot'));
    const first = target.findBuff('ab:porcelainDot'); b.kill(e); h.run(2);
    assert.ok(first.data.pulses >= 3); assert.ok(target.buffs.includes(first));
    assert.deepEqual(b.errors, []);
  }
});
test('cached Arts damage rises every four accepted pulses, ignores dodge, and expires without an extra boundary pulse', () => {
  const { h, b, e, target } = fixture(); b.kill(e); const hits = [];
  b.addBuff(target, { key: 'dodge', mods: { dodgeArts: 1 } });
  b.on('calculatedDamage', c => { if (c.dmg.tags?.includes('test:ramp')) hits.push({ amount: c.dmg.amount, source: c.source }); });
  const buff = dot(b, target); h.run(20.1);
  assert.equal(hits.length, 20); assert.equal(buff.data.pulses, 20);
  for (let i = 0; i < hits.length; i++) {
    assert.ok(Math.abs(hits[i].amount - 120 * (1 + Math.floor(i / 4))) < 1e-6);
    assert.equal(hits[i].source, null);
  }
  assert.equal(target.findBuff('test:ramp'), null); assert.deepEqual(b.errors, []);
});
test('each stack retains its own clock and snapshot; Resist shortens lifetime and Slow Down never changes pulse spacing', () => {
  const { h, b, e, target } = fixture(); b.kill(e);
  b.applyStatus(target, 'resist', { duration: 60 });
  const first = dot(b, target); assert.equal(first.duration, 10); h.run(2);
  const second = dot(b, target, { amount: 570 }); assert.notEqual(first, second);
  assert.equal(target.buffs.filter(x => x.key === 'test:ramp').length, 2);
  b.addBuff(target, { key: 'slow-clock', mods: { slowDownMul: .5 } });
  const before = first.data.pulses; h.run(2); assert.equal(first.data.pulses - before, 2);
  b.removeBuff(target, 'slow-clock'); h.run(7.1);
  assert.ok(!target.buffs.includes(first)); assert.ok(target.buffs.includes(second));
  b.removeBuff(target, second); const count = second.data.pulses; h.run(3); assert.equal(second.data.pulses, count);
  assert.deepEqual(b.errors, []);
});
test('invulnerability rejects damage and escalation while an accepted shielded tick still counts', () => {
  const { h, b, e, target } = fixture(); b.kill(e);
  b.addBuff(target, { key: 'safe', flags: { invulnerable: true } });
  const buff = dot(b, target); h.run(3); assert.equal(buff.data.pulses, 0);
  b.removeBuff(target, 'safe'); b.addBuff(target, { key: 'shield', shield: 10000 });
  const hp = target.hp; h.run(4); assert.equal(buff.data.pulses, 4); assert.equal(target.hp, hp);
  assert.deepEqual(b.errors, []);
});
test('vase fragments use delayed route ownership and exclude leaks and falls; caster cannot attack air', () => {
  for (const id of ids) for (const reason of ['killed', 'leaked', 'fall']) {
    const { h, b, e, target, child } = fixture(id);
    assert.equal(e.profile.canTarget({ isFlying: true }), false);
    if (reason === 'leaked') b.leak(e);
    else if (reason === 'fall') {
      b.grid.setTile(10, 4, { ...b.grid.tile(10, 4), key: 'tile_hole' });
      b.displace(e, { x: -1, y: 0 }, 1, { onFall: victim => b.kill(victim) });
    } else b.kill(e);
    assert.equal(b.enemies.filter(x => x.defId === child).length, 0); h.run(.8);
    assert.equal(b.enemies.filter(x => x.defId === child).length, reason === 'killed' ? 1 : 0);
    assert.equal(target.findBuff('ab:porcelainDot'), null); assert.deepEqual(b.errors, []);
  }
});
test('admission checks both prefabs, independent stacking, tick cadence, projectile motion and attack-SP source', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  for (const kind of ['stack', 'interval', 'ramp', 'projectile', 'sp']) {
    const n = structuredClone(native), record = structuredClone(ENEMY_RECORDS.enemies[ids[0]]);
    const real = n.templates['enemy_sfpin_power_attack[resist]'].eventToActions.ON_BUFF_START[0]._buff;
    if (kind === 'stack') real.disableOverride = false;
    if (kind === 'interval') real.triggerInterval = 2;
    if (kind === 'ramp') n.templates['enemy_sfpin_power_attack[real]'].eventToActions.ON_BUFF_TRIGGER[4]._fromBlackboardKeys = 'other';
    if (kind === 'sp') record.levels[0].sp.initSp = 0;
    if (kind === 'projectile') for (const row of n.projectiles.projectile_enemy_sfpin_ex) {
      const d = JSON.parse(row.originalJson); if ('_speed' in d) d._speed = 5; row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(record, clock.prefabs, n).policy, null, kind);
  }
});
