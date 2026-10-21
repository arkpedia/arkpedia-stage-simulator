// SPDX-License-Identifier: GPL-3.0-or-later
// Starts every public stage with the default 12-operator squad and runs two
// simulated seconds. It catches a stage file that loads but throws in play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const selection = { operators: Object.values(mvp.operators).slice(0, 12).map(defaultBuild) };
for (const entry of index.stages.filter(e => e.data)) {
  test(`${entry.id} starts and runs two seconds`, () => {
    const stage = JSON.parse(readFileSync(new URL(`../data/${entry.data}`, import.meta.url), 'utf8'));
    const data = { ...structuredClone(mvp), stage, enemies: { ...mvp.enemies, ...stage.enemies } };
    const battle = new StandardBattle(data, selection);
    battle.setViewport('fullscreen-workspace');
    while (!battle.finished && battle.time < 2) battle.step();
    assert.deepEqual(battle.errors, []);
  });
}
