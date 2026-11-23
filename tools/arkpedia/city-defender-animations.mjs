// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1326_cbagen=7733458867838728257,enemy_1326_cbagen_2=2056848631157128036','--bundle','refs/arts/enm_art_13.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-city-defender-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
