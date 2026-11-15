// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-sniper-source.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

function fixture(id = 'enemy_1047_sagent') {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'sniper_target', profession: 'WARRIOR', stats: { maxHp: 100000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 80,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: b => installEnemyFeatures(b) });
  const b = h.b, target = b.allyUnits[0]; b.start();
  b.addBuff(target, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }), hits = [], statuses = [];
  b.on('damaged', c => { if (c.source === e) hits.push({ time: b.time, ...c }); });
  b.on('statusApplied', c => { if (c.target === target && c.status === 'stun') statuses.push({ time: b.time, ...c }); });
  const ability = e.mem.ab.list.find(a => 'charge' in a);
  return { h, b, e, target, hits, statuses, ability };
}
const advanceUntil = (h, condition, seconds = 20) => {
  for (let n = 0; n < seconds * 30 && !condition(); n++) h.run(1 / 30);
  assert.ok(condition(), 'expected transition occurred');
};

for (const id of clocks.family) test(`${id}: charge, fixed cast, projectile and resistant stun are separate phases`, () => {
  const { h, b, e, target, ability, hits, statuses } = fixture(id);
  b.applyStatus(target, 'resist', { value: .5 });
  advanceUntil(h, () => !!ability.cast);
  assert.equal(e.stats.attacks, 2); assert.equal(ability.charge, 0);
  assert.equal(hits.length, 2); assert.equal(statuses.length, 0);
  const start = b.time;
  h.run(.7); assert.equal(ability.cast.launched, false); assert.equal(hits.length, 2);
  advanceUntil(h, () => !!ability.cast?.launched, 1);
  assert.ok(Math.abs(b.time - start - clocks.events.Skill[0].time) <= 1 / 30 + 1e-6);
  assert.equal(b.projectiles.list.at(-1).speed, 10);
  assert.equal(b.projectiles.list.at(-1).maxAge, 5); assert.equal(statuses.length, 0);
  advanceUntil(h, () => statuses.length > 0, 1);
  assert.equal(hits.length, 3); assert.equal(hits[2].dmg.isSkill, true);
  assert.equal(hits[2].hpLoss, e.s.atk);
  const stun = target.findBuff('stun');
  assert.ok(stun); assert.ok(Math.abs(stun.timeLeft - (id.endsWith('_2') ? 7.5 : 2.5)) <= 1 / 30 + 1e-6);
  advanceUntil(h, () => !ability.cast, 1);
  assert.ok(Math.abs(b.time - start - clocks.durations.Skill) <= 1 / 30 + 1e-6);
  assert.ok(e.atkCd > 3.9); assert.equal(e.profile.noAttack, false); assert.equal(ability.charge, 0);
  assert.deepEqual(b.errors, []);
});

test('silence preserves two charges; control before release interrupts without a phantom hit', () => {
  const { h, b, e, target, hits, ability } = fixture();
  b.applyStatus(e, 'silence', { duration: 20 }); h.run(8.3);
  assert.equal(e.stats.attacks, 3); assert.equal(ability.charge, 2); assert.equal(ability.cast, undefined);
  b.removeBuff(e, 'silence'); e.atkCd = 0;
  advanceUntil(h, () => !!ability.cast, 1); h.run(.2);
  const count = hits.length;
  b.applyStatus(e, 'stun', { duration: 2 }); h.run(1);
  assert.equal(ability.cast, null); assert.equal(ability.charge, 0); assert.equal(hits.length, count);
  assert.equal(target.s.flags.stun, false); assert.equal(e.profile.noAttack, false);
  assert.deepEqual(b.errors, []);
});

test('the released shot survives source death and does not transfer to a replacement target', () => {
  for (const retire of [false, true]) {
    const { h, b, e, target, hits, statuses, ability } = fixture();
    advanceUntil(h, () => !!ability.cast?.launched);
    b.kill(e, target); if (retire) b.kill(target, null);
    h.run(.5);
    assert.equal(hits.length, retire ? 2 : 3); assert.equal(statuses.length, retire ? 0 : 1);
    assert.deepEqual(b.errors, []);
  }
});

test('flying units cannot charge the Sniper and native projectile changes block admission', () => {
  const { h, b, e, target, ability } = fixture();
  target.motion = 'FLY'; h.run(10);
  assert.equal(e.stats.attacks, 0); assert.equal(ability.charge, 0);
  for (const field of ['_speed', '_stopWhenSourceInvalid', '_maxHitNum']) {
    const changed = structuredClone(evidence);
    for (const row of changed.projectiles.projectile_sagent_s1) {
      const c = JSON.parse(row.originalJson); if (field in c) c[field] += 1;
      row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1047_sagent, index.prefabs, changed).policy, null);
  }
});

test('attack speed leaves the fixed skill clock unchanged; native slowdown stretches it', () => {
 for (const slow of [1, .5]) {
  const { h, b, e, ability } = fixture();
  b.addBuff(e, { key: 'fixture:fast', mods: { aspd: 100, slowDownMul: slow } });
  advanceUntil(h, () => !!ability.cast);
  const start = b.time;
  advanceUntil(h, () => !!ability.cast?.launched, 4);
  assert.ok(Math.abs(b.time - start - 25 / 30 / slow) <= 1 / 30 + 1e-6);
  advanceUntil(h, () => !ability.cast, 4);
  assert.ok(Math.abs(b.time - start - 50 / 30 / slow) <= 1 / 30 + 1e-6);
  assert.deepEqual(b.errors, []);
 }
});
