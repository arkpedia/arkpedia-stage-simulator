// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFile,access}from'node:fs/promises';import{createHash}from'node:crypto';
import art from'../data/arkpedia-makoto-art.json'with{type:'json'};import recipe from'../data/arkpedia-makoto-art-recipe.json'with{type:'json'};
import proof from'../data/arkpedia-makoto-visibility.json'with{type:'json'};
import e from'../data/arkpedia-native-operators/char_4217_makoto.json'with{type:'json'};
import{recoverOriginalVisibility,verifyOriginalVisibility,drawableAttachmentsAt}from'../tools/arkpedia/original-visibility.mjs';
import{recoverMakotoVisibility}from'../tools/arkpedia/makoto-visibility.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const options={id:e.operatorId,receipt:new URL('../data/arkpedia-native-operators/char_4217_makoto.json',import.meta.url),sha256:recipe.foundationSha256,
 clip:'Skill_AllOutAttack_Loop',faces:['Front'],sampleTimes:[0,.0833333358168602,.1666666716337204],
 skeleton:face=>new URL('../../arkpedia-sd-assets/'+art.ownerModels[face.toLowerCase()].files.skeleton.path,import.meta.url)};
// Public CI does not require the separately delivered original-art checkout.
// Actual-byte reproduction remains mandatory in the explicit original-art audit.
let native=false;try{await Promise.all(['Front','Back'].map(face=>access(options.skeleton(face))));native=true;}catch{}
const optional={skip:!native&&'Optional original-art checkout not installed'};
test('Makoto original art binds both native facing chains and does not invent generic skill, Back switches or Back death',()=>{
 assert.equal(art.artworkOnly,true);assert.deepEqual(art.enabledOperators,[]);assert.equal(art.frameParity,false);assert.equal(art.nativeShaderParity,false);
 assert.deepEqual(recipe.nativeMixes,[]);assert.equal(recipe.roles.Front.die,'Stun');assert.equal(recipe.roles.Back.die,null);assert.equal(recipe.roles.Back.stun,null);
 for(const face of['Front','Back']){const row=art.ownerModels[face.toLowerCase()];assert.equal(row.files.skeleton.sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);
  assert.equal(row.metadata.premultipliedAlpha,true);assert.deepEqual(row.metadata.animationRoles,recipe.roles[face]);assert.equal(row.metadata.animationRoles.skill,null);
 }
 assert.equal(art.ownerModels.back.metadata.animations.Doll_Skill_3_P2_Loop,undefined);
});
test('Visibility proof preserves all317 source slot timelines, clearing315 and retaining only non-drawable masks',()=>{
 assert.deepEqual(Object.keys(proof.models),['Front']);assert.deepEqual(proof.enabledOperators,[]);assert.equal(proof.frameParity,false);assert.equal(proof.nativePixelParity,false);
 const m=proof.models.Front;assert.equal(m.duration,.1666666716337204);assert.equal(m.setupAttachments.length,317);assert.equal(m.attachmentTimelines.length,317);
 assert.equal(m.attachmentTimelines.filter(t=>t.frames[0].attachment===null).length,315);assert.equal(m.attachmentTimelines.filter(t=>t.frames[0].attachment?.type==='clipping').length,2);
 for(const time of[0,.01,.0833333358168602,.16,.1666666716337204])assert.equal(drawableAttachmentsAt(m,time),0);
});
test('Both visibility recipe and original-art receipt retain their exact committed hashes',async()=>{
 assert.equal(sha(await readFile(new URL('../data/arkpedia-makoto-visibility.json',import.meta.url))),recipe.visibilityProof.sha256);
 assert.equal(sha(await readFile(new URL('../data/arkpedia-makoto-art-recipe.json',import.meta.url))),art.recipeSha256);
});
test('Actual delivered native bytes reproduce visibility without a separate asset manifest',optional,async()=>{
 assert.deepEqual(await recoverMakotoVisibility({read:async(path,...args)=>{assert.ok(!String(path).endsWith('manifest.json'));return readFile(path,...args);}}),proof);await verifyOriginalVisibility(proof,options);
});
test('A proof cannot omit a facing which contains the clip or fabricate an absent Back loop',optional,async()=>{
 await assert.rejects(()=>recoverOriginalVisibility({...options,clip:'Attack_A',sampleTimes:[.5]}),/cannot omit/);
 await assert.rejects(()=>recoverOriginalVisibility({...options,faces:['Front','Back']}));
 for(const faces of[[],['Single'],['Front','Front']])await assert.rejects(()=>recoverOriginalVisibility({...options,faces}));
});
test('Changed source skeletons, attachment visibility and approval claims fail closed',optional,async()=>{
 await assert.rejects(()=>recoverMakotoVisibility({read:async(path,...args)=>{const b=await readFile(path,...args);if(String(path).endsWith('.skel')){const altered=Buffer.from(b);altered[altered.length-1]^=1;return altered;}return b;}}));
 for(const mutate of[p=>p.models.Front.samples[0].drawableAttachments=315,p=>p.models.Front.attachmentTimelines[0].frames[0].time=.1,p=>p.frameParity=true,p=>p.nativePixelParity=true,p=>p.models.Front.setupAttachments.pop()]){
  const p=structuredClone(proof);mutate(p);await assert.rejects(()=>verifyOriginalVisibility(p,options));
 }
});
