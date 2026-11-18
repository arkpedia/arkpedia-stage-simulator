// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1528_manfri=-7001052755818635206','--bundle','refs/arts/enm_art_17.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-manfred-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
