// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1301_ymcnon=1595492678832508912,enemy_1301_ymcnon_2=3128985909320718229,enemy_1302_ymtro=4741603484814735697,enemy_1302_ymtro_2=-8512711822767342516','--bundle','refs/arts/enm_art_12.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-yumen-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
