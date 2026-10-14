// SPDX-License-Identifier: GPL-3.0-or-later
// Local legacy stretched-billboard mapping: velocity is the length axis and
// cross(velocity, camera direction) retains head-on thinning. Native basis,
// rotation/order and frame parity are not certified by this mapping.
const fields=['m_RenderMode','m_RenderAlignment','m_CameraVelocityScale','m_VelocityScale','m_LengthScale','m_FreeformStretching','m_RotateWithStretchDirection','m_AllowRoll'];
const signature=s=>JSON.stringify(fields.map(k=>s[k]));
const vector=(v,label)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('Invalid stretched particle '+label);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function particleWorldVelocity(p,time,worldAt,simulationSpeed){
 if(!Number.isFinite(time)||time<0||typeof worldAt!=='function'||!Number.isFinite(simulationSpeed)||simulationSpeed<=0
  ||!Number.isFinite(p.birthTime)||!Number.isFinite(p.lifetime)||p.lifetime<=0||time<p.birthTime-1e-10||time>=p.birthTime+p.lifetime/simulationSpeed)
  throw Error('Invalid stretched particle velocity clock');
 const from=Math.max(0,Math.min(p.birthTime,time),time-1/60),until=from===time?time+Math.min(1/60,(p.birthTime+p.lifetime/simulationSpeed-time)/2):time;
 if(until<=from)throw Error('Stretched particle velocity exceeds lifetime/clock precision');
 const a=worldAt(from,p),b=worldAt(until,p);vector(a,'motion position');vector(b,'motion position');
 const velocity=b.map((v,i)=>(v-a[i])/(until-from));vector(velocity,'world velocity');return velocity;
}
export function createParticleStretch(source){
 if(source.m_RenderMode!==1||![0,2,4].includes(source.m_RenderAlignment)||!Number.isFinite(source.m_LengthScale)
  ||source.m_CameraVelocityScale!==0||source.m_VelocityScale!==0||source.m_FreeformStretching!==false
  ||source.m_RotateWithStretchDirection!==true||source.m_AllowRoll!==true)
  throw Error('Native stretched particle controls need review');
 const stamp=signature(source),lengthScale=source.m_LengthScale;
 function sample({position,velocity,size,cameraPosition,rotation=0}){
  for(const[v,label]of[[position,'position'],[velocity,'velocity'],[size,'size'],[cameraPosition,'camera position']])vector(v,label);
  if(!Number.isFinite(rotation))throw Error('Invalid stretched particle rotation');
  const speed=Math.hypot(...velocity),eye=cameraPosition.map((v,i)=>v-position[i]),distance=Math.hypot(...eye);
  if(!Number.isFinite(speed)||!Number.isFinite(distance))throw Error('Stretched particle exceeds coordinate precision');
  if(speed===0||distance===0)return null; // Explicit stationary/eye-coincident hold; no invented heading.
  const y=velocity.map(v=>v/speed),view=eye.map(v=>v/distance),x=cross(y,view),width=Math.hypot(...x);
  const z=width===0?view:cross(x.map(v=>v/width),y),c=Math.cos(rotation),s=Math.sin(rotation);
  const a=x.map((v,i)=>(v*c+y[i]*s)*size[0]),b=y.map((v,i)=>(v*c-x[i]*s)*size[1]*lengthScale);
  const matrix=[...a,0,...b,0,...z.map((v,i)=>v*size[2]),0,...position,1];
  if(!matrix.every(Number.isFinite))throw Error('Stretched particle exceeds coordinate precision');return matrix;
 }
 return{sample,ownsRenderer:s=>s===source&&signature(s)===stamp,
  scope:{localVelocityBillboard:true,localVelocityAcquisition:'60HzOneSidedAtBirth',nativeBasisOrderVerified:false,compiledFrameParity:false}};
}
