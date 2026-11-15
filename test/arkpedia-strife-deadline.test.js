// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import native from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { compileStageEnvironments, environmentNativeReviewed } from '../shared/arkpedia/stage-environments.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { prepareStageEnvironments } from '../tools/arkpedia/stage-environments.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { battleHud } from '../shared/arkpedia/battle-hud.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
const instance = (valueStr = '180') => ({ prefabKey: 'strife_mode_feature', blackboard: [
  { key: 'duration_of_each_wave', value: valueStr == null ? 180 : 0, valueStr },
  { key: 'must_kill_them_all_one_wave', value: 1, valueStr: null },
], overrideCameraEffect: null, passProfessionMaskFlag: false, professionMask: 'NONE', playerSideMask: 'ALL' });
const compile = i => compileStageEnvironments([i]);

test('Strife compiles one kill-all deadline from either source encoding, with strict parameters and targeting', () => {
  for (const i of [instance(), instance(null), { ...instance(), playerSideMask: undefined, useExtraData: false }])
    assert.deepEqual(compile(i), [{ kind: 'strife_mode_feature', duration: 180 }]);
  for (const mutate of [i => i.blackboard[0].valueStr = '180,180', i => i.blackboard[0].valueStr = '',
    i => i.blackboard[0].valueStr = 'Infinity', i => i.blackboard[0].valueStr = '0', i => i.blackboard[0].valueStr = '3601',
    i => i.blackboard[0].valueStr = '1.5', i => i.blackboard[0].value = 180, i => i.blackboard[1].value = 0,
    i => i.blackboard[1].valueStr = '1', i => i.blackboard.push(i.blackboard[0]), i => i.blackboard.pop(),
    i => i.blackboard = {}, i => i.playerSideMask = 'LEFT', i => i.useExtraData = true]) {
    const i = instance(); mutate(i); assert.throws(() => compile(i), /Strife|environment/);
  }
  for (const mutate of [c => c._buffs.push({}), c => c._initBlackboard.push({ key: 'other', value: 1 }),
    c => c.m_Script.m_PathID = 'unknown', c => c._options.targetSide = 1,
    c => c._options = {}, c => c._options.unreviewed = 0]) {
    const e = structuredClone(native); mutate(e.prefabs.strife_mode_feature[0].data);
    assert.equal(environmentNativeReviewed('strife_mode_feature', e), false);
  }
});

test('the verified original wave must be single, immediate, and have no independent transition timeout', async t => {
  const root = await mkdtemp(join(tmpdir(), 'strife-source-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cache/arkpedia/original-level-blobs'), { recursive: true });
  await mkdir(join(root, 'data')); await writeFile(join(root, 'data/arkpedia-environment-native-source.json'), JSON.stringify(native));
  const prepare = async waves => {
    const bytes = Buffer.from(JSON.stringify({ globalBuffs: [instance()], waves }));
    const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(root, '.cache/arkpedia/original-level-blobs', gitBlob + '.json'), bytes);
    return prepareStageEnvironments({ root, rules: { source: { gitBlob, sha256 } } });
  };
  const wave = { preDelay: 0, postDelay: 0, maxTimeWaitingForNextWave: -1 };
  assert.equal((await prepare([wave])).environment[0].duration, 180);
  for (const waves of [[], [wave, wave], [{ ...wave, preDelay: 1 }], [{ ...wave, postDelay: 1 }],
    [{ ...wave, maxTimeWaitingForNextWave: 60 }]]) await assert.rejects(prepare(waves), /Strife deadline wave/);
});
function fixture(duration = 2) {
  const enemy = enemyRec({ speed: 0 });
  const h = makeBattle({ content: 'none', timeLimit: 100, autoFinish: true,
    defs: { enemies: { [enemy.key]: enemy } },
    setup: b => installStageEnvironments(b, [{ kind: 'strife_mode_feature', duration }]) });
  h.b.start(); return { ...h, e: h.b.spawnEnemy(enemy.key, { pos: [10, 5] }) };
}
test('deadline uses simulation time and ends without manufacturing leaks, kills or environment rewards', () => {
  const { b, e, run } = fixture(); const events = [];
  b.on('death', event => events.push(event));
  run(1.9); assert.equal(b.finished, false); assert.equal(b.stageDeadline.endAt, 2);
  run(.1); assert.equal(b.reason, 'deadline'); assert.equal(b.leakedCount, 0); assert.equal(b.killed, 0);
  assert.equal(e.alive, true); assert.deepEqual(events, []); assert.deepEqual(b.errors, []);
  const time = b.time; b.step(); assert.equal(b.time, time);
});
test('ordinary clearance wins before or exactly on the deadline; pending spawns still prevent clearance', () => {
  const early = fixture(); early.b.kill(early.e); early.b.step(); assert.equal(early.b.reason, 'cleared');
  const tied = fixture(); tied.b.on('tick', ({ dt }) => {
    if (tied.b.time + dt >= 2 - 1e-9) tied.b.kill(tied.e);
  }); tied.run(2);
  assert.equal(tied.b.reason, 'cleared'); assert.equal(tied.b.leakedCount, 0);
  const future = fixture(); future.b.after(3, () => assert.fail('post-deadline spawn ran'), { holdsBattle: true });
  future.b.kill(future.e); future.run(2); assert.equal(future.b.reason, 'deadline');
});
test('real Vector Breakthrough levels construct through the shared loader with a 180-second HUD countdown', async () => {
  const context = await loadContentContext();
  for (const id of ['vec-sp01_act1break_sp01', 'vec-sp01_act1vecb_sp01', 'vec-sp01_act2break_sp01']) {
    const plan = await planStage(context, id, { waves: true }); assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.stage.environment, [{ kind: 'strife_mode_feature', duration: 180 }]);
    const b = new StandardBattle({ ...context.mvp, stage: plan.stage, enemies: { ...context.mvp.enemies, ...plan.stage.enemies } }, { operators: [defaultBuild(context.mvp.operators.char_123_fang)] });
    assert.equal(battleHud(b, true).deadline, '3:00');
    b.step(); assert.equal(battleHud(b, false).deadline, '3:00');
    for (let i = 0; i < 30; i++) b.step(); assert.equal(battleHud(b, true).deadline, '2:59');
    assert.deepEqual(b.errors, []);
  }
});
