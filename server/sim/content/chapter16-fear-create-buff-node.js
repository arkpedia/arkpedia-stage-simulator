// SPDX-License-Identifier: GPL-3.0-or-later
// Default CreateBuff.Execute. Allocation, blackboard construction, virtual
// data access and Entity admission remain explicit native receivers.
export function fearProjectileCreateBuffNode({getEntity,isDestroyedOrNull,readBuffSource,readBuffAbility,readBuffProjectile,readBuffData,readOverrideEffectKey,readProjectileEffectPairs,keysEqual,allocateBlackboard,initializeBlackboard,addBuff,addDerivedBuff}){
 if([getEntity,isDestroyedOrNull,readBuffSource,readBuffAbility,readBuffProjectile,readBuffData,readOverrideEffectKey,readProjectileEffectPairs,keysEqual,allocateBlackboard,initializeBlackboard,addBuff,addDerivedBuff].some(fn=>typeof fn!=='function'))throw new TypeError('Fear buff action requires native context, data, blackboard and admission callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear buff action dereferenced a null native object');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff action requires native Boolean values');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear buff action requires native Int32 values');return value;};
 return Object.freeze({execute(node,blackboard,_sourceType,ref){
  nonnull(node);const snapshot=()=>nonnull(nonnull(ref).value),owner=getEntity(ref,int32(node._buffOwner));
  if(boolean(isDestroyedOrNull(owner)))return false;
  let source=null,ability=null,override=null;const parent=snapshot().buff;
  if(parent!=null){source=readBuffSource(parent);ability=readBuffAbility(nonnull(snapshot().buff));}
  if(boolean(node._useSpecialBuffSource))source=getEntity(ref,int32(node._specialBuffSource));
  if(boolean(node._hookEffectKeyFromSourceProjectile)){
   override=readOverrideEffectKey(nonnull(readBuffData(node)));
   const current=snapshot().buff;
   if(current!=null){
    const projectile=readBuffProjectile(current);
    if(!boolean(isDestroyedOrNull(projectile))){
     nonnull(projectile);if(readProjectileEffectPairs(projectile)!=null){
      const pairs=nonnull(readProjectileEffectPairs(projectile));if(!Array.isArray(pairs))throw new TypeError('Fear buff action requires native effect-pair arrays');
      for(let index=0;index<pairs.length;index++){
       const pair=nonnull(pairs[index]),key=pair.key,value=pair.value;
       if(boolean(keysEqual(key,override))){override=value;break;}
      }
     }
    }
   }
  }
  const copy=nonnull(allocateBlackboard());initializeBlackboard(copy,blackboard);
  const data=readBuffData(node),projectile=boolean(node._inherateSourceProjectileFromParentBuff)?readBuffProjectile(nonnull(snapshot().buff)):null;
  const created=addBuff(nonnull(owner),data,source,ability,copy,null,projectile,override);
  if(boolean(node._isDerivedBuff)){const current=snapshot().buff,finish=boolean(node._finishDerivedBuffIfParentFinish);addDerivedBuff(current,created,finish);}
  return true;
 }});
}
