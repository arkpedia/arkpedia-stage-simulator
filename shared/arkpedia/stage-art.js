// SPDX-License-Identifier: GPL-3.0-or-later
// Never dress one gameplay map with another scene, even if the dimensions match.
export function validateStageArt(scene, stage) {
  const g = stage.geometry;
  if (scene.schemaVersion !== 1 || scene.stage !== stage.code ||
      scene.geometryHash !== stage.pathing.geometryHash || scene.coordinates !== 'column,row,height' ||
      scene.tileHeights?.length !== g.rows || scene.tileHeights.some(r => r.length !== g.cols || r.some(h=>!Number.isFinite(h))))
    throw Error('Stage artwork does not match the gameplay map');
  for (const mesh of scene.meshes) {
    if (!scene.materials[mesh.material]) throw Error('Stage artwork has an unknown material');
    const attrs = mesh.attributes;
    for (const [name, size, type] of [['position',3,'Float32'],['normal',3,'Float32'],['uv',2,'Float32'],['uv1',2,'Float32'],['index',1,'Uint32']]) {
      const a=attrs[name];
      if (!a || a.type!==type || a.itemSize!==size || !Number.isSafeInteger(a.byteOffset) || a.byteOffset<0 || a.byteOffset%4 ||
          !Number.isSafeInteger(a.count) || a.count<1 || a.byteOffset+a.count*size*4 > scene.buffer.bytes)
        throw Error('Invalid stage artwork geometry range');
      if (name!=='index' && a.count!==attrs.position.count) throw Error('Stage artwork attribute mismatch');
    }
    if (attrs.index.count%3) throw Error('Invalid stage artwork triangles');
  }
}
export function artBase(art) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(art.repository) || !/^[a-f0-9]{40}$/.test(art.commit))
    throw Error('Stage artwork must use an immutable repository revision');
  if (art.localBase != null) {
    if (art.repository !== 'arkpedia/arkpedia-sd-assets' || art.localBase !== `/arkpedia-assets/${art.commit}/`)
      throw Error('Invalid pinned local asset base');
    return art.localBase;
  }
  return `https://raw.githubusercontent.com/${art.repository}/${art.commit}/`;
}
export async function fetchArtFile(base, entry, fetcher=fetch) {
  if (!entry?.path || entry.path.startsWith('/') || entry.path.split('/').some(p=>p==='..'||p==='.') ||
      !/^[\w./-]+$/.test(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes))
    throw Error('Invalid stage artwork file');
  const response=await fetcher(base+entry.path,{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error(`Stage artwork unavailable (${response.status})`);
  const buffer=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  if (buffer.byteLength!==entry.bytes || hash!==entry.sha256) throw Error('Stage artwork checksum mismatch');
  return buffer;
}
