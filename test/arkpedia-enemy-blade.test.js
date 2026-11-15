// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
const IDS = ['enemy_1104_lfkght', 'enemy_1104_lfkght_2', 'enemy_1104_lfkght_3'], KEY = 'lfkght_s[weaken]';
function fixture(id = IDS[0]) {
  const guard = chessRec({ id: 'blade-target', stats: { maxHp: 1e7, atk: 100, def: 100, res: 20 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [guard.chessId]: guard }, enemies: Object.fromEntries(IDS.map(k => [k, structuredClone(records.enemies[k].levels[0])])) },
    units: [[9, 3], [10, 5], [10, 7]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); const targets = b.allyUnits;
  for (const u of targets) b.addBuff(u, { key: 'test:hold', flags: { disarm: true, noBlock: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.addBuff(e, { key: 'test:stationary', flags: { noMove: true } });
  const a = e.mem.ab.list.find(a => a.cancel); return { h, b, e, a, targets };
}
test('all three Blade Helmet records require exact native target, modifier, rebirth and animation contracts', () => {
  for (const id of IDS) assert.ok(enemySupport(records.enemies[id], clocks.prefabs, native).policy);
  for (const edit of [d => { if (d._postFilter === 17) d._postFilter = 4; },
    d => { if ('_hpRechargeRatio' in d) d._hpRechargeRatio = 1; },
    d => { if (d._activeBuffs?.[0]?.buffKey === KEY) d._activeBuffs[0].attributes.attributeModifiers[0].formulaItem = 1; }]) {
    const changed = structuredClone(native);
    for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${IDS[0]}.prefab`]) {
      const d = JSON.parse(row.originalJson); edit(d); row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(records.enemies[IDS[0]], clocks.prefabs, changed).policy, null);
  }
});
test('global highest current ATK is sampled at release, excluding existing weakening from any source', () => {
  const { h, b, e, a, targets: [first, second, third] } = fixture();
  b.addBuff(first, { key: 'test:atk', mods: { atkPct: 1 } });
  a.left = 0; h.step(1); assert.ok(a.cast); assert.equal(first.findBuff(KEY), null);
  b.addBuff(second, { key: 'test:atk', mods: { atkPct: 3 } });
  h.run(.35); assert.equal(second.findBuff(KEY), null);
  assert.ok(h.runUntil(() => second.findBuff(KEY), .1)); assert.equal(second.s.atk, 200);
  assert.equal(first.findBuff(KEY), null); assert.equal(third.findBuff(KEY), null);
  h.run(1.2); a.left = 0; h.run(.5); assert.ok(first.findBuff(KEY)); assert.equal(first.s.atk, 100);
  assert.equal(second.s.atk, 200); assert.equal(e.stats.attacks, 0); assert.deepEqual(b.errors, []);
});
test('weakening respects targetability, persists after caster death and lasts 25 seconds even with Resist', () => {
  const { h, b, e, a, targets: [hidden, target] } = fixture();
  b.addBuff(hidden, { key: 'test:hidden', mods: { atkPct: 10 }, flags: { camou: true } });
  b.addBuff(target, { key: 'test:atk', mods: { atkPct: 2 } }); b.applyStatus(target, 'resist', { duration: 60 });
  a.left = 0; assert.ok(h.runUntil(() => target.findBuff(KEY), 1));
  assert.equal(target.s.atk, 150); assert.equal(hidden.findBuff(KEY), null);
  b.kill(e); h.run(5.1); b.kill(e); assert.equal(e.alive, false);
  h.run(19); assert.ok(target.findBuff(KEY)); h.run(1); assert.equal(target.findBuff(KEY), null);
  assert.equal(target.s.atk, 300); assert.deepEqual(b.errors, []);
});
test('stun and Silence interrupt before release; Slow Down scales the cast rather than its cooldown', () => {
  for (const status of ['stun', 'silence']) {
    const { h, b, e, a, targets } = fixture(); a.left = 0; h.step(1); assert.ok(a.cast);
    b.applyStatus(e, status, { duration: 3 }); h.run(.6);
    assert.equal(a.cast, null); assert.ok(targets.every(t => !t.findBuff(KEY))); assert.deepEqual(b.errors, []);
  }
  const { h, b, e, a, targets } = fixture(); b.addBuff(e, { key: 'test:slow', mods: { slowDownMul: .5 } });
  a.left = 0; h.step(1); h.run(.6); assert.ok(targets.every(t => !t.findBuff(KEY)));
  h.run(.3); assert.ok(targets.some(t => t.findBuff(KEY))); assert.ok(a.left < 24.2 && a.left > 24);
});
test('one five-second rebirth restores 20% HP and resets the skill to its initial cooldown', () => {
  for (const id of IDS) {
    const { h, b, e, a } = fixture(id); a.left = 0; h.step(1); assert.ok(a.cast);
    b.kill(e); assert.ok(e.alive); assert.equal(a.cast, null); assert.equal(e.hp, 1);
    h.run(4.8); assert.equal(e.hp, 1); assert.ok(e.s.flags.untargetable);
    h.run(.3); assert.ok(Math.abs(e.hp - e.s.maxHp * Math.fround(.2)) < .001);
    assert.equal(e.profile.noAttack, false); assert.ok(a.left <= a.icd && a.left >= a.icd - .2);
    b.kill(e); assert.equal(e.alive, false); assert.deepEqual(b.errors, []);
  }
});
test('ordinary attacks are direct Arts and exclude airborne targets', () => {
  const { h, b, e, a, targets: [ground, air] } = fixture();
  assert.equal(e.def.attackAnim.dur, 2 / Math.fround(1.4));
  ground.x = 8; ground.y = 9; ground.tileC = 8; ground.tileR = 9;
  air.x = 9; air.y = 9; air.tileC = 9; air.tileR = 9; air.motion = 'FLY';
  a.left = 100; assert.ok(h.runUntil(() => e.stats.attacks > 0, 5));
  assert.equal(ground.stats.taken, e.s.atk * .8); assert.equal(air.stats.taken, 0);
  assert.equal(b.projectiles.list.length, 0); assert.deepEqual(b.errors, []);
});

test('Tytus uses the shared debuff and rebirth controller with his ten-second skill clock', () => {
  const { h, b, a, targets } = fixture('enemy_1104_lfkght_3');
  assert.equal(a.cd, 10); assert.equal(a.icd, 10);
  h.run(9.9); assert.ok(targets.every(u => !u.findBuff(KEY)));
  h.run(.2); assert.ok(a.cast); h.run(.5);
  assert.equal(targets.filter(u => u.findBuff(KEY)).length, 1); assert.deepEqual(b.errors, []);
});
