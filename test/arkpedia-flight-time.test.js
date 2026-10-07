// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectileSystem } from '../server/sim/projectiles.js';

const setup = () => new ProjectileSystem({ _safe: fn => fn() });
test('fixed travel follows a moving target without colliding early, and lands only once', () => {
  const ps = setup(), target = { alive: true, hidden: false, deploySeq: 1, x: 10, y: 4 };
  let hits = 0;
  const p = ps.add({ from: { x: 0, y: 0 }, target, flightTime: 1.5,
    speed: 1000, onHit: ctx => { assert.equal(ctx.target, target); hits++; } });
  ps.update(.5);
  assert.equal(hits, 0); assert.ok(Math.abs(p.x - 10 / 3) < 1e-9);
  target.x = .1; target.y = 0;
  ps.update(.5);
  assert.equal(hits, 0); assert.ok(Math.abs(p.x - .1 * 2 / 3) < 1e-9);
  target.x = 8; target.y = 2;
  ps.update(.5);
  assert.equal(hits, 1); assert.deepEqual([p.x, p.y], [8, 2]);
  ps.update(10); assert.equal(hits, 1); assert.equal(ps.list.length, 0);
});

test('fixed travel validates target lifetime and supports a fixed destination and hitDead', () => {
  for (const change of ['dead', 'hidden', 'redeployed']) {
    const ps = setup(), target = { alive: true, hidden: false, deploySeq: 1, x: 1, y: 1 };
    let hits = 0;
    ps.add({ target, flightTime: .15, onHit: () => hits++ });
    ps.update(.1);
    if (change === 'dead') target.alive = false;
    if (change === 'hidden') target.hidden = true;
    if (change === 'redeployed') target.deploySeq++;
    ps.update(.1); assert.equal(hits, 0); assert.equal(ps.list.length, 0);
  }
  const ps = setup(); let hits = 0;
  const p = ps.add({ from: { x: 2, y: 4 }, to: { x: 2, y: 4 }, flightTime: .15,
    onHit: () => hits++ });
  ps.update(.1); assert.equal(hits, 0);
  ps.update(.05); assert.equal(hits, 1); assert.deepEqual([p.x,p.y], [2,4]);
  const target = { alive: true, deploySeq: 1, x: 7, y: 3 };
  ps.add({ target, flightTime: .15, hitDead: true,
    onHit: ctx => { assert.equal(ctx.target, null); assert.deepEqual([ctx.x,ctx.y], [7,3]); hits++; } });
  ps.update(.05); target.alive = false;
  ps.update(.1); assert.equal(hits, 2);
});

test('legacy speed projectiles still arrive by distance and invalid flight times use that path', () => {
  for (const flightTime of [undefined, 0, -1, Infinity, NaN]) {
    const ps = setup(); let hits = 0;
    ps.add({ to: { x: 2, y: 0 }, speed: 2, flightTime, onHit: () => hits++ });
    ps.update(.5); assert.equal(hits, 0);
    ps.update(.5); assert.equal(hits, 1);
  }
});
