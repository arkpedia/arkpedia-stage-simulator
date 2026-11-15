// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1083_sotiab=6200389280342159615,enemy_1083_sotiab_2=-5742383627045057715',
 '--bundle','refs/arts/enm_art_5.ab','--out',new URL('data/arkpedia-siegebreaker-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
