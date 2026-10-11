// SPDX-License-Identifier: GPL-3.0-or-later
// Original TrailRenderer controls, replayed from explicit world-position history.
// Native point expiry/interpolation and ribbon joins are not frame-certified.
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Invalid native trail '+label);return v;};
const vector=(v,label)=>{if(!Array.isArray(v)||v.length!==3)throw Error('Invalid native trail '+label);return v.map(n=>finite(n,label));};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const n=Math.hypot(...v);return n>1e-12?v.map(x=>x/n):null;};
const distance=(a,b)=>Math.hypot(...sub(a,b));

// A caller supplies the motion; no guessed orbit is substituted for native
// script motion. Positions are offsets in the original effect's world axes.
export function createEffectTrajectory(samples){
  if(!Array.isArray(samples)||!samples.length||samples.length>20000)throw Error('Invalid native trail movement history');
  const points=samples.map((p,i)=>{
    const time=finite(p.time,'history clock');
    if(time<0||i&&time<=samples[i-1].time)throw Error('Unordered native trail history');
    return {time,position:vector(p.position,'history position')};
  });
  if(points[0].time!==0)throw Error('Native trail history must start at zero');
  return {
    sample(time){
      finite(time,'movement clock');
      if(time<=0)return points[0].position.slice();
      if(time>=points.at(-1).time)return points.at(-1).position.slice();
      let lo=0,hi=points.length-1;
      while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].time<=time)lo=mid;else hi=mid;}
      const a=points[lo],b=points[hi],u=(time-a.time)/(b.time-a.time);
      return a.position.map((v,i)=>v+(b.position[i]-v)*u);
    },
    times(time){
      finite(time,'movement clock');
      if(time<0)return [];
      const result=points.filter(p=>p.time<=time).map(p=>p.time);
      if(result.at(-1)!==time)result.push(time);
      return result;
    },
    scope:{recordedMotion:true,compiledFrameParity:false}
  };
}

export function createEffectTrail(source){
  const p=source.m_Parameters;
  if(!p||p.alignment!==0||p.textureMode!==0||p.numCapVertices!==0||p.numCornerVertices!==0
    ||p.generateLightingData||source.m_Autodestruct)throw Error('Native trail alignment/texture/caps/lighting needs review');
  const lifetime=finite(source.m_Time,'lifetime'),minimum=finite(source.m_MinVertexDistance,'minimum distance');
  if(lifetime<0||minimum<0||finite(p.widthMultiplier,'width')<0)throw Error('Invalid native trail dimensions');
  const width={minMaxState:1,scalar:p.widthMultiplier,maxCurve:p.widthCurve};
  const gradient={minMaxState:1,maxGradient:p.colorGradient};
  for(const t of [0,.5,1]){if(sampleParticleCurve(width,t)<0)throw Error('Negative native trail width');sampleParticleGradient(gradient,t);}
  return {
    sample(time,history,camera){
      finite(time,'clock');vector(camera,'camera');
      if(!Array.isArray(history)||history.length>20001)throw Error('Invalid native trail history');
      const accepted=[];
      let previous=-Infinity;
      for(const row of history){
        const t=finite(row.time,'point clock'),position=vector(row.position,'point position');
        if(t<0||t<=previous)throw Error('Unordered native trail points');previous=t;
        if(row.emitting!==undefined&&typeof row.emitting!=='boolean')throw Error('Invalid native trail emission state');
        if(t>time)continue;
        if(!source.m_Enabled||!source.m_Emitting||row.emitting===false)continue;
        const last=accepted.at(-1);
        if(!last||distance(last.position,position)>=minimum&&distance(last.position,position)>1e-12)accepted.push({time:t,position});
      }
      // Newest is the head (normalized length 0). A point expires at lifetime.
      // Rebuild from history on every scrub: no future points survive a rewind.
      const points=accepted.filter(p=>time-p.time<lifetime).reverse();
      const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+distance(points[i-1].position,points[i].position));
      const total=lengths.at(-1)||0,positions=[],colors=[],uvs=[],indices=[],widths=[];
      if(points.length<2||total<=1e-12)return {points,positions,colors,uvs,indices,widths};
      for(let i=0;i<points.length;i++){
        const point=points[i].position,a=points[Math.max(0,i-1)].position,b=points[Math.min(points.length-1,i+1)].position;
        const tangent=norm(sub(b,a))??norm(sub(i?point:b,i?a:point));
        let side=norm(cross(tangent,sub(camera,point)));
        // View-parallel segments use the least-parallel world axis to avoid NaN
        // vertices. This pole and the averaged-tangent joins are local mappings.
        if(!side){const axis=[0,1,2].sort((a,b)=>Math.abs(tangent[a])-Math.abs(tangent[b]))[0];const basis=[0,0,0];basis[axis]=1;side=norm(cross(tangent,basis));}
        const u=lengths[i]/total,w=sampleParticleCurve(width,u),color=sampleParticleGradient(gradient,u);widths.push(w);
        for(const sign of [-1,1]){positions.push(...point.map((v,k)=>v+sign*side[k]*w/2));colors.push(...color);uvs.push(u,sign===-1?0:1);}
        if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
      }
      return {points,positions,colors,uvs,indices,widths};
    },
    scope:{localReplay:true,compiledFrameParity:false}
  };
}
