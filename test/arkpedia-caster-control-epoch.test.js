// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const MINI = 'char_4054_malist', AMIYA = 'char_002_amiya', ABS = 'char_405_absin';
const NIGHT = 'char_164_nightm', PASS = 'char_472_pasngr';
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, skill) {
  const src = structuredClone(data), op = src.operators[id];
  src.stage.geometry.waves[0].spawns = [];
  src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [{ ...defaultBuild(op), elite: 2,
    level: op.phases[2].maxLevel, potential: 1, skillRank: 10, skillId: op.skills[skill].id }] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 1, 4, 'UP'); assert.ok(u); u.atkCd = 1000;
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [2, 4] });
  Object.assign(e.base, { maxHp: 100000, res: 0, def: 0 }); e.markDirty(); void e.s;
  e.hp = id === ABS ? 50000 : 100000;
  b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); b.rng.chance = () => false;
  return { b, u, e };
}
function activate(b, u) {
  u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.manual ? b.activateOperator(u.defId) : u.skill.activate('test'), true);
  u.atkCd = 1000;
}
function interrupt(b, u, e, immune = false) {
  if (immune) u.def.immune.add('stun');
  const before = u.attackControlEpoch;
  assert.equal(b.applyStatus(u, 'stun', { duration: .001, source: e }), !immune);
  assert.equal(u.attackControlEpoch, immune ? before : (before ?? 0) + 1);
}

for (const [id, skill, firstCount, fullCount] of [[MINI, 1, 2, 4], [AMIYA, 1, 1, 8], [ABS, 1, 1, 4]]) {
  test(`${id} pending burst remembers a .001-second accepted control while born projectiles land`, () => {
    const { b, u, e } = make(id, skill); activate(b, u);
    if (id === ABS) advance(b, .55);
    let released = 0, hits = 0;
    const original = b.addProjectile.bind(b);
    b.addProjectile = p => { if (p.source === u) released++; return original(p); };
    b.on('damaged', c => { if (c.source === u && c.target === e) hits++; });
    const hp = e.hp; b.forceAttack(u, [e]); u.atkCd = 1000;
    for (let n = 0; released === 0 && n < 60; n++) b.step();
    assert.equal(released, firstCount);
    interrupt(b, u, e); advance(b, 1);
    assert.equal(u.canAct, true); assert.equal(released, firstCount); assert.equal(hits, firstCount);
    assert.ok(e.hp < hp, 'already emitted rounds still damage the original victim');
  });
  test(`${id} immunity-rejected control leaves the full original burst intact`, () => {
    const { b, u, e } = make(id, skill); activate(b, u);
    if (id === ABS) advance(b, .55);
    let released = 0;
    const original = b.addProjectile.bind(b);
    b.addProjectile = p => { if (p.source === u) released++; return original(p); };
    b.forceAttack(u, [e]); u.atkCd = 1000;
    for (let n = 0; released === 0 && n < 60; n++) b.step();
    assert.equal(released, firstCount);
    interrupt(b, u, e, true); advance(b, 1); assert.equal(released, fullCount);
  });
}

test('Nightmare captures its intentional cast lock, but a later .001-second accepted control cancels rupture', () => {
  for (const immune of [false, true]) {
    const { b, u, e } = make(NIGHT, 1); activate(b, u);
    assert.ok(u.s.flags.disarm && u.s.flags.noSp);
    interrupt(b, u, e, immune); advance(b, 1);
    assert.equal(u.canAct, true);
    assert.equal(!!e.findBuff(`nightmare:rupture:${u.id}`), immune);
    advance(b, 1); assert.ok(!u.s.flags.disarm && !u.s.flags.noSp);
  }
});

test('Passenger captures its intentional cast lock and rejects sub-step control before storm birth', () => {
  for (const immune of [false, true]) {
    const { b, u, e } = make(PASS, 2); activate(b, u);
    assert.ok(u.s.flags.disarm && u.s.flags.noSp);
    interrupt(b, u, e, immune); advance(b, 1.3);
    assert.equal(u.canAct, true); assert.equal(u.mem.passengerStorms.size, immune ? 1 : 0);
    assert.equal(e.hp < 100000, immune);
  }
});

test('Passenger already born storm keeps its pulse clock after a .001-second control', () => {
  const { b, u, e } = make(PASS, 2); activate(b, u);
  for (let n = 0; u.mem.passengerStorms.size === 0 && n < 60; n++) b.step();
  assert.equal(u.mem.passengerStorms.size, 1);
  const hp = e.hp; interrupt(b, u, e); advance(b, .7);
  assert.equal(u.canAct, true); assert.ok(e.hp < hp);
  assert.equal(u.mem.passengerStorms.size, 1, 'accepted control cannot cancel an emitted storm');
});
