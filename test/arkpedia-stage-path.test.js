// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticRoutePath } from '../shared/arkpedia/stage-path.js';

test('a synthetic route path is [col,row] start/checkpoints/end and dedupes', () => {
  const path = syntheticRoutePath({ start: { row: 4, col: 2 }, end: { row: 5, col: 8 },
    checkpoints: [{ position: { row: 4, col: 7 } }, { position: { row: 4, col: 7 } }] });
  assert.deepEqual(path.points, [[2, 4], [7, 4], [8, 5]]);
  assert.deepEqual(path.distances, [0, 1, 2]); assert.deepEqual(path.breaks, []); assert.deepEqual(path.holds, []);
});
test('a route without checkpoints is still a start/end path', () => {
  const path = syntheticRoutePath({ start: { row: 0, col: 0 }, end: { row: 2, col: 3 } });
  assert.deepEqual(path.points, [[0, 0], [3, 2]]);
});

test('generated paths retain entrance waits, hidden holds, same-position teleports and repeated waits', () => {
  const p = syntheticRoutePath({start:{row:1,col:1},end:{row:2,col:5},checkpoints:[
    {type:'move',position:{row:1,col:3}},
    {type:'appear_at_pos',position:{row:1,col:3}},
    {type:'appear_at_pos',position:{row:2,col:5}},
  ],waits:[
    {after_checkpoint:-1,type:'wait_for_seconds',seconds:5,tunnel:false},
    {after_checkpoint:0,type:'wait_for_seconds',seconds:2,tunnel:false},
    {after_checkpoint:0,type:'wait_for_seconds',seconds:3,tunnel:true},
    {after_checkpoint:0,type:'wait_for_seconds',seconds:1,tunnel:true},
  ]});
  assert.deepEqual(p.points,[[1,1],[3,1],[3,1],[5,2]]);
  assert.deepEqual(p.breaks,[2,3]);
  assert.deepEqual(p.holds,[{at:0,seconds:5,tunnel:false},{at:1,seconds:2,tunnel:false},{at:1,seconds:4,tunnel:true}]);
  for(const wait of [{after_checkpoint:4,type:'wait_for_seconds',seconds:1},
    {after_checkpoint:0,type:'wait_for_seconds',seconds:-1},
    {after_checkpoint:0,type:'unknown',seconds:1}])assert.throws(()=>syntheticRoutePath({start:{row:0,col:0},end:{row:1,col:1},waits:[wait]}));
});
