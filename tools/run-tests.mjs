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
import { resolve } from 'node:path';

/** The test files assigned to one shard of a stable recursive test sort. */
export function testFilesForShard(total = 1, index = 0) {
  const n = Math.max(1, Number(total)), i = Math.min(n - 1, Math.max(0, Number(index)));
  return readdirSync(new URL('../test/', import.meta.url), { recursive: true })
    .map(name => name.replaceAll('\\', '/'))
    .filter(name => name.endsWith('.test.js')).sort()
    .filter((_, at) => at % n === i);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const total = Math.max(1, Number(process.env.SHARD_TOTAL ?? 1));
  const index = Math.min(total - 1, Math.max(0, Number(process.env.SHARD_INDEX ?? 0)));
  const files = testFilesForShard(total, index).map(name => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
  if (process.argv.includes('--list')) {
    console.log(JSON.stringify(files));
    process.exit(0);
  }
  // Full seeded matches run dozens of complete simulations in one file.
  // Node 22 hosted runners exceeded the generic 180s file deadline, while
  // individual scenarios completed normally. Keep every seed/assertion and
  // give only these long files a bounded ten-minute deadline.
  const long = files.filter(file => /[\\/]match[\\/]fullmatch[^\\/]*\.test\.js$/.test(file));
  const ordinary = files.filter(file => !long.includes(file));
  for (const [selected, timeout] of [[long, 600000], [ordinary, 180000]]) {
    if (!selected.length) continue;
    console.log(`Running ${selected.length} test files (file deadline ${timeout}ms)`);
    const result = spawnSync(process.execPath, ['--test', `--test-timeout=${timeout}`, ...selected], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
