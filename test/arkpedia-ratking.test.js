// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_1509_mousek';
function fixture(level = 0) {
  const record = ENEMY_RECORDS.enemies[id].levels[level];
  const units = [
    ['high', 100000, 10, 8], ['low', 10000, 10, 4], ['diagonal', 50000, 11, 7], ['air', 200000, 9, 8],
  ].map(([name, hp, row, col]) => ({ name, row, col, rec: chessRec({ id: `rat_${name}`, stats: { maxHp: hp, atk: 100, def: 0, res: 0 } }) }));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record }, chess: Object.fromEntries(units.map(u => [u.rec.chessId, u.rec])) },
    units: units.map(u => ({ chessId: u.rec.chessId, row: u.row, col: u.col })) });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [10, 2] });
  b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const named = Object.fromEntries(units.map(u => [u.name, b.allyUnits.find(x => x.defId === u.rec.chessId)]));
  named.air.motion = 'FLY'; named.air.ground = false;
  for (const u of Object.values(named)) u.profile.noAttack = true;
  return { h, b, e, ...named, record };
}
test('Rat King has three Arts-only layers, keeps DEF until the final break, and rejects native sleep', () => {
  for (const level of [0, 1]) {
    const { b, e, record } = fixture(level), amount = record.talents.bb['shield.dynamic'];
    b.addBuff(e, { key: 'zero-res', mods: { resFlat: -30 } });
    assert.equal(e.s.def, 3350); assert.equal(e.buffs.filter(x => x.shield > 0).length, 3);
    const initialHp = e.hp; b.dealDamage(null, e, { amount: 1000, type: 'true' });
    assert.equal(e.hp, initialHp - 1000); assert.equal(e.buffs.reduce((s, x) => s + x.shield, 0), amount * 3);
    b.dealDamage(null, e, { amount: amount * 2, type: 'arts' });
    assert.equal(e.hp, initialHp - 1000); assert.equal(e.s.def, 3350);
    assert.equal(e.buffs.reduce((s, x) => s + x.shield, 0), amount);
    b.dealDamage(null, e, { amount: amount + 100, type: 'arts' });
    assert.equal(e.hp, initialHp - 1100); assert.equal(e.s.def, 350);
    assert.equal(b.applyStatus(e, 'sleep', { duration: 5 }), false); assert.deepEqual(b.errors, []);
  }
});
test('marks track ground HP extrema; the global cross ignores blockers, reaches air and camouflage, and excludes diagonals', () => {
  const { h, b, e, high, low, diagonal, air } = fixture(), hits = [];
  h.run(1.1);
  assert.equal(high.buffs.find(x => x.data.ratKingMark)?.data.ratKingMark, 'highestHp');
  assert.equal(low.buffs.find(x => x.data.ratKingMark)?.data.ratKingMark, 'lowestHp');
  assert.equal(air.buffs.some(x => x.data.ratKingMark), false);
  b.addBuff(air, { key: 'camouflage', flags: { camou: true } });
  e.blockedBy = low; e.mem.ratKing.clocks = [0, 1000];
  b.on('calculatedDamage', c => { if (c.dmg.tags?.includes('ratKingCross')) hits.push(c); });
  h.run(2.1);
  assert.deepEqual(new Set(hits.map(c => c.target)), new Set([high, air]));
  assert.ok(hits.every(c => c.dmg.amount === 800 && c.dmg.noSp && c.dmg.applyWay === 'none'));
  assert.ok(!hits.some(c => c.target === diagonal)); assert.deepEqual(b.errors, []);
});
test('sand owns a fixed fifteen-second field, independent source lifetime, non-refreshing final ATK debuffs and air hits', () => {
  const { h, b, e, low, high, air } = fixture(), hits = [];
  // Move the flying unit into the low-HP target's box. It cannot become the anchor.
  air.x = low.x + 1; air.y = low.y + 1;
  e.mem.ratKing.clocks = [1000, 0];
  b.on('calculatedDamage', c => { if (c.dmg.tags?.includes('ratKingSand')) hits.push({ target: c.target, amount: c.dmg.amount, time: b.time }); });
  h.run(.8); const debuff = low.findBuff('ab:ratKingAtkDown');
  assert.ok(debuff); assert.ok(Math.abs(low.s.atk - 30) < 1e-6); assert.ok(air.findBuff('ab:ratKingAtkDown'));
  assert.equal(high.findBuff('ab:ratKingAtkDown'), null);
  const duration = debuff.timeLeft; h.run(2); assert.ok(debuff.timeLeft < duration - 1.9);
  // Its anchor moves away; the source dies. The already released field stays.
  low.x = 9; low.y = 12; b.kill(e); h.run(13.1);
  assert.equal(hits.filter(x => x.target === air).length, 15);
  assert.ok(hits.every(x => Number.isFinite(x.amount) && x.amount === 70));
  assert.equal(b.projectiles.list.some(p => p.data?.ratKingSand), false);
  assert.equal(low.findBuff('ab:ratKingAtkDown'), null); assert.deepEqual(b.errors, []);
});
test('low-HP damage is reversible, affects skill packets, and skill clocks honor source priorities and Slow Down', () => {
  const { h, b, e, high } = fixture(1), hits = [];
  e.hp = e.s.maxHp * .4;
  b.on('calculatedDamage', c => { if (c.dmg.tags?.includes('ratKingCross')) hits.push(c.dmg.amount); });
  // Elite order puts SandStorm first when both become ready.
  e.mem.ratKing.clocks = [0, 0]; h.run(.1); assert.equal(e.mem.regularFormVisual.clip, 'Skill_2');
  h.run(1.5); assert.equal(e.mem.regularFormVisual.clip, 'Skill_1');
  b.addBuff(e, { key: 'slow-cast', mods: { slowDownMul: .5 } }); h.run(2); assert.equal(hits.length, 0);
  h.run(2); assert.equal(hits[0], 2550);
  e.hp = e.s.maxHp; b.removeBuff(e, 'slow-cast');
  e.mem.ratKing.clocks = [1000, 0]; h.run(2.5);
  assert.equal(hits.at(-1), 1500); assert.ok(high.alive); assert.deepEqual(b.errors, []);
});
test('native contracts refuse changed selectors, barrier types, independent field lifetime and debuff refresh rules', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  for (const kind of ['selector', 'barrier', 'field', 'debuff']) {
    const n = structuredClone(native);
    if (kind === 'barrier') n.templates.mousek_shield.eventToActions.ON_TAKE_DAMAGE[0]._damageMask = 'ALL';
    if (kind === 'field') for (const row of n.projectiles.projectile_mousek_s2) {
      const d = JSON.parse(row.originalJson); if ('_lifeTime' in d) d._lifeTime = 30; row.originalJson = JSON.stringify(d);
    }
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (kind === 'selector' && '_postFilter' in d && [19, 20].includes(d._postFilter)) d._postFilter = 4;
      if (kind === 'debuff') for (const buff of d._activeBuffs ?? []) if (buff.buffKey === 'mousek_s_2[debuff]') buff.overrideType = 0;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, n).policy, null, kind);
  }
});
