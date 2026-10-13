// SPDX-License-Identifier: GPL-3.0-or-later
// Bridge explicit parent-particle world motion to original child emitter frames.
// No source parent path, transform or velocity is guessed. This is a local frame
// mapping; child/parent renderer dispatch and compiled Unity parity stay separate.
const vector=(v,label)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('Invalid native child '+label);return v;};
const matrix=m=>{
 if((!Array.isArray(m)&&!ArrayBuffer.isView(m))||m.length!==16||![...m].every(Number.isFinite)
   ||[3,7,11].some(i=>Math.abs(m[i])>1e-12)||Math.abs(m[15]-1)>1e-12)throw Error('Invalid native child source frame');
 return Array.from(m);
};
const point=(m,v)=>[0,1,2].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]);
const direction=(m,v)=>[0,1,2].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]);
function inverseDirection(m,[x,y,z]){
 const [a,b,c,d,e,f,g,h,i]=[m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]];
 const determinant=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
 if(!Number.isFinite(determinant)||determinant===0)throw Error('Singular native child birth-position frame');
 return vector([((e*i-f*h)*x+(c*h-b*i)*y+(b*f-c*e)*z)/determinant,
  ((f*g-d*i)*x+(a*i-c*g)*y+(c*d-a*f)*z)/determinant,
  ((d*h-e*g)*x+(b*g-a*h)*y+(a*e-b*d)*z)/determinant],'birth offset');
}
export function createChildParticleFrames({parentAt,sourceFrameAt}){
 if(typeof parentAt!=='function'||typeof sourceFrameAt!=='function')throw Error('Child particles need explicit parent motion and source frames');
 function parent(time,p){
  if(!Number.isFinite(time)||typeof p?.parent!=='string'||!p.parent||!Number.isSafeInteger(p.parentParticle)||p.parentParticle<0
    ||!Number.isFinite(p.parentBirthTime)||!Number.isFinite(p.parentDeathTime)||time<p.parentBirthTime-1e-10||time>=p.parentDeathTime+1e-10)
    throw Error('Invalid native child parent-particle lineage clock');
  const value=parentAt(p.parent,p.parentParticle,time,p);
  if(!value)throw Error('Native child parent particle is unavailable');
  return {position:vector(value.position,'parent position'),velocity:vector(value.velocity,'parent velocity')};
 }
 function source(time,p){
   const value=sourceFrameAt(time,p);
   if(!value)throw Error('Native child source frame is unavailable');
   return {parentOrigin:vector(value.parentOrigin,'parent emitter origin'),birth:matrix(value.birth),movement:matrix(value.movement)};
 }
 function frameAt(time,p){
   const particle=parent(time,p),{parentOrigin,birth,movement}=source(time,p);
   // Preserve authored child offsets/basis/scale. Translate from the original
   // emitter origin to this particular parent's particle position, not the
   // parent particle's current location at the later render time.
   for(let i=0;i<3;i++){const delta=particle.position[i]-parentOrigin[i];birth[12+i]+=delta;movement[12+i]+=delta;}
   return {birth,movement};
 }
 return {
  frameAt,
  emitterVelocityAt(time,p){return parent(time,p).velocity.slice();},
  worldPosition(p,time){
   if(!Number.isFinite(time)||!Number.isFinite(p?.birthTime)||p.birthTime>time+1e-10)throw Error('Invalid native child render clock');
   if(p.worldPosition)return vector(p.worldPosition,'integrated world position').slice();
   if(!['local','world'].includes(p.velocitySpace))throw Error('Invalid native child velocity space');
   vector(p.origin,'particle origin');vector(p.displacement,'particle displacement');
   const atBirth=source(p.birthTime,p),particle=parent(p.birthTime,p);
   const delta=particle.position.map((v,i)=>v-atBirth.parentOrigin[i]);
   if(p.simulationSpace==='world'){
    for(let i=0;i<3;i++){atBirth.birth[12+i]+=delta[i];atBirth.movement[12+i]+=delta[i];}
    const origin=point(atBirth.birth,p.origin);
    const displacement=p.velocitySpace==='world'?p.displacement:direction(atBirth.movement,p.displacement);
    return vector(origin.map((v,i)=>v+displacement[i]),'world position');
   }
   if(p.simulationSpace!=='local'||p.velocitySpace==='world')throw Error('Native child local/world motion needs integration');
   // Local children retain the particle's birth offset in the original child
   // emitter frame. Later emitter movement follows the caller's original source
   // frame, not an invented attachment to the parent's later particle position.
   const offset=delta.every(v=>v===0)?[0,0,0]:inverseDirection(atBirth.birth,delta),current=source(time,p);
   const origin=point(current.birth,p.origin.map((v,i)=>v+offset[i])),displacement=direction(current.movement,p.displacement);
   return vector(origin.map((v,i)=>v+displacement[i]),'world position');
  },
  scope:{explicitParentMotion:true,sourceChildFrames:true,compiledFrameParity:false}
 };
}
