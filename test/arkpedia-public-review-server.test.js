// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createPublicReviewServer} from '../tools/arkpedia/public-review-server.mjs';
test('public review transport overrides only its app/data fixtures and preserves local source responses',async()=>{
 const requests=[],source=createServer((req,res)=>{requests.push(req.url);res.writeHead(req.url==='/missing'?404:200,{'content-type':'application/octet-stream'});res.end(Buffer.from([0,1,127,255]));});
 await new Promise(r=>source.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${source.address().port}`;
 let fixture;try{
  fixture=await createPublicReviewServer({origin,app:'APP;',hook:'HOOK;',data:{held:['selected']}});
  assert.equal(await(await fetch(fixture.origin+'/arkpedia/app.js')).text(),'APP;HOOK;');assert.deepEqual(await(await fetch(fixture.origin+'/data/arkpedia-mvp.json')).json(),{held:['selected']});
  assert.deepEqual([...new Uint8Array(await(await fetch(fixture.origin+'/vendor/source.js?v=1')).arrayBuffer())],[0,1,127,255]);assert.deepEqual(requests,['/vendor/source.js?v=1']);
  assert.equal((await fetch(fixture.origin+'/missing')).status,404);assert.equal((await fetch(fixture.origin+'/favicon.ico')).status,204);
  assert.equal((await fetch(fixture.origin+'/arkpedia/app.js',{method:'HEAD'})).status,200);assert.equal((await fetch(fixture.origin+'/arkpedia/app.js',{method:'POST'})).status,405);
  await assert.rejects(()=>createPublicReviewServer({origin:'https://invalid.example',app:'',hook:'',data:{}}));
 }finally{await fixture?.close();await new Promise(r=>{source.close(r);source.closeAllConnections();});}
});
