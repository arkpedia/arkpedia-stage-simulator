// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1284_sgprst=-6997933834898437818','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-father-agenir-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
