// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { sortAllyTargets } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1059_buster';
function fixture(id, building, silence) {
  const target = chessRec({ id: 'fanatic_target', stats: { atk: 0, maxHp: 1e6, def: 150 } });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true,
    defs: { chess: { [target.chessId]: target }, enemies: { [id]: record } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const b = h.b, u = b.allyUnits[0];
  if (building) u.tags.add('building');
  b.addBuff(u, { key: 'dummy', flags: { disarm: true, noBlock: true, noMove: true } });
  const e = b.spawnEnemy(id, { pos: [9, 7] });
  if (silence) b.applyStatus(e, 'silence', 10);
  return { h, b, u, e };
}
test('Fanatic direct attacks scale ATK against building tags before DEF; Silence suppresses only the bonus', () => {
  for (const id of [ID, ID + '_2']) for (const building of [false, true]) for (const silence of [false, true]) {
    const { h, b, u, e } = fixture(id, building, silence);
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3));
    const scale = building && !silence ? (id === ID ? 1.5 : 1.8) : 1;
    assert.equal(u.stats.taken, e.s.atk * scale - 150);
    const hits = h.hooksOf('damaged').filter(c => c.source === e);
    assert.equal(hits.length, 1); assert.equal(b.projectiles.list.length, 0);
    assert.equal(hits[0].dmg.type, 'phys'); assert.equal(hits[0].dmg.isAttack, true);
    assert.deepEqual(b.errors, []);
  }
});
test('Fanatic keeps building selection under Silence and still honors its blocker', () => {
  const { e } = fixture(ID, false, true);
  const building = { tags: new Set(['building']), s: { taunt: 0 }, aggroSeq: 1 };
  const later = { tags: new Set(), s: { taunt: 3 }, aggroSeq: 2 };
  assert.equal(sortAllyTargets(e, [later, building])[0], building);
  e.blockedBy = later; assert.equal(sortAllyTargets(e, [building, later])[0], later);
});
test('Fanatic admission refuses changed direct damage, target tag and silenceability', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, native).policy);
  for (const change of ['damage', 'tag', 'silence']) {
    const n = structuredClone(native);
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`]) {
      const v = JSON.parse(row.originalJson);
      if (change === 'damage' && '_damageType' in v) v._damageType = 2;
      if (change === 'tag' && '_filterTag' in v) v._filterTag = 'unknown';
      if (change === 'silence' && v._buffs?.[0]?.templateKey === 'filtertag_enhance') v._buffs[0].isSilenceable = 0;
      row.originalJson = JSON.stringify(v);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, n).policy, null, change);
  }
});
