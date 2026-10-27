// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected life10 clock. Callers supply the native signed Q32.32 input
// delta and movement scale; deriving them from the simulator step stays held.
const bits=32n,one=1n<<bits,life=10n*one,min=-(1n<<63n),max=(1n<<63n)-1n;
function raw(value){
 if(typeof value!=='bigint'||value<min||value>max)
  throw new TypeError('Fear clock requires signed 64-bit Q32.32 raw values');
 return value;
}
function asFloat(value){
 // Native FP.AsFloat converts signed64 to float32 before multiplying by 2^-32.
 // Round the integer directly to 24 significant bits: Number(value) followed
 // by fround can double-round a large signed64 value on a halfway boundary.
 const negative=value<0n,magnitude=negative?-value:value;
 if(magnitude===0n)return 0;
 const shift=Math.max(0,magnitude.toString(2).length-24),n=BigInt(shift);
 let top=magnitude>>n;
 if(shift){
  const remainder=magnitude-(top<<n),half=1n<<(n-1n);
  if(remainder>half||(remainder===half&&(top&1n)))top++;
 }
 return Math.fround((negative?-1:1)*Number(top)*2**(shift-32));
}
export function fearProjectileLifetime({isBattleActive,onExpire}){
 if(typeof isBattleActive!=='function'||typeof onExpire!=='function')
  throw new TypeError('Fear clock requires explicit lifecycle and expiry callers');
 let elapsed=0n,ended=false,advancing=false,ensuring=false;
 const active=()=>{if(!ended&&!isBattleActive())ended=true;return!ended;};
 return Object.freeze({
  get elapsedRaw(){return elapsed;},
  ensureLifeTime(remainingRaw){
   if(ended||advancing||ensuring)return false;
   ensuring=true;
   try{
    if(!active())return false;
    // Projectile.EnsureLifeTime sets currentTime = lifeTime - remainingTime;
    // selected arrival delay is zero. This changes the next expiry check, not
    // an immediate StopMe dispatch from inside the arrival callback.
    elapsed=BigInt.asIntN(64,life-raw(remainingRaw));return true;
   }finally{ensuring=false;}
  },
  advance(deltaRaw,movementScaleRaw){
   if(ended||advancing||ensuring)return null;
   advancing=true;
   try{
    if(!active())return null;
    const delta=BigInt.asIntN(64,(raw(deltaRaw)*raw(movementScaleRaw))>>bits);
    elapsed=BigInt.asIntN(64,elapsed+delta);
    if(elapsed>=life){
     // Native expiry precedes behaviour ticks; latch before calling stop code.
     ended=true;onExpire();return{expired:true,elapsedRaw:elapsed,deltaRaw:delta};
    }
    return{expired:false,elapsedRaw:elapsed,deltaRaw:delta,effectiveDt:asFloat(delta)};
   }finally{advancing=false;}
  },
  release(){ended=true;},
 });
}
