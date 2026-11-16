// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1283_sgkill=-8934074136640742770,enemy_1283_sgkill_2=383919347981382391','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-famiglia-silencers-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
