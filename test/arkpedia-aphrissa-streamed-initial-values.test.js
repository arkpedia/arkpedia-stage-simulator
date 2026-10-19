// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import fixtures from './fixtures/arkpedia-aphrissa-streamed-initial-values.json' with {type:'json'};
import proof from '../data/arkpedia-aphrissa-streamed-initial-values.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {decodeEffectClip,sampleEffectClip} from '../shared/arkpedia/native-effect-animation.js';
function originalFrames(source){
 const words=source.m_MuscleClip.m_Clip.data.m_StreamedClip.data,b=Buffer.alloc(words.length*4);words.forEach((w,i)=>b.writeUInt32LE(w,i*4));
 const frames=[];let at=0;
 while(at<b.length){const time=b.readFloatLE(at),n=b.readInt32LE(at+4),keys=[];at+=8;for(let k=0;k<n;k++){keys.push({index:b.readInt32LE(at),coefficients:[0,1,2,3].map(j=>b.readFloatLE(at+4+j*4))});at+=20;}frames.push({time,keys});}
 return frames;
}
test('Five retained native clips bind the original source pack and raw fixture without playback approval',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-aphrissa-streamed-initial-values.json',import.meta.url));assert.equal(raw.length,proof.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),proof.fixture.sha256);
 assert.equal(proof.sourcePackSha256,effects.pack.sha256);assert.equal(Object.keys(fixtures).length,5);assert.deepEqual(proof.enabledOperators,[]);assert.equal(proof.rendererVerified,false);assert.equal(proof.compiledFrameParity,false);
});
for(const [key,{data,sourceSha256}] of Object.entries(fixtures))test(data.m_Name+' preserves its authored sentinel-only channel values',()=>{
 assert.equal(sourceSha256,proof.clips[key].sourceSha256);
 const frames=originalFrames(data),clip=decodeEffectClip(data),sample=sampleEffectClip(clip,clip.start),initial=clip.channels.map((c,i)=>({c,i})).filter(({c})=>Object.hasOwn(c,'initialValue'));
 assert.ok(initial.length>0);
 for(const {c,i}of initial){const source=frames[0].keys.find(k=>k.index===i);assert.deepEqual(source.coefficients.slice(0,3),[0,0,0]);assert.equal(c.initialValue,source.coefficients[3]);assert.equal(sample[i],source.coefficients[3]);
  if(!c.keys.length)for(const t of [clip.start-1,(clip.start+clip.stop)/2,clip.stop,clip.stop+.1])assert.equal(sampleEffectClip(clip,t,{loop:false})[i],source.coefficients[3]);
 }
});
test('Original nonzero color values stay nonzero, and a nonconstant pre-roll polynomial remains unsupported',()=>{
 const source=fixtures['battle/prefabs/effects/aphris.ab:8827570236896215454'].data,clip=decodeEffectClip(source),index=clip.channels.findIndex(c=>c.initialValue>0);
 assert.ok(index>=0);assert.ok(sampleEffectClip(clip,0)[index]>0);
 const channel=clip.channels[index];if(channel.keys.length)assert.equal(sampleEffectClip(clip,(clip.start+channel.keys[0].time)/2)[index],channel.initialValue);
 const bad=structuredClone(source),stream=bad.m_MuscleClip.m_Clip.data.m_StreamedClip;
 const b=Buffer.alloc(4);b.writeFloatLE(1);stream.data[2+index*5+1]=b.readUInt32LE();
 assert.throws(()=>decodeEffectClip(bad),/initial sentinel polynomial/);
 const changedStart=structuredClone(source);changedStart.m_MuscleClip.m_ValueArrayDelta[index].m_Start+=1;assert.throws(()=>decodeEffectClip(changedStart),/authored channel start/);
});
