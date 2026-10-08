// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

function make({ predicate = true, custom = true } = {}) {
  const source = structuredClone(data), ids = ['char_120_hibisc', 'char_123_fang', 'char_122_beagle'];
  source.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(source, { operators: ids.map(id => defaultBuild(source.operators[id])) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(ids[0], 1, 4, 'RIGHT');
  const t = b.deployOperator(ids[1], 2, 5, 'RIGHT');
  const foreign = b.deployOperator(ids[2], 2, 6, 'RIGHT');
  for (const a of [u, t, foreign]) a.atkCd = 1000;
  for (const a of [t, foreign]) {
    a.hp = 1; a.ownerUnit = a === t ? u : foreign;
    b.addBuff(a, { key: 'owned-heal-fixture', flags: {
      healFree: true, ...(!custom ? { noHeal: true } : {}),
    } });
  }
  u.profile = { ...u.profile, windup: .2, healProjectileSpeed: 0,
    ...(custom ? { acquireTargets: () => [t, foreign] } : { acquireTargets: null }),
    heal: { mode: 'single', ...(predicate === false ? {} : {
      ignoreHealFree: (_b, owner, target) => target.ownerUnit === owner ? predicate : false,
    }) },
  };
  const advance = seconds => {
    for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
    assert.deepEqual(b.errors, []);
  };
  const shot = target => { b.forceAttack(u, [target]); u.atkCd = 1000; advance(.4); };
  return { b, u, t, foreign, advance, shot };
}

test('ordinary and custom healing retain heal-free rejection without an explicit recipient exception', () => {
  for (const custom of [false, true]) {
    const { u, t, foreign, b, shot } = make({ custom, predicate: false });
    assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []);
    shot(t); shot(foreign);
    assert.equal(t.hp, 1); assert.equal(foreign.hp, 1);
  }
});

test('strict owned recipient opt-in heals only that recipient, including forced foreign targeting', () => {
  const { b, u, t, foreign, shot } = make();
  assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), [t]);
  shot(t); assert.equal(t.hp, 1 + u.s.atk);
  shot(foreign); assert.equal(foreign.hp, 1);
});

test('truthy values cannot enable the heal-free exception', () => {
  for (const predicate of [1, 'yes', {}]) {
    const { b, u, t, shot } = make({ predicate });
    assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []);
    shot(t); assert.equal(t.hp, 1);
  }
});

test('owned exception does not relax independent no-heal, isolation or target-free selection', () => {
  for (const flag of ['noHeal', 'isolated', 'untargetable']) {
    const { b, u, t } = make();
    b.addBuff(t, { key: 'separate-denial', flags: { [flag]: true } });
    assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []);
  }
  const { b, u, t, shot } = make();
  t.profile.noHeal = true;
  assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []);
  shot(t); assert.equal(t.hp, 1);
});

test('owned exception is reevaluated after windup and after a launched healing projectile', () => {
  for (const inFlight of [false, true]) {
    const { b, u, t, foreign, advance } = make();
    if (inFlight) u.profile.healProjectileSpeed = 2;
    b.forceAttack(u, [t]); u.atkCd = 1000;
    advance(inFlight ? .25 : .1);
    t.ownerUnit = foreign;
    advance(1.5);
    assert.equal(t.hp, 1);
  }
});

test('a new no-heal prohibition also wins when it appears after selection', () => {
  const { b, u, t, advance } = make();
  b.forceAttack(u, [t]); u.atkCd = 1000; advance(.1);
  b.addBuff(t, { key: 'late-denial', flags: { noHeal: true } });
  advance(.4); assert.equal(t.hp, 1);
});
