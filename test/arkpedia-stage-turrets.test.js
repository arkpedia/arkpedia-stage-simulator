// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { turretDefinition, turretNativeReviewed } from '../shared/arkpedia/stage-turrets.js';
import { segmentCircleEntry } from '../server/sim/projectile-collision.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { originalDeviceDirection } from '../tools/arkpedia/stage-device-instances.mjs';
const c = await loadContentContext(), p = await planStage(c, 'mn-6');
assert.deepEqual(p.blockers, []);
function setup() {
  const stage = structuredClone(p.stage); stage.devices = stage.devices.slice(0, 1);
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6;
  const d = [...b.stageTurrets.entries.values()][0];
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  const target = (row, col, flags = {}) => {
    const u = b.spawnDevice('test:turret-recipient', row, col, { hp: 10000, def: 100, blockCnt: 0 });
    u.profile.enemyTargetableDevice = true;
    b.addBuff(u, { key: 'test:hold', flags: { noMove: true, disarm: true, ...flags } }); return u;
  };
  return { b, d, advance, target };
}
test('Turrets retain original level, skill and four-way direction instead of relying on viewer names', () => {
  assert.equal(turretNativeReviewed(), true);
  assert.deepEqual([0, 1, 2, 3].map(originalDeviceDirection), ['UP', 'RIGHT', 'DOWN', 'LEFT']);
  for (const value of [-1, 4, undefined, '0', 'NORTH']) assert.throws(() => originalDeviceDirection(value), /Missing/);
  assert.deepEqual(p.stage.devices.map(d => d.instance), [
    ...Array.from({ length: 4 }, () => ({ level: 4, skillLevel: 1, direction: 'RIGHT' })),
    ...Array.from({ length: 2 }, () => ({ level: 4, skillLevel: 1, direction: 'UP' })),
  ]);
  assert.equal(turretDefinition({ level: 1, skillLevel: 1, direction: 'DOWN' }).atk, 100);
  assert.equal(turretDefinition({ level: 30, skillLevel: 1, direction: 'LEFT' }).atk, 3000);
  assert.throws(() => turretDefinition({ level: 4, skillLevel: 1 }), /Unsupported/);
  for (const [key, field, value] of [['projectile_ballis', '_maxHitNum', 2], ['projectile_ballis', '_goThroughWall', 0],
    ['projectile_ballis', 'm_Radius', .1], ['sktok_ballis', '_preDelay', 0]]) {
    const changed = structuredClone(native); changed.prefabs[key].components.find(c => field in c.data).data[field] = value;
    assert.equal(turretNativeReviewed(changed), false);
  }
});
test('swept collision returns the first contact, including fast crossings and excluding misses', () => {
  assert.equal(segmentCircleEntry({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, .75), .425);
  assert.equal(segmentCircleEntry({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 1 }, .75), null);
  assert.equal(segmentCircleEntry({ x: 5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, .75), 0);
});
test('charge and pre-delay launch a real straight bolt, hitting only the first ally after DEF', () => {
  const { b, d, advance, target } = setup(), r = d.unit.tileR;
  const first = target(r, 4), behind = target(r, 5); const hit = [];
  b.on('hit', h => { if (h.dmg.tags.includes('stage:turret')) hit.push(h); });
  advance(4.9); assert.equal(b.projectiles.list.length, 0); assert.equal(first.hp, 10000);
  advance(.2); assert.equal(first.hp, 10000); assert.equal(d.state, 'active');
  advance(.3); assert.equal(first.hp, 9700); assert.equal(behind.hp, 10000);
  assert.equal(hit.length, 1); assert.equal(hit[0].dmg.isAttack, false); assert.equal(hit[0].source, d.unit);
  assert.equal(b.projectiles.list.filter(p => p.data?.stageTurret).length, 0);
  assert.equal(d.unit.counted, false); assert.equal(d.unit.deploymentSlotCost, 0); assert.equal(d.unit.side, 'enemy');
  assert.equal(b.grid.tile(d.unit.tileR, d.unit.tileC).pass, 'FLY'); assert.deepEqual(b.errors, []);
});
test('bolts pass walls, ignore enemies/camouflage, hit airborne allies and stop even when the first ally dodges', () => {
  const { b, d, advance, target } = setup(), r = d.unit.tileR;
  const hidden = target(r, 3, { camou: true }), first = target(r, 5), behind = target(r, 6);
  first.motion = 'FLY'; b.addBuff(first, { key: 'test:dodge', mods: { dodgePhys: 1 } });
  b.grid.setTile(r, 4, { ...b.grid.tile(r, 4), pass: 'NONE', height: 'HIGH' });
  const enemy = b.spawnEnemy('enemy_1099_nbkght', { pos: [r, 3.8] });
  b.addBuff(enemy, { key: 'test:hold', flags: { noMove: true, disarm: true } }); const hp = enemy.hp;
  d.sp = 5; advance(.6);
  assert.equal(hidden.hp, 10000); assert.equal(first.hp, 10000); assert.equal(behind.hp, 10000); assert.equal(enemy.hp, hp);
  assert.equal(b.projectiles.list.filter(p => p.data?.stageTurret).length, 0); assert.deepEqual(b.errors, []);
});
test('four directions preserve source direction, and released bolts survive source removal', () => {
  for (const [direction, dr, dc] of [['UP', 1, 0], ['DOWN', -1, 0], ['RIGHT', 0, 1], ['LEFT', 0, -1]]) {
    const { b, d, advance, target } = setup(); d.spec.direction = direction;
    d.unit.x = 4; d.unit.y = 3; d.unit.tileC = 4; d.unit.tileR = 3;
    const u = target(3 + dr * 2, 4 + dc * 2); b.stageTurrets.fire(d);
    d.unit.alive = false; d.unit.deployed = false;
    advance(.3); assert.equal(u.hp, 9700, direction); assert.deepEqual(b.errors, []);
  }
});
