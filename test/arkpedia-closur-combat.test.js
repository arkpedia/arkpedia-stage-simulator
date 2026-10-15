// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make, enemy, ally, cast, near, advance, until } from './helpers/closur-combat-fixture.js';
for (const [dir, row, col, loop] of [['RIGHT', 5, 7, 'Attack_Loop'], ['LEFT', 5, 3, 'Attack_Loop'],
  ['UP', 7, 5, 'Attack_Loop'], ['DOWN', 3, 5, 'Attack_Down_Loop']]) test(`${dir} ordinary fire uses the original first Begin, then repeated literal loops`, () => {
  const f = make({ skill: 1, dir }), t = enemy(f, { row, col });
  until(f, () => f.controller.phase?.kind === 'attack', 2);
  const first = f.controller.phase; assert.match(f.u.mem.regularFormVisual.clip, /Begin$/);
  near(first.releaseAt - first.loopAt, .4000000059604645); near(first.loopAt - (first.until - f.u.s.interval - .2), .2);
  until(f, () => f.shots.length >= 1, 1); assert.equal(f.u.mem.regularFormVisual.clip, loop);
  until(f, () => f.shots.length >= 3, 3); near(f.shots[1].time - f.shots[0].time, 1, f.b.dt + 1e-5);
  near(f.shots[2].time - f.shots[1].time, 1, f.b.dt + 1e-5);
  until(f, () => f.hits.length >= 3, 1); assert.ok(f.hits.every(h => h.target === t && h.dmg.type === 'phys' && !h.dmg.isSkill));
  assert.equal(f.attacks.length, f.shots.length);
});
test('ordinary source fire caps animation speed, restarts Begin after control and never creates an End clip from its existence', () => {
  const f = make({ skill: 1 }); enemy(f); f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 400 } });
  until(f, () => f.controller.phase?.kind === 'attack', 2); near(f.controller.phase.speed, 1);
  f.b.applyStatus(f.u, 'stun', { duration: .01, source: f.u }); advance(f.b, .1);
  until(f, () => f.controller.phase?.kind === 'attack', 1); assert.match(f.u.mem.regularFormVisual.clip, /Begin$/);
  for (const a of f.b.enemies) f.b.kill(a); advance(f.b, 2);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
});
test('ordinary attacks remain single-target, can hit flying enemies and do not invent a generic tactician summon', () => {
  const f = make({ skill: 1 }), a = enemy(f, { fly: true }), z = enemy(f, { col: 8 });
  until(f, () => f.hits.length >= 1, 3); assert.equal(f.hits.length, 1); assert.ok([a, z].includes(f.hits[0].target));
  assert.equal(f.shots.length, 1); assert.equal(f.b.allyUnits.filter(u => u.kind === 'token').length, 0);
});
test('the ordinary trait checks the live owned command center or an owned reinforcement blocker at impact', () => {
  const f = make({ skill: 1 }), point = f.point.place(5, 6);
  until(f, () => f.point.active(), 1);
  const t = enemy(f, { col: 7, blockedBy: point });
  until(f, () => f.hits.length >= 1, 3); near(f.hits[0].dmg.amount, f.u.s.atk * 1.5);
  assert.equal(f.hits[0].target, t);
  f.point.rest(); f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true } });
  const count = f.hits.length; until(f, () => f.hits.length > count, 2); near(f.hits.at(-1).dmg.amount, f.u.s.atk);
});
test('captured inputs may leave range, but a dead or new-life input is never replaced with a new target at release', () => {
  const f = make({ skill: 1 }), a = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack', 2); a.x = 12;
  until(f, () => f.shots.length === 1, 1); assert.equal(f.shots[0].target, a);
  const g = make({ skill: 1 }), dead = enemy(g);
  until(g, () => g.controller.phase?.kind === 'attack', 2); g.b.kill(dead); enemy(g, { col: 8 });
  advance(g.b, .7); assert.equal(g.shots.length, 0);
});
test('launched projectiles sample current ATK and can finish after owner retreat, while unreleased windups stop', () => {
  const f = make({ skill: 1 }), t = enemy(f, { col: 8 });
  until(f, () => f.shots.length === 1, 3); f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkFlat: 100 }, persist: true });
  f.b.retreat(f.u, { permanent: true }); until(f, () => f.hits.length === 1, 1);
  near(f.hits[0].dmg.amount, f.u.base.atk + 100); assert.equal(f.hits[0].target, t);
  const g = make({ skill: 1 }); enemy(g); until(g, () => g.controller.phase?.kind === 'attack', 2);
  g.b.retreat(g.u, { permanent: true }); advance(g.b, 2); assert.equal(g.shots.length, 0);
});
test('S2 uses its native Begin/Loop/Idle and fires two distinct normal physical projectiles, one attack account', () => {
  const f = make({ skill: 2 }), a = enemy(f), z = enemy(f, { col: 8 }); advance(f.b, 1.1); cast(f);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin'); const old = f.attacks.length;
  until(f, () => f.shots.some(s => s.data.nativeKey === 'projectile_chr_closur_s2'), 2);
  const shots = f.shots.filter(s => s.data.nativeKey.endsWith('_s2')); assert.equal(shots.length, 2);
  assert.deepEqual(new Set(shots.map(s => s.target)), new Set([a, z])); assert.equal(f.attacks.length, old + 1);
  until(f, () => f.hits.filter(h => h.dmg.tags.includes('closur:s2')).length === 2, 1);
  for (const hit of f.hits.filter(h => h.dmg.tags.includes('closur:s2'))) { near(hit.dmg.amount, f.u.s.atk); assert.equal(hit.dmg.isSkill, false); }
  f.u.skill.end('diagnostic'); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle'); assert.equal(f.controller.s2(), false);
});
for (const [dir, row, col, prefix] of [['RIGHT', 5, 7, 'Skill_2_'], ['LEFT', 5, 3, 'Skill_2_'],
  ['UP', 7, 5, 'Skill_2_'], ['DOWN', 3, 5, 'Skill_Down_2_']]) test(`${dir} S2 selects literal facing clips without rotating the deployment range`, () => {
  const f = make({ skill: 2, dir }), range = [...f.u.rangeKeySet]; enemy(f, { row, col });
  advance(f.b, 1.1); cast(f); assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Begin');
  until(f, () => f.shots.length > 0, 2); assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Loop');
  assert.deepEqual([...f.u.rangeKeySet], range);
  for (const t of f.b.enemies) f.b.kill(t); advance(f.b, 2);
  assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Idle');
});
test('S2 acquires a marked reinforcement blocker outside owner range, while ordinary fire does not', () => {
  const f = make({ skill: 2 }); f.point.place(5, 6); const blocker = ally(f, { row: 6, col: 6 }); advance(f.b, 1.2);
  const target = enemy(f, { row: 6, col: 11, blockedBy: blocker }); assert.deepEqual(f.controller.targets(false), []);
  cast(f); assert.deepEqual(f.controller.targets(true), [target]); until(f, () => f.hits.length > 0, 3);
  near(f.hits[0].dmg.amount, f.u.s.atk * 1.5);
  f.point.rest(); assert.deepEqual(f.controller.targets(true), []);
});
test('S2 cancels an unfired ordinary windup; vetoes and reentrant forcing cannot manufacture extra receipts', () => {
  const f = make({ skill: 2 }); enemy(f); until(f, () => f.controller.phase?.kind === 'attack', 2); cast(f);
  const guard = f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.cancel = true; });
  advance(f.b, 2); assert.equal(f.shots.length, 0); assert.equal(f.attacks.length, 0); f.b.off(guard);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) assert.equal(f.b.forceAttack(f.u, ctx.targets), false); });
  until(f, () => f.shots.length > 0, 2); assert.equal(f.attacks.length, 1);
});
test('an attack hook cannot duplicate one captured target into two S2 damage receipts', () => {
  const f = make({ skill: 2 }); enemy(f); advance(f.b, 1.1); cast(f);
  const h = f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = [ctx.targets[0], ctx.targets[0]]; });
  advance(f.b, 2); assert.equal(f.shots.length, 0); assert.equal(f.attacks.length, 0);
  f.b.off(h); until(f, () => f.shots.length > 0, 2); assert.equal(f.shots.length, 1); assert.equal(f.attacks.length, 1);
});
test('S3 requires the selected combat contract rather than silently choosing a generic kit', () => {
  assert.throws(() => make({ skill: 3, contract: {} }), /selected combat contract/);
  const f = make({ skill: 3 }); assert.equal(f.record.index, 2); assert.ok(f.command.acceptedAttack);
});
