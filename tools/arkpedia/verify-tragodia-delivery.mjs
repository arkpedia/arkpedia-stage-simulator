// SPDX-License-Identifier: GPL-3.0-or-later
// Independently bind delivered bytes to the frozen original extraction receipts.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function loadTragodiaDelivery(assets=path.resolve(root,'../arkpedia-sd-assets')) {
  const registry=JSON.parse(await readFile(path.join(assets,'native-effect-manifest.json')));
  assert.equal(registry.schemaVersion,1);
  const index=registry.effects.tragodia;
  async function checked(directory,entry){
    assert.match(entry.path,/^[\w./-]+\.(json|bin|webp)$/);
    assert.ok(entry.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));
    const bytes=await readFile(path.join(directory,entry.path));
    assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);return bytes;
  }
  const raw=await checked(assets,index),meta=JSON.parse(raw),directory=path.dirname(path.join(assets,index.path));
  assert.equal(meta.schemaVersion,1);assert.equal(meta.id,'tragodia');assert.equal(meta.operator,'char_1042_phatm2');
  assert.equal(meta.resourceVersion,'26-09-23-17-49-43_b9cc4a');
  assert.equal(index.path,`effects/native/tragodia/${meta.resourceVersion}/${meta.pack.sha256}/manifest.json`);
  assert.deepEqual(meta.scope,{artworkOnly:true,publicBattleApproved:false,compiledFrameParity:false,nativePixelParity:false,
    preparedRoots:['phatm2_skill_03_prison_01']});
  const receipts={};
  for(const [key,suffix]of [['effects','effects'],['animations','effect-animations'],['shaders','effect-shaders']]){
    const delivered=await checked(directory,meta.sourceReceipts[key]);
    const original=await readFile(path.join(root,`data/arkpedia-tragodia-${suffix}.json`));
    assert.deepEqual(delivered,original);receipts[key]=JSON.parse(original);
  }
  const e=receipts.effects;
  assert.deepEqual(meta.pack,e.pack);assert.deepEqual(meta.animations,receipts.animations.artifact);
  assert.deepEqual(meta.shaders,receipts.shaders.artifact);assert.deepEqual(meta.sourceBundles,e.sources);
  assert.deepEqual(meta.roots,e.roots);assert.deepEqual(meta.textures,e.textures);
  assert.deepEqual(meta.unresolvedReferences,e.unresolvedReferences);
  const files=[meta.pack,meta.animations,meta.shaders,...Object.values(meta.textures)];
  for(const entry of files){
    const delivered=await checked(directory,entry);
    assert.deepEqual(delivered,await readFile(path.join(root,'.cache/arkpedia/tragodia-source/effects',entry.path)));
  }
  const decoded=gunzipSync(await checked(directory,meta.pack));
  assert.equal(decoded.length,meta.pack.decodedBytes);assert.equal(sha(decoded),meta.pack.decodedSha256);
  const pack=JSON.parse(decoded);assert.deepEqual(pack.roots,meta.roots);assert.deepEqual(pack.textures,meta.textures);
  const builtin=await checked(directory,meta.builtinMeshes);
  assert.deepEqual(builtin,await readFile(path.join(root,'data/arkpedia-unity-builtin-meshes.json')));
  assert.ok(JSON.parse(builtin).supportedEffectPacks[meta.pack.sha256]);
  assert.equal(Object.keys(meta.roots).length,33);assert.equal(Object.keys(meta.textures).length,72);
  return {directory,meta,manifestSha256:sha(raw),files:files.length+4};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const {meta,manifestSha256,files}=await loadTragodiaDelivery(process.argv[2]);
  console.log(JSON.stringify({manifestSha256,files,roots:Object.keys(meta.roots).length,textures:Object.keys(meta.textures).length,
    preparedRoots:meta.scope.preparedRoots,publicBattleApproved:false}));
}
