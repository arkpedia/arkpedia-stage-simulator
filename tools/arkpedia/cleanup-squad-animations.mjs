// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1183_mlasrt=6315542237654064427,enemy_1183_mlasrt_2=-7526257538888222654,enemy_1183_mlasrt_3=-2422321923112380689','--bundle','refs/arts/enm_art_8.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-cleanup-squad-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
