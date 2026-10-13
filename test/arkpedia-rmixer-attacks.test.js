// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { RMIXER_ID as ID } from '../server/sim/content/arkpedia-rmixer-source.js';
import { RMIXER_ATTACK_CONTRACT as CONTRACT, prepareRmixerAttacks } from '../server/sim/content/arkpedia-rmixer-attacks.js';

import { make, enemy, advance, until, cast } from './helpers/rmixer-fixture.js';

const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);

test('attack diagnostic is strict, opt-in and preserves its independent historical hold', () => {
  assert.ok(data.operators[ID]); assert.deepEqual(e.enabledOperators, []);
  assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed attack contract/);
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.ammo_cost++, d => d.rangeGrid = [[0, 99]],
    d => d.tags = [], d => d.talents.at(-1).bb.shield = 1])
    assert.throws(() => make({ mutate }), /Incomplete/);
  const f = make();
  assert.throws(() => prepareRmixerAttacks(f.b, f.u, { contract: CONTRACT }), /fresh original owner/);
  assert.throws(() => f.controller.install(), /already installed/);
  for (const skill of [1, 3]) {
    const g = make({ skill }); advance(g, 60);
    assert.equal(g.u.skill.activate('manual'), false);
  }
});

test('ordinary first engagement follows Begin then one native event, one projectile and one retained target', () => {
  const f = make({ skill: 1 }), a = enemy(f, { def: 50 }), z = enemy(f, { col: 5.8 });
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, target = p.target;
  near(p.releaseAt - p.startedAt, .667); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack_Begin');
  advance(f, .5); assert.equal(f.b.projectiles.list.length, 0);
  until(f, () => f.b.projectiles.list.length === 1);
  const proj = f.b.projectiles.list[0];
  const firstPlayId = f.u.mem.regularFormVisual.playId;
  assert.equal(proj.target, target); assert.equal(proj.speed, 10); assert.equal(proj.maxAge, 10);
  assert.equal(proj.data.projectileKey, 'projectile_chr_rmixer'); assert.equal(f.hits.length, 0);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  until(f, () => f.hits.length === 1);
  near(f.hits[0].hpLoss, f.u.s.atk - target.s.def);
  assert.equal(f.hits[0].dmg.isSkill, false); assert.equal(f.hits[0].dmg.isSplash, false);
  assert.equal(f.hits[0].dmg.applyWay, 'ranged'); assert.equal(f.attacks.length, 1);
  assert.equal(f.hits.some(h => h.target === (target === a ? z : a)), false);
  assert.equal(f.controller.release(target, { attackId: 999 }), false);
  until(f, () => f.attacks.length === 2);
  assert.notEqual(f.u.mem.regularFormVisual.playId, firstPlayId);
  assert.ok(f.attacks[1].time - f.attacks[0].time < 1.2 + f.b.dt * 2);
});

test('four facings use rotated ranges and original Front/Back clips without inventing Back death art', () => {
  for (const [dir, row, col, face] of [['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'],
    ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ dir }), t = enemy(f, { row, col });
    until(f, () => f.hits.length === 1);
    assert.equal(f.hits[0].target, t); assert.equal(f.controller.model(), e.models[ID][face]);
    assert.equal(f.u.mem.regularVisualDirection, face === 'Front' ? 'RIGHT' : 'UP');
    assert.equal(f.u.mem.regularDeathVisual?.clip, face === 'Front' ? 'Die' : undefined);
  }
});

test('ground and aerial inputs are legal, with blocked priority and no sleeping/stealth/camouflage selection', () => {
  for (const fly of [false, true]) {
    const f = make(), t = enemy(f, { fly });
    until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, t);
  }
  const f = make(); enemy(f, { flags: { stealth: true } }); enemy(f, { flags: { camou: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  advance(f, 4); assert.equal(f.hits.length, 0);
  const g = make(), blocked = enemy(g, { col: 4.5 }), other = enemy(g, { col: 6 });
  g.b.removeBuff(blocked, 'fixture:pin');
  g.b.addBuff(blocked, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  until(g, () => g.hits.length === 1);
  assert.equal(g.hits[0].target, blocked); assert.equal(blocked.blockedBy, g.u);
  assert.equal(g.hits.some(h => h.target === other), false);
});

test('uncapped fast and slow animation clocks scale the original event and loop duration', () => {
  for (const [aspd, speed] of [[200, 3], [-50, .5]]) {
    const f = make({ skill: 1 }); enemy(f); f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
    near(p.speed, speed); near(p.releaseAt - p.startedAt, .667 / speed);
    near(p.readyAt - p.startedAt, (.667 + 1.2) / speed);
    until(f, () => f.hits.length === 1);
  }
});

test('each S2 rank preserves its initial ammo, Begin, ATK/DEF, last boosted shot and one completion debit', () => {
  for (const elite of [1, 2]) for (let rank = 1; rank <= [4, 7, 10][elite]; rank++) {
    const f = make({ elite, rank }); cast(f);
    const baseAtk = f.u.base.atk, ammo = f.record.bb['attack@trigger_time'];
    near(f.u.s.atk, baseAtk * (1 + f.record.bb.atk));
    near(f.u.s.def, f.u.base.def * (1 + f.record.bb.def));
    assert.equal(f.u.skill.ammoLeft, ammo); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
    const t = enemy(f); advance(f, .5); assert.equal(f.attacks.length, 0);
    until(f, () => f.b.projectiles.list.length === 1);
    assert.equal(f.u.skill.ammoLeft, ammo); assert.equal(f.ammo.length, 0);
    assert.equal(f.b.projectiles.list[0].data.projectileKey, 'projectile_chr_rmixer_sk2');
    f.u.skill.ammoLeft = 1;
    until(f, () => f.hits.length === 1);
    near(f.hits[0].hpLoss, baseAtk * (1 + f.record.bb.atk));
    assert.equal(f.hits[0].target, t); assert.equal(f.hits[0].dmg.isSkill, true);
    until(f, () => !f.u.skill.active);
    assert.equal(f.u.skill.ammoLeft, 0); assert.equal(f.ammo.length, 1);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_End'); near(f.u.s.atk, baseAtk);
    assert.ok(f.ammo[0].time >= f.hits[0].time);
    until(f, () => f.hits.length === 2); assert.equal(f.hits[1].dmg.isSkill, false);
  }
});

test('S2 waits for long projectile flight and cannot overlap shots or spend twice', () => {
  const f = make(); cast(f); const t = enemy(f);
  until(f, () => f.b.projectiles.list.length === 1);
  const p = f.controller.phase, ammo = f.u.skill.ammoLeft;
  t.x = 15; t.y = 5;
  f.b.projectiles.list[0].speed = .5; // isolate invalidation from the native default flight speed
  advance(f, 3);
  assert.equal(f.u.mem.regularFormVisual.idle, 'Skill_2_Idle');
  assert.equal(f.controller.phase, p); assert.equal(f.attacks.length, 1);
  assert.equal(f.u.skill.ammoLeft, ammo); assert.equal(f.ammo.length, 0);
  until(f, () => f.ammo.length === 1, 8);
  assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.ammoLeft, ammo - 1);
  advance(f, 2); assert.equal(f.ammo.length, 1);
});

test('dead, hidden, redeployed or externally removed projectile inputs finish S2 without stale damage', () => {
  for (const kind of ['dead', 'hidden', 'newLife', 'removed']) {
    const f = make(); cast(f); const t = enemy(f);
    until(f, () => f.b.projectiles.list.length === 1); const ammo = f.u.skill.ammoLeft;
    if (kind === 'dead') f.b.kill(t, null);
    if (kind === 'hidden') t.hidden = true;
    if (kind === 'newLife') t.deploySeq++;
    if (kind === 'removed') f.b.removeProjectiles(p => p.source === f.u);
    until(f, () => f.ammo.length === 1);
    assert.equal(f.hits.length, 0); assert.equal(f.u.skill.ammoLeft, ammo - 1);
    assert.equal(f.controller.flights.size, 0);
  }
});

test('transient control cancels an unfired windup and cannot create a free accepted S2 shot', () => {
  const f = make({ skill: 1 }); enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack'); advance(f, .2);
  f.b.applyStatus(f.u, 'stun', { duration: f.b.dt }); advance(f, .1);
  assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
  until(f, () => f.hits.length === 1);
  const g = make(); cast(g); enemy(g);
  until(g, () => g.b.projectiles.list.length === 1); const ammo = g.u.skill.ammoLeft;
  g.b.applyStatus(g.u, 'stun', { duration: 2 });
  until(g, () => g.ammo.length === 1);
  assert.equal(g.hits.length, 1); assert.equal(g.u.skill.ammoLeft, ammo - 1);
});

test('manual cancellation cannot debit a later activation or erase already born shots', () => {
  const f = make(); cast(f); enemy(f);
  until(f, () => f.b.projectiles.list.length === 1);
  // Diagnostic bench binding exercises the real cancel command; it does not
  // add this incomplete operator to the public registry or default roster.
  f.b.bench[ID] = { unit: f.u };
  assert.equal(f.u.skill.spec.manualCancel, true);
  assert.equal(f.b.activateOperator(ID), true); near(f.u.s.atk, f.u.base.atk);
  until(f, () => f.hits.length === 1); near(f.hits[0].hpLoss, f.u.base.atk);
  advance(f, 2); assert.equal(f.ammo.length, 0);
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('manual'), true);
  const ammo = f.u.skill.ammoLeft; advance(f, .5); assert.equal(f.u.skill.ammoLeft, ammo);
});

test('fatal-hit ammo exhaustion before impact ends S2 while retaining the current post-skill shot', () => {
  const f = make(); cast(f); enemy(f);
  until(f, () => f.b.projectiles.list.length === 1);
  f.u.skill.ammoLeft = 19; const hp = f.u.hp;
  f.b.dealDamage(null, f.u, { amount: 1e9, type: 'true' });
  near(f.u.hp, hp); assert.equal(f.u.skill.active, false);
  until(f, () => f.hits.length === 1); near(f.hits[0].hpLoss, f.u.base.atk);
  advance(f, 2); assert.equal(f.ammo.length, 0); assert.equal(f.u.alive, true);
});

test('projectiles outlive their retired owner using final ATK, never a later deployment life', () => {
  for (const kind of ['retreat', 'death']) {
    const f = make(); cast(f); enemy(f);
    until(f, () => f.b.projectiles.list.length === 1);
    const atk = f.u.s.atk;
    if (kind === 'retreat') f.b.retreat(f.u); else f.b.kill(f.u, null);
    assert.equal(f.controller.stopped, true);
    f.u.base.atk = 9999; f.u.markDirty(); f.u.deploySeq++;
    until(f, () => f.hits.length === 1); near(f.hits[0].hpLoss, atk);
    assert.equal(f.ammo.length, 0); assert.equal(f.controller.handles.length, 0);
    assert.equal(f.resources.stopped, true); assert.equal(f.controller.flights.size, 0);
  }
});

test('real attack completions restart the idle barrier timer, with existing barriers retained', () => {
  const f = make({ skill: 1 }); enemy(f); advance(f, 12);
  assert.equal(f.resources.barrier, null); assert.ok(f.resources.completed.size > 1);
  for (const t of f.b.enemies) f.b.kill(t, null);
  advance(f, 9); assert.ok(f.resources.barrier); const shield = f.resources.barrier.shield;
  enemy(f); advance(f, 4); near(f.resources.barrier.shield, shield);
});

test('battle end retires future shots, resource callbacks and completion obligations', () => {
  const f = make(); cast(f); enemy(f);
  until(f, () => f.b.projectiles.list.length === 1);
  f.b.forceEnd('fixture');
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.completions.size, 0);
  assert.equal(f.controller.handles.length, 0); assert.equal(f.resources.stopped, true);
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.hits.length, 0);
});

test('source-permitted S2 activation during birth replaces Start with Begin without an early shot', () => {
  const f = make(); enemy(f); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.controller.phase.kind, 'born');
  assert.equal(f.u.skill.activate('manual'), true);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  advance(f, .5); assert.equal(f.attacks.length, 0);
  until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].dmg.isSkill, true);
});

test('beforeAttack cancellation or source retirement cannot birth a shot or debit ammunition', () => {
  for (const kind of ['targets', 'retreat', 'cancelSkill']) {
    const f = make(); cast(f); enemy(f);
    let invoked = false;
    f.b.on('beforeAttack', ctx => {
      if (ctx.attacker !== f.u) return;
      invoked = true;
      if (kind === 'targets') ctx.targets = [];
      else if (kind === 'retreat') f.b.retreat(f.u);
      else f.u.skill.end('manual');
    });
    until(f, () => invoked); advance(f, .1);
    assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.hits.length, 0);
    assert.equal(f.ammo.length, 0);
  }
});
