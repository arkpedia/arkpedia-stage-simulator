#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch named bundles of the frozen CN manifest into the ignored native cache.
// Every bundle is checked against the pinned manifest's size and MD5 before it
// is kept; nothing here registers or admits content. `--enemy-art` selects
// every enemy body art bundle (needed by extract-native-enemy-models.py).
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CN_NATIVE_PIN,parsePinnedCNManifest} from './cn-native-source.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),cache=path.join(root,'.cache/arkpedia/cn-native-source');
const manifest=parsePinnedCNManifest(await readFile(path.join(cache,'hot_update_list.json')));
const names=process.argv.slice(2).filter(a=>!a.startsWith('--'));
if(process.argv.includes('--enemy-art'))names.push(...manifest.abInfos.map(r=>r.name).filter(n=>/^refs\/arts\/enm_art_(?:base_)?\d+\.ab$/.test(n)));
if(!names.length)throw Error('Name at least one pinned bundle, or pass --enemy-art');
const verify=(row,raw)=>{if(raw.length!==row.abSize||createHash('md5').update(raw).digest('hex')!==row.md5)throw Error('Bundle differs from the pinned manifest: '+row.name);};
for(const name of [...new Set(names)].sort()){
 const row=manifest.abInfos.find(r=>r.name===name);
 if(!row||name.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Not in the pinned manifest: '+name);
 const target=path.join(cache,'bundles',name);let raw;
 try{raw=await readFile(target);}catch(error){
  if(error.code!=='ENOENT')throw error;
  const archive=name.replaceAll('/','_').replace(/\.ab$/,'.dat'),url=new URL(encodeURIComponent(archive),CN_NATIVE_PIN.baseURL);let zip;
  for(let attempt=0;;attempt++){
   try{const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Publisher response '+response.status+': '+url);zip=Buffer.from(await response.arrayBuffer());break;}
   catch(failure){if(attempt>=2)throw failure;}
  }
  const stored=path.join(cache,'archives',archive),suffix='.partial-'+randomUUID();
  await mkdir(path.dirname(stored),{recursive:true});await mkdir(path.dirname(target),{recursive:true});
  try{
   await writeFile(stored+suffix,zip);
   // Select one exact ZIP member; never extract publisher paths wholesale.
   execFileSync('python3',['-I','-c','import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); pathlib.Path(sys.argv[3]).write_bytes(z.read(z.getinfo(sys.argv[2])))',stored+suffix,name,target+suffix],{stdio:'pipe'});
   raw=await readFile(target+suffix);verify(row,raw);await rename(stored+suffix,stored);await rename(target+suffix,target);
  }finally{await Promise.all([rm(stored+suffix,{force:true}),rm(target+suffix,{force:true})]);}
 }
 verify(row,raw);console.log('Verified',name,raw.length);
}
