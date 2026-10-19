// SPDX-License-Identifier: GPL-3.0-or-later

// Geometric cone-base replay from authored radius, thickness and angle. This
// retains the preview's area-uniform radial sampling and stable random factors;
// it is not evidence of Unity's compiled emission distribution or RNG parity.
export const DISCRETE_CONE_ARC_CONTRACT=Object.freeze({
  mapping:'Random full-circle normalized floor bins; closed endpoint wraps to zero',
  nativeEmissionParity:false,compiledFrameParity:false,
});
export const BURST_SPREAD_CONE_CONTRACT=Object.freeze({
  mapping:'Original emission-attempt cohort; equal full-circle bins starting at positive X; no duplicated endpoint',
  nativeEmissionParity:false,compiledFrameParity:false,
});
export function createParticleCone(shape,{discreteArcContract=null,burstSpreadContract=null}={}){
  if(shape.alignToDirection||shape.randomDirectionAmount!==0||shape.sphericalDirectionAmount!==0||shape.randomPositionAmount!==0)
    throw Error('Native cone direction controls need review');
  for(const field of ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])
    if(shape[field]?.m_PathID!=='0')throw Error('Native cone resource needs review');
  const burst=shape.arc?.mode===3;
  if(shape.type!==4||!Number.isFinite(shape.angle)||shape.angle<0||shape.angle>90
    ||shape.arc?.mode!==0&&!(burst&&burstSpreadContract===BURST_SPREAD_CONE_CONTRACT)||shape.arc.value!==360
    ||!Number.isFinite(shape.arc.spread)||shape.arc.spread<0||shape.arc.spread>1
    ||shape.arc.spread>0&&!Number.isFinite(1/shape.arc.spread)
    ||burst&&shape.arc.spread!==0
    ||shape.arc.spread!==0&&discreteArcContract!==DISCRETE_CONE_ARC_CONTRACT)
    throw Error('Native cone angle/arc mode needs review');
  if(shape.radius?.mode!==0||shape.radius.spread!==0||!Number.isFinite(shape.radius.value)||shape.radius.value<0
    ||!Number.isFinite(shape.radiusThickness)||shape.radiusThickness<0||shape.radiusThickness>1)
    throw Error('Native cone radius mode needs review');
  if(shape.angle>0&&shape.radius.value===0)throw Error('Native point cone direction needs review');
  if(!['x','y','z'].every(axis=>Number.isFinite(shape.m_Scale?.[axis])))throw Error('Invalid native cone scale');
  const radius=shape.radius.value,inner=radius*(1-shape.radiusThickness),degrees=shape.angle,angle=degrees*Math.PI/180;
  const scale=[shape.m_Scale.x,shape.m_Scale.y];
  return {sample(radial,azimuth,{cohort=null}={}){
    if(![radial,azimuth].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid native cone sample');
    const r=Math.sqrt(inner*inner+radial*(radius*radius-inner*inner));
    // Unity's authored Spread defines normalized discrete arc intervals.
    // Floor-bin selection is the explicit local random-sampling policy; the
    // native random distribution/compiled quantization remain unverified.
    if(burst&&(!Number.isSafeInteger(cohort?.count)||cohort.count<1||!Number.isSafeInteger(cohort.index)||cohort.index<0||cohort.index>=cohort.count))
      throw Error('Burst Spread needs its original particle cohort');
    const spread=shape.arc.spread,phase=burst?cohort.index/cohort.count:
      spread>0?Math.floor((azimuth===1?0:azimuth)/spread)*spread:azimuth;
    const phi=phase*Math.PI*2;
    const x=Math.cos(phi),y=Math.sin(phi),origin=[r*x*scale[0],r*y*scale[1],0];
    if(degrees===0)return {origin,direction:[0,0,1]};
    // Rays from the virtual apex give divergence proportional to base radius.
    // Scale changes spawn geometry; direction stays in the unscaled shape basis.
    // The exact 90-degree limit is planar, without tan(90) or floating Z drift.
    if(degrees===90)return {origin,direction:[x,y,0]};
    const outward=r/radius*Math.sin(angle),forward=Math.cos(angle),length=Math.hypot(outward,forward);
    return {origin,direction:[outward*x/length,outward*y/length,forward/length]};
  }};
}
