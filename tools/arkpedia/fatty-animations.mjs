// SPDX-License-Identifier: GPL-3.0-or-later
// Reuse the checksum-pinned skeleton reader; retain clocks, never duplicate art.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../', import.meta.url), temp = await mkdtemp(join(tmpdir(), 'arkpedia-fatty-'));
try {
  const enemies = {};
  for (const [id, object] of Object.entries({ enemy_2085_skzjxd: '9036975560774811546' })) {
    const out = join(temp, `${id}.json`);
    execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
      '--enemy', id, '--bundle', 'refs/arts/enm_art_19.ab', '--skeleton-data', object, '--out', out], { stdio: 'pipe' });
    enemies[id] = JSON.parse(await readFile(out, 'utf8'));
  }
  const bytes = JSON.stringify({ schemaVersion: 1, enemies }, null, 1) + '\n', path = new URL('data/arkpedia-fatty-animations.json', root);
  if (process.argv.includes('--write')) await writeFile(path, bytes);
  else if (await readFile(path, 'utf8') !== bytes) throw Error('Fatty native animation clocks changed');
  console.log('Verified Fatty skeleton clocks from one shared original bundle');
} finally { await rm(temp, { recursive: true, force: true }); }
