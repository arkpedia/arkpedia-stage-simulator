// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, skillRankCap } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATOR_ADAPTERS } from '../server/sim/content/arkpedia-operator-runtime.js';

test('ordered operator registrations have unique keys and usable hooks', () => {
  assert.equal(new Set(REGULAR_OPERATOR_ADAPTERS.map(adapter => adapter.key)).size, REGULAR_OPERATOR_ADAPTERS.length);
  for (const adapter of REGULAR_OPERATOR_ADAPTERS) {
    assert.ok(typeof adapter.customize === 'function' || typeof adapter.install === 'function', adapter.key);
    assert.ok(Object.isFrozen(adapter), adapter.key);
  }
});

test('every admitted operator/skill deploys and runs through the common registry', () => {
  const source = { ...data, stage: { ...data.stage, geometry: { ...data.stage.geometry, waves: [] } } };
  const failures = [];
  for (const op of Object.values(data.operators)) for (const skill of op.skills.length ? op.skills : [null]) {
    try {
      const build = { ...defaultBuild(op), skillId: skill?.id ?? null };
      build.skillRank = skill ? skillRankCap(op, skill.id, build.elite) : null;
      const battle = new StandardBattle(source, { operators: [build] });
      battle.autoFinish = false; battle.setViewport('fullscreen-workspace'); battle.addDp('arkpedia', 99);
      let tile;
      for (let r = 0; r < source.stage.geometry.rows; r++) for (let c = 0; c < source.stage.geometry.cols; c++)
        if (!tile && !battle.placementError(op.id, r, c)) tile = [r, c];
      assert.ok(tile, 'a legal deployment tile exists');
      const unit = battle.deployOperator(op.id, ...tile, 'RIGHT');
      battle.step();
      unit.skill?.gainSp(unit.skill.spCost, 'test');
      battle.activateOperator(op.id);
      for (let n = 0; n < 60; n++) battle.step();
      assert.deepEqual(battle.errors, []);
    } catch (error) { failures.push(`${op.id}/${skill?.id ?? 'no-skill'}: ${error.message}`); }
  }
  assert.deepEqual(failures, []);
});
