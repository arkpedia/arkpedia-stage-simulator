// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { installClosurRoster, CLOSUR_ROSTER_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-closur-roster.js';
import { selectedRegularSummon, summonPlacementError, deployRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { near, advance } from './helpers/mon3tr-fixture.js';
const closure = { id: 'char_4228_closur', elite: 2, level: 90, potential: 1, trust: 0,
  skillId: 'skchr_closur_1', skillRank: 10, module: 'none' };
for (const [id, skill] of [['char_110_deepcl', 0], ['char_248_mgllan', 0], ['char_2023_ling', 0],
  ['char_4072_ironmn', 0], ['char_4179_monstr', 0], ['char_1042_phatm2', 1], ['char_4123_ela', 0]]) {
  test(`${id} public summon payment admits borrowing, charges the real cost and refuses crossing the floor`, () => {
    const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
    d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
    d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
    const build = { ...defaultBuild(d.operators[id]), skillId: d.operators[id].skills[skill].id };
    const b = new StandardBattle(d, { operators: [build] });
    b.autoFinish = false; b.setViewport('fullscreen-workspace');
    b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
    installClosurRoster(b, [closure], { contract: CONTRACT });
    const player = b.getPlayer('arkpedia'); player.dp = 99; const owner = b.deployOperator(id, 5, 5, 'RIGHT');
    advance(b, 1.5);
    if (id === 'char_1042_phatm2') {
      owner.skill.setSpTotal(owner.skill.spCost); assert.ok(owner.skill.activate()); advance(b, 1);
    }
    const card = `summon:${id}`, state = selectedRegularSummon(b, card);
    assert.ok(state); const cost = state.record.stats.cost; assert.ok(cost > 0);
    player.dp = cost - 3 - .001;
    assert.match(summonPlacementError(b, card, 5, 6), /DP/);
    player.dp = cost - 3; assert.equal(summonPlacementError(b, card, 5, 6), null);
    const token = deployRegularSummon(b, card, 5, 6, 'RIGHT');
    assert.ok(token.alive); near(player.dp, -3); assert.deepEqual(b.errors, []);
  });
}
