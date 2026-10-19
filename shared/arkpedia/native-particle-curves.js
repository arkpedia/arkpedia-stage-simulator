// SPDX-License-Identifier: GPL-3.0-or-later
// Source particle MinMaxCurve / MinMaxGradient sampling. The pinned effects use
// clamp curves with unweighted tangents and blend/fixed gradients. Unsupported curve
// formats fail explicitly; these JS results are not compiled Unity parity.
const finite=(v,label)=>{if(!Number.isFinite(v))throw new Error('Invalid native particle '+label);return v;};
const clamp=v=>Math.max(0,Math.min(1,v));
const mix=(a,b,t)=>a+(b-a)*t;
export function sampleParticleCurve(curve,time,factor=1){
  finite(time,'clock');factor=clamp(finite(factor,'factor'));
  const scalar=finite(curve.scalar,'curve multiplier');
  switch(curve.minMaxState){
    case 0:return scalar;
    case 1:return scalar*sampleKeys(curve.maxCurve,time);
    case 2:return scalar*mix(sampleKeys(curve.minCurve,time),sampleKeys(curve.maxCurve,time),factor);
    case 3:return mix(finite(curve.minScalar,'minimum constant'),scalar,factor);
    default:throw new Error('Unsupported native particle curve mode');
  }
}
function sampleKeys(curve,time){
  const keys=curve.m_Curve;
  if(curve.m_PreInfinity!==2||curve.m_PostInfinity!==2||!keys?.length)throw new Error('Unsupported native particle curve wrap/keys');
  for(let i=0;i<keys.length;i++){
    const key=keys[i];
    if(key.weightedMode!==0)throw new Error('Weighted native particle curve needs review');
    for(const f of ['time','value','inSlope','outSlope'])finite(key[f],'key '+f);
    if(i&&key.time<=keys[i-1].time)throw new Error('Unordered native particle curve keys');
  }
  if(time<=keys[0].time)return keys[0].value;
  if(time>=keys.at(-1).time)return keys.at(-1).value;
  const i=keys.findIndex(k=>k.time>time),a=keys[i-1],b=keys[i],span=b.time-a.time,u=(time-a.time)/span;
  const tangentA=a.outSlope*span,tangentB=b.inSlope*span;
  // Hermite in normalized segment time; tangent slopes retain source seconds.
  return ((2*a.value-2*b.value+tangentA+tangentB)*u+(-3*a.value+3*b.value-2*tangentA-tangentB))*u*u+tangentA*u+a.value;
}
const color=c=>['r','g','b','a'].map(k=>finite(c[k],'color '+k));
export function sampleParticleGradient(gradient,time,factor=1){
  time=clamp(finite(time,'gradient clock'));factor=clamp(finite(factor,'gradient factor'));
  switch(gradient.minMaxState){
    case 0:return color(gradient.maxColor);
    case 1:return sampleGradientKeys(gradient.maxGradient,time);
    case 2:{const a=color(gradient.minColor),b=color(gradient.maxColor);return a.map((v,i)=>mix(v,b[i],factor));}
    case 3:{const a=sampleGradientKeys(gradient.minGradient,time),b=sampleGradientKeys(gradient.maxGradient,time);return a.map((v,i)=>mix(v,b[i],factor));}
    case 4:return sampleGradientKeys(gradient.maxGradient,factor);
    default:throw new Error('Unsupported native particle gradient mode');
  }
}
function sampleGradientKeys(g,time){
  if(![0,1].includes(g.m_Mode))throw new Error('Unsupported native particle gradient interpolation');
  function channel(type,component,count){
    if(!Number.isInteger(count)||count<1||count>8)throw new Error('Invalid native particle gradient count');
    const keys=Array.from({length:count},(_,i)=>({time:g[type+'time'+i]/65535,value:finite(g['key'+i][component],'gradient value')}));
    for(let i=0;i<keys.length;i++){
      if(!Number.isInteger(g[type+'time'+i])||keys[i].time<0||keys[i].time>1||i&&keys[i].time<keys[i-1].time)throw new Error('Invalid native particle gradient clock');
    }
    // Unity Fixed mode chooses the first key strictly after the clock, with
    // the last key retained when none follows. RGB/alpha clocks stay separate.
    if(g.m_Mode===1)return (keys.find(k=>k.time>time)??keys.at(-1)).value;
    if(time<=keys[0].time)return keys[0].value;
    if(time>=keys.at(-1).time)return keys.at(-1).value;
    const i=keys.findIndex(k=>k.time>time),a=keys[i-1],b=keys[i];
    return mix(a.value,b.value,(time-a.time)/(b.time-a.time));
  }
  return ['r','g','b'].map(k=>channel('c',k,g.m_NumColorKeys)).concat(channel('a','a',g.m_NumAlphaKeys));
}

// Exact piecewise integral of the supported source Hermite curves, including
// clamped tails. No preview frame-step dependence or numerical quadrature.
export function integrateParticleCurve(curve,from,to,factor=1){
  if(!Number.isFinite(from)||!Number.isFinite(to))throw Error('Invalid native particle integration clock');
  sampleParticleCurve(curve,from,factor);sampleParticleCurve(curve,to,factor);
  if(to<from)return -integrateParticleCurve(curve,to,from,factor);
  if(curve.minMaxState===0||curve.minMaxState===3)return sampleParticleCurve(curve,0,factor)*(to-from);
  const integrate=source=>{
    const keys=source.m_Curve;let sum=0;
    if(from<keys[0].time)sum+=(Math.min(to,keys[0].time)-from)*keys[0].value;
    for(let i=1;i<keys.length;i++){
      const a=keys[i-1],b=keys[i],lo=Math.max(from,a.time),hi=Math.min(to,b.time);
      if(hi<=lo)continue;
      const span=b.time-a.time,A=a.outSlope*span,B=b.inSlope*span;
      const c3=2*a.value-2*b.value+A+B,c2=-3*a.value+3*b.value-2*A-B;
      const primitive=u=>c3*u**4/4+c2*u**3/3+A*u*u/2+a.value*u;
      sum+=span*(primitive((hi-a.time)/span)-primitive((lo-a.time)/span));
    }
    if(to>keys.at(-1).time)sum+=(to-Math.max(from,keys.at(-1).time))*keys.at(-1).value;
    return sum;
  };
  const max=integrate(curve.maxCurve);
  return curve.scalar*(curve.minMaxState===1?max:(()=>{const min=integrate(curve.minCurve);return min+(max-min)*Math.max(0,Math.min(1,factor));})());
}
