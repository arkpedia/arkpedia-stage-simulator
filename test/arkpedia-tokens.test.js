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
        if (battle.grid.groundPassable(r, c, true) && battle.tokenPlacementError('trap_001_crate', r, c) === '') return [r, c]; // deployable ground, not a spawn or exit tile
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

test("Allerdale's Guard shields the ally it faces and its 3x3 for 10 s, about 3.2 s after deployment, then leaves", () => {
  const ops = Object.values(data115.operators).slice(0, 5).map(defaultBuild);
  const battle = new StandardBattle(data115, { operators: ops });
  battle.setViewport('fullscreen-workspace'); battle.getPlayer('arkpedia').dp = 99;
  // An operator, then the Guard on the tile to its left, facing it (RIGHT).
  let op = null, guardAt = null;
  for (let r = 0; r < stage115.geometry.rows && !guardAt; r++)
    for (let c = 1; c < stage115.geometry.cols && !guardAt; c++)
      for (const o of ops) {
        if (battle.placementError(o.id, r, c) || battle.tokenPlacementError('trap_087_allady', r, c - 1)) continue;
        op = battle.deployOperator(o.id, r, c, 'RIGHT'); guardAt = [r, c - 1]; break;
      }
  assert.ok(op && guardAt, 'an operator with a free tile on its left');
  const guard = battle.deployToken('trap_087_allady', guardAt[0], guardAt[1], 'RIGHT');
  assert.equal(guard.findBuff('ab:allerdale-barrier'), null);
  const run = s => { const until = battle.time + s; while (battle.time < until - 1e-9) battle.step(); };
  run(3.1); assert.equal(op.findBuff('allady_shield'), null, 'start 1 s + OnAttack 1.2 s + trigger 1 s');
  assert.ok(guard.alive);
  run(.2); assert.equal(guard.alive, false, 'the Guard leaves when its 2.17 s cast ends (3.17 s)');
  const shield = op.findBuff('allady_shield');
  assert.ok(shield); assert.equal(shield.shield, 1000);
  run(9.7); assert.ok(op.findBuff('allady_shield')); run(.4); assert.equal(op.findBuff('allady_shield'), null, 'lasts 10 s');
});

test("Allerdale's Guard facing nobody stays idle", () => {
  const battle = new StandardBattle(data115, { operators: Object.values(data115.operators).slice(0, 5).map(defaultBuild) });
  battle.getPlayer('arkpedia').dp = 99;
  let at = null;
  for (let r = 0; r < stage115.geometry.rows && !at; r++)
    for (let c = 0; c < stage115.geometry.cols && !at; c++) if (!battle.tokenPlacementError('trap_087_allady', r, c)) at = [r, c];
  const guard = battle.deployToken('trap_087_allady', at[0], at[1], 'RIGHT');
  for (let i = 0; i < 300; i++) battle.step();
  assert.ok(guard.alive); assert.equal(guard.mem.allerdale.state, 'idle');
});

test("Allerdale's Guard contract: pinned native passes; a changed range, trigger or duration key is refused", async () => {
  const { alladyNativeReviewed } = await import('../shared/arkpedia/stage-allerdale.js');
  const native = (await import('../data/arkpedia-device-native-source.json', { with: { type: 'json' } })).default;
  assert.equal(alladyNativeReviewed(), true);
  const edit = fn => { const n = structuredClone(native); fn(n); return alladyNativeReviewed(n); };
  assert.equal(edit(n => { n.templates.trap_allady_protected.eventToActions.ON_BUFF_START[0]._rangeId = 'x-5'; }), false);
  assert.equal(edit(n => { n.templates.trap_allady_protected.eventToActions.ON_BUFF_START[0]._buffs[0].durationKey = 'x'; }), false);
  assert.equal(edit(n => { for (const c of n.prefabs.trap_087_allady.components) if (c.data._activeBuffs?.[0]?.templateKey === 'trap_allady_protected') c.data._activeBuffs[0].triggerInterval = 2; }), false);
});
