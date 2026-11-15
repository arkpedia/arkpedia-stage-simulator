// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_1106_byokai', key = 'ab:cheeringDrone';
function fixture({ scheduled = false } = {}) {
  const guard = chessRec({ id: 'cheer_target', stats: { maxHp: 100000, atk: 0, def: 200 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [[9, 6], [9, 7], [10, 6], [10, 7], [8, 6]].map(([row, col]) => ({ chessId: guard.chessId, row, col })),
    enemies: scheduled ? [{ key: id, time: 1, route: 2 }] : [], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const [target, token, air, device, trap] = b.allyUnits;
  for (const unit of b.allyUnits) b.addBuff(unit, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  token.kind = 'token'; token.def = { ...token.def, profession: 'TOKEN' };
  air.motion = 'FLY'; device.kind = 'device'; trap.def = { ...trap.def, profession: 'TRAP' };
  const spawn = () => b.spawnEnemy(id, { pos: [9, 8] });
  return { h, b, target, token, air, device, trap, spawn };
}
test('death reward includes untargetable/camouflaged operators and summons, including air, but excludes traps/devices', () => {
  const { b, target, token, air, device, trap, spawn } = fixture();
  const e = spawn(); const aspd = target.s.aspd;
  b.addBuff(target, { key: 'hidden', flags: { stealth: true, camou: true, untargetable: true } });
  b.applyStatus(token, 'resist', { duration: 60 });
  assert.equal(b._displaceable(e), false); assert.equal(e.counted, false); assert.equal(b.total, 0);
  b.kill(e, target);
  for (const u of [target, token, air]) { assert.equal(u.s.aspd, aspd + 100); assert.equal(u.s.def, 300); assert.equal(u.findBuff(key).timeLeft, 20); }
  for (const u of [device, trap]) assert.equal(u.findBuff(key), null);
  assert.equal(b.killed, 0); assert.deepEqual(b.errors, []);
});
test('multiple drones add remaining duration while retaining one source, instance and set of modifiers', () => {
  const { h, b, target, spawn } = fixture(); const first = spawn(); b.kill(first, target);
  const buff = target.findBuff(key); h.run(5); const before = buff.timeLeft;
  b.kill(spawn(), target);
  assert.equal(target.findBuff(key), buff); assert.equal(buff.source, first);
  assert.ok(Math.abs(buff.timeLeft - before - 20) < 1e-8); assert.equal(buff.duration, 40);
  assert.equal(buff.stacks, 1); assert.equal(target.s.def, 300); assert.equal(target.s.aspd, 200);
  h.run(34.9); assert.ok(target.findBuff(key)); h.run(.2); assert.equal(target.findBuff(key), null);
  assert.equal(target.s.def, 200); assert.equal(target.s.aspd, 100); assert.deepEqual(b.errors, []);
});
test('death radius is finite, escaped drones do not grant rewards, and late deployments do not receive an aura', () => {
  const { h, b, target, token, spawn } = fixture(); const e = spawn(); token.x = e.x + 30.01;
  b.kill(e, target); assert.equal(token.findBuff(key), null);
  token.x = target.x; h.run(1); assert.equal(token.findBuff(key), null);
  const life = b.life, escaped = spawn(); b.leak(escaped); assert.equal(token.findBuff(key), null);
  assert.equal(b.life, life); assert.deepEqual(b.errors, []);
});
test('scheduled drones are excluded from the total before spawning, and ordinary silence is resisted', () => {
  const { h, b, target } = fixture({ scheduled: true }); assert.equal(b.total, 0);
  h.run(1.1); const e = b.enemies[0]; assert.equal(e.counted, false); assert.equal(b.total, 0);
  b.applyStatus(e, 'silence', { duration: 5 }); assert.equal(!!e.s.flags.silence, false);
  b.kill(e, target); assert.ok(target.findBuff(key)); assert.deepEqual(b.errors, []);
});
test('addTime keeps existing modifiers and ignores an infinite extension input', () => {
  const { b, target } = fixture();
  const original = b.addBuff(target, { key: 'duration-only', duration: 5, mods: { defFlat: 10 } });
  const returned = b.addBuff(target, { key: 'duration-only', duration: Infinity, refresh: 'addTime', mods: { defFlat: 999 } });
  assert.equal(returned, original); assert.equal(original.timeLeft, 5); assert.equal(target.s.def, 210);
  b.addBuff(target, { key: 'duration-only', duration: 2, refresh: 'addTime' }); assert.equal(original.timeLeft, 7);
});
test('native duration mode, professions, radius and modifiers must match the reviewed drone', () => {
  const entry = ENEMY_RECORDS.enemies[id]; assert.ok(enemySupport(entry, index.prefabs, evidence).policy);
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    c => { if (c._projectileBuffs) c._projectileBuffs[0].overrideType = 3; },
    c => { if (c._projectileBuffs) c._projectileBuffs[0].attributes.attributeModifiers[0].formulaItem = 0; },
    c => { if (c._targetOptions) c._targetOptions.professionMask = 1023; },
    c => { if ('m_Radius' in c) c.m_Radius = 100; },
  ]) {
    const changed = structuredClone(evidence);
    for (const row of [...changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`], ...changed.projectiles.projectile_enemy_byokai]) {
      const c = JSON.parse(row.originalJson); edit(c); row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(entry, index.prefabs, changed).policy, null);
  }
});
