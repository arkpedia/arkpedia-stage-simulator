// SPDX-License-Identifier: GPL-3.0-or-later
// Selected Buff._LoadActions. Receivers expose the native ActionDict and
// EventToAction.value; action-array execution is handled separately.
export function fearProjectileLoadBuffActions({readActions,readDictionaryCount,readDictionaryEntry,readActionArray,isAssignable,isActive}){
 if([readActions,readDictionaryCount,readDictionaryEntry,readActionArray,isAssignable,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear action loading requires native action array, dictionary and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear action loading requires native Boolean results');return value;};
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear action loading requires native Int32 values');return value;};
 const array=(value,index)=>{
  if(!Array.isArray(value))throw new TypeError('Fear action loading requires a native action-array projection');
  if(index<0||index>=value.length)throw new RangeError('Fear action event index is outside the native array');
 };
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();
    for(let index=0;index<104;index++){
     const actions=invoke(readActions);array(actions,index);actions[index]=null;check();
    }
    for(let index=0;;index++){
     const count=int(invoke(readDictionaryCount));if(count<0)throw new TypeError('Fear action loading requires a nonnegative native dictionary count');
     if(index>=count)break;
     const actions=invoke(readActions);
     const first=invoke(readDictionaryEntry,index);const event=int(first?.key);
     const second=invoke(readDictionaryEntry,index);
     if(second?.value==null)throw new TypeError('Fear action loading requires nonnull EventToAction values');
     const action=invoke(readActionArray,second.value);
     if(!Array.isArray(actions))throw new TypeError('Fear action loading requires a native action-array projection');
     if(action!=null&&!boolean(invoke(isAssignable,action,actions)))throw new TypeError('Fear action array element is not assignable');
     array(actions,event);actions[event]=action??null;check();
    }
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
