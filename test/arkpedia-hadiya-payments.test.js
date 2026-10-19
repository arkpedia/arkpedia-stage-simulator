// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make} from './helpers/hadiya-fixture.js';
import {HadiyaPayments, HADIYA_PAYMENT_CONTRACT as contract} from '../server/sim/content/arkpedia-hadiya-payments.js';

test('Hadiya uses the real selected SP account and selected S2 DP cost', () => {
  for (const skill of [1, 2]) {
    let start;
    const f = make({skill, spec: {onStart: ({skill: account}) => { start = {account, receipt: f.payment.current}; }}});
    const {u, payment: p} = f, a = u.skill;
    f.ready(); u.player.dp = 10;
    assert.equal(a.castEligible, true);
    assert.equal(u.player.dp, 10); // eligibility is read-only
    assert.equal(a.activate(), true);
    assert.equal(start.account, a);
    assert.equal(start.receipt.kind, 'cast');
    assert.equal(start.receipt.cost, skill === 1 ? 0 : 10);
    assert.ok(Object.isFrozen(start.receipt));
    assert.equal(p.owns(start.receipt), true);
    assert.equal(p.owns({...start.receipt}), false);
    assert.equal(u.player.dp, skill === 1 ? 10 : 0);
    assert.equal(a.sp, 0); assert.equal(a.charges, 0); assert.equal(a.activations, 1);
    assert.equal(a.activate(), false); // active cast never charges twice
    assert.equal(u.player.dp, skill === 1 ? 10 : 0);
  }
});

test('Unavailable DP or SP and rejected eligibility spend neither resource', () => {
  for (const skill of [1, 2]) for (const rejected of ['dp', 'sp', 'predicate']) {
    const f = make({skill, spec: {canActivate: () => rejected !== 'predicate'}});
    const {u} = f, a = u.skill;
    f.ready(); u.player.dp = rejected === 'dp' ? 9 : 25;
    if (rejected === 'sp') { a.sp = 0; a.charges = 0; }
    const dp = u.player.dp, sp = a.sp, charges = a.charges;
    const result = rejected === 'dp' && skill === 1 ? f.payment.activateAdaptation() : a.activate();
    assert.equal(result, false);
    assert.equal(u.player.dp, dp); assert.equal(a.sp, sp); assert.equal(a.charges, charges);
    assert.equal(a.activations, 0);
  }
});

test('S1 adaptation starts at full SP and consumes its one adaptation for that activation', () => {
  let receipt;
  const f = make({spec: {onStart: () => { receipt = f.payment.current; }}});
  const {u, payment: p} = f;
  f.ready(); u.player.dp = 10;
  assert.equal(p.activateAdaptation(), true);
  assert.equal(receipt.kind, 'adaptation'); assert.equal(p.owns(receipt), true);
  assert.equal(u.player.dp, 0); assert.equal(u.skill.sp, 0); assert.equal(p.used, true);
  u.player.dp = 30;
  assert.equal(p.adapt(() => true), false);
  const oldReceipt = receipt;
  u.skill.end(); f.ready();
  assert.equal(u.skill.activate(), true);
  assert.equal(p.used, false);
  assert.equal(p.owns(oldReceipt), false); // a previous activation cannot grant effects
  assert.equal(p.adapt(() => true), true);
  assert.equal(u.player.dp, 20);
});

test('Active adaptation pays once without spending a second charge or changing SP', () => {
  for (const skill of [1, 2]) {
    const f = make({skill}), {u, payment: p} = f;
    f.ready(); assert.equal(u.skill.activate(), true);
    u.player.dp = 30;
    let receipt;
    assert.equal(p.adapt(r => { receipt = r; assert.equal(p.owns(r), true); return true; }), true);
    assert.equal(u.player.dp, 30 - (skill === 1 ? 10 : 15));
    assert.equal(u.skill.activations, 1); assert.equal(u.skill.sp, 0); assert.equal(u.skill.charges, 0);
    assert.equal(p.owns(receipt), true); assert.equal(p.used, true);
    assert.equal(p.adapt(() => true), false);
    assert.equal(p.activateAdaptation(), false);
  }
  const f = make({skill: 2}); f.ready();
  assert.equal(f.payment.activateAdaptation(), false);
  assert.equal(f.payment.adapt(() => true), false);
  assert.equal(f.u.player.dp, 99);
});

test('Rejected or throwing adaptation refunds only its own reservation and permits retry', () => {
  const f = make({skill: 2}), {u, payment: p} = f;
  f.ready(); u.skill.activate(); u.player.dp = 30;
  assert.equal(p.adapt(() => { u.player.dp += 4; return false; }), false);
  assert.equal(u.player.dp, 34); assert.equal(p.used, false);
  assert.throws(() => p.adapt(() => { throw Error('fixture'); }), /fixture/);
  assert.equal(u.player.dp, 34); assert.equal(p.current, null); assert.equal(p.busy, false);
  assert.equal(p.adapt(() => true), true); assert.equal(u.player.dp, 19);
});

test('Insufficient DP cannot issue or consume an active adaptation ticket', () => {
  const f = make({skill: 2}); f.ready(); f.u.skill.activate(); f.u.player.dp = 14;
  let calls = 0;
  assert.equal(f.payment.adapt(() => { calls++; return true; }), false);
  assert.equal(calls, 0); assert.equal(f.payment.used, false); assert.equal(f.u.player.dp, 14);
  f.u.player.dp = 15;
  assert.equal(f.payment.adapt(() => { calls++; return true; }), true);
  assert.equal(calls, 1); assert.equal(f.u.player.dp, 0);
});

for (const mutation of ['life', 'stun', 'hidden', 'stop'])
  test(`A ${mutation} change during eligibility refuses the original account transaction`, () => {
    const f = make({skill: 2, spec: {canActivate: () => {
      if (mutation === 'life') f.u.deploySeq++;
      if (mutation === 'stun') f.b.addBuff(f.u, {key: 'fixture:interrupt', flags: {stun: true}});
      if (mutation === 'hidden') f.u.hidden = true;
      if (mutation === 'stop') f.payment.stop();
      return true;
    }}});
    f.ready(); f.u.player.dp = 30; const a = f.u.skill;
    assert.equal(a.activate(), false); assert.equal(f.u.player.dp, 30);
    assert.equal(a.sp, a.spCost); assert.equal(a.charges, 1); assert.equal(a.activations, 0);
  });

test('Rejected cast refunds original ledger without overwriting independent changes or replacement player', () => {
  let callback;
  const f = make({skill: 2, spec: {canActivate: () => { callback?.(); return false; }}});
  const {b, u} = f, original = u.player;
  f.ready(); original.dp = 30;
  callback = () => { original.dp -= 3; };
  assert.equal(u.skill.activate(), false); assert.equal(original.dp, 27);
  const replacement = {...original, dp: 87};
  callback = () => { b.players[b.players.indexOf(original)] = replacement; u.player = replacement; };
  assert.equal(u.skill.activate(), false);
  assert.equal(original.dp, 27); assert.equal(replacement.dp, 87);
  assert.equal(u.skill.activations, 0); assert.equal(u.skill.charges, 1);
});

test('Refund respects DP cap while accepted onStart removal commits DP and SP', () => {
  const f = make({skill: 2, spec: {canActivate: () => { f.u.player.dp = 99; return false; }}});
  f.ready(); f.u.player.dp = 20;
  assert.equal(f.u.skill.activate(), false); assert.equal(f.u.player.dp, f.b.flags.dpMax);
  const g = make({skill: 2, spec: {onStart: () => { g.payment.stop(); g.u.hidden = true; }}});
  g.ready(); g.u.player.dp = 20;
  assert.equal(g.u.skill.activate(), true);
  assert.equal(g.u.player.dp, 10); assert.equal(g.u.skill.charges, 0); assert.equal(g.u.skill.activations, 1);
});

test('Reentrant guards, cast predicates and onStart cannot double-spend', () => {
  let p, a, attempts = [];
  const f = make({skill: 2, guard: () => { if (p) attempts.push(p.activateAdaptation()); return true; },
    spec: {canActivate: () => { attempts.push(a.activate()); return true; },
      onStart: () => { attempts.push(a.activate(), p.adapt(() => true)); }}});
  p = f.payment; a = f.u.skill; f.ready(); f.u.player.dp = 30;
  assert.equal(a.activate(), true);
  assert.ok(attempts.length > 2); assert.ok(attempts.every(v => v === false));
  assert.equal(f.u.player.dp, 20); assert.equal(a.activations, 1);
});

for (const change of ['hidden', 'removed', 'life', 'account', 'spec', 'player', 'battle', 'silence', 'stun'])
  test(`Changed ${change} rejects Hadiya payments and preserves DP/SP`, () => {
    const f = make({skill: 2}), {u, b} = f, a = u.skill, player = u.player;
    f.ready(); player.dp = 30;
    if (change === 'hidden') u.hidden = true;
    if (change === 'removed') u.removed = true;
    if (change === 'life') u.deploySeq++;
    if (change === 'account') u.skill = Object.assign(Object.create(Object.getPrototypeOf(a)), a);
    if (change === 'spec') a.spec = {...a.spec};
    if (change === 'player') u.player = {...player};
    if (change === 'battle') b.finished = true;
    if (change === 'silence' || change === 'stun') b.addBuff(u, {key: 'fixture:control', flags: {[change]: true}});
    assert.equal(a.activate(), false);
    assert.equal(player.dp, 30); assert.equal(a.charges, 1); assert.equal(a.activations, 0);
  });

test('Account replacement inside a cast predicate cannot consume SP or DP', () => {
  const f = make({skill: 2, spec: {canActivate: () => { f.u.skill = null; return true; }}});
  f.ready(); const a = f.u.skill; f.u.player.dp = 30;
  assert.equal(a.activate(), false);
  assert.equal(f.u.player.dp, 30); assert.equal(a.charges, 1); assert.equal(a.sp, a.spCost);
});

test('Stopping restores owned methods and preserves later foreign wrappers', () => {
  const f = make(), {u, payment: p} = f, a = u.skill;
  assert.equal(Object.hasOwn(a, 'activate'), true);
  p.stop(); assert.equal(Object.hasOwn(a, 'activate'), false);
  assert.equal(Object.hasOwn(a.spec, 'canActivate'), false);
  assert.equal(p.activate(), false);
  const g = make(), foreign = () => false;
  g.u.skill.activate = foreign; g.u.skill.spec.canActivate = foreign;
  g.payment.stop(); assert.equal(g.u.skill.activate, foreign); assert.equal(g.u.skill.spec.canActivate, foreign);
});

test('Abandoning an uninstalled payment adapter changes no real account methods', () => {
  const f = make({defer: true, payments: false}), a = f.u.skill;
  const p = new HadiyaPayments(f.b, f.u, {contract});
  p.stop(); p.stop();
  assert.equal(Object.hasOwn(a, 'activate'), false);
  assert.equal(Object.hasOwn(a.spec, 'canActivate'), false);
  assert.throws(() => p.install(), /cannot be reinstalled/);
});

test('Free, automated and stale adaptation actions have no resource authority', () => {
  const f = make({skill: 2, defer: true}); f.ready(); f.u.player.dp = 30;
  assert.equal(f.u.skill.activate(), false);
  f.deploy(); f.ready(); f.u.player.dp = 30;
  assert.equal(f.u.skill.activate('manual', {free: true}), false);
  assert.equal(f.u.skill.activate('SP_FULL'), false);
  assert.equal(f.u.player.dp, 30); assert.equal(f.u.skill.charges, 1);
});
