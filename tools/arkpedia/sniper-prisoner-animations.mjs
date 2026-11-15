// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1117_liiprr=-5548342750678671340,enemy_1117_liiprr_2=100317983313061434',
  '--bundle', 'refs/arts/enm_art_6.ab', '--out', new URL('data/arkpedia-sniper-prisoner-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
