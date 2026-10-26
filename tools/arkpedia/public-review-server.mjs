// SPDX-License-Identifier: GPL-3.0-or-later
// Same local app/data fixtures as the browser review, without intercepting HTTPS images/workers.
import {createServer} from 'node:http';
import {validateStageIndex} from '../../shared/arkpedia/stages.js';
export async function createPublicReviewServer({origin,app,data,hook,stageIndex}){
 if(stageIndex)validateStageIndex(stageIndex);
 const upstream=new URL(origin);
 if(upstream.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(upstream.hostname)||upstream.username||upstream.password)
  throw Error('Public review fixtures require a local HTTP preview');
 const server=createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const path=new URL(req.url,'http://127.0.0.1'),send=(status,type,body)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:body);};
   if(path.pathname==='/favicon.ico'){send(204,'text/plain','');return;}
   if(path.pathname==='/arkpedia/app.js'){send(200,'text/javascript',app+hook);return;}
   if(path.pathname==='/data/arkpedia-mvp.json'){send(200,'application/json',JSON.stringify(data));return;}
   if(stageIndex&&path.pathname==='/data/arkpedia-stages.json'){send(200,'application/json',JSON.stringify(stageIndex));return;}
   const target=new URL(upstream);target.pathname=path.pathname;target.search=path.search;
   const response=await fetch(target,{method:req.method});
   send(response.status,response.headers.get('content-type')??'application/octet-stream',Buffer.from(await response.arrayBuffer()));
  }catch(error){if(!res.headersSent)res.writeHead(502,{'content-type':'text/plain'});res.end(String(error));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return{origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();})};
}
