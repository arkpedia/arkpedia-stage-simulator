// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { SkillRuntime } from '../server/sim/skills.js';

function fixture(condition) {
  const ally = { hp: 100, s: { maxHp: 100 }, elem: { burn: 5 } };
  const u = { alive: true, deployed: true, hidden: false, canAct: true,
    s: { flags: {} }, profile: { dmgType: 'heal', heal: { mode: 'single' } },
    baseRangeKeys: [1], rangeKeys: [1], blocking: [] };
  const b = { time: 0, rangeChanged: () => false, injuredAlliesInKeys: () => ally.hp < 100 ? [ally] : [],
    _hooks: {}, _ev: () => {}, _safe: f => f(), removeBuff: () => {}, _refreshRange: () => {} };
  const sk = new SkillRuntime(b, u, { id: 'source:auto', spCost: 3, maxCharges: 1,
    skillType: 'AUTO', spType: 'time' }, { kind: 'instant', heal: true,
    ...(condition ? { defaultCondition: (...args) => condition(ally, ...args) } : {}), attack: { healScale: 2 } });
  u.skill = sk; sk.setSpTotal(3);
  return { ally, u, b, sk };
}

test('explicit source DEFAULT predicate can spend a stored charged heal for full-HP elemental injury', () => {
  const { ally, b, u, sk } = fixture((a, battle, unit) => {
    assert.equal(battle, b); assert.equal(unit, u); return a.elem.burn > 0;
  });
  assert.equal(ally.hp, ally.s.maxHp); assert.equal(sk.onAboutToAttack(), true);
  assert.equal(sk.pending, true); assert.equal(sk.charges, 0);
  sk.onAttackPerformed([ally], true); assert.equal(sk.active, false);
});

test('undefined and invalid DEFAULT predicates retain HP-only behavior, and explicit false preserves charges', () => {
  for (const predicate of [undefined, () => undefined, () => null]) {
    const { ally, sk } = fixture(predicate);
    assert.equal(sk.onAboutToAttack(), false); assert.equal(sk.charges, 1);
    ally.hp = 99; assert.equal(sk.onAboutToAttack(), true);
  }
  const { ally, sk } = fixture(() => false); ally.hp = 1;
  assert.equal(sk.onAboutToAttack(), false); assert.equal(sk.charges, 1);
});
