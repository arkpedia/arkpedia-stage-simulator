// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
function fixture(id = 'enemy_1076_bsthmr') {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'demo_target', stats: { maxHp: 100000, atk: 0, def: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [[9, 6], [9, 7], [10, 6], [8, 6], [10, 7]].map(([row, col]) => ({ chessId: guard.chessId, row, col })),
    setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const [center, side, hidden, air, diagonal] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  b.addBuff(side, { key: 'camouflage', flags: { camou: true } });
  b.addBuff(hidden, { key: 'stealth', flags: { stealth: true } }); air.motion = 'FLY';
  const e = b.spawnEnemy(id, { pos: [9, 6.2] }), hits = [];
  assert.ok(b._checkBlock(e)); assert.equal(e.blockedBy, center);
  b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { h, b, e, center, side, hidden, air, diagonal, hits };
}
for (const id of ['enemy_1076_bsthmr', 'enemy_1076_bsthmr_2']) test(`${id}: full primary damage plus a separate half-ATK cross, without double-hitting the primary`, () => {
  const { h, b, e, center, side, hidden, air, diagonal, hits } = fixture(id);
  b.applyStatus(e, 'silence', { duration: 10, force: true });
  h.run(.1); assert.equal(e.stats.attacks, 1); assert.equal(hits.length, 2);
  const primary = hits.find(c => c.target === center), secondary = hits.find(c => c.target === side);
  assert.equal(primary.hpLoss, e.s.atk); assert.equal(primary.dmg.isAttack, true);
  assert.equal(secondary.hpLoss, e.s.atk * .5); assert.equal(secondary.dmg.isAttack, false);
  assert.equal(secondary.dmg.applyWay, 'melee');
  for (const unit of [hidden, air, diagonal]) assert.equal(unit.hp, unit.s.maxHp);
  assert.deepEqual(b.errors, []);
});

test('secondary splash cannot be dodged and still happens when the primary attack is dodged or lethal', () => {
  for (const scenario of ['dodged', 'lethal']) {
    const { h, b, e, center, side, hits } = fixture();
    b.addBuff(side, { key: 'splash-dodge', mods: { dodgePhys: 1 } });
    if (scenario === 'dodged') b.addBuff(center, { key: 'primary-dodge', mods: { dodgePhys: 1 } });
    else center.hp = 1;
    h.run(.1);
    assert.equal(side.s.maxHp - side.hp, e.s.atk * .5);
    assert.equal(hits.filter(c => c.target === side).length, 1);
    if (scenario === 'dodged') assert.equal(center.hp, center.s.maxHp); else assert.equal(center.alive, false);
    assert.deepEqual(b.errors, []);
  }
});

test('damage from other abilities does not recursively generate an ordinary attack splash', () => {
  const { b, e, center, side } = fixture(); const hp = side.hp;
  b.dealDamage(e, center, { amount: 100, type: 'phys', isSkill: true, canDodge: false });
  assert.equal(side.hp, hp); assert.deepEqual(b.errors, []);
});

test('original range, target exclusion and damage semantics gate admission', () => {
  const id = 'enemy_1076_bsthmr', entry = ENEMY_RECORDS.enemies[id];
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    x => { x.ranges['x-5'].grids[0].col = 1; },
    x => { x.templates.bsthmr_range.eventToActions.ON_BUFF_FINISH[0]._excludeTarget = false; },
    x => { x.templates.bsthmr_range.eventToActions.ON_BUFF_FINISH[0]._targetOptions.targetMotion = 'ALL'; },
    x => { for (const row of x.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) { const c = JSON.parse(row.originalJson); if (c._activeBuffs) c._activeBuffs[0].isDamageMissable = 1; row.originalJson = JSON.stringify(c); } },
  ]) { const changed = structuredClone(evidence); edit(changed); assert.equal(enemySupport(entry, index.prefabs, changed).policy, null); }
});
