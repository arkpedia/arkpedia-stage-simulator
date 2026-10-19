// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make} from './helpers/aphrissa-relay-fixture.js';
import {aphrissaRayCells, APHRISSA_RAY_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-ray.js';
import {APHRISSA_RELAY_ID as TOKEN} from '../server/sim/content/arkpedia-aphrissa-source.js';
const trace = (f, options) => aphrissaRayCells(f.b, f.u, {contract, ...options});
const coords = result => result.cells.map(cell => [cell.row, cell.col]);
const relay = (f, row, col, dir, opts = {}) => {
  const unit = f.b.spawnToken('arkpedia', TOKEN, row, col, {dir,
    def: f.deck.def, kit: {trait: {noAttack: true}, talents: [], skill: {kind: 'passive'}}, ...opts});
  assert.ok(unit); return unit;
};

for (const elite of [0, 1, 2]) test(`Normal E${elite} ray preserves the source straight grid`, () => {
  const f = make({elite}), result = trace(f), count = elite === 0 ? 5 : 6;
  assert.deepEqual(coords(result), Array.from({length: count}, (_, i) => [5, 5 + i]));
  assert.deepEqual(result.turns, []); assert.equal(result.cycle, false);
  assert.ok(result.cells.every(cell => cell.extensionCount === 0 && cell.directionChanges === 0));
});

for (const [dir, dr, dc] of [['UP', 1, 0], ['DOWN', -1, 0], ['LEFT', 0, -1], ['RIGHT', 0, 1]])
  test(`The existing simulator direction convention rotates the normal ray ${dir}`, () => {
    const f = make(); f.u.dir = dir;
    assert.deepEqual(coords(trace(f)), Array.from({length: 6}, (_, i) => [5 + i * dr, 5 + i * dc]));
  });

test('An actual deployed relay turns the finite ray and extends it by two source cells', () => {
  const f = make(), t = f.deck.place(5, 7, 'UP'), result = trace(f);
  assert.deepEqual(coords(result), [[5, 5], [5, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7]]);
  assert.equal(result.turns.length, 1);
  assert.deepEqual(result.turns[0], {row: 5, col: 7, sourceId: t.id, sourceLife: t.deploySeq,
    relay: true, incoming: 'RIGHT', outgoing: 'UP', extensionCount: 1, directionChanges: 1});
  assert.equal(result.cells[1].extensionCount, 0);
  assert.equal(result.cells.at(-1).extensionCount, 1);
});

test('A relay at the original last cell still extends range, including a straight-through relay', () => {
  const f = make(); f.deck.place(5, 10, 'RIGHT'); const result = trace(f);
  assert.deepEqual(coords(result), Array.from({length: 8}, (_, i) => [5, 5 + i]));
  assert.equal(result.turns[0].directionChanges, 0);
  assert.equal(result.turns[0].extensionCount, 1);
});

test('The original ID-only selector permits a friendly relay without the same owner', () => {
  const f = make(), t = relay(f, 5, 7, 'UP');
  assert.equal(t.ownerUnit, null); assert.equal(trace(f).turns[0].sourceId, t.id);
});

test('Normal rays ignore ordinary operators as turn points', () => {
  const f = make(); f.b.deployOperator('char_122_beagle', 5, 7, 'UP');
  const result = trace(f);
  assert.deepEqual(coords(result), Array.from({length: 6}, (_, i) => [5, 5 + i]));
  assert.deepEqual(result.turns, []);
});

test('S2 turns through an actual operator without counting a relay extension', () => {
  const f = make({skill: 2}), t = f.b.deployOperator('char_122_beagle', 5, 7, 'UP');
  const result = trace(f, {skill2: true});
  assert.deepEqual(coords(result).slice(0, 5), [[5, 5], [5, 6], [5, 7], [6, 7], [7, 7]]);
  assert.equal(result.cells.at(-1).row, f.b.grid.rect.r1);
  assert.deepEqual(result.turns.map(turn => [turn.sourceId, turn.relay, turn.extensionCount]), [[t.id, false, 0]]);
});

test('S2 has no finite range cap and counts relay traversal independently of operator turns', () => {
  const f = make({skill: 2}); f.deck.place(5, 12, 'UP');
  const result = trace(f, {skill2: true});
  assert.ok(result.cells.length > 8); assert.equal(result.turns[0].extensionCount, 1);
  assert.deepEqual(coords(result).at(-1), [f.b.grid.rect.r1, 12]);
});

for (const exclusion of ['hidden', 'enemy', 'removed']) test(`A ${exclusion} relay does not redirect the owner ray`, () => {
  const f = make(), t = relay(f, 5, 7, 'UP', exclusion === 'enemy' ? {targetSide: 'enemy'} : {});
  if (exclusion === 'hidden') t.hidden = true;
  if (exclusion === 'removed') f.b.retreat(t, {permanent: true});
  assert.deepEqual(trace(f).turns, []);
});

for (const flag of ['isolated', 'untargetable']) test(`S2 respects operator ${flag} without applying that rejection to the original relay`, () => {
  const f = make({skill: 2}), t = f.b.deployOperator('char_122_beagle', 5, 7, 'UP');
  f.b.addBuff(t, {key: 'fixture:turn-exclusion', flags: {[flag]: true}});
  assert.deepEqual(trace(f, {skill2: true}).turns, []);
  f.b.retreatOperator('char_122_beagle'); f.u.player.dp = 99;
  f.deck.place(5, 7, 'UP');
  assert.equal(trace(f, {skill2: true}).turns[0].relay, true);
});

test('Opposing relays terminate a directed cycle and retain unique first-arrival cell metadata', () => {
  const f = make(); relay(f, 5, 6, 'RIGHT'); relay(f, 5, 7, 'LEFT');
  const result = trace(f);
  assert.equal(result.cycle, true);
  assert.deepEqual(coords(result), [[5, 5], [5, 6], [5, 7]]);
  assert.deepEqual(result.cells.map(c => c.extensionCount), [0, 1, 2]);
  assert.equal(result.turns.length, 3);
});

test('Ray geometry recomputes current relay direction and removal without holding stale unit references', () => {
  const f = make(), t = f.deck.place(5, 7, 'UP');
  assert.equal(coords(trace(f)).at(-1)[0], 10);
  t.dir = 'DOWN'; assert.deepEqual(coords(trace(f)).at(-1), [0, 7]);
  f.deck.retreat(t); assert.deepEqual(trace(f).turns, []);
});

test('Ray geometry rejects unreviewed contracts, inactive owners and a foreign selected S2 binding', () => {
  const f = make();
  assert.throws(() => aphrissaRayCells(f.b, f.u), /explicit ray/);
  assert.throws(() => trace(f, {skill2: true}), /selected second skill/);
  f.u.deployed = false; assert.throws(() => trace(f), /Current Aphrissa/);
});
