// SPDX-License-Identifier: GPL-3.0-or-later
// Default BuffDBUtil.TryGetBuff overloads. Database/template access, DeepClone
// and Blackboard.MergeTo remain explicit native receivers.
export function fearProjectileBuffDatabase({tryGetBuffData,tryGetTemplate,deepClone,mergeBlackboard}){
 if([tryGetBuffData,tryGetTemplate,deepClone,mergeBlackboard].some(fn=>typeof fn!=='function'))throw new TypeError('Fear BuffDB requires native lookup, clone and blackboard callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear BuffDB dereferenced a null native object');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear BuffDB requires native Boolean lookup results');return value;},
  publish=(out,value)=>{nonnull(out).value=value;};
 const tryGetKey=(key,out,externalBlackboard)=>{
  const data={value:null},template={value:null};
  if(!boolean(tryGetBuffData(key,data))){publish(out,{template:null,data:null});return false;}
  if(!boolean(tryGetTemplate(nonnull(data.value).templateKey,template))){publish(out,{template:null,data:null});return false;}
  const cloned=deepClone(nonnull(data.value));publish(out,{template:template.value,data:cloned});
  if(externalBlackboard!=null){
   const board={value:nonnull(nonnull(out).value.data).blackboard};mergeBlackboard(board,externalBlackboard);
   nonnull(nonnull(out).value.data).blackboard=board.value;
  }
  return true;
 };
 return Object.freeze({tryGetKey,
  tryGetData(data,out){
   nonnull(data);if(boolean(data.loadFromDB)){
    const externalBlackboard=data.blackboard,key=data.buffKey;
    return tryGetKey(key,out,externalBlackboard);
   }
   const template={value:null};
   if(!boolean(tryGetTemplate(data.templateKey,template))){publish(out,{template:null,data:null});return false;}
   publish(out,{template:template.value,data});return true;
  },
 });
}
