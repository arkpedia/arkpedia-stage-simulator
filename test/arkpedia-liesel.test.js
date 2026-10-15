// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLiesel, LIESEL_CONTRACT } from '../server/sim/content/arkpedia-liesel.js';
import { make, enemy, charge, cast, advance, until, near } from './helpers/liesel-fixture.js';
const stopAttacks = f => f.b.addBuff(f.u, { key: 'test:disarm', flags: { disarm: true } });
const burstHits = f => f.hits.filter(h => h.dmg.tags.includes('liesel:burst'));
const dotHits = f => f.hits.filter(h => h.dmg.tags.includes('liesel:dot'));
test('selected Ripresa requires the exact native contract, complete build and a fresh owner', () => {
  assert.throws(() => make({ contract: { ...LIESEL_CONTRACT } }), /source contract/);
  assert.throws(() => make({ mutate: d => { d.stats.atk++; } }), /selected source/);
  const f = make(); assert.throws(() => prepareLiesel(f.b, f.u, { contract: LIESEL_CONTRACT }), /fresh original/);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: source charge, native enlarged splash and selected rank multiplier`, () => {
  const f = make({ rank }), t = enemy(f), edge = enemy(f, { col: 7 }); t.x = 6.2; edge.x = 7.7;
  f.b._buildEnemyIndex(); charge(f); until(f, () => f.controller.phase?.s1);
  const p = f.controller.phase; near(p.releaseAt - p.startedAt, .5); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
  advance(f.b, .4); assert.equal(f.hits.length, 0); until(f, () => f.hits.length === 2);
  for (const h of f.hits) { near(h.amount, 785 * (1.1 + rank * .1)); assert.equal(h.dmg.isAttack, true); assert.equal(h.dmg.isSkill, false); }
  assert.equal(f.u.skill.active, false); assert.equal(f.attacks.length, 1); assert.ok(f.u.skill.spTotal < f.u.skill.spCost);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: one delayed homing shot per distinct primary; main damage and DOT use separate ATK policies`, () => {
  const f = make({ skill: 2, rank }); enemy(f); advance(f.b, 1.1); cast(f);
  until(f, () => f.b.projectiles.list.length === 1); assert.equal(f.u.skill.active, false);
  assert.equal(f.attacks.length, 1); assert.equal(f.attacks[0].targets.length, 1); assert.equal(f.hits.length, 0);
  const shot = f.b.projectiles.list[0], launched = f.b.time; near(shot.flightTime, 1.2000000476837158);
  f.b.addBuff(f.u, { key: 'test:atk', mods: { atkPct: 1 } });
  until(f, () => burstHits(f).length === 1);
  near(f.b.time - launched, 1.2, f.b.dt * 2); near(burstHits(f)[0].amount, 1570 * f.record.bb.atk_scale);
  assert.equal(burstHits(f)[0].dmg.isSkill, false); assert.equal(burstHits(f)[0].dmg.applyWay, 'ranged');
  stopAttacks(f); until(f, () => dotHits(f).length > 0);
  near(dotHits(f)[0].amount, 785 * f.record.bb['liesel_s_2[dot].atk_scale']); assert.equal(dotHits(f)[0].source, null);
  assert.equal(dotHits(f)[0].dmg.sourceless, true); assert.equal(dotHits(f)[0].dmg.isAttack, false);
});
test('ordinary attacks use the smaller native radius and sample one splash count before damage callbacks', () => {
  const f = make(), a = enemy(f), z = enemy(f); const outside = enemy(f, { col: 8 }); z.x = 6.9;
  until(f, () => f.attacks.length === 1); assert.equal(f.hits.length, 2); near(a.hp, a.s.maxHp - 785); near(z.hp, z.s.maxHp - 785);
  near(outside.hp, outside.s.maxHp);
  const other = enemy(f); other.x = 6.5; until(f, () => f.attacks.length === 2);
  for (const h of f.hits.slice(2)) near(h.amount, 785 * 1.2);
});
test('S2 emits three distinct native projectile families, whose current-position splash overlaps independently', () => {
  const f = make({ skill: 2 }); const a = enemy(f), z = enemy(f), third = enemy(f); z.x = 6.1; third.x = 6.2;
  advance(f.b, 1.1); cast(f); until(f, () => f.b.projectiles.list.length === 3);
  const shots = f.b.projectiles.list; assert.equal(new Set(shots.map(p => p.target)).size, 3);
  assert.deepEqual(shots.map(p => p.data.nativeKey), ['projectile_chr_liesel_s2_1', 'projectile_chr_liesel_s2_2', 'projectile_chr_liesel_s2_3']);
  const start = f.b.time; until(f, () => burstHits(f).length === 9, 3);
  const groups = [0, 1, 2].map(i => burstHits(f).filter(h => h.dmg.tags.includes(`liesel:shot:${i}`)));
  groups.forEach((g, i) => { assert.equal(g.length, 3); near(g[0].time - start, [1.2, 1.6, 2][i], f.b.dt * 2);
    for (const h of g) near(h.amount, 785 * 1.8 * 1.2); });
  assert.ok([a, z, third].every(a => a.findBuff(`liesel:dot:${f.u.id}`))); assert.equal(f.attacks.length, 1);
});
test('dead captured S1 input refunds one charge without fabricating an area attack', () => {
  const f = make({ rank: 1 }); const t = enemy(f); charge(f); until(f, () => f.controller.phase?.s1); f.b.kill(t);
  advance(f.b, .7); near(f.u.skill.spTotal, f.u.skill.spCost, f.b.dt); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
});
test('S1 dead-input refund retains a separately stored charge and never exceeds source capacity', () => {
  const f = make(); const t = enemy(f); f.u.skill.setSpTotal(f.u.skill.spCost * 2); until(f, () => f.controller.phase?.s1); f.b.kill(t);
  advance(f.b, .7); near(f.u.skill.spTotal, f.u.skill.spCost * 2); near(f.u.skill.charges, 2);
});
test('S2 without a valid primary does not spend SP, fabricate a projectile or activate', () => {
  const f = make({ skill: 2 }); advance(f.b, 1.1); charge(f);
  assert.equal(f.u.skill.activate('DEFAULT'), false); assert.equal(f.u.skill.activations, 0); near(f.u.skill.spTotal, f.u.skill.spCost);
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.attacks.length, 0);
});
test('accepted short control cancels an unfired S2; later recovery cannot revive the cast', () => {
  const f = make({ skill: 2 }); enemy(f); advance(f.b, 1.1); cast(f); f.b.applyStatus(f.u, 'stun', { duration: .001 });
  advance(f.b, 1); assert.equal(f.b.projectiles.list.length, 0); assert.equal(burstHits(f).length, 0); assert.equal(f.u.skill.active, false);
});
test('already emitted shots survive skill end and later control but retreat removes pending shots, not an attached DOT', () => {
  const f = make({ skill: 2 }); enemy(f); advance(f.b, 1.1); cast(f); until(f, () => f.b.projectiles.list.length === 1);
  f.b.applyStatus(f.u, 'stun', { duration: 3 }); until(f, () => burstHits(f).length === 1);
  f.b.retreat(f.u); const count = f.hits.length; advance(f.b, 2.1); assert.ok(f.hits.length > count); assert.ok(dotHits(f).length >= 2);
  assert.equal(f.controller.stopped, true); assert.equal(f.b.projectiles.list.length, 0);
});
test('retreat before impact cancels all source-managed shots without applying DOT', () => {
  const f = make({ skill: 2 }); enemy(f); advance(f.b, 1.1); cast(f); until(f, () => f.b.projectiles.list.length === 1);
  f.b.retreat(f.u); advance(f.b, 3); assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.hits.length, 0);
});
test('homing shot follows a moving target and still bursts at its last position after target death', () => {
  const f = make({ skill: 2 }), a = enemy(f), nearLast = enemy(f, { col: 8 }); nearLast.x = 9;
  advance(f.b, 1.1); cast(f); until(f, () => f.b.projectiles.list.length === 1);
  a.x = 9; advance(f.b, .2); f.b.kill(a); until(f, () => burstHits(f).length === 1);
  assert.equal(burstHits(f)[0].target, nearLast);
});
test('DOT extends one owned layer, updates the cached launch ATK and preserves its tick clock', () => {
  const f = make({ skill: 2 }), t = enemy(f); f.controller.attachDot(t, 100); advance(f.b, .6);
  f.controller.attachDot(t, 200); advance(f.b, .5); assert.equal(dotHits(f).length, 1); near(dotHits(f)[0].amount, 70);
  assert.equal(t.buffs.filter(b => b.key === `liesel:dot:${f.u.id}`).length, 1);
  stopAttacks(f); advance(f.b, 6); assert.equal(t.findBuff(`liesel:dot:${f.u.id}`), null);
});
test('area damage ignores camouflage, but hidden/TargetFree inputs are not primary candidates or talent count', () => {
  const f = make(); enemy(f); const camo = enemy(f, { flags: { camou: true } });
  enemy(f, { flags: { untargetable: true } }); const hidden = enemy(f); hidden.hidden = true; until(f, () => f.attacks.length === 1);
  assert.equal(f.hits.length, 2); assert.ok(f.hits.some(h => h.target === camo)); for (const h of f.hits) near(h.amount, 785);
});
test('S1 naturally stores its source charge capacity and blocks SP only during its pending enhanced cast', () => {
  const f = make(); advance(f.b, 16); near(f.u.skill.charges, 2); near(f.u.skill.spTotal, 14);
  enemy(f); until(f, () => f.controller.phase?.s1); const stored = f.u.skill.spTotal; near(stored, 7);
  advance(f.b, .3); near(f.u.skill.spTotal, stored); until(f, () => !f.u.skill.active); advance(f.b, .3);
  assert.ok(f.u.skill.spTotal > stored); assert.equal(f.u.skill.activations, 1);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`ordinary E${elite}/P${potential} splash uses one source talent multiplier for all three recipients`, () => {
  const f = make({ elite, potential }); enemy(f); enemy(f); enemy(f); until(f, () => f.hits.length === 3);
  const scale = elite === 0 ? 1 : [0, 1.1, 1.2][elite] + (potential === 6 ? .05 : 0);
  for (const h of f.hits) near(h.amount, ([514, 659, 785][elite] + (potential === 6 ? 32 : 0)) * scale);
});
for (const skill of [1, 2]) test(`ASPD input retains the distinct S1 and ordinary animation acceleration caps (selected S${skill})`, () => {
  const f = make({ skill }); f.b.addBuff(f.u, { key: 'test:fast', mods: { aspd: 100 } });
  if (skill === 1) charge(f); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase; near(p.releaseAt - p.startedAt, skill === 1 ? .25 : .5);
  near(f.u.mem.regularFormVisual.speed, skill === 1 ? 2 : 1);
});
test('foreign durable S2 exclusion blocks only primary selection until expiry, never splash participation', () => {
  const f = make({ skill: 2 }), marked = enemy(f), other = enemy(f); advance(f.b, 1.1);
  f.b.addBuff(marked, { key: 'liesel:exclude:other', duration: 1.5 }); cast(f); until(f, () => f.b.projectiles.list.length === 1);
  assert.equal(f.b.projectiles.list[0].target, other); until(f, () => burstHits(f).length === 2); assert.ok(burstHits(f).some(h => h.target === marked));
});
test('non-death primary invalidation and short control do not trigger S1 dead-input refunds', () => {
  for (const status of ['untargetable', 'stun']) {
    const f = make({ rank: 1 }), t = enemy(f); charge(f); until(f, () => f.controller.phase?.s1);
    if (status === 'untargetable') f.b.addBuff(t, { key: 'test:gone', flags: { untargetable: true } });
    else f.b.applyStatus(f.u, 'stun', { duration: .001 });
    advance(f.b, .8); assert.equal(f.hits.length, 0); assert.ok(f.u.skill.spTotal < 1);
  }
});
test('a blocked attack hook cannot recursively release an S2 or add exclusion marks/projectiles', () => {
  const f = make({ skill: 2 }), t = enemy(f); advance(f.b, 1.1);
  f.b.on('beforeAttack', ctx => {
    if (ctx.attacker !== f.u) return;
    f.b.forceAttack(f.u, [t]); ctx.cancel = true;
  });
  cast(f); advance(f.b, 1); assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.hits.length, 0);
  assert.equal(t.buffs.some(b => b.key.startsWith('liesel:exclude:')), false);
});
test('shielded S2 impact still attaches its non-missable DOT; cached DOT ignores later source multipliers and talent', () => {
  const f = make({ skill: 2 }), t = enemy(f); enemy(f); enemy(f); advance(f.b, 1.1);
  f.b.addBuff(t, { key: 'test:shield', shield: 1e8 }); cast(f); until(f, () => !!t.findBuff(`liesel:dot:${f.u.id}`));
  near(t.hp, t.s.maxHp); f.b.removeBuff(t, 'test:shield'); stopAttacks(f);
  f.b.addBuff(f.u, { key: 'test:later', mods: { atkPct: 5, dmgDealtMul: 3 } });
  until(f, () => dotHits(f).some(h => h.target === t)); near(dotHits(f).find(h => h.target === t).amount, 785 * .35);
});
test('source-managed S2 validates the owner again for each recipient if an impact callback kills the owner', () => {
  const f = make({ skill: 2 }); enemy(f); enemy(f); enemy(f); advance(f.b, 1.1);
  f.b.on('damaged', x => { if (x.source === f.u && x.dmg.tags.includes('liesel:burst')) f.b.kill(f.u); });
  cast(f); until(f, () => burstHits(f).length > 0); assert.equal(burstHits(f).length, 1);
  advance(f.b, 1); assert.equal(burstHits(f).length, 1); assert.equal(f.controller.stopped, true); assert.equal(f.b.projectiles.list.length, 0);
});
test('S2 can replace the original born phase when an external SP grant makes it ready during deployment', () => {
  const f = make({ skill: 2 }); enemy(f); cast(f); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2');
  until(f, () => f.b.projectiles.list.length === 1); assert.equal(f.u.skill.active, false);
});
