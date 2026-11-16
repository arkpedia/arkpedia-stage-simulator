// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1409_bdguad=5635961037176963177,enemy_1409_bdguad_2=-3333198760459745538','--bundle','refs/arts/enm_art_15.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-mateo-guards-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
