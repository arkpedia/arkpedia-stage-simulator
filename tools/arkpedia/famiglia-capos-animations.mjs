// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1282_sgelder=-5881845666497824147,enemy_1282_sgelder_2=1908085499065874108','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-famiglia-capos-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
