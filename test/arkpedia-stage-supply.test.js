// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { applyStageEnemyBlackboard, stageEnemyTokenDependencies } from '../shared/arkpedia/stage-enemy-talents.js';
import { stunTokenNativeReviewed } from '../shared/arkpedia/stage-supply-tokens.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const c = await loadContentContext(), plan = await planStage(c, 'mn-2');
function setup() {
  assert.deepEqual(plan.blockers, []);
  const stage = structuredClone(plan.stage), supply = stage.enemies.enemy_1105_tyokai;
  stage.enemies.enemy_1105_tyokai_2 = applyStageEnemyBlackboard(c.records.enemies.enemy_1105_tyokai_2.levels[0], {
    level: 0, blackboard: [{ key: 'loot.token_key', value: 0, valueStr: 'trap_018_bomb' }, { key: 'loot.cnt', value: 5 }] });
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  return { b, advance, stage, supply };
}

test('both Sponsor Drones deliver the original stage stock once after death, without kill-counter credit; leaks grant nothing', () => {
  const { b, advance } = setup(); const initial = b.total;
  for (const id of ['enemy_1105_tyokai', 'enemy_1105_tyokai_2']) {
    const e = b.spawnEnemy(id, { pos: [2, 3] }); assert.equal(e.counted, false); b.kill(e); b.kill(e);
  }
  assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 0); assert.equal(b.killed, 0); assert.equal(b.total, initial);
  advance(.9); assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 0);
  advance(.2); assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 8);
  const leaked = b.spawnEnemy('enemy_1105_tyokai', { pos: [2, 3] }); b.leak(leaked); advance(2);
  assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 8); assert.deepEqual(b.errors, []);
});

test('Mr. Boom consumes stock and DP, samples the plus-shaped ground/air area at release and uses shared status immunity/resistance', () => {
  const { b, advance } = setup(); b.grantStageToken('trap_018_bomb', 3);
  const spawn = (key, r, col) => { const e = b.spawnEnemy(key, { pos: [r, col] }); b.addBuff(e, { key: 'hold', flags: { noMove: true, disarm: true } }); return e; };
  const ground = spawn('enemy_1099_nbkght', 2, 2), air = spawn('enemy_1105_tyokai', 2, 4);
  const diagonal = spawn('enemy_1099_nbkght', 3, 4), immune = spawn('enemy_1099_nbkght', 3, 3);
  b.applyStatus(air, 'resist', { duration: 60 }); immune.def = { ...immune.def, immune: new Set(['stun']) };
  const beforeDp = b.getPlayer('arkpedia').dp, token = b.deployToken('trap_018_bomb', 2, 3);
  assert.equal(token.obstacle, false); assert.equal(token.deploymentSlotCost, 0);
  assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 2); assert.equal(b.getPlayer('arkpedia').dp, beforeDp - 5);
  assert.throws(() => b.deployToken('trap_018_bomb', 4, 3), /recharging|already deployed/);
  advance(1.9); assert.equal(ground.s.flags.stun, false); advance(.2);
  assert.equal(token.alive, false); assert.equal(ground.s.flags.stun, true); assert.equal(air.s.flags.stun, true);
  assert.equal(diagonal.s.flags.stun, false); assert.equal(immune.s.flags.stun, false);
  assert.equal(ground.findBuff('stun').duration, 12); assert.equal(air.findBuff('stun').duration, 6);
  assert.throws(() => b.deployToken('trap_018_bomb', 4, 3), /recharging/);
  advance(5); assert.ok(b.deployToken('trap_018_bomb', 3, 3)); // Deployable fence does not need to be walkable.
  assert.deepEqual(b.errors, []);
});

test('supply admission requires explicit original reward parameters and supported cards', async () => {
  const record = c.records.enemies.enemy_1105_tyokai.levels[0];
  assert.throws(() => stageEnemyTokenDependencies(record), /Missing original/);
  for (const bb of [[{ key: 'loot.cnt', value: -1 }], [{ key: 'loot.token_key', value: 0, valueStr: 'char_123_fang' }]])
    assert.throws(() => applyStageEnemyBlackboard(record, { level: 0, blackboard: bb }), /Unsupported injected/);
  assert.equal(plan.stage.tokens[0].count, 0); assert.ok(plan.dependencies.tokens.includes('trap_018_bomb'));
  assert.equal(record.talents.bb['loot.cnt'], undefined);
  const coils = await planStage(c, 'mn-3');
  assert.deepEqual(coils.blockers, []);
  assert.equal(coils.stage.tokens[0].behavior, 'electric-coil');
});

test('source gates reject changed drop lifetime and stun-token targeting', () => {
  const changed = structuredClone(native), p = changed.projectiles.projectile_enemy_tyokai.find(r => r.originalJson.includes('"_lifeTime"'));
  p.originalJson = p.originalJson.replace('"_lifeTime":1', '"_lifeTime":10');
  assert.equal(enemySupport(c.records.enemies.enemy_1105_tyokai, clock.prefabs, changed).policy, null);
  const device = structuredClone(deviceNative);
  device.prefabs.trap_018_bomb.components.find(c => '_targetMotion' in c.data).data._targetMotion = 1;
  assert.equal(stunTokenNativeReviewed(device), false); assert.equal(stunTokenNativeReviewed(), true);
});

test('retreating a supplied bomb cancels its release without refunding stock or DP', () => {
  const { b, advance } = setup(); b.grantStageToken('trap_018_bomb', 2);
  const target = b.spawnEnemy('enemy_1099_nbkght', { pos: [2, 2] });
  b.addBuff(target, { key: 'hold', flags: { noMove: true } });
  const token = b.deployToken('trap_018_bomb', 2, 3), dp = b.getPlayer('arkpedia').dp;
  b.retreatStageToken(token.mem.stageSupplyId);
  assert.equal(b.mvpStageTokens.get('trap_018_bomb'), 1); assert.equal(b.getPlayer('arkpedia').dp, dp);
  advance(3); assert.equal(target.s.flags.stun, false); assert.equal(token.removed, true);
  assert.deepEqual(b.errors, []);
});

test('original supply-card instances retain zero stock and reject hidden, changed or missing records', async () => {
  const { validateStageSupplyCards } = await import('../tools/arkpedia/stage-supply-cards.mjs');
  const card = plan.stage.geometry.suppliedUnits.deployable_tokens[0];
  const original = { hidden: false, initialCnt: 0, inst: { characterKey: card.unit_id, level: 1, phase: 'PHASE_0', favorPoint: 0, potentialRank: 0 },
    skillIndex: 0, mainSkillLvl: 1 };
  assert.doesNotThrow(() => validateStageSupplyCards([card], { predefines: { tokenCards: [original] } }));
  for (const change of [{ hidden: true }, { initialCnt: 1 }, { overrideSkillBlackboard: [] }, { skillIndex: 1 }])
    assert.throws(() => validateStageSupplyCards([card], { predefines: { tokenCards: [{ ...original, ...change }] } }), /override/);
  assert.throws(() => validateStageSupplyCards([card], {}), /Missing/);
});
