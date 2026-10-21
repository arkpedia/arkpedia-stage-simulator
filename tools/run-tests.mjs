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
import { fileURLToPath } from 'node:url';

/** The test files assigned to one shard of a stable `test/*.test.js` sort. */
export function testFilesForShard(total = 1, index = 0) {
  const n = Math.max(1, Number(total)), i = Math.min(n - 1, Math.max(0, Number(index)));
  return readdirSync(new URL('../test/', import.meta.url))
    .filter(name => name.endsWith('.test.js')).sort()
    .filter((_, at) => at % n === i);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const total = Math.max(1, Number(process.env.SHARD_TOTAL ?? 1));
  const index = Math.min(total - 1, Math.max(0, Number(process.env.SHARD_INDEX ?? 0)));
  const files = testFilesForShard(total, index).map(name => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
  const result = spawnSync(process.execPath, ['--test', '--test-timeout=180000', ...files], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
