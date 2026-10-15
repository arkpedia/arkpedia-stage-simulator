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
  const old=files.get(e.path);if(old&&(old.sha256!==e.sha256||old.bytes!==e.bytes))throw Error('Conflicting immutable skeleton');
  files.set(e.path,e);
 }
 if(!files.size)throw Error('No reviewed skeletons in snapshot');return[...files.values()];
}
export async function prepareTestAssets({snapshot,destination,fetcher=fetch}){
 const entries=reviewedSkeletons(snapshot);let next=0,downloaded=0,verified=0;
 const check=(bytes,e)=>{if(bytes.length!==e.bytes||createHash('sha256').update(bytes).digest('hex')!==e.sha256)
  throw Error('Changed reviewed skeleton: '+e.path);};
 await Promise.all(Array.from({length:Math.min(6,entries.length)},async()=>{
  while(next<entries.length){
   const e=entries[next++],file=path.join(destination,e.path);let bytes;
   try{bytes=await readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(bytes){check(bytes,e);verified++;continue;}
   const response=await fetcher(`https://raw.githubusercontent.com/${snapshot.sd.repository}/${snapshot.sd.commit}/${e.path}`);
   if(!response.ok)throw Error(`Reviewed skeleton unavailable (${response.status}): ${e.path}`);
   bytes=Buffer.from(await response.arrayBuffer());check(bytes,e);
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});downloaded++;
  }
 }));
 return{models:entries.length,verified,downloaded};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const snapshot=JSON.parse(await readFile(path.join(root,'data/arkpedia-mvp.json')));
 console.log(await prepareTestAssets({snapshot,destination:path.resolve(root,'../arkpedia-sd-assets')}));
}
