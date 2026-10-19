// SPDX-License-Identifier: GPL-3.0-or-later
// Original two-point, world-space, view-aligned LineRenderer profile.
// Endpoints are explicit caller input, never guessed from editor positions.
// This local ribbon mapping is not compiled Unity geometry/frame parity.
// Native API contracts:
// https://docs.unity3d.com/2021.3/Documentation/ScriptReference/LineTextureMode.Tile.html
// https://docs.unity3d.com/2021.3/Documentation/ScriptReference/LineRenderer-useWorldSpace.html
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Invalid native line '+label);return v;};
const vector=(v,label)=>{
  if(!Array.isArray(v)||v.length!==3)throw Error('Invalid native line '+label);
  return v.map(n=>finite(n,label));
};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const empty=()=>({positions:[],colors:[],uvs:[],indices:[],widths:[]});

export function createEffectLine(source){
  const p=source.m_Parameters;
  if(!p||source.m_UseWorldSpace!==true||source.m_Loop!==false||p.alignment!==0||p.textureMode!==1
    ||p.numCapVertices!==0||p.numCornerVertices!==0||p.generateLightingData!==false)
    throw Error('Native line space/alignment/texture/caps/lighting needs review');
  if(!Array.isArray(source.m_Positions)||source.m_Positions.length!==2)
    throw Error('Native line point count needs review');
  const original=source.m_Positions.map(v=>vector(['x','y','z'].map(k=>v[k]),'source position'));
  // All recovered Aphrissa line layers serialize a single constant width key.
  // Do not imply that a four-vertex ribbon implements additional tessellation.
  if(p.widthCurve?.m_Curve?.length!==1)throw Error('Native line width tessellation needs review');
  const curve={minMaxState:1,scalar:1,maxCurve:structuredClone(p.widthCurve)};
  const gradient={minMaxState:1,maxGradient:structuredClone(p.colorGradient)};
  const multiplier=finite(p.widthMultiplier,'width multiplier');
  if(multiplier<0||sampleParticleCurve(curve,0)<0)throw Error('Negative native line width');
  // Two source endpoints produce two pairs of vertices. Interior gradient
  // keys would need additional geometry; never drop them silently.
  const g=p.colorGradient;
  if(g.m_NumColorKeys!==2||g.m_NumAlphaKeys!==2||g.ctime0!==0||g.ctime1!==65535||g.atime0!==0||g.atime1!==65535)
    throw Error('Native line gradient tessellation needs review');
  const colors=[sampleParticleGradient(gradient,0),sampleParticleGradient(gradient,1)];
  return {
    originalPositions:original,
    sample(endpoints,camera,widthMultiplier=multiplier){
      if(!Array.isArray(endpoints)||endpoints.length!==2)throw Error('Native line needs two explicit endpoints');
      const points=endpoints.map(p=>vector(p,'endpoint')),view=vector(camera,'camera');
      const sampledMultiplier=finite(widthMultiplier,'animated width multiplier');
      const width=finite(sampledMultiplier*sampleParticleCurve(curve,0),'animated width');
      if(sampledMultiplier<0||width<0)throw Error('Negative native line width');
      const tangent=points[1].map((v,i)=>v-points[0][i]),length=Math.hypot(...tangent);
      if(!Number.isFinite(length))throw Error('Invalid native line length');
      if(length<=1e-12||width===0)return empty();
      const direction=tangent.map(v=>v/length),toward=view.map((v,i)=>v-points[0][i]);
      const side=cross(direction,toward),size=Math.hypot(...side);
      if(!Number.isFinite(size))throw Error('Invalid native line view');
      // A view-parallel line projects to zero area. Do not invent a world-axis
      // ribbon orientation at that pole or retain geometry from an older frame.
      if(size<=1e-12)return empty();
      const positions=[],rgba=[],uvs=[];
      for(let i=0;i<2;i++)for(const sign of [-1,1]){
        positions.push(...points[i].map((v,k)=>finite(v+sign*side[k]/size*width/2,'vertex')));
        rgba.push(...colors[i]);
        // Tile mode uses distance in world units; original material _ST then
        // controls texture scale/offset in the retained native shader.
        uvs.push(i===0?0:length,sign===-1?0:1);
      }
      return {positions,colors:rgba,uvs,indices:[0,1,2,1,3,2],widths:[width,width]};
    },
    scope:{explicitEndpoints:true,originalWorldSpace:true,localReplay:true,compiledFrameParity:false}
  };
}
