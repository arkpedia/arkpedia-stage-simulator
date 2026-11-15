// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_2005_axetro', stackKey = 'ab:axeStack';
function fixture({ blocked = false, legacy = false } = {}) {
  const guard = chessRec({ id: 'ramp_target', stats: { maxHp: 1000000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: legacy ? 'full' : 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }, { chessId: guard.chessId, row: 10, col: 6 }],
    setup: b => { if (!legacy) installEnemyFeatures(b); } });
  const b = h.b; b.start(); const [target, other] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  b.addBuff(target, { key: 'fixture:target', mods: { taunt: 100 } });
  const e = b.spawnEnemy(id, { pos: [9, blocked ? 6.2 : 8] }), hits = [];
  if (blocked) { assert.ok(b._checkBlock(e)); assert.equal(e.blockedBy, target); }
  b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { h, b, e, target, other, hits };
}
for (const legacy of [false, true]) test(`Forsaken ${legacy ? 'legacy' : 'regular'}: stacks follow damage, with instant melee and homing ranged attacks`, () => {
  for (const blocked of [false, true]) {
    const { h, b, e, target, other, hits } = fixture({ blocked, legacy }), atk = e.s.atk;
    h.run(.1);
    if (!blocked) {
      assert.equal(hits.length, 0); assert.equal(e.findBuff(stackKey), null);
      assert.equal(b.projectiles.list[0].speed, 10); assert.equal(b.projectiles.list[0].maxAge, 5);
      // A second unit at the landing position must not turn a single-target axe into splash.
      other.x = target.x; other.y = target.y;
      h.run(.4);
    }
    assert.equal(hits.length, 1); assert.equal(hits[0].hpLoss, atk);
    assert.equal(hits[0].dmg.applyWay, blocked ? 'melee' : 'ranged');
    assert.equal(e.findBuff(stackKey).stacks, 1); assert.equal(e.s.atk, atk * 1.07);
    assert.equal(other.hp, other.s.maxHp); assert.deepEqual(b.errors, []);
  }
});
test('misses do not stack; damage adds at most 28 stacks, unaffected by silence', () => {
  const { b, e, target } = fixture(); const base = e.s.atk, aspd = e.s.aspd;
  b.addBuff(target, { key: 'dodge', mods: { dodgePhys: 1 } });
  b.dealDamage(e, target, { amount: 100, type: 'phys', isAttack: true });
  assert.equal(e.findBuff(stackKey), null);
  b.removeBuff(target, 'dodge'); b.applyStatus(e, 'silence', { duration: 20, force: true });
  for (let i = 0; i < 35; i++) b.dealDamage(e, target, { amount: 1, type: 'true', isSkill: true });
  assert.equal(e.findBuff(stackKey).stacks, 28);
  assert.equal(e.s.atk, base * (1 + .07 * 28)); assert.equal(e.s.aspd, aspd + 5 * 28);
  assert.deepEqual(b.errors, []);
});
test('slow attacks retain stacks while engaged; leaving combat resets after four seconds', () => {
  const { h, b, e, target, other } = fixture({ blocked: true });
  h.run(.1); assert.equal(e.findBuff(stackKey).stacks, 1);
  e.atkCd = 30; h.run(5); assert.equal(e.findBuff(stackKey).stacks, 1);
  b.retreat(target, { permanent: true }); b.retreat(other, { permanent: true });
  h.run(3.9); assert.ok(e.findBuff(stackKey)); h.run(.2); assert.equal(e.findBuff(stackKey), null);
  assert.deepEqual(b.errors, []);
});
test('long control interrupts engagement; air-only targets do not preserve stacks', () => {
  for (const control of ['stun', 'air']) {
    const { h, b, e, target, other } = fixture();
    b.dealDamage(e, target, { amount: 1, type: 'true' });
    if (control === 'stun') b.applyStatus(e, 'stun', { duration: 6, force: true });
    else target.motion = other.motion = 'FLY';
    h.run(4.1); assert.equal(e.findBuff(stackKey), null); assert.equal(e.stats.attacks, 0);
    assert.deepEqual(b.errors, []);
  }
});
test('an in-flight axe survives source death with its launch snapshot', () => {
  const { h, b, e, target, hits } = fixture(); const atk = e.s.atk;
  h.run(.1); b.kill(e, target); h.run(.5);
  assert.equal(hits.length, 1); assert.equal(hits[0].hpLoss, atk); assert.deepEqual(b.errors, []);
});
test('original damage event, stack formula, combat checker, and projectile transport gate admission', () => {
  const entry = ENEMY_RECORDS.enemies[id]; assert.ok(enemySupport(entry, index.prefabs, evidence).policy);
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    x => { x.templates.enemy_axetro_t.eventToActions.ON_AFTER_OUTPUT_DAMAGE[0]._buff.overrideType = 'EXTEND'; },
    x => { x.templates['enemy_axetro_t[checker]'].eventToActions.ON_BUFF_START[0]._decCntIfStack = true; },
    x => { for (const row of x.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) { const c = JSON.parse(row.originalJson); if ('_disableWhenInCombatState' in c) c._disableWhenInCombatState = 0; row.originalJson = JSON.stringify(c); } },
    x => { for (const row of x.projectiles.projectile_enemy_axetro) { const c = JSON.parse(row.originalJson); if ('_speed' in c) c._speed = 20; row.originalJson = JSON.stringify(c); } },
  ]) { const changed = structuredClone(evidence); edit(changed); assert.equal(enemySupport(entry, index.prefabs, changed).policy, null); }
});
