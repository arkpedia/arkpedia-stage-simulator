// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemy', 'enemy_2064_skzwdd', '--skeleton-data', '-8788707973973813442',
  '--bundle', 'refs/arts/enm_art_18.ab', '--out', new URL('data/arkpedia-epoch-guard-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
