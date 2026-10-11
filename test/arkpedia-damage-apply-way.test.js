// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { performAttack } from '../server/sim/ai.js';
function make(applyWay = 'RANGED', range = 2) {
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { chess: { guard: chessRec({ id: 'guard', skill: null, stats: { maxHp: 100000, atk: 100 } }) },
      enemies: { enemy: enemyRec({ key: 'enemy', hp: 100000, atk: 100, speed: 0, applyWay, range }) } },
    units: [{ chessId: 'guard', row: 10, col: 5 }], enemies: [{ key: 'enemy', pos: [10, 5.3] }],
  });
  h.step(); const u = h.unit('guard'), e = h.enemies()[0]; u.atkCd = 1000;
  const hits = []; h.b.on('hit', ctx => hits.push({ source: ctx.source, way: ctx.dmg.applyWay }));
  return { h, b: h.b, u, e, hits };
}
test('source enemy ranged attacks stay ranged even when adjacent or blocked; melee stays melee with a nonzero ability radius', () => {
  for (const [applyWay, range, expected] of [['RANGED', 2, 'ranged'], ['MELEE', 2, 'melee']]) {
    const { h, u, e, hits } = make(applyWay, range);
    e.blockedBy = u; u.blocking = [e]; e.atkCd = 0; h.step();
    assert.ok(hits.some(hit => hit.source === e && hit.way === expected));
    assert.deepEqual(h.b.errors, []);
  }
});
test('ally primitive damage applies explicit melee/ranged origin while direct ability damage has no inferred attack origin', () => {
  const { h, b, u, e, hits } = make(); e.atkCd = 1000;
  for (const [attack, projectile, expected] of [['melee', 'none', 'melee'], ['ranged', 'beam', 'ranged']]) {
    performAttack(b, u, { attack, projectile, dmgType: 'phys' }, [e]);
    assert.equal(hits.at(-1).way, expected);
  }
  b.dealDamage(u, e, { amount: 100, type: 'phys', isAttack: true }); assert.equal(hits.at(-1).way, 'none');
  b.dealDamage(null, u, { amount: 100, type: 'true', applyWay: 'fabricated' }); assert.equal(hits.at(-1).way, 'none');
  assert.deepEqual(h.b.errors, []);
});
