// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { StageReeds } from '../server/sim/content/arkpedia-stage-reeds.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
for (const id of ['enemy_1286_dumcy', 'enemy_1286_dumcy_2']) test(`${id}: Reeds invisibility restores after attacks and blocking, and ends in burning Reeds`, () => {
  const h = spawnAny(id, { seconds: .1, autoFinish: false }), b = h.b, e = b.enemies[0];
  e.x = 3; e.y = 10; e.tileC = 3; e.tileR = 10; b.addBuff(e, { key: 'hold', flags: { noMove: true, disarm: true } });
  const reeds = new StageReeds(b, { kind: 'reeds', scanInterval: .1, damageInterval: 1, entryStealth: .2,
    tiles: [{ row: 10, col: 3, ignite_duration: 15, extinct_duration: 20, cooldown_duration: 5, damage: 40, ep_damage: 40 }] });
  h.run(.2); assert.equal(e.s.flags.stealth, true);
  b.emit('attack', { attacker: e }); assert.equal(!!e.s.flags.stealth, false); h.run(2.8); assert.equal(!!e.s.flags.stealth, false);
  h.run(.3); assert.equal(e.s.flags.stealth, true);
  const blocker = b.allyUnits[0]; blocker.blocking = [e]; e.blockedBy = blocker; b.emit('blocked', { enemy: e, blocker }); h.run(.2); assert.equal(!!e.s.flags.stealth, false);
  b._unblock(e); h.run(2.8); assert.equal(!!e.s.flags.stealth, false);
  h.run(.3); assert.equal(e.s.flags.stealth, true);
  b.applyStatus(e, 'silence', { duration: 1 }); h.run(.2); assert.equal(e.s.flags.stealth, true);
  reeds.ignite(10, 3); h.run(.2); assert.equal(!!e.s.flags.stealth, false); assert.deepEqual(b.errors, []);
});
test('Special Ops Soldier source gate rejects restoration or contact graph changes', () => {
  const id = 'enemy_1286_dumcy'; assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  const n = structuredClone(native); n.templates.enemy_dumcy_checker.eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys = ['other'];
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, n).policy, null);
  const changed = structuredClone(native);
  for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
    const d = JSON.parse(row.originalJson); if ('_restoreDelay' in d) d._restoreDelay = 0; row.originalJson = JSON.stringify(d);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, changed).policy, null);
});
