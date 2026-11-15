// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, enemyRecord, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { canTargetAlly, auraSelectable } from '../server/sim/targeting.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { install as installDevices } from '../server/sim/content/devices.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1291_dusrch', 'enemy_1291_dusrch_2'];
function nearAlly(h, e, x = 7) {
  e.x = x; e.y = 9; e.tileC = Math.round(x); e.tileR = 9;
  h.b.addBuff(e, { key: 'test:hold', flags: { noMove: true, disarm: true } });
}
test('Rover reveal suppresses live stealth/camouflage for other enemies and restores them on departure', () => {
  for (const id of ids) {
    const h = spawnAny(id, { seconds: .1 }), { b } = h, rover = b.enemies[0], ally = b.allyUnits[0];
    const observer = b.spawnEnemy(id, { pos: [9, 10], countInTotal: false }); nearAlly(h, observer, 10);
    b.addBuff(ally, { key: 'test:visibility', flags: { stealth: true, camou: true } });
    assert.equal(canTargetAlly(observer, ally, true), false);
    nearAlly(h, rover); h.run(.1);
    assert.equal(ally.s.flags.stealth, false); assert.equal(ally.s.flags.camou, false);
    assert.ok(ally.findBuff('test:visibility')); assert.equal(canTargetAlly(observer, ally, true), true);
    assert.equal(auraSelectable(observer, ally), true);
    nearAlly(h, rover, 9); h.run(.1);
    assert.equal(ally.s.flags.stealth, true); assert.equal(ally.s.flags.camou, true);
    assert.equal(canTargetAlly(observer, ally, true), false); assert.deepEqual(b.errors, []);
  }
});
test('overlapping reveal sources remove only their own suppression, including death and later stealth grants', () => {
  const h = spawnAny(ids[0], { seconds: .1 }), { b } = h, first = b.enemies[0], ally = b.allyUnits[0];
  nearAlly(h, first); const second = b.spawnEnemy(ids[0], { pos: [9, 7], countInTotal: false }); nearAlly(h, second);
  h.run(.1); b.addBuff(ally, { key: 'test:late', flags: { stealth: true, camou: true } });
  assert.equal(ally.s.flags.stealth, false);
  b.kill(first); assert.equal(ally.s.flags.stealth, false);
  b.kill(second); assert.equal(ally.s.flags.stealth, true); assert.equal(ally.s.flags.camou, true);
  assert.equal(ally.buffs.filter(v => v.flagImmunities?.length).length, 0); assert.deepEqual(b.errors, []);
});
test('reveal ignores target-free selection and persists through stun without deleting unrelated restrictions', () => {
  const h = spawnAny(ids[0], { seconds: .1 }), { b } = h, rover = b.enemies[0], ally = b.allyUnits[0];
  b.addBuff(ally, { key: 'test:hidden-flags', flags: { stealth: true, camou: true, targetFree: true } });
  nearAlly(h, rover); b.applyStatus(rover, 'stun', { duration: 2 }); h.run(.1);
  assert.equal(ally.s.flags.stealth, false); assert.equal(ally.s.flags.targetFree, true);
  assert.equal(canTargetAlly(rover, ally, true), false);
  assert.ok(ally.findBuff('test:hidden-flags')); assert.deepEqual(b.errors, []);
});
test('a source killed during buff admission cannot leave a permanent reveal on its candidate', () => {
  const h = spawnAny(ids[0], { seconds: .1 }), { b } = h, rover = b.enemies[0], ally = b.allyUnits[0];
  b.addBuff(ally, { key: 'test:invisible', flags: { stealth: true } });
  b.on('beforeBuff', e => { if (e.buff.flagImmunities?.length) b.kill(rover); });
  nearAlly(h, rover); h.run(.1);
  assert.equal(rover.alive, false); assert.equal(ally.s.flags.stealth, true);
  assert.equal(ally.buffs.filter(v => v.flagImmunities?.length).length, 0); assert.deepEqual(b.errors, []);
});
test('source mire immunity prevents both movement and ASPD penalties while an ordinary enemy still accumulates them', () => {
  const id = ids[0], dummy = 'enemy_mire_control';
  const route = { motion: 'WALK', start: [10, 7], end: [10, 7], checkpoints: [{ type: 'WAIT', time: 99 }] };
  const h = makeBattle({ stageId: 'act2autochess_m02', content: 'none', autoFinish: false, units: [],
    defs: { enemies: { [id]: enemyRecord(id), [dummy]: enemyRec({ key: dummy, mass: 5, speed: .8 }) } },
    enemies: [{ key: id, pos: [10, 7], route }, { key: dummy, pos: [10, 7], route }],
    setup(b) { installEnemyFeatures(b); installDevices(b); } });
  h.run(3); const rover = h.b.enemies.find(e => e.defId === id), ordinary = h.b.enemies.find(e => e.defId === dummy);
  assert.equal(rover.s.aspd, 100); assert.equal(rover.s.moveSpeed, .8); assert.equal(rover.findBuff('terrain:mire'), null);
  assert.ok(ordinary.s.aspd < 100); assert.ok(ordinary.s.moveSpeed < .8); assert.deepEqual(h.b.errors, []);
});
test('reveal source admission requires both visibility immunities, target selection and removal contracts', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const mutate of [
    d => { if (d._buffs?.[0]?.buffKey === 'talent_antiinvi') d._buffs[0].attributes.abnormalImmunes = [9]; },
    d => { if ('_removeBuffWhenTargetLeave' in d) d._removeBuffWhenTargetLeave = 0; },
    d => { if (d._targetOptions) d._targetOptions.ignoreTargetFree = 0; },
    d => { if (d._buffs?.[0]?.buffKey === 'enemy_ducrb_mire[immune]') d._buffs[0].buffKey = 'other'; },
  ]) {
    const n = structuredClone(native);
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`]) {
      const data = JSON.parse(row.originalJson); mutate(data); row.originalJson = JSON.stringify(data);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clocks.prefabs, n).policy, null);
  }
});
