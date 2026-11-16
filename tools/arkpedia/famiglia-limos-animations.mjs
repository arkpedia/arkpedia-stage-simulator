// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1281_sgcar=-1318233076263110061,enemy_1281_sgcar_2=8150002487718984861','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-famiglia-limos-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
