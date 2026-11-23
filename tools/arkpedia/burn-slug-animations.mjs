// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1305_mhslim=5962095231994090590,enemy_1305_mhslim_2=-1949804081992245174','--bundle','refs/arts/enm_art_12.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-burn-slug-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
