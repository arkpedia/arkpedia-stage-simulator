// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
  '--enemies','enemy_2035_sybox=-2695074516067127131,enemy_2059_smbox=2975731365203512875',
  '--bundle','refs/arts/enm_art_18.ab','--out',new URL('data/arkpedia-is-chests-animations.json',root).pathname,
  ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
