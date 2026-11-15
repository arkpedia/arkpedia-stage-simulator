// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import original from '../data/arkpedia-stage-sa-3.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { forbiddenStageTiles } from '../shared/arkpedia/stage-deployment-tiles.js';
import { validateForbiddenTileGeometry } from '../tools/arkpedia/stage-deployment-tiles.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const {receipt} = await loadStageRuleReceipt(process.cwd(),'sa-3_challenge_mode');
const source={id:receipt.stageId,variant:{kind:'challenge_mode',of_stage_id:receipt.parentStageId}};
const expected=[{row:4,col:2},{row:4,col:3},{row:4,col:4},{row:5,col:4}];
const rules=compileStageRules(source,receipt);
test('SA-3 original coordinates remain bottom-origin row/column; malformed, duplicate and out-of-map locations fail',()=>{
  assert.deepEqual(rules.forbiddenLocations,expected);
  assert.deepEqual(forbiddenStageTiles({...original,rules}),expected);
  for(const text of ['(2,3)|(-1,2)','(4,2)|(4,2)','(1,2);(3,4)','(1.5,2)']){
    const bad=structuredClone(receipt);bad.runes.find(r=>r.key==='global_forbid_location').blackboard[0].valueStr=text;
    assert.throws(()=>compileStageRules(source,bad),/Invalid|Duplicate/);
  }
  assert.throws(()=>forbiddenStageTiles({...original,rules:{forbiddenLocations:[{row:99,col:0}]}}),/Invalid/);
});
test('original top-first map arrays are checked against exported bottom-first positions',()=>{
  const geometry={rows:2,cols:1,tileGrid:[[0],[1]],tileLegend:[{key:'floor',deployable:'melee'},{key:'wall',deployable:'ranged'}]};
  const level={mapData:{map:[[1],[0]],tiles:[{tileKey:'floor',buildableType:1},{tileKey:'wall',buildableType:2}]}};
  const r={forbiddenLocations:[{row:0,col:0}]};
  validateForbiddenTileGeometry(geometry,r,level);
  const wrong=structuredClone(level);wrong.mapData.map.reverse();assert.throws(()=>validateForbiddenTileGeometry(geometry,r,wrong),/does not match/);
});
test('forbidden cells reject operators, summons and supplied devices but preserve movement and terrain',()=>{
  const stage={...original,rules,tokens:[{unitId:'trap_001_crate',name:'Roadblock',count:1,cost:5,hp:100,block:3}]};
  const b=new StandardBattle({...data,stage,enemies:{...data.enemies,...stage.enemies}},
    {operators:['char_123_fang','char_110_deepcl'].map(id=>defaultBuild(data.operators[id]))});
  b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  for(const {row,col} of expected){
    const tile=b.grid.tile(row,col),raw=original.geometry.tileLegend[original.geometry.tileGrid[row][col]];
    assert.equal(tile.build,'NONE');assert.equal(tile.key,raw.key);assert.equal(b.grid.groundPassable(row,col,true),raw.walkable);
    assert.ok(b.placementError('char_123_fang',row,col));
  }
  assert.equal(b.grid.tile(4,5).build,'MELEE');assert.equal(b.grid.tile(2,4).build,'MELEE','do not vertically mirror the restriction');
  b.deployOperator('char_110_deepcl',3,2,'RIGHT');const card=regularSummonCards(b)[0];assert.ok(card);
  for(const {row,col}of expected)assert.ok(summonPlacementError(b,card.key,row,col));
  const dp=b.dp;assert.throws(()=>b.deployToken('trap_001_crate',4,2),/unavailable/);assert.equal(b.dp,dp);assert.equal(b.mvpStageTokens.get('trap_001_crate'),1);
  assert.equal(original.geometry.tileLegend[original.geometry.tileGrid[4][2]].deployable,'melee');assert.deepEqual(b.errors,[]);
});

test('viewer any tiles mean native ALL for source checks, both operator positions and ground blocking', () => {
  const geometry = { rows: 1, cols: 1, tileGrid: [[0]], tileLegend: [{ key: 'tile_road', deployable: 'any' }] };
  const level = { mapData: { map: [[0]], tiles: [{ tileKey: 'tile_road', buildableType: 'ALL' }] } };
  assert.doesNotThrow(() => validateForbiddenTileGeometry(geometry, { forbiddenLocations: [{ row: 0, col: 0 }] }, level));
  const stage = structuredClone(original), raw = stage.geometry.tileLegend[stage.geometry.tileGrid[4][5]];
  raw.deployable = 'any';
  const b = new StandardBattle({ ...data, stage, enemies: { ...data.enemies, ...stage.enemies } },
    { operators: ['char_123_fang', 'char_124_kroos'].map(id => defaultBuild(data.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  assert.equal(b.grid.tile(4, 5).build, 'ALL'); assert.equal(b.placementError('char_123_fang', 4, 5), null);
  assert.equal(b.placementError('char_124_kroos', 4, 5), null);
  assert.equal(b.grid.unblockable[4 * b.grid.cols + 5], 0); assert.deepEqual(b.errors, []);
});
