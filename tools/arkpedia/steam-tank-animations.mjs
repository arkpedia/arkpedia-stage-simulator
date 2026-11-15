// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1273_stmgun=1989223886905190928,enemy_1273_stmgun_2=-2045862977176191393',
  '--bundle', 'refs/arts/enm_art_11.ab', '--out', new URL('data/arkpedia-steam-tank-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
