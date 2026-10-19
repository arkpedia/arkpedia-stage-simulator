// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, enemy, advance, near} from './helpers/hadiya-fixture.js';
import {HadiyaTalent, HADIYA_TALENT_CONTRACT as contract, verifyHadiyaTalent} from '../server/sim/content/arkpedia-hadiya-talent.js';
import {hadiyaTalentInputs} from '../server/sim/content/arkpedia-hadiya-source.js';

function fixture(options = {}) {
  const authorized = new WeakSet();
  const f = make({...options, prepare: (b, u) => {
    const c = new HadiyaTalent(b, u, {contract, ownsTrigger: r => authorized.has(r)});
    c.install(); return c;
  }});
  f.talent = f.prepared;
  f.trigger = (event = 'ON_SKILL_RETRIGGERED') => {
    const r = {}; authorized.add(r); return f.talent.trigger(r, event);
  };
  f.authorize = r => authorized.add(r);
  return f;
}

for (const elite of [0, 1, 2]) for (const potential of [1, 5])
  test(`Talent E${elite} potential ${potential} selects its real coefficient/cap`, () => {
    const f = fixture({elite, potential}), {u, talent: c} = f;
    if (elite === 0) { assert.equal(c.parent, null); assert.equal(c.stack, null); assert.equal(f.trigger(), false); return; }
    const atk = elite === 1 ? potential === 5 ? .03 : .02 : potential === 5 ? .05 : .04;
    assert.equal(c.stack.stacks, 1); near(u.s.atk, u.base.atk * (1 + atk));
    for (let i = 0; i < 8; i++) assert.equal(f.trigger(), true);
    const cap = elite === 1 ? 3 : 5;
    assert.equal(c.stack.stacks, cap); near(u.s.atk, u.base.atk * (1 + cap * atk));
    assert.equal(c.born(), false); assert.equal(c.stack.stacks, cap);
  });

test('Born does not depend on a guessed positive deployment-DP event', () => {
  const f = fixture({defer: true}), {b, u, talent: c} = f;
  const t = enemy(f);
  u.player.dp = 0;
  assert.equal(b._deploy(u, {initial: false, costAttribute: 0}), true);
  assert.equal(c.stack.stacks, 1); assert.equal(f.statuses.length, 1);
  assert.equal(t.s.flags.stun, true); assert.equal(u.player.dp, 0);
  const previous = c.stack;
  b.emit('deploy', {unit: u, move: false});
  assert.equal(c.stack, previous); assert.equal(c.stack.stacks, 1); assert.equal(f.statuses.length, 1);
});

for (const [dir, row, col] of [['RIGHT', 5, 8], ['LEFT', 5, 2], ['UP', 8, 5], ['DOWN', 2, 5]])
  test(`S2 trigger uses mode-two displayed range before mode switch (${dir})`, () => {
    const f = fixture({skill: 2, dir}), t = enemy(f, {row, col});
    assert.equal(f.statuses.length, 0);
    assert.equal(f.trigger('ON_BUFF_TRIGGER'), true);
    assert.equal(t.s.flags.stun, true); assert.equal(f.statuses.length, 1);
    assert.equal(f.statuses[0].duration, 2);
    assert.equal(f.u.skill.active, false); // no assumed owner-mode transition
  });

test('Born and S1 trigger use the current displayed range without all-blocker or global selection', () => {
  for (const skill of [1, 2]) {
    const f = fixture({skill, defer: true}), nearTarget = enemy(f), farTarget = enemy(f, {col: 8});
    f.deploy();
    assert.equal(nearTarget.s.flags.stun, true); assert.equal(farTarget.s.flags.stun, false);
    if (skill === 1) {
      f.trigger(); assert.equal(farTarget.s.flags.stun, false);
    }
  }
});

test('Ground selectors ignore camouflage but honor shared sleep/stealth/target-free and immunity', () => {
  const f = fixture({skill: 2});
  const t = enemy(f, {flags: {camou: true}}), fly = enemy(f, {motion: 'FLY'});
  const free = enemy(f, {flags: {untargetable: true}}), asleep = enemy(f, {flags: {sleep: true}});
  const hidden = enemy(f); hidden.hidden = true;
  const stealth = enemy(f, {flags: {stealth: true}}), immune = enemy(f);
  immune.def = {...immune.def, immune: new Set(['stun'])};
  f.trigger();
  assert.equal(t.s.flags.stun, true);
  for (const other of [fly, free, asleep, hidden, stealth, immune])
    assert.equal(other.buffs.some(v => v.source === f.u && v.status === 'stun'), false);
  assert.equal(f.statuses.length, 1);
});

test('Stat rejection and cap leave the independent stun action available', () => {
  const f = fixture(), t = enemy(f);
  const h = f.b.on('beforeBuff', ctx => {
    if (ctx.buff.data.hadiyaTalent === f.talent && ctx.buff.mods?.atkPct) ctx.cancel = true;
  });
  assert.equal(f.trigger(), true); assert.equal(f.talent.stack.stacks, 1); assert.equal(t.s.flags.stun, true);
  f.b.off(h);
  for (let i = 0; i < 7; i++) f.trigger();
  assert.equal(f.talent.stack.stacks, 5); assert.equal(f.statuses.length, 8);
});

test('Explicit owner authorization and receipt identity prevent repeated and reentrant output', () => {
  const f = fixture(), t = enemy(f), r = {};
  assert.equal(f.talent.trigger(r, 'ON_SKILL_RETRIGGERED'), false);
  assert.equal(f.talent.trigger(r, 'ON_DP_SPENT'), false);
  f.authorize(r);
  const h = f.b.on('beforeStatus', () => assert.equal(f.talent.trigger(r, 'ON_SKILL_RETRIGGERED'), false));
  assert.equal(f.talent.trigger(r, 'ON_SKILL_RETRIGGERED'), true);
  assert.equal(f.talent.trigger(r, 'ON_BUFF_TRIGGER'), false);
  assert.equal(f.talent.trigger({...r}, 'ON_SKILL_RETRIGGERED'), false);
  f.b.off(h);
  assert.equal(f.talent.stack.stacks, 2); assert.equal(t.s.flags.stun, true); assert.equal(f.statuses.length, 1);
});

test('Only accepted real-account receipts can drive the explicit skill-owner talent path', () => {
  let castReceipt;
  const f = make({skill: 2, spec: {onStart: ({unit}) => { castReceipt = unit.mem.hadiyaPayments.current; }},
    prepare: (b, u) => {
      const c = new HadiyaTalent(b, u, {contract, ownsTrigger: (r, event) =>
        u.mem.hadiyaPayments?.owns(r) === true
        && (event === 'ON_BUFF_TRIGGER' ? r.kind === 'cast' : r.kind === 'adaptation-active')});
      c.install(); return c;
    }});
  const c = f.prepared, t = enemy(f);
  f.ready(); f.u.player.dp = 9;
  assert.equal(f.u.skill.activate(), false); assert.equal(c.stack.stacks, 1);
  assert.equal(castReceipt, undefined);
  f.u.player.dp = 25; assert.equal(f.u.skill.activate(), true);
  assert.equal(c.stack.stacks, 1); // spending DP is not itself a talent event
  assert.equal(c.trigger(castReceipt, 'ON_SKILL_RETRIGGERED'), false);
  assert.equal(c.trigger(castReceipt, 'ON_BUFF_TRIGGER'), true);
  assert.equal(c.stack.stacks, 2); assert.equal(t.s.flags.stun, true);
  assert.equal(f.payment.adapt(r => c.trigger(r, 'ON_SKILL_RETRIGGERED')), true);
  assert.equal(f.u.player.dp, 0); assert.equal(c.stack.stacks, 3);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.statuses.length, 2);
  assert.equal(f.payment.adapt(r => c.trigger(r, 'ON_SKILL_RETRIGGERED')), false);
});

test('Parent removal cleans derived ATK while nonderived recipient stun survives', () => {
  const f = fixture(), t = enemy(f);
  f.trigger();
  const stack = f.talent.stack, parent = f.talent.parent;
  assert.equal(f.b.removeBuff(f.u, parent), 1);
  assert.equal(f.u.buffs.includes(stack), false); near(f.u.s.atk, f.u.base.atk);
  assert.equal(t.s.flags.stun, true); assert.equal(f.trigger(), false); assert.equal(f.talent.born(), false);
  advance(f.b, 2.1); assert.equal(t.s.flags.stun, false);
});

test('A rejected source parent never grants ATK or stuns and cannot retry Born', () => {
  const f = fixture({defer: true}); enemy(f);
  f.b.on('beforeBuff', c => { if (c.buff.data.nativeKey === 'hadiya_t_1') c.cancel = true; });
  f.deploy(); assert.equal(f.talent.parent, null); assert.equal(f.talent.stack, null);
  assert.equal(f.statuses.length, 0); assert.equal(f.talent.born(), false);
});

test('Replacing the source parent retires derived stacks without erasing the new parent', () => {
  const f = fixture(), parent = f.talent.parent, stack = f.talent.stack;
  const foreign = f.b.addBuff(f.u, {key: parent.key, mods: {defPct: .3}});
  advance(f.b, f.b.dt);
  assert.equal(f.talent.parent, null); assert.equal(f.u.buffs.includes(stack), false);
  assert.equal(f.u.findBuff(parent.key), foreign); near(f.u.s.atk, f.u.base.atk);
  assert.equal(f.trigger(), false); assert.equal(f.talent.born(), false);
});

test('Replacement buff identities are neither stacked nor removed by the old controller', () => {
  const f = fixture(), old = f.talent.stack;
  const replacement = f.b.addBuff(f.u, {key: old.key, mods: {atkPct: .7}});
  f.trigger();
  assert.equal(f.u.findBuff(old.key), replacement); assert.equal(replacement.stacks, 1);
  f.talent.stop(); assert.equal(f.u.findBuff(old.key), replacement);
});

test('BeforeBuff replacement cannot borrow the source parent or stack grant', () => {
  const f = fixture(); let replacement;
  f.b.on('beforeBuff', c => {
    if (c.unit === f.u && c.buff.data.nativeKey === 'hadiya_t_1[atk]') {
      replacement = f.b.addBuff(f.u, {key: c.buff.key, mods: {atkPct: .9}});
    }
  });
  f.trigger(); assert.equal(f.u.findBuff(f.talent.stack.key), replacement);
  assert.equal(replacement.stacks, 1); f.talent.stop(); assert.equal(f.u.buffs.includes(replacement), true);
});

test('Withdrawal/source loss inside status callbacks cancels remaining source outputs', () => {
  const f = fixture(); enemy(f); enemy(f);
  f.b.on('beforeStatus', () => f.talent.stop());
  f.trigger(); assert.equal(f.statuses.length, 0); assert.equal(f.talent.stack, null);
});

test('Recipient life replacement inside status callbacks refuses the old target', () => {
  const f = fixture(), t = enemy(f);
  f.b.on('beforeStatus', () => t.deploySeq++);
  f.trigger(); assert.equal(f.statuses.length, 0); assert.equal(t.s.flags.stun, false);
});

test('Talent stun has its own source identity and shared resistance duration', () => {
  const f = fixture(), t = enemy(f);
  f.b.applyStatus(t, 'resist', {duration: 5, value: .5});
  f.b.applyStatus(t, 'stun', {duration: 3, key: 'fixture:other-stun'});
  f.trigger();
  assert.equal(f.statuses.at(-1).duration, 1);
  const own = t.buffs.find(v => v.source === f.u && v.status === 'stun');
  assert.ok(own); assert.notEqual(own.key, 'fixture:other-stun');
  f.talent.stop(); assert.equal(t.buffs.includes(own), true);
});

test('Changed source cap/derivation/branch/purpose facts cannot certify talent behavior', () => {
  for (const change of [n => n.producer._buffs[0].isSilenceable = 1,
    n => n.template.eventToActions.ON_OWNER_BORN[0]._isDerivedBuff = false,
    n => n.template.eventToActions.ON_OWNER_BORN[0]._buff.maxStackCnt = 5,
    n => n.template.eventToActions.ON_OWNER_BORN[1]._targetOptions.ignoreTargetFree = true,
    n => n.template.eventToActions.ON_BUFF_TRIGGER[1]._conditionNode._skillIndex = 0]) {
    const n = structuredClone(hadiyaTalentInputs()); change(n); assert.throws(() => verifyHadiyaTalent(n), /Changed original/);
  }
});
