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

const total = Math.max(1, Number(process.env.SHARD_TOTAL ?? 1));
const index = Math.min(total - 1, Math.max(0, Number(process.env.SHARD_INDEX ?? 0)));
const files = readdirSync(new URL('../test/', import.meta.url))
  .filter(name => name.endsWith('.test.js')).sort()
  .filter((_, i) => i % total === index)
  .map(name => new URL(`../test/${name}`, import.meta.url).pathname);
const result = spawnSync(process.execPath, ['--test', '--test-timeout=180000', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
