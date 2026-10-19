// SPDX-License-Identifier: GPL-3.0-or-later
// Original attachment schedules only. No shader, effect or game-frame inference.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseSkel} from '../assets/skel.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function drawableAttachmentsAt(model,time){
 assert.ok(Number.isFinite(time)&&time>=0&&time<=model.duration);
 const slots=model.setupAttachments.map(s=>({...s}));
 for(const timeline of model.attachmentTimelines){const frame=timeline.frames.filter(f=>f.time<=time).at(-1);if(frame)slots[timeline.slot].attachment=frame.attachment;}
 assert.ok(slots.every(s=>s.attachment?.type!=='missing'),'Original attachment unresolved in default skin');
 return slots.filter(s=>['region','mesh'].includes(s.attachment?.type)).length;
}
export async function recoverOriginalVisibility({id,receipt,sha256,clip,sampleTimes,skeleton,faces=['Front','Back'],read=readFile}){
 const raw=await read(receipt);assert.equal(sha(raw),sha256);const e=JSON.parse(raw);assert.equal(e.operatorId,id);assert.deepEqual(e.enabledOperators,[]);
 assert.ok(typeof clip==='string'&&Array.isArray(sampleTimes)&&sampleTimes.length>0&&new Set(sampleTimes).size===sampleTimes.length);
 assert.ok(Array.isArray(faces)&&faces.length>0&&new Set(faces).size===faces.length&&faces.every(f=>['Front','Back'].includes(f)));
 const models={};for(const face of['Front','Back']){const bytes=await read(skeleton(face)),binding=e.officialSkeletonBindings[id][face];assert.equal(bytes.length,binding.bytes);assert.equal(sha(bytes),binding.sha256);
  const p=parseSkel(bytes,undefined,{includeExactDurations:true,includeAttachmentTimelines:true});assert.deepEqual(p.durations,e.models[id][face].durations);
  if(!faces.includes(face)){assert.equal(p.exactDurations[clip],undefined,'A proof cannot omit a facing that contains the original clip');continue;}
  assert.ok(p.attachmentTimelines[clip]?.length>0);
  const model={sha256:binding.sha256,bytes:binding.bytes,clip,duration:p.exactDurations[clip],setupAttachments:p.setupAttachments,attachmentTimelines:p.attachmentTimelines[clip]};
  model.samples=sampleTimes.map(time=>({time,drawableAttachments:drawableAttachmentsAt(model,time)}));models[face]=model;
 }
 return{schemaVersion:1,operator:id,foundationSha256:sha256,artworkOnly:true,enabledOperators:[],frameParity:false,nativePixelParity:false,models,
  scope:'Original default-skin Region/Mesh attachment presence at exact source times. Clipping/bounding/path/point attachments are not drawable body art. This does not prove alpha, shaders, external effects, game-frame parity or gameplay.'};
}
export async function verifyOriginalVisibility(proof,options){
 const original=await recoverOriginalVisibility(options);assert.deepEqual(proof,original,'Changed original attachment visibility proof');return original;
}
