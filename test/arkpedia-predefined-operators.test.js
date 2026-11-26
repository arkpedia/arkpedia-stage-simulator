// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { compilePredefinedOperators, predefinedTrust } from '../tools/arkpedia/stage-predefined-operators.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { excludedStageOperators, stageUsesFixedSquad } from '../shared/arkpedia/stage-roster.js';

const context = await loadContentContext();
const operators = { ...context.mvp.operators, ...context.supportOperators.operators };
async function load(id) {
  const plan = await planStage(context, id, { waves: true });
  assert.deepEqual(plan.blockers, [], id);
  const excluded = excludedStageOperators(plan.stage, context.mvp.operators);
  const selected = stageUsesFixedSquad(plan.stage) ? [] : [defaultBuild(Object.values(context.mvp.operators).find(op => !excluded.has(op.id)))];
  const b = new StandardBattle({ ...context.mvp, stage: plan.stage, enemies: { ...context.mvp.enemies, ...plan.stage.enemies } }, { operators: selected });
  b.life = 1e6; b.setViewport('fullscreen-workspace');
  return { b, stage: plan.stage };
}

test('hidden fixed cards become available at their scheduled action, without DP or enemy-count changes', async () => {
  const { b, stage } = await load('tr-4');
  const entries = stage.waveProgram.predefined.entries;
  assert.ok(entries.every(e => e.hidden));
  for (const e of entries) assert.equal(b.bench[e.build.id].hidden, true);
  assert.match(b.placementError(entries[0].build.id, 0, 0), /not been activated/);
  const total = b.total; let activated = 0;
  const run = b.activateStagePredefined.bind(b);
  b.activateStagePredefined = key => { const dp = b.dp; run(key); assert.equal(b.dp, dp); activated++; };
  for (let i = 0; i < 6000 && !b.finished && activated < 2; i++) b.step();
  assert.equal(activated, 2); assert.equal(b.total, total);
  assert.ok(entries.every(e => b.bench[e.build.id].hidden === false));
  assert.deepEqual(b.errors, []);
});

test('preplaced actors use their source build, facing, real operator kit and zero deployment cost', async () => {
  const { b, stage } = await load('tr-6');
  const actor = stage.waveProgram.predefined.entries.find(e => e.kind === 'actor');
  const entry = b.bench[actor.build.id], unit = entry.unit;
  assert.ok(unit?.alive); assert.equal(entry.lastCost, 0);
  assert.equal(unit.tileR, actor.row); assert.equal(unit.tileC, actor.col);
  assert.deepEqual(entry.build, actor.build);
  const count = b.allyUnits.length; b.activateStagePredefined(actor.key);
  assert.equal(b.allyUnits.length, count, 'repeated activation does not duplicate the actor');
  assert.equal(entry.noCard, true);
  b.retreatOperator(actor.build.id); b.time += 200;
  assert.match(b.placementError(actor.build.id, actor.row, actor.col), /no deployment card/);
  assert.throws(() => b.deployOperator(actor.build.id, actor.row, actor.col, actor.direction), /no deployment card/);
  assert.equal(entry.readyAt, Infinity);
  b.activateStagePredefined(actor.key); assert.equal(b.allyUnits.length, count);
  assert.deepEqual(b.errors, []);
});

test('source-disabled three-star skills stay absent after card activation and deployment', async () => {
  const { b, stage } = await load('tr-1');
  const e = stage.waveProgram.predefined.entries.find(e => e.disableSkill);
  assert.ok(e); b.activateStagePredefined(e.key); b.addDp('arkpedia', 99);
  let position;
  for (let r = b.rect.r0; r <= b.rect.r1; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++)
    if (!position && !b.placementError(e.build.id, r, c)) position = [r, c];
  assert.ok(position); const unit = b.deployOperator(e.build.id, ...position, 'LEFT');
  assert.equal(unit.skill.noSkill, true); assert.equal(unit.skill.activate(), false);
  for (let i = 0; i < 120; i++) b.step();
  assert.equal(unit.skill.active, false); assert.deepEqual(b.errors, []);
});

test('source ambiguity and instance overrides refuse compilation instead of becoming default builds', async () => {
  const { stage } = await load('tr-6');
  const { receipt } = await loadStageRuleReceipt(context.root, 'tr-6');
  const { level } = await readOriginalLevel(context.root, receipt);
  for (const alter of [l => l.predefines.characterInsts.push(structuredClone(l.predefines.characterInsts[0])),
    l => l.predefines.characterInsts[0].overrideTalents = {},
    l => l.predefines.characterInsts[0].inst.favorPoint = 100.5]) {
    const changed = structuredClone(level); alter(changed);
    assert.throws(() => compilePredefinedOperators(changed, stage.geometry, operators), /predefined operator/);
  }
  for (const field of ['skill_index', 'skill_level']) {
    const geometry = structuredClone(stage.geometry);
    geometry.suppliedUnits.fixed_squad[0][field]++;
    assert.throws(() => compilePredefinedOperators(level, geometry, operators), /predefined card mismatch/);
  }
});

test('favor points use original battle phases, never interpret raw points as displayed trust', () => {
  assert.equal(predefinedTrust(5), 0);
  assert.equal(predefinedTrust(40), 4);
  assert.equal(predefinedTrust(50), 4);
  assert.equal(predefinedTrust(25570), 200);
  assert.equal(predefinedTrust(100), 6);
  assert.equal(predefinedTrust(111), 6); assert.equal(predefinedTrust(112), 8);
  assert.equal(predefinedTrust(10069), 98); assert.equal(predefinedTrust(10070), 100);
  for (const value of [-1, 25571, .5, NaN, Infinity, '100']) assert.throws(() => predefinedTrust(value), /favor points/);
});

test('scheduled actors may use their source tile while ordinary deployment keeps its tile restrictions', async () => {
  const { b, stage } = await load('1-11');
  const actor = stage.waveProgram.predefined.entries.find(e => e.kind === 'actor');
  assert.equal(b.bench[actor.build.id].hidden, true);
  const before = b.dp;
  b.activateStagePredefined(actor.key);
  assert.equal(b.dp, before);
  assert.equal(b.bench[actor.build.id].unit.tileR, actor.row);
  assert.equal(b.bench[actor.build.id].unit.tileC, actor.col);
  assert.deepEqual(b.errors, []);
});

test('timeout excludes pending activation actions from unspawned enemy accounting', async () => {
  const { b } = await load('tr-4'); b.timeLimit = 0.1;
  while (!b.finished) b.step();
  assert.equal(b.reason, 'timeout'); assert.ok(b.unspawned.every(e => typeof e.enemyKey === 'string'));
  assert.deepEqual(b.errors, []);
});

test('ordinary preplaced actors keep the chosen squad and bypass only their own source roster exclusion', async () => {
  for (const id of ['cb-3', 'of-6', '11-3', '11-3_adverse_environment']) {
    const plan = await planStage(context, id, { waves: true }); assert.deepEqual(plan.blockers, [], id);
    assert.equal(plan.stage.waveProgram.predefined.squadMode, 'player'); assert.equal(stageUsesFixedSquad(plan.stage), false);
    const data = { ...context.mvp, stage: plan.stage, enemies: { ...context.mvp.enemies, ...plan.stage.enemies } };
    const chosen = defaultBuild(context.mvp.operators.char_123_fang);
    const b = new StandardBattle(data, { operators: [chosen] }); b.setViewport('fullscreen-workspace');
    assert.deepEqual(b.bench.char_123_fang.build, chosen); assert.equal(b.bench.char_123_fang.unit, null);
    for (const actor of plan.stage.waveProgram.predefined.entries) {
      const entry = b.bench[actor.build.id]; assert.ok(entry.unit?.alive, id); assert.deepEqual(entry.build, actor.build);
      assert.equal(entry.lastCost, 0); assert.equal(entry.unit.tileR, actor.row); assert.equal(entry.unit.tileC, actor.col);
      assert.throws(() => new StandardBattle(data, { operators: [defaultBuild(context.mvp.operators[actor.build.id])] }), /excludes/);
    }
    for (let i = 0; i < 30; i++) b.step(); assert.deepEqual(b.errors, [], id);
  }
});

test('actor-only training programs have an explicitly fixed empty bench and activate scheduled actors', async () => {
  const { stage: original } = await load('tr-6'), stage = structuredClone(original);
  const { receipt } = await loadStageRuleReceipt(context.root, 'tr-6');
  const { level } = await readOriginalLevel(context.root, receipt);
  level.predefines.characterCards = []; level.predefines.characterInsts[0].hidden = true;
  level.waves = [{ fragments: [{ actions: [{ actionType: 'ACTIVATE_PREDEFINED', key: level.predefines.characterInsts[0].inst.characterKey }] }] }];
  stage.geometry.suppliedUnits.fixed_squad = []; stage.fixedSquad = null;
  const predefined = compilePredefinedOperators(level, stage.geometry, operators);
  stage.waveProgram = { ...stage.waveProgram, waves: [], predefined };
  const b = new StandardBattle({ ...context.mvp, stage, enemies: { ...context.mvp.enemies, ...stage.enemies } }, { operators: [] });
  b.setViewport('fullscreen-workspace');
  assert.equal(predefined.squadMode, 'fixed'); assert.equal(stageUsesFixedSquad(stage), true);
  assert.equal(predefined.entries.some(e => e.kind === 'card'), false);
  assert.equal(Object.keys(b.bench).length, 1); assert.equal(b.allyUnits.length, 0);
  const actor = predefined.entries[0], dp = b.dp;
  b.activateStagePredefined(actor.key); assert.equal(b.dp, dp); assert.ok(b.bench[actor.build.id].unit.alive);
  assert.deepEqual(b.errors, []);
});

test('inactive normal-variant actors do not create a phantom squad or block their player-owned identity', async () => {
  for (const id of ['tw-s-1', 'tw-s-2']) {
    const p = await planStage(context, id, { waves: true }); assert.deepEqual(p.blockers, [], id);
    assert.equal(p.stage.waveProgram.predefined, undefined); assert.equal(stageUsesFixedSquad(p.stage), false);
  }
  const p = await planStage(context, '14-11', { waves: true });
  // A worn module is never silently discarded: the one reviewed module (Logos's, predefined-modules.js) is carried on
  // the entry; any other stays a blocker (test/arkpedia-predefined-modules.test.js).
  assert.deepEqual(p.blockers, []);
  assert.equal(p.stage.waveProgram.predefined.entries[0].module?.id, 'uniequip_002_logos');
});

test('source-defined intermediate favor points compile through ordinary operator builds', async () => {
  for (const id of ['gt-1', 'gt-3', 'mn-tr-1']) {
    const p = await planStage(context, id, { waves: true }); assert.deepEqual(p.blockers, [], id);
    const receipt = (await loadStageRuleReceipt(context.root, id)).receipt;
    const { level } = await readOriginalLevel(context.root, receipt);
    const entries = p.stage.waveProgram.predefined.entries;
    for (const entry of entries) {
      const original = [...level.predefines.characterCards, ...level.predefines.characterInsts]
        .find(p => (p.alias || p.inst.characterKey) === entry.key);
      assert.equal(entry.build.trust, predefinedTrust(original.inst.favorPoint));
    }
    const { b } = await load(id); for (let i = 0; i < 30 && !b.finished; i++) b.step();
    assert.deepEqual(b.errors, [], id);
  }
});

test('initial operator enable rules resolve exact original aliases before activation and preserve source records', async () => {
  const receipt = (await loadStageRuleReceipt(context.root, 'tw-s-1')).receipt;
  const { level } = await readOriginalLevel(context.root, receipt);
  const geometry = (await planStage(context, 'tw-s-1', { waves: true })).stage.geometry;
  const original = structuredClone(level), toggles = { char_115_headbr: true, char_196_sunbr: true };
  const p = compilePredefinedOperators(level, geometry, operators, { predefinedOperators: toggles });
  assert.equal(p.squadMode, 'player'); assert.equal(p.entries.length, 2);
  assert.ok(p.entries.every(e => e.kind === 'actor' && !e.hidden && e.build.trust === 4));
  assert.deepEqual(p.entries.map(e => [e.row, e.col]), [[3, 1], [3, 8]]);
  assert.deepEqual(level, original);
  assert.equal(compilePredefinedOperators(level, geometry, operators, { predefinedOperators: { char_115_headbr: false } }).entries.length, 0);
  assert.throws(() => compilePredefinedOperators(level, geometry, operators, { predefinedOperators: { char_missing: true } }), /Unknown or ambiguous/);
  assert.throws(() => compilePredefinedOperators(level, geometry, operators, { predefinedOperators: { char_115_headbr: 1 } }), /Unknown or ambiguous/);
  const duplicate = structuredClone(level); duplicate.predefines.characterInsts.push(duplicate.predefines.characterInsts[0]);
  assert.throws(() => compilePredefinedOperators(duplicate, geometry, operators, { predefinedOperators: toggles }), /Unknown or ambiguous/);
});

test('enabled source actors do not silently exclude player choices where duplicate-build semantics remain unimplemented', async () => {
  for (const id of ['tw-s-1_challenge_mode', 'tw-s-2_challenge_mode']) {
    const p = await planStage(context, id);
    assert.equal(p.stage, undefined);
    assert.ok(p.blockers.some(b => b.kind === 'wave-program' && /lacks a reviewed squad exclusion/.test(b.message)));
    assert.ok(!p.blockers.some(b => b.kind === 'stage-rules'));
  }
});
