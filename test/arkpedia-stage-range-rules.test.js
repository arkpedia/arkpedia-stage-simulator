// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import ofReceipt from '../data/stage-rules/of-ex1_challenge_mode.json' with { type: 'json' };
import svReceipt from '../data/stage-rules/sv-7_challenge_mode.json' with { type: 'json' };
import ofNormal from '../data/arkpedia-stage-of-ex1.json' with { type: 'json' };
import svNormal from '../data/arkpedia-stage-sv-7_act10d5_07.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { spawnAny } from './helpers/enemyHarness.js';
import { ALLY_COLLIDER_RADIUS } from '../server/sim/constants.js';

const sourceFor = (receipt, stage) => ({ id: receipt.stageId, code: stage.code, name: stage.name,
  stage_type: 'activity', battle: stage.battle,
  variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } });
const compile = (receipt, stage, geometry = stage.geometry) => compileStage({
  source: sourceFor(receipt, stage), geometry, rules: receipt, mvp, records, support, tokenData: { tokens: {} },
});

function attackAt(record, distance) {
  const h = spawnAny(record.key, { stats: { ...record.stats, moveSpeed: 0 }, seconds: .04 });
  const e = h.b.enemies.find(e => e.defId === record.key), guard = h.b.allyUnits[0];
  e.x = guard.x - distance; e.y = guard.y; e.atkCd = 0;
  const before = e.stats.attacks;
  h.run(.2);
  assert.deepEqual(h.b.errors, []);
  return { attacks: e.stats.attacks - before, h, e, guard };
}

for (const [label, receipt, normal, enemy, multiplier] of [
  ['OF-EX1', ofReceipt, ofNormal, 'enemy_1051_norwiz_2', 2],
  ['SV-7', svReceipt, svNormal, 'enemy_1041_lazerd', 1.25],
]) {
  test(`${label} Challenge expands actual attack reach, including the existing target collider boundary`, () => {
    const original = structuredClone(normal), stage = compile(receipt, normal);
    const base = normal.enemies[enemy], changed = stage.enemies[enemy];
    assert.equal(stage.battle.max_life, 1);
    assert.equal(changed.stats.rangeRadius, base.stats.rangeRadius * multiplier);
    assert.equal(changed.stats.rawRangeRadius, base.stats.rawRangeRadius * multiplier);
    const between = (base.stats.rangeRadius + changed.stats.rangeRadius) / 2 + ALLY_COLLIDER_RADIUS;
    assert.equal(attackAt(base, between).attacks, 0);
    assert.equal(attackAt(changed, between).attacks, 1);
    assert.equal(attackAt(changed, changed.stats.rangeRadius + ALLY_COLLIDER_RADIUS - .001).attacks, 1);
    assert.equal(attackAt(changed, changed.stats.rangeRadius + ALLY_COLLIDER_RADIUS + .001).attacks, 0);
    assert.deepEqual(normal, original, 'normal difficulty and its source stats are untouched');
  });
}

test('range rules multiply configured level overrides and preserve melee blocker-only attacks', () => {
  const geometry = structuredClone(svNormal.geometry);
  const id = 'enemy_1041_lazerd';
  const config = geometry.enemyConfigurations.find(c => c.enemy_id === id);
  config.overrides = { ...config.overrides, range: 4 };
  const stage = compile(svReceipt, svNormal, geometry);
  assert.equal(stage.enemies[id].stats.rangeRadius, 5);
  const crusher = stage.enemies.enemy_1045_hammer_2;
  assert.equal(crusher.stats.rawRangeRadius, 3.125);
  assert.equal(crusher.stats.rangeRadius, 0);
  const { h, e, guard, attacks } = attackAt(crusher, 1.5);
  assert.equal(attacks, 0, 'raw ability radius cannot grant a ranged ordinary attack');
  e.x = guard.x + .2; e.y = guard.y;
  assert.ok(h.b._checkBlock(e)); h.run(.2);
  assert.equal(e.stats.attacks, 1);
});

test('range aliases reject changed masks, extra or duplicate parameters, and invalid multipliers', () => {
  for (const receipt of [ofReceipt, svReceipt]) {
    const source = sourceFor(receipt, ofNormal);
    for (const edit of [r => r.professionMask = 1, r => r.buildableMask = 1,
      r => r.blackboard[0].value = 0, r => r.blackboard[0].value = -1,
      r => r.blackboard[0].value = NaN, r => r.blackboard[0].key = 'other',
      r => r.blackboard.push({ key: 'extra', value: 1 }),
      r => r.blackboard.push({ ...r.blackboard[0] })]) {
      const bad = structuredClone(receipt); edit(bad.runes.at(-1));
      assert.throws(() => compileStageRules(source, bad), /Unsupported|Invalid/);
    }
    const normal = { ...receipt, stageId: receipt.parentStageId }; delete normal.parentStageId;
    assert.deepEqual(compileStageRules({ id: normal.stageId }, normal).enemies, {});
  }
});
