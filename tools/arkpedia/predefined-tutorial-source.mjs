// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';import{resolve}from'node:path';
const root=new URL('../../',import.meta.url),cache=new URL('.cache/arkpedia/stage17-16-tutorials/',root),sha=(alg,b)=>createHash(alg).update(b).digest('hex');
export function parsePredefinedTutorial(text){
 return text.split(/\r?\n/).filter(Boolean).map(line=>{
  if(line.startsWith('[header(actId="main17")]'))return{kind:'header',actId:'main17'};
  if(line.startsWith('[header(is_tutorial=true)]'))return{kind:'header',tutorial:true};
  let m=line.match(/^\[camerafocusto\(time="([0-9.]+)", scale="MID", offsetX=([0-9.-]+), offsetY=([0-9.-]+)\)\]$/);
  if(m){const[duration,offsetX,offsetY]=m.slice(1).map(Number);if(![duration,offsetX,offsetY].every(Number.isFinite)||duration<0)throw Error('Invalid tutorial camera parameters');return{kind:'cameraFocus',duration,scale:'MID',offsetX,offsetY};}
  m=line.match(/^\[name="([^"]+)", avatarId="([^"]+)"\](.+)$/u);if(m)return{kind:'dialogue',name:m[1],avatarId:m[2],text:m[3]};
  if(line==='[resetcamera]')return{kind:'cameraReset'};
  if(line==='[end]')return{kind:'end'};
  m=line.match(/^\[Battle.EnsureMinSp\(charId="(char_[a-z0-9_]+)", sp=([0-9]+)\)\]$/);
  if(m&&m[1]==='char_4226_veen'&&Number(m[2])===50)return{kind:'ensureMinSp',charId:m[1],sp:50};
  throw Error('Unsupported predefined tutorial instruction');
 });
}
export async function predefinedTutorialSource({fetching=false,cacheDir=cache,fetchImpl=fetch}={}){
 const lockPath='data/arkpedia-predefined-tutorials.lock.json',lockRaw=await readFile(new URL(lockPath,root)),lock=JSON.parse(lockRaw);
 if(lock.testOnly!==true||lock.stage!=='17-16'||lock.repository!=='ArknightsAssets/ArknightsGamedata'||lock.commit!=='db6f9ef8046ad17dbebe3ff1d0dd88844a5bc78c')throw Error('Unreviewed tutorial source pin');
 const local=async p=>{const b=await readFile(new URL(p.path,root));if(sha('sha256',b)!==p.sha256)throw Error('Tutorial stage source checksum mismatch');return JSON.parse(b);};
 const stage=await local(lock.stageSource),stageLock=await local(lock.stageLock);
 if(stage.canonicalData.repository!=='arkpedia/arkpedia-data'||stage.canonicalData.commit!==stageLock.commit||stage.upstream.repository!==lock.repository||stage.upstream.commit!==lock.commit||stage.admitted!==false)throw Error('Tutorial canonical stage provenance mismatch');
 await mkdir(cacheDir,{recursive:true});const scripts={};
 for(const[key,p]of Object.entries(lock.scripts)){
  const file=new URL(p.path.split('/').at(-1),cacheDir);let raw;
  try{raw=await readFile(file);}catch(e){if(e.code!=='ENOENT'||!fetching)throw e;const r=await fetchImpl(`https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${p.path}`);if(!r.ok)throw Error('Tutorial fetch failed: '+r.status);raw=Buffer.from(await r.arrayBuffer());}
  if(raw.length!==p.bytes||sha('sha256',raw)!==p.sha256||sha('sha1',Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw]))!==p.gitBlob)throw Error('Tutorial script checksum mismatch');
  await writeFile(file,raw);const originalText=raw.toString('utf8');scripts[key]={source:p,originalText,instructions:parsePredefinedTutorial(originalText)};
 }
 const actions=[];for(const[wave,w]of stage.rawLevel.waves.entries())for(const[fragment,f]of w.fragments.entries())for(const[index,action]of f.actions.entries()){
  if(['DIALOG','STORY','ACTIVATE_PREDEFINED'].includes(action.actionType)){
   if(action.actionType!=='ACTIVATE_PREDEFINED'&&!scripts[action.key])throw Error('Unreviewed stage tutorial key');
   actions.push({wave,fragment,index,action});
  }
 }
 if(actions.length!==7||Object.keys(scripts).length!==3)throw Error('Unreviewed predefined tutorial action count');
 return{schemaVersion:1,testOnly:true,admitted:false,scope:'Exact 17-16 tutorial scripts, commands, canonical action locations and predefines. No dialog clock, stage/card admission or client FSM parity.',
  inputs:{lock:{path:lockPath,sha256:sha('sha256',lockRaw)},stage:lock.stageSource,stageLock:lock.stageLock},source:{repository:lock.repository,commit:lock.commit},scripts,actions,predefines:stage.rawLevel.predefines};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>!['--check','--fetch'].includes(a)))throw Error('Usage: predefined-tutorial-source.mjs [--fetch] [--check]');
 const file=new URL('data/candidates/arkpedia-predefined-tutorial-source.json',root),text=JSON.stringify(await predefinedTutorialSource({fetching:process.argv.includes('--fetch')}),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Predefined tutorial artifact differs');}else await writeFile(file,text);
 console.log('Verified three pinned 17-16 tutorial scripts and seven canonical actions; stage remains held');
}
