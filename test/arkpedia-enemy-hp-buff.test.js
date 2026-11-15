// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1264_durgrd', 'enemy_1264_durgrd_2'];
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
function fixture(id = ids[0]) {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { enemies: { [id]: record } }, setup: installEnemyFeatures });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [9, 5], route: 0 });
  b.addBuff(e, { key: 'hold', flags: { disarm: true, noMove: true } });
  return { b, e, h, record };
}
test('both Waker-Uppers apply source ASPD and multiplicative movement once below full HP for 30 seconds', () => {
  for (const id of ids) {
    const { b, e, h, record } = fixture(id), bb = record.talents.bb;
    h.run(1); assert.equal(e.findBuff('ab:oneShotHpBuff'), null);
    b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true }); h.step();
    assert.ok(e.findBuff('ab:oneShotHpBuff')); near(e.s.aspd, 100 + bb['Rage.attack_speed']);
    near(e.s.moveSpeed, record.stats.moveSpeed * (1 + bb['Rage.move_speed']));
    h.run(10); b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true });
    b.heal(null, e, e.s.maxHp); h.run(19); assert.ok(e.findBuff('ab:oneShotHpBuff'), 'healing does not end the one-shot buff');
    h.run(1.1); assert.equal(e.findBuff('ab:oneShotHpBuff'), null); near(e.s.aspd, 100); near(e.s.moveSpeed, record.stats.moveSpeed);
    b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true }); h.run(1);
    assert.equal(e.findBuff('ab:oneShotHpBuff'), null, 'later damage does not reactivate or refresh it');
    assert.deepEqual(b.errors, []);
  }
});
test('HP checker ignores cancelled damage and elemental buildup; HP loss can cross its threshold', () => {
  const { b, e, h } = fixture();
  b.addBuff(e, { key: 'immune', flags: { invulnerable: true } });
  b.dealDamage(null, e, { amount: 1, type: 'true' }); h.step(); assert.equal(e.findBuff('ab:oneShotHpBuff'), null);
  b.removeBuff(e, 'immune'); b.dealDamage(null, e, { amount: 1, type: 'element', element: 'erosion' });
  h.step(); assert.equal(e.findBuff('ab:oneShotHpBuff'), null);
  b.loseHp(e, 1); h.step(); assert.ok(e.findBuff('ab:oneShotHpBuff')); assert.deepEqual(b.errors, []);
});
test('source silence immunity is retained; the active buff has no extra stun immunity and outlives forced silence', () => {
  const { b, e, h } = fixture(); b.applyStatus(e, 'silence', { duration: 3 }); assert.equal(e.findBuff('silence'), null);
  b.dealDamage(null, e, { amount: 1, type: 'true' }); h.step(); assert.ok(e.findBuff('ab:oneShotHpBuff'));
  b.addBuff(e, { key: 'forced-silence', flags: { silence: true } });
  b.applyStatus(e, 'stun', { duration: 1 }); h.run(.2);
  assert.ok(e.s.flags.stun); near(e.s.aspd, 200); h.run(1); near(e.s.aspd, 200); assert.deepEqual(b.errors, []);
});
test('Waker-Uppers require the reviewed one-shot HP checker, ordinary attack, modifiers and source values', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  const path = `dyn/battle/prefabs/enemies/${ids[0]}.prefab`;
  for (const field of ['_toggleOnce', '_maxHpRatio', '_initialToggle']) {
    const n = structuredClone(native), row = n.prefabs[path].find(c => Object.hasOwn(JSON.parse(c.originalJson), field));
    assert.ok(row); const d = JSON.parse(row.originalJson); d[field] = field === '_initialToggle' ? 1 : 0; row.originalJson = JSON.stringify(d);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clock.prefabs, n).policy, null);
  }
  const n = structuredClone(native), row = n.prefabs[path].find(c => c.objectName === 'Rage' && JSON.parse(c.originalJson)._buffs);
  const d = JSON.parse(row.originalJson); d._buffs[0].attributes.attributeModifiers.push({ attributeType: 1 }); row.originalJson = JSON.stringify(d);
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clock.prefabs, n).policy, null);
  const r = structuredClone(ENEMY_RECORDS.enemies[ids[0]]); r.levels[0].talents.bb['Rage.duration'] = 60;
  assert.equal(enemySupport(r, clock.prefabs, native).policy, null);
});
