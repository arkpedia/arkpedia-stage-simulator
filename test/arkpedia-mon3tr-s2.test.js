// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMon3trS2, MON3TR_S2_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-mon3tr-s2.js';
import { make as makeBase, ally, advance, until, near, disarm } from './helpers/mon3tr-fixture.js';
const KEY = 'monstr_s_2[proj]';
const make = (opts = {}) => makeBase({ skill: 2, contract: CONTRACT, prepare: prepareMon3trS2, ...opts });
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.ok(f.u.skill.activate('manual')); };
const tagged = (f, tag) => f.heals.filter(h => h.opts.mon3trTag === tag);

test('standalone S2 requires a fresh exact selected source contract and does not supply a normal deck', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /selected-skill contract/);
  assert.throws(() => make({ skill: 1 }), /selected-skill contract/);
  assert.throws(() => make({ mutate: d => { d.skill.bb.talent_scale++; } }), /selected source/);
  assert.equal(make().controller.deck, undefined);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank} prioritizes full Reconstruction and emits one independent delayed chain with selected talent scaling`, () => {
  const f = make({ rank }), token = ally(f, { token: true, ratio: 1 });
  const others = [7, 8, 9].map((col, i) => ally(f, { col, hp: 1e5, ratio: .01 + i * .01 }));
  cast(f); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  advance(f.b, .2); assert.equal(f.attacks.length, 0);
  until(f, () => tagged(f, 's2-extra').length === 4);
  for (const tag of ['s2', 's2-extra']) {
    const hits = tagged(f, tag);
    assert.deepEqual(hits.map(h => h.target), [token, ...others]);
    hits.forEach((h, i) => near(h.amount, f.record.stats.atk * .75 ** Math.max(0, i - 1)));
  }
  const primary = tagged(f, 's2')[0], extra = tagged(f, 's2-extra')[0];
  assert.ok(extra.time - primary.time >= .6 - f.b.dt);
  assert.equal(f.attacks.length, 1); assert.equal(token.stats.attacks, 0);
  near(f.u.s.aspd, 100 + 20 * f.record.bb.talent_scale); near(token.s.aspd, 100 + 20 * f.record.bb.talent_scale);
  for (const a of others) near(a.s.aspd, 100 + 20 * f.record.bb.talent_scale);
  assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.gainSp(100, 'external'), 0);
  assert.equal(f.u.skill.active, true); near(f.u.s.atk, f.record.stats.atk);
});
test('S2 naturally charges from ordinary healing accounts and does not charge itself or the extra chain', () => {
  const f = make(), token = ally(f, { token: true, hp: 1e6 }); ally(f, { col: 7, hp: 1e6, ratio: .2 });
  const needed = f.u.skill.spCost - f.u.skill.sp;
  until(f, () => f.u.skill.ready, 40);
  assert.equal(f.attacks.length, needed); assert.equal(tagged(f, 's2-extra').length, 0);
  assert.ok(f.u.skill.activate('manual'));
  until(f, () => tagged(f, 's2-extra').length > 0);
  assert.equal(f.u.skill.sp, 0); assert.ok(token.alive);
});
test('manual S2 requires a source heal target and preserves its charge on refusal', () => {
  const f = make(); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.activate('manual'), false); assert.equal(f.u.skill.sp, f.u.skill.spCost);
  const t = ally(f, { token: true, ratio: 1 });
  assert.ok(f.u.skill.activate('manual')); assert.equal(f.u.skill.sp, 0); assert.ok(t.alive);
});
test('without Reconstruction S2 heals injured allies normally and boosts their talent without fabricating an extra chain', () => {
  const f = make(), t = ally(f); cast(f);
  until(f, () => tagged(f, 's2').length === 1); disarm(f); advance(f.b, 1);
  assert.equal(tagged(f, 's2-extra').length, 0); assert.equal(f.heals[0].target, t);
  near(t.s.aspd, 156); near(f.u.s.aspd, 156);
});
test('an out-of-range or isolated Reconstruction cannot displace a legal injured recipient', () => {
  for (const flags of [null, { isolated: true }]) {
    const f = make(); ally(f, { token: true, col: flags ? 6 : 15, ratio: 1, flags });
    const t = ally(f, { row: 4, col: 6 }); cast(f);
    until(f, () => tagged(f, 's2').length === 1); disarm(f);
    assert.equal(tagged(f, 's2')[0].target, t);
  }
});
test('the extra projectile is independent of S2 expiry, does not recurse and uses the current base talent mode after expiry', () => {
  const f = make(), token = ally(f, { token: true, ratio: 1 }), t = ally(f, { col: 7, hp: 1e5 });
  cast(f); until(f, () => !!token.findBuff(KEY));
  f.u.skill.end('controlled-end'); disarm(f);
  // Retire the boosted bucket from the already delivered primary chain so the
  // delayed chain's current-mode output can be inspected independently.
  for (const a of [t, f.u, token]) for (const buff of a.buffs.slice())
    if (buff.tags.includes('mon3tr:coordination-source')) f.b.removeBuff(a, buff);
  until(f, () => tagged(f, 's2-extra').filter(h => h.target !== f.u).length === 2);
  near(t.s.aspd, 120); advance(f.b, 2);
  assert.equal(tagged(f, 's2-extra').filter(h => h.target !== f.u).length, 2); assert.equal(token.findBuff(KEY), null);
  assert.equal(f.u.skill.active, false); assert.equal(f.attacks.length, 1);
});
test('retreat after projectile birth does not erase the fired delayed heal or revive the owner', () => {
  const f = make(), token = ally(f, { token: true }), t = ally(f, { col: 7, hp: 1e5, ratio: .2 });
  cast(f); until(f, () => !!token.findBuff(KEY) && tagged(f, 's2').some(h => h.target === t));
  f.b._remove(f.u, 'fixture:retreat', null, true);
  until(f, () => tagged(f, 's2-extra').length === 2);
  assert.equal(f.u.alive, false); assert.equal(f.skills.stopped, true); assert.ok(t.hp > 20000);
  near(t.s.aspd, 156); // The primary's already accepted boosted bucket survives.
});
test('withdrawing or replacing the Reconstruction life cancels the old delayed chain', () => {
  for (const replace of [false, true]) {
    const f = make(), token = ally(f, { token: true }); ally(f, { col: 7 });
    cast(f); until(f, () => !!token.findBuff(KEY)); disarm(f);
    if (replace) token.deploySeq = ++f.b._deploySeq; else f.b._remove(token, 'fixture:withdraw', null, true);
    advance(f.b, 1); assert.equal(tagged(f, 's2-extra').length, 0);
  }
});
test('the source active buff uses one non-refreshing global slot and removal emits only one tail', () => {
  const f = make(), token = ally(f, { token: true }); disarm(f);
  f.skills.armExtra({ target: token, seq: token.deploySeq, power: 100 });
  const buff = token.findBuff(KEY); assert.ok(buff); advance(f.b, .2); const left = buff.timeLeft;
  f.skills.armExtra({ target: token, seq: token.deploySeq, power: 900 });
  assert.equal(token.findBuff(KEY), buff); near(buff.timeLeft, left);
  f.b.removeBuff(token, buff); until(f, () => tagged(f, 's2-extra').some(h => h.target === token));
  near(tagged(f, 's2-extra')[0].amount, 100); advance(f.b, 1);
  assert.equal(tagged(f, 's2-extra').filter(h => h.target === token).length, 1);
});
test('a reentrant buff rejection cannot reserve the delayed slot or emit a stale extra chain', () => {
  const f = make(), token = ally(f, { token: true }); disarm(f);
  const h = f.b.on('beforeBuff', ctx => { if (ctx.unit === token && ctx.buff.key === KEY) ctx.cancel = true; });
  f.skills.armExtra({ target: token, seq: token.deploySeq, power: 100 });
  assert.equal(token.findBuff(KEY), null); advance(f.b, 1); assert.equal(tagged(f, 's2-extra').length, 0);
  f.b.off(h); f.skills.armExtra({ target: token, seq: token.deploySeq, power: 100 });
  until(f, () => tagged(f, 's2-extra').length === 1);
});
test('S2 retains the native loop release event and selected source duration, then returns to normal healing', () => {
  const f = make(), token = ally(f, { token: true, hp: 1e6 }); cast(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase;
  near(p.releaseAt - p.startedAt, .6666666865348816);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Loop');
  until(f, () => !f.u.skill.active, 31);
  near(f.b.time - f.u.skill.lastStart, f.record.source.duration, f.b.dt * 2);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_End');
  until(f, () => tagged(f, 'ordinary').length > 0);
  assert.ok(token.alive); assert.equal(f.u.skill.sp, 1);
});
test('boosted and later base talent buckets remain independent and resume the still-live base value', () => {
  const f = make(), t = ally(f); disarm(f);
  f.controller.coordination(t, f.record.talentBb[1], f.record.bb.talent_scale); near(t.s.aspd, 156);
  advance(f.b, 5); f.controller.coordination(t, f.record.talentBb[1]); near(t.s.aspd, 156);
  advance(f.b, 5.1); near(t.s.aspd, 120);
  advance(f.b, 5); near(t.s.aspd, 100);
});
