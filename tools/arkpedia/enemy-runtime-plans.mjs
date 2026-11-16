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
  const inputs=['data/arkpedia-enemy-records.json','data/arkpedia-enemy-support.json','shared/arkpedia/enemy-runtime-compiler.js','shared/arkpedia/enemy-runtime-plan.js','shared/arkpedia/behavior.js','shared/arkpedia/behavior-native-compiler.js','shared/arkpedia/behavior-program.js','shared/arkpedia/native-buff-programs.js','shared/arkpedia/enemy-gnawbeast-features.js','shared/arkpedia/enemy-zealous-extra-features.js','shared/arkpedia/enemy-inspiration-features.js','shared/arkpedia/enemy-siegebreaker-features.js','data/arkpedia-siegebreaker-animations.json','shared/arkpedia/enemy-ordinary-body-contract.js','shared/arkpedia/enemy-tree-shield-features.js','data/arkpedia-tree-shield-animations.json','shared/arkpedia/enemy-weaksauce-features.js','shared/arkpedia/enemy-night-crawler-features.js','shared/arkpedia/enemy-expletive-features.js','data/arkpedia-expletives-animations.json','shared/arkpedia/enemy-redmark-features.js','shared/arkpedia/enemy-marked-target-contract.js','data/arkpedia-redmark-animations.json','shared/arkpedia/enemy-silvernwhite-features.js','shared/arkpedia/enemy-night-archer-features.js','data/arkpedia-night-archers-animations.json','shared/arkpedia/enemy-ordinary-projectile-contract.js','shared/arkpedia/enemy-cosmetic-marker-contract.js','shared/arkpedia/environment-conditions.js','shared/arkpedia/enemy-mode-program-contract.js','shared/arkpedia/enemy-blight-archer-features.js','data/arkpedia-blight-archers-animations.json','shared/arkpedia/enemy-funlive-caster-features.js','data/arkpedia-funlive-caster-animations.json','shared/arkpedia/enemy-energy-features.js','data/arkpedia-energy-basics-animations.json','data/arkpedia-energy-grenadiers-animations.json','data/arkpedia-energy-siphons-animations.json','shared/arkpedia/enemy-energy-siphon-contract.js','shared/arkpedia/enemy-blocker-features.js','shared/arkpedia/enemy-radioactive-features.js','data/arkpedia-radioactive-slugs-animations.json','shared/arkpedia/enemy-energy-grant-contract.js','shared/arkpedia/enemy-energy-gunner-contract.js','data/arkpedia-energy-gunners-animations.json','shared/arkpedia/enemy-device-sp-selector-contract.js','shared/arkpedia/enemy-famiglia-capo-features.js','data/arkpedia-famiglia-capos-animations.json','shared/arkpedia/enemy-famiglia-silencer-features.js','data/arkpedia-famiglia-silencers-animations.json','shared/arkpedia/enemy-famiglia-crossbow-features.js','data/arkpedia-famiglia-crossbows-animations.json','shared/arkpedia/enemy-famiglia-basic-features.js','data/arkpedia-famiglia-basics-animations.json'];
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
