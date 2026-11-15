// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStageBranches } from '../tools/arkpedia/stage-branches.mjs';
import { StageBranchScheduler } from '../server/sim/content/arkpedia-stage-branches.js';
import { StageWaveScheduler } from '../server/sim/content/arkpedia-stage-waves.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { emptyActivationBranches } from '../tools/arkpedia/stage-branch-noops.mjs';

function source() {
  const route = { motionMode: 'WALK', startPosition: { row: 9, col: 10 }, endPosition: { row: 9, col: 6 }, checkpoints: [] };
  const action = { actionType: 'SPAWN', key: 'target', count: 2, preDelay: 1, interval: 2, routeIndex: 0,
    managedByScheduler: true, dontBlockWave: false, forceBlockWaveInBranch: false };
  return { level: { extraRoutes: [route], branches: { box: { phases: [{ preDelay: 2, actions: [action] }] } } },
    geometry: { rows: 19, cols: 21, routes: [{ ...route, placeholder: true }] },
    conditional: [{ source: 'branch', branch: 'box', phase: 0, enemy_id: 'target', count: 2, time: 3, interval: 2, route: 0 }] };
}
test('branch compilation reconciles independent extra-route indices, timing and every emitted candidate', () => {
  const f = source(), before = structuredClone(f);
  const p = compileStageBranches(f.level, f.geometry, f.conditional, ['box']);
  assert.deepEqual(f, before); assert.equal(p.geometry.routes.length, 2);
  assert.deepEqual(p.branches.box.spawns, [{ enemyKey: 'target', routeIndex: 1, count: 2, offset: 3, interval: 2, order: 0 }]);
  for (const mutate of [
    x => x.level.branches.extra = x.level.branches.box,
    x => x.level.branches.box.phases.push(x.level.branches.box.phases[0]),
    x => x.level.branches.box.phases[0].actions[0].randomSpawnGroupKey = 'g',
    x => x.level.branches.box.phases[0].actions[0].extraMeta = {},
    x => x.conditional[0].count = 3,
    x => x.conditional[0].route = 1,
    x => x.level.extraRoutes[0].spawnOffset = { x: .5, y: 0 },
  ]) { const x = source(); mutate(x); assert.throws(() => compileStageBranches(x.level, x.geometry, x.conditional, ['box'])); }
});

function runtime(spawns) {
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
    defs: { enemies: { target: enemyRec({ speed: 0 }) } }, units: [] });
  h.b.start(); const branches = new StageBranchScheduler(h.b, { box: { spawns } });
  return { ...h, branches };
}
test('a branch starts only when triggered and its queue survives the triggering body', () => {
  const { b, branches, run } = runtime([{ enemyKey: 'target', routeIndex: 0, count: 2, offset: 1, interval: 2, order: 0 }]);
  run(1); assert.equal(b.enemies.length, 0);
  assert.throws(() => branches.start('missing'), /Unknown stage branch/);
  branches.start('box'); run(.9); assert.equal(b.enemies.length, 0);
  run(.2); assert.equal(b.enemies.length, 1); run(2); assert.equal(b.enemies.length, 2);
  assert.equal(b.total, 0); assert.ok(b.enemies.every(e => !e.counted && e.mem.stageBranch));
  b.enemies.forEach(e => b.kill(e)); assert.equal(b.killed, 0); assert.deepEqual(b.errors, []);
});
test('ordinary managed branch enemies permit wave advance while holding final victory', () => {
  const { b, branches } = runtime([{ enemyKey: 'target', routeIndex: 0, count: 1, offset: 0, interval: 1, order: 0 }]);
  const wave = new StageWaveScheduler(b, { schemaVersion: 1, waves: [] });
  branches.start('box'); const enemy = b.enemies[0];
  assert.equal(wave.blocksWave(enemy), false); assert.equal(enemy.profile.holdsBattle, true);
  b.autoFinish = true; b._checkEnd(); assert.equal(b.finished, false);
  b.kill(enemy); b._checkEnd(); assert.equal(b.reason, 'cleared'); assert.equal(b.total, 0);
});
test('explicit phase completion blockers are independent of future spawn count', () => {
  const actions = [{ enemyKey: 'target', routeIndex: 0, count: 1, offset: 3, interval: 1, order: 0 }];
  for (const blockGameFinish of [false, true]) {
    const { b, branches } = runtime(actions); branches.start('box', { blockGameFinish });
    assert.equal(b._hasPendingEnemySchedules(), blockGameFinish); assert.equal(b.total, 0);
  }
});

test('original IS4 mimic branches bind each chest to its own extra route', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url)), id = 'isw-no_level_obt_roguelike_ro4_level_rogue4_2-3';
  const { receipt } = await loadStageRuleReceipt(root, id), { level } = await readOriginalLevel(root, receipt);
  const base = process.env.ARKPEDIA_CONTENT_SOURCE ?? fileURLToPath(new URL('../../arkpedia-data/source/data/', import.meta.url));
  const [geometry, conditional] = await Promise.all(['stage-geometry', 'stage-conditional'].map(async dir =>
    JSON.parse(await readFile(`${base}/${dir}/${id}.json`, 'utf8'))));
  const keys = level.predefines.tokenInsts.filter(e => e.inst.characterKey === 'trap_758_skzmbx')
    .map(e => e.overrideSkillBlackboard.find(b => b.key === 'branch_id').valueStr);
  const p = compileStageBranches(level, geometry, conditional, keys);
  assert.equal(keys.length, 2);
  for (const key of keys) {
    const original = level.branches[key].phases[0].actions[0], spawn = p.branches[key].spawns[0];
    assert.equal(spawn.enemyKey, 'enemy_2069_skzbox');
    assert.deepEqual(p.geometry.routes[spawn.routeIndex].start, level.extraRoutes[original.routeIndex].startPosition);
  }
});

test('empty activation folding rejects real targets, timing, conditions and other action types', () => {
  const level = { predefines: { characterInsts: [], tokenInsts: [], characterCards: [], tokenCards: [] }, branches: {
    unused: { phases: [{ preDelay: 0, actions: [{ actionType: 'ACTIVATE_PREDEFINED', key: 'absent',
      managedByScheduler: true, count: 1, preDelay: 0, interval: 0 }] }] },
  } };
  assert.deepEqual(emptyActivationBranches(level).unused, { spawns: [], missingActivationAliases: ['absent'], phaseCount: 1 });
  for (const mutate of [
    l => l.predefines.tokenInsts.push({ alias: 'absent' }),
    l => l.predefines.characterCards.push({ alias: 'absent' }),
    l => l.branches.unused.phases[0].preDelay = 1,
    l => l.branches.unused.phases[0].actions[0].preDelay = 1,
    l => l.branches.unused.phases[0].actions[0].actionType = 'SPAWN',
    l => l.branches.unused.phases[0].actions[0].hiddenGroup = 'g',
  ]) { const copy = structuredClone(level); mutate(copy); assert.deepEqual(emptyActivationBranches(copy), {}); }
});

test('branch tunnel compilation preserves hidden wait boundaries and rejects incomplete paths', () => {
  const f=source(),p={row:9,col:8};
  f.level.extraRoutes[0].checkpoints=[{type:0,position:p},{type:1,time:2},{type:5},{type:1,time:3},{type:6,position:{row:2,col:3}}];
  const result=compileStageBranches(f.level,f.geometry,f.conditional,['box']);
  assert.deepEqual(result.geometry.routes.at(-1).waits,[
    {after_checkpoint:0,type:'wait_for_seconds',seconds:2,tunnel:false},
    {after_checkpoint:0,type:'wait_for_seconds',seconds:3,tunnel:true},
  ]);
  for(const checkpoints of [
    [{type:6,position:p}], [{type:5}], [{type:5},{type:5},{type:6,position:p}],
    [{type:5},{type:0,position:p},{type:6,position:p}],
    [{type:0,position:{row:-1,col:8}}], [{type:1,time:-1}],
  ]){const x=structuredClone(f);x.level.extraRoutes[0].checkpoints=checkpoints;assert.throws(()=>compileStageBranches(x.level,x.geometry,x.conditional,['box']));}
});
