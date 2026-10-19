// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated original-source review. Never exposed by the normal battle server.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStaticHandler} from '../../server/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),cache=path.join(root,'.cache/arkpedia/aphrissa-source/effects');
const [effects,animations,shaders,lines]=await Promise.all(['effects','effect-animations','effect-shaders','lines'].map(async suffix=>
  JSON.parse(await readFile(path.join(root,'data/arkpedia-aphrissa-'+suffix+'.json')))));
const files=new Map([['native-effects.bin',effects.pack],['native-animations.json',animations.artifact],['native-shaders.json',shaders.artifact],
  ...Object.values(effects.textures).map(t=>[t.path,t])]);
const serve=createStaticHandler({publicDir:path.join(root,'public'),dataDir:path.join(root,'data'),sharedDir:path.join(root,'shared')});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let body,type;
    if(url.pathname==='/'){
      type='text/html';body=Buffer.from('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Aphrissa original beam inspection</title><style>*{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#0b1116;color:#d2dce3;font:14px system-ui}#scene{width:100vw;height:calc(100dvh - 48px)}canvas{display:block}#status{height:48px;padding:8px 12px;overflow:auto}</style><div id="scene"></div><div id="status">Original beam inspection. Endpoint fixture and UV-rotation input are explicit; gameplay dispatch remains unverified.</div>');
    }else if(url.pathname==='/review-assets/manifest.json'){
      type='application/json';body=Buffer.from(JSON.stringify({effects,animations,shaders,lines}));
    }else if(url.pathname.startsWith('/review-assets/')){
      const name=url.pathname.slice('/review-assets/'.length),entry=files.get(name);
      if(!entry){res.writeHead(404);res.end('Unknown original review asset');return;}
      body=await readFile(path.join(cache,entry.path));
      if(body.length!==entry.bytes||createHash('sha256').update(body).digest('hex')!==entry.sha256)throw Error('Changed original review asset');
      type=name.endsWith('.webp')?'image/webp':name.endsWith('.json')?'application/json':'application/octet-stream';
    }else{await serve(req,res,url.pathname,url.search.slice(1));return;}
    res.writeHead(200,{'Content-Type':type,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
  }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end('Original review asset unavailable');}
});
server.listen(3185,'127.0.0.1',()=>console.log('Isolated Aphrissa original-effect review: http://127.0.0.1:3185/'));
