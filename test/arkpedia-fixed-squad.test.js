// SPDX-License-Identifier: GPL-3.0-or-later
// A stage may own its squad (1-2 is the first). The battle must use exactly
// those builds even when the caller passes different selections.
import test from 'node:test';
import assert from 'node:assert/strict';
import stage from '../data/arkpedia-stage-1-2.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import tokenStage from '../data/arkpedia-stage-17-8.json' with { type: 'json' };
import { fixedSquadBuilds, defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';

const data = () => ({ ...structuredClone(mvp), stage, enemies: { ...mvp.enemies, ...stage.enemies } });

test('1-2 carries its eight fixed builds with the level-file fields', () => {
  assert.equal(stage.fixedSquad.length, 8);
  assert.equal(stageAdapter(stage).fixedSquad.length, 8);
  const builds = fixedSquadBuilds(data());
  assert.deepEqual(builds.map(build => build.id), stage.fixedSquad.map(entry => entry.unit_id));
  for (const [i, build] of builds.entries()) {
    assert.equal(build.elite, stage.fixedSquad[i].elite);
    assert.equal(build.level, stage.fixedSquad[i].level);
    assert.equal(build.skillRank, stage.fixedSquad[i].skill_level);
  }
});
test('the battle uses the fixed squad even when the selection is empty', () => {
  const battle = new StandardBattle(data(), { operators: [] });
  battle.setViewport('fullscreen-workspace');
  assert.deepEqual(Object.keys(battle.bench), stage.fixedSquad.map(entry => entry.unit_id));
  for (let i = 0; i < 300 && !battle.finished; i++) battle.step();
  assert.deepEqual(battle.errors, []);
});

test('a token-only stage preserves player squad choice instead of creating an empty fixed squad',()=>{
  assert.deepEqual(tokenStage.geometry.suppliedUnits.fixed_squad,[]);
  assert.equal(tokenStage.tokens[0].unitId,'trap_001_crate');assert.equal(tokenStage.tokens[0].count,5);
  assert.equal(stageAdapter(tokenStage).fixedSquad,null);assert.equal(tokenStage.fixedSquad,null);
  const selected=defaultBuild(mvp.operators.char_122_beagle);
  const d={...structuredClone(mvp),stage:structuredClone(tokenStage),enemies:structuredClone(tokenStage.enemies)};
  assert.equal(fixedSquadBuilds(d),null);
  const b=new StandardBattle(d,{operators:[selected]});b.setViewport('fullscreen-workspace');
  assert.deepEqual(Object.keys(b.bench),['char_122_beagle']);assert.equal(b.mvpStageTokens.get('trap_001_crate'),5);
});
