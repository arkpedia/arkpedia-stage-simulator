// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokenTable = JSON.parse(readFileSync(new URL('../data/arkpedia-deployable-tokens.json', import.meta.url)));

test('deployable tokens carry upstream stats and skills', () => {
  assert.equal(tokenTable.schema_version, 1);
  const road = tokenTable.tokens.trap_001_crate;
  assert.equal(road.name, 'Roadblock');
  assert.equal(road.position, 'NONE');
  assert.equal(road.phases[0].levels[0].maxHp, 100);
  assert.equal(road.phases[0].levels[0].block, 3);
  assert.equal(road.phases[0].levels[0].cost, 5);
  assert.equal(road.skills[0].name, 'Obstruct');
  assert.match(road.skills[0].description, /Deploy a Roadblock/);
});

test('the token table covers every token offered by a stage', () => {
  for (const [id, token] of Object.entries(tokenTable.tokens)) {
    assert.ok(token.name, `${id} has no name`);
    assert.ok(token.phases.length > 0, `${id} has no phase`);
    assert.ok(token.phases[0].levels.length > 0, `${id} has no stat level`);
  }
  assert.ok(Object.keys(tokenTable.tokens).length >= 100);
});

import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import stage from '../data/arkpedia-stage-1-6.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };

test('a roadblock token deploys as a blocking crate and spends DP', () => {
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  const [row, col] = (() => {
    for (let r = 0; r < stage.geometry.rows; r++)
      for (let c = 0; c < stage.geometry.cols; c++)
        if (battle.grid.groundPassable(r, c, true)) return [r, c];
    throw new Error('no ground tile');
  })();
  const dp = battle.getPlayer('arkpedia').dp;
  const unit = battle.deployToken('trap_001_crate', row, col);
  assert.equal(unit.hp, 100);
  assert.equal(unit.obstacle, true);
  assert.equal(battle.getPlayer('arkpedia').dp, dp - 5);
  assert.equal(battle.mvpStageTokens.get('trap_001_crate'), 4);
});

import stage115 from '../data/arkpedia-stage-11-5.json' with { type: 'json' };
const data115 = { ...mvp, stage: stage115, enemies: { ...mvp.enemies, ...stage115.enemies } };

test("Allerdale's Guard grants a 1000 barrier on deployment", () => {
  const battle = new StandardBattle(data115, { operators: Object.values(data115.operators).slice(0, 5).map(defaultBuild) });
  const [row, col] = (() => {
    for (let r = 0; r < stage115.geometry.rows; r++)
      for (let c = 0; c < stage115.geometry.cols; c++)
        if (battle.grid.groundPassable(r, c, true)) return [r, c];
    throw new Error('no ground tile');
  })();
  const unit = battle.deployToken('trap_087_allady', row, col);
  const buff = unit.findBuff('ab:allerdale-barrier');
  assert.ok(buff);
  assert.equal(buff.shield, 1000);
});
