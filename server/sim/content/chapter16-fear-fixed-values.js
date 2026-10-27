// SPDX-License-Identifier: GPL-3.0-or-later
// Selected x64 scalar conversion results. Floating-point exception flags and
// CRT diagnostic state are not represented by these internal projections.
export function fearProjectileFloatToRaw(value){
 if(typeof value!=='number')throw new TypeError('Fear FP conversion requires a native float value');
 const scaled=Math.fround(Math.fround(value)*2**32);
 // CVTTSS2SI returns the signed64 indefinite value for NaN/overflow.
 if(!Number.isFinite(scaled)||scaled<-(2**63)||scaled>=2**63)return-(1n<<63n);
 return BigInt(Math.trunc(scaled));
}

export function fearProjectileFloorToInt(value){
 if(typeof value!=='number')throw new TypeError('Fear integer conversion requires a native float value');
 const floor=Math.floor(Math.fround(value));
 // The native path floors the float widened to double, then CVTTSD2SI.
 if(!Number.isFinite(floor)||floor<-(2**31)||floor>=2**31)return-(2**31);
 return floor===0?0:floor;
}

export function fearProjectileMultiplyRaw(a,b){
 for(const value of [a,b])if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)
  throw new TypeError('Fear FP multiplication requires signed Q32.32 values');
 return BigInt.asIntN(64,(a*b)>>32n);
}
