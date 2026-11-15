// SPDX-License-Identifier: GPL-3.0-or-later
import { ENEMY_RUNTIME_INDEX } from './arkpedia-enemy-runtime-index.js';
import { validateEnemyRuntimePlan,enemyRuntimeSpawnDependencies } from '../../../shared/arkpedia/enemy-runtime-plan.js';
import { applyCompiledEnemyFeatures } from './arkpedia-enemy-plan.js';

export function createEnemyRuntime(index=ENEMY_RUNTIME_INDEX,{legacy=null}={}){
  const owners=new Map(),keys=new Set(),loaded=new Map(),pending=new Map(),factories=new Map();
  for(const entry of index){
    if(keys.has(entry.key))throw Error(`Duplicate enemy runtime module: ${entry.key}`);
    keys.add(entry.key);
    for(const kind of Object.keys(entry.exports)){
      if(owners.has(kind))throw Error(`Duplicate enemy runtime kind: ${kind}`);
      owners.set(kind,entry);
    }
  }
  const knownKinds=new Set(owners.keys());
  const load=entry=>{
    if(loaded.has(entry.key))return Promise.resolve();
    if(pending.has(entry.key))return pending.get(entry.key);
    const promise=Promise.resolve().then(entry.load).then(module=>{
      const resolved=Object.entries(entry.exports).map(([kind,path])=>{
        let value=module;for(const key of path.split('.'))value=value?.[key];
        if(typeof value!=='function')throw Error(`Missing enemy runtime export: ${entry.key}/${path}`);
        return [kind,value];
      });
      for(const[kind,make]of resolved)factories.set(kind,make);
      loaded.set(entry.key,true);
    }).finally(()=>pending.delete(entry.key));
    pending.set(entry.key,promise);return promise;
  };
  const kindsFor=records=>{
    const kinds=new Set();
    for(const record of Object.values(records)){
      const plan=record.runtimeFeatures;
      if(!plan){
        if(!legacy&&record.abilities&&record.talents?.groups)throw Error(`Enemy plan must be prepared: ${record.key}`);
        continue;
      }
      validateEnemyRuntimePlan(plan,{knownKinds});
      for(const child of enemyRuntimeSpawnDependencies(plan))if(!Object.hasOwn(records,child))
        throw Error(`Missing enemy runtime spawn dependency: ${record.key} -> ${child}`);
      for(const entry of plan.entries)if(entry.ability)kinds.add(entry.ability.kind);
    }
    return [...kinds];
  };
  const validateRecords=records=>{
    for(const record of Object.values(records))for(const entry of record.runtimeFeatures?.entries??[]){
      if(entry.ability)factories.get(entry.ability.kind)?.validate?.(entry.ability.params);
    }
  };
  const runtime={
    async prepareKinds(kinds){
      const entries=new Set(kinds.map(kind=>{
        const entry=owners.get(kind);if(!entry)throw Error(`Unknown enemy runtime kind: ${kind}`);return entry;
      }));
      await Promise.all([...entries].map(load));return runtime;
    },
    prepare(records){
      // Keep synchronous plan/dependency refusal before starting any imports.
      const kinds=kindsFor(records);
      return runtime.prepareKinds(kinds).then(()=>{validateRecords(records);return runtime;});
    },
    assertPrepared(records){
      for(const kind of kindsFor(records))if(!factories.has(kind))throw Error(`Enemy runtime must be prepared: ${kind}`);
      validateRecords(records);
    },
    record(record){
      const plan=record.runtimeFeatures;
      return plan?{...record,...plan.properties}:legacy?legacy.enemyRuntimeRecord(record):record;
    },
    apply(battle,e){
      const record=e.def?.raw;
      if(record?.runtimeFeatures)return applyCompiledEnemyFeatures(battle,e,record.runtimeFeatures,kind=>factories.get(kind));
      if(legacy)return legacy.applyLegacyEnemyFeatures(battle,e,kind=>factories.get(kind));
      if(record?.abilities&&record.talents?.groups)throw Error(`Enemy plan must be prepared: ${record.key}`);
    },
    stats:()=>({loaded:[...loaded.keys()],pending:pending.size}),
  };
  return Object.freeze(runtime);
}

export const ENEMY_FEATURE_ABILITY_KINDS=Object.freeze(ENEMY_RUNTIME_INDEX.flatMap(entry=>Object.keys(entry.exports)));
// Keep the synchronous Node constructor and source tools compatible. Browsers
// do not import the source predicate registry or eagerly load family adapters.
const legacy=typeof process!=='undefined'&&process.versions?.node
  ?await import('./arkpedia-enemy-runtime-legacy.js'):null;
const defaultRuntime=createEnemyRuntime(ENEMY_RUNTIME_INDEX,{legacy});
if(legacy)await defaultRuntime.prepareKinds(ENEMY_FEATURE_ABILITY_KINDS);
export const enemyRuntimeFor=runtime=>runtime??defaultRuntime;
export async function prepareRegularEnemyRuntime(records){
  let prepared=records;
  if(Object.values(records).some(r=>!r.runtimeFeatures&&r.abilities&&r.talents?.groups)){
    const {withCompiledEnemyRuntime}=await import('../../../shared/arkpedia/enemy-runtime-compiler.js');
    prepared=Object.fromEntries(Object.entries(records).map(([id,r])=>[id,
      !r.runtimeFeatures&&r.abilities&&r.talents?.groups?withCompiledEnemyRuntime(r):r]));
  }
  await defaultRuntime.prepare(prepared);
  return {runtime:defaultRuntime,records:prepared};
}
export function applyEnemyFeatures(battle,e){enemyRuntimeFor(battle.enemyRuntime).apply(battle,e);}
export function installEnemyFeatures(battle){
  if(battle.regularEnemyFeatures)return;
  battle.regularEnemyFeatures=true;
  const runtime=enemyRuntimeFor(battle.enemyRuntime);
  battle.on('enemySpawn',({enemy})=>runtime.apply(battle,enemy),{priority:90});
}
