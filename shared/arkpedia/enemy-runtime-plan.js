// SPDX-License-Identifier: GPL-3.0-or-later
const SPAWN_COUNTS=Object.freeze({deathSpawn:'cnt',deathSpawnDelayed:'cnt',periodicSpawn:'count',seedSummoner:'count'});
const object=(v,path)=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))
    throw Error(`Invalid enemy runtime plan object: ${path}`);
};
const keys=(v,allowed,path)=>{
  object(v,path);for(const key of Object.keys(v))if(!allowed.includes(key))throw Error(`Unknown enemy runtime plan field: ${path}.${key}`);
};
function jsonValue(v,path){
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(Array.isArray(v)){v.forEach((x,i)=>jsonValue(x,`${path}[${i}]`));return;}
  object(v,path);
  if(Object.hasOwn(v,'$infinity')){
    if(Object.keys(v).length!==1||![1,-1].includes(v.$infinity))throw Error(`Invalid enemy runtime infinity: ${path}`);
    return;
  }
  for(const[k,x]of Object.entries(v))jsonValue(x,`${path}.${k}`);
}
/** A data plan is never executable source code. Runtime kinds resolve through a
 * fixed adapter registry, while source predicates remain in the content build. */
export function validateEnemyRuntimePlan(plan,{knownKinds}={}){
  keys(plan,['schemaVersion','properties','entries'],'plan');
  if(plan.schemaVersion!==1||!Array.isArray(plan.entries))throw Error('Invalid enemy runtime plan schema');
  keys(plan.properties,['side'],'properties');
  if(plan.properties.side!==undefined&&!['ally','enemy','neutral'].includes(plan.properties.side))throw Error('Invalid enemy runtime plan side');
  for(const[i,entry]of plan.entries.entries()){
    const path=`entries[${i}]`;keys(entry,['id','trait','ability'],path);
    if(typeof entry.id!=='string'||!/^(ability|talent|skill|native):.+/.test(entry.id)||!entry.trait&&!entry.ability)
      throw Error(`Invalid enemy runtime feature: ${path}`);
    if(entry.trait){
      keys(entry.trait,['flags','maxTargets'],`${path}.trait`);
      if(entry.trait.flags!==undefined){object(entry.trait.flags,`${path}.flags`);
        if(Object.values(entry.trait.flags).some(v=>typeof v!=='boolean'))throw Error(`Invalid enemy runtime flags: ${path}`);}
      if(entry.trait.maxTargets!==undefined&&(!Number.isSafeInteger(entry.trait.maxTargets)||entry.trait.maxTargets<1))
        throw Error(`Invalid enemy runtime target count: ${path}`);
    }
    if(entry.ability){
      keys(entry.ability,['kind','params'],`${path}.ability`);const{kind,params}=entry.ability;
      if(typeof kind!=='string'||!/^[A-Za-z]\w*$/.test(kind)||knownKinds&&!knownKinds.has(kind))throw Error(`Unknown enemy runtime kind: ${kind}`);
      object(params,`${path}.params`);
      if(Object.hasOwn(params,'$infinity'))throw Error(`Invalid enemy runtime parameters: ${path}`);
      if(Object.hasOwn(SPAWN_COUNTS,kind)){
        const count=params[SPAWN_COUNTS[kind]];
        if(typeof params.key!=='string'||!/^enemy_[a-z0-9_]+$/i.test(params.key)||!Number.isSafeInteger(count)||count<0)
          throw Error(`Invalid enemy spawn parameters: ${path}/${kind}`);
      }
    }
  }
  jsonValue(plan,'plan');
  return plan;
}

/** Standard spawning primitives expose their required enemy records in data.
 * Custom controllers retain their explicitly reviewed source dependencies. */
export function enemyRuntimeSpawnDependencies(plan){
  validateEnemyRuntimePlan(plan);
  return [...new Set(plan.entries.filter(e=>e.ability&&Object.hasOwn(SPAWN_COUNTS,e.ability.kind))
    .map(e=>e.ability.params.key))];
}

/** Restore tagged timer sentinels and give every factory its own parameters. */
export function decodeEnemyRuntimeParameters(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(decodeEnemyRuntimeParameters);
  if(Object.hasOwn(value,'$infinity'))return value.$infinity*Infinity;
  return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,decodeEnemyRuntimeParameters(v)]));
}
