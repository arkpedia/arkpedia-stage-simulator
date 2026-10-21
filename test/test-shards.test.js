// SPDX-License-Identifier: GPL-3.0-or-later
// The CI shard split must be a partition: every test file once, no duplicates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { testFilesForShard } from '../tools/run-tests.mjs';

const ALL = readdirSync(new URL('../test/', import.meta.url)).filter(name => name.endsWith('.test.js')).sort();

for (const total of [2, 3, 5]) {
  test(`the ${total}-way shard split is an exact partition`, () => {
    const seen = [];
    for (let index = 0; index < total; index++) seen.push(...testFilesForShard(total, index));
    assert.equal(seen.length, ALL.length);
    assert.deepEqual([...new Set(seen)].sort(), ALL);
  });
}
