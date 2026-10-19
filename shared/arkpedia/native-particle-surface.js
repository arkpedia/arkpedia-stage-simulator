// SPDX-License-Identifier: GPL-3.0-or-later
// Original Circle and BoxShell emission. Uniform area sampling and preview RNG
// ownership are explicit local mappings, not compiled Unity distribution,
// random draw-order or frame-parity certification.
export function createParticleSurface(shape){
  if(![10,15].includes(shape.type)||shape.alignToDirection||shape.randomDirectionAmount!==0
    ||shape.sphericalDirectionAmount!==0||shape.randomPositionAmount!==0)
    throw Error('Native surface direction controls need review');
  for(const key of ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])
    if(shape[key]?.m_PathID!=='0')throw Error('Native surface resource needs review');
  if(!['x','y','z'].every(k=>Number.isFinite(shape.m_Scale?.[k])))throw Error('Invalid native surface scale');
  const circle=shape.type===10;
  if(circle&&(shape.arc?.mode!==0||shape.arc.value!==360||shape.arc.spread!==0))
    throw Error('Native circle arc mode needs review');
  if(circle&&(shape.radius?.mode!==0||shape.radius.spread!==0||!Number.isFinite(shape.radius.value)||shape.radius.value<0
    ||!Number.isFinite(shape.radiusThickness)||shape.radiusThickness<0||shape.radiusThickness>1))
    throw Error('Native circle radius mode needs review');
  const scale=['x','y','z'].map(k=>shape.m_Scale[k]),radius=circle?shape.radius.value:0,
    innerFraction=circle?1-shape.radiusThickness:0;
  // Normalize areas first to avoid overflow/underflow when selecting faces.
  const maximum=Math.max(...scale.map(Math.abs)),s=maximum?scale.map(v=>Math.abs(v)/maximum):[0,0,0],
    areas=[s[1]*s[2],s[0]*s[2],s[0]*s[1]],total=areas.reduce((sum,v)=>sum+v,0);
  if(!circle&&total===0)throw Error('Native zero-area box shell needs review');
  return {sample(a,b,face=0){
    if(![a,b,face].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid native surface sample');
    if(circle){
      const r=radius*Math.sqrt(innerFraction**2+a*(1-innerFraction**2)),
        angle=b*Math.PI*2,x=Math.cos(angle),y=Math.sin(angle);
      // Shape scale changes the spawn ellipse, not radial movement direction.
      const origin=[r*x*scale[0],r*y*scale[1],0];
      if(!origin.every(Number.isFinite))throw Error('Circle emission exceeds coordinate precision');
      return {origin,direction:[x,y,0]};
    }
    let target=face*2*total,axis=0,sign=-1;
    choose:for(let k=0;k<3;k++)for(const side of [-1,1]){
      if(areas[k]===0)continue;
      axis=k;sign=side;if(target<areas[k])break choose;target-=areas[k];
    }
    const origin=[0,0,0],free=[0,1,2].filter(k=>k!==axis);
    origin[axis]=sign*scale[axis]/2;origin[free[0]]=(a-.5)*scale[free[0]];origin[free[1]]=(b-.5)*scale[free[1]];
    return {origin,direction:[0,0,1]};
  },scope:{surfaceEmission:true,uniformArea:true,nativeEmissionParity:false,compiledFrameParity:false}};
}
