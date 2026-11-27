// SPDX-License-Identifier: GPL-3.0-or-later
// Skeleton clip durations and events of PRTS, Source Code and the Mimic Machine (15-20, H15-4).
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1564_mpprts=-5100217597968346131,enemy_1565_mpprme=1909679067247867287','--bundle','refs/arts/enm_art_17.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-prts-source-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
