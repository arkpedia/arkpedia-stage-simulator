// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1271_nhkodo=-668214248665293245,enemy_1271_nhkodo_2=801324314280126109',
  '--bundle', 'refs/arts/enm_art_11.ab', '--out', new URL('data/arkpedia-devour-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
