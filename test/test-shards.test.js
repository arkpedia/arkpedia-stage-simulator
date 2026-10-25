// SPDX-License-Identifier: GPL-3.0-or-later
// The CI shard split must be a partition: every test file once, no duplicates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { testFilesForShard, testFileBatches } from '../tools/run-tests.mjs';

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

test('the actual CLI enters its main function on the host platform and lists the selected shard', () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL('../tools/run-tests.mjs', import.meta.url)), '--list'],
    { encoding: 'utf8', env: { ...process.env, SHARD_TOTAL: '2', SHARD_INDEX: '1' } });
  assert.deepEqual(JSON.parse(output), testFilesForShard(2, 1).map(name => fileURLToPath(new URL('../test/' + name, import.meta.url))));
});

test('launch batches preserve every selected file while staying below Windows command limits', () => {
  const files = testFilesForShard().map(name => 'test/' + name), batches = testFileBatches(files);
  assert.ok(batches.length > 1); assert.deepEqual(batches.flat(), files);
  for (const batch of batches) assert.ok(batch.reduce((n, file) => n + file.length * 2 + 3, 0) <= 12000);
  const long = Array.from({ length: 100 }, (_, i) => 'test/' + 'long-path-'.repeat(20) + i + '.test.js');
  assert.deepEqual(testFileBatches(long).flat(), long);
  assert.deepEqual(testFileBatches([]), []);
});
