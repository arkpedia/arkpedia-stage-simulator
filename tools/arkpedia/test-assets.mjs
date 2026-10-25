// SPDX-License-Identifier: GPL-3.0-or-later
// Prepare the exact original skeleton bytes consumed by source-identity tests.
// Other asset formats remain covered by SD validation and rendered browser checks.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function reviewedSkeletons(snapshot){
 if(snapshot?.sd?.repository!=='arkpedia/arkpedia-sd-assets'||!/^[a-f0-9]{40}$/.test(snapshot.sd.commit??'')
   ||!snapshot.sd.models||Array.isArray(snapshot.sd.models))throw Error('Test assets require a pinned SD snapshot');
 const files=new Map();
 for(const model of Object.values(snapshot.sd.models)){
  const e=model.skeleton;
  if(typeof e?.path!=='string'||!/^models\/[\w./-]+\.skel$/.test(e.path)
    ||e.path.split('/').some(p=>!p||p==='.'||p==='..')||!Number.isSafeInteger(e.bytes)||e.bytes<1||e.bytes>16*1024*1024
    ||!/^[a-f0-9]{64}$/.test(e.sha256??''))throw Error('Invalid reviewed skeleton reference');
  const commit=model.assetsCommit??snapshot.sd.commit;
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid model commit');
  const old=files.get(e.path);if(old&&(old.sha256!==e.sha256||old.bytes!==e.bytes||old.commit!==commit))throw Error('Conflicting immutable skeleton');
  files.set(e.path,{...e,commit});
 }
 if(!files.size)throw Error('No reviewed skeletons in snapshot');return[...files.values()];
}
const retryStatus=new Set([429,500,502,503,504]);
async function fetchReviewedBytes(url,e,fetcher,pause){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});
   if(!response.ok){
    if(!retryStatus.has(response.status)||attempt===2)throw Error(`Reviewed skeleton unavailable (${response.status}): ${e.path}`);
    await response.body?.cancel();
   }else return Buffer.from(await response.arrayBuffer());
  }catch(error){
   if(attempt===2||!(error instanceof TypeError||['TimeoutError','AbortError'].includes(error.name)))throw error;
  }
  await pause([500,1500][attempt]);
 }
}
export async function prepareTestAssets({snapshot,destination,fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const entries=reviewedSkeletons(snapshot);let next=0,downloaded=0,verified=0;
 const check=(bytes,e)=>{if(bytes.length!==e.bytes||createHash('sha256').update(bytes).digest('hex')!==e.sha256)
  throw Error('Changed reviewed skeleton: '+e.path);};
 await Promise.all(Array.from({length:Math.min(6,entries.length)},async()=>{
  while(next<entries.length){
   const e=entries[next++],file=path.join(destination,e.path);let bytes;
   try{bytes=await readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(bytes){check(bytes,e);verified++;continue;}
   bytes=await fetchReviewedBytes(`https://raw.githubusercontent.com/${snapshot.sd.repository}/${e.commit ?? snapshot.sd.commit}/${e.path}`,e,fetcher,pause);check(bytes,e);
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});downloaded++;
  }
 }));
 return{models:entries.length,verified,downloaded};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const snapshot=JSON.parse(await readFile(path.join(root,'data/arkpedia-mvp.json')));
 console.log(await prepareTestAssets({snapshot,destination:path.resolve(root,'../arkpedia-sd-assets')}));
}
