// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1107_uoffcr=4538701044612934400,enemy_1107_uoffcr_2=-2691259699679459215,enemy_1111_ucommd=3960748587645394362,enemy_1111_ucommd_2=2609386922966502771','--bundle','refs/arts/enm_art_6.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-patrol-captain-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
