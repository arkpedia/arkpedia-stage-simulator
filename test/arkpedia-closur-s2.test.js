// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make, ally, cast, advance, until, near } from './helpers/closur-combat-fixture.js';
import { sourceMoveRespawn } from '../server/sim/content/arkpedia-source-move.js';

for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank} grants source activation DP and fifteen timed pulses without recovering active SP`, () => {
  const f = make({ skill: 2, rank }); f.u.player.dp = 0; cast(f);
  const bb = f.record.bb, first = f.grants[0]; near(first.n, bb.cost); near(first.time, 0);
  near(f.u.s.atk, f.u.base.atk * (1 + bb.atk));
  advance(f.b, 1.9); assert.equal(f.grants.length, 1);
  until(f, () => f.command.state.pulses === 1, .2); near(f.u.player.dp, bb.cost + 1);
  const sp = f.u.skill.spTotal; advance(f.b, 20); near(f.u.skill.spTotal, sp);
  until(f, () => !f.u.skill.active, 9);
  near(f.u.player.dp, bb.cost + 15); assert.equal(f.grants.length, 16);
  for (const [i, g] of f.grants.slice(1).entries()) {
    near(g.n, 1); near(g.time, (i + 1) * 2, f.b.dt + 1e-5);
  }
  near(f.u.s.atk, f.u.base.atk);
});

function ready(options = {}) {
  const f = make({ skill: 2, ...options }); f.point.place(5, 6);
  until(f, () => f.point.active() && !f.b.isUnitInBornState(f.u), 2); return f;
}
const refunds = f => f.grants.filter(g => g.n !== f.record.bb.cost && g.n !== 1);
test('S2 buffs current owned reinforcements and removes its own DEF/block bonuses on exit, expiry and point recharge', () => {
  const f = ready(), a = ally(f); advance(f.b, 1.1); cast(f);
  near(a.s.def, 100 * (1 + f.record.bb.def)); near(a.s.blockCnt, 2);
  assert.equal(refunds(f).length, 0);
  a.x = 12; advance(f.b, f.b.dt); near(a.s.def, 100); near(a.s.blockCnt, 1);
  a.x = 7; advance(f.b, f.b.dt); near(a.s.blockCnt, 2);
  f.point.rest(); advance(f.b, f.b.dt); near(a.s.def, 100); near(a.s.blockCnt, 1);
  until(f, () => f.point.active(), 17); advance(f.b, f.b.dt); near(a.s.blockCnt, 2);
  f.u.skill.end('diagnostic'); near(a.s.def, 100); near(a.s.blockCnt, 1);
});
test('S2 rounds up source COST rather than flooring or reading a card payment, and only once per aura entry', () => {
  const f = ready(); cast(f); const n = f.grants.length;
  const a = ally(f, { cost: 13 }); a.mem.paidCost = 30;
  assert.ok(f.b.isUnitInBornState(a)); assert.equal(f.grants.length, n);
  advance(f.b, f.b.dt); assert.equal(f.grants.length, n);
  advance(f.b, f.b.dt); near(f.grants.at(-1).n, 6);
  assert.ok(f.grants.at(-1).time - a.deployedAt >= .029999999329447746);
  advance(f.b, .8); assert.equal(refunds(f).length, 1);
});
test('S2 records BORN at accepted application, so activation during deployment refunds but activation after deployment does not', () => {
  const f = ready(), a = ally(f); cast(f); advance(f.b, .1); near(refunds(f)[0].n, 6);
  const g = ready(), z = ally(g); advance(g.b, 1.1); assert.equal(g.b.isUnitInBornState(z), false);
  cast(g); advance(g.b, .1); assert.equal(refunds(g).length, 0);
  assert.ok(a.findBuff(f.command.auraKey)); assert.ok(z.findBuff(g.command.auraKey));
});
test('S2 does not refund tokens, devices, isolated/untargetable allies or deployment outside the owned point', () => {
  for (const options of [{ kind: 'token' }, { kind: 'device' }, { flags: { isolated: true } },
    { flags: { untargetable: true } }, { row: 10, col: 10 }]) {
    const f = ready(); cast(f); ally(f, options); advance(f.b, .1); assert.equal(refunds(f).length, 0);
  }
});
test('S2 accepts HealFree operators and cancels rejected buff applications without issuing refunds', () => {
  const f = ready(); cast(f); const a = ally(f, { flags: { healFree: true } }); advance(f.b, .1);
  near(refunds(f)[0].n, 6); assert.ok(a.findBuff(f.command.auraKey));
  const g = ready(); cast(g); g.b.on('beforeBuff', ctx => { if (ctx.buff.key === g.command.auraKey) ctx.cancel = true; });
  const z = ally(g); advance(g.b, .1); assert.equal(z.findBuff(g.command.auraKey), null); assert.equal(refunds(g).length, 0);
});
test('S2 does not leak aura buffs or timers when an application hook retires the owner or moves the recipient', () => {
  for (const retireOwner of [true, false]) {
    const f = ready(); cast(f); let intercepted = false;
    f.b.on('beforeBuff', ctx => {
      if (intercepted || ctx.buff.key !== f.command.auraKey || ctx.unit === f.u) return;
      intercepted = true;
      if (retireOwner) f.b.retreat(f.u, { permanent: true });
      else f.b.moveRedeploy(ctx.unit, 10, 10);
    });
    const a = ally(f); advance(f.b, .1); assert.equal(intercepted, true);
    assert.equal(a.findBuff(f.command.auraKey), null); assert.equal(refunds(f).length, 0);
    assert.equal(f.command.state.recipients.has(a), false);
  }
});
test('S2 excludes self/external move-like redeploys while allowing a real new deployment', () => {
  const f = ready(); cast(f); const a = ally(f, { moveLikeRespawn: true }); advance(f.b, .1);
  assert.ok(a.findBuff(f.command.auraKey)); assert.equal(refunds(f).length, 0);
  assert.ok(f.b.moveRedeploy(a, 6, 6)); advance(f.b, .1); assert.equal(refunds(f).length, 0);
  f.b.retreat(a, { permanent: true }); assert.ok(f.b._deploy(a, { tile: [5, 7] }));
  assert.equal(a.moveLikeRespawn, false); advance(f.b, .1); near(refunds(f)[0].n, 6);
});
test('source RespawnCharacter is excluded, while a free external card delivery still refunds its nonzero COST attribute', () => {
  const f = ready(); cast(f); const a = ally(f, { row: 10, col: 10 });
  a.mem.regularBornUntil = f.b.time + 10;
  assert.ok(sourceMoveRespawn(f.b, a, 5, 7, { carryBuffKeys: [], rebuildBuffs: [], clearSp: true }));
  assert.equal(a.moveLikeRespawn, true); assert.equal(a.mem.regularBornUntil, undefined);
  assert.ok(a.findBuff(f.command.auraKey)); const n = f.grants.length; advance(f.b, .1);
  assert.equal(f.grants.length, n);
  const g = ready(); cast(g); const before = g.grants.length;
  const delivered = g.b.redeployOperatorFromSkill('char_289_gyuki', 5, 7, 'RIGHT');
  assert.equal(delivered.moveLikeRespawn, false); assert.ok(delivered.findBuff(g.command.auraKey));
  assert.equal(g.b.bench.char_289_gyuki.lastCost, 0);
  advance(g.b, .1); assert.equal(g.grants.length, before + 1);
  near(g.grants.at(-1).n, Math.ceil(delivered.mem.regularCostAttribute * g.record.bb.cost_return));
});
test('real card refunds retain the deployment COST including redeployment scaling, independently of the next card or free payment', () => {
  for (const free of [false, true]) {
    const f = ready(); cast(f); const id = 'char_289_gyuki';
    f.b.bench[id].deployments = 1; const cost = f.b.cost(id); f.u.player.dp = 99;
    const n = f.grants.length, a = free ? f.b.redeployOperatorFromSkill(id, 5, 7, 'RIGHT') : f.b.deployOperator(id, 5, 7, 'RIGHT');
    near(a.mem.regularCostAttribute, cost); assert.notEqual(f.b.cost(id), cost);
    near(f.b.bench[id].lastCost, free ? 0 : cost);
    advance(f.b, .1); assert.equal(f.grants.length, n + 1); near(f.grants.at(-1).n, Math.ceil(cost * .4));
  }
});
test('S2 cancels pending entry refunds when the target leaves, dies, changes deployment or the owner leaves', () => {
  for (const action of [
    (f, a) => { a.x = 12; f.command.sync(); },
    (f, a) => f.b.kill(a),
    (f, a) => f.b.moveRedeploy(a, 6, 6),
    f => f.b.retreat(f.u, { permanent: true }),
    f => f.u.skill.end('diagnostic'),
  ]) {
    const f = ready(); cast(f); const a = ally(f); action(f, a); advance(f.b, .1);
    assert.equal(refunds(f).length, 0);
  }
});
test('S2 re-entry is a fresh source aura application, not an invented once-per-deployment ledger', () => {
  const f = ready(); cast(f); const a = ally(f); advance(f.b, .1); near(refunds(f)[0].n, 6);
  a.x = 12; f.command.sync(); a.x = 7; f.command.sync(); advance(f.b, .1);
  assert.equal(refunds(f).length, 2);
  advance(f.b, 1); a.x = 12; f.command.sync(); a.x = 7; f.command.sync(); advance(f.b, .1);
  assert.equal(refunds(f).length, 2);
});
test('S2 active DP and reinforcement buffs survive temporary control, but stop on owner removal', () => {
  const f = ready(), a = ally(f); advance(f.b, 1.1); cast(f);
  f.b.applyStatus(f.u, 'stun', { duration: 5, source: f.u }); advance(f.b, 4.1);
  near(f.command.state.pulses, 2); near(a.s.blockCnt, 2);
  f.b.retreat(f.u, { permanent: true }); const n = f.grants.length; advance(f.b, 5);
  assert.equal(f.grants.length, n); near(a.s.blockCnt, 1); assert.equal(f.command.state.recipients.size, 0);
});
test('BORN observation follows original deployment clips, explicit selected deadlines and resets on a new deployment', () => {
  const f = make({ skill: 2 }), a = ally(f, { row: 7 });
  assert.equal(f.b.isUnitInBornState(a), true); advance(f.b, 1); assert.equal(f.b.isUnitInBornState(a), false);
  a.mem.regularBornUntil = f.b.time + 2; assert.equal(f.b.isUnitInBornState(a), true);
  assert.ok(f.b.moveRedeploy(a, 8, 7)); assert.equal(a.mem.regularBornUntil, undefined);
  assert.equal(a.moveLikeRespawn, true); assert.equal(f.b.isUnitInBornState(a), true);
  advance(f.b, 1); assert.equal(f.b.isUnitInBornState(a), false);
  f.b.retreat(a, { permanent: true }); assert.equal(f.b.isUnitInBornState(a), false);
  const unknown = ally(f, { row: 7, sourceId: 'diagnostic:no-deploy-art' });
  assert.equal(f.b.isUnitInBornState(unknown), false);
});
