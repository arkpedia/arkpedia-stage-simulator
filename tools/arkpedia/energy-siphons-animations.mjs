// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1357_erob=-5624606218061335799,enemy_1357_erob_2=4894637233131217355','--bundle','refs/arts/enm_art_14.ab',
 '--out',new URL('data/arkpedia-energy-siphons-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
