// SPDX-License-Identifier: GPL-3.0-or-later
import{createChildEmissionSchedule}from'./native-child-emission.js';
import{createSubEmitterGraph}from'./native-sub-emitter-graph.js';
import{createMovingParticles}from'./native-moving-particles.js';
import{particleWorldPosition}from'./native-particle-render.js';
import{createChildParticleFrames}from'./native-child-particle-frame.js';

// Source particle physics and explicit original emitter frames drive child
// births. A parent SubModule is managed by the validated Birth scheduler, never
// deleted or silently ignored. Other unsupported modules stay held.
export function createParentParticleMotion(pack,{seed=1,parentIds,frameAt}={}){
 if(typeof frameAt!=='function')throw Error('Parent particles need original emitter frames');
 const graph=createSubEmitterGraph(pack),schedule=createChildEmissionSchedule(pack,{seed}),parents=new Map(),held=new Map();
 const ids=Object.entries(pack.records).filter(([,r])=>r.type==='ParticleSystem'&&r.data.SubModule?.enabled).map(([id])=>id);
 if(parentIds!==undefined&&(!Array.isArray(parentIds)||new Set(parentIds).size!==parentIds.length||parentIds.some(id=>!ids.includes(id))))throw Error('Invalid native parent particle selection');
 for(const id of parentIds??ids){
  const source=pack.records[id].data;
  try{
   if(source.prewarm&&source.looping)throw Error('Parent prewarm motion needs a source-history contract');
   const sampler=createMovingParticles(source,{seed,subEmitterSchedule:schedule});
   parents.set(id,{source,sampler});
  }catch(error){held.set(id,error.message);}
 }
 function frames(id,time){
  const frame=frameAt(id,time);
  if(!frame?.birth||!frame?.movement)throw Error('Missing original parent particle frame');
  // Validate both matrices, including finite affine coordinates.
  particleWorldPosition({simulationSpace:'local',velocitySpace:'local',origin:[0,0,0],displacement:[0,0,0]},frame.birth,frame.birth,frame.movement);
  return frame;
 }
 function sample(parent,identity,time){
  if(!parents.has(parent))throw Error('Native parent particle motion held: '+(held.get(parent)??'outside source root'));
  if(!Number.isSafeInteger(identity)||identity<0||!Number.isFinite(time)||time<0)throw Error('Invalid native parent particle sample');
  const{source,sampler}=parents.get(parent),birth=sampler.births(time).find(p=>p.id===identity);
  if(!birth)throw Error('Native parent particle was not born');
  const age=Math.max(0,(time-birth.birthTime)*source.simulationSpeed);
  if(age>=birth.lifetime)throw Error('Native parent particle has expired');
  const particle=sampler.sampleRecords([{...birth,age}],time,{frameAt:t=>frames(parent,t),emitterVelocityAt:t=>{
   const from=Math.max(birth.birthTime,t-1/60),a=frames(parent,from).birth,b=frames(parent,t).birth;
   return t===from?[0,0,0]:[0,1,2].map(i=>(b[12+i]-a[12+i])/(t-from));
  }})[0];
  const born=frames(parent,birth.birthTime),current=frames(parent,time);
  return{birth,particle,position:particleWorldPosition(particle,born.birth,current.birth,current.movement)};
 }
 function parentAt(parent,identity,time){
  const value=sample(parent,identity,time),from=Math.max(value.birth.birthTime,time-1/60);
  if(from===time){
   // At birth there is no older particle sample. Use a bounded one-sided
   // source replay so initial momentum is not incorrectly replaced by zero.
   const source=parents.get(parent).source,next=time+Math.min(1/60,value.birth.lifetime/source.simulationSpeed/2);
   if(next===time)throw Error('Parent birth velocity exceeds clock precision');
   const after=sample(parent,identity,next);
   return{position:value.position,velocity:after.position.map((v,i)=>(v-value.position[i])/(next-time))};
  }
  const before=sample(parent,identity,from);
  return{position:value.position,velocity:value.position.map((v,i)=>(v-before.position[i])/(time-from))};
 }
 function ready(child){const incoming=graph.parents(child);return incoming.length>0&&incoming.every(id=>parents.has(id));}
 return {
  schedule,ready,parentAt,sample,
  parentReady:id=>parents.has(id),parentReason:id=>held.get(id)??'outside source root',
  statuses:()=>Object.fromEntries((parentIds??ids).map(id=>[id,parents.has(id)?{sampled:true}:{held:held.get(id)}])),
  records(child,time){if(!ready(child))throw Error('Native child parent motion is not supported in this source root');return schedule.sample(child,time);},
  childFrames(child,sourceFrameAt){
   if(!ready(child)||typeof sourceFrameAt!=='function')throw Error('Native child needs supported parents and source frames');
   return createChildParticleFrames({parentAt:(parent,identity,time)=>{
    if(!graph.parents(child).includes(parent))throw Error('Foreign native child parent lineage');
    return parentAt(parent,identity,time);
   },sourceFrameAt:(time,p)=>{
    if(!graph.parents(child).includes(p.parent))throw Error('Foreign native child parent lineage');
    const original=sourceFrameAt(child,time),parent=frames(p.parent,time);
    return{...original,parentOrigin:[parent.birth[12],parent.birth[13],parent.birth[14]]};
   }});
  },
  scope:{sourceParentParticleMotion:true,velocityAcquisition:'local60HzOneSidedAtBirth',compiledFrameParity:false}
 };
}
