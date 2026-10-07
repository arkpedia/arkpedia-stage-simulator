// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { selectedRegularSummon, summonPlacementError, deployRegularSummon,
  regularSummonCards, retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';

// Exercise the actual native UI handlers against a real regular-stage battle.
// Rendering is stubbed so these checks do not depend on WebGL or remote assets.
const app = readFileSync(new URL('../public/arkpedia/app.js', import.meta.url), 'utf8');
function fn(name, next) { return app.slice(app.indexOf(`function ${name}(`), app.indexOf(`function ${next}(`)); }
function make(id) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = []; source.stage.battle.dp_per_second = 0;
  const battle = new StandardBattle(source, { operators: [defaultBuild(source.operators[id])] });
  battle.autoFinish = false; battle.setViewport('fullscreen-workspace'); battle.addDp('arkpedia', 99);
  battle.deployOperator(id, id === 'char_484_robrta' ? 2 : 3, id === 'char_484_robrta' ? 7 : 2, 'RIGHT');
  const context = createContext({ battle, data: source, selected: summonCardId(id), pending: null,
    battleError: '', landscapeRequired: false, drawHud: () => {},
    icon: () => '', artwork: () => '', summonIcon: () => '',
    summonUnitId, selectedRegularSummon, summonPlacementError, deployRegularSummon });
  runInContext(fn('selectedEntry', 'placementError') + fn('placementError', 'battleReadouts').split('const statIcon')[0]
    + fn('pick', 'summonDetails') + fn('confirmFacing', 'layoutFacing'), context);
  return { battle, context, pick: (row, col) => runInContext(`pick(${row},${col})`, context),
    entry: () => runInContext('selectedEntry()', context) };
}

test('direct Tentacle drop selects the deployed summon and its Retreat controls; occupied tiles inspect before placement', () => {
  const { battle, context, pick, entry } = make('char_110_deepcl');
  const dp = battle.dp; pick(3, 3);
  const token = battle.allyUnits.find(u => u.kind === 'token');
  assert.equal(context.selected, summonUnitId(token)); assert.equal(entry().kind, 'token');
  assert.equal(entry().unit, token); assert.equal(context.pending, null); assert.equal(battle.dp, dp - 5);
  const stock = regularSummonCards(battle)[0].stock;
  context.selected = summonCardId('char_110_deepcl'); pick(3, 3);
  assert.equal(context.selected, summonUnitId(token)); assert.equal(context.battleError, '');
  assert.equal(regularSummonCards(battle)[0].stock, stock); assert.equal(battle.dp, dp - 5);
  retreatRegularSummon(battle, context.selected); assert.equal(token.alive, false);
  assert.equal(battle.dp, dp - 3); assert.deepEqual(battle.errors, []);
});

test('Modeler drop keeps facing pending, then facing release selects its actual device without losing source resources', () => {
  const { battle, context, pick, entry } = make('char_484_robrta');
  const dp = battle.dp; pick(3, 3);
  assert.equal(context.selected, summonCardId('char_484_robrta'));
  assert.equal(context.pending.row, 3); assert.equal(context.pending.col, 3);
  assert.equal(battle.allyUnits.filter(u => u.kind === 'token').length, 0); assert.equal(battle.dp, dp);
  runInContext("confirmFacing('RIGHT')", context);
  const token = battle.allyUnits.find(u => u.kind === 'token');
  assert.equal(context.selected, summonUnitId(token)); assert.equal(entry().kind, 'token');
  assert.equal(token.dir, 'RIGHT'); assert.equal(context.pending, null); assert.equal(battle.dp, dp - 5);
  context.selected = summonCardId('char_484_robrta'); pick(3, 3);
  assert.equal(entry().unit, token); assert.equal(context.battleError, '');
  assert.equal(regularSummonCards(battle)[0].stock, 2); assert.deepEqual(battle.errors, []);
});
