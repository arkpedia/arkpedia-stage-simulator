// SPDX-License-Identifier: GPL-3.0-or-later
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),temp=await mkdtemp(join(tmpdir(),'arkpedia-energy-clocks-'));
try{
 const groups=[['refs/arts/enm_art_13.ab','enemy_1353_esabr=-3517056746942467865,enemy_1353_esabr_2=-5471566647126872838,enemy_1354_eghost=8896984313673433235,enemy_1354_eghost_2=-42220714082475620'],
  ['refs/arts/enm_art_14.ab','enemy_1358_esheld=6981425481858469663,enemy_1358_esheld_2=-3567244293963698436']];
 const result={schemaVersion:1,enemies:{}};
 for(const[index,[bundle,enemies]]of groups.entries()){
  const out=join(temp,`${index}.json`);execFileSync(process.execPath,[new URL('tools/arkpedia/enemy-animation.mjs',root).pathname,'--bundle',bundle,'--enemies',enemies,'--out',out],{stdio:'inherit'});
  Object.assign(result.enemies,JSON.parse(await readFile(out)).enemies);
 }
 const out=new URL('data/arkpedia-energy-basics-animations.json',root);
 if(process.argv.includes('--write'))await writeJSONAtomic(out,result);
 else if(JSON.stringify(JSON.parse(await readFile(out)))!==JSON.stringify(result))throw Error('Changed native energy animation clocks');
}finally{await rm(temp,{recursive:true,force:true});}
