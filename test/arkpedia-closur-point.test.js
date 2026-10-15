// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_TOKEN_ID as TOKEN, selectedClosurToken } from '../server/sim/content/arkpedia-closur-source.js';
import { prepareClosurPoint } from '../server/sim/content/arkpedia-closur-point.js';
import { make, ally, attacker, addOwner, near, advance, until } from './helpers/closur-point-fixture.js';
const activate = f => until(f, () => f.controller.active(), 1);
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`command center E${elite}/P${potential} uses token stats without owner trust/potential additions`, () => {
  const f = make({ skill: 1, elite, potential, trust: 200 }), t = f.controller.place(5, 6);
  near(t.s.maxHp, [1938, 2489, 3275][elite]); near(t.s.def, [265, 343, 432][elite]); near(t.s.atk, 0);
  near(f.record.stats.cost, 0); near(t.s.blockCnt, 0); activate(f); near(t.s.blockCnt, 2);
});
test('token interpolation follows the selected owner level and preserves single-rank passive ranges', () => {
  const build = { elite: 0, level: 25, potential: 6, trust: 200, skillId: 'skchr_closur_1', skillRank: 4, module: 'none' };
  const t = selectedClosurToken(build); near(t.stats.maxHp, 1710); near(t.stats.def, 231); near(t.stats.atk, 0);
  assert.equal(t.source.spData.spCost, 0); assert.equal(t.skillId, 'sktok_closur_ourbase1');
  for (const [index, skill] of ['skchr_closur_1', 'skchr_closur_2', 'skchr_closur_3'].entries()) {
    const r = selectedClosurToken({ ...build, elite: 2, level: 90, skillId: skill, skillRank: 10 });
    assert.equal(r.source.rangeId, ['x-5', 'x-4', 'x-6'][index]);
    assert.deepEqual(r.rangeGrid, e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]));
  }
});
test('command center source admission rejects absent contracts, mutated source values and repeated preparation', () => {
  assert.throws(() => make({ contract: {} }));
  for (const mutate of [d => d.stats.atk++, d => d.skill.spCost++, d => d.skill.bb.cost++,
    d => d.tags.push('invented'), d => d.rangeGrid.push([9, 9]), d => d.talents[0].bb.cnt++])
    assert.throws(() => make({ mutate }));
  const f = make(); assert.throws(() => prepareClosurPoint(f.b, f.u));
});
test('placement requires fullscreen, the living current owner, a free legal tile and the host range', () => {
  const f = make({ defer: true }); assert.match(f.controller.placementError(5, 6), /Closure owner/);
  f.b._deploy(f.u); f.b.setViewport('preview'); assert.match(f.controller.placementError(5, 6), /fullscreen/);
  f.b.setViewport('fullscreen-workspace');
  assert.match(f.controller.placementError(5, 5), /occupied/);
  assert.match(f.controller.placementError(0, 0), /range/);
  assert.match(f.controller.placementError(5.5, 6), /map/);
  f.b.grid.tile(5, 6).build = 'NONE'; assert.match(f.controller.placementError(5, 6), /deployable/);
  f.b.grid.tile(5, 6).build = 'RANGED'; assert.equal(f.controller.placementError(5, 6), null);
  const t = f.controller.place(5, 6); assert.equal(t.def.position, 'ALL'); assert.equal(t.dir, 'RIGHT');
  assert.match(f.controller.placementError(5, 7), /already deployed/);
});
test('the zero-cost command center occupies no slot even inside its deploy callbacks', () => {
  const f = make(), slots = f.b.deployedSlots(), dp = f.u.player.dp; let observed;
  f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) observed = f.b.deployedSlots(); });
  const t = f.controller.place(5, 6); near(f.b.deployedSlots(), slots); near(observed, slots); near(f.u.player.dp, dp);
  assert.equal(t.ownerUnit, f.u); assert.equal(t.mem.regularSummonCard, 'summon:char_4228_closur');
});
for (const [dir, row, col] of [['RIGHT', 5, 9], ['LEFT', 5, 1], ['UP', 9, 5], ['DOWN', 1, 5]])
  test(`${dir} placement follows current host range changes instead of freezing the initial table grid`, () => {
    const f = make({ dir }); assert.match(f.controller.placementError(row, col), /range/);
    f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 1 } });
    assert.equal(f.controller.placementError(row, col), null);
    f.b.removeBuff(f.u, 'fixture:range'); assert.match(f.controller.placementError(row, col), /range/);
  });
test('both source Start and OnStart are respected; no attack is fabricated by ordinary or forced paths', () => {
  const f = make(), t = f.controller.place(5, 6), source = attacker(f);
  assert.equal(t.mem.regularFormVisual.clip, 'Start'); advance(f.b, .3666666667); near(t.s.blockCnt, 0);
  activate(f); near(t.s.blockCnt, 2); assert.equal(t.mem.regularFormVisual.clip, 'Start');
  advance(f.b, .6); assert.equal(t.mem.regularFormVisual.clip, 'Idle');
  const before = t.stats.attacks; assert.equal(f.b.forceAttack(t, [source]), false); advance(f.b, 3); near(t.stats.attacks, before);
});
test('reinforcement marking includes the token and ordinary friendly summons, ignores HealFree, and excludes isolation/devices/TargetFree', () => {
  const f = make(), t = f.controller.place(5, 6);
  const normal = ally(f), noHeal = ally(f, { row: 6, col: 6, flags: { healFree: true, noHeal: true } });
  const isolated = ally(f, { row: 4, col: 6, flags: { isolated: true } });
  const free = ally(f, { row: 4, col: 7, flags: { untargetable: true } });
  const device = ally(f, { row: 6, col: 7, kind: 'device' });
  const summon = ally(f, { row: 6, col: 5, kind: 'token' });
  activate(f); const marked = f.controller.friends();
  for (const u of [f.u, t, normal, noHeal, summon]) assert.ok(marked.includes(u));
  for (const u of [isolated, free, device]) assert.equal(marked.includes(u), false);
  assert.equal(normal.findBuff(f.controller.friendKey).source, f.u);
});
test('leaving the support range removes only this Closure ownership mark', () => {
  const f = make(), t = f.controller.place(5, 6), normal = ally(f); activate(f);
  f.b.addBuff(normal, { key: 'closur:friend:other', source: t }); assert.ok(normal.findBuff(f.controller.friendKey));
  normal.x = 15; normal.y = 15; advance(f.b, f.b.dt);
  assert.equal(normal.findBuff(f.controller.friendKey), null); assert.ok(normal.findBuff('closur:friend:other'));
});
test('the command center cannot receive ordinary healing, but retains its normal regeneration attribute', () => {
  const f = make(), t = f.controller.place(5, 6); activate(f); t.hp = 100;
  near(f.b.heal(f.u, t, 500), 0); near(t.hp, 100);
  f.b.addBuff(t, { key: 'fixture:regen', mods: { hpRegen: 30 }, persist: true }); advance(f.b, 1); near(t.hp, 130);
});
test('a fatal hit preserves the point, releases blocks, removes temporary control and reinforcement marks, then revives', () => {
  const f = make(), t = f.controller.place(5, 6), normal = ally(f), enemy = attacker(f); activate(f);
  enemy.blockedBy = t; t.blocking.push(enemy); f.b.applyStatus(t, 'stun', { duration: 20, source: enemy });
  let deaths = 0; f.b.on('death', ({ unit }) => { if (unit === t) deaths++; });
  f.b.dealDamage(enemy, t, { amount: 1e9, type: 'true' });
  assert.equal(t.alive, true); near(t.hp, 1); near(deaths, 0); near(t.s.blockCnt, 0);
  assert.equal(enemy.blockedBy, null); assert.equal(t.s.flags.stun, false);
  assert.equal(f.controller.point.mode, 'recharge'); assert.equal(normal.findBuff(f.controller.friendKey), null);
  const hp = t.hp; f.b.dealDamage(enemy, t, { amount: 500, type: 'true' }); near(t.hp, hp);
  for (const status of ['stun', 'freeze', 'silence']) assert.equal(f.b.applyStatus(t, status, { source: t, force: true, duration: 1 }), false);
  advance(f.b, 14.8); assert.equal(f.controller.point.mode, 'recharge');
  until(f, () => f.controller.point.mode === 'born', 1); assert.equal(f.controller.point.mode, 'born'); assert.equal(t.mem.regularFormVisual.clip, 'Start');
  activate(f); assert.equal(f.controller.point.mode, 'active'); near(t.hp, t.s.maxHp); near(t.s.blockCnt, 2);
  assert.ok(normal.findBuff(f.controller.friendKey)); near(deaths, 0);
});
test('manual withdrawal uses the same tactical-point cycle and never grants a retreat refund', () => {
  const f = make(), t = f.controller.place(5, 6); activate(f); const dp = f.u.player.dp;
  assert.equal(t.mem.metalCrabRest(), true); near(t.hp, 1); near(f.u.player.dp, dp); assert.equal(t.alive, true);
  assert.equal(t.mem.metalCrabRest(), false); until(f, () => f.controller.point.mode === 'active', 16); assert.equal(f.controller.point.mode, 'active');
});
test('repeated fake defeats use new timer generations and never produce duplicate tokens', () => {
  const f = make(), t = f.controller.place(5, 6), enemy = attacker(f); activate(f);
  for (let i = 0; i < 3; i++) { f.b.dealDamage(enemy, t, { amount: 1e9, type: 'true' }); until(f, () => f.controller.point.mode === 'active', 16); near(t.s.blockCnt, 2); }
  assert.equal(f.b.allyUnits.filter(u => u.defId === TOKEN).length, 1);
});
test('owner retreat removes the point, its marks and every pending revival callback', () => {
  const f = make(), t = f.controller.place(5, 6), normal = ally(f); activate(f); f.controller.rest();
  f.b.retreat(f.u, { permanent: true }); assert.equal(t.alive, false); assert.equal(f.controller.stopped, true);
  advance(f.b, 17); assert.equal(t.alive, false); assert.equal(normal.findBuff(f.controller.friendKey), null);
});
test('different Closure owners retain independent point and mark lifecycles', () => {
  const f = make(), second = addOwner(f.b, f.build, { row: 4, col: 5 }); f.b._deploy(second.u);
  const a = f.controller.place(5, 6), z = second.controller.place(4, 6); activate(f);
  assert.ok(a.findBuff(f.controller.friendKey)); assert.ok(a.findBuff(second.controller.friendKey));
  f.controller.rest(); assert.equal(a.findBuff(f.controller.friendKey), null);
  assert.ok(z.findBuff(second.controller.friendKey)); assert.equal(second.controller.active(), true);
});
