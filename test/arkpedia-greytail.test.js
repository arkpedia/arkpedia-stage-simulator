// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1060_emouse';
function fixture(id = ID) {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { enemies: { [id]: record } }, setup: installEnemyFeatures });
  h.b.start(); const b = h.b, e = b.spawnEnemy(id, { pos: [9, 7] });
  return { h, b, e, record };
}
const shield = e => e.buffs.reduce((sum, buff) => sum + buff.shield, 0);
test('Greytail has three Arts-only layers after RES; Physical and True damage leave them intact', () => {
  for (const id of [ID, ID + '_2']) {
    const { b, e, record } = fixture(id), layer = record.talents.bb['shield.dynamic'];
    assert.equal(shield(e), layer * 3); assert.equal(e.s.def, 250 + record.talents.bb['shield.def']);
    assert.equal(b.dealDamage(null, e, { amount: e.s.def + 300, type: 'phys' }), 300);
    assert.equal(b.dealDamage(null, e, { amount: 100, type: 'true' }), 100);
    assert.equal(shield(e), layer * 3);
    assert.equal(b.dealDamage(null, e, { amount: 1000, type: 'arts' }), 0);
    assert.equal(shield(e), layer * 3 - 800); assert.equal(e.hp, e.s.maxHp - 400);
    assert.deepEqual(b.errors, []);
  }
});
test('one overflowing hit crosses all original layers, drops DEF and enables the final speed multiplier once', () => {
  const { b, e } = fixture();
  b.addBuff(e, { key: 'otherSpeed', mods: { movePct: .5 } });
  const speed = e.s.moveSpeed;
  assert.equal(b.dealDamage(null, e, { amount: 5000, type: 'arts' }), 0); // 4000 after RES: two exact breaks
  assert.equal(shield(e), 2000); assert.equal(e.s.def, 1500); assert.equal(e.s.moveSpeed, speed);
  assert.equal(b.dealDamage(null, e, { amount: 3000, type: 'arts' }), 400);
  assert.equal(shield(e), 0); assert.equal(e.s.def, 250); assert.ok(Math.abs(e.s.moveSpeed - speed * 3) < 1e-9);
  b.dealDamage(null, e, { amount: 100, type: 'arts' });
  assert.equal(e.buffs.filter(x => x.key === 'ab:barrierBroken').length, 1);
  assert.deepEqual(b.errors, []);
});
test('barrier death by bypass damage does not grant the broken-barrier mode', () => {
  const { b, e } = fixture(); b.kill(e);
  assert.equal(e.buffs.some(x => x.key === 'ab:barrierBroken'), false); assert.deepEqual(b.errors, []);
});
test('Greytail admission rejects changed layer count, damage type and mode transition', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, native).policy);
  for (const change of ['count', 'type', 'mode']) {
    const n = structuredClone(native);
    if (change === 'type') n.templates.mousek_shield.eventToActions.ON_TAKE_DAMAGE[0]._damageMask = 'PHYSICAL';
    if (change === 'mode') n.templates.mousek_shield_end.eventToActions.ON_TAKE_DAMAGE[3]._restartFSM = true;
    if (change === 'count') for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`]) {
      const v = JSON.parse(row.originalJson); if (v._buffs?.[0]?.templateKey === 'mousek_shield') v._buffs.shift();
      row.originalJson = JSON.stringify(v);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, n).policy, null, change);
  }
});
