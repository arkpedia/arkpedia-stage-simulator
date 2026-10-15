// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { CLOSUR_ID as ID } from '../server/sim/content/arkpedia-closur-source.js';
import { installClosurRoster, CLOSUR_ROSTER_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-closur-roster.js';
import { canSpendDp, spendDp, regularDpRecoveryForStep } from '../server/sim/content/arkpedia-dp-budget.js';
import { near, advance } from './helpers/mon3tr-fixture.js';
const build = (elite = 2, potential = 1) => ({ id: ID, elite, level: [50, 80, 90][elite], potential,
  trust: 0, skillId: 'skchr_closur_1', skillRank: [4, 7, 10][elite], module: 'none' });
function make({ elite = 2, potential = 1, install = true, regen = 0, builds } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = regen;
  const ids = ['char_122_beagle', 'char_289_gyuki'];
  const b = new StandardBattle(d, { operators: ids.map(id => defaultBuild(d.operators[id])) });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  if (install) installClosurRoster(b, builds ?? [build(elite, potential)], { contract: CONTRACT });
  return b;
}
test('Closure roster admission requires a selected source contract and valid unmoduled builds', () => {
  for (const mutation of [{ elite: 3 }, { potential: 0 }, { skillId: 'unknown' }, { module: 'mod-x' }, { id: 'other' }]) {
    const b = make({ install: false });
    assert.throws(() => installClosurRoster(b, [{ ...build(), ...mutation }], { contract: CONTRACT }));
    assert.equal(b.regularClosurRoster, undefined);
  }
  const b = make({ install: false });
  assert.throws(() => installClosurRoster(b, [build()]));
  installClosurRoster(b, [build()], { contract: CONTRACT });
  assert.throws(() => installClosurRoster(b, [build()], { contract: CONTRACT }));
});
for (const elite of [0, 1, 2]) for (const potential of [1, 3, 6]) test(`carried E${elite}/P${potential} Closure selects the source DP floor before deployment`, () => {
  const b = make({ elite, potential });
  near(b.dpMinimumFor(), elite < 2 ? 0 : potential < 3 ? -3 : -4);
  near(b.regularClosurRoster.atk, elite < 2 ? 0 : .04);
  assert.equal(b.allyUnits.filter(u => u.deployed).length, 0);
});
test('multiple selected Closures choose the strongest floor and one faction buff rather than stacking', () => {
  const b = make({ builds: [build(2, 1), build(2, 6)] }); near(b.dpMinimumFor(), -4); near(b.regularClosurRoster.atk, .04);
  const player = b.getPlayer('arkpedia'); player.dp = 99;
  const u = b.deployOperator('char_122_beagle', 3, 1, 'RIGHT');
  near(u.s.atk, u.base.atk * 1.04); assert.equal(u.buffs.filter(v => v.key === 'closur:roster:rhodes-atk').length, 1);
});
test('normal operator deployment can borrow down to the floor and still rejects unaffordable cards', () => {
  const b = make(), player = b.getPlayer('arkpedia'), id = 'char_122_beagle', cost = b.cost(id);
  player.dp = cost - 3 - .001; assert.match(b.placementError(id, 3, 1), /DP/);
  player.dp = cost - 3; assert.equal(b.placementError(id, 3, 1), null);
  b.deployOperator(id, 3, 1, 'RIGHT'); near(player.dp, -3);
  assert.equal(canSpendDp(b, 'arkpedia', 1), false);
});
test('DP clamps to the selected lower bound while direct skill grants retain their full amount', () => {
  const b = make(), player = b.getPlayer('arkpedia'); player.dp = 0;
  near(b.addDp('arkpedia', -100), -3); near(b.addDp('arkpedia', 2), -1); near(b.addDp('arkpedia', 3), 2);
  near(b.addDp('arkpedia', 1e6), b.flags.dpMax);
  near(b.addDp('other', 1), 0);
});
test('negative-cost exceptions can deliberately require nonnegative DP', () => {
  const b = make(), player = b.getPlayer('arkpedia'); player.dp = 0;
  assert.equal(canSpendDp(b, 'arkpedia', 3), true);
  assert.equal(canSpendDp(b, 'arkpedia', 3, { considerNegative: false }), false);
  assert.equal(spendDp(b, 'arkpedia', 3, { considerNegative: false }), false); near(player.dp, 0);
  assert.equal(spendDp(b, 'arkpedia', 3), true); near(player.dp, -3);
  for (const cost of [-1, Infinity, NaN]) assert.equal(canSpendDp(b, 'arkpedia', cost), false);
  assert.equal(canSpendDp(b, 'other', 0), false);
});
test('natural recovery is halved in debt, splits a crossing tick and leaves skill DP unchanged', () => {
  const b = make({ regen: 1 }), player = b.getPlayer('arkpedia');
  player.dp = -.01; near(regularDpRecoveryForStep(b, 'arkpedia', .1), .09);
  player.dp = -.05; near(regularDpRecoveryForStep(b, 'arkpedia', .1), .05);
  player.dp = -2; advance(b, 1); near(player.dp, -1.5, 1e-6);
  b.addDp('arkpedia', 1); near(player.dp, -.5);
  advance(b, 2); near(player.dp, 1, 1e-6);
});
test('Rhodes ATK is applied without deploying Closure, excludes other factions and stays after a retreat', () => {
  const b = make(), player = b.getPlayer('arkpedia'); player.dp = 99;
  const rhodes = b.deployOperator('char_122_beagle', 3, 1, 'RIGHT');
  const other = b.deployOperator('char_289_gyuki', 3, 3, 'RIGHT');
  near(rhodes.s.atk, rhodes.base.atk * 1.04); near(other.s.atk, other.base.atk);
  b.retreatOperator('char_122_beagle'); near(b.dpMinimumFor(), -3);
  near(other.s.atk, other.base.atk); assert.equal(b.finished, false);
});
test('without Closure the zero floor, deployment affordability and normal DP recovery remain unchanged', () => {
  const b = make({ install: false, regen: 1 }), player = b.getPlayer('arkpedia'); near(b.dpMinimumFor(), 0);
  player.dp = 0; b.addDp('arkpedia', -3); near(player.dp, 0);
  assert.equal(canSpendDp(b, 'arkpedia', 1), false);
  const cost = b.cost('char_122_beagle'); player.dp = cost - 1;
  assert.match(b.placementError('char_122_beagle', 3, 1), /DP/);
  player.dp = 0; advance(b, 1); near(player.dp, 1, 1e-6);
});
