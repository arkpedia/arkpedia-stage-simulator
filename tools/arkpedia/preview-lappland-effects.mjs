// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated loopback inspection of checksum-pinned cache artifacts. It never
// enables an operator or exposes arbitrary cache files in the battle server.
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createStaticHandler} from '../../server/index.js';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const cache=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const manifests=await Promise.all(['arkpedia-lappland-effects','arkpedia-lappland-effect-animations',
  'arkpedia-lappland-effect-shaders'].map(async name=>JSON.parse(await readFile(path.join(root,'data',name+'.json')))));
const [effects,animations,shaders]=manifests;
const files=new Map([['native-effects.bin',effects.pack], ['native-animations.json',animations.artifact],
  ['native-shaders.json',shaders.artifact], ...Object.values(effects.textures).map(t=>[t.path,t])]);
const serve=createStaticHandler({publicDir:path.join(root,'public'),dataDir:path.join(root,'data'),sharedDir:path.join(root,'shared')});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  try{
    if(url.pathname==='/'){res.writeHead(302,{Location:'/arkpedia/lappland-effect-preview.html'});res.end();return;}
    if(url.pathname.startsWith('/review-assets/')){
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const name=url.pathname.slice('/review-assets/'.length);
      if(name==='manifest.json'){
        res.writeHead(200,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify({effects,animations,shaders}));return;
      }
      const entry=files.get(name);
      if(!entry){res.writeHead(404);res.end('Unknown original review asset');return;}
      const bytes=await readFile(path.join(cache,entry.path));
      if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Changed original review asset');
      res.writeHead(200,{'Content-Type':name.endsWith('.webp')?'image/webp':name.endsWith('.json')?'application/json':'application/octet-stream','Content-Length':bytes.length});
      res.end(req.method==='HEAD'?undefined:bytes);return;
    }
    await serve(req,res,url.pathname,url.search.slice(1));
  }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end('Original review asset unavailable');}
});
server.listen(3183,'127.0.0.1',()=>console.log('Original Lappland mesh/shader inspection: http://127.0.0.1:3183/'));
