// SPDX-License-Identifier: GPL-3.0-or-later
// Run the repository test files, optionally as one shard of the CI matrix.
//
//   node tools/run-tests.mjs
//   SHARD_INDEX=1 SHARD_TOTAL=2 node tools/run-tests.mjs
//
// The shard split includes nested engine/render suites, so every file runs once
// and the local command stays identical to CI.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative } from 'node:path';

/** The test files assigned to one shard of a stable recursive test sort. */
export function testFilesForShard(total = 1, index = 0) {
  const n = Math.max(1, Number(total)), i = Math.min(n - 1, Math.max(0, Number(index)));
  return readdirSync(new URL('../test/', import.meta.url), { recursive: true })
    .map(name => name.replaceAll('\\', '/'))
    .filter(name => name.endsWith('.test.js')).sort()
    .filter((_, at) => at % n === i);
}

// Bound the command line, not the test count. Windows rejects a process
// command above 32,767 UTF-16 characters; leave room for Node/flags/quoting.
export function testFileBatches(files, maxChars = 12000) {
  const batches = []; let batch = [], chars = 0;
  for (const file of files) {
    const cost = file.length * 2 + 3; // conservative quoting/escaping allowance
    if (cost > maxChars) throw Error('Test filename exceeds launch budget: ' + file);
    if (batch.length && chars + cost > maxChars) { batches.push(batch); batch = []; chars = 0; }
    batch.push(file); chars += cost;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const total = Math.max(1, Number(process.env.SHARD_TOTAL ?? 1));
  const index = Math.min(total - 1, Math.max(0, Number(process.env.SHARD_INDEX ?? 0)));
  const files = testFilesForShard(total, index).map(name => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
  if (process.argv.includes('--list')) {
    console.log(JSON.stringify(files));
    process.exit(0);
  }
  // Full seeded matches and the entire-stage-catalogue smoke sweep run many
  // complete simulations in one file.
  // Node 22 hosted runners exceeded the generic 180s file deadline, while
  // individual scenarios completed normally. The catalogue sweep also exceeded
  // that file-wide deadline on Windows Node 22. Keep every stage, seed and
  // assertion; isolate these aggregate files with a bounded ten-minute deadline.
  const long = files.filter(file => /[\\/]match[\\/]fullmatch[^\\/]*\.test\.js$/.test(file)
    || /[\\/]arkpedia-stage-(?:smoke|files)\.test\.js$/.test(file));
  const ordinary = files.filter(file => !long.includes(file));
  let failed = false;
  const repo = fileURLToPath(new URL('../', import.meta.url));
  for (const [selected, timeout] of [[long, 600000], [ordinary, 180000]]) {
    if (!selected.length) continue;
    console.log(`Running ${selected.length} test files (file deadline ${timeout}ms)`);
    const batches = testFileBatches(selected.map(file => relative(repo, file)));
    for (const [index, batch] of batches.entries()) {
      console.log(`Batch ${index + 1}/${batches.length}: ${batch.length} files`);
      const result = spawnSync(process.execPath, ['--test', `--test-timeout=${timeout}`, ...batch], { stdio: 'inherit', cwd: repo });
      if (result.error) console.error('Could not launch test batch:', result.error.message);
      if (result.status !== 0) failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}
