// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1331_cbsisy=-9063943835939959925,enemy_1331_cbsisy_2=-2540165510286881012','--bundle','refs/arts/enm_art_13.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-crossroads-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
