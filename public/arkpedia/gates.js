// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "/vendor/three.module.js";
import { artBase, fetchArtFile } from "/shared/arkpedia/stage-art.js";
import { gateTiles, validateGatePack } from "/shared/arkpedia/gates.js";
import { gateMaterial } from "/js/render/board3d/materials.js";

export async function loadGates(stage, heightAt) {
  const art = stage.gates, base = artBase(art);
  const pack = JSON.parse(new TextDecoder().decode(await fetchArtFile(base, art.pack)));
  validateGatePack(pack);
  const files = base + art.pack.path.slice(0, art.pack.path.lastIndexOf('/') + 1);
  const group = new THREE.Group(), geometries = [], materials = [];
  let texture;
  const dispose = () => {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    texture?.dispose();
  };
  try {
    const buffer = await fetchArtFile(files, pack.buffer);
    const bytes = await fetchArtFile(files, pack.texture);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    try { texture = await new THREE.TextureLoader().loadAsync(url); }
    finally { URL.revokeObjectURL(url); }
    texture.colorSpace = THREE.SRGBColorSpace;
    const parts = pack.parts.map(part => {
      const geometry = new THREE.BufferGeometry(); geometries.push(geometry);
      for (const [name, a] of Object.entries(part.attributes)) {
        const values = name === "index" ? new Uint32Array(buffer, a.byteOffset, a.count)
          : new Float32Array(buffer, a.byteOffset, a.count * a.itemSize);
        if (name === "index") {
          if (values.some(i => i >= part.attributes.position.count)) throw Error("Invalid gate triangle");
          geometry.setIndex(new THREE.BufferAttribute(values, 1));
        } else geometry.setAttribute(name, new THREE.BufferAttribute(values, a.itemSize));
      }
      const material = gateMaterial(THREE, texture, { additive: part.blend === "additive", tint: part.tint });
      // Entry/defence frames are map information: baked buildings must not hide
      // the spawn marker. Operator/enemy sprites still render in front of them.
      material.depthTest = false;
      materials.push(material);
      return { part, geometry, material };
    });
    for (const tile of gateTiles(stage.geometry, heightAt)) {
      for (const { part, geometry, material } of parts.filter(p => p.part.kind === tile.kind)) {
        const mesh = new THREE.Mesh(geometry, material);
        // The source effect faces north after a half-turn in the board frame;
        // otherwise the warning glyph is upside down from the battle camera.
        mesh.rotation.z = Math.PI;
        mesh.position.set(tile.col, tile.row, tile.height + 0.003);
        mesh.renderOrder = part.blend === "alpha" ? 4 : 5;
        group.add(mesh);
      }
    }
    return { group, dispose, update(time) {
      // Gentle intensity pulse; the original meshes/atlas supply the edges and symbols.
      const pulse = 0.6 + 0.15 * (0.5 - 0.5 * Math.cos(time * Math.PI));
      for (const m of materials) m.uniforms.uPulse.value = m.userData.additive ? pulse : 0.9;
    } };
  } catch (error) { dispose(); throw error; }
}
