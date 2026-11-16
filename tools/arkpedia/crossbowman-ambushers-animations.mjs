// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('tools/arkpedia/enemy-animation.mjs',root)),
 '--enemies','enemy_1404_msnip=-8264431151859678172,enemy_1404_msnip_2=-887669619055698158','--bundle','refs/arts/enm_art_15.ab',
 '--out',fileURLToPath(new URL('data/arkpedia-crossbowman-ambushers-animations.json',root)),
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
