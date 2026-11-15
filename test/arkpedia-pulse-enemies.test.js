// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
function fixture(id) {
  const guard = chessRec({ id: 'pulse_target', stats: { maxHp: 100000, atk: 0, def: 0, res: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [[9, 6], [10, 6], [10, 7]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); const [near, far, outside] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'stationary', flags: { noMove: true, disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 8] });
  near.x = 7; near.y = 9; far.x = 6; far.y = 9; outside.x = 5.49; outside.y = 9;
  const hits = []; b.on('damaged', c => { if (c.dmg?.tags?.includes('pulseCaster')) hits.push(c); });
  return { h, b, e, near, far, outside, hits };
}
for (const suffix of ['', '_2', '_3']) {
  test(`pulse warrior${suffix}: starts Physical and switches permanently on a pulse, even silenced`, () => {
    const { b, e } = fixture('enemy_1084_sotidm' + suffix);
    assert.equal(e.profile.dmgType, 'phys'); assert.equal(e.profile.pulseImmune, true);
    b.applyStatus(e, 'silence', { duration: 20, force: true }); b.emit('stagePulse', { unit: e });
    assert.equal(e.profile.dmgType, 'arts'); assert.deepEqual(b.errors, []);
  });
  test(`pulse caster${suffix}: no ordinary attack, five-second spell and one-time range expansion`, () => {
    const { h, b, e, near, far, outside, hits } = fixture('enemy_1085_sotiwz' + suffix);
    h.run(.1); assert.equal(hits.length, 1); assert.equal(hits[0].target, near); assert.equal(hits[0].hpLoss, e.s.atk);
    h.run(4.8); assert.equal(hits.length, 1); h.run(.2); assert.equal(hits.length, 2);
    b.emit('stagePulse', { unit: e }); h.run(.1); assert.equal(hits.length, 4); assert.ok(far.hp < far.s.maxHp);
    b.emit('stagePulse', { unit: e }); h.run(.1); assert.equal(hits.length, 4);
    assert.equal(outside.hp, outside.s.maxHp); assert.equal(e.stats.attacks, 0); assert.deepEqual(b.errors, []);
  });
}
test('spell includes camouflage, excludes air and stealth, pauses casts under control and ignores attack speed', () => {
  const { h, b, e, near, far, hits } = fixture('enemy_1085_sotiwz');
  b.addBuff(near, { key: 'camouflage', flags: { camou: true } }); b.addBuff(e, { key: 'fast', mods: { aspd: 300 } });
  b.emit('stagePulse', { unit: e }); far.motion = 'FLY'; h.run(.1); assert.equal(hits.length, 1);
  b.applyStatus(e, 'stun', { duration: 6 }); h.run(5.1); assert.equal(hits.length, 1);
  b.addBuff(near, { key: 'stealth', flags: { stealth: true } }); h.run(1.1); assert.equal(hits.length, 1);
  b.removeBuff(near, 'stealth'); h.run(.1); assert.equal(hits.length, 2); assert.deepEqual(b.errors, []);
});
test('changed original modes, spell damage, selector or circle refuse support', () => {
  for (const id of ['enemy_1084_sotidm', 'enemy_1085_sotiwz']) {
    const entry = ENEMY_RECORDS.enemies[id]; assert.ok(enemySupport(entry, index.prefabs, evidence).policy);
    assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
    const edits = id.includes('sotiwz') ? [c => { if ('m_Radius' in c) c.m_Radius += 1; }, c => { if ('_targetMotion' in c) c._targetMotion = 3; },
      c => { if (c._atkScale === 1) c._atkScale = 2; }] : [c => { if (c._damageType === 2) c._damageType = 1; }];
    for (const edit of edits) {
      const changed = structuredClone(evidence);
      for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) { const c = JSON.parse(row.originalJson); edit(c); row.originalJson = JSON.stringify(c); }
      assert.equal(enemySupport(entry, index.prefabs, changed).policy, null);
    }
  }
});
