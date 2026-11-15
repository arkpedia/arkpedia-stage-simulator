// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_10053_cjman=5457153408077260336,enemy_10053_cjman_2=-4296197889963389982',
 '--bundle','refs/arts/enm_art_1.ab','--out',new URL('data/arkpedia-expletives-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
