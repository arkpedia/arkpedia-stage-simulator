// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

test('synthetic waits stay attached to start and deduplicated native checkpoint indices', () => {
  const path = syntheticRoutePath({ start: { row: 1, col: 1 }, end: { row: 2, col: 3 },
    checkpoints: [{ type: 'move', position: { row: 1, col: 1 } }, { type: 'move', position: { row: 1, col: 2 } }],
    waits: [{ type: 'wait_for_seconds', after_checkpoint: -1, seconds: 3 },
      { type: 'wait_for_seconds', after_checkpoint: 0, seconds: 75 }, { type: 'wait_for_seconds', after_checkpoint: 1, seconds: 9 }] });
  assert.deepEqual(path.holds.map(h => [h.at, h.seconds]), [[0, 3], [0, 75], [1, 9]]);
});
test('synthetic MOVE retains native offsets and APPEAR creates a break instead of a walk leg', () => {
  const path = syntheticRoutePath({ start: { row: 0, col: 0 }, end: { row: 3, col: 4 },
    checkpoints: [{ type: 'move', position: { row: 1, col: 2 }, reachOffset: { x: .34, y: -.01 } },
      { type: 'appear_at_pos', position: { row: 2, col: 4 } }] });
  assert.deepEqual(path.points, [[0, 0], [2.34, .99], [4, 2], [4, 3]]);
  assert.deepEqual(path.breaks, [2]);
});

test('all retained test-only generated paths match the canonical geometry wait/teleport contracts', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['tools/arkpedia/rebuild-candidate-paths.mjs', '--check'], { stdio: 'pipe' }));
});
test('unknown waits and invalid native checkpoint anchors fail rather than dropping timing', () => {
  const route = { start: { row: 0, col: 0 }, end: { row: 0, col: 1 }, checkpoints: [] };
  for (const wait of [{ type: 'wait_for_seconds', after_checkpoint: 0, seconds: 1 },
    { type: 'wait_for_seconds', after_checkpoint: -1, seconds: -1 }, { type: 'wait_for_signal', after_checkpoint: -1, seconds: 1 }])
    assert.throws(() => syntheticRoutePath({ ...route, waits: [wait] }), /Unsupported synthetic route wait/);
});
