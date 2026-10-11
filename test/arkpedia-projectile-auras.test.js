// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectileSystem } from '../server/sim/projectiles.js';

function make() {
  const b = { _safe: fn => fn() }, system = new ProjectileSystem(b);
  const owner = { alive: true, deployed: true, hidden: false, deploySeq: 1 };
  const enemy = { side: 'enemy' }, ally = { side: 'ally' };
  const shot = (source = enemy, extra = {}) => system.add({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 },
    source, speed: 10, maxAge: 30, ...extra });
  return { system, owner, enemy, ally, shot };
}

test('spatial aura slows only selected hostile shots and restores their native speed on leaving', () => {
  const { system, owner, enemy, ally, shot } = make();
  system.registerSpeedAura({ owner, contains: p => p.source === enemy && p.x < .5, scale: .05 });
  const hostile = shot(), friendly = shot(ally);
  system.update(1); assert.equal(hostile.x, .5); assert.equal(friendly.x, 10);
  system.update(.1); assert.equal(hostile.x, 1.5);
  system.update(.1); assert.equal(hostile.x, 2.5);
});

test('overlapping auras choose strongest slowdown and cancel independently without mutating projectile speed', () => {
  const { system, owner, shot } = make();
  const weak = system.registerSpeedAura({ owner, contains: () => true, scale: .5 });
  const strong = system.registerSpeedAura({ owner, contains: () => true, scale: .05 });
  const p = shot(); system.update(1); assert.equal(p.x, .5); assert.equal(p.speed, 10);
  strong.cancel(); system.update(1); assert.equal(p.x, 5.5);
  weak.cancel(); system.update(.1); assert.equal(p.x, 6.5);
});

test('withdrawal, hidden owners and redeployment detach old auras; fixed-time flight stays unchanged', () => {
  for (const change of [u => { u.alive = false; }, u => { u.deployed = false; },
    u => { u.hidden = true; }, u => { u.deploySeq++; }]) {
    const { system, owner, shot } = make();
    system.registerSpeedAura({ owner, contains: () => true, scale: .05 });
    const p = shot(); system.update(1); change(owner); system.update(.1);
    assert.equal(p.x, 1.5); assert.equal(system.speedAuras.size, 0);
  }
  const { system, owner, shot } = make(); let hits = 0;
  system.registerSpeedAura({ owner, contains: () => true, scale: .05 });
  const p = shot(undefined, { flightTime: 2, onHit: () => hits++ });
  system.update(1); assert.equal(p.x, 5); assert.equal(hits, 0);
  system.update(1); assert.equal(hits, 1);
});

test('removal suppresses impacts, preserves nonmatching shots and can cancel remaining same-tick arrivals', () => {
  const { system, owner, enemy, ally, shot } = make(); const hits = [];
  const p = shot(enemy, { onHit: () => hits.push('enemy') });
  shot(ally, { onHit: () => hits.push('ally') });
  assert.equal(system.remove(p => p.source === enemy), 1); assert.equal(p.removed, true);
  system.update(1); assert.deepEqual(hits, ['ally']);
  shot(enemy, { onHit: () => { hits.push('first'); system.remove(p => p.source === enemy); } });
  shot(enemy, { onHit: () => hits.push('second') });
  system.update(1); assert.deepEqual(hits, ['ally', 'first']);
  system.registerSpeedAura({ owner, contains: () => true, scale: .05 });
  system.clear(); assert.equal(system.speedAuras.size, 0); assert.deepEqual(system.list, []);
  assert.throws(() => system.registerSpeedAura({ owner, contains: () => true, scale: 0 }), /Invalid/);
});
