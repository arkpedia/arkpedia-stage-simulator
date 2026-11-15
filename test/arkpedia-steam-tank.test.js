// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { steamTankNative } from '../shared/arkpedia/enemy-steam-tank-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1273_stmgun', 'enemy_1273_stmgun_2'];
function fixture(id = ids[0]) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const ops = [10000, 20000].map((maxHp, i) => chessRec({ id: `steam_target_${i}`,
    stats: { atk: 0, maxHp, blockCnt: 0, res: 0 }, skill: null }));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 100,
    defs: { enemies: { [id]: r }, chess: Object.fromEntries(ops.map(r => [r.chessId, r])) },
    units: ops.map((op, i) => ({ chessId: op.chessId, row: 9, col: 6 + i })), setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 4] }); e.profile.noAttack = true;
  const [low, high] = h.b.allyUnits; high.hp = 10000;
  const hits = []; h.b.on('damaged', c => { if (c.dmg.tags?.includes('steamTankBombardment')) hits.push(c); });
  return { ...h, e, low, high, hits };
}
test('Steam Tanks lock maximum HP, then sample current HP ratio with delayed Arts receipts', () => {
  for (const id of ids) {
    const f = fixture(id); f.run(10.1); assert.equal(f.e.mem.regularFormVisual.clip, 'Skill');
    f.run(4.5); assert.equal(f.hits.length, 0);
    const projectile = f.b.projectiles.list.find(p => p.data?.steamTankBombardment);
    assert.equal(projectile.x, 7); assert.equal(projectile.y, 9);
    f.run(.2); assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, f.low);
    assert.equal(f.hits[0].dmg.type, 'arts'); assert.equal(f.hits[0].dmg.amount, f.e.s.atk * .55);
    f.high.hp = 19999; f.run(.5); assert.equal(f.hits.length, 2); assert.equal(f.hits[1].target, f.high);
    f.run(5); assert.equal(f.hits.length, 10); assert.equal(f.e.mem.regularFormVisual, null);
    assert.equal(f.e.profile.noAttack, true); assert.deepEqual(f.b.errors, []);
  }
});
test('released selection survives source death but its carrier stops choosing new recipients', () => {
  const f = fixture(); f.run(14.6); assert.equal(f.hits.length, 0);
  f.b.kill(f.e); f.run(.3); assert.equal(f.hits.length, 1);
  f.run(6); assert.equal(f.hits.length, 1); assert.deepEqual(f.b.errors, []);
});
test('ordinary Steam Tank attacks remain physical homing shots outside Cannon', () => {
  const f = fixture(); f.e.profile.noAttack = false; const packets = [];
  f.b.on('damaged', c => { if (c.source === f.e) packets.push(c); });
  f.run(.1); assert.equal(packets.length, 0); f.run(.9);
  assert.equal(packets.length, 1); assert.equal(packets[0].dmg.type, 'phys');
  assert.equal(packets[0].dmg.amount, 600); assert.deepEqual(f.b.errors, []);
});
test('a delayed receipt cannot hit a replacement deployment', () => {
  const f = fixture(); f.run(14.6); f.low.deploySeq++; f.b.kill(f.e); f.run(.5);
  assert.equal(f.hits.length, 0); assert.deepEqual(f.b.errors, []);
});
test('bombardment stays at its release position while recipient selection follows occupancy', () => {
  const f = fixture(); f.run(14.2); const projectile = f.b.projectiles.list.find(p => p.data?.steamTankBombardment);
  f.high.x = 10; f.low.x = 10; f.run(1); assert.equal(f.hits.length, 0);
  assert.equal(projectile.x, 7); f.low.x = 6; f.run(.7); assert.ok(f.hits.length > 0);
  assert.deepEqual(f.b.errors, []);
});
test('Cannon protection is owned by the cast and Slow Down delays its release', () => {
  const f = fixture(); f.run(10.1);
  for (const status of ['stun', 'freeze', 'sleep', 'levitate']) f.b.applyStatus(f.e, status, { duration: 3 });
  f.b.addBuff(f.e, { key: 'fixture:slow', mods: { slowDownMul: .5 } });
  f.run(5); assert.equal(f.hits.length, 0); assert.equal(f.e.mem.regularFormVisual.speed, .5);
  f.run(4); assert.ok(f.hits.length > 0); assert.deepEqual(f.b.errors, []);
});
test('Steam Tank admission rejects changed selectors and delayed damage payloads', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, id);
  const ev = structuredClone(evidence);
  ev.templates['enemy_stmgun_s[damage]'].eventToActions.ON_BUFF_TRIGGER[0]._damageType = 'PHYSICAL';
  assert.equal(steamTankNative(ENEMY_RECORDS.enemies[ids[0]].levels[0], nativeComponents(ev, ids[0])), false);
  const changed = structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]); changed.skills[0].bb.atk_scale = 1;
  assert.equal(steamTankNative(changed, nativeComponents(evidence, ids[0])), false);
});
