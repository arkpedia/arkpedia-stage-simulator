// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect one bounded frozen settings file; never execute the game.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {verifyWindowsManifest,verifyWindowsFile} from './windows-client-source.mjs';
const root=new URL('../../',import.meta.url),cache=new URL('.cache/arkpedia/global-windows-client/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyWindowsSettingsManifest(nativePin,settingsPin,raw){
 const manifest=verifyWindowsManifest(nativePin,raw);
 assert.match(settingsPin.version,/^[0-9.]+$/);
 assert.equal(settingsPin.source,nativePin.source);assert.equal(settingsPin.version,nativePin.version);
 const file=settingsPin.file;
 assert.equal(file.path,'/Arknights_Data/globalgamemanagers');
 assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=2000000);
 assert.match(file.sha256,/^[a-f0-9]{64}$/);
 const rows=manifest.file.filter(f=>f.path===file.path);assert.equal(rows.length,1);
 assert.equal(Number(rows[0].size),file.bytes);assert.equal(rows[0].hash,file.crc64XZ);
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assert.ok(process.argv.slice(2).every(a=>a==='--fetch'),'Only --fetch is accepted');
 const fetching=process.argv.includes('--fetch'),pin=JSON.parse(await readFile(new URL('data/arkpedia-global-windows-settings-source.json',root)));
 assert.equal(pin.nativeSource.path,'data/arkpedia-global-windows-client-source.json');
 const nativeRaw=await readFile(new URL(pin.nativeSource.path,root));assert.equal(sha(nativeRaw),pin.nativeSource.sha256);
 const nativePin=JSON.parse(nativeRaw),base='https://launcher-pkg-ark-en.yo-star.com';
 assert.ok(nativePin.manifest.url.startsWith(base+'/zip_online_config_json/'));
 const obtain=async(name,url,check)=>{
  const target=new URL(name,cache);let raw;
  try{raw=await readFile(target);}catch(error){
   if(!fetching||error.code!=='ENOENT')throw error;
   const response=await fetch(url,{signal:AbortSignal.timeout(180000)});assert.ok(response.ok,'Official settings source HTTP '+response.status);
   raw=Buffer.from(await response.arrayBuffer());check(raw);await mkdir(cache,{recursive:true});
   const temp=new URL(name+'.'+randomUUID()+'.tmp',cache);
   try{await writeFile(temp,raw,{flag:'wx'});await rename(temp,target);}finally{await rm(temp,{force:true});}
  }
  check(raw);return raw;
 };
 await obtain('manifest.json',nativePin.manifest.url,b=>verifyWindowsSettingsManifest(nativePin,pin,b));
 await obtain('globalgamemanagers',base+pin.source+pin.file.path,b=>verifyWindowsFile(pin.file,b));
 console.log('Verified one frozen Unity settings file against original manifest, CRC64/XZ and SHA256; no client execution');
}
