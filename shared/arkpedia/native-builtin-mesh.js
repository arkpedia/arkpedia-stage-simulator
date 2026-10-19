// SPDX-License-Identifier: GPL-3.0-or-later
// A separately verified official-player resource may resolve only its recorded
// original mesh pointers. Unknown files/objects remain held; no generated quad
// stands in for an unresolved authored Mesh.
export function createBuiltinMeshResolver(artifact,sourcePackSha256){
 const source=artifact?.supportedEffectPacks?.[sourcePackSha256],scope=artifact?.scope;
 if(artifact?.schemaVersion!==1||!source||!scope?.originalBuiltinMesh||!scope.engineMatchedOfficialPlayer||scope.wholePackageVerified!==false
  ||scope.compiledFrameParity!==false||scope.exactGameClientVerified===true||scope.enabledOperators?.length!==0||artifact.client?.unityVersion!==source.unityVersion
  ||artifact.client?.platform!==source.platform||artifact.resource?.platform!==source.platform)
  throw Error('Unverified native built-in mesh/player identity');
 const meshes=artifact.meshes,identities={
  '10210':['Quad',604,'9c09568c3b080a71b9a6c6d7eb017b6de02ff8598e35c2decf389e9ebd9824f2'],
  '10202':['Cube',1816,'7d33190c6a48d8788035f8ff076090a8579e111cbef2268cbf6e88262df943f4']};
 const keys=Object.keys(meshes??{});
 if(keys.length<1||keys.length>2||keys.some(key=>{const expected=Object.hasOwn(identities,key)?identities[key]:null,row=meshes[key];
  return!expected||row?.name!==expected[0]||row.serializedBytes!==expected[1]||row.serializedSha256!==expected[2];}))
  throw Error('Unreviewed original built-in mesh object');
 for(const row of Object.values(meshes??{})){
  const d=row.data,n=d?.positions?.length;
  if(!Number.isInteger(n)||n<1||!d.positions.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))
   ||!Array.isArray(d.uvChannels)||d.uvChannels.length!==8||!Array.isArray(d.vertexChannels)
   ||d.normals!==null&&(!Array.isArray(d.normals)||d.normals.length!==n||!d.normals.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))
   ||d.uvChannels.some(v=>v!==null&&(!Array.isArray(v)||v.length!==n||!v.every(row=>Array.isArray(row)&&row.length===2&&row.every(Number.isFinite))))
   ||!Array.isArray(d.submeshTriangles)||d.submeshTriangles.some(sub=>!Array.isArray(sub)||sub.some(t=>!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=n))))
    throw Error('Invalid original built-in mesh buffers');
 }
 return{resolve(component,reference){
  const admitted=artifact.references?.[component];
  if(!admitted||admitted.sourcePackSha256!==sourcePackSha256||reference?.field!=='m_Mesh'||reference.target!==undefined
   ||reference.unresolved?.foreignFile!=='Library/unity default resources'||reference.unresolved.pathId!==admitted.mesh
   ||reference.pointer?.m_PathID!==admitted.mesh||reference.pointer.m_FileID!==admitted.pointer.m_FileID||reference.pointer.m_PathID!==admitted.pointer.m_PathID)
   throw Error('Unresolved original built-in mesh pointer');
  if(!meshes[admitted.mesh])throw Error('Missing recovered original built-in mesh');
  return meshes[admitted.mesh].data;
 },scope:{originalBuiltinMesh:true,compiledFrameParity:false}};
}
