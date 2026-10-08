// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';

function setup() {
  const wall = chessRec({ id: 'removal_wall', skill: null, stats: { atk: 0 } });
  const h = makeBattle({ content: 'none', hooks: [], autoFinish: false,
    defs: { chess: { removal_wall: wall } },
    kits: { removal_wall: () => ({ trait: { noAttack: true } }) },
    units: [{ chessId: 'removal_wall', row: 9, col: 5 }] });
  h.step(); return { b: h.b, u: h.unit('removal_wall') };
}

test('waking a mode can immediately remove its earlier regeneration buff without crashing', () => {
  const { b, u } = setup(), removed = [];
  b.addBuff(u, { key: 'regen', mods: { hpRegen: 50 }, onRemove: () => removed.push('regen') });
  b.addBuff(u, { key: 'sleep-mode', onRemove: () => { removed.push('mode'); b.removeBuff(u, 'regen'); } });
  assert.equal(b.removeBuff(u, 'sleep-mode'), 1);
  assert.deepEqual(removed, ['mode', 'regen']);
  assert.equal(u.findBuff('regen'), null); assert.equal(u.findBuff('sleep-mode'), null);
  assert.deepEqual(b.errors, []);
});

test('nested removal of a matching sibling runs each cleanup once in original reverse order', () => {
  const { b, u } = setup(), removed = [];
  const first = b.addBuff(u, { key: 'aura', refresh: 'independent', maxStacks: 5,
    onRemove: () => removed.push('first') });
  const second = b.addBuff(u, { key: 'aura', refresh: 'independent', maxStacks: 5,
    onRemove: () => removed.push('second') });
  b.addBuff(u, { key: 'aura', refresh: 'independent', maxStacks: 5,
    onRemove: () => { removed.push('third'); b.removeBuff(u, second); } });
  assert.equal(b.removeBuff(u, 'aura'), 2, 'outer call counts only its own removals');
  assert.deepEqual(removed, ['third', 'second', 'first']);
  assert.equal(u.buffs.includes(first), false); assert.equal(u.findBuff('aura'), null);
  assert.deepEqual(b.errors, []);
});

test('a replacement installed by cleanup survives the original removal request', () => {
  const { b, u } = setup(); let replacement;
  b.addBuff(u, { key: 'form', onRemove: () => {
    replacement = b.addBuff(u, { key: 'form', mods: { atkPct: .2 } });
  } });
  assert.equal(b.removeBuff(u, 'form'), 1);
  assert.equal(u.findBuff('form'), replacement);
  assert.equal(b.removeBuff(u, replacement), 1); assert.equal(u.findBuff('form'), null);
  assert.deepEqual(b.errors, []);
});

test('identity removal leaves another source aura intact despite unrelated nested cleanup', () => {
  const { b, u } = setup();
  const foreign = b.addBuff(u, { key: 'aura', refresh: 'independent', maxStacks: 5 });
  b.addBuff(u, { key: 'companion' });
  const own = b.addBuff(u, { key: 'aura', refresh: 'independent', maxStacks: 5,
    onRemove: () => b.removeBuff(u, 'companion') });
  assert.equal(b.removeBuff(u, own), 1);
  assert.equal(u.findBuff('aura'), foreign); assert.equal(u.findBuff('companion'), null);
  assert.equal(b.removeBuff(u, own), 0); assert.deepEqual(b.errors, []);
});
