// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { stageCardDeploymentBlocked, PROFESSION_BITS } from '../shared/arkpedia/stage-card-rules.js';
import { excludedStageOperators } from '../shared/arkpedia/stage-roster.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const context = await loadContentContext();
const restrictions = { '0-4': ['SNIPER'], '0-9': ['TANK'], '1-9': ['TANK'], '2-1': ['CASTER'],
  '2-2': ['SUPPORT'], '2-6': ['CASTER'], '5-7': ['SNIPER', 'TANK'] };
test('seven original challenge rules restrict deployment without removing squad members', async () => {
  for (const [id, classes] of Object.entries(restrictions)) {
    const p = await planStage(context, id + '_challenge_mode');
    assert.deepEqual(p.blockers, [], id);
    assert.equal(p.stage.rules.deploymentExcludedProfessionMask, classes.reduce((mask, c) => mask | PROFESSION_BITS[c], 0));
    assert.equal(excludedStageOperators(p.stage, context.mvp.operators).size, 0);
    for (const record of Object.values(context.mvp.operators))
      assert.equal(stageCardDeploymentBlocked(p.stage.rules, record), classes.includes(record.profession), id + ': ' + record.id);
    const denied = Object.values(context.mvp.operators).find(o => classes.includes(o.profession));
    const allowed = context.mvp.operators.char_123_fang;
    const b = new StandardBattle({ ...context.mvp, stage: p.stage, enemies: { ...context.mvp.enemies, ...p.stage.enemies } },
      { operators: [defaultBuild(allowed)], support: defaultBuild(denied) });
    b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
    assert.ok(b.bench[denied.id], 'restricted support remains in the squad');
    const before = { dp: b.dp, deployments: b.bench[denied.id].deployments, readyAt: b.bench[denied.id].readyAt };
    assert.match(b.placementError(denied.id, 0, 0), /class cannot deploy/);
    assert.throws(() => b.deployOperator(denied.id, 0, 0, 'RIGHT'), /class cannot deploy/);
    assert.throws(() => b.redeployOperatorFromSkill(denied.id, 0, 0, 'RIGHT'), /class cannot deploy/);
    assert.deepEqual({ dp: b.dp, deployments: b.bench[denied.id].deployments, readyAt: b.bench[denied.id].readyAt }, before);
    assert.equal(b.deploymentRestrictionError(allowed.id), null);
    let tile;
    for (let r = b.rect.r0; r <= b.rect.r1 && !tile; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++)
      if (!b.placementError(allowed.id, r, c)) { tile = [r, c]; break; }
    assert.ok(tile, id + ': legal Vanguard tile');
    assert.ok(b.deployOperator(allowed.id, ...tile, 'RIGHT').alive);
    assert.deepEqual(b.errors, []);
  }
});
test('deployment exclusions compose; unreviewed token, terrain and predefined cases stay blocked', async () => {
  const rune = professionMask => ({ key: 'cbuff_excluded', difficultyMask: 'ALL', professionMask, buildableMask: 'ALL', blackboard: [] });
  const compile = runes => compileStageRules({ id: 'fixture' }, { schemaVersion: 1, stageId: 'fixture',
    source: { commit: 'a'.repeat(40), sha256: 'b'.repeat(64) }, runes });
  assert.equal(compile([rune('TANK'), rune('SNIPER')]).deploymentExcludedProfessionMask, 34);
  for (const bad of [rune('TRAP'), rune('TOKEN'), rune(1023), rune(0), rune(1.5),
    { ...rune('SNIPER'), buildableMask: 'RANGED' },
    { ...rune('TANK'), blackboard: [{ key: 'include_predefined', value: 1, valueStr: null }] }])
    assert.throws(() => compile([bad]), /Unsupported/);
  assert.equal(compile([{ ...rune('TANK'), difficultyMask: 'FOUR_STAR' }]).deploymentExcludedProfessionMask, undefined);
  const removed = await planStage(context, '3-6_challenge_mode');
  assert.deepEqual(removed.blockers, []);
  assert.deepEqual(removed.stage.devices, [], 'predefined Detectors are removed through the separate source-checked path');
});
