// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, addOwner, advance, near} from './helpers/aphrissa-relay-fixture.js';
const KEY = 'aphris[t2]';
const make = opts => fixture({resistance: true, ...opts});
const ally = (f, row = 5, col = 7, dir = 'RIGHT') => f.b.deployOperator('char_122_beagle', row, col, dir);
function enemy(f, res = 50) {
  const t = f.b.spawnEnemy('enemy_1007_slime', {pos: [5, 8]});
  Object.assign(t.base, {maxHp: 100000, res, moveSpeed: 0}); t.markDirty(); void t.s; t.hp = t.s.maxHp;
  f.b.addBuff(t, {key: 'fixture:pin', flags: {noMove: true, disarm: true}}); return t;
}

for (const elite of [0, 1, 2]) for (const potential of [1, 6])
  test(`E${elite}/P${potential} aura follows the original promotion/potential unlock`, () => {
    const f = make({elite, potential}), t = ally(f), power = elite < 2 ? 0 : potential === 6 ? 13 : 10;
    f.aura.sync(); near(f.u.s.resIgnoreFlat, power); near(t.s.resIgnoreFlat, power);
    assert.equal(t.findBuff(KEY)?.source?.id, power ? f.u.id : undefined);
  });

test('Fixed penetration changes the allied damage calculation without lowering enemy RES', () => {
  const f = make(), t = ally(f), e = enemy(f);
  f.aura.sync(); near(e.s.res, 50);
  near(f.b.dealDamage(t, e, {amount: 1000, type: 'arts', noSp: true}), 600);
  near(e.s.res, 50);
  f.aura.stop(); near(t.s.resIgnoreFlat, 0);
  near(f.b.dealDamage(t, e, {amount: 1000, type: 'arts', noSp: true}), 500);
});

test('A friendly operator leaving and reentering the current ray loses and regains only this aura', () => {
  const f = make(), t = ally(f);
  f.aura.sync(); near(t.s.resIgnoreFlat, 10);
  t.y = 6; t.tileR = 6; f.aura.sync(); near(t.s.resIgnoreFlat, 0);
  t.y = 5; t.tileR = 5; f.aura.sync(); near(t.s.resIgnoreFlat, 10);
});

test('The live normal ray follows relay turns for this friendly aura', () => {
  const f = make(); f.deck.place(5, 7, 'UP'); const t = ally(f, 7, 7);
  f.aura.sync(); near(t.s.resIgnoreFlat, 10);
  f.deck.retreat(f.deck.own()[0]); f.aura.sync(); near(t.s.resIgnoreFlat, 0);
});

test('S2 dispatch extends the aura to operators on its infinite turned ray and restores normal range afterward', () => {
  const f = make({skill: 2}), t = ally(f, 5, 14, 'UP');
  f.aura.sync(); near(t.s.resIgnoreFlat, 0);
  f.mode.ray = 's2'; f.aura.sync(); near(t.s.resIgnoreFlat, 10);
  f.mode.ray = 'normal'; f.aura.sync(); near(t.s.resIgnoreFlat, 0);
});

for (const flag of ['isolated', 'untargetable']) test(`Native friendly target options reject ${flag}`, () => {
  const f = make(), t = ally(f);
  f.b.addBuff(t, {key: 'fixture:flag', flags: {[flag]: true}}); f.aura.sync(); near(t.s.resIgnoreFlat, 0);
  f.b.removeBuff(t, 'fixture:flag'); f.aura.sync(); near(t.s.resIgnoreFlat, 10);
});

for (const flag of ['healFree', 'stun', 'silence', 'invulnerable']) test(`Purpose0 recipient ${flag} does not invent an exclusion`, () => {
  const f = make(), t = ally(f);
  f.b.addBuff(t, {key: 'fixture:flag', flags: {[flag]: true}}); f.aura.sync(); near(t.s.resIgnoreFlat, 10);
});

test('A hidden source or recipient leaves the aura, while source control does not silence the native talent', () => {
  const f = make(), t = ally(f);
  f.b.addBuff(f.u, {key: 'fixture:source-control', flags: {stun: true, silence: true}});
  f.aura.sync(); near(t.s.resIgnoreFlat, 10);
  t.hidden = true; f.aura.sync(); near(t.s.resIgnoreFlat, 0);
  t.hidden = false; f.u.hidden = true; f.aura.sync(); near(t.s.resIgnoreFlat, 0);
  f.u.hidden = false; f.aura.sync(); near(t.s.resIgnoreFlat, 10);
});

test('Token and device recipients do not acquire the source operator-only modifier', () => {
  const f = make(), token = f.deck.place(5, 7);
  const device = f.b.spawnDevice('fixture:device', 5, 8, {hp: 100});
  f.aura.sync(); near(token.s.resIgnoreFlat, 0); near(device.s.resIgnoreFlat, 0);
});

test('Overlapping source auras do not stack, and stronger source departure restores the eligible weaker one', () => {
  const f = make(), t = ally(f);
  const strong = addOwner(f.b, {resistance: true, relay: false, potential: 6, row: 5, col: 4});
  f.aura.sync(); near(t.s.resIgnoreFlat, 13); assert.equal(t.findBuff(KEY).source.id, strong.u.id);
  strong.aura.stop(); near(t.s.resIgnoreFlat, 10); assert.equal(t.findBuff(KEY).source.id, f.u.id);
  f.aura.stop(); near(t.s.resIgnoreFlat, 0);
});

test('A stronger source outside the recipient ray cannot override its in-range weaker source', () => {
  const f = make(), t = ally(f);
  addOwner(f.b, {resistance: true, relay: false, potential: 6, row: 6, col: 4});
  f.aura.sync(); near(t.s.resIgnoreFlat, 10);
});

for (const reason of ['retreat', 'death', 'life', 'replacement', 'battleEnd'])
  test(`Source ${reason} removes owned children without deleting unrelated buffs`, () => {
    const f = make(), t = ally(f);
    f.b.addBuff(t, {key: 'fixture:foreign-res', mods: {resIgnoreFlat: 7}}); f.aura.sync(); near(t.s.resIgnoreFlat, 17);
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'life') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'replacement') { f.u.mem.aphrissaResistance = {}; advance(f.b, .1); }
    if (reason === 'battleEnd') f.b.emit('battleEnd', {});
    near(t.s.resIgnoreFlat, 7); assert.ok(t.findBuff('fixture:foreign-res'));
    assert.equal(f.aura.stopped, true); assert.equal(f.aura.handles.length, 0);
  });

test('A foreign same-key replacement is not adopted, overwritten or removed on source cleanup', () => {
  const f = make(), t = ally(f); f.aura.sync();
  const foreign = f.b.addBuff(t, {key: KEY, source: t, mods: {resIgnoreFlat: 3}});
  f.aura.sync(); assert.equal(t.findBuff(KEY), foreign);
  f.aura.stop(); assert.equal(t.findBuff(KEY), foreign); near(t.s.resIgnoreFlat, 3);
});

test('Rejected and modified native child admissions cannot install a forged modifier', () => {
  const f = make({defer: true});
  f.b.on('beforeBuff', context => {
    if (context.buff.key === KEY) context.buff.mods.resIgnoreFlat = 999;
  });
  f.deploy(); const t = ally(f); f.aura.sync();
  near(t.s.resIgnoreFlat, 0); near(f.u.s.resIgnoreFlat, 0);
});

test('Retiring the source inside child admission leaves no orphan or retained field hooks', () => {
  const f = make({defer: true}); let retired = false;
  f.b.on('beforeBuff', context => {
    if (context.buff.key === KEY && !retired) { retired = true; f.b.retreat(f.u, {permanent: true}); }
  });
  f.deploy(); near(f.u.s.resIgnoreFlat, 0);
  assert.equal(f.aura.stopped, true); assert.equal(f.aura.field.members.size, 0);
  assert.equal(f.aura.field.handles.length, 0);
});

test('A range query failure clears the source-owned aura before surfacing the error', () => {
  const f = make(), t = ally(f); f.aura.sync(); near(t.s.resIgnoreFlat, 10);
  f.aura.rangeMode = () => { throw Error('fixture:range'); };
  assert.throws(() => f.aura.sync(), /fixture:range/); near(t.s.resIgnoreFlat, 0);
});

test('A source replaced while admitting a late recipient cannot leave earlier aura children alive', () => {
  const f = make(); near(f.u.s.resIgnoreFlat, 10);
  f.b.on('beforeBuff', context => {
    if (context.buff.key === KEY && context.unit !== f.u) f.u.mem.aphrissaResistance = {};
  });
  const t = ally(f);
  near(t.s.resIgnoreFlat, 0); near(f.u.s.resIgnoreFlat, 0);
  assert.equal(f.aura.field.members.size, 0);
});

test('Recipient life replacement creates a fresh child that stale cleanup cannot remove', () => {
  const f = make(), t = ally(f), old = t.findBuff(KEY);
  assert.ok(old); t.deploySeq++; f.aura.sync();
  const fresh = t.findBuff(KEY); assert.ok(fresh); assert.notEqual(fresh, old);
  f.b.removeBuff(t, old); assert.equal(t.findBuff(KEY), fresh); near(t.s.resIgnoreFlat, 10);
});

test('Unreviewed contracts and range modes cannot install a generic aura fallback', () => {
  assert.throws(() => make({resistanceContract: {}}), /exact resistance contract/);
  const f = make(); f.mode.ray = 'invented'; assert.throws(() => f.aura.sync(), /Unreviewed/);
});
