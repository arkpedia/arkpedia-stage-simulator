// SPDX-License-Identifier: GPL-3.0-or-later
const nullableString=value=>{
 if(value!=null&&typeof value!=='string')throw new TypeError('Fear buff override requires nullable native strings');
 return value??null;
};
const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff override requires native Boolean values');return value;};
const nonnull=value=>{if(value==null)throw new TypeError('Fear buff override dereferenced a null native object');return value;};

// Selected default BuffData.GetOverrideKey; disabling returns String.Empty.
export function fearProjectileBuffOverrideKey(data){
 nonnull(data);
 if(boolean(data.disableOverride))return'';
 const override=nullableString(data.overrideKey);
 return override==null||override.length===0?nullableString(data.buffKey):nullableString(data.overrideKey);
}

export function fearProjectileResetBuffOverride({buff,source,container,readData,asCharacter,isDestroyedOrNull,readCardUid,
 formatKey,getOverrideKey=fearProjectileBuffOverrideKey,getOverrideKeyCandidate,ensureOverrideIndependentKey,
 readOverrideKey=()=>buff.overrideKey,isActive}){
 if(!buff||[readData,asCharacter,isDestroyedOrNull,readCardUid,formatKey,getOverrideKey,getOverrideKeyCandidate,
  ensureOverrideIndependentKey,readOverrideKey,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff override requires native data, character, formatting, container and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();const first=nonnull(invoke(readData));
    if(!boolean(first.independentCharacterSource)){
     buff.overrideKey=nullableString(invoke(getOverrideKey,first));check();return;
    }
    // The native type test chooses the original source pointer or null.
    const character=source==null||invoke(asCharacter,source)==null?null:source;
    const data=nonnull(invoke(readData)),key=nullableString(invoke(getOverrideKey,data));
    const base=nullableString(invoke(formatKey,'{0}{1}',key,'^'));
    if(boolean(invoke(isDestroyedOrNull,character))){
     const candidate=invoke(getOverrideKeyCandidate,nonnull(container),base);
     buff.overrideKey=nullableString(candidate);check();return;
    }
    nonnull(character);const uid=invoke(readCardUid,character);
    if(!Number.isInteger(uid)||uid<-(2**31)||uid>=2**31)throw new TypeError('Fear buff override requires a native Int32 card UID');
    buff.overrideKey=nullableString(invoke(formatKey,'{0}{1}',base,uid));check();
    const actual=nullableString(invoke(readOverrideKey));
    invoke(ensureOverrideIndependentKey,nonnull(container),base,actual);
   }catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
  },
 });
}

// Selected BuffContainer callers over Dictionary<string,OverrideGroup>.
// Comparer, key-enumerator/version and dictionary storage effects stay native
// receivers; do not replace StartsWith with a guessed JS culture comparison.
export function fearProjectileOverrideContainer({readGroups,openKeys,startsWith,tryGetGroup,containsGroup,removeGroup,addGroup,isActive}){
 if([readGroups,openKeys,startsWith,tryGetGroup,containsGroup,removeGroup,addGroup,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear override container requires native dictionary, enumeration, string and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const groups=()=>nonnull(invoke(readGroups));
 const run=fn=>{
  if(running)return null;running=true;
  try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
 };
 return Object.freeze({
  getOverrideKeyCandidate:key=>run(()=>{
   nullableString(key);const dictionary=groups(),iterator=openKeys(dictionary);
   let result=key;
   try{
    // An acquired enumerator must be disposed even if opening it ended this
    // lifecycle. There is no disposal until acquisition has succeeded.
    check();
    if(!iterator||['moveNext','current','dispose'].some(name=>typeof iterator[name]!=='function'))
     throw new TypeError('Fear override candidate requires a disposable native key enumerator');
    while(boolean(invoke(()=>iterator.moveNext()))){
     const candidate=nonnull(invoke(()=>iterator.current()));nullableString(candidate);
     if(boolean(invoke(startsWith,candidate,key))){result=candidate;break;}
    }
   }finally{if(iterator&&typeof iterator.dispose==='function')iterator.dispose();}
   check();return result;
  }),
  ensureOverrideIndependentKey:(base,key)=>run(()=>{
   nullableString(base);nullableString(key);
   const found=invoke(tryGetGroup,groups(),base);
   if(!found||typeof found.found!=='boolean'||!Object.hasOwn(found,'value'))throw new TypeError('Fear override container requires native TryGetValue found/out results');
   if(!found.found)return;
   // Capture the original out slot, even when it is null. The field is read
   // afresh before each dictionary operation, not captured for the sequence.
   const group=found.value??null;
   if(boolean(invoke(containsGroup,groups(),key)))return;
   invoke(removeGroup,groups(),base); // Native caller ignores Remove's bool.
   invoke(addGroup,groups(),key,group);
  }),
 });
}
