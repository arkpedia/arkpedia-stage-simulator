// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1505_frstar=3483174873636308446','--bundle','refs/arts/enm_art_16.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-frostnova-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
