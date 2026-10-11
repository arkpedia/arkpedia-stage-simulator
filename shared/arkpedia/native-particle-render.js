// SPDX-License-Identifier: GPL-3.0-or-later
// Matrix/UV mappings are kept separate from original shader arithmetic. They
// remain a local renderer mapping, not certified Unity renderer parity.
export function particleWorldPosition(particle,birth,current,movement=current){
  validate(birth);validate(current);validate(movement);
  const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
  const direction=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]);
  if(particle.simulationSpace==='world'){
    // Translated emitters leave already-born particles behind. A rotated or
    // scaled emitter needs velocity-frame integration, and is rejected here.
    for(const i of [0,1,2,4,5,6,8,9,10])if(Math.abs(birth[i]-current[i])>1e-8)throw Error('Animated world particle velocity frame needs integration');
    const origin=point(birth,particle.origin),delta=particle.velocitySpace==='world'?particle.displacement:direction(movement,particle.displacement);
    return origin.map((v,i)=>v+delta[i]);
  }
  const origin=point(current,particle.origin),delta=particle.velocitySpace==='world'?particle.displacement:direction(movement,particle.displacement);
  if(particle.velocitySpace==='world')throw Error('World velocity in a local simulation frame needs integration');
  return origin.map((v,i)=>v+delta[i]);
}
function validate(m){if(!Array.isArray(m)&&!ArrayBuffer.isView(m)||m.length!==16||[...m].some(v=>!Number.isFinite(v)))throw Error('Invalid native particle renderer matrix');}

export function particleSheetUV(values,sheet){
  if(values.length%2)throw Error('Invalid native billboard UVs');
  if(!sheet)return Float32Array.from(values);
  if(!sheet.scale?.every(v=>Number.isFinite(v)&&v>0)||sheet.scale.length!==2||!sheet.offset?.every(Number.isFinite)||sheet.offset.length!==2)throw Error('Invalid native particle sheet');
  return Float32Array.from(values,(v,i)=>v*sheet.scale[i%2]+sheet.offset[i%2]);
}
