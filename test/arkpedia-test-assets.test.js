// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedSkeletons,prepareTestAssets} from '../tools/arkpedia/test-assets.mjs';
const bytes=Buffer.from('original skeleton bytes'),entry={path:'models/operator/original/front/a/model.skel',bytes:bytes.length,
 sha256:createHash('sha256').update(bytes).digest('hex')};
const snapshot={sd:{repository:'arkpedia/arkpedia-sd-assets',commit:'a'.repeat(40),models:{original:{skeleton:entry}}}};
async function directory(t){const d=await mkdtemp(path.join(tmpdir(),'source-skeletons-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('CI fetches the immutable original skeleton and verifies cached bytes on every run',async t=>{
 const d=await directory(t),calls=[];
 const first=await prepareTestAssets({snapshot,destination:d,fetcher:async url=>{calls.push(url);return new Response(bytes);}});
 assert.deepEqual(first,{models:1,verified:0,downloaded:1});assert.equal(calls[0],`https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${'a'.repeat(40)}/${entry.path}`);
 assert.deepEqual(await readFile(path.join(d,entry.path)),bytes);
 assert.deepEqual(await prepareTestAssets({snapshot,destination:d,fetcher:()=>{throw Error('Unexpected download');}}),{models:1,verified:1,downloaded:0});
 await writeFile(path.join(d,entry.path),'modified');
 await assert.rejects(prepareTestAssets({snapshot,destination:d}),/Changed reviewed skeleton/);
 assert.equal(await readFile(path.join(d,entry.path),'utf8'),'modified');
});
test('missing or corrupt upstream bytes fail before publication',async t=>{
 const d=await directory(t);
 await assert.rejects(prepareTestAssets({snapshot,destination:d,fetcher:async()=>new Response('missing',{status:404})}),/unavailable/);
 await assert.rejects(prepareTestAssets({snapshot,destination:d,fetcher:async()=>new Response('modified')}),/Changed reviewed/);
 await assert.rejects(readFile(path.join(d,entry.path)),{code:'ENOENT'});
});
test('moving pins, unsafe paths and conflicting aliases cannot prepare test assets',()=>{
 const mutate=[s=>{s.sd.commit='main';},s=>{s.sd.repository='another/assets';},s=>{s.sd.models.original.skeleton.path='../outside.skel';},
  s=>{s.sd.models.original.skeleton.bytes=NaN;},s=>{s.sd.models.alias={skeleton:{...entry,sha256:'0'.repeat(64)}};}];
 for(const fn of mutate){const s=structuredClone(snapshot);fn(s);assert.throws(()=>reviewedSkeletons(s));}
 const s=structuredClone(snapshot);s.sd.models.alias=structuredClone(s.sd.models.original);assert.equal(reviewedSkeletons(s).length,1);
});
