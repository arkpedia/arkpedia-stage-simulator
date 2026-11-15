// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1143_merrpg', 'enemy_1143_merrpg_2'];
function fixture(id = ids[0]) {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  const op = chessRec({ id: 'infantry_target', stats: { maxHp: 100000, atk: 0, def: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 60, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 10, col: 7 }, { chessId: op.chessId, row: 11, col: 7 }, { chessId: op.chessId, row: 12, col: 7 }] });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [10, 4] });
  b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('hit', c => { if (c.source === e) hits.push({ time: b.time, target: c.target, dmg: c.dmg }); });
  // Only the first ally is a selectable aim target. The flying second ally is
  // in its 3x3 splash; the last ally is outside the native box plus collider.
  const [target, air, outside] = h.allies(); air.motion = outside.motion = 'FLY';
  return { h, b, e, record, hits, target, air, outside };
}
test('both infantry variants fire one double-ATK grenade with ground aim and air-inclusive 3x3 impact', () => {
  for (const id of ids) {
    const { h, b, e, record, hits, target, air, outside } = fixture(id);
    target.motion = 'FLY'; h.run(1); assert.equal(e.mem.singleGrenade.cast, undefined);
    target.motion = 'WALK'; h.run(.4); assert.equal(b.projectiles.list.length, 0);
    h.run(.2); assert.equal(b.projectiles.list.length, 1); assert.equal(hits.length, 0);
    h.run(.7); assert.equal(hits.length, 2);
    assert.deepEqual(new Set(hits.map(h => h.target)), new Set([target, air]));
    assert.ok(hits.every(h => h.dmg.type === 'phys' && h.dmg.amount === record.stats.atk * 2));
    assert.equal(outside.hp, outside.s.maxHp);
    h.run(10); assert.equal(hits.length, 2); assert.equal(e.stats.attacks, 1); assert.equal(e.profile.melee, true);
    assert.deepEqual(b.errors, []);
  }
});
test('mode changes 1.14 seconds after release, triples movement speed, and permits only ordinary melee afterwards', () => {
  const { h, b, e, record, hits, target } = fixture();
  h.runUntil(() => e.mem.singleGrenade.spent, 2); const released = b.time;
  h.run(1); assert.equal(e.mem.singleGrenade.melee, false); assert.equal(e.s.moveSpeed, record.stats.moveSpeed);
  h.run(.2); assert.equal(e.mem.singleGrenade.melee, true); assert.ok(b.time - released >= 1.14);
  assert.equal(e.s.moveSpeed, record.stats.moveSpeed * 3); assert.equal(e.def.attackAnim.hit, Math.fround(.4));
  assert.equal(e.mem.regularFormVisual.attack, 'Attack_B');
  e.x = target.x; e.y = target.y; const before = hits.length; h.run(3);
  assert.ok(hits.length > before); assert.ok(hits.slice(before).every(h => h.dmg.amount === record.stats.atk && h.dmg.applyWay === 'melee'));
  assert.deepEqual(b.errors, []);
});
test('pre-release stun cancels without spending the grenade; silence cannot prevent either form', () => {
  const { h, b, e, hits } = fixture(); b.applyStatus(e, 'silence', { duration: 30 });
  h.run(.2); assert.ok(e.mem.singleGrenade.cast); b.applyStatus(e, 'stun', { duration: 1 });
  h.run(1); assert.equal(e.mem.singleGrenade.spent, false); assert.equal(hits.length, 0);
  h.runUntil(() => e.mem.singleGrenade.spent, 4); assert.equal(e.mem.singleGrenade.spent, true); h.run(2);
  assert.equal(e.mem.singleGrenade.melee, true);
  assert.equal(e.s.moveSpeed, e.base.moveSpeed * 3); assert.equal(e.stats.attacks, 1); assert.deepEqual(b.errors, []);
});
test('released grenade survives source death; a post-release stun does not stop the mode-switch clock', () => {
  for (const kill of [false, true]) {
    const { h, b, e, hits } = fixture(); h.runUntil(() => e.mem.singleGrenade.spent, 2);
    if (kill) b.kill(e); else b.applyStatus(e, 'stun', { duration: 10 });
    h.run(1.3); assert.equal(hits.length, 2);
    assert.equal(e.mem.singleGrenade.melee, !kill); assert.deepEqual(b.errors, []);
  }
});
test('Slow Down stretches the cast while the released transition timer stays independent', () => {
  const { h, b, e } = fixture(); b.addBuff(e, { key: 'slowClock', mods: { slowDownMul: .5 } });
  h.run(.7); assert.equal(e.mem.singleGrenade.spent, false);
  h.runUntil(() => e.mem.singleGrenade.spent, 2); assert.ok(b.time >= 1);
  const t = b.time; h.runUntil(() => e.mem.singleGrenade.melee, 2);
  assert.ok(Math.abs(b.time - t - 1.14) < b.dt * 2); assert.deepEqual(b.errors, []);
});
test('native admission rejects changed transition, target motion, blast size and speed buff', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const field of ['delay', 'target', 'blast', 'speed']) {
    const n = structuredClone(native);
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (field === 'delay' && '_runActionOnEvent' in d) d._buffs[0].triggerInterval = 0;
      if (field === 'target' && '_targetMotion' in d) d._targetMotion = 3;
      if (field === 'speed' && d._buffs?.[0]?.buffKey === 'merrpg_move_speed_up') d._buffs[0].attributes.attributeModifiers[0].formulaItem = 0;
      row.originalJson = JSON.stringify(d);
    }
    if (field === 'blast') for (const row of n.projectiles.projectile_enemy_merrpg) {
      const d = JSON.parse(row.originalJson); if (d.m_Size) d.m_Size.x = 4; row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clocks.prefabs, n).policy, null, field);
  }
});
