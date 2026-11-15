// SPDX-License-Identifier: GPL-3.0-or-later
import { validateEnemyRuntimePlan,decodeEnemyRuntimeParameters } from '../../../shared/arkpedia/enemy-runtime-plan.js';
import { installFeatureDispatch,attach,abOf } from './enemies.js';
/** Resolve every implementation before applying traits. Parameters belong to
 * each spawned unit; a factory must never mutate the shared definition plan. */
export function applyCompiledEnemyFeatures(b,e,plan,factoryFor){
  validateEnemyRuntimePlan(plan);
  const factories=plan.entries.map(entry=>{
    if(!entry.ability)return null;const make=factoryFor(entry.ability.kind);
    if(typeof make!=='function')throw Error(`Enemy runtime must be prepared: ${entry.ability.kind}`);
    return make;
  });
  const abilities=[];
  for(const[i,entry]of plan.entries.entries()){
    if(entry.trait?.flags)b.addBuff(e,{key:`feature:${entry.id}`,persist:true,flags:{...entry.trait.flags}});
    if(entry.trait?.maxTargets)e.profile.maxTargets=Math.max(e.profile.maxTargets??1,entry.trait.maxTargets);
    if(entry.ability){
      const made=factories[i](decodeEnemyRuntimeParameters(entry.ability.params),abOf(b,e));
      abilities.push(...(Array.isArray(made)?made:[made]));
    }
  }
  if(abilities.length){installFeatureDispatch(b);abOf(b,e);attach(b,e,abilities);}
}
