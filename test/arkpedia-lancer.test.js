// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };

function fixture(id, { record = ENEMY_RECORDS.enemies[id].levels[0], wait = 60, timeLimit = 90 } = {}) {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'lancer_wall', profession: 'TANK', stats: { maxHp: 100000, atk: 0, def: 100 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [id]: record } },
    units: [{ chessId: guard.chessId, row: 9, col: 3 }], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const wall = b.allyUnits[0];
  b.addBuff(wall, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  const e = b.spawnEnemy(id, { route: { motion: 'WALK', start: [9, 10], end: [9, 2],
    checkpoints: [{ type: 'WAIT', time: wait, pos: [9, 10] }] } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { h, b, e, wall, hits, charge: e.mem.ab.list.find(a => 'stacks' in a) };
}

for (const [id, coefficient] of [['enemy_1072_dlancer', 600], ['enemy_1072_dlancer_2', 800]]) {
  test(`${id}: 25 additive speed stacks accrue during an unblocked route wait; first hit adds separate speed damage`, () => {
    const { h, b, e, wall, hits, charge } = fixture(id), base = e.s.moveSpeed;
    h.run(.4); assert.equal(charge.stacks, 0);
    h.run(.1); assert.equal(charge.stacks, 1);
    b.applyStatus(e, 'silence', { duration: 30 }); h.run(13);
    assert.equal(e.moving, false); assert.equal(charge.stacks, 25);
    assert.equal(e.s.moveSpeed, base * 13.5);
    // The bonus follows current speed (including slows), independently of ATK.
    b.applyStatus(e, 'slow', { duration: 10, value: .5 });
    e.base.atk *= 3; e.markDirty(); const speed = e.s.moveSpeed, atk = e.s.atk;
    e.x = wall.x + .2; e.y = wall.y; assert.ok(b._checkBlock(e)); h.run(.1);
    const extra = hits.filter(c => c.dmg.tags.includes('lancerCharge'));
    const ordinary = hits.filter(c => !c.dmg.tags.includes('lancerCharge'));
    assert.equal(extra.length, 1); assert.equal(ordinary.length, 1);
    assert.ok(Math.abs(extra[0].hpLoss - (speed * coefficient - wall.s.def)) < 1e-6);
    assert.equal(extra[0].dmg.noSp, true); assert.equal(extra[0].dmg.applyWay, 'melee');
    assert.equal(ordinary[0].hpLoss, atk - wall.s.def);
    assert.equal(charge.stacks, 0); assert.equal(e.s.moveSpeed, base * .5);
    e.atkCd = 0; h.run(.1);
    assert.equal(hits.filter(c => c.dmg.tags.includes('lancerCharge')).length, 1);
    assert.deepEqual(b.errors, []);
  });
}

test('stun and bind reset acceleration; release restarts from zero, while Freeze alone is a distinct source flag', () => {
  const { h, b, e, charge } = fixture('enemy_1072_dlancer');
  h.run(2); assert.equal(charge.stacks, 4);
  b.applyStatus(e, 'stun', { duration: 1 }); h.run(.2); assert.equal(charge.stacks, 0);
  h.run(.5); assert.equal(charge.stacks, 0); h.run(1); assert.ok(charge.stacks > 0);
  b.applyStatus(e, 'bind', { duration: 1 }); h.run(.2); assert.equal(charge.stacks, 0);
  h.run(1.5); assert.ok(charge.stacks > 0);
  const before = charge.stacks; b.applyStatus(e, 'freeze', { duration: 2 }); h.run(1);
  assert.ok(charge.stacks > before); assert.deepEqual(b.errors, []);
});

test('changed Lancer triggers and damage formulas remain unsupported', () => {
  for (const edit of [
    n => n.templates.dlancer_t_atk.eventToActions.ON_BUFF_FINISH[1]._attributeType = 'ATK',
    n => n.templates['dlancer_t_listener[a]'].eventToActions.ON_BUFF_TRIGGER[0]._abnormalFlag = 'SILENCED',
    n => n.templates['dlancer_t[trigger]'].eventToActions.ON_BUFF_TRIGGER[2]._buff.attributes.attributeModifiers[0].formulaItem = 'ADDITION',
  ]) {
    const changed = structuredClone(evidence); edit(changed);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1072_dlancer, index.prefabs, changed).policy, null);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1072_dlancer, index.prefabs, {}).policy, null);
});


test('DM-EX-3 original birth predelay consumes 340 suppressed attempts before 25 speed additions', async () => {
  const context = await loadContentContext(), id = 'enemy_1072_dlancer_2';
  for (const stage of ['dm-ex-3', 'dm-ex-3_challenge_mode']) {
    const p = await planStage(context, stage, { waves: true }); assert.deepEqual(p.blockers, []);
    const record = p.stage.enemies[id];
    assert.equal(record.talents.bb['rush.dlancer_t_predelay.predelay'], 170);
    assert.equal(record.talents.bb['rush.dlancer_t[trigger].trig_cnt'], 365);
    const { h, b, e, wall, hits, charge } = fixture(id, { record, wait: 300, timeLimit: 300 }), base = e.s.moveSpeed;
    h.run(170); assert.equal(charge.stacks, 0); assert.equal(e.s.moveSpeed, base);
    assert.equal(charge.triggers, 340);
    h.run(.5); assert.equal(charge.stacks, 1);
    h.run(12); assert.equal(charge.stacks, 25); assert.equal(charge.triggers, 365);
    h.run(2); assert.equal(charge.stacks, 25); assert.equal(e.s.moveSpeed, base * 13.5);
    const coefficient = stage.endsWith('challenge_mode') ? 960 : 800, speed = e.s.moveSpeed;
    assert.equal(record.talents.bb['firstattack.atk_scale'], coefficient);
    e.x = wall.x + .2; e.y = wall.y; assert.ok(b._checkBlock(e)); h.run(.1);
    const bonus = hits.filter(c => c.dmg.tags.includes('lancerCharge'));
    assert.equal(bonus.length, 1); assert.ok(Math.abs(bonus[0].hpLoss - (speed * coefficient - wall.s.def)) < 1e-6);
    assert.deepEqual(b.errors, []);
  }
  assert.equal(ENEMY_RECORDS.enemies[id].levels[0].talents.bb['rush.dlancer_t[trigger].trig_cnt'], 25);
  assert.equal(ENEMY_RECORDS.enemies[id].levels[0].talents.bb['rush.dlancer_t_predelay.predelay'], undefined);
});

test('birth predelay keeps advancing through control and is not recreated after charge reset', () => {
  const id = 'enemy_1072_dlancer', record = applyStageEnemyBlackboard(ENEMY_RECORDS.enemies[id].levels[0], {
    level: 0, blackboard: [{ key: 'rush.dlancer_t_predelay.predelay', value: 2 }],
  });
  const { h, b, e, charge } = fixture(id, { record });
  b.applyStatus(e, 'stun', { duration: 3 }); h.run(3.8);
  assert.ok(charge.stacks > 0, 'birth delay expired while stunned');
  const readyAt = charge.readyAt;
  b.applyStatus(e, 'bind', { duration: 1 }); h.run(.2); assert.equal(charge.stacks, 0);
  h.run(1.5); assert.ok(charge.stacks > 0); assert.equal(charge.readyAt, readyAt);
  assert.deepEqual(b.errors, []);
});

test('stage Lancer delay and trigger budget reject invalid values and unrelated parameters', () => {
  const r = ENEMY_RECORDS.enemies.enemy_1072_dlancer.levels[0];
  for (const [key, values] of [['rush.dlancer_t_predelay.predelay', [-1, Infinity, NaN]],
    ['rush.dlancer_t[trigger].trig_cnt', [-1, 0, 1.5, Infinity]]])
    for (const value of values) assert.throws(() => applyStageEnemyBlackboard(r, { level: 0, blackboard: [{ key, value }] }), /enemy parameter/);
  assert.throws(() => applyStageEnemyBlackboard(r, { level: 0, blackboard: [{ key: 'rush.dlancer_t[trigger].move_speed', value: 9 }] }), /enemy parameter/);
});
