// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, addOwner, advance, near} from './helpers/aphrissa-relay-fixture.js';
import {APHRISSA_S3_RELAY_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-relay.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const make = options => fixture({skill: 3, s3Relay: true, ...options});
const MARKER = 'aphris_sk1_token';
const host = (f, key = 'aphris_sk3[mark]') => f.b.addBuff(f.u, {key, source: f.u, duration: Infinity});

for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} grants two extra relay slots and restores one baseline card`, () => {
  const f = make({rank}), dp = f.u.player.dp, lease = f.deck.beginS3(); host(f);
  assert.ok(lease); assert.equal(f.deck.stock, 3); near(f.deck.readyAt, f.b.time);
  const units = [f.deck.place(5, 7, 'UP'), f.deck.place(5, 8, 'LEFT'), f.deck.place(5, 9, 'DOWN')];
  assert.equal(f.deck.stock, 0); assert.equal(f.deck.own().length, 3); near(f.u.player.dp, dp - 9);
  assert.ok(units.every(unit => unit.deploymentSlotCost === 0 && unit.ownerUnit === f.u));
  assert.throws(() => f.deck.place(5, 10), /already deployed/);
  assert.equal(f.deck.endS3(lease), true); assert.equal(f.deck.stock, 1); assert.equal(f.deck.own().length, 0);
  assert.ok(units.every(unit => !unit.deployed)); near(f.deck.readyAt, f.b.time); near(f.u.player.dp, dp - 9);
  assert.equal(f.deck.endS3(lease), false);
});

test('S3 start withdraws the normal relay without refund and resets its cooldown with the two new cards', () => {
  const f = make(), token = f.deck.place(5, 7), paid = f.u.player.dp;
  advance(f.b, 2); const lease = f.deck.beginS3();
  assert.ok(lease); assert.equal(token.deployed, false); near(f.u.player.dp, paid);
  assert.equal(f.deck.stock, 3); near(f.deck.readyAt, f.b.time);
  assert.equal(f.deck.place(5, 7).deployed, true);
});

test('A normal card already recovering is immediately reset on S3 entry', () => {
  const f = make(), token = f.deck.place(5, 7); f.deck.retreat(token);
  assert.match(f.deck.placementError(5, 7), /redeploying/); advance(f.b, 3);
  assert.ok(f.deck.beginS3()); assert.equal(f.deck.stock, 3); near(f.deck.readyAt, f.b.time);
  assert.ok(f.deck.place(5, 7));
});

for (const key of ['aphris_sk1', 'aphris_sk3[sheltering]', 'aphris_sk3[on_finish]', 'aphris_sk3[mark]'])
  test(`The original ${key} host key grants a nonderived self-sourced birth marker`, () => {
    const f = make(); host(f, key); const token = f.deck.place(5, 7);
    assert.equal(token.findBuff(MARKER).source, token); assert.equal(token.findBuff(MARKER).duration, Infinity);
    f.b.removeBuff(f.u, key); advance(f.b, 27);
    assert.equal(token.deployed, true); assert.equal(f.deck.point.lifetimeResolved, true);
    assert.equal(skillHud(token.skill), null);
  });

test('Each relay lifetime gauge belongs to that relay rather than the first point in the deck', () => {
  const f = make(); f.deck.beginS3(); const a = f.deck.place(5, 7); advance(f.b, 2);
  const z = f.deck.place(5, 8); advance(f.b, 1);
  const first = a.skill.spec.formCountdown(), next = z.skill.spec.formCountdown();
  near(next.remaining - first.remaining, 2); assert.equal(first.duration, 25);
});

test('All three accepted permanence markers independently suppress finite expiry', () => {
  const f = make(); const lease = f.deck.beginS3(); host(f);
  const a = f.deck.place(5, 7); advance(f.b, 2); const z = f.deck.place(5, 8); advance(f.b, 2);
  const third = f.deck.place(5, 9); advance(f.b, 27);
  assert.ok([a, z, third].every(unit => unit.deployed));
  assert.ok([...f.deck.points.values()].every(point => point.lifetimeResolved));
  assert.equal(f.deck.endS3(lease), true); assert.ok([a, z, third].every(unit => !unit.deployed));
});

test('The S3 lease alone does not invent host marker grants or permanent lifetime', () => {
  const f = make(); f.deck.beginS3(); const token = f.deck.place(5, 7);
  assert.equal(token.findBuff(MARKER), null); advance(f.b, 25 + f.b.dt);
  assert.equal(token.deployed, false);
});

test('Withdrawing one relay recovers only its card and leaves the other two ray points alive', () => {
  const f = make(); f.deck.beginS3(); host(f);
  const a = f.deck.place(5, 7), z = f.deck.place(5, 8), third = f.deck.place(5, 9), dp = f.u.player.dp;
  advance(f.b, 2); f.deck.retreat(z); near(f.u.player.dp, dp + 1);
  assert.deepEqual(f.deck.own().map(unit => unit.id), [a.id, third.id]);
  assert.equal(f.deck.stock, 1); near(f.deck.readyAt, 32);
  assert.throws(() => f.deck.retreat(z), /current relay/); near(f.u.player.dp, dp + 1);
  advance(f.b, 30); assert.equal(f.deck.place(5, 8).deployed, true);
});

test('Independent card cooldowns do not lock another available card or clear surviving relays', () => {
  const f = make(); f.deck.beginS3(); host(f);
  const a = f.deck.place(5, 7), z = f.deck.place(5, 8); advance(f.b, 1); f.deck.retreat(a);
  assert.equal(f.deck.stock, 2); near(f.deck.readyAt, 0); const third = f.deck.place(5, 9);
  advance(f.b, 1); f.deck.retreat(z); assert.equal(f.deck.stock, 2); near(f.deck.readyAt, 31);
  advance(f.b, 29); const next = f.deck.place(5, 7);
  assert.ok(third.deployed); assert.ok(next.deployed); assert.equal(f.deck.stock, 1); near(f.deck.readyAt, 32);
});

test('A stale lease ticket cannot end the next activation or remove its three relay lives', () => {
  const f = make(), first = f.deck.beginS3(); f.deck.endS3(first);
  const next = f.deck.beginS3(); host(f); const token = f.deck.place(5, 7);
  assert.notEqual(first, next); assert.equal(f.deck.endS3(first), false);
  assert.equal(f.deck.endS3({...next}), false); assert.equal(token.deployed, true);
  assert.equal(f.deck.lease, next); assert.equal(f.deck.beginS3(), null);
});

test('An S3 slot failure restores its exact card and payment without clearing other points', () => {
  const f = make(); f.deck.beginS3(); host(f); const first = f.deck.place(5, 7), dp = f.u.player.dp;
  const spawn = f.b.spawnToken; f.b.spawnToken = () => null;
  assert.throws(() => f.deck.place(5, 8), /deployment failed/);
  assert.equal(f.deck.stock, 2); near(f.u.player.dp, dp); assert.equal(first.deployed, true);
  f.b.spawnToken = spawn; assert.ok(f.deck.place(5, 8));
});

test('Marker rejection does not fabricate acceptance, and its relay retains normal expiry', () => {
  const f = make(); f.deck.beginS3(); host(f);
  f.b.on('beforeBuff', context => { if (context.buff.key === MARKER) context.cancel = true; });
  const token = f.deck.place(5, 7); assert.equal(token.findBuff(MARKER), null);
  advance(f.b, 25 + f.b.dt); assert.equal(token.deployed, false);
});

for (const reason of ['retreat', 'death', 'life', 'slot', 'battleEnd'])
  test(`S3 owner ${reason} retires all three points, extra cards and hooks`, () => {
    const f = make(); f.deck.beginS3(); host(f);
    const units = [f.deck.place(5, 7), f.deck.place(5, 8), f.deck.place(5, 9)];
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'life') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'slot') { f.u.mem.aphrissaRelay = {}; advance(f.b, .1); }
    if (reason === 'battleEnd') f.b._finish('fixture');
    assert.ok(units.every(unit => !unit.deployed)); assert.equal(f.deck.stock, 0);
    assert.equal(f.deck.point, null); assert.equal(f.deck.lease, null); assert.equal(f.deck.handles.length, 0);
    assert.equal(f.deck.beginS3(), null);
  });

test('A source retired while start withdraws its old relay cannot resurrect ready extra cards', () => {
  const f = make(), token = f.deck.place(5, 7);
  f.b.on('death', ({unit}) => { if (unit === token) f.b.retreat(f.u, {permanent: true}); });
  assert.equal(f.deck.beginS3(), null); assert.equal(f.deck.stock, 0); assert.equal(f.deck.own().length, 0);
  assert.equal(f.deck.lease, null); assert.equal(f.deck.handles.length, 0);
});

test('Placement and recursive lease changes are refused during native action transactions', () => {
  const f = make(), token = f.deck.place(5, 7); let calls = 0;
  f.b.on('death', ({unit}) => { if (unit !== token) return; calls++;
    assert.equal(f.deck.beginS3(), null); assert.equal(f.deck.endS3(f.deck.lease), false);
    assert.throws(() => f.deck.place(5, 8), /already deployed/); });
  assert.ok(f.deck.beginS3()); assert.equal(calls, 1); assert.equal(f.deck.stock, 3);
});

test('Foreign same-ID summons and another owner relay survive lease cleanup', () => {
  const f = make(), other = addOwner(f.b, {skill: 3, relay: false, row: 9, col: 5});
  const foreign = f.b.spawnToken('arkpedia', f.deck.state.tokenId, 8, 8, {def: f.deck.def,
    kit: {trait: {noAttack: true}, talents: [], skill: {kind: 'passive'}}});
  const otherToken = f.b.spawnToken(other.u, f.deck.state.tokenId, 9, 7, {def: f.deck.def,
    kit: {trait: {noAttack: true}, talents: [], skill: {kind: 'passive'}}});
  const lease = f.deck.beginS3(); host(f); f.deck.place(5, 7);
  f.deck.endS3(lease); assert.equal(foreign.deployed, true); assert.equal(otherToken.deployed, true);
});

test('A normal-only relay controller cannot acquire S3 extras through the diagnostic methods', () => {
  const f = fixture({skill: 3}); assert.equal(f.deck.beginS3(), null); assert.equal(f.deck.endS3({}), false);
  assert.equal(f.deck.stock, 1);
  assert.throws(() => make({contract: {...contract}}), /exact relay lease/);
  assert.throws(() => make({skill: 2}), /Changed original Aphrissa S3/);
});

test('Ending S3 during marker admission cancels the pending placement and restores one usable baseline card', () => {
  const f = make(), lease = f.deck.beginS3(); host(f); const paid = f.u.player.dp; let closed, error;
  f.b.on('beforeBuff', context => { if (context.buff.key === MARKER) closed = f.deck.endS3(lease); });
  try { f.deck.place(5, 7); } catch (caught) { error = caught; }
  assert.equal(closed, true); assert.match(error?.message ?? '', /deployment failed/);
  assert.equal(f.deck.lease, null); assert.equal(f.deck.stock, 1); near(f.deck.readyAt, f.b.time);
  assert.equal(f.deck.own().length, 0); assert.equal(f.b.unitAt(5, 7), null); near(f.u.player.dp, paid);
  assert.deepEqual(f.b.errors, []);
});
