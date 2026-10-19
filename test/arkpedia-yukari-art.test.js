// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
import art from '../data/arkpedia-yukari-art.json' with{type:'json'};import recipe from '../data/arkpedia-yukari-art-recipe.json' with{type:'json'};
import clocks from '../data/arkpedia-yukari-clocks.json' with{type:'json'};import{yukariNativeInputs,YUKARI_ID as ID}from'../server/sim/content/arkpedia-yukari-source.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('Yukari artwork binds original source bytes, pixels and PMA without granting public combat or effects approval',async()=>{
 assert.equal(art.owner,ID);assert.equal(art.artworkOnly,true);assert.deepEqual(art.enabledOperators,[]);for(const k of['frameParity','nativeParticleSupport','nativeShaderParity'])assert.equal(art[k],false);
 assert.equal(art.foundation.sha256,sha(await readFile(new URL('../'+art.foundation.path,import.meta.url))));assert.equal(art.recipeSha256,sha(await readFile(new URL('../data/arkpedia-yukari-art-recipe.json',import.meta.url))));
 for(const face of['Front','Back']){const r=art.ownerModels[face.toLowerCase()];assert.equal(r.metadata.premultipliedAlpha,true);assert.equal(r.materialFloats._StraightAlphaInput,0);assert.equal(r.materialFloats._UseAlphaTex,0);assert.equal(r.files.skeleton.sha256,clocks.models[face].sha256);assert.deepEqual(r.metadata.animationRoles,recipe.roles[face]);assert.match(r.decodedPixelSha256,/^[a-f0-9]{64}$/);assert.match(r.source.commit,/^[a-f0-9]{40}$/);}
});
test('Literal Begin/Loop/End and single-clip skills do not borrow missing Back Down or death tracks',()=>{
 for(const face of['Front','Back']){const r=art.ownerModels[face.toLowerCase()].metadata,roles=r.animationRoles;assert.deepEqual(roles.attack,{begin:'Attack_Begin',loop:'Attack_Loop',end:'Attack_End'});
  assert.equal(roles.skills[0].loop,'Skill_1');assert.equal(roles.skills[1].loop,'Skill_2');assert.equal(roles.skills[0].end,null);assert.equal(roles.skills[1].end,null);assert.equal(r.animations.Attack,undefined);
  assert.equal(roles.die,face==='Front'?'Die':null);assert.equal(roles.attackDown?.loop,face==='Front'?'Attack_Down_Loop':undefined);assert.equal(r.animations.Attack_Down_Loop,face==='Front'?2.1:undefined);}
});
test('Six native mix bindings and all four S1/distinct-facing S2 release events remain source records',()=>{
 assert.equal(recipe.nativeMixes.length,6);assert.deepEqual(recipe.nativeMixes,yukariNativeInputs().artController._mixSettings.map(m=>Object.fromEntries(['sourceAnimName','targetAnimName','mixAnimName'].map(k=>[k,m[k]]))));
 for(const face of['front','back']){const r=art.ownerModels[face];assert.deepEqual(r.metadata.hits.Skill_1,[1.533,1.833,2.133,3.367]);assert.deepEqual(r.metadata.hits.Skill_2,face==='front'?[2.4]:[2.3]);}
});
