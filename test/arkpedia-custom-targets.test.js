// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireTargets } from '../server/sim/ai.js';

const unit = (side, extra = {}) => ({ side, kind: 'op', alive: true, deployed: true,
  hidden: false, s: { flags: {}, maxTargets: 0, blockCnt: 1 }, ...extra });
function setup() {
  const u = unit('ally', { blocking: [], rangeKeys: [1] }), enemy = unit('enemy'), ally = unit('ally');
  const b = { enemiesInKeys: () => [enemy], injuredAlliesInKeys: () => [ally],
    remainingDistance: () => 1, blockedTargets: () => [] };
  return { u, enemy, ally, b };
}
test('source target callback can choose a heal fallback or an enemy without altering default profiles', () => {
  const { b, u, enemy, ally } = setup();
  const normal = { maxTargets: 1, canHitFly: true };
  assert.deepEqual(acquireTargets(b, u, normal), [enemy]);
  assert.deepEqual(acquireTargets(b, u, { ...normal, acquireTargets: () => [ally] }), [ally]);
  assert.deepEqual(acquireTargets(b, u, { ...normal, acquireTargets: () => null }), [enemy]);
  assert.deepEqual(acquireTargets(b, u, { ...normal, acquireTargets: () => ({ target: ally }) }), [enemy]);
  assert.deepEqual(acquireTargets(b, u, { ...normal, acquireTargets: () => [] }), []);
  assert.deepEqual(acquireTargets(b, u, { ...normal, dmgType: 'heal', heal: { mode: 'single' } }), [ally]);
});
test('source target callback cannot bypass stealth, flying, life, heal-free, isolation or duplicate legality', () => {
  const { b, u, enemy, ally } = setup();
  const hidden = unit('enemy', { hidden: true }), dead = unit('enemy', { alive: false });
  const air = unit('enemy', { isFlying: true });
  const free = unit('ally', { s: { flags: { healFree: true } } });
  const isolated = unit('ally', { s: { flags: { isolated: true } } });
  const stealth = unit('enemy', { s: { flags: { stealth: true } }, buffs: [] });
  const targets = [hidden, dead, air, free, isolated, stealth, enemy, ally, enemy, null];
  assert.deepEqual(acquireTargets(b, u, { acquireTargets: () => targets }), [enemy, ally]);
  assert.deepEqual(acquireTargets(b, u, { canHitFly: true, ignoreStealth: true,
    acquireTargets: () => targets }), [air, stealth, enemy, ally]);
});
