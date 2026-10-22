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
for(const status of[429,500,502,503,504])test(`temporary HTTP ${status} retries the same immutable skeleton, then verifies original bytes`,async t=>{
 const d=await directory(t),calls=[],delays=[];
 const result=await prepareTestAssets({snapshot,destination:d,pause:async ms=>delays.push(ms),fetcher:async(url,opts)=>{calls.push(url);assert.ok(opts.signal instanceof AbortSignal);return calls.length===1?new Response('temporary',{status}):new Response(bytes);}});
 assert.deepEqual(result,{models:1,verified:0,downloaded:1});assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.deepEqual(delays,[500]);assert.deepEqual(await readFile(path.join(d,entry.path)),bytes);
});
test('a persistent transient upstream failure is bounded to three attempts without publishing a partial file',async t=>{const d=await directory(t),delays=[];let calls=0;await assert.rejects(prepareTestAssets({snapshot,destination:d,pause:async ms=>delays.push(ms),fetcher:async()=>{calls++;return new Response('temporary',{status:503});}}),/unavailable \(503\)/);assert.equal(calls,3);assert.deepEqual(delays,[500,1500]);await assert.rejects(readFile(path.join(d,entry.path)),{code:'ENOENT'});});
for(const status of[401,403,404])test(`permanent HTTP ${status} remains a hard failure without retry`,async t=>{const d=await directory(t);let calls=0;await assert.rejects(prepareTestAssets({snapshot,destination:d,pause:()=>{throw Error('Unexpected retry');},fetcher:async()=>{calls++;return new Response('missing',{status});}}),/unavailable/);assert.equal(calls,1);});
test('a corrupt successful response is rejected immediately rather than retried or cached',async t=>{const d=await directory(t);let calls=0;await assert.rejects(prepareTestAssets({snapshot,destination:d,pause:()=>{throw Error('Unexpected retry');},fetcher:async()=>{calls++;return new Response('wrong original bytes');}}),/Changed reviewed skeleton/);assert.equal(calls,1);await assert.rejects(readFile(path.join(d,entry.path)),{code:'ENOENT'});});
test('network transport errors retry without changing the pinned URL or accepting failed bodies',async t=>{const d=await directory(t),calls=[];await prepareTestAssets({snapshot,destination:d,pause:async()=>{},fetcher:async url=>{calls.push(url);if(calls.length===1)throw new TypeError('connection reset');return new Response(bytes);}});assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.deepEqual(await readFile(path.join(d,entry.path)),bytes);});
test('a failed response body is retried as transport while local programming errors are not hidden',async t=>{const d=await directory(t);let calls=0;await prepareTestAssets({snapshot,destination:d,pause:async()=>{},fetcher:async()=>{calls++;return calls===1?{ok:true,arrayBuffer:async()=>{throw new TypeError('socket closed during body');}}:new Response(bytes);}});assert.equal(calls,2);const other=await directory(t);calls=0;await assert.rejects(prepareTestAssets({snapshot,destination:other,pause:()=>{throw Error('Unexpected retry');},fetcher:async()=>{calls++;throw new Error('local bug');}}),/local bug/);assert.equal(calls,1);});
test('a model may pin a newer assets commit without moving the snapshot pin',async t=>{
 const d=await directory(t),calls=[],s=structuredClone(snapshot);
 s.sd.models.original.assetsCommit='b'.repeat(40);
 await prepareTestAssets({snapshot:s,destination:d,fetcher:async url=>{calls.push(url);return new Response(bytes);}});
 assert.equal(calls[0],`https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${'b'.repeat(40)}/${entry.path}`);
});
