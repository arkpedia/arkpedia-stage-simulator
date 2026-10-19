// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, advance, near} from './helpers/aphrissa-relay-fixture.js';
import {selectedAphrissaRelay} from '../server/sim/content/arkpedia-aphrissa-relay-source.js';
import {APHRISSA_RELAY_ID as TOKEN} from '../server/sim/content/arkpedia-aphrissa-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';

for (const elite of [0, 1, 2]) test(`E${elite} normal relay preserves independent fixed stats and promotion lifetime`, () => {
  const f = make({elite}), r = selectedAphrissaRelay(f.build), dp = f.u.player.dp;
  assert.deepEqual([r.stats.maxHp, r.stats.atk, r.stats.blockCnt, r.stats.cost, r.stats.respawnTime], [500, 0, 0, 3, 30]);
  assert.equal(r.skill, null); assert.equal(r.skillId, null);
  assert.equal(r.duration, [15, 20, 25][elite]);
  const t = f.deck.place(5, 7, 'LEFT');
  near(f.u.player.dp, dp - 3);
  assert.equal(t.deploymentSlotCost, 0);
  assert.equal(t.ownerUnit, f.u);
  assert.equal(t.dir, 'LEFT');
  assert.equal(t.s.flags.invulnerable, true);
  assert.equal(t.s.flags.isolated, true);
  assert.equal(t.s.flags.healFree, true);
  assert.equal(t.s.blockCnt, 0);
  assert.equal(f.deck.stock, 0);
  assert.deepEqual(f.deck.own().map(u => u.id), [t.id]);
  assert.equal(t.mem.regularModelFacing, 'single');
  assert.equal(t.mem.regularFormVisual.clip, 'Start');
  assert.deepEqual(f.b.errors, []);
});

for (const elite of [0, 1, 2]) test(`E${elite} original relay expires after ${[15, 20, 25][elite]} seconds without a refund`, () => {
  const f = make({elite}), t = f.deck.place(5, 7), duration = [15, 20, 25][elite], dp = f.u.player.dp;
  advance(f.b, .9); assert.equal(t.mem.regularFormVisual.clip, 'Start');
  advance(f.b, .1 + f.b.dt); assert.equal(t.mem.regularFormVisual.clip, 'Idle');
  advance(f.b, duration - f.b.time); assert.equal(t.deployed, true);
  let removedAt;
  f.b.on('death', ({unit}) => { if (unit === t) removedAt = f.b.time; });
  f.b.step(); assert.equal(t.deployed, false); near(removedAt, duration);
  assert.equal(f.deck.stock, 1); assert.equal(f.deck.point, null);
  near(f.u.player.dp, dp); near(f.deck.readyAt, duration + 30);
});

for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) test(`Normal relay accepts ${dir} facing without inventing a Back model`, () => {
  const f = make(), t = f.deck.place(5, 7, dir);
  assert.equal(t.dir, dir); assert.equal(t.mem.regularModelFacing, 'single');
  assert.equal(t.mem.regularDeathVisual.die, 'Die');
});

test('High-ground placement is independent of host range and deployment slots', () => {
  const f = make();
  Object.assign(f.b.grid.tile(10, 15), {height: 'HIGH', build: 'RANGED'});
  const t = f.deck.place(10, 15);
  assert.equal(t.deployed, true); assert.equal(t.deploymentSlotCost, 0);
});

test('Withdrawal refunds one DP once and allows a fresh relay after the independent thirty-second cooldown', () => {
  const f = make(), t = f.deck.place(5, 7), dp = f.u.player.dp;
  advance(f.b, 2); assert.equal(f.deck.retreat(t), true);
  near(f.u.player.dp, dp + 1); near(f.deck.readyAt, 32);
  assert.throws(() => f.deck.retreat(t), /current relay/); near(f.u.player.dp, dp + 1);
  advance(f.b, 29.9); assert.match(f.deck.placementError(5, 7), /redeploying/);
  advance(f.b, .1); const next = f.deck.place(5, 7, 'DOWN');
  assert.notEqual(next.id, t.id); assert.equal(next.dir, 'DOWN');
  assert.equal(next.mem.regularFormVisual.clip, 'Start');
});

test('Stale removal callbacks cannot extend the cooldown or duplicate a recovered card', () => {
  const f = make(), t = f.deck.place(5, 7);
  f.b.kill(t, null); const ready = f.deck.readyAt;
  advance(f.b, 1); f.b.emit('death', {unit: t});
  near(f.deck.readyAt, ready); assert.equal(f.deck.stock, 1);
});

for (const reason of ['retreat', 'death', 'replacement', 'battleEnd'])
  test(`Owner ${reason} removes only its linked relay and drains controller hooks`, () => {
    const f = make(), t = f.deck.place(5, 7), dp = f.u.player.dp;
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'replacement') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'battleEnd') f.b.emit('battleEnd', {});
    assert.equal(t.deployed, false); assert.equal(f.deck.stock, 0);
    assert.equal(f.deck.stopped, true); assert.equal(f.deck.handles.length, 0);
    assert.equal(f.b.regularSummons.has(f.deck.state.key), false);
    near(f.u.player.dp, dp);
  });

test('Control and hiding do not pause an already deployed normal relay lifetime', () => {
  const f = make(), t = f.deck.place(5, 7);
  f.b.addBuff(f.u, {key: 'fixture:control', flags: {stun: true, silence: true}});
  f.u.hidden = true; advance(f.b, 25 + f.b.dt);
  assert.equal(t.deployed, false); assert.equal(f.deck.stopped, false);
});

test('An undeployed owner cannot place; lifecycle installation survives waiting for that owner', () => {
  const f = make({defer: true});
  advance(f.b, 1); assert.equal(f.deck.stopped, false);
  assert.throws(() => f.deck.place(5, 7), /Deploy Aphrissa/);
  f.deploy(); assert.equal(f.deck.place(5, 7).deployed, true);
});

test('Inactive viewports, invalid tiles, reserved occupancy, directions and insufficient DP do not consume the card', () => {
  const f = make(), dp = f.u.player.dp;
  f.b.setViewport('inline'); assert.throws(() => f.deck.place(5, 7), /fullscreen/);
  f.b.setViewport('fullscreen-workspace');
  for (const coords of [[-1, 7], [5.1, 7], [5, 5], [40, 7]]) assert.throws(() => f.deck.place(...coords));
  assert.throws(() => f.deck.place(5, 7, 'diagonal'), /facing/);
  f.u.player.dp = 2; assert.throws(() => f.deck.place(5, 7), /DP/);
  assert.equal(f.deck.stock, 1); f.u.player.dp = dp;
  assert.equal(f.deck.place(5, 7).deployed, true);
});

test('Spawn failure rolls back exact payment, stock and pending token hooks', () => {
  const f = make(), dp = f.u.player.dp;
  f.b.spawnToken = () => null;
  assert.throws(() => f.deck.place(5, 7), /deployment failed/);
  near(f.u.player.dp, dp); assert.equal(f.deck.stock, 1);
  assert.equal(f.deck.point, null); assert.equal(f.deck.placing, false);
});

test('Relay damage immunity and healing prohibition run through the actual damage and healing pipelines', () => {
  const f = make(), t = f.deck.place(5, 7), hp = t.hp;
  const dealt = f.b.dealDamage(null, t, {amount: 1000, type: 'true', noSp: true});
  near(dealt, 0); near(t.hp, hp);
  t.hp = 100; near(f.b.heal(f.u, t, 100), 0); near(t.hp, 100);
  assert.deepEqual(f.b.errors, []);
});

test('Normal relay countdown is a passive lifetime gauge, never a ready or activatable skill', () => {
  const f = make(), t = f.deck.place(5, 7);
  const before = skillHud(t.skill);
  assert.equal(before.state, 'active'); assert.equal(before.ready, false);
  assert.equal(before.canActivate, false); assert.equal(before.canCancel, false);
  assert.equal(before.text, 'Relay remaining · 25s');
  advance(f.b, 5);
  near(t.skill.spec.formCountdown().remaining, 20);
  near(t.skill.spec.formCountdown().duration, 25);
});

for (const obstacle of ['blocked', 'reserved', 'unbuildable'])
  test(`A ${obstacle} relay tile rejects without payment or card consumption`, () => {
    const f = make(), dp = f.u.player.dp;
    if (obstacle === 'blocked') f.b.grid.setObstacle(5, 7, true, 'block');
    if (obstacle === 'reserved') assert.ok(f.b.reserveTile(f.u, 5, 7, 'fixture:reservation'));
    if (obstacle === 'unbuildable') f.b.grid.tile(5, 7).build = 'NONE';
    assert.throws(() => f.deck.place(5, 7));
    near(f.u.player.dp, dp); assert.equal(f.deck.stock, 1); assert.equal(f.deck.point, null);
  });

test('Owner retirement inside the token deployment callback rolls back the interrupted placement', () => {
  const f = make(), dp = f.u.player.dp;
  f.b.on('deploy', ({unit}) => { if (unit.defId === TOKEN) f.b.kill(f.u, null); });
  assert.throws(() => f.deck.place(5, 7), /deployment failed/);
  near(f.u.player.dp, dp); assert.equal(f.deck.stock, 0); assert.equal(f.deck.stopped, true);
  assert.equal(f.deck.handles.length, 0); assert.equal(f.deck.placing, false);
  assert.equal(f.b.allyUnits.some(u => u.defId === TOKEN && u.deployed), false);
  assert.equal(f.b.unitAt(5, 7), null);
});

test('A reentrant deploy callback cannot spend twice or create a second relay', () => {
  const f = make(), dp = f.u.player.dp;
  let attempts = 0;
  f.b.on('deploy', ({unit}) => {
    if (unit.defId !== TOKEN) return;
    attempts++; assert.throws(() => f.deck.place(5, 8), /already deployed/);
  });
  const t = f.deck.place(5, 7);
  near(f.u.player.dp, dp - 3); assert.equal(attempts, 1);
  assert.deepEqual(f.deck.own().map(u => u.id), [t.id]);
});

test('A replaced relay life is detached without removing the newer life or refunding the old one', () => {
  const f = make(), t = f.deck.place(5, 7), dp = f.u.player.dp;
  t.deploySeq++; advance(f.b, .1);
  assert.equal(t.deployed, true); assert.equal(f.deck.point, null);
  assert.equal(f.deck.stock, 1); near(f.u.player.dp, dp);
  assert.throws(() => f.deck.retreat(t), /current relay/);
});

test('Owner cleanup preserves a foreign player-owned field resource', () => {
  const f = make(), own = f.deck.place(5, 7);
  const foreign = f.b.spawnToken('arkpedia', 'fixture:foreign', 6, 8, {
    def: {name: 'Foreign resource', position: 'ALL', profession: 'TOKEN', stats: {maxHp: 10, atk: 0, blockCnt: 0}, skill: null},
    kit: {trait: {noAttack: true}, talents: [], skill: {kind: 'passive'}},
  });
  assert.ok(foreign); f.b.retreat(f.u, {permanent: true});
  assert.equal(own.deployed, false); assert.equal(foreign.deployed, true);
});

test('Unreviewed or altered selected input cannot construct a diagnostic relay deck', () => {
  assert.throws(() => make({contract: {}}), /explicit normal relay contract/);
  assert.throws(() => make({mutate: def => def.stats.atk++}), /Incomplete original/);
});

test('Cleanup cannot remove a replacement deck registered under the same public key', () => {
  const f = make(), replacement = {owner: {id: 'replacement'}};
  f.b.regularSummons.set(f.deck.state.key, replacement); f.deck.stop();
  assert.equal(f.b.regularSummons.get(f.deck.state.key), replacement);
});
