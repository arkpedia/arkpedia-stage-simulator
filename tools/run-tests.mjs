// SPDX-License-Identifier: GPL-3.0-or-later
// Run the repository test files, optionally as one shard of the CI matrix.
//
//   node tools/run-tests.mjs
//   SHARD_INDEX=1 SHARD_TOTAL=2 node tools/run-tests.mjs
//
// The shard split is a stable sort of test/*.test.js, so every file runs once
// and the local command stays identical to CI.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The test files assigned to one shard of a stable `test/*.test.js` sort. */
export function testFilesForShard(total = 1, index = 0) {
  const n = Math.max(1, Number(total)), i = Math.min(n - 1, Math.max(0, Number(index)));
  return readdirSync(new URL('../test/', import.meta.url))
    .filter(name => name.endsWith('.test.js')).sort()
    .filter((_, at) => at % n === i);
}

// Bound the command line, not the test count. Windows rejects a process
// command line above 32,767 UTF-16 characters, and one launch of every
// shard file exceeded it (the step exited 1 with no test output). Keep each
// launch well under the limit, leaving room for Node, flags and quoting.
export function testFileBatches(files, maxChars = 12000) {
  const batches = []; let batch = [], chars = 0;
  for (const file of files) {
    const cost = file.length * 2 + 3; // conservative quoting/escaping allowance
    if (cost > maxChars) throw new Error('Test filename exceeds launch budget: ' + file);
    if (batch.length && chars + cost > maxChars) { batches.push(batch); batch = []; chars = 0; }
    batch.push(file); chars += cost;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const total = Math.max(1, Number(process.env.SHARD_TOTAL ?? 1));
  const index = Math.min(total - 1, Math.max(0, Number(process.env.SHARD_INDEX ?? 0)));
  const files = testFilesForShard(total, index).map(name => `test/${name}`);
  if (!files.length) throw new Error('No test files selected; refusing an empty test run');
  console.log(`Selected ${files.length} test files (shard ${index + 1}/${total})`);
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const batches = testFileBatches(files);
  let failed = false;
  for (const [at, batch] of batches.entries()) {
    console.log(`Batch ${at + 1}/${batches.length}: ${batch.length} files`);
    const result = spawnSync(process.execPath, ['--test', '--test-timeout=180000', ...batch], { stdio: 'inherit', cwd: repo });
    if (result.error) console.error('Could not launch test batch:', result.error.message);
    if (result.status !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
