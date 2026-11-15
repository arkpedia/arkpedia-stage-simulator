// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { workerNativeReviewed, workerDefinition } from '../shared/arkpedia/stage-workers.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), p = await planStage(c, 'ri-3');
assert.deepEqual(p.blockers, []);
function setup() {
  const stage = structuredClone(p.stage); stage.waves = []; stage.geometry.waves = [];
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: ['char_123_fang', 'char_124_kroos'].map(id => defaultBuild(c.mvp.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.getPlayer('arkpedia').dp = 99;
  b.grid.setTile(5, 3, { ...b.grid.tile(5, 3), build: 'MELEE', pass: 'ALL' });
  b.grid.setTile(4, 4, { ...b.grid.tile(4, 4), build: 'MELEE', pass: 'ALL' });
  const tree = b.allyUnits.find(u => u.tags.has('tree') && u.tileR === 5 && u.tileC === 4);
  assert.ok(tree); const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  return { b, tree, advance, deploy: (dir = 'UP') => b.deployToken('trap_016_peon', 4, 4, dir) };
}
test('worker native contract rejects changed target family, damage, delay and lifetime behavior', () => {
  assert.equal(workerNativeReviewed(), true);
  const instance = { level: 1, elite: 0, potential: 0, skill_index: -1, skill_level: 0 };
  assert.equal(workerDefinition(instance).duration, 9);
  assert.throws(() => workerDefinition({ ...instance, skill_index: 0 }), /Unsupported/);
  for (const mutate of [
    cs => cs.find(c => '_targetCategory' in c.data).data._filterTag = 'enemy',
    cs => cs.find(c => c.data._animKey === 'Attack').data._damageType = 2,
    cs => cs.find(c => c.data._animKey === 'Attack').data._preDelay = 0,
    cs => cs.find(c => c.data._buffs?.some(b => b.buffKey === 'trap_peon[withdraw]')).data._buffs[0].isStunnable = 1,
  ]) { const n = structuredClone(native); mutate(n.prefabs.trap_016_peon.components); assert.equal(workerNativeReviewed(n), false); }
});
test('worker spends card stock and DP, chops only the facing tree, removes cover, and frees the original ranged tile', () => {
  const { b, tree, advance, deploy } = setup();
  const ally = b.deployOperator('char_123_fang', 5, 3, 'UP'); assert.ok(ally); advance(.1);
  const covered = ally.s.def, stock = b.mvpStageTokens.get('trap_016_peon'), dp = b.getPlayer('arkpedia').dp;
  const beforeTile = b.grid.tile(5, 4), worker = deploy();
  assert.equal(worker.deploymentSlotCost, 0); assert.equal(worker.s.blockCnt, 0);
  assert.equal(b.getPlayer('arkpedia').dp, dp - 5); assert.equal(b.mvpStageTokens.get('trap_016_peon'), stock - 1);
  assert.match(b.tokenPlacementError('trap_016_peon', 4, 3), /recharging/);
  assert.match(b.placementError('char_124_kroos', 5, 4), /occupied/);
  advance(.5); assert.equal(tree.hp, 100); advance(.11); assert.equal(tree.hp, 87);
  const other = b.allyUnits.find(u => u.tags.has('tree') && u.tileR === 5 && u.tileC === 5);
  assert.equal(other.hp, 100);
  advance(7.1); assert.equal(tree.alive, false); assert.equal(ally.s.def, covered - 150);
  assert.equal(b.grid.tile(5, 4), beforeTile); assert.equal(beforeTile.build, 'RANGED');
  assert.ok(b.deployOperator('char_124_kroos', 5, 4, 'UP'));
  assert.equal(worker.stats.attacks, 8); advance(1.3); assert.equal(worker.alive, false);
  assert.deepEqual(b.errors, []);
});
test('wrong-facing and stunned workers still expire after nine seconds; silence does not disable chopping', () => {
  for (const mode of ['wrong', 'stun', 'silence']) {
    const { b, tree, advance, deploy } = setup(), u = deploy(mode === 'wrong' ? 'DOWN' : 'UP');
    if (mode !== 'wrong') b.applyStatus(u, mode, { duration: 20 });
    advance(8.9); assert.equal(tree.alive, mode !== 'silence', mode); assert.ok(u.alive);
    advance(.11); assert.equal(u.alive, false); assert.deepEqual(b.errors, []);
  }
});
test('retreat during a worker windup cancels its hit without returning stock or DP', () => {
  const { b, tree, advance, deploy } = setup(), u = deploy();
  advance(.2); const stock = b.mvpStageTokens.get('trap_016_peon'), dp = b.getPlayer('arkpedia').dp;
  b.retreatStageToken(u.mem.stageSupplyId); assert.equal(b.getPlayer('arkpedia').dp, dp);
  advance(10); assert.equal(tree.hp, 100); assert.equal(b.mvpStageTokens.get('trap_016_peon'), stock);
  assert.deepEqual(b.errors, []);
});
test('enemy destruction removes Mushroom cover and permanently prevents ranged deployment on its stump', () => {
  const { b, tree, advance } = setup();
  const ally = b.deployOperator('char_123_fang', 5, 3, 'UP'); advance(.1);
  const defense = ally.s.def, tile = b.grid.tile(5, 4);
  assert.equal(b.stageScenery.destroyStump(5, 4, null), true);
  assert.equal(tree.alive, false); assert.equal(ally.s.def, defense - 150);
  assert.equal(tile.build, 'RANGED'); assert.equal(b.grid.tile(5, 4).build, 'NONE');
  assert.ok(b.placementError('char_124_kroos', 5, 4));
  assert.equal(b.stageScenery.destructibleStumps({ x: 4, y: 5 }, 0).length, 0);
  assert.deepEqual(b.errors, []);
});
test('the shared worker capability compiles all six otherwise-supported stage layouts', async () => {
  for (const id of ['fa-5', 'ri-3', 'ri-4', 'ri-5', 'ri-7', 'ri-ex-6']) {
    const p = await planStage(c, id); assert.deepEqual(p.blockers, [], id);
    assert.equal(p.stage.tokens.find(t => t.unitId === 'trap_016_peon').behavior, 'mushroom-worker');
  }
});
