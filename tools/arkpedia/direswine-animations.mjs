// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1309_mhboar=-1316647813190652528,enemy_1309_mhboar_2=-660078112609906309','--bundle','refs/arts/enm_art_12.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-direswine-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
