// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1135_redman=1331913336844621531,enemy_1135_redman_2=-8321477094592173280',
 '--bundle','refs/arts/enm_art_7.ab','--out',new URL('data/arkpedia-redmark-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
