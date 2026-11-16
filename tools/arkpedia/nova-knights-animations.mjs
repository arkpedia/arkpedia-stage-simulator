// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1184_cadkgt=2654293143167471934,enemy_1184_cadkgt_2=7969323950438751129,enemy_1184_cadkgt_3=-1442741653851614200','--bundle','refs/arts/enm_art_8.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-nova-knights-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
