// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageGramophones } from '../server/sim/content/arkpedia-stage-gramophones.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1511_mdrock', shield = e => e.buffs.reduce((n, x) => n + x.shield, 0);
function fixture(level = 0, block = false) {
  const record = ENEMY_RECORDS.enemies[ID].levels[level];
  const op = chessRec({ id: 'mudrock_blocker', stats: { maxHp: 100000, atk: 0, def: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 180, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [ID]: record }, chess: { [op.chessId]: op } },
    units: block ? [{ chessId: op.chessId, row: 9, col: 6 }] : [] });
  const b = h.b; b.start(); const e = b.spawnEnemy(ID, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:stationary', flags: { noMove: true } });
  return { h, b, e, record };
}
test('Mudrock levels restore three Arts-only layers on the original refresh release without stacking HP bonuses', () => {
  for (const level of [0, 1]) {
    const { h, b, e, record } = fixture(level), total = record.skills[0].bb.dynamic * 3, cd = record.skills[0].cooldown;
    assert.equal(shield(e), total); assert.equal(e.s.maxHp, record.stats.maxHp * 1.5);
    b.dealDamage(null, e, { amount: 1000, type: 'true' }); const ratio = e.hp / e.s.maxHp;
    b.dealDamage(null, e, { amount: total / .7, type: 'arts' });
    assert.equal(shield(e), 0); assert.equal(e.s.maxHp, record.stats.maxHp);
    h.run(cd + .7); assert.equal(shield(e), 0); h.run(.1); assert.equal(shield(e), total);
    assert.equal(e.s.maxHp, record.stats.maxHp * 1.5); assert.ok(Math.abs(e.hp / e.s.maxHp - ratio) < 1e-9);
    b.dealDamage(null, e, { amount: 1000, type: 'arts' }); assert.equal(shield(e), total - 700);
    h.run(cd); assert.equal(shield(e), total); assert.equal(e.s.aspd, record.stats.aspd + 50);
    assert.deepEqual(b.errors, []);
  }
});
test('Mudrock gains 60% ATK before each actual strike, caps at six stacks, and keeps stacks during silence', () => {
  const { h, b, e, record } = fixture(0, true), hits = [];
  b.on('hit', c => { if (c.source === e) hits.push(c.dmg.amount); });
  h.run(27); assert.ok(hits.length >= 7);
  for (let i = 0; i < 7; i++) assert.ok(Math.abs(hits[i] - record.stats.atk * (1 + .6 * Math.min(i + 1, 6))) < 1e-6);
  b.applyStatus(e, 'silence', { duration: 2, force: true }); assert.equal(e.findBuff('ab:mudrockCharge').stacks, 6);
  assert.deepEqual(b.errors, []);
});
test('Mudrock globally captures the nearest non-enemy Gramophone at Skill_1 release and preserves faction', () => {
  const { h, b, e } = fixture();
  b.stageGramophones = new StageGramophones(b, [2, 10].map(col => ({ name: "L-44 'Gramophone'", key: 'trap_014_tower',
    kind: 'device', hidden: false, row: 12, col, instance: { level: 1, skillLevel: 3 } })));
  const [a, z] = b.stageGramophones.entries.values(); b.stageGramophones.tick(.1);
  // Equal distance uses original deployment order; the search spans the whole map.
  h.run(35.8); assert.equal(a.control, 'ally'); h.run(.8); assert.equal(a.control, 'enemy');
  assert.equal(a.sp, 0); assert.equal(z.control, 'ally'); assert.equal(a.unit.side, 'enemy');
  h.run(35); assert.equal(z.control, 'enemy'); assert.deepEqual(b.errors, []);
});
test('Mudrock is sleep-immune, gains stun immunity during casts, and cleans up after freeze interruption', () => {
  const { h, b, e } = fixture(); assert.equal(b.applyStatus(e, 'sleep', { duration: 10 }), false);
  assert.equal(b.applyStatus(e, 'stun', { duration: .1 }), true); h.run(17.1);
  assert.equal(e.profile.noAttack, true); assert.equal(e.s.flags.noDisplace, true);
  assert.equal(b.applyStatus(e, 'stun', { duration: 10 }), false);
  assert.equal(b.applyStatus(e, 'freeze', { duration: .1 }), true); h.run(.2);
  assert.equal(e.profile.noAttack, false); assert.equal(e.findBuff('ab:timedCast'), null); assert.deepEqual(b.errors, []);
});
test('Mudrock admission rejects altered stack caps, cast immunity, and barrier damage masks', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, native).policy);
  for (const change of ['stack', 'immune', 'barrier']) {
    const n = structuredClone(native);
    if (change === 'stack') n.templates.enemy_mdrock_s_1.eventToActions.ON_BUFF_START[0]._buff.maxStackCnt = 7;
    if (change === 'barrier') n.templates['enemy_mdrock_s_2[shield_normal]'].eventToActions.ON_TAKE_DAMAGE[0]._damageMask = 'PHYSICAL';
    if (change === 'immune') for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`]) {
      const d = JSON.parse(row.originalJson); if (d._buffs?.[1]?.buffKey === 'mdrock_c[stunned_immune]') d._buffs.pop();
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, n).policy, null, change);
  }
});
