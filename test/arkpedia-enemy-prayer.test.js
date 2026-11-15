// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { prayerNative } from '../shared/arkpedia/enemy-prayer-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_10085_hllevi', 'enemy_10085_hllevi_2'], key = 'hllevi_s[speed_down]';
function fixture(id = ids[0], count = 1) {
  const guard = chessRec({ id: 'prayer_target', stats: { atk: 0, maxHp: 1e9 }, skill: null });
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 200,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: r } },
    units: Array.from({ length: count }, (_, i) => ({ chessId: guard.chessId, row: 10, col: 3 + i })), setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 10] });
  return { ...h, e, targets: h.b.allyUnits, id };
}
test('both Prayer variants use original cast clocks and preserve their nonattacking profile', () => {
  for (const id of ids) {
    const h = fixture(id), { b, e, targets: [target] } = h;
    assert.equal(e.profile.noAttack, true); h.run(19.9); assert.equal(e.mem.regularFormVisual, undefined);
    h.run(.2); assert.equal(e.mem.regularFormVisual.clip, 'Skill'); assert.equal(target.findBuff(key), null);
    h.run(.8); assert.equal(target.findBuff(key), null); h.run(.2); assert.equal(target.s.aspd, 70);
    h.run(1.2); assert.equal(e.mem.regularFormVisual, null); assert.equal(e.profile.noAttack, true);
    h.run(14); assert.equal(target.s.aspd, 100); h.run(24.8); assert.equal(target.s.aspd, 70);
    assert.deepEqual(b.errors, []);
  }
});
test('selection captures all eligible ground recipients at cast start, including concealment', () => {
  const h = fixture(ids[0], 8), { b, targets } = h;
  const flags = [{ stealth: true }, { camou: true }, { targetFree: true }, { sleep: true }, { invulnerable: true }, { untargetable: true }];
  flags.forEach((flags, i) => b.addBuff(targets[i], { key: 'fixture:flags', flags }));
  targets[6].motion = 'FLY'; targets[7].deployed = false;
  h.run(20.1); targets[7].deployed = true; h.run(1.1);
  assert.deepEqual(targets.map(t => !!t.findBuff(key)), [true, true, false, false, false, false, false, false]);
  assert.deepEqual(b.errors, []);
});
test('empty casts consume their cooldown and do not select newly deployed targets at release', () => {
  const h = fixture(), { e, targets: [t] } = h; t.deployed = false;
  h.run(20.1); assert.equal(e.mem.regularFormVisual.clip, 'Skill'); t.deployed = true;
  h.run(2.2); assert.equal(t.findBuff(key), null); assert.equal(e.profile.noAttack, true);
  h.run(38.9); assert.equal(t.s.aspd, 70);
});
test('silence and stun interrupt unreleased casts; Slow Down delays release without delaying cooldown', () => {
  for (const status of ['silence', 'stun']) {
    const h = fixture(), { b, e, targets: [t] } = h; h.run(20.2);
    b.applyStatus(e, status, { duration: 1 }); h.run(2.2);
    assert.equal(t.findBuff(key), null); assert.equal(e.profile.noAttack, true); assert.equal(e.mem.regularFormVisual, null);
    h.run(38.8); assert.equal(t.s.aspd, 70); assert.deepEqual(b.errors, []);
  }
  const h = fixture(), { b, e, targets: [t] } = h;
  b.addBuff(e, { key: 'fixture:slow', mods: { slowDownMul: .5 } });
  h.run(21.8); assert.equal(t.findBuff(key), null); assert.equal(e.mem.regularFormVisual.speed, .5);
  h.run(.4); assert.equal(t.s.aspd, 70); h.run(2.3); assert.equal(e.mem.regularFormVisual, null);
  assert.equal(e.profile.noAttack, true); assert.deepEqual(b.errors, []);
});
test('multiple sources extend one debuff without stacking; it survives source death', () => {
  const h = fixture(), { b, e, id, targets: [t] } = h;
  h.run(5); const second = b.spawnEnemy(id, { pos: [9, 10] }); h.run(16.2);
  assert.equal(t.s.aspd, 70); h.run(5); assert.equal(t.s.aspd, 70); assert.ok(t.findBuff(key).timeLeft > 14);
  b.kill(e); b.kill(second); h.run(10); assert.equal(t.s.aspd, 70);
  h.run(5.1); assert.equal(t.s.aspd, 100); assert.deepEqual(b.errors, []);
});
test('Prayer admission rejects changed selectors, clocks, modifiers and no-target rules', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, id);
  for (const [field, value] of [['_targetMotion', 3], ['_forceIgnoreCamouflage', 0], ['_selectTargetTiming', 1], ['_allowNoTarget', 0], ['_maxAnimScale', 2]]) {
    const changed = structuredClone(evidence), id = ids[0];
    const n = nativeComponents(changed, id), cast = n.Roar.find(c => '_activeBuffs' in c);
    const original = Object.hasOwn(cast, field) ? cast : n.$ref(cast._selector);
    const row = changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => {
      const data = JSON.parse(c.originalJson);
      return data.m_GameObject?.m_PathID === original.m_GameObject.m_PathID && data.m_Script?.m_PathID === original.m_Script.m_PathID;
    });
    const data = JSON.parse(row.originalJson); data[field] = value; row.originalJson = JSON.stringify(data);
    assert.equal(!!prayerNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(changed, id)), false, field);
  }
  const r = structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]); r.skills[0].bb.attack_speed = -40;
  assert.equal(prayerNative(r, nativeComponents(evidence, ids[0])), false);
});
