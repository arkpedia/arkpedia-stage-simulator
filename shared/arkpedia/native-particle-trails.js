// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';
import {particleRandom} from './native-particle-random.js';
const vector=(v,n)=>{if(!Array.isArray(v)||v.length!==n||!v.every(Number.isFinite))throw Error('Invalid particle trail vector');};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);return n>1e-12?v.map(x=>x/n):null;};
export function createParticleTrails(source,{seed=1}={}){
 const m=source.TrailModule;
 if(!m?.enabled||m.mode!==0||m.worldSpace!==false||m.generateLightingData||m.textureMode!==0
  ||m.attachRibbonsToTransform||m.splitSubEmitterRibbons||m.ribbonCount!==1||source.moveWithTransform!==0||source.scalingMode!==1)
  throw Error('Native particle trail mode/space/lighting needs review');
 if(!Number.isFinite(m.ratio)||m.ratio<0||m.ratio>1||!Number.isFinite(m.minVertexDistance)||m.minVertexDistance<0
  ||!Number.isFinite(source.simulationSpeed)||source.simulationSpeed<=0||![0,3].includes(m.lifetime.minMaxState)
  ||['dieWithParticles','inheritParticleColor','sizeAffectsWidth','sizeAffectsLifetime'].some(k=>typeof m[k]!=='boolean'))
  throw Error('Invalid native particle trail controls');
 for(const t of[0,.5,1])for(const f of[0,1]){
  if(sampleParticleCurve(m.lifetime,t,f)<0||sampleParticleCurve(m.widthOverTrail,t,f)<0)throw Error('Negative native particle trail dimensions');
  sampleParticleGradient(m.colorOverLifetime,t,f);sampleParticleGradient(m.colorOverTrail,t,f);
 }
 const stamp=JSON.stringify(source),speed=source.simulationSpeed,step=1/60/speed;
 function sample(time,births,{stateAt,project,camera,widthScale=1}={}){
  if(!Number.isFinite(time)||time<0||!Array.isArray(births)||births.length>100000||typeof stateAt!=='function'||typeof project!=='function'
   ||!Number.isFinite(widthScale)||widthScale<0)throw Error('Invalid particle trail history contract');
  vector(camera,3);const ids=new Set(),trails=[],positions=[],colors=[],uvs=[],indices=[];let replays=0;
  for(const birth of births){
   if(!Number.isSafeInteger(birth.id)||birth.id<0||ids.has(birth.id)||!Number.isFinite(birth.birthTime)||!Number.isFinite(birth.lifetime)||birth.lifetime<=0)
    throw Error('Invalid particle trail birth ledger');ids.add(birth.id);
   if(birth.birthTime>time||particleRandom(birth.id,70,seed)>=m.ratio)continue;
   const death=birth.birthTime+birth.lifetime/speed,alive=time<death;
   if(!alive&&m.dieWithParticles)continue;
   // The admitted lifetime modes are constants/two constants. No vertex can
   // survive this upper bound after death; avoid replaying expired old births.
   if(!alive&&!m.sizeAffectsLifetime&&time>=death+sampleParticleCurve(m.lifetime,0,particleRandom(birth.id,71,seed))*birth.lifetime/speed)continue;
   const terminal=death-Math.max(1e-12,birth.lifetime/speed*1e-12),end=Math.min(time,terminal);
   if(end<birth.birthTime)throw Error('Particle trail exceeds clock precision');
   const current=stateAt(end,birth);vector(current.position,3);vector(current.color,4);vector(current.size,3);
   const accepted=[],factor=particleRandom(birth.id,71,seed);
   const add=t=>{
    if(++replays>20000)throw Error('Particle trail replay exceeds point budget');
    const state=stateAt(t,birth);vector(state.position,3);vector(state.size,3);
    if(state.size[0]<0)throw Error('Negative particle trail size');
    const last=accepted.at(-1),travel=last?distance(last.position,state.position):Infinity;
    if(last&&(travel<m.minVertexDistance||travel<=1e-12))return;
    const age=(t-birth.birthTime)*speed/birth.lifetime;
    const life=sampleParticleCurve(m.lifetime,age,factor)*birth.lifetime*(m.sizeAffectsLifetime?state.size[0]:1)/speed;
    accepted.push({time:t,expires:t+life,position:state.position.slice(),state});
   };
   const count=Math.floor((end-birth.birthTime)/step+1e-10);if(count>20000)throw Error('Particle trail replay exceeds point budget');
   for(let i=0;i<=count;i++)add(Math.min(end,birth.birthTime+i*step));
   if(alive&&accepted.at(-1)?.time!==end&&distance(accepted.at(-1).position,current.position)>1e-12){
    const life=sampleParticleCurve(m.lifetime,(end-birth.birthTime)*speed/birth.lifetime,factor)*birth.lifetime*(m.sizeAffectsLifetime?current.size[0]:1)/speed;
    accepted.push({time:end,expires:end+life,position:current.position.slice(),state:current,head:true});
   }
   const points=accepted.filter(p=>p.expires>time).reverse(),world=points.map(p=>{const v=project(p.state,time,birth);vector(v,3);return v;});
   const lengths=[0];for(let i=1;i<world.length;i++)lengths.push(lengths[i-1]+distance(world[i-1],world[i]));
   const total=lengths.at(-1)||0,widths=[],vertexColors=[],start=positions.length/3;
   if(world.length>=2&&total>1e-12){
    const lifetimeColor=sampleParticleGradient(m.colorOverLifetime,Math.min(1,(time-birth.birthTime)*speed/birth.lifetime),particleRandom(birth.id,72,seed));
    for(let i=0;i<world.length;i++){
     const point=world[i],a=world[Math.max(0,i-1)],b=world[Math.min(world.length-1,i+1)],tangent=unit(b.map((v,k)=>v-a[k]));
     if(!tangent)throw Error('Degenerate particle trail tangent');
     let side=unit(cross(tangent,camera.map((v,k)=>v-point[k])));
     if(!side){const axis=[0,1,2].sort((a,b)=>Math.abs(tangent[a])-Math.abs(tangent[b]))[0],basis=[0,0,0];basis[axis]=1;side=unit(cross(tangent,basis));}
     const u=lengths[i]/total,width=sampleParticleCurve(m.widthOverTrail,u,particleRandom(birth.id,73,seed))*(m.sizeAffectsWidth?current.size[0]:1)*widthScale;
     if(width<0||!Number.isFinite(width))throw Error('Invalid particle trail width');widths.push(width);
     const color=sampleParticleGradient(m.colorOverTrail,u,particleRandom(birth.id,74,seed)).map((v,k)=>v*lifetimeColor[k]*(m.inheritParticleColor?current.color[k]:1));vertexColors.push(color);
     for(const sign of[-1,1]){positions.push(...point.map((v,k)=>v+sign*side[k]*width/2));colors.push(...color);uvs.push(u,sign===-1?0:1);}
     if(i){const j=start+i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
    }
   }
   trails.push({id:birth.id,birthTime:birth.birthTime,death,alive,points:points.map(({state,...p})=>p),world,widths,colors:vertexColors});
  }
  if(![positions,colors,uvs].every(v=>v.every(Number.isFinite)))throw Error('Particle trail exceeds coordinate precision');
  return{trails,positions,colors,uvs,indices,replays};
 }
 return{sample,ownsSource:(s,n=1)=>s===source&&n===seed&&JSON.stringify(s)===stamp,
  scope:{localTrailReplay:true,simulationStep:1/60,activeHeadInterpolation:true,terminalColorSizeSnapshot:true,compiledFrameParity:false,nativeRngVerified:false}};
}
