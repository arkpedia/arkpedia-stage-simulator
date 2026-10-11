// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed Unity billboard subset. This is a visual system, never combat RNG.
export function sampleCurve(curve, age, random = 0.5) {
  if (curve.mode === 0) return curve.value;
  if (curve.mode === 3) return curve.min + (curve.value - curve.min) * random;
  const keys = curve.keys;
  if (age <= keys[0][0]) return keys[0][1] * curve.value;
  if (age >= keys.at(-1)[0]) return keys.at(-1)[1] * curve.value;
  const i = keys.findIndex(k => k[0] >= age), a = keys[i - 1], b = keys[i];
  const span = b[0] - a[0], t = (age - a[0]) / span;
  // Unweighted AnimationCurve uses cubic Hermite, with tangents per second.
  return ((2*t**3-3*t*t+1)*a[1] + (t**3-2*t*t+t)*a[3]*span +
    (-2*t**3+3*t*t)*b[1] + (t**3-t*t)*b[2]*span) * curve.value;
}
function interpolate(keys, age) {
  if (age <= keys[0][0]) return keys[0].slice(1);
  if (age >= keys.at(-1)[0]) return keys.at(-1).slice(1);
  const i = keys.findIndex(k => k[0] >= age), a = keys[i-1], b = keys[i];
  const t = (age-a[0])/(b[0]-a[0]);
  return a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
}
export function sampleColor(color, age) {
  return color.mode === 0 ? [...color.value] :
    [...interpolate(color.rgb,age), ...interpolate(color.alpha,age)];
}
export function rotateVector([x,y,z], [qx,qy,qz,qw]) {
  const tx=2*(qy*z-qz*y), ty=2*(qz*x-qx*z), tz=2*(qx*y-qy*x);
  return [x+qw*tx+qy*tz-qz*ty, y+qw*ty+qz*tx-qx*tz, z+qw*tz+qx*ty-qy*tx];
}
export function unityToBoard([x,y,z]) { return [x,z,y]; }

export function validateParticlePack(pack) {
  const fail = () => { throw Error('Unsupported charge-cost particle pack'); };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const vector = (v,n) => Array.isArray(v) && v.length===n && v.every(finite);
  const keys = (v,n) => Array.isArray(v) && v.length>0 && v.length<=8 &&
    v.every((k,i)=>vector(k,n) && k[0]>=0 && k[0]<=1 && (!i || k[0]>v[i-1][0]));
  const curve = c => c && [0,1,3].includes(c.mode) && finite(c.value) && finite(c.min) &&
    (c.mode!==1 || keys(c.keys,4));
  const color = c => c && ((c.mode===0 && vector(c.value,4)) ||
    (c.mode===1 && keys(c.rgb,4) && keys(c.alpha,2)));
  if (pack?.schemaVersion!==1 || pack.key!=='common_charge_cost_start_01' || pack.coordinates!=='unity-x-y-z' ||
      pack.source?.provider!=='official-global-android' || pack.scope?.implemented!=='activation-burst' ||
      !pack.emitters || pack.emitters.length!==5 || new Set(pack.emitters.map(e=>e.id)).size!==5) fail();
  const ids=new Set(['xingdian','andi_11','andi','baoshan','baodian']);
  for (const e of pack.emitters) {
    if (!ids.has(e.id) || !vector(e.transform?.position,3) || !vector(e.transform?.rotation,4) ||
        !vector(e.transform?.scale,3) || e.transform.scale.some(s=>s!==1) ||
        Math.abs(Math.hypot(...e.transform.rotation)-1)>.00001 ||
        ![0,2].includes(e.alignment) || !finite(e.duration) || e.duration<=0 || e.duration>1 ||
        !pack.textures?.[e.material?.texture] || !['alpha','additive'].includes(e.material.blend) ||
        !vector(e.material.tint,4) || ![e.lifetime,e.speed,e.size,e.rotation,e.rate].every(curve) ||
        Math.min(e.lifetime.min,e.lifetime.value)<=0 || !color(e.startColor) ||
        (e.sizeOverLife && !curve(e.sizeOverLife)) || (e.angularVelocity && !curve(e.angularVelocity)) ||
        (e.colorOverLife && !color(e.colorOverLife))) fail();
    if (e.shape && (![0,4].includes(e.shape.type) || !finite(e.shape.radius) || e.shape.radius<0 ||
        !finite(e.shape.thickness) || e.shape.thickness<0 || e.shape.thickness>1 ||
        !finite(e.shape.angle) || e.shape.angle<0 || e.shape.angle>90 || e.shape.arc!==360)) fail();
    // This batch has stationary particles and constant radial spark velocity.
    if (![0,3].includes(e.speed.mode) || e.rate.mode!==0 || e.rate.value<0 || e.rate.value>10 ||
        e.angularVelocity && ![0,3].includes(e.angularVelocity.mode) ||
        !Array.isArray(e.bursts) || e.bursts.length>1 || e.bursts.some(b=>!finite(b.time) || b.time<0 || b.time>1 ||
          !curve(b.count) || b.count.mode!==0 || !Number.isInteger(b.count.value) || b.count.value<0 || b.count.value>5)) fail();
    if (e.velocityLimit && (!curve(e.velocityLimit.speed) || e.velocityLimit.speed.mode!==0 && e.velocityLimit.speed.mode!==3 ||
        e.velocityLimit.speed.value!==0 || e.velocityLimit.speed.min!==0 || !finite(e.velocityLimit.dampen) ||
        e.velocityLimit.dampen<=0 || e.velocityLimit.dampen>=1)) fail();
    if (e.birthEmitter && (e.id!=='xingdian' || e.birthEmitter!=='andi_11')) fail();
  }
}

// Geometric 60 Hz velocity decay. Unity's native integration isn't reproduced
// byte-for-byte; this approximation is explicit in the asset's scope metadata.
function distance(e, speed, age) {
  if (!e.velocityLimit) return speed*age;
  const h=1/60, factor=1-e.velocityLimit.dampen, n=Math.floor(age/h);
  return speed*h*(1-factor**n)/(1-factor) + speed*factor**n*(age-n*h);
}
export function createParticleBurst(pack, seed=1) {
  validateParticlePack(pack);
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const particles=[], byId=new Map(pack.emitters.map(e=>[e.id,e]));
  const children=new Set(pack.emitters.map(e=>e.birthEmitter).filter(Boolean));
  const position=(p,age)=>p.origin.map((v,i)=>v+p.direction[i]*distance(p.emitter,p.speed,age));
  function emit(e,time,originOverride) {
    if (particles.length>=128) throw Error('Charge-cost particle budget exceeded');
    const life=sampleCurve(e.lifetime,0,random()), rotation=sampleCurve(e.rotation,0,random());
    const theta=random()*Math.PI*2, shape=e.shape;
    let offset=[0,0,0], dir=[0,0,1];
    if (shape?.type===4) {
      const r=shape.radius*Math.sqrt((1-shape.thickness)**2+random()*(1-(1-shape.thickness)**2));
      const angle=shape.angle*Math.PI/180;
      offset=[Math.cos(theta)*r,Math.sin(theta)*r,0];
      dir=[Math.cos(theta)*Math.sin(angle),Math.sin(theta)*Math.sin(angle),Math.cos(angle)];
    } else if (shape?.type===0) {
      const z=random()*2-1, r=shape.radius*Math.cbrt((1-shape.thickness)**3+random()*(1-(1-shape.thickness)**3));
      dir=[Math.sqrt(1-z*z)*Math.cos(theta),Math.sqrt(1-z*z)*Math.sin(theta),z];
      offset=dir.map(v=>v*r);
    }
    const transformed=rotateVector(offset,e.transform.rotation);
    const p={emitter:e, time,life,rotation, size:sampleCurve(e.size,0,random()),
      speed:sampleCurve(e.speed,0,random()), angular:e.angularVelocity?sampleCurve(e.angularVelocity,0,random()):0,
      color:sampleColor(e.startColor,0), direction:rotateVector(dir,e.transform.rotation),
      origin:originOverride ? transformed.map((v,i)=>v+originOverride[i]) :
        transformed.map((v,i)=>v+e.transform.position[i])};
    particles.push(p);
    if (e.birthEmitter) {
      const child=byId.get(e.birthEmitter);
      // A birth sub-emitter follows its parent while that parent exists.
      for (let age=1/child.rate.value; age<Math.min(life,child.duration); age+=1/child.rate.value)
        emit(child,time+age,position(p,age));
    }
  }
  for (const e of pack.emitters) {
    if (children.has(e.id)) continue;
    for (const b of e.bursts) for (let i=0;i<b.count.value;i++) emit(e,b.time);
    for (let time=1/e.rate.value; time<e.duration; time+=1/e.rate.value) emit(e,time);
  }
  const duration=Math.max(...particles.map(p=>p.time+p.life));
  return { duration, sample(time) {
    if (!Number.isFinite(time) || time<0) return [];
    return particles.flatMap((p,index)=>{
      const age=time-p.time;
      if (age<0 || age>=p.life) return [];
      const normalized=age/p.life, e=p.emitter;
      const color=e.colorOverLife?sampleColor(e.colorOverLife,normalized):[1,1,1,1];
      return [{id:index, emitter:e.id, position:unityToBoard(position(p,age)),
        size:p.size*(e.sizeOverLife?sampleCurve(e.sizeOverLife,normalized):1),
        rotation:p.rotation+p.angular*age,
        color:color.map((v,i)=>v*p.color[i]*e.material.tint[i]),
        alignment:e.alignment, transform:e.transform, material:e.material}];
    });
  }};
}

export function skillBurstKey(unit, bindings) {
  if (unit?.side!=='ally') return null;
  const binding=bindings?.[unit.defId];
  return binding?.skillId===unit.skill?.id && binding.key==='common_charge_cost_start_01' &&
    ((unit.defId==='char_123_fang' && binding.prefabId==='skcom_charge_cost') ||
    (unit.defId==='char_240_wyvern' && binding.prefabId==='skchr_wyvern_1')) ? binding.key : null;
}
