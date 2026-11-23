// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1233_dsshtr=1326660307245755575,enemy_1233_dsshtr_2=-6921777121487611603,enemy_1231_dsrunr=-6853188196170296224,enemy_1231_dsrunr_2=-9163654563106963484','--bundle','refs/arts/enm_art_10.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-nethersea-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
