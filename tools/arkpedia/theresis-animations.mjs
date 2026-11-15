// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemy', 'enemy_1276_telex', '--skeleton-data', '265397301853472509',
  '--bundle', 'refs/arts/enm_art_11.ab', '--out', new URL('data/arkpedia-theresis-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
