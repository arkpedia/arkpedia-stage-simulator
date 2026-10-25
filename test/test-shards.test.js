// SPDX-License-Identifier: GPL-3.0-or-later
// The CI shard split must be a partition: every test file once, no duplicates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { testFilesForShard } from '../tools/run-tests.mjs';

function discover(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? discover(new URL(entry.name + '/', directory), name + '/')
      : entry.name.endsWith('.test.js') ? [name] : [];
  });
}
const ALL = discover(new URL('../test/', import.meta.url)).sort();

test('CI includes nested pathing/render regression suites while excluding fixture helpers', () => {
  const files = testFilesForShard();
  assert.ok(files.includes('sim/pathing-crosscheck.test.js'));
  assert.ok(files.includes('render/playtest6_hitcap.test.js'));
  assert.ok(!files.includes('render/fakepixi.js'));
  assert.ok(files.every(file => !file.includes('\\')));
});

for (const total of [2, 3, 5]) {
  test(`the ${total}-way shard split is an exact partition`, () => {
    const seen = [];
    for (let index = 0; index < total; index++) seen.push(...testFilesForShard(total, index));
    assert.equal(seen.length, ALL.length);
    assert.deepEqual([...new Set(seen)].sort(), ALL);
  });
}
