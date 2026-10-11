// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Unit } from '../server/sim/units.js';
import { makeBuff } from '../server/sim/buffs.js';

function unit(res = 20) {
  return new Unit({ id: 1, side: 'ally', kind: 'op', base: { maxHp: 1000, res } });
}
function setBuffs(u, buffs) { u.buffs = buffs.map((buff, i) => makeBuff({ key: `test:${i}`, ...buff })); u.markDirty(); return u.s.res; }

test('source PERCENTAGE RES bonuses add before FINAL_SCALER modifiers', () => {
  const u = unit();
  // Nightingale's additive aura and S3 must not multiply each other. A separate
  // final scaler still applies after both and after a flat RES increase.
  assert.equal(setBuffs(u, [
    { mods: { resFlat: 10 } }, { mods: { resPct: .3 } },
    { mods: { resPct: .5 } }, { mods: { resMul: .5 } },
  ]), 27);
  assert.equal(setBuffs(u, [{ mods: { resFlat: 10 } }, { mods: { resPct: .5 } },
    { mods: { resMul: .5 } }]), 22.5, 'removing the aura recomputes RES');
});

test('percentage RES handles source stacks, bounds, and zero base RES', () => {
  const u = unit(40);
  assert.equal(setBuffs(u, [{ stacks: 2, mods: { resPct: .25 } }]), 60);
  assert.equal(setBuffs(u, [{ mods: { resPct: 10 } }]), 100);
  assert.equal(setBuffs(u, [{ mods: { resPct: -2 } }]), 0);
  assert.equal(setBuffs(unit(0), [{ mods: { resPct: 1 } }]), 0);
});

test('existing flat and multiplicative RES behavior stays unchanged', () => {
  assert.equal(setBuffs(unit(), [{ mods: { resFlat: 10 } },
    { mods: { resMul: 1.5 } }, { mods: { resMul: .5 } }]), 22.5);
  assert.equal(setBuffs(unit(), []), 20);
});
