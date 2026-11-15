// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { sortAllyTargets } from '../server/sim/targeting.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
function fixture(id = 'enemy_1112_emppnt') {
  const guard = chessRec({ id: 'shell_target', stats: { maxHp: 100000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 30,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [[9, 6], [10, 6], [10, 7]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); const [target, side, outside] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'stationary', flags: { noMove: true, disarm: true } });
  b.addBuff(target, { key: 'target', mods: { taunt: 10 } });
  const e = b.spawnEnemy(id, { pos: [9, 8] }), hits = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('shell')) hits.push(c); });
  return { h, b, e, target, side, outside, hits };
}
for (const id of ['enemy_1112_emppnt', 'enemy_1112_emppnt_2']) {
  test(`${id}: delayed blast uses launch ATK, fixed radius, no source, and camouflage-independent collision`, () => {
    const { h, b, e, target, side, outside, hits } = fixture(id), atk = e.s.atk;
    assert.equal(b._displaceable(e), false);
    b.addBuff(side, { key: 'camouflage', flags: { camou: true } });
    h.run(.1); assert.equal(e.stats.attacks, 1); assert.equal(hits.length, 0);
    b.addBuff(e, { key: 'later-attack-buff', mods: { atkPct: 1 } });
    h.run(2.8); assert.equal(hits.length, 0); h.run(.2);
    assert.equal(hits.length, 2); assert.deepEqual(new Set(hits.map(c => c.target)), new Set([target, side]));
    for (const c of hits) { assert.equal(c.source, null); assert.equal(c.hpLoss, atk); assert.equal(c.dmg.isAttack, false); }
    assert.equal(outside.hp, outside.s.maxHp); assert.deepEqual(b.errors, []);
  });
  test(`${id}: moving away evades the locked shell, which survives source death and hits the former position`, () => {
    const { h, b, e, target, side, hits } = fixture(id); h.run(.1); target.x += 5;
    b.kill(e, side); h.run(3.1);
    assert.equal(target.hp, target.s.maxHp); assert.equal(hits.length, 1); assert.equal(hits[0].target, side);
    assert.deepEqual(b.errors, []);
  });
}
test('neutral markers break equal-taunt ties, while greater taunt and the actual blocker remain ahead', () => {
  const { b, e, target, side, outside } = fixture(); b.removeBuff(target, 'target');
  b.addBuff(target, { key: 'mark_neutral[effect]', persist: true });
  assert.equal(sortAllyTargets(e, [outside, side, target])[0], target);
  b.addBuff(side, { key: 'taunt', mods: { taunt: 1 } }); assert.equal(sortAllyTargets(e, [target, side])[0], side);
  e.blockedBy = target; assert.equal(sortAllyTargets(e, [side, target])[0], target);
  assert.deepEqual(b.errors, []);
});
test('blast respects stealth, includes air, and is not suppressed by source silence', () => {
  const { h, b, e, target, side, hits } = fixture(); b.applyStatus(e, 'silence', { duration: 10, force: true });
  side.motion = 'FLY'; h.run(.1); b.addBuff(target, { key: 'stealth', flags: { stealth: true } }); h.run(3.1);
  assert.equal(target.hp, target.s.maxHp); assert.equal(hits.length, 1); assert.equal(hits[0].target, side);
  assert.deepEqual(b.errors, []);
});
test('native shell/selector changes and gameplay added to the scanning visual invalidate admission', () => {
  const id = 'enemy_1112_emppnt', entry = ENEMY_RECORDS.enemies[id];
  assert.ok(enemySupport(entry, index.prefabs, evidence).policy); assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    c => { if ('_useCachedAtkOnly' in c) c._useCachedAtkOnly = 0; },
    c => { if ('_buffKey' in c) c._buffKey = 'another-priority'; },
    c => { if ('_delayToStart' in c) c._delayToStart = 1; },
    c => { if ('_alwaysHitTraceTargetInTheEnd' in c) c._alwaysHitTraceTargetInTheEnd = 1; },
    c => { if (c._buffs) c._buffs[0].attributes.attributeModifiers.push({ attributeType: 1, value: 100 }); },
  ]) {
    const changed = structuredClone(evidence);
    for (const row of [...changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`], ...changed.projectiles.projectile_enemy_emppnt]) {
      const c = JSON.parse(row.originalJson); edit(c); row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(entry, index.prefabs, changed).policy, null);
  }
});
