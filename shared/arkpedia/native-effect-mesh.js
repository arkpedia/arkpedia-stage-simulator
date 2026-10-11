// SPDX-License-Identifier: GPL-3.0-or-later
// Unity's post-2019 vertex format 2 is UNorm8. MeshHandler exposes its raw
// bytes; the GPU sees normalized components. Keep raw bytes in the source
// export and convert only at the rendering boundary using the source format.
export function effectMeshColors(mesh,particleColor=[1,1,1,1]) {
  if(particleColor.length!==4||!particleColor.every(Number.isFinite))throw new Error('Invalid particle color');
  const channel=mesh.vertexChannels?.[3];
  if(!channel)throw new Error('Missing native vertex color descriptor');
  let colors;
  if(channel.dimension===0){
    if(mesh.colors!==null)throw new Error('Unexpected native color values');
    colors=mesh.positions.map(()=>[1,1,1,1]);
  }else{
    if(channel.dimension!==4||![0,1,2].includes(channel.format)||mesh.colors?.length!==mesh.positions.length)throw new Error('Unsupported native vertex color format');
    colors=mesh.colors.map(c=>{
      if(c.length!==4||!c.every(Number.isFinite))throw new Error('Invalid native vertex color values');
      if(channel.format===2){
        if(!c.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new Error('Invalid UNorm8 color bytes');
        return c.map(v=>v/255);
      }
      return c;
    });
  }
  return colors.flatMap(c=>c.map((v,i)=>v*particleColor[i]));
}
