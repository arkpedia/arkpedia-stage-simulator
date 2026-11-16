// SPDX-License-Identifier: GPL-3.0-or-later
// Download and verify every original level referenced by data/stage-rules/levels
// into the ignored cache, a few at a time, so test runs never wait on the network.
//
//   node tools/arkpedia/fetch-original-levels.mjs [--concurrency 8]
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readOriginalLevel } from './original-level.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const at = process.argv.indexOf('--concurrency');
const concurrency = Math.max(1, Math.min(32, Number(at > 0 ? process.argv[at + 1] : 8) || 8));
const directory = join(root, 'data/stage-rules/levels');
const receipts = new Map();
for (const name of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
  const receipt = JSON.parse(await readFile(join(directory, name), 'utf8'));
  if (receipt.source?.gitBlob) receipts.set(receipt.source.gitBlob, receipt);
}
const queue = [...receipts.values()], failures = [];
let done = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let receipt; (receipt = queue.shift());) {
    try { await readOriginalLevel(root, receipt); }
    catch (error) { failures.push(`${receipt.source.path}: ${error.message}`); }
    if (++done % 500 === 0) console.log(`${done}/${receipts.size} original levels verified`);
  }
}));
console.log(`${receipts.size - failures.length}/${receipts.size} original levels verified in the cache`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
