// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1436_dsdivi=-282257481502223893,enemy_1436_dsdivi_2=2312430391285833972','--bundle','refs/arts/enm_art_16.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-hoarder-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
