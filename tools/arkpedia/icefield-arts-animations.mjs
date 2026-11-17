// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1191_krgrg=4779599741414520936,enemy_1191_krgrg_2=5288523179177842011','--bundle','refs/arts/enm_art_8.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-icefield-arts-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
