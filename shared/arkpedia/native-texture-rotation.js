// SPDX-License-Identifier: GPL-3.0-or-later
// Serialized per-texture angles, mapped as a local counterclockwise UV basis.
// The foreign native script's sign/order and activation lifecycle are unverified.
const foreign='archive:/CAB-658d74aab777086fc32b93f385be999a/CAB-658d74aab777086fc32b93f385be999a';
const script='7163214010000414217';
const keys=['_angle2','_angle3','_angle4','_propertyName','_rotateTex1','_rotateTex2','_rotateTex3','_rotateTex4','angle1','m_Enabled','m_GameObject','m_Name','m_Script'];
export function textureRotationVector(degrees){
  if(!Number.isFinite(degrees))throw Error('Invalid source texture rotation angle');
  const radians=(degrees%360)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  return[c,s,-s,c];
}
export function createTextureRotations(pack,component,declarations,animations){
  const rotations=declarations.filter(d=>/^_Rotation[0-3]$/.test(d.name));
  if(!rotations.length)return null;
  if(rotations.length!==4||rotations.some(d=>d.type!=='vec4'||d.count!==null)||new Set(rotations.map(d=>d.name)).size!==4)
    throw Error('Unsupported source texture rotation uniforms');
  const renderer=pack.records[component],go=renderer?.references?.find(r=>r.field==='m_GameObject')?.target;
  const candidates=(pack.records[go]?.references??[]).filter(r=>r.field==='component')
    .map(r=>[r.target,pack.records[r.target]]).filter(([,r])=>r?.type==='MonoBehaviour'&&Object.hasOwn(r.data,'_rotateTex1'));
  if(candidates.length!==1)throw Error('Missing or ambiguous source texture rotation script');
  const[id,record]=candidates[0],d=record.data,binding=pack.scriptBindings?.[id];
  const owner=record.references?.filter(r=>r.field==='m_GameObject'),scripts=record.references?.filter(r=>r.field==='m_Script');
  if(!owner||owner.length!==1||owner[0].target!==go||!scripts||scripts.length!==1||!scripts[0].scriptBinding
    ||owner[0].pointer?.m_FileID!==0||owner[0].pointer?.m_PathID!==go?.split(':').at(-1)
    ||d.m_GameObject?.m_FileID!==0||d.m_GameObject?.m_PathID!==owner[0].pointer?.m_PathID
    ||binding?.foreignFile!==foreign||binding.pointer?.m_PathID!==script||binding.pointer?.m_FileID!==1
    ||d.m_Script?.m_PathID!==script||d.m_Script?.m_FileID!==1||scripts[0].pointer?.m_PathID!==script||scripts[0].pointer?.m_FileID!==1
    ||d._propertyName!=='_Rotation'||d.m_Enabled!==1||d.m_Name!==''||Object.keys(d).sort().join()!==keys.slice().sort().join())
    throw Error('Unverified source texture rotation script binding');
  if(animations.instances.some(i=>i.bindings.some(b=>b.component===id||b.gameObject===go&&/angle|rotateTex|propertyName/.test(b.property??''))))throw Error('Animated texture rotation script needs review');
  const angles=[d.angle1,d._angle2,d._angle3,d._angle4],values={};
  angles.forEach((angle,index)=>{
    const enabled=d['_rotateTex'+(index+1)];
    if(![0,1].includes(enabled)||!Number.isFinite(angle)||!enabled&&angle!==0)
      throw Error('Unsupported source texture rotation toggle/angle');
    values['_Rotation'+index]=textureRotationVector(enabled?angle:0);
  });
  return{script:id,angles:angles.slice(),values,scope:{sourceAngles:true,localCounterclockwiseBasis:true,nativeSignOrderVerified:false,compiledFrameParity:false}};
}
