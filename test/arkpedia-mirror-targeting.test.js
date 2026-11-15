// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { sortEnemyTargets } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

for (const id of ['enemy_1199_sfjin', 'enemy_1199_sfjin_2']) {
  test(`${id}: original taunt affects selection without overriding blockers or losing its death-spawn`, () => {
    assert.ok(support.enemies[id].policy);
    const h = spawnAny(id, { seconds: .1 }), b = h.b, guard = b.allyUnits[0], e = b.enemies[0];
    const childKey = ENEMY_RECORDS.enemies[id].levels[0].talents.bbStr['DeadSpawn.enemy_key'];
    const ordinary = b.spawnEnemy(childKey, { pos: [9, 7] });
    e.x = 8; e.y = 9;
    assert.equal(e.s.taunt, 1); assert.equal(ordinary.s.taunt, 0);
    assert.equal(sortEnemyTargets(b, guard, [ordinary, e], null)[0], e);
    assert.equal(sortEnemyTargets(b, guard, [ordinary, e], 'nearest')[0], ordinary);
    b.applyStatus(e, 'silence', { duration: 10 });
    assert.equal(e.s.taunt, 1, 'base targeting priority is not a silenceable talent');
    ordinary.x = guard.x + .2; ordinary.y = guard.y;
    assert.equal(b._checkBlock(ordinary), false, 'the mirror fragment remains unblockable');
    const blocked = b.spawnEnemy(id, { pos: [9, 6] });
    b.addBuff(blocked, { key: 'test:lower-priority', persist: true, mods: { taunt: -1 } });
    assert.ok(b._checkBlock(blocked)); assert.equal(blocked.s.taunt, 0);
    assert.equal(sortEnemyTargets(b, guard, [e, blocked], null)[0], blocked);
    const before = b.enemies.filter(u => u.defId === childKey).length;
    b.autoFinish = false; b.kill(e, null); h.run(.1);
    assert.equal(b.enemies.filter(u => u.defId === childKey).length, before + 1);
    assert.deepEqual(b.errors, []);
  });
}
test('a handbook claim cannot substitute for the source targeting-priority attribute', () => {
  const changed = structuredClone(ENEMY_RECORDS.enemies.enemy_1199_sfjin);
  changed.levels[0].stats.tauntLevel = 0;
  assert.equal(enemySupport(changed, index.prefabs, evidence).policy, null);
  assert.equal(support.enemies.enemy_1279_sgbdg.policy, null, 'unimplemented Blood Debt remains blocked');
  assert.equal(support.enemies.enemy_1434_dsshel.policy, null, 'unimplemented carapace spawn remains blocked');
});
