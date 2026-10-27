// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileBuffDurationKey} from './chapter16-fear-buff-timing.js';
import {fearProjectileFloatToRaw,fearProjectileFloorToInt} from './chapter16-fear-fixed-values.js';

// Blackboard.Assign(IReadOnlyList<DataPair>) preserves source pair keys and
// both value fields. It does not route through the key-lowering write overloads.
export function fearProjectileBuffBlackboardPairs({entries,compareIgnoreCase,isActive}){
 if(!Array.isArray(entries)||[compareIgnoreCase,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear pair assignment requires native list, comparison and lifecycle callers');
 let running=false;
 const active=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear pair assignment requires Boolean lifecycle validity');return value;};
 const compare=(a,b)=>{
  const result=compareIgnoreCase(a,b,true);
  if(!active())return null;
  if(!Number.isInteger(result)||result<-(2**31)||result>=2**31)throw new TypeError('Fear pair comparison requires a native Int32 result');
  return result;
 };
 const copy=value=>{
  if(!value||typeof value!=='object')throw new TypeError('Fear pair assignment requires native DataPair fields');
  const key=value.key,number=value.value,text=value.valueStr;
  if((key!=null&&typeof key!=='string')||typeof number!=='number'||(text!=null&&typeof text!=='string'))
   throw new TypeError('Fear pair assignment requires native DataPair fields');
  return{key:key??null,value:Math.fround(number),valueStr:text??null};
 };
 return Object.freeze({
  assign(source){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    if(source==null)return;
    if(!Array.isArray(source))throw new TypeError('Fear pair assignment requires a native source list projection');
    if(!entries.length){
     // The selected array ICollection copy path preserves duplicates, key
     // casing and complete pair values. No culture comparison is performed.
     const batch=[];for(let index=0;index<source.length;index++)batch.push(copy(source[index]));if(!active())return null;
     for(const pair of batch)entries.push(pair);
     return;
    }
    for(let index=0;index<source.length;index++){
     const pair=copy(source[index]);if(!active())return null;
     let replaced=false;
     for(let at=0;at<entries.length;at++){
      const existing=entries[at]?.key;if(!active())return null;
      const result=compare(existing,pair.key);if(result===null)return null;
      if(result!==0)continue;
      if(at>=entries.length)throw new RangeError('Fear pair replacement index is outside the native list');
      entries[at]=pair;replaced=true;break;
     }
     if(!replaced)entries.push(pair);
     if(!active())return null;
    }
   }finally{running=false;}
  },
  containsKey(key){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    if(key!=null&&typeof key!=='string')throw new TypeError('Fear pair lookup requires a nullable native string key');
    for(let index=0;index<entries.length;index++){
     const current=entries[index]?.key;if(!active())return null;
     const result=compare(current,key);if(result===null)return null;if(result===0)return true;
    }
    return false;
   }finally{running=false;}
  },
  clear(){if(running)return null;running=true;try{if(!active())return null;entries.length=0;}finally{running=false;}},
 });
}

// Selected default Blackboard numeric reads on a List<DataPair> projection.
// Native culture comparison stays explicit; scalar conversions use the retained
// x64 result paths unless instrumented native receivers are supplied.
export function fearProjectileBuffBlackboardReads({entries,compareIgnoreCase,floatToRaw=fearProjectileFloatToRaw,floorToInt=fearProjectileFloorToInt,isActive}){
 if(!Array.isArray(entries)||[compareIgnoreCase,floatToRaw,floorToInt,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear blackboard reads require native list, comparison, conversion and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const active=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear blackboard reads require Boolean lifecycle validity');return value;};
 const check=()=>{if(!active())throw cancelled;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)throw new TypeError('Fear blackboard reads require signed Q32.32 results');return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear blackboard reads require native Int32 results');return value;};
 function number(key){
  if(key==null||key==='')return{found:false,value:0};
  if(typeof key!=='string')throw new TypeError('Fear blackboard lookup requires a nullable native string key');
  for(let index=0;index<entries.length;index++){
   const existing=entries[index]?.key;check();
   const compared=compareIgnoreCase(existing,key,true);check();int(compared);
   if(compared!==0)continue;
   const text=entries[index]?.valueStr;check();
   if(text!=null&&typeof text!=='string')throw new TypeError('Fear blackboard numeric predicate requires a nullable native string');
   if(text!=null&&text!=='')continue;
   const value=entries[index]?.value;check();
   if(typeof value!=='number')throw new TypeError('Fear blackboard lookup requires native float values');
   return{found:true,value:Math.fround(value)};
  }
  return{found:false,value:0};
 }
 function run(key,kind,fallback){
  if(running)return null;running=true;
  try{
   check();const result=number(key);
   if(kind==='number')return Object.freeze(result);
   if(kind==='fp'||kind==='fpDefault'){
    const converted=floatToRaw(result.value);check();const valueRaw=raw(converted);
    return kind==='fp'?Object.freeze({found:result.found,valueRaw}):result.found?valueRaw:raw(fallback);
   }
   if(!result.found)return kind==='int'?Object.freeze({found:false,value:0}):int(fallback);
   const floored=floorToInt(result.value);check();const value=int(floored);
   return kind==='int'?Object.freeze({found:true,value}):value;
  }catch(error){if(error===cancelled)return null;throw error;}
  finally{running=false;}
 }
 return Object.freeze({
  tryGetNumber:key=>run(key,'number'),tryGetFP:key=>run(key,'fp'),tryGetInt:key=>run(key,'int'),
  // The default native branches ignore this bool; hotfix dispatch retains it.
  getFpOrDefault:(key,fallback,_flag=false)=>run(key,'fpDefault',fallback),
  getIntOrDefault:(key,fallback,_flag=false)=>run(key,'intDefault',fallback),
 });
}

// Selected Blackboard.Assign(float/string) on its List<DataPair> projection.
// Culture-sensitive System.String operations are supplied without substituting
// JavaScript's different casing/collation rules.
export function fearProjectileBuffBlackboardWrites({entries,toLower,compareIgnoreCase,isActive}){
 if(!Array.isArray(entries)||[toLower,compareIgnoreCase,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear blackboard writes require native list, casing, comparison and lifecycle callers');
 let running=false;
 const active=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear blackboard writes require Boolean lifecycle validity');return value;};
 function write(key,value,stringValue){
  if(running)return null;running=true;
  try{
   if(!active())return null;
   if(typeof key!=='string')throw new TypeError('Fear blackboard write requires a nonnull native string key');
   if(stringValue){if(value!=null&&typeof value!=='string')throw new TypeError('Fear blackboard string write requires a nullable native string');}
   else if(typeof value!=='number')throw new TypeError('Fear blackboard numeric write requires a native float');
   const lowered=toLower(key);if(!active())return null;
   if(typeof lowered!=='string')throw new TypeError('Fear blackboard casing requires a nonnull native string result');
   const pair={key:lowered,value:stringValue?0:Math.fround(value),valueStr:stringValue?(value??null):null};
   for(let index=0;index<entries.length;index++){
    const existing=entries[index]?.key;if(!active())return null;
    const compared=compareIgnoreCase(existing,key,true);if(!active())return null;
    if(!Number.isInteger(compared)||compared<-(2**31)||compared>=2**31)throw new TypeError('Fear blackboard comparison requires a native Int32 result');
    if(compared===0){
     if(index>=entries.length)throw new RangeError('Fear blackboard replacement index is outside the native list');
     entries[index]=pair;return active()?undefined:null;
    }
   }
   entries.push(pair);if(!active())return null;
  }finally{running=false;}
 }
 return Object.freeze({assignNumeric:(key,value)=>write(key,value,false),assignString:(key,value)=>write(key,value,true)});
}

// Selected IReadOnlyList<DataPair> array projection. The native ordinal-ignore-
// case comparison stays explicit; destination numeric/string writes are separate.
export function fearProjectileBuffPrefixAssignments({startsWith,assignNumeric,assignString,isActive}){
 if([startsWith,assignNumeric,assignString,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear prefix assignment requires native string comparison, writes and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear prefix assignment requires native Boolean results');return value;};
 let running=false;
 function run(source,prefix,stringValues){
  if(running)return null;running=true;
  try{
   if(!boolean(isActive()))return null;
   if(source==null)return;
   if(!Array.isArray(source))throw new TypeError('Fear prefix assignment requires a native DataPair list projection');
   for(let index=0;index<source.length;index++){
    const key=source[index]?.key;
    if(!boolean(isActive()))return null;
    if(typeof key!=='string')throw new TypeError('Fear prefix assignment requires nonnull native string keys');
    const matched=startsWith(key,prefix,5);if(!boolean(isActive()))return null;
    if(!boolean(matched))continue;
    if(typeof prefix!=='string')throw new TypeError('Fear prefix assignment requires a native string prefix');
    const stripped=key.slice(prefix.length);
    if(stringValues){
     const probe=source[index]?.valueStr;if(!boolean(isActive()))return null;
     if(probe==null||probe==='')continue;
     if(typeof probe!=='string')throw new TypeError('Fear prefix assignment requires native nullable string values');
     const value=source[index]?.valueStr;if(!boolean(isActive()))return null;
     if(value!=null&&typeof value!=='string')throw new TypeError('Fear prefix assignment requires native nullable string values');
     assignString(stripped,value);if(!boolean(isActive()))return null;
    }else{
     const value=source[index]?.value;if(!boolean(isActive()))return null;
     if(typeof value!=='number')throw new TypeError('Fear prefix assignment requires native float values');
     assignNumeric(stripped,Math.fround(value));if(!boolean(isActive()))return null;
    }
   }
  }finally{running=false;}
 }
 return Object.freeze({assignByPrefix:(source,prefix)=>run(source,prefix,false),assignValueStrByPrefix:(source,prefix)=>run(source,prefix,true)});
}

// Selected Buff.Reset blackboard preparation. Concrete Blackboard operations
// remain native receivers, including virtual Equals and copy construction.
export function fearProjectileResetBuffBlackboard({first,second,readBlackboard,equals,copyBlackboard,resetLifecycle,
 readDurationKey,readData,readBuffKey,clear,assign,assignByPrefix,assignValueStrByPrefix,containsKey,tryGetFP,assignFP,isActive}){
 if([readBlackboard,equals,copyBlackboard,resetLifecycle,readDurationKey,readData,readBuffKey,clear,assign,assignByPrefix,
  assignValueStrByPrefix,containsKey,tryGetFP,assignFP,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear blackboard reset requires native equality, copy, assignment and lifecycle callers');
 const cancelled=Symbol('cancelled');let running=false;
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear blackboard reset requires native Boolean results');return value;};
 const active=()=>boolean(isActive());
 const invoke=(fn,...args)=>{const result=fn(...args);if(!active())throw cancelled;return result;};
 const target=()=>{const result=invoke(readBlackboard);if(result==null)throw new TypeError('Fear blackboard reset requires a nonnull destination');return result;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    let a=first,b=second;
    if(a!=null&&boolean(invoke(equals,a,target()))){a=invoke(copyBlackboard,a);if(a==null)throw new TypeError('Fear blackboard copy cannot be null');}
    if(b!=null&&boolean(invoke(equals,b,target()))){b=invoke(copyBlackboard,b);if(b==null)throw new TypeError('Fear blackboard copy cannot be null');}
    invoke(resetLifecycle);
    const durationKey=fearProjectileBuffDurationKey(invoke(readDurationKey));
    const data=invoke(readData);let prefix=null;
    if(boolean(data.stripBlackboardParamsWithBuffKey)){
     const key=invoke(readBuffKey);
     if(key!=null&&key!==''){
      if(typeof key!=='string')throw new TypeError('Fear blackboard prefix requires a native string key');
      const actual=invoke(readBuffKey);
      if(actual!=null&&typeof actual!=='string')throw new TypeError('Fear blackboard prefix requires a native string key');
      prefix=(actual??'')+'.';
     }
    }
    invoke(clear,target());
    for(const input of [a,b])if(input!=null){
     if(prefix==null)invoke(assign,target(),input);
     else{
      invoke(assignByPrefix,target(),input,prefix);
      invoke(assignValueStrByPrefix,target(),input,prefix);
     }
    }
    const current=invoke(readData);invoke(assign,target(),current.blackboard);
    if(prefix!=null&&!boolean(invoke(containsKey,target(),durationKey))){
     let found=false,value=-(1n<<32n);
     for(const input of [a,b])if(input!=null){
      const result=invoke(tryGetFP,input,durationKey);
      if(!result||typeof result.found!=='boolean'||typeof result.valueRaw!=='bigint'||result.valueRaw<-(1n<<63n)||result.valueRaw>(1n<<63n)-1n)
       throw new TypeError('Fear blackboard duration lookup requires native found/out FP results');
      value=result.valueRaw;found=result.found||found;
     }
     if(found)invoke(assignFP,target(),durationKey,value);
    }
    return Object.freeze({durationKey});
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
