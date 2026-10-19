// SPDX-License-Identifier: GPL-3.0-or-later
// Original pinned CN effects and dependencies; fetching grants no renderer approval.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CN_NATIVE_PIN,parsePinnedCNManifest} from './cn-native-source.mjs';
import {writeJSONAtomic} from './write-json.mjs';
const cache=resolve('.cache/arkpedia'),dir=resolve(cache,'cn-native-source'),main='battle/prefabs/effects/aphris.ab';
const hot=parsePinnedCNManifest(await readFile(resolve(dir,'hot_update_list.json')));
const names=[main,'[uc]shaders.ab','arts/[pack]common.ab','battle/[pack]common.ab',
 'refs/fx/texture/overseas/char_010_chen_sale#10.ab', 'pkgrps/btl_pfb_fx_token_3.ab', 'battle/prefabs/effects/common.ab',
 ...hot.abInfos.filter(r=>r.name.startsWith('refs/fx/')&&!r.name.includes('/overseas/')).map(r=>r.name)];
if(names.length!==26||new Set(names).size!==26)throw Error('Changed original CN effect inventory');
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex'),sources=[];
for(const name of names){
 const row=hot.abInfos.find(r=>r.name===name);if(!row)throw Error('Missing original CN dependency: '+name);
 const path=resolve(dir,'bundles',name),check=bytes=>{if(bytes.length!==row.abSize||digest('md5',bytes)!==row.md5)throw Error('Changed original effect bundle: '+name);return bytes;};
 let bytes;
 try{bytes=check(await readFile(path));}catch(error){
  if(error.code!=='ENOENT')throw error;
  const archiveName=name.replaceAll('/','_').replaceAll('#','__').replace(/\.ab$/,'.dat'),archive=resolve(dir,'archives',archiveName),url=new URL(encodeURIComponent(archiveName),CN_NATIVE_PIN.baseURL).href;
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Pinned effect unavailable: '+response.status+' '+name);
  await mkdir(dirname(archive),{recursive:true});await writeFile(archive,Buffer.from(await response.arrayBuffer()));
  await mkdir(dirname(path),{recursive:true});const temporary=path+'.partial-'+randomUUID();
  try{execFileSync('python3',['-c','import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); i=z.getinfo(sys.argv[2]); assert i.file_size==int(sys.argv[4]); pathlib.Path(sys.argv[3]).write_bytes(z.read(i))',archive,name,temporary,String(row.abSize)],{stdio:'pipe'});bytes=check(await readFile(temporary));await rename(temporary,path);}finally{await rm(temporary,{force:true});}
 }
 sources.push({path:name,bytes:bytes.length,md5:row.md5,sha256:digest('sha256',bytes)});console.log('Verified '+name);
}
await mkdir(resolve(cache,'aphrissa-source'),{recursive:true});await writeJSONAtomic(resolve(cache,'aphrissa-source/effect-bundles.json'),{version:CN_NATIVE_PIN.resourceVersion,sources});
