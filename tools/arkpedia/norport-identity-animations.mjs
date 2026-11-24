// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1314_wdnjd=-4313364761861304977,enemy_1313_wdfmr=-6669987968522224,enemy_1314_wdnjd_2=-8169502879889591884,enemy_1315_wdyjd=-5532566391044890842,enemy_1315_wdyjd_2=-7192380726234116972','--bundle','refs/arts/enm_art_12.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-norport-identity-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
