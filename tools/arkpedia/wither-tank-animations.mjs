// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1272_nhtank=9202233703098706818,enemy_1272_nhtank_2=-9180384780473252899',
  '--bundle', 'refs/arts/enm_art_11.ab', '--out', new URL('data/arkpedia-wither-tank-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
