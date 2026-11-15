// SPDX-License-Identifier: GPL-3.0-or-later
// Reuse the checksum-pinned skeleton reader; retain clocks, never duplicate art.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../', import.meta.url), temp = await mkdtemp(join(tmpdir(), 'arkpedia-wine-'));
try {
  const enemies = {};
  for (const [id, object] of Object.entries({ enemy_1205_sfpin: '-4378531215811737066', enemy_1205_sfpin_2: '-8634423613109443032', enemy_1207_sfji: '4706342916198602597', enemy_1207_sfji_2: '774540763535154623', enemy_1209_sfden: '7526154072574057689', enemy_1209_sfden_2: '-9007726332142437788' })) {
    const out = join(temp, `${id}.json`);
    execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
      '--enemy', id, '--bundle', 'refs/arts/enm_art_9.ab', '--skeleton-data', object, '--out', out], { stdio: 'pipe' });
    enemies[id] = JSON.parse(await readFile(out, 'utf8'));
  }
  const bytes = JSON.stringify({ schemaVersion: 1, enemies }, null, 1) + '\n', path = new URL('data/arkpedia-wine-animations.json', root);
  if (process.argv.includes('--write')) await writeFile(path, bytes);
  else if (await readFile(path, 'utf8') !== bytes) throw Error('Wine-family native animation clocks changed');
  console.log('Verified Wine-family skeleton clocks from one shared original bundle');
} finally { await rm(temp, { recursive: true, force: true }); }
