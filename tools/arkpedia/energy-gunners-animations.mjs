// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1356_egun=1004825868861525380,enemy_1356_egun_2=8001369709699570000','--bundle','refs/arts/enm_art_14.ab',
 '--out',new URL('data/arkpedia-energy-gunners-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
