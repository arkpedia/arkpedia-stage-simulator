// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-of-ex6.json' with { type: 'json' };
import { stageAdapter, StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

test('supplied roadblocks do not replace the player squad with an empty fixed squad', () => {
  assert.equal(stage.geometry.suppliedUnits.deployable_tokens.length, 1);
  assert.deepEqual(stage.geometry.suppliedUnits.fixed_squad, []);
  assert.equal(stageAdapter(stage).fixedSquad, null);
  const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const b = new StandardBattle(data, { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  assert.ok(b.bench.char_123_fang); assert.equal(b.mvpStageTokens.get('trap_001_crate'), 12);
  assert.deepEqual(b.errors, []);
});

test('a real fixed squad is still retained alongside deployable tokens', () => {
  const source = structuredClone(stage);
  source.geometry.suppliedUnits.fixed_squad = [{ unit_id: 'char_123_fang', level: 1, elite: 0 }];
  assert.deepEqual(stageAdapter(source).fixedSquad, source.geometry.suppliedUnits.fixed_squad);
});
