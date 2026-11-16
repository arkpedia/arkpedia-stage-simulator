// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1277_sgman=5329379906046069950,enemy_1277_sgman_2=-4086878585508783806,enemy_1279_sgbdg=-5052178529751414279,enemy_1279_sgbdg_2=3325508586038096516','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-famiglia-basics-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
