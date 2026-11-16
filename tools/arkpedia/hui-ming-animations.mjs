// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,
 '--enemies','enemy_1122_sphond=-2714860477998190148,enemy_1122_sphond_2=5674450065122067948,enemy_1123_spsbr=3716717183293032314,enemy_1123_spsbr_2=-7921410699740563898,enemy_1125_spshld=5771554369020663909,enemy_1125_spshld_2=-596045144399930764,enemy_1129_spklr=8915391728947845772,enemy_1129_spklr_2=2542725864148462613','--bundle','refs/arts/enm_art_6.ab',
 '--out',new URL('data/arkpedia-hui-ming-animations.json',root).pathname,
 ...(process.argv.includes('--write')?[]:['--check'])],{stdio:'inherit'});
