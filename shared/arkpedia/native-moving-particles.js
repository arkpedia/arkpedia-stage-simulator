// SPDX-License-Identifier: GPL-3.0-or-later
import {createParticleLifecycle,particleRandom} from './native-particle-lifecycle.js';
import {sampleParticleCurve} from './native-particle-curves.js';

// Original box-volume emission, linear lifetime velocity and grid animation.
// RNG, event boundaries, native frame phase and renderer coordinates remain
// explicit local mappings until compared with compiled Unity/game frames.
export function createMovingParticles(source,{seed=1}={}){
  const lifecycle=createParticleLifecycle(source,{seed,modules:['ShapeModule','VelocityModule','UVModule'],spaces:[0,1]});
  const shape=source.ShapeModule,velocity=source.VelocityModule,uv=source.UVModule;
  if(shape?.enabled){
    if(shape.type!==5||shape.alignToDirection||shape.randomDirectionAmount!==0||shape.sphericalDirectionAmount!==0||shape.randomPositionAmount!==0)throw Error('Native particle shape/direction needs review');
    for(const field of ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])if(shape[field]?.m_PathID!=='0')throw Error('Native shape resource needs review');
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
  function sample(time){
    return lifecycle.sample(time).map(p=>{
      const random=salt=>particleRandom(p.id,salt,seed),birthPhase=(p.born%source.lengthInSec)/source.lengthInSec;
      let origin=[0,0,0];
      if(shape?.enabled){
        origin=['x','y','z'].map((axis,i)=>(random(10+i)-.5)*shape.m_Scale[axis]);
        origin=rotateShape(origin,shape.m_Rotation).map((v,i)=>v+shape.m_Position[['x','y','z'][i]]);
      }
      const t=p.age/p.lifetime;
      const displacement=velocity?.enabled?['x','y','z'].map((axis,i)=>p.lifetime*integrateParticleCurve(velocity[axis],0,t,random(13+i))):[0,0,0];
      let sheet=null;
      if(uv?.enabled){
        // Serialized native fields are normalized. Unity's editor remaps both
        // frame curves to the tile count when displaying frame indices.
        const phase=sampleParticleCurve(uv.startFrame,birthPhase,random(16))+uv.cycles*sampleParticleCurve(uv.frameOverTime,t,random(17));
        const count=uv.tilesX*uv.tilesY,frame=Math.min(count-1,Math.floor(((phase%1+1)%1)*count));
        sheet={frame,scale:[1/uv.tilesX,1/uv.tilesY],offset:[(frame%uv.tilesX)/uv.tilesX,1-(Math.floor(frame/uv.tilesX)+1)/uv.tilesY],mask:uv.uvChannelMask};
      }
      return {...p,origin,displacement,position:origin.map((v,i)=>v+displacement[i]),velocitySpace:velocity?.enabled&&velocity.inWorldSpace?'world':'local',simulationSpace:source.moveWithTransform===1?'world':'local',birthTime:time-p.age/source.simulationSpeed,sheet};
    });
  }
  return {sample};
}

function rotateShape([x,y,z],rotation){
  const [a,b,c]=['x','y','z'].map(k=>rotation[k]*Math.PI/180);
  // Unity Euler Z-X-Y order: apply Z first, then X, then Y.
  const u=x*Math.cos(c)-y*Math.sin(c),v=x*Math.sin(c)+y*Math.cos(c);
  const w=v*Math.cos(a)-z*Math.sin(a),q=v*Math.sin(a)+z*Math.cos(a);
  return [u*Math.cos(b)+q*Math.sin(b),w,-u*Math.sin(b)+q*Math.cos(b)];
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
