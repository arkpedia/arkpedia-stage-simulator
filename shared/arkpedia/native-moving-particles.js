// SPDX-License-Identifier: GPL-3.0-or-later
import {createParticleLifecycle,particleRandom} from './native-particle-lifecycle.js';
import {sampleParticleCurve,integrateParticleCurve} from './native-particle-curves.js';
export {integrateParticleCurve} from './native-particle-curves.js';
import {createParticleMotion} from './native-particle-motion.js';
import {particleBirthFrame} from './native-particle-render.js';
import {createParticleCone} from './native-particle-cone.js';
import {createParticleInheritance} from './native-particle-inheritance.js';

// Source sphere/box/cone-base emission, lifetime velocity and grid animation.
// RNG, event boundaries, native frame phase and renderer coordinates remain
// explicit local mappings until compared with compiled Unity/game frames.
export function createMovingParticles(source,{seed=1,subEmitterSchedule=null,particleTrails=null}={}){
  const managedSubModule=source.SubModule?.enabled&&subEmitterSchedule?.ownsParent(source,seed)===true;
  const lifecycle=createParticleLifecycle(source,{seed,particleTrails,modules:['ShapeModule','VelocityModule','UVModule','ClampVelocityModule','NoiseModule','InheritVelocityModule','ForceModule',...(managedSubModule?['SubModule']:[])],spaces:[0,1],allowInitialSpeed:true,allowDistanceEmission:true});
  const shape=source.ShapeModule,velocity=source.VelocityModule,uv=source.UVModule;
  const motion=createParticleMotion(source,{seed});
  const inheritance=createParticleInheritance(source,{seed});
  let cone=null;
  if(shape?.enabled){
    if(![0,4,5].includes(shape.type)||shape.alignToDirection||shape.randomDirectionAmount!==0||shape.sphericalDirectionAmount!==0||shape.randomPositionAmount!==0)throw Error('Native particle shape/direction needs review');
    if(shape.type===4)cone=createParticleCone(shape);
    if(shape.type!==5&&(shape.radius?.mode!==0||shape.radius.spread!==0||!Number.isFinite(shape.radius.value)||shape.radius.value<0||!Number.isFinite(shape.radiusThickness)||shape.radiusThickness<0||shape.radiusThickness>1))throw Error('Native shape radius mode needs review');
    for(const field of ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer']){
      // The Sphere shape does not consume the dormant authored mesh slot.
      // Keep its pointer in the source pack; mesh-based shapes stay rejected.
      if(field==='m_Mesh'&&shape.type===0)continue;
      if(shape[field]?.m_PathID!=='0')throw Error('Native shape resource needs review');
    }
    for(const field of ['m_Position','m_Rotation','m_Scale'])for(const axis of ['x','y','z'])if(!Number.isFinite(shape[field]?.[axis]))throw Error('Invalid native shape transform');
  }
  if(velocity?.enabled){
    if(typeof velocity.inWorldSpace!=='boolean')throw Error('Invalid native velocity space');
    if(velocity.inWorldSpace&&source.moveWithTransform===0)throw Error('World velocity in a local simulation frame needs integration');
    for(const field of ['orbitalX','orbitalY','orbitalZ','orbitalOffsetX','orbitalOffsetY','orbitalOffsetZ','radial']){
      if(velocity[field]?.minMaxState!==0||velocity[field].scalar!==0)throw Error('Native orbital/radial velocity needs review');
    }
    if(velocity.speedModifier?.minMaxState!==0||velocity.speedModifier.scalar!==1)throw Error('Native particle speed multiplier needs review');
    // Validate all active curves now rather than fail halfway through a draw.
    for(const axis of ['x','y','z'])integrateParticleCurve(velocity[axis],0,1,.5);
  }
  if(uv?.enabled){
    if(uv.mode!==0||uv.animationType!==0||uv.timeMode!==0||uv.flipU!==0||uv.flipV!==0||!Number.isInteger(uv.tilesX)||!Number.isInteger(uv.tilesY)||uv.tilesX<1||uv.tilesY<1||!Number.isFinite(uv.cycles)||uv.cycles<0||!Number.isInteger(uv.uvChannelMask))throw Error('Native texture-sheet mode needs review');
    if(![0,3].includes(uv.startFrame.minMaxState))throw Error('Native initial texture frame clock needs review');
    sampleParticleCurve(uv.frameOverTime,0);sampleParticleCurve(uv.frameOverTime,1);
  }
  const worldMotion=!!motion&&source.moveWithTransform===1;
  function sampleParticles(particles,time,{frameAt,emitterVelocityAt}={}){
    if(worldMotion&&typeof frameAt!=='function')throw Error('World turbulence requires an explicit particle birth frame');
    if(inheritance&&typeof emitterVelocityAt!=='function')throw Error('Inherited velocity requires explicit world emitter velocity');
    return particles.map(p=>{
      const random=salt=>particleRandom(p.id,salt,seed),birthPhase=(p.born%source.lengthInSec)/source.lengthInSec;
      let origin=[0,0,0],direction=[0,0,1];
      if(shape?.enabled){
        if(shape.type===5)origin=['x','y','z'].map((axis,i)=>(random(10+i)-.5)*shape.m_Scale[axis]);
        else if(shape.type===0){
          const z=2*random(10)-1,angle=random(11)*Math.PI*2,xy=Math.sqrt(Math.max(0,1-z*z));
          direction=[xy*Math.cos(angle),xy*Math.sin(angle),z];
          const radius=shape.radius.value,inner=radius*(1-shape.radiusThickness);
          const r=Math.cbrt(inner**3+random(12)*(radius**3-inner**3));
          origin=direction.map((v,i)=>v*r*shape.m_Scale[['x','y','z'][i]]);
        }else{
          ({origin,direction}=cone.sample(random(10),random(11)));
        }
        origin=rotateShape(origin,shape.m_Rotation).map((v,i)=>v+shape.m_Position[['x','y','z'][i]]);
        direction=rotateShape(direction,shape.m_Rotation);
      }
      const t=p.age/p.lifetime;
      const speed=sampleParticleCurve(source.InitialModule.startSpeed,birthPhase,random(18)),initialVelocity=direction.map(v=>v*speed);
      const birthTime=p.birthTime??time-p.age/source.simulationSpeed;
      let displacement,worldPosition,inheritedVelocity;
      if(worldMotion){
        const frame=frameAt(birthTime,p);
        if(!frame?.birth||!frame?.movement)throw Error('World turbulence requires spawn and movement matrices');
        const born=particleBirthFrame(origin,initialVelocity,frame.birth,frame.movement);
        const inheritedVelocityAt=inheritance?.sample(p,time,t=>emitterVelocityAt(t,p));
        inheritedVelocity=inheritedVelocityAt?.(0);
        displacement=motion.sample(p,born.origin,born.velocity,{inheritedVelocityAt,inheritanceMode:source.InheritVelocityModule?.m_Mode});worldPosition=born.origin.map((v,i)=>v+displacement[i]);
      }else displacement=motion?motion.sample(p,origin,initialVelocity):['x','y','z'].map((axis,i)=>initialVelocity[i]*p.age+(velocity?.enabled?p.lifetime*integrateParticleCurve(velocity[axis],0,t,random(13+i)):0));
      let sheet=null;
      if(uv?.enabled){
        // Serialized native fields are normalized. Unity's editor remaps both
        // frame curves to the tile count when displaying frame indices.
        const phase=sampleParticleCurve(uv.startFrame,birthPhase,random(16))+uv.cycles*sampleParticleCurve(uv.frameOverTime,t,random(17));
        const count=uv.tilesX*uv.tilesY,frame=Math.min(count-1,Math.floor(((phase%1+1)%1)*count));
        sheet={frame,scale:[1/uv.tilesX,1/uv.tilesY],offset:[(frame%uv.tilesX)/uv.tilesX,1-(Math.floor(frame/uv.tilesX)+1)/uv.tilesY],mask:uv.uvChannelMask};
      }
      return {...p,origin,direction,initialVelocity,displacement,position:worldPosition??origin.map((v,i)=>v+displacement[i]),
        ...(worldPosition?{worldPosition}:{}),...(inheritedVelocity?{inheritedVelocity}:{}),velocitySpace:worldMotion||velocity?.enabled&&velocity.inWorldSpace?'world':'local',simulationSpace:source.moveWithTransform===1?'world':'local',birthTime,sheet};
    });
  }
  function sample(time,options={}){return sampleParticles(lifecycle.sample(time,{history:options.history}),time,options);}
  const trailCache=new Map(),trailFields=new Set(['id','born','lifetime','age','birthTime']);
  return {sample,worldMotion,births:lifecycle.births,sampleRecords(records,time,options){return sampleParticles(lifecycle.sampleRecords(records,time),time,options);},
    sampleTrailRecords(records,time,options){return sampleParticles(lifecycle.sampleTrailRecords(records,time,particleTrails),time,options);},
    withTrailHistory(callback){let active=true;try{return lifecycle.withTrailHistory(particleTrails,replay=>callback((records,time)=>{
      if(!active)throw Error('Particle trail history scope has ended');
      // Admitted trail sources simulate locally. Their physical replay is pure
      // in these clocks/records; emitter projection happens separately per frame.
      const cacheable=records.every(r=>Object.keys(r).every(k=>trailFields.has(k))&&Object.values(r).every(Number.isFinite));
      const key=cacheable?JSON.stringify([time,records]):null;if(cacheable&&trailCache.has(key))return structuredClone(trailCache.get(key));
      const result=sampleParticles(replay(records,time),time);if(!cacheable)return result;trailCache.set(key,structuredClone(result));
      if(trailCache.size>10000)trailCache.delete(trailCache.keys().next().value);return result;
    }));}finally{active=false;}},clearTrailHistoryCache(){trailCache.clear();}};
}

function rotateShape([x,y,z],rotation){
  const [a,b,c]=['x','y','z'].map(k=>rotation[k]*Math.PI/180);
  // Unity Euler Z-X-Y order: apply Z first, then X, then Y.
  const u=x*Math.cos(c)-y*Math.sin(c),v=x*Math.sin(c)+y*Math.cos(c);
  const w=v*Math.cos(a)-z*Math.sin(a),q=v*Math.sin(a)+z*Math.cos(a);
  return [u*Math.cos(b)+q*Math.sin(b),w,-u*Math.sin(b)+q*Math.cos(b)];
}
