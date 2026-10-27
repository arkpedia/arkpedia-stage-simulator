// SPDX-License-Identifier: GPL-3.0-or-later
// Default Entity.AddBuff overloads. BuffDB lookup/exception construction and
// container admission remain explicit receivers; no outer lifecycle guard.
export function fearProjectileEntityBuffContainer(entity){
 if(entity==null)throw new TypeError('Fear Entity buff getter dereferenced a null native object');
 return entity['<buffContainer>k__BackingField'];
}

export function fearProjectileEntityAddBuff({tryGetBuff,raiseMissingConfig,readContainer,newBuff}){
 if([tryGetBuff,raiseMissingConfig,readContainer,newBuff].some(fn=>typeof fn!=='function'))throw new TypeError('Fear Entity.AddBuff requires native lookup, exception, container and admission callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear Entity.AddBuff dereferenced a null native object');return value;};
 const copy=value=>{nonnull(value);return{template:value.template,data:value.data};};
 const addConfig=(entity,config,source,ability,extraBlackboard,extraBlackboard2,sourceProjectile,customOverrideEffectKey)=>{
  const container=nonnull(readContainer(nonnull(entity))),captured=copy(config);
  return newBuff(container,captured,source,ability,extraBlackboard,extraBlackboard2,sourceProjectile,customOverrideEffectKey);
 };
 return Object.freeze({addConfig,
  addData(entity,data,source,ability,extraBlackboard,extraBlackboard2,sourceProjectile,customOverrideEffectKey){
   const result={value:{template:null,data:null}},found=tryGetBuff(data,result);
   if(typeof found!=='boolean')throw new TypeError('Fear Entity.AddBuff requires a native Boolean lookup result');
   if(!found){raiseMissingConfig(data);throw new TypeError('Fear Entity.AddBuff missing-config receiver must throw');}
   return addConfig(entity,copy(result.value),source,ability,extraBlackboard,extraBlackboard2,sourceProjectile,customOverrideEffectKey);
  },
 });
}
