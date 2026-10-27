// SPDX-License-Identifier: GPL-3.0-or-later
// Selected default BuffConfig/Reset branches. Native pointer, cast and audio
// receivers remain explicit; this module does not admit an enemy or stage.
const nullableString=value=>{
 if(value!=null&&typeof value!=='string')throw new TypeError('Fear buff context requires nullable native strings');
 return value??null;
};
const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff context requires native Boolean fields');return value;};
const int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear buff context requires native Int32 fields');return value;};
const nonnull=value=>{if(value==null)throw new TypeError('Fear buff context dereferenced a null native object');return value;};

export function fearProjectileBuffConfig({readData,readTemplate,isActive}){
 if([readData,readTemplate,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear buff config requires native data, template and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=fn=>{const value=fn();check();return value;};
 const run=fn=>{
  if(running)return null;running=true;
  try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
 };
 return Object.freeze({
  effectKey:()=>run(()=>{
   const key=nullableString(nonnull(invoke(readData)).overrideEffectKey);
   // The successful override branch reads config.data a second time.
   return key==null||key.length===0?nullableString(nonnull(invoke(readTemplate)).effectKey)
    :nullableString(nonnull(invoke(readData)).overrideEffectKey);
  }),
  onEventPriority:()=>run(()=>{
   const data=nonnull(invoke(readData));
   return boolean(data.overrideOnEventPriority)?int32(data.onEventPriority):int32(nonnull(invoke(readTemplate)).onEventPriority);
  }),
 });
}

export function fearProjectileResetBuffContext({buff,container,source,ability,sourceProjectile,readData,config,
 isDestroyedOrNull,asCharacter,readAudioSignals,tryHookAudio,capturePointer,isActive}){
 if(!buff||!config||[config.effectKey,config.onEventPriority,readData,isDestroyedOrNull,asCharacter,readAudioSignals,tryHookAudio,capturePointer,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff context requires native config, source, audio, pointer and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();buff.m_data=invoke(readData);check();
    buff.m_container=container;check();
    buff.key=nullableString(nonnull(invoke(readData)).buffKey);check();
    buff.effectKey=nullableString(invoke(config.effectKey));check();
    buff.enableInitDirectionFromSource=boolean(nonnull(invoke(readData)).enableInitDirectionFromSource);check();
    buff.onEventPriority=int32(invoke(config.onEventPriority));check();
    buff.audioSignal=nullableString(nonnull(invoke(readData)).audioSignal);check();
    const audio=nullableString(buff.audioSignal);check();
    if(audio!=null&&audio.length!==0&&!boolean(invoke(isDestroyedOrNull,source))&&invoke(asCharacter,source)!=null){
     // The cast only gates this branch. The original source is the virtual
     // receiver, and the array and both out slots are captured once.
     const signals=nonnull(invoke(readAudioSignals));
     if(!Array.isArray(signals))throw new TypeError('Fear buff audio requires a native signal-array projection');
     const out={newSignal:null,newSubsignal:null};
     for(let index=0;index<signals.length;index++){
      const signal=nullableString(signals[index]),subsignal=nullableString(buff.audioSignal);check();
      if(boolean(invoke(tryHookAudio,source,signal,subsignal,out))){
       buff.audioSignal=nullableString(out.newSubsignal);check();break;
      }
     }
    }
    buff.m_source=invoke(capturePointer,source,'source');check();
    buff.m_ability=invoke(capturePointer,ability,'ability');check();
    buff.m_sourceProjectile=invoke(capturePointer,sourceProjectile,'projectile');check();
    const data=nonnull(invoke(readData));
    for(const [input,output] of [
     ['isDurableBuff','m_isDurableBuff'],['isDamageMissable','m_isDamageMissable'],['isSilenceable','m_isSilenceable'],
     ['isStunnable','m_isStunnable'],['isFreezable','m_isFreezable'],['isLevitatable','m_isLevitatable'],
    ]){buff[output]=boolean(data[input]);check();}
   }catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
  },
 });
}
