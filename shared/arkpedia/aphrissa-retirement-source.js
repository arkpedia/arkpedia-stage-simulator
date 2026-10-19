// SPDX-License-Identifier: GPL-3.0-or-later
// Conservative authored particle bounds, never a compiled Finish implementation.
import {createEffectPose} from './native-effect-pose.js';
import {APHRISSA_BEAM_PACK} from './aphrissa-beam-presentation.js';
export function deriveAphrissaRetirement(pack,animations){
  if(animations.sourcePackSha256!==APHRISSA_BEAM_PACK)throw Error('Changed original Aphrissa retirement source');
  const roots={};
  for(const root of Object.keys(pack.roots)){
    const pose=createEffectPose(pack,animations,root),r=pack.records,
      components=[...pose.nodes.values()].flatMap(n=>(r[n.gameObject].references??[]).filter(v=>v.field==='component').map(v=>v.target)),
      systems=components.filter(id=>r[id].type==='ParticleSystem'),
      effects=(r[pack.roots[root]].references??[]).filter(v=>v.field==='component').map(v=>v.target)
        .filter(id=>r[id].type==='MonoBehaviour'&&Object.hasOwn(r[id].data,'_delayToFinish'));
    if(effects.length!==1)throw Error('Missing original effect finish delay');
    const finishDelay=r[effects[0]].data._delayToFinish;
    if(!Number.isFinite(finishDelay)||finishDelay<0)throw Error('Invalid original effect finish delay');
    let lifetimeBound=0;const witnesses=[];
    for(const id of systems){const p=r[id].data,c=p.InitialModule.startLifetime,speed=p.simulationSpeed;
      if(![0,3].includes(c.minMaxState)||![c.scalar,...(c.minMaxState===3?[c.minScalar]:[])].every(v=>Number.isFinite(v)&&v>0)
        ||!Number.isFinite(speed)||speed<=0)throw Error('Unbounded original particle lifetime');
      const upper=(c.minMaxState===3?Math.max(c.scalar,c.minScalar):c.scalar)/speed;
      if(upper>lifetimeBound){lifetimeBound=upper;witnesses.length=0;}
      if(upper===lifetimeBound)witnesses.push({particle:id,simulationSpeed:speed,startLifetime:structuredClone(c)});
    }
    const nonParticleRenderers=[...pose.renderers].filter(([id])=>r[id].type!=='ParticleSystemRenderer').length,
      derivedEmission=systems.some(id=>r[id].data.SubModule?.enabled||r[id].data.TrailModule?.enabled);
    roots[root]={particleSystems:systems.length,nonParticleRenderers,derivedEmission,lifetimeBound,finishDelay,
      drainBound:lifetimeBound+finishDelay,particleDrainSupported:systems.length>0&&nonParticleRenderers===0&&!derivedEmission,witnesses};
  }
  return{schemaVersion:1,operator:'char_4229_aphris',sourcePackSha256:APHRISSA_BEAM_PACK,roots,
    scope:{originalLifetimeBounds:true,includesInactiveHelpers:true,emissionHalfOpen:true,nativeFinishDispatchVerified:false,
      nativeGeometryRetirementVerified:false,enabledOperators:[]}};
}
