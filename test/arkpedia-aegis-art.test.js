// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import art from '../data/arkpedia-aegis-art.json' with{type:'json'};
import recipe from '../data/arkpedia-aegis-art-recipe.json' with{type:'json'};
import clocks from '../data/arkpedia-aegis-clocks.json' with{type:'json'};
import {aegisNativeInputs,AEGIS_ID as ID} from '../server/sim/content/arkpedia-aegis-source.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('Held Aegis artwork binds original files, pixels, PMA and recipe without granting combat admission',async()=>{
 assert.equal(art.owner,ID);assert.deepEqual(art.enabledOperators,[]);assert.equal(art.artworkOnly,true);
 for(const k of['frameParity','nativeParticleSupport','nativeShaderParity'])assert.equal(art[k],false);
 assert.equal(art.foundation.sha256,sha(await readFile(new URL('../'+art.foundation.path,import.meta.url))));
 assert.equal(art.recipeSha256,sha(await readFile(new URL('../data/arkpedia-aegis-art-recipe.json',import.meta.url))));
 assert.deepEqual(recipe.nativeMixes,aegisNativeInputs().artController._mixSettings.map(m=>Object.fromEntries(['sourceAnimName','targetAnimName','mixAnimName'].map(k=>[k,m[k]]))));
 for(const face of['Front','Back']){const r=art.ownerModels[face.toLowerCase()];assert.equal(r.metadata.premultipliedAlpha,true);
  assert.equal(r.materialFloats._StraightAlphaInput,0);assert.equal(r.materialFloats._UseAlphaTex,0);
  assert.equal(r.files.skeleton.sha256,clocks.models[face].sha256);assert.deepEqual(r.metadata.animationRoles,recipe.roles[face]);
  assert.equal(r.metadata.animations.Skill_2_Loop,0);assert.equal(r.metadata.animations.Skill_1_Stun,undefined);
  assert.equal(r.metadata.animations.nSkill_1_Stun,face==='Front'?3.333:undefined);
  assert.match(r.decodedPixelSha256,/^[a-f0-9]{64}$/);assert.match(r.source.commit,/^[a-f0-9]{40}$/);
 }
});
