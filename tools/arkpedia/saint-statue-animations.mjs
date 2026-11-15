// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_10091_hlsttu=4349232325680407457,enemy_10091_hlsttu_2=-4005190999065644100,enemy_10091_hlsttu_3=-3422021676567450683',
 '--bundle','refs/arts/enm_art_3.ab','--out',new URL('data/arkpedia-saint-statues-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
