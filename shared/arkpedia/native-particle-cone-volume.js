// SPDX-License-Identifier: GPL-3.0-or-later
// An explicit local uniform-frustum-volume mapping. Native emission density,
// random draw order and compiled frame parity remain unverified.
export function createParticleConeVolume(shape){
 if(shape.type!==8||shape.alignToDirection||shape.randomDirectionAmount!==0||shape.sphericalDirectionAmount!==0||shape.randomPositionAmount!==0
  ||!Number.isFinite(shape.angle)||shape.angle<0||shape.angle>=90||!Number.isFinite(shape.length)||shape.length<0
  ||shape.arc?.mode!==0||shape.arc.spread!==0||shape.arc.value!==360)throw Error('Native cone volume angle/length/arc needs review');
 for(const field of['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])
  if(shape[field]?.m_PathID!=='0')throw Error('Native cone volume resource needs review');
 if(shape.radius?.mode!==0||shape.radius.spread!==0||!Number.isFinite(shape.radius.value)||shape.radius.value<0
  ||!Number.isFinite(shape.radiusThickness)||shape.radiusThickness<0||shape.radiusThickness>1
  ||!['x','y','z'].every(k=>Number.isFinite(shape.m_Scale?.[k])))throw Error('Native cone volume radius/scale needs review');
 if(shape.radiusThickness===0&&shape.angle!==0)throw Error('Native sloped cone surface distribution needs review');
 const radius=shape.radius.value,length=shape.length,angle=shape.angle*Math.PI/180,tangent=Math.tan(angle),top=radius+length*tangent;
 if(!Number.isFinite(top))throw Error('Cone volume exceeds coordinate precision');
 const maximum=Math.max(radius,top),a=maximum?radius/maximum:0,b=maximum?length*tangent/maximum:0;
 const denominator=a*a+a*b+b*b/3;
 const fraction=h=>denominator?(a*a*h+a*b*h*h+b*b*h*h*h/3)/denominator:h;
 return{sample(radial,azimuth,depth){
  if(![radial,azimuth,depth].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid native cone volume sample');
  let h=depth;
  if(angle!==0&&length!==0&&depth!==0&&depth!==1){
   // Invert the integrated cross-sectional area without subtracting nearly
   // equal cube roots for shallow cones. All iterations have fixed bounds.
   let lo=0,hi=1;for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(fraction(mid)<depth)lo=mid;else hi=mid;}h=(lo+hi)/2;
  }
  const z=length*h,outer=radius+z*tangent,inner=1-shape.radiusThickness,rho=Math.sqrt(inner*inner+radial*(1-inner*inner));
  const phi=azimuth*Math.PI*2,x=Math.cos(phi),y=Math.sin(phi),r=outer*rho;
  const origin=[r*x*shape.m_Scale.x,r*y*shape.m_Scale.y,z*shape.m_Scale.z];
  const outward=rho*Math.sin(angle),forward=Math.cos(angle),norm=Math.hypot(outward,forward),direction=[outward*x/norm,outward*y/norm,forward/norm];
  if(![...origin,...direction].every(Number.isFinite))throw Error('Cone volume exceeds coordinate precision');
  return{origin,direction};
 },fraction,scope:{uniformFrustumVolume:true,nativeEmissionParity:false,compiledFrameParity:false}};
}
