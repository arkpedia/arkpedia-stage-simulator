// SPDX-License-Identifier: GPL-3.0-or-later
// One pinned bundle supplies both original bodies' exact animation clocks.
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1268_nhnrs=533820154146559794,enemy_1268_nhnrs_2=5951436638497002591',
  '--bundle', 'refs/arts/enm_art_11.ab', '--out', new URL('data/arkpedia-wither-caster-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
