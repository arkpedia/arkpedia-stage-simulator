// SPDX-License-Identifier: GPL-3.0-or-later
// Keep every stage and assertion while bounding the work in each test file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

export const STAGE_SMOKE_GROUPS = 4;
export const publicSmokeStages = index.stages.filter(entry => entry.data);
export function stageSmokeCases(group) {
  if (!Number.isInteger(group) || group < 0 || group >= STAGE_SMOKE_GROUPS) throw new RangeError('Unknown stage smoke group');
  return publicSmokeStages.filter((_, at) => at % STAGE_SMOKE_GROUPS === group);
}

export function registerStageSmoke(group) {
  const selection = { operators: Object.values(mvp.operators).slice(0, 12).map(defaultBuild) };
  for (const entry of stageSmokeCases(group)) {
    test(`${entry.id} starts and runs two seconds`, () => {
      const stage = JSON.parse(readFileSync(new URL(`../data/${entry.data}`, import.meta.url), 'utf8'));
      const data = { ...structuredClone(mvp), stage, enemies: { ...mvp.enemies, ...stage.enemies } };
      const battle = new StandardBattle(data, selection);
      battle.setViewport('fullscreen-workspace');
      while (!battle.finished && battle.time < 2) battle.step();
      assert.deepEqual(battle.errors, []);
    });
  }
}
