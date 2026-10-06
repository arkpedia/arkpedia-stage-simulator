// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from '/vendor/three.module.js';
import { artBase, fetchArtFile, validateStageArt } from '/shared/arkpedia/stage-art.js';
export async function loadStageArt(stage) {
  const art=stage.art, base=artBase(art);
  const scene=JSON.parse(new TextDecoder().decode(await fetchArtFile(base,art.scene)));
  validateStageArt(scene,stage);
  const files=base+art.scene.path.slice(0,art.scene.path.lastIndexOf('/')+1);
  const group=new THREE.Group(), textures=new Map(), materials=new Map();
  const dispose=()=> {
    group.traverse(o=>o.geometry?.dispose());
    for (const mat of materials.values()) mat.dispose();
    for (const tex of textures.values()) tex.dispose();
  };
  try {
    const buffer=await fetchArtFile(files,scene.buffer);
    // Sequential loads also keep error cleanup deterministic on slow or missing assets.
    for (const [key,entry] of Object.entries(scene.textures)) {
      const bytes=await fetchArtFile(files,entry);
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
      try {
        const tex=await new THREE.TextureLoader().loadAsync(url);
        tex.colorSpace=THREE.SRGBColorSpace;
        if (key===scene.lightmap) tex.channel=1;
        tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
        textures.set(key,tex);
      } finally { URL.revokeObjectURL(url); }
    }
    for (const [key,m] of Object.entries(scene.materials)) {
      const mat=new THREE.MeshStandardMaterial({map:textures.get(m.map),
        roughness:1, metalness:0, lightMap:textures.get(scene.lightmap),lightMapIntensity:2,
        emissive:m.emissiveMap ? 0x707580 : 0x000000, emissiveMap:textures.get(m.emissiveMap) || null});
      materials.set(key,mat);
    }
    for (const mesh of scene.meshes) {
      const geometry=new THREE.BufferGeometry();
      group.add(new THREE.Mesh(geometry,materials.get(mesh.material)));
      for (const [name,a] of Object.entries(mesh.attributes)) {
        const values=name==='index'?new Uint32Array(buffer,a.byteOffset,a.count):new Float32Array(buffer,a.byteOffset,a.count*a.itemSize);
        if (name==='index') {
          if (values.some(i=>i>=mesh.attributes.position.count)) throw Error('Invalid stage artwork index');
          geometry.setIndex(new THREE.BufferAttribute(values,1));
        } else geometry.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));
      }
    }
    return {group,heights:scene.tileHeights,dispose};
  } catch (error) { dispose(); throw error; }
}
