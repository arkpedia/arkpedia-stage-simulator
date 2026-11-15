// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1335_bldrat=-4078928436144494329,enemy_1335_bldrat_2=-1730900188604628001',
 '--bundle','refs/arts/enm_art_13.ab','--out',new URL('data/arkpedia-gnawbeasts-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
