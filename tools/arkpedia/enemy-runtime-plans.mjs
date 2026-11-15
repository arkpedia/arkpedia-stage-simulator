// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { compileEnemyRuntimePlan } from '../../shared/arkpedia/enemy-runtime-compiler.js';
import { validateEnemyRuntimePlan,enemyRuntimeSpawnDependencies } from '../../shared/arkpedia/enemy-runtime-plan.js';
import { ENEMY_FEATURE_ABILITY_KINDS } from '../../server/sim/content/arkpedia-enemy-features.js';
import { writeJSONAtomic } from './write-json.mjs';
const root=new URL('../../',import.meta.url),sha=v=>createHash('sha256').update(v).digest('hex');
export function auditEnemyRuntimePlans(records,support){
  const plans=[],kinds=new Map(),knownKinds=new Set(ENEMY_FEATURE_ABILITY_KINDS);
  let entries=0,abilities=0,traits=0,properties=0;
  for(const[id,entry]of Object.entries(records).sort(([a],[b])=>a.localeCompare(b)))if(support[id]?.policy)
    for(const record of Object.values(entry.levels)){
      const plan=validateEnemyRuntimePlan(compileEnemyRuntimePlan(record),{knownKinds});
      for(const child of enemyRuntimeSpawnDependencies(plan))if(!(support[id].spawns??[]).includes(child))
        throw Error(`Undeclared enemy runtime spawn dependency: ${id} -> ${child}`);
      plans.push({id,level:record.level,plan});properties+=Object.keys(plan.properties).length;entries+=plan.entries.length;
      for(const entry of plan.entries){if(entry.trait)traits++;if(entry.ability){abilities++;kinds.set(entry.ability.kind,(kinds.get(entry.ability.kind)??0)+1);}}
    }
  const bytes=JSON.stringify(plans)+'\n';
  return {records:plans.length,entries,abilities,traits,properties,serializedBytes:Buffer.byteLength(bytes),plansSha256:sha(bytes),
    kinds:[...kinds].sort(([a],[b])=>a.localeCompare(b)).map(([kind,instances])=>({kind,instances}))};
}
export async function buildEnemyRuntimePlanReport(){
  const inputs=['data/arkpedia-enemy-records.json','data/arkpedia-enemy-support.json','shared/arkpedia/enemy-runtime-compiler.js','shared/arkpedia/enemy-runtime-plan.js'];
  const raw=await Promise.all(inputs.map(p=>readFile(new URL(p,root))));
  return {schemaVersion:1,scope:'Compiled execution plans for already-admitted records; source admission remains separate. Plans belong in shared enemy-definition components, not a duplicated global payload.',
    source:Object.fromEntries(inputs.map((p,i)=>[p,sha(raw[i])])),
    summary:auditEnemyRuntimePlans(JSON.parse(raw[0]).enemies,JSON.parse(raw[1]).enemies)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=await buildEnemyRuntimePlanReport(),out=new URL('data/arkpedia-enemy-runtime-plan-report.json',root);
  if(process.argv.includes('--check')){
    if(JSON.stringify(report)!==JSON.stringify(JSON.parse(await readFile(out,'utf8'))))throw Error('Enemy runtime plan report is stale');
  }else if(process.argv.includes('--write'))await writeJSONAtomic(out,report);
  const {kinds,...summary}=report.summary;console.log(JSON.stringify({...summary,kinds:kinds.length}));
}
