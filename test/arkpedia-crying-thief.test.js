// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_2034_sythef';

for (const [id, level, duration] of [...[0, 1, 2].map(level => ['enemy_2034_sythef', level, 4]), ['enemy_2034_sythef_2', 0, 3.5]]) test(`${id} level ${level}: stun is unsilenceable, survives damage dodge, and stealth returns on unblock`, () => {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'thief_target', profession: 'WARRIOR', stats: { maxHp: 100000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[level]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 30,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const target = b.allyUnits[0];
  b.addBuff(target, { key: 'fixture:stationary', flags: { noMove: true, disarm: true }, mods: { dodgePhys: 1 } });
  b.applyStatus(target, 'resist', { value: .5 });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.applyStatus(e, 'silence', { duration: 30 });
  assert.equal(enemyStealthed(e), true); h.run(.2); assert.equal(e.stats.attacks, 0);
  e.x = target.x + .2; e.y = target.y;
  assert.equal(b._checkBlock(e), true); assert.equal(enemyStealthed(e), false);
  h.run(.1); assert.equal(target.hp, target.s.maxHp); assert.equal(target.findBuff('stun').duration, duration * .5);
  assert.equal(e.stats.attacks, 1); assert.equal(e.lpr, 0);
  assert.equal(e.blockedBy, null, 'its stun releases the blocker through the common status system');
  assert.equal(enemyStealthed(e), true, 'native restore delay is zero, not the default three seconds');
  assert.deepEqual(b.errors, []);
});

test('changed stealth toggles or stun duration cannot pass Crying Thief admission', () => {
  const entry = structuredClone(ENEMY_RECORDS.enemies[id]); entry.levels[2].talents.bb['Combat.attack@stun'] = 8;
  assert.equal(enemySupport(entry, index.prefabs, evidence).policy, null);
  const changed = structuredClone(evidence);
  for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
    const c = JSON.parse(row.originalJson); if ('_restoreDelay' in c) c._restoreDelay = 3;
    row.originalJson = JSON.stringify(c);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, changed).policy, null);
});
