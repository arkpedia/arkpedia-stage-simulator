// SPDX-License-Identifier: GPL-3.0-or-later
// Native Buff static initializer's selected automatic-resistance enum values.
const automaticFlags=Object.freeze([0,16,43,41]);

export function fearProjectileInitBuffStatus({buff,readData,readAbnormalMask,readSlowDownTemplateKey,
 readAutomaticFlags=()=>automaticFlags,isActive}){
 if(!buff||[readData,readAbnormalMask,readSlowDownTemplateKey,readAutomaticFlags,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear status initialization requires native data, mask, config and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear status initialization requires Boolean lifecycle validity');if(!value)throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const string=value=>{if(value!=null&&typeof value!=='string')throw new TypeError('Fear slowdown eligibility requires nullable native strings');return value??null;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();const data=invoke(readData),mode=data.statusResistable;
    if(!Number.isInteger(mode)||mode<0||mode>255)throw new TypeError('Fear status initialization requires a native byte switch value');
    let resistable=mode===1;
    if(mode===2){
     const initial=invoke(readAutomaticFlags);
     if(!Array.isArray(initial))throw new TypeError('Fear automatic resistance requires a native enum-array projection');
     const count=initial.length;
     for(let index=0;index<count;index++){
      const flags=invoke(readAutomaticFlags);
      if(!Array.isArray(flags)||index>=flags.length)throw new RangeError('Fear automatic resistance flag index is outside the native array');
      const flag=flags[index];if(!Number.isInteger(flag)||flag<-(2**31)||flag>=2**31)throw new TypeError('Fear automatic resistance requires native Int32 flags');
      const mask=invoke(readAbnormalMask);
      if(typeof mask!=='bigint'||mask<0n||mask>=(1n<<64n))throw new TypeError('Fear automatic resistance requires native UInt64 masks');
      // The selected TEST/JG sequence uses signed positivity, including bit63.
      if(BigInt.asIntN(64,mask&(1n<<BigInt(flag&63)))>0n){resistable=true;break;}
     }
    }
    buff.m_isStatusResistable=resistable;check();
    let canSlowDown=false;
    if(resistable){
     const current=invoke(readData),template=string(current.templateKey);
     const excluded=string(invoke(readSlowDownTemplateKey));
     canSlowDown=template!==excluded;
    }
    buff.m_canSlowDown=canSlowDown;check();
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
