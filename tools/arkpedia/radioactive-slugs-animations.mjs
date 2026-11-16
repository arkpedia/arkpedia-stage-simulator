// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1352_eslime=4415916825554646079,enemy_1352_eslime_2=6282379860064709252','--bundle','refs/arts/enm_art_13.ab',
 '--out',new URL('data/arkpedia-radioactive-slugs-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
