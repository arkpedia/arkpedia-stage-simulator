// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1395_dhxts=-6469954086230028815,enemy_1395_dhxts_2=-4835575754173873491','--bundle','refs/arts/enm_art_15.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-fieldmus-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
