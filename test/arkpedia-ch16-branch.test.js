// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { chapter16StageFixture } from './helpers/chapter16Stage.js';
import { chapter16BranchSpawner } from '../server/sim/content/chapter16-branch.js';

test('real preplaced tunnel charges, accepts the manual command and summons on the separate native extra route', () => {
  const { b, run, source } = chapter16StageFixture({ isolated: true });
  const [id, entry] = [...b.stageDeviceActions][0];
  assert.equal(entry.owner.side, 'ally'); assert.equal(entry.owner.s.maxHp, 3000);
  assert.equal(entry.owner.s.def, 100); assert.equal(entry.owner.s.blockCnt, 0);
  assert.equal(b.activateStageDevice(id), false, 'preview cannot issue battle commands');
  b.setViewport('fullscreen-workspace');
  run(15.1);
  const child = b.enemies.find(e => e.mem.ch16TunnelHost);
  assert.ok(child); assert.equal(child.mem.ch16Branch.route, 0);
  assert.ok(Math.abs(child.spawnX - source.rawLevel.extraRoutes[0].startPosition.col) <= .4);
  assert.ok(Math.abs(child.spawnY - source.rawLevel.extraRoutes[0].startPosition.row) <= .4);
  assert.deepEqual(child.route.legs.filter(l => l.r === 4 || l.r === 3.99).slice(0, 2).map(l => [l.r, l.c]), [[4, 4.46], [3.99, 7.54]]);
  assert.equal(child.counted, false); assert.equal(child.holdsBattle, false);
  assert.equal(b.activateStageDevice(id), true); assert.equal(entry.state.waiting, 0);
  const point = [child.x, child.y]; run(.5);
  assert.notDeepEqual([child.x, child.y], point);
  assert.equal(b.flags.moveScale, .5);
});

test('three commanded miners traverse the original route, destroy contacted structures and leave harmlessly', () => {
  const { b, run } = chapter16StageFixture({ isolated: true });
  b.setViewport('fullscreen-workspace');
  run(45.1);
  const [id, entry] = [...b.stageDeviceActions][0];
  assert.equal(entry.state.waiting, 3);
  assert.equal(b.activateStageDevice(id), true);
  const initial = b.enemies.filter(e => e.mem.ch16TunnelHost);
  const damage = [];
  const visited = new Set();
  b.on('enemyMoved', ({ enemy, to }) => {
    if (!initial.includes(enemy)) return;
    const x = to.x - enemy.route.cursorOffset.x, y = to.y - enemy.route.cursorOffset.y;
    if (Math.hypot(x - 4.46, y - 4) <= .05 + 1e-9) visited.add('first facility');
    if (Math.hypot(x - 7.54, y - 3.99) <= .05 + 1e-9) visited.add('second facility');
  });
  b.on('damaged', c => { if (c.target.mem.ch16Structure && c.source?.mem.ch16Miner) damage.push(c.target); });
  run(240);
  assert.ok(damage.length > 0);
  assert.ok(b.enemies.every(e => !e.mem.stageUnitDevice || e.mem.stageUnitDevice.chapter16Structure !== 'facility' || !e.alive));
  assert.ok(initial.every(e => !e.alive && e.removeReason === 'leak'));
  assert.equal(visited.size, 2, 'navigation reaches the offset checkpoints while retaining each body-to-cursor offset');
  assert.equal(b.life, 1000);
});

test('native branch jitter persists through movement and the endpoint', () => {
  const { b, run, source } = chapter16StageFixture({ isolated: true });
  b.setViewport('fullscreen-workspace'); run(15.1);
  const [id] = b.stageDeviceActions.keys(), child = b.enemies.find(e => e.mem.ch16TunnelHost);
  const offset = { ...child.route.cursorOffset };
  assert.ok(Math.hypot(offset.x, offset.y) > .01);
  b.activateStageDevice(id); run(240);
  assert.equal(child.removeReason, 'leak');
  const goal = source.rawLevel.extraRoutes[0].endPosition;
  assert.ok(Math.hypot(child.x - goal.col - offset.x, child.y - goal.row - offset.y) <= .05 + 1e-9);
  assert.ok(Math.hypot(child.x - goal.col, child.y - goal.row) >= Math.hypot(offset.x, offset.y) - .05 - 1e-9);
});

test('visitEveryCheckPoint controls early exit, independently of remaining checkpoint order', () => {
  for (const required of [true, false]) {
    const { b, run, source } = chapter16StageFixture({ isolated: true });
    const changed = structuredClone(source); changed.rawLevel.extraRoutes[0].visitEveryCheckPoint = required;
    const child = chapter16BranchSpawner(b, changed)('mcreep_route', 0, { id: 999 });
    child.x = child.route.goal.x + child.route.cursorOffset.x + .02;
    child.y = child.route.goal.y + child.route.cursorOffset.y;
    run(b.dt);
    assert.equal(child.alive, required);
    if (!required) assert.equal(child.removeReason, 'leak');
  }
});

test('normal 16-3 schedules 22 hostiles, excludes the optional raid group and can clear with surviving static devices', () => {
  const { b, run } = chapter16StageFixture();
  assert.equal(b.total, 22);
  run(280);
  assert.equal(b.finished, true);
  assert.equal(b.result().reason, 'cleared');
  assert.ok(b.enemies.some(e => e.alive && e.mem.ch16Structure));
});

test('branch source rejects changed actions, route spaces and traversal contracts', () => {
  const { b, source } = chapter16StageFixture({ isolated: true });
  for (const change of [
    c => { c.testOnly = false; },
    c => { c.rawLevel.branches.mcreep_route.phases[0].actions[0].routeIndex = 99; },
    c => { c.rawLevel.branches.mcreep_route.phases[0].actions[0].key = 'enemy_1108_uterer'; },
    c => { c.rawLevel.extraRoutes[0].visitEveryTileCenter = true; },
    c => { c.rawLevel.extraRoutes[0].checkpoints = true; },
    c => { c.rawLevel.extraRoutes[0].checkpoints[0].randomizeReachOffset = true; },
  ]) {
    const changed = structuredClone(source); change(changed);
    assert.throws(() => chapter16BranchSpawner(b, changed), /require|Unreviewed/);
  }
});
