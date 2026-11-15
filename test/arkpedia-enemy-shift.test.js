// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { RegularDisplacement } from '../server/sim/regular-displacement.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1328_cbjedi', 'enemy_1328_cbjedi_2'];
function fixture(id = ids[0]) {
  const record = ENEMY_RECORDS.enemies[id].levels[0];
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { enemies: { [id]: record } },
    setup: b => { b.regularDisplacement = new RegularDisplacement(b); installEnemyFeatures(b); } });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [9, 5], route: 0 });
  b.addBuff(e, { key: 'hold', flags: { disarm: true, noMove: true } });
  const hits = []; b.on('damaged', c => hits.push(c));
  return { b, e, h, hits };
}

test('Arc Frontliners wait for a polled unbalanced state, then take fixed unmodified damage on their own clock', () => {
  for (const id of ids) {
    const { b, e, h, hits } = fixture(id), hp = e.hp;
    b.addBuff(e, { key: 'damage-modifiers', mods: { dmgTakenMul: .5 } });
    b.applyStatus(e, 'silence', { duration: 10 });
    b.push(e, 1, { dir: { x: 1, y: 0 }, effect: true });
    h.step(3); assert.equal(e.hp, hp, 'both parent and child wait for their first interval');
    h.step(); assert.equal(e.hp, hp - 400);
    assert.equal(hits.length, 1); assert.equal(hits[0].source, null);
    assert.equal(hits[0].dmg.unmodified, true); assert.equal(hits[0].dmg.noSp, true);
    h.run(1); assert.ok(hits.length > 1); assert.ok(hits.every(c => c.amount === 400));
    const after = e.hp; h.run(1); assert.equal(e.hp, after, 'settling removes the child at the next parent poll');
    assert.deepEqual(b.errors, []);
  }
});

test('route movement and teleporting are not unbalance; a stopped pull still owns the state', () => {
  const { b, e, h, hits } = fixture(); const hp = e.hp;
  b.removeBuff(e, 'hold'); h.run(.5); assert.ok(e.x < 5); assert.equal(e.hp, hp);
  e.x = 8; h.run(.2); assert.equal(e.hp, hp);
  b.addBuff(e, { key: 'hold', flags: { disarm: true, noMove: true } });
  b.pull(e, 1, { to: { x: e.x + .1, y: e.y }, center: { x: e.x, y: e.y } });
  const x = e.x; h.run(.5); assert.equal(e.x, x); assert.ok(hits.length > 0);
  b.applyStatus(e, 'levitate', { duration: 1 }); h.run(.1);
  const after = e.hp; h.run(.3); assert.equal(e.hp, after); assert.deepEqual(b.errors, []);
});

test('separate frontliners own separate periodic clocks; invulnerability protects and death stops future ticks', () => {
  const { b, e, h, hits } = fixture();
  const other = b.spawnEnemy(ids[0], { pos: [9, 7], route: 0 });
  b.addBuff(other, { key: 'hold', flags: { disarm: true, noMove: true } });
  b.addBuff(e, { key: 'protect', flags: { invulnerable: true } });
  b.push(e, 1, { dir: { x: 1, y: 0 } }); h.run(.3); assert.equal(hits.length, 0);
  b.removeBuff(e, 'protect'); h.run(.2); assert.ok(hits.length > 0); assert.equal(other.hp, other.s.maxHp);
  b.kill(e); assert.equal(e.mem.regularShift, undefined); const count = hits.length; h.run(1); assert.equal(hits.length, count); assert.deepEqual(b.errors, []);
});

test('only the reviewed unbalance template and damage semantics admit the two source enemies', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  const mutations = [
    n => { n.templates.enemy_cbjedi_bleed.eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._targetType = 'BUFF_SOURCE'; },
    n => { n.templates.enemy_cbjedi_bleed.eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._failNodes[0]._buff.isSilenceable = true; },
    n => { n.templates.periodic_damage_without_modify.eventToActions.ON_BUFF_TRIGGER[0]._damageWithoutModify = false; },
    n => { n.templates.periodic_damage_without_modify.eventToActions.ON_BUFF_TRIGGER.push({ $type: 'extra' }); },
    n => { const row = n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`].find(c => c.objectName === 'Combat' && !c.referenced);
      const d = JSON.parse(row.originalJson); d._damageType = 1; row.originalJson = JSON.stringify(d); },
  ];
  for (const mutate of mutations) { const n = structuredClone(native); mutate(n); assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clock.prefabs, n).policy, null); }
  const r = structuredClone(ENEMY_RECORDS.enemies[ids[0]]); r.levels[0].talents.bb['unbalanced_bleed.interval'] = .1;
  assert.equal(enemySupport(r, clock.prefabs, native).policy, null);
});
