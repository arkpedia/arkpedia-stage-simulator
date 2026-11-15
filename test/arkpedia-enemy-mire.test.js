// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyRecord, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { install as installDevices } from '../server/sim/content/devices.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1287_ducrb', 'enemy_1287_ducrb_2'];
for (const id of ids) test(`${id}: Mire immunity and conditional speed preserve independent slows and clear on departure`, () => {
  const route = { motion: 'WALK', start: [10, 7], end: [10, 7], checkpoints: [{ type: 'WAIT', time: 99 }] };
  const h = makeBattle({ stageId: 'act2autochess_m02', content: 'none', autoFinish: false, units: [],
    defs: { enemies: { [id]: enemyRecord(id), control: enemyRec({ key: 'control', mass: 5, speed: .8 }) } },
    enemies: [{ key: id, pos: [10, 7], route }, { key: 'control', pos: [10, 7], route }],
    setup(b) { installEnemyFeatures(b); installDevices(b); } });
  h.run(.3); const e = h.b.enemies[0], control = h.b.enemies[1], base = enemyRecord(id).stats.moveSpeed;
  assert.equal(e.s.flags.mireImmune, true); assert.equal(e.s.aspd, 100);
  assert.ok(Math.abs(e.s.moveSpeed - base * 1.3) < 1e-9); assert.equal(e.findBuff('terrain:mire'), null);
  assert.ok(control.s.aspd < 100);
  h.b.addBuff(e, { key: 'test:slow', mods: { moveMul: .5 } }); h.run(.2);
  assert.ok(Math.abs(e.s.moveSpeed - base * 1.3 * .5) < 1e-9);
  h.b.applyStatus(e, 'silence', { duration: 10 }); h.run(.2);
  assert.ok(e.findBuff('ab:mireWalker'));
  e.x = 8; e.y = 10; e.tileC = 8; h.run(.3);
  assert.equal(e.findBuff('ab:mireWalker'), null); assert.ok(Math.abs(e.s.moveSpeed - base * .5) < 1e-9);
  e.x = 7; e.tileC = 7; h.run(.3); assert.ok(e.findBuff('ab:mireWalker'));
  h.b.applyStatus(e, 'levitate', { duration: 1 }); h.run(.3);
  assert.equal(e.findBuff('ab:mireWalker'), null); assert.deepEqual(h.b.errors, []);
});
test('Gloompincer source admission rejects changed terrain conditions, speed attributes and derived ownership', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const mutate of [
    t => { t._conditionNode._buffKeys = ['other']; },
    t => { t._succeedNodes[2]._buff.attributes.attributeModifiers[0].attributeType = 'ATTACK_SPEED'; },
    t => { t._succeedNodes[2]._finishDerivedBuffIfParentFinish = false; },
    t => { t._failNodes = []; },
  ]) {
    const n = structuredClone(native); mutate(n.templates.enemy_ducrb_checker.eventToActions.ON_BUFF_TRIGGER[0]);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clocks.prefabs, n).policy, null);
  }
});
