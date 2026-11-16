// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1359_ekulsr=4890555101341175697,enemy_1359_ekulsr_2=637445590981308224','--bundle','refs/arts/enm_art_14.ab',
 '--out',new URL('data/arkpedia-energy-grenadiers-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
