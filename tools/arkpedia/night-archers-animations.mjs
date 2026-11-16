// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1179_aruarw=-756770567786157463,enemy_1179_aruarw_2=5905971725401045270',
 '--bundle','refs/arts/enm_art_8.ab','--out',new URL('data/arkpedia-night-archers-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
