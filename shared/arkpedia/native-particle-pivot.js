// SPDX-License-Identifier: GPL-3.0-or-later
// A local diameter-relative pivot mapping. The particle's physics position is
// the rotation anchor; its rendered vertices are displaced in the scaled,
// rotated renderer basis. Native sign/order/frame parity stays unapproved.
export function particlePivotMatrix(frame,pivot){
 if((!Array.isArray(frame)&&!ArrayBuffer.isView(frame))||frame.length!==16||![...frame].every(Number.isFinite)
  ||[3,7,11].some(i=>Math.abs(frame[i])>1e-12)||Math.abs(frame[15]-1)>1e-12)throw Error('Invalid native particle pivot frame');
 if(!Array.isArray(pivot)||pivot.length!==3||!pivot.every(Number.isFinite))throw Error('Invalid native particle pivot vector');
 const out=Array.from(frame);
 for(let i=0;i<3;i++)out[12+i]-=frame[i]*pivot[0]+frame[4+i]*pivot[1]+frame[8+i]*pivot[2];
 if(!out.every(Number.isFinite))throw Error('Native particle pivot exceeds coordinate precision');
 return out;
}
export function createParticlePivot(source,{stretch=null}={}){
 const read=(value,label)=>{const vector=['x','y','z'].map(k=>value?.[k]);if(!vector.every(Number.isFinite))throw Error('Invalid native particle '+label);return vector;};
 const pivot=read(source.m_Pivot,'pivot'),flip=read(source.m_Flip,'flip');
 if(flip.some(v=>v!==0))throw Error('Native particle flip needs review');
 if(!(source.m_RenderMode===1&&stretch?.ownsRenderer(source))&&(![0,4].includes(source.m_RenderMode)||![0,2].includes(source.m_RenderAlignment)||source.m_RenderMode===4&&source.m_RenderAlignment!==2))
  throw Error('Native particle pivot render mode/alignment needs review');
 return{sample:frame=>particlePivotMatrix(frame,pivot),pivot:pivot.slice(),scope:{localPivotMapping:true,compiledFrameParity:false}};
}
