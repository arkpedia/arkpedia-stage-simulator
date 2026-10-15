// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareClosurS1, CLOSUR_S1_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-closur-s1.js';
import { make as pointFixture, addOwner, ally, attacker, advance, until, near } from './helpers/closur-point-fixture.js';
function make(options = {}) {
  const f = pointFixture({ ...options, skill: 1, defer: true });
  const command = prepareClosurS1(f.controller, { contract: CONTRACT });
  f.b._setupUnit(f.u, { talents: [], trait: { noAttack: true, install: null }, skill: command.spec });
  assert.ok(f.b._deploy(f.u)); f.u.player.dp = 0;
  const grants = [], add = f.b.addDp.bind(f.b);
  f.b.addDp = (id, n) => { grants.push({ id, n, time: f.b.time }); return add(id, n); };
  return { ...f, command, grants };
}
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.ok(f.u.skill.activate()); };
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} grants the captured first total at half-interval offsets and blocks SP during the channel`, () => {
  const f = make({ rank }); cast(f);
  near(f.command.state.total, 3); near(f.command.state.interval, 8 / 3);
  advance(f.b, 1.2); near(f.u.player.dp, 0); advance(f.b, .2); near(f.u.player.dp, 1);
  const sp = f.u.skill.spTotal; advance(f.b, 2.4); near(f.u.skill.spTotal, sp); near(f.u.player.dp, 1);
  until(f, () => !f.u.skill.active, 5); near(f.u.player.dp, 3); near(f.command.state.casts, 1);
  assert.equal(f.grants.length, 3); assert.ok(f.grants.every(g => g.n === 1));
  for (const [i, g] of f.grants.entries()) assert.ok(Math.abs(g.time - (i + .5) * 8 / 3) <= f.b.dt + 1e-8);
});
test('S1 automatically casts from natural SP with no enemy or reinforcement target', () => {
  const f = make(); until(f, () => f.u.skill.active, 8);
  near(f.command.state.casts, 1); assert.equal(f.controller.point, null);
  until(f, () => !f.u.skill.active, 9); near(f.u.player.dp, 3);
});
test('S1 ramp counts previous casts, respects the source cap and stops without banking extra DP', () => {
  const f = make();
  for (const expected of [3, 4, 5, 6, 7, 7]) {
    const before = f.u.player.dp; cast(f); near(f.command.state.total, expected);
    until(f, () => !f.u.skill.active, 9); near(f.u.player.dp - before, expected);
  }
  near(f.command.state.casts, 6);
});
test('S1 shields only marked recipients at activation, do not stack and do not follow later entrants', () => {
  const f = make(), t = f.controller.place(5, 6), a = ally(f), outside = ally(f, { row: 10, col: 10 });
  until(f, () => f.controller.active(), 1); cast(f);
  assert.equal(a.findBuff(f.command.shieldKey).shieldHits, 1); assert.equal(t.findBuff(f.command.shieldKey).shieldHits, 1);
  assert.equal(outside.findBuff(f.command.shieldKey), null);
  outside.x = a.x; outside.y = a.y; advance(f.b, f.b.dt); assert.ok(outside.findBuff(f.controller.friendKey));
  assert.equal(outside.findBuff(f.command.shieldKey), null);
  until(f, () => !f.u.skill.active, 9); cast(f);
  assert.equal(a.buffs.filter(b => b.key === f.command.shieldKey).length, 1);
  assert.equal(a.findBuff(f.command.shieldKey).shieldHits, 1); assert.equal(outside.findBuff(f.command.shieldKey).shieldHits, 1);
});
test('S1 one-hit shields absorb one ordinary damage receipt and survive range exit', () => {
  const f = make(), t = f.controller.place(5, 6), a = ally(f), enemy = attacker(f);
  until(f, () => f.controller.active(), 1); cast(f); a.x = 10; a.y = 10; advance(f.b, f.b.dt);
  const hp = a.hp; f.b.dealDamage(enemy, a, { amount: 100, type: 'true' }); near(a.hp, hp);
  assert.equal(a.findBuff(f.command.shieldKey), null);
  f.b.dealDamage(enemy, a, { amount: 100, type: 'arts' }); near(a.hp, hp - 100);
  assert.ok(t.findBuff(f.command.shieldKey));
});
test('different Closure owners retain distinct nonstacking shield charges on the same ally', () => {
  const f = make(), second = addOwner(f.b, f.build, { row: 3, col: 5 });
  const command = prepareClosurS1(second.controller, { contract: CONTRACT });
  f.b._setupUnit(second.u, { talents: [], trait: { noAttack: true, install: null }, skill: command.spec });
  assert.ok(f.b._deploy(second.u)); f.controller.place(5, 6); second.controller.place(3, 6);
  const a = ally(f, { row: 4, col: 6 }), enemy = attacker(f);
  until(f, () => f.controller.active() && second.controller.active(), 1);
  cast(f); second.u.skill.setSpTotal(second.u.skill.spCost); assert.ok(second.u.skill.activate());
  assert.notEqual(f.command.shieldKey, command.shieldKey);
  assert.equal(a.findBuff(f.command.shieldKey).shieldHits, 1); assert.equal(a.findBuff(command.shieldKey).shieldHits, 1);
  const hp = a.hp; f.b.dealDamage(enemy, a, { amount: 100, type: 'true' }); near(a.hp, hp);
  assert.equal(a.findBuff(f.command.shieldKey), null); assert.ok(a.findBuff(command.shieldKey));
  f.b.retreat(second.u, { permanent: true });
  f.b.dealDamage(enemy, a, { amount: 100, type: 'true' }); near(a.hp, hp); assert.equal(a.findBuff(command.shieldKey), null);
});
test('S1 DP continues through temporary control but stops on owner removal without removing attached shields', () => {
  const f = make(), t = f.controller.place(5, 6), a = ally(f), enemy = attacker(f);
  until(f, () => f.controller.active(), 1); cast(f);
  f.b.applyStatus(f.u, 'stun', { source: enemy, duration: 4 }); advance(f.b, 3); near(f.u.player.dp, 1);
  f.b.retreat(f.u, { permanent: true }); const dp = f.u.player.dp; advance(f.b, 9); near(f.u.player.dp, dp);
  assert.equal(t.alive, false); assert.ok(a.findBuff(f.command.shieldKey));
});
test('a fresh deployed Closure starts a new S1 ramp instead of inheriting a retired owner counter', () => {
  const f = make(); cast(f); until(f, () => !f.u.skill.active, 9); cast(f);
  near(f.command.state.total, 4); f.b.retreat(f.u, { permanent: true });
  const fresh = addOwner(f.b, f.build), command = prepareClosurS1(fresh.controller, { contract: CONTRACT });
  f.b._setupUnit(fresh.u, { talents: [], trait: { noAttack: true, install: null }, skill: command.spec });
  assert.ok(f.b._deploy(fresh.u)); fresh.u.skill.setSpTotal(fresh.u.skill.spCost); assert.ok(fresh.u.skill.activate());
  near(command.state.total, 3); near(command.state.casts, 1); assert.notEqual(fresh.u.id, f.u.id);
});
test('S1 rejects a different skill, missing source contract and repeated preparation', () => {
  const f = pointFixture({ skill: 1, defer: true }); assert.throws(() => prepareClosurS1(f.controller));
  prepareClosurS1(f.controller, { contract: CONTRACT }); assert.throws(() => prepareClosurS1(f.controller, { contract: CONTRACT }));
  const other = pointFixture({ skill: 2, defer: true }); assert.throws(() => prepareClosurS1(other.controller, { contract: CONTRACT }));
});
