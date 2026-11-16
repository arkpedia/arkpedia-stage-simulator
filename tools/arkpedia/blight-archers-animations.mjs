// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1391_dhbow=-8504973000470281051,enemy_1391_dhbow_2=-6305943158563327058',
 '--bundle','refs/arts/enm_art_15.ab','--out',new URL('data/arkpedia-blight-archers-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
