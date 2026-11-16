// SPDX-License-Identifier: GPL-3.0-or-later
// Source registry dependency: import this in the build, or explicitly for legacy
// compatibility. Ordinary browser stage plans need only enemy-runtime-plan.js.
import { enemyFeature,recordFeatureIds } from './enemy-features.js';
import { validateEnemyRuntimePlan } from './enemy-runtime-plan.js';
function jsonCopy(v,path,inArray=false){
  if(v===undefined){if(inArray)throw Error(`Undefined enemy runtime array value: ${path}`);return undefined;}
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){
    if(Number.isFinite(v))return v;
    if(v===Infinity||v===-Infinity)return {$infinity:Math.sign(v)};
    throw Error(`Invalid enemy runtime number: ${path}`);
  }
  if(Array.isArray(v))return v.map((x,i)=>jsonCopy(x,`${path}[${i}]`,true));
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error(`Non-JSON enemy runtime value: ${path}`);
  if(Object.hasOwn(v,'$infinity'))throw Error(`Reserved enemy runtime field: ${path}.$infinity`);
  return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,jsonCopy(x,`${path}.${k}`)]));
}
/** This compiles existing reviewed registrations; it does not grant admission.
 * The stage/source pipeline must approve the whole record and its dependencies. */
export function compileEnemyRuntimePlan(record){
  if(!Array.isArray(record?.abilities)||!record.talents?.groups)throw Error('Missing compiled enemy source record');
  const ids=recordFeatureIds(record),plan={schemaVersion:1,properties:{},entries:[]};
  for(const id of ids){
    const f=enemyFeature(id);
    if(!f){
      const explained=id.startsWith('ability:')&&ids.some(key=>{
        const other=enemyFeature(key),explain=other?.explains;if(!explain||other.matchesRecord&&!other.matchesRecord(record))return false;
        return typeof explain==='function'?explain(id.slice(8),record):explain.test(id.slice(8));
      });
      if(explained)continue;
      throw Error(`Unknown enemy runtime feature: ${record.key}/${id}`);
    }
    if(f.matchesRecord&&!f.matchesRecord(record))throw Error(`Unmatched enemy runtime feature: ${record.key}/${id}`);
    Object.assign(plan.properties,f.unitProperties);
    const entry={id},trait=typeof f.trait==='function'?f.trait(record):f.trait;if(trait)entry.trait=jsonCopy(trait,`${id}.trait`);
    const ability=typeof f.ability==='function'?f.ability(record):f.ability;
    if(ability)entry.ability={kind:ability.kind,params:jsonCopy(ability.params(record),`${id}.params`)};
    if(entry.trait||entry.ability)plan.entries.push(entry);
  }
  try { return validateEnemyRuntimePlan(plan); }
  catch (error) { throw Error(`Cannot compile enemy runtime ${record.key}: ${error.message}`, { cause: error }); }
}
export function withCompiledEnemyRuntime(record){
  const runtimeFeatures=compileEnemyRuntimePlan(record);
  return {...record,...runtimeFeatures.properties,runtimeFeatures};
}
