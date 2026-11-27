// SPDX-License-Identifier: GPL-3.0-or-later
// Skeleton clip durations and events of the Miner Guerrilla (chapter 16).
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_3010_mcreep=-16971180702045977','--bundle','refs/arts/enm_art_23.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-miner-guerrilla-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
