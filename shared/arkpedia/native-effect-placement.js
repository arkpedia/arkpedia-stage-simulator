// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit caller-owned world frames. Linear position/scale and shortest-arc
// quaternion interpolation are local policies, not recovered native mounting.
const owners=new WeakSet();
const vector=(v,n)=>{
  if(!Array.isArray(v)||v.length!==n||!Array.from(v).every(Number.isFinite))throw Error('Invalid effect placement vector');return v.slice();
};
export function isEffectPlacement(value){return value!==null&&typeof value==='object'&&owners.has(value);}
export function createEffectPlacement(samples){
  if(!Array.isArray(samples)||!samples.length||samples.length>20000)throw Error('Invalid effect placement history');
  const points=samples.map((p,i)=>{
    if(!Number.isFinite(p?.time)||p.time<0||i&&p.time<=samples[i-1].time)throw Error('Unordered effect placement history');
    const position=vector(p.position,3),rotation=vector(p.rotation,4),scale=vector(p.scale,3),length=Math.hypot(...rotation);
    if(Math.abs(length-1)>1e-6)throw Error('Effect placement needs a unit quaternion');
    return {time:p.time,position,rotation:rotation.map(v=>v/length),scale};
  });
  if(points[0].time!==0)throw Error('Effect placement must start at zero');
  const copy=p=>({position:p.position.slice(),rotation:p.rotation.slice(),scale:p.scale.slice()});
  const owner={sample(time){
    if(!Number.isFinite(time))throw Error('Invalid effect placement clock');
    if(time<=0)return copy(points[0]);if(time>=points.at(-1).time)return copy(points.at(-1));
    let lo=0,hi=points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].time<=time)lo=mid;else hi=mid;}
    const a=points[lo],b=points[hi],u=(time-a.time)/(b.time-a.time),mix=key=>a[key].map((v,i)=>(1-u)*v+u*b[key][i]);
    let dot=a.rotation.reduce((sum,v,i)=>sum+v*b.rotation[i],0),sign=dot<0?-1:1;dot=Math.min(1,Math.abs(dot));
    const angle=Math.acos(dot),sin=Math.sin(angle),near=sin<1e-6,
      x=near?1-u:Math.sin((1-u)*angle)/sin,y=near?u:Math.sin(u*angle)/sin,
      rotation=a.rotation.map((v,i)=>x*v+y*sign*b.rotation[i]),length=Math.hypot(...rotation);
    return {position:mix('position'),rotation:rotation.map(v=>v/length),scale:mix('scale')};
  },times(time){
    if(!Number.isFinite(time))throw Error('Invalid effect placement clock');if(time<0)return [];
    const result=points.filter(p=>p.time<=time).map(p=>p.time);if(result.at(-1)!==time)result.push(time);return result;
  },scope:Object.freeze({explicitWorldPlacement:true,linearPositionAndScale:true,shortestQuaternionArc:true,nativeMountMappingVerified:false,compiledFrameParity:false})};
  owners.add(owner);return Object.freeze(owner);
}
