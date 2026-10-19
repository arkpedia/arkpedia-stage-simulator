// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, advance, near} from './helpers/aphrissa-relay-fixture.js';
import {APHRISSA_RELAY_ID as TOKEN} from '../server/sim/content/arkpedia-aphrissa-source.js';
const PARENT = 'aphris_token_add_atk_tohost', CHILD = 'aphris_t1[atk]';
const make = opts => fixture({bonus: true, ...opts});
function extra(f, row = 6, col = 8, owner = f.u) {
  const unit = f.b.spawnToken(owner, TOKEN, row, col, {dir: 'RIGHT', def: f.deck.def,
    kit: {trait: {noAttack: true}, talents: [], skill: {kind: 'passive'}}});
  assert.ok(unit); return unit;
}

for (const elite of [0, 1, 2]) for (const potential of [1, 6])
  test(`E${elite}/P${potential} relay presence applies only its original selected ATK coefficient`, () => {
    const f = make({elite, potential}), base = f.u.s.atk, scale = [0, .15, .25][elite];
    assert.equal(f.u.findBuff(CHILD), null);
    const t = f.deck.place(5, 7); f.relayBonus.sync();
    near(f.u.s.atk, base * (1 + scale));
    assert.ok(t.findBuff(PARENT)); assert.equal(f.u.buffs.filter(b => b.key === CHILD).length, scale ? 1 : 0);
    f.deck.retreat(t); f.relayBonus.sync(); near(f.u.s.atk, base);
  });

test('Several related relay parents grant one ATK child and losing the chosen parent restores another', () => {
  const f = make(), base = f.u.s.atk, first = f.deck.place(5, 7), second = extra(f);
  f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
  assert.equal(f.relayBonus.members.size, 2); assert.equal(f.u.buffs.filter(b => b.key === CHILD).length, 1);
  assert.equal(f.relayBonus.active.target.id, first.id);
  f.deck.retreat(first); f.relayBonus.sync();
  assert.equal(f.relayBonus.active.target.id, second.id); near(f.u.s.atk, base * 1.25);
  f.b.retreat(second, {permanent: true}); near(f.u.s.atk, base);
});

test('A related relay outside the attack ray still supplies the no-range talent', () => {
  const f = make(), base = f.u.s.atk; f.deck.place(10, 15);
  f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
});

test('Related-set selection is explicit and is not silently replaced by the ray ID filter', () => {
  const f = make(), base = f.u.s.atk, foreign = extra(f, 5, 7, 'arkpedia');
  f.relayBonus.sync(); near(f.u.s.atk, base); assert.equal(foreign.findBuff(PARENT), null);
  f.related.get = () => [foreign, foreign]; f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
  assert.equal(f.relayBonus.members.size, 1);
  f.related.get = () => []; f.relayBonus.sync(); near(f.u.s.atk, base);
});

test('Native invulnerability, isolation and healing prohibition on an owned relay do not erase relay presence', () => {
  const f = make(), base = f.u.s.atk, t = f.deck.place(5, 7);
  assert.equal(t.s.flags.invulnerable, true); assert.equal(t.s.flags.isolated, true);
  f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
});

test('Owner or relay hiding temporarily removes parents and restores them on return', () => {
  const f = make(), base = f.u.s.atk, t = f.deck.place(5, 7);
  t.hidden = true; f.relayBonus.sync(); near(f.u.s.atk, base);
  t.hidden = false; f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
  f.u.hidden = true; advance(f.b, .1); near(f.u.s.atk, base); assert.equal(f.relayBonus.stopped, false);
  f.u.hidden = false; f.relayBonus.sync(); near(f.u.s.atk, base * 1.25);
});

test('Source silence/stun does not disable the nonsilenceable native parent', () => {
  const f = make(), base = f.u.s.atk; f.deck.place(5, 7);
  f.b.addBuff(f.u, {key: 'fixture:control', flags: {silence: true, stun: true}});
  advance(f.b, .1); near(f.u.s.atk, base * 1.25);
});

test('Parent removal immediately finishes its derived ATK child, then a still-related relay can be readmitted', () => {
  const f = make(), base = f.u.s.atk, t = f.deck.place(5, 7), parent = t.findBuff(PARENT);
  assert.ok(parent); f.b.removeBuff(t, parent); near(f.u.s.atk, base);
  f.relayBonus.sync(); assert.notEqual(t.findBuff(PARENT), parent); near(f.u.s.atk, base * 1.25);
});

test('Replaced relay lives receive fresh parents and stale cleanup cannot remove the replacement', () => {
  const f = make(), t = f.deck.place(5, 7), old = t.findBuff(PARENT);
  t.deploySeq++; f.relayBonus.sync(); const fresh = t.findBuff(PARENT);
  assert.ok(fresh); assert.notEqual(fresh, old); f.b.removeBuff(t, old); assert.equal(t.findBuff(PARENT), fresh);
});

for (const reason of ['retreat', 'death', 'life', 'replacement', 'battleEnd'])
  test(`Owner ${reason} removes owned relay parents and the derived child`, () => {
    const f = make(), base = f.u.s.atk, t = f.deck.place(5, 7);
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'life') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'replacement') { f.u.mem.aphrissaRelayBonus = {}; advance(f.b, .1); }
    if (reason === 'battleEnd') f.b.emit('battleEnd', {});
    near(f.u.s.atk, base); assert.equal(t.findBuff(PARENT), null);
    assert.equal(f.relayBonus.members.size, 0); assert.equal(f.relayBonus.handles.length, 0);
  });

test('Foreign owner or relay-parent replacements remain untouched on cleanup', () => {
  const f = make(), t = f.deck.place(5, 7);
  const parent = f.b.addBuff(t, {key: PARENT, source: t});
  const child = f.b.addBuff(f.u, {key: CHILD, source: t, mods: {atkPct: .07}});
  f.relayBonus.sync(); f.relayBonus.stop();
  assert.equal(t.findBuff(PARENT), parent); assert.equal(f.u.findBuff(CHILD), child);
});

for (const key of [PARENT, CHILD]) test(`A modified ${key} admission cannot forge the selected talent`, () => {
  const f = make(), base = f.u.s.atk;
  f.b.on('beforeBuff', context => {
    if (context.buff.key === key) context.buff.mods = {atkPct: 999};
  });
  const t = f.deck.place(5, 7); f.relayBonus.sync();
  near(f.u.s.atk, base); assert.equal(f.u.findBuff(CHILD), null);
  if (key === PARENT) assert.equal(t.findBuff(PARENT), null);
});

test('Retirement during derived child admission leaves no orphan parent or owner buff', () => {
  const f = make(), base = f.u.s.atk;
  f.b.on('beforeBuff', context => { if (context.buff.key === CHILD) f.b.retreat(f.u, {permanent: true}); });
  assert.throws(() => f.deck.place(5, 7), /deployment failed/);
  near(f.u.s.atk, base); assert.equal(f.relayBonus.members.size, 0);
  assert.equal(f.relayBonus.handles.length, 0);
});

test('An adapter query failure drains owned grants before reporting its error', () => {
  const f = make(), base = f.u.s.atk; f.deck.place(5, 7);
  f.related.get = () => { throw Error('fixture:relation'); };
  assert.throws(() => f.relayBonus.sync(), /fixture:relation/); near(f.u.s.atk, base);
  assert.equal(f.relayBonus.members.size, 0);
});

test('An unreviewed contract or malformed related-set adapter cannot invent a generic relation', () => {
  assert.throws(() => make({bonusContract: {}}), /explicit related-relay adapter/);
  const f = make(); f.related.get = () => null;
  assert.throws(() => f.relayBonus.sync(), /original entities/);
});
