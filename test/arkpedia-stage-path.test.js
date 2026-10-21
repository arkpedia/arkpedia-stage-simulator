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
