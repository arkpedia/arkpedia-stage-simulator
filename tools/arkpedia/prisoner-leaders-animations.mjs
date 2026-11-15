// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
execFileSync(process.execPath, [new URL('tools/arkpedia/enemy-animation.mjs', root).pathname,
  '--enemies', 'enemy_1120_vofwiz=-8182732163574497318,enemy_1120_vofwiz_2=-3876663662765486313,enemy_1121_lifbos=5788104836286193759,enemy_1121_lifbos_2=2224420752796515290',
  '--bundle', 'refs/arts/enm_art_6.ab', '--out', new URL('data/arkpedia-prisoner-leaders-animations.json', root).pathname,
  ...(process.argv.includes('--write') ? [] : ['--check'])], { stdio: 'inherit' });
