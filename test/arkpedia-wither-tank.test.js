// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { movingCorruptionProjectile } from '../server/sim/content/arkpedia-enemy-wither-tank.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { witherTankNative } from '../shared/arkpedia/enemy-wither-tank-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1272_nhtank', 'enemy_1272_nhtank_2'];
function fixture(id = ids[0], row = 9) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const op = chessRec({ id: 'tank_target', stats: { atk: 0, maxHp: 100000, def: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { enemies: { [id]: r }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row, col: 7 }], setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 6] });
  return { ...h, e, target: h.b.allyUnits[0] };
}
test('both tank variants start charged and release pollution on the first and fourth ranged attacks', () => {
  for (const id of ids) {
    const f = fixture(id), emitted = [], add = f.b.addProjectile.bind(f.b);
    f.b.addProjectile = p => { if (p.data?.witherTankPollution) emitted.push(f.b.time); return add(p); };
    assert.ok(f.e.findBuff('nhtank_s_effect')); f.run(.6);
    assert.equal(emitted.length, 1); assert.equal(f.e.findBuff('nhtank_s_effect'), null);
    assert.equal(f.e.stats.attacks, 1); f.run(8.7);
    assert.equal(f.e.stats.attacks, 3); assert.equal(emitted.length, 1); assert.ok(f.e.findBuff('nhtank_s_effect'));
    f.run(4.5); assert.equal(f.e.stats.attacks, 4); assert.equal(emitted.length, 2);
    assert.deepEqual(f.b.errors, []);
  }
});
test('ranged selection excludes high-ground and flying bodies', () => {
  for (const kind of ['high', 'fly', 'liftoff']) {
    const f = fixture(ids[0], kind === 'high' ? 10 : 9);
    if (kind === 'high') f.b.grid.setTile(f.target.tileR, f.target.tileC, { ...f.b.grid.tile(f.target.tileR, f.target.tileC), height: 'HIGH' });
    if (kind === 'fly') f.target.motion = 'FLY';
    if (kind === 'liftoff') f.b.addBuff(f.target, { key: 'fixture:air', flags: { liftoff: true } });
    f.run(5); assert.equal(f.e.stats.attacks, 0, kind); assert.equal(f.target.hp, 100000);
    assert.deepEqual(f.b.errors, []);
  }
});
test('blocked tanks ram at double ATK without spending their charged ranged shot', () => {
  const f = fixture(); f.target.base.blockCnt = 1; f.target.markDirty(); f.e.x = 7; f.b._checkBlock(f.e);
  f.run(.2); assert.equal(f.e.blockedBy, f.target); assert.equal(f.target.hp, 100000 - 1500);
  assert.ok(f.e.findBuff('nhtank_s_effect'));
  assert.equal(f.b.projectiles.list.some(p => p.data?.witherTankPollution), false);
  assert.equal(f.e.profile.attackVisual, 'Attack2'); assert.deepEqual(f.b.errors, []);
});
test('pollution carriers survive source death, stop at arrival, and remove only their own field on interception', () => {
  const f = fixture(); f.e.profile.noAttack = true;
  const p = movingCorruptionProjectile(f.b, f.e, f.target, { speed: 4, life: 10, radius: 2.2, low: 50, high: 25 });
  f.b.kill(f.e); f.run(1.1); assert.equal(f.target.hp, 99950);
  const point = [p.x, p.y]; f.target.x += .5; f.run(1);
  assert.deepEqual([p.x, p.y], point); assert.equal(f.target.hp, 99900);
  f.b.projectiles.remove(shot => shot === p); const hp = f.target.hp; f.run(2);
  assert.equal(f.target.hp, hp); assert.equal(f.target.findBuff('ab:corruption'), null);
  assert.deepEqual(f.b.errors, []);
});
test('carrier profession mask excludes traps while target-free operators remain exposed', () => {
  const f = fixture(); f.e.profile.noAttack = true;
  const device = f.b.spawnDevice('fixture:trap', 9, 8, { hp: 10000, blockCnt: 0 });
  device.def.profession = 'TRAP'; device.profile.characterLikeDevice = true;
  f.b.addBuff(f.target, { key: 'fixture:targetFree', flags: { targetFree: true, camou: true } });
  movingCorruptionProjectile(f.b, f.e, f.target, { speed: 4, life: 10, radius: 2.2, low: 50, high: 25 });
  f.run(1.1); assert.equal(f.target.hp, 99950); assert.equal(device.hp, 10000);
  assert.deepEqual(f.b.errors, []);
});
test('native tank gates reject changed SP, target height and projectile lifetimes', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, id);
  const r = structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]); r.sp.initSp = 0;
  assert.equal(witherTankNative(r, nativeComponents(evidence, ids[0])), false);
  const ev = structuredClone(evidence), parts = ev.projectiles.projectile_enemy_nhtank;
  const part = parts.find(r => '_lifeTime' in JSON.parse(r.originalJson));
  const data = JSON.parse(part.originalJson); data._lifeTime = 1; part.originalJson = JSON.stringify(data);
  assert.equal(witherTankNative(ENEMY_RECORDS.enemies[ids[0]].levels[0], nativeComponents(ev, ids[0])), false);
});
