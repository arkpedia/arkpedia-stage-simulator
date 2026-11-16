// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1403_gunsho=6683520227705005287,enemy_1403_gunsho_2=2934868986773555874','--bundle','refs/arts/enm_art_15.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-rapid-crossbowmen-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
