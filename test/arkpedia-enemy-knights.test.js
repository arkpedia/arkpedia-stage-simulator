// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const CORRUPTED = 'enemy_1513_dekght', WITHERED = 'enemy_1513_dekght_2';
function fixture(id, positions = [[9, 6], [9, 5], [10, 6], [10, 5]]) {
  const guard = chessRec({ id: 'knight-target', stats: { maxHp: 1e7, atk: 0, def: 100, res: 20 }, skill: null });
  const enemies = Object.fromEntries([CORRUPTED, WITHERED].map(k => [k, structuredClone(records.enemies[k].levels[0])]));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180, captureNoisy: true,
    defs: { chess: { [guard.chessId]: guard }, enemies }, units: positions.map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6.3] }); b.addBuff(e, { key: 'test:stationary', flags: { noMove: true } });
  const a = e.mem.ab.list.find(a => a.cast !== undefined || a.off); return { h, b, e, a, targets: b.allyUnits };
}

test('both knight levels require their native skill, projectile, selector and partner definitions', () => {
  for (const id of [CORRUPTED, WITHERED]) assert.ok(enemySupport(records.enemies[id], clocks.prefabs, native).policy);
  for (const edit of [
    (d, name) => { if (name === 'TriggerRage' && d._targetId) d._targetId = CORRUPTED; },
    d => { if (d._maxNum === 3) d._maxNum = 1; },
  ]) {
    const changed = structuredClone(native);
    for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${CORRUPTED}.prefab`].concat(changed.prefabs[`dyn/battle/prefabs/enemies/${WITHERED}.prefab`])) {
      const d = JSON.parse(row.originalJson); edit(d, row.objectName); row.originalJson = JSON.stringify(d);
    }
    assert.ok([CORRUPTED, WITHERED].some(id => !enemySupport(records.enemies[id], clocks.prefabs, changed).policy));
  }
  const changed = structuredClone(native); changed.templates['enemy_dekght_2[aoe]'].eventToActions.ON_BUFF_TRIGGER[0]._checkTargetAlive = false;
  assert.equal(enemySupport(records.enemies[WITHERED], clocks.prefabs, changed).policy, null);
});

test('the exact opposite knight dying grants one permanent rage; same-kind death and escape do not', () => {
  for (const id of [CORRUPTED, WITHERED]) {
    const { b, e } = fixture(id), other = id === CORRUPTED ? WITHERED : CORRUPTED;
    const before = { atk: e.s.atk, aspd: e.s.aspd, move: e.s.moveSpeed };
    b.kill(b.spawnEnemy(id, { pos: [8, 7] })); assert.equal(e.findBuff('ab:knightRage'), null);
    b.leak(b.spawnEnemy(other, { pos: [8, 7] })); assert.equal(e.findBuff('ab:knightRage'), null);
    b.kill(b.spawnEnemy(other, { pos: [8, 7] }));
    assert.equal(e.s.atk, before.atk * 1.8); assert.equal(e.s.aspd, before.aspd + 100); assert.equal(e.s.moveSpeed, before.move * 2.5);
    b.kill(b.spawnEnemy(other, { pos: [8, 7] })); assert.equal(e.s.atk, before.atk * 1.8); assert.deepEqual(b.errors, []);
  }
});

test('Corrupted ordinary hits damage the blocker once and splash the four adjacent ground tiles independently', () => {
  const { h, b, e, targets } = fixture(CORRUPTED), [primary, adjacent, air, diagonal] = targets;
  air.motion = 'FLY'; b.addBuff(primary, { key: 'test:dodge', mods: { dodgePhys: 1 } });
  b.addBuff(adjacent, { key: 'test:camouflage', flags: { camou: true } });
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 5));
  assert.equal(primary.stats.taken, 0); assert.equal(adjacent.stats.taken, e.s.atk - 100);
  assert.equal(air.stats.taken, 0); assert.equal(diagonal.stats.taken, 0); assert.deepEqual(b.errors, []);
});

test('Corrupted charge uses the finite duration clock, cancels on stun and scales each hit before DEF', () => {
  const { h, b, e, a, targets: [primary, adjacent] } = fixture(CORRUPTED);
  a.left = 0; h.step(2); assert.ok(a.cast); const start = b.time;
  const before = primary.hp; h.run(2.8); assert.equal(primary.hp, before);
  assert.ok(h.runUntil(() => primary.hp < before, .3));
  assert.equal(before - primary.hp, e.s.atk * 3 - 100); assert.equal(adjacent.stats.taken, e.s.atk * 3 - 100);
  assert.ok(b.time - start >= 2.9 && b.time - start <= 3.1);
  h.run(1.2); assert.equal(a.cast, null);
  a.left = 0; h.step(1); assert.ok(a.cast); const hp = primary.hp;
  b.applyStatus(e, 'stun', { duration: 5 }); assert.equal(a.cast, null); h.run(4); assert.equal(primary.hp, hp);
  assert.deepEqual(b.errors, []);
});

test('Withered ordinary fire releases two real Arts projectiles; its skill attaches three delayed bombs without immediate damage', () => {
  const { h, b, e, a, targets } = fixture(WITHERED, [[9, 5], [10, 5], [10, 6], [8, 5]]);
  for (const u of targets) b.addBuff(u, { key: 'test:noBlock', flags: { noBlock: true } });
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 4)); assert.equal(b.projectiles.list.length, 2);
  h.run(.5); assert.equal(targets.filter(u => u.stats.taken > 0).length, 2);
  const hits = targets.map(u => u.stats.taken); a.left = 0; h.step(1); assert.ok(a.cast); h.run(1.4);
  assert.deepEqual(targets.map(u => u.stats.taken), hits);
  assert.equal(targets.filter(u => u.buffs.some(b => b.key.startsWith('ab:knightArrow:'))).length, 3);
  const packets = []; b.on('hit', c => { if (c.dmg.tags.includes('knightArrow') || c.dmg.tags.includes('knightArrowSplash')) packets.push(c); });
  h.run(2.6); assert.equal(packets.filter(p => p.dmg.tags.includes('knightArrow')).length, 3);
  assert.ok(packets.some(p => p.dmg.isSplash)); assert.deepEqual(b.errors, []);
});

test('attached arrows stop on source death or recipient removal and follow a living recipient to its current tile', () => {
  for (const stop of ['source', 'recipient', 'move']) {
    const { h, b, e, a, targets: [target] } = fixture(WITHERED, [[9, 5]]);
    b.addBuff(target, { key: 'test:noBlock', flags: { noBlock: true } });
    a.left = 0; assert.ok(h.runUntil(() => target.buffs.some(b => b.key.startsWith('ab:knightArrow:')), 2));
    const before = target.hp;
    if (stop === 'source') b.kill(e);
    else if (stop === 'recipient') b._remove(target, 'retreat', null, true);
    else { target.x = 7; target.tileC = 7; }
    const hits = []; b.on('hit', c => { if (c.dmg.tags.includes('knightArrow')) hits.push(c); });
    h.run(2.6);
    if (stop === 'move') { assert.equal(hits.length, 1); assert.ok(target.hp < before); }
    else assert.equal(hits.length, 0);
    assert.deepEqual(b.errors, []);
  }
});
