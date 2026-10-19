// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';import {readFile,writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';
import{recoverOriginalVisibility}from'./original-visibility.mjs';
import art from'../../data/arkpedia-makoto-art.json'with{type:'json'};
const id='char_4217_makoto',output=new URL('../../data/arkpedia-makoto-visibility.json',import.meta.url);
export async function recoverMakotoVisibility({read=readFile}={}){
 const p=await recoverOriginalVisibility({id,read,receipt:new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),
  sha256:'7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817',clip:'Skill_AllOutAttack_Loop',faces:['Front'],
  sampleTimes:[0,0.0833333358168602,0.1666666716337204],skeleton:face=>new URL('../../../arkpedia-sd-assets/'+art.ownerModels[face.toLowerCase()].files.skeleton.path,import.meta.url)});
 const m=p.models.Front;assert.equal(m.duration,0.1666666716337204);assert.equal(m.setupAttachments.length,317);assert.equal(m.attachmentTimelines.length,317);
 assert.equal(new Set(m.attachmentTimelines.map(t=>t.slot)).size,317);
 assert.ok(m.attachmentTimelines.every(t=>t.frames.length===1&&t.frames[0].time===0));
 assert.equal(m.attachmentTimelines.filter(t=>t.frames[0].attachment===null).length,315);
 assert.equal(m.attachmentTimelines.filter(t=>t.frames[0].attachment?.type==='clipping').length,2);
 assert.ok(m.samples.every(s=>s.drawableAttachments===0));return p;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const text=JSON.stringify(await recoverMakotoVisibility(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,text);else assert.equal(await readFile(output,'utf8'),text);
 console.log('Makoto original all-out loop clears315 slots and retains only2 non-drawable eye masks; omitted Back clip verified absent.');}
