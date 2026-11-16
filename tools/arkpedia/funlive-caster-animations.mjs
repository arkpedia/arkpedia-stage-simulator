// SPDX-License-Identifier: GPL-3.0-or-later
// The Funlive actor's native pointer resolves to the original Tidal Caster model.
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1161_tidmag=-1180307233293427410','--bundle','refs/arts/enm_art_7.ab',
 '--out',new URL('data/arkpedia-funlive-caster-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
