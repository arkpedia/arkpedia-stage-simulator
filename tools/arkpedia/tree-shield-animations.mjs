// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_10069_ftlsj=8909471796082922533,enemy_10069_ftlsj_2=7905785143493524928',
 '--bundle','refs/arts/enm_art_2.ab','--out',new URL('data/arkpedia-tree-shield-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
