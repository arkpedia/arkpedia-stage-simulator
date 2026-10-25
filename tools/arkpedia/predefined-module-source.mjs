// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{fileURLToPath,pathToFileURL}from'node:url';
import{resolve}from'node:path';
import{CN_NATIVE_PIN,parsePinnedCNManifest,verifyCNNativeBundle}from'./cn-native-source.mjs';
const root=new URL('../../',import.meta.url),defaultCache=new URL('.cache/arkpedia/predefined-modules/',root),hash=(alg,b)=>createHash(alg).update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function predefinedModuleTables({fetching=false,fetchImpl=fetch,cacheDir=defaultCache}={}){
 const cache=cacheDir;
 const lockBytes=await readFile(new URL('data/arkpedia-predefined-modules.lock.json',root)),lock=JSON.parse(lockBytes);
 if(lock.testOnly!==true||lock.tables.repository!==CN_NATIVE_PIN.repository||lock.tables.commit!==CN_NATIVE_PIN.commit||lock.client.version!==CN_NATIVE_PIN.clientVersion||lock.client.baseURL!==CN_NATIVE_PIN.baseURL||lock.client.manifestBytes!==CN_NATIVE_PIN.manifestBytes||lock.client.resourceVersion!==CN_NATIVE_PIN.resourceVersion||lock.client.manifestSha256!==CN_NATIVE_PIN.manifestSha256)throw Error('Unreviewed predefined module source pin');
 await mkdir(cache,{recursive:true});
 const download=async url=>{const r=await fetchImpl(url);if(!r.ok)throw Error('Predefined module fetch failed: '+r.status);return Buffer.from(await r.arrayBuffer());};
 const cached=async(name,url,verify)=>{const file=new URL(name,cache);let b;try{b=await readFile(file);}catch(e){if(e.code!=='ENOENT'||!fetching)throw e;b=await download(url);verify(b);await writeFile(file,b);}verify(b);return b;};
 const manifest=await cached('hot_update_list.json',new URL('hot_update_list.json',CN_NATIVE_PIN.baseURL),b=>parsePinnedCNManifest(b));const hot=parsePinnedCNManifest(manifest);
 const tables={};
 for(const[name,p]of Object.entries(lock.tables.files)){
  const raw=await cached(name+'.json',`https://raw.githubusercontent.com/${lock.tables.repository}/${lock.tables.commit}/${p.path}`,b=>{if(b.length!==p.bytes||hash('sha256',b)!==p.sha256||hash('sha1',Buffer.concat([Buffer.from(`blob ${b.length}\0`),b]))!==p.gitBlob)throw Error('Predefined module table checksum mismatch: '+name);});tables[name]=JSON.parse(raw);
 }
 for(const[name,p]of Object.entries(lock.bundles)){
  const member=hot.abInfos.find(r=>r.name===p.path);if(member?.abSize!==p.bytes||member.md5!==p.md5)throw Error('Predefined module bundle absent from publisher manifest');
  const file=new URL(name+'.ab',cache);let raw;try{raw=await readFile(file);}catch(e){
   if(e.code!=='ENOENT'||!fetching)throw e;
   // A verified cache from the original native intake may already hold it.
   try{raw=await readFile(new URL('.cache/arkpedia/cn-native-source/bundles/'+p.path,root));}catch(e){if(e.code!=='ENOENT')throw e;}
   if(!raw){const archive=new URL(name+'.dat',cache);await writeFile(archive,await download(p.url));execFileSync(process.env.ARKPEDIA_SOURCE_PYTHON??'python3',['-c','import zipfile,pathlib,sys; z=zipfile.ZipFile(sys.argv[1]); pathlib.Path(sys.argv[3]).write_bytes(z.read(sys.argv[2]))',fileURLToPath(archive),p.path,fileURLToPath(file)]);raw=await readFile(file);}
   if(verifyCNNativeBundle(p,raw).sha256!==p.sha256)throw Error('Predefined module bundle SHA mismatch');await writeFile(file,raw);
  }
  if(verifyCNNativeBundle(p,raw).sha256!==p.sha256)throw Error('Predefined module bundle SHA mismatch');
 }
 const stages={},selected={};
 for(const code of [...new Set(Object.values(lock.modules).map(r=>r.stage))]){
  const source=JSON.parse(await readFile(new URL(`data/candidates/arkpedia-stage-${code}-source.json`,root))),stageLock=JSON.parse(await readFile(new URL(`data/arkpedia-canonical-stage-${code}.lock.json`,root))),p=stageLock.files.rawLevel;
  if(stageLock.repository!=='arkpedia/arkpedia-data'||stageLock.stage!==code||source.canonicalData.repository!==stageLock.repository||source.canonicalData.commit!==stageLock.commit)throw Error('Predefined module stage provenance mismatch');
  const raw=await cached(`stage-${code}.json`,`https://raw.githubusercontent.com/${stageLock.repository}/${stageLock.commit}/${p.path}`,b=>{if(b.length!==p.bytes||hash('sha256',b)!==p.sha256||!same(JSON.parse(b),source.rawLevel))throw Error('Predefined module canonical stage mismatch');});
  if(source.testOnly!==true||source.admitted!==false||!same(source.inputs,stageLock.files))throw Error('Unreviewed predefined module stage receipt');
  stages[code]={repository:stageLock.repository,commit:stageLock.commit,rawLevel:p,predefines:JSON.parse(raw).predefines};
 }
 for(const[key,p]of Object.entries(lock.modules)){
  const meta=tables.uniequip_table.equipDict[key],phase=tables.battle_equip_table[key]?.phases.find(r=>r.equipLevel===p.level),pre=stages[p.stage].predefines;
  const refs=[...(Array.isArray(pre.characterInsts)?pre.characterInsts:[]),...(Array.isArray(pre.characterCards)?pre.characterCards:[])].filter(r=>r.inst.characterKey===p.owner&&r.uniEquipIds?.some(e=>e.key===key&&e.level===p.level));
  if(!phase||meta?.charId!==p.owner||refs.length!==1)throw Error('Module does not match canonical predefined owner');
  selected[key]={owner:p.owner,stage:p.stage,level:p.level,unlock:{phase:meta.unlockEvolvePhase,level:meta.unlockLevel},phase};
 }
 return{schemaVersion:1,testOnly:true,scope:'Exact table/native intake for predefined level-three modules. No stage, public module or gameplay admission.',lock:{path:'data/arkpedia-predefined-modules.lock.json',sha256:hash('sha256',lockBytes)},source:{tables:lock.tables,client:lock.client,bundles:lock.bundles},stages,modules:selected};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>!['--fetch','--check'].includes(a)))throw Error('Usage: predefined-module-source.mjs [--fetch] [--check]');
 const text=JSON.stringify(await predefinedModuleTables({fetching:process.argv.includes('--fetch')}),null,2)+'\n',file=new URL('data/candidates/arkpedia-stage-predefined-module-tables.json',root);
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Predefined module table artifact differs');}else await writeFile(file,text);
 console.log('Verified five exact level-three modules and their canonical predefined owners; no gameplay admission');
}
