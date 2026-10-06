import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateStageArt, artBase, fetchArtFile } from '../shared/arkpedia/stage-art.js';
import { rgbmLightmapChunk } from '../shared/arkpedia/lighting.js';
import { ShaderChunk, ShaderLib } from 'three';
const data=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
const scene=JSON.parse(await readFile(new URL('./fixtures/arkpedia-0-1-scene.json',import.meta.url)));
test('the installed Three standard shader supports the original RGBM bake, including its alpha multiplier',()=> {
  assert.ok(ShaderLib.standard.fragmentShader.includes('#include <lights_fragment_maps>'));
  const chunk=rgbmLightmapChunk(ShaderChunk.lights_fragment_maps);
  assert.ok(chunk.includes('34.493242 * pow(lightMapTexel.a, 2.2)'));
  assert.ok(chunk.includes('irradiance += lightMapIrradiance;'));
  assert.throws(()=>rgbmLightmapChunk('changed shader contract'),/Unsupported lightmap shader/);
});
test('original scene matches the exact gameplay geometry and retains source tile elevations',()=> {
  validateStageArt(scene,data.stage);
  assert.equal(scene.staticSubmeshes,177);
  assert.equal(scene.tileHeights[1][3],0.2);
  assert.equal(scene.tileHeights[2][3],0);
  const wrong=structuredClone(scene);wrong.geometryHash='0'.repeat(64);
  assert.throws(()=>validateStageArt(wrong,data.stage),/match/);
  const overflow=structuredClone(scene);overflow.meshes[0].attributes.position.byteOffset=scene.buffer.bytes;
  assert.throws(()=>validateStageArt(overflow,data.stage),/range/);
});
test('art URLs require immutable pins and file checksums detect a tampered response',async()=> {
  assert.ok(artBase(data.stage.art).includes(data.stage.art.commit));
  assert.throws(()=>artBase({...data.stage.art,commit:'main'}),/immutable/);
  const b=new TextEncoder().encode('valid');
  const entry={path:'scene.json',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
  await fetchArtFile('https://example.com/',entry,async()=>new Response(b));
  await assert.rejects(fetchArtFile('https://example.com/',entry,async()=>new Response('bad')),/checksum/);
  await assert.rejects(fetchArtFile('https://example.com/',{...entry,path:'../secret'},async()=>new Response(b)),/Invalid/);
});
