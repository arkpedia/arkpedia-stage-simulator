// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1336_bldbat=5014754861136983269,enemy_1336_bldbat_2=5961476571731294405,enemy_1337_bhrknf=-6459713273693935656,enemy_1337_bhrknf_2=3782431769318004479','--bundle','refs/arts/enm_art_13.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-holy-escort-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
