// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { performAttack } from '../server/sim/ai.js';
function fixture(epoch) {
  const timers = [], outputs = [];
  const unit = { id: 1, alive: true, deployed: true, deploySeq: 1, canAct: true,
    s: { flags: {}, atk: 100, atkScaleMul: 1 }, mem: {}, stats: { attacks: 0 },
    profile: {}, skill: null };
  const target = { id: 2, alive: true, side: 'enemy', x: 1, y: 0 };
  const battle = { time: 0, _hooks: {}, _attackSeq: 0, _ev: () => {},
    after: (_seconds, callback) => { timers.push(callback); return { cancel() {} }; },
    every: () => ({ cancel() {} }), _safe: callback => callback(),
    dealDamage: (_source, _target, damage) => { outputs.push(damage.amount); return damage.amount; } };
  const profile = { attack: 'melee', projectile: 'none', dmgType: 'phys', windup: .4,
    ...(epoch ? { attackEpoch: (_b, u) => u.mem.sourceEpoch ?? 0 } : {}) };
  return { unit, target, battle, profile, timers, outputs };
}
test('source attack epoch invalidates an already winding attack and permits the new counter attack', () => {
  const { unit, target, battle, profile, timers, outputs } = fixture(true);
  performAttack(battle, unit, profile, [target]);
  unit.mem.sourceEpoch = 1;
  performAttack(battle, unit, { ...profile, windup: .1 }, [target]);
  timers.forEach(callback => callback());
  assert.deepEqual(outputs, [100]);
});
test('ordinary attacks without epoch opt-in and opted-in attacks without a guarded hit remain unchanged', () => {
  for (const enabled of [false, true]) {
    const { unit, target, battle, profile, timers, outputs } = fixture(enabled);
    performAttack(battle, unit, profile, [target]);
    if (!enabled) unit.mem.sourceEpoch = 1;
    timers.forEach(callback => callback());
    assert.deepEqual(outputs, [100]);
  }
});
