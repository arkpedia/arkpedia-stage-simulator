// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1280_sgmag=8721009203627879371,enemy_1280_sgmag_2=-1394630585104639354','--bundle','refs/arts/enm_art_11.ab',
 '--out',new URL('data/arkpedia-famiglia-casters-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
