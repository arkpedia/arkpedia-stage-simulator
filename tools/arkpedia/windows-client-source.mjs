// SPDX-License-Identifier: GPL-3.0-or-later
// Static evidence only. Never launch or install the downloaded client.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),cache=new URL('.cache/arkpedia/global-windows-client/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const low=new Uint32Array(256),high=new Uint32Array(256),poly=0xc96c5795d7870f42n;
for(let i=0;i<256;i++){let c=BigInt(i);for(let bit=0;bit<8;bit++)c=(c>>1n)^((c&1n)?poly:0n);low[i]=Number(c&0xffffffffn);high[i]=Number(c>>32n);}
/** CRC-64/XZ, matching the signed launcher's published per-file CRC convention. */
export function crc64XZ(bytes){
 let lo=0xffffffff,hi=0xffffffff;
 for(let i=0;i<bytes.length;i++){const index=(lo^bytes[i])&255;lo=((lo>>>8)|(hi<<24))^low[index];hi=(hi>>>8)^high[index];}
 return ((BigInt((hi^0xffffffff)>>>0)<<32n)|BigInt((lo^0xffffffff)>>>0)).toString();
}
export function verifyWindowsManifest(pin,raw){
 assert.match(pin.source,/^\/Arknights_EN-[0-9.]+-game$/);
 assert.equal(raw.length,pin.manifest.bytes);assert.equal(sha(raw),pin.manifest.sha256);
 const manifest=JSON.parse(raw);assert.equal(manifest.source,pin.source);assert.ok(Array.isArray(manifest.file));
 for(const row of pin.files){
  assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<=200000000);
  assert.ok(['/GameAssembly.dll','/Arknights_Data/il2cpp_data/Metadata/global-metadata.dat'].includes(row.path),'Only reviewed native evidence files');
  const matches=manifest.file.filter(f=>f.path===row.path);assert.equal(matches.length,1);
  assert.equal(Number(matches[0].size),row.bytes);assert.equal(matches[0].hash,row.crc64XZ);
  assert.match(row.sha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(pin.files.length,2);assert.equal(new Set(pin.files.map(f=>f.path)).size,2);
 return manifest;
}
export function verifyWindowsFile(pin,raw){assert.equal(raw.length,pin.bytes);assert.equal(crc64XZ(raw),pin.crc64XZ);assert.equal(sha(raw),pin.sha256);}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assert.ok(process.argv.slice(2).every(a=>a==='--fetch'),'Only --fetch is accepted');
 const fetching=process.argv.includes('--fetch'),pin=JSON.parse(await readFile(new URL('data/arkpedia-global-windows-client-source.json',root)));
 const base='https://launcher-pkg-ark-en.yo-star.com';
 assert.ok(pin.manifest.url.startsWith(base+'/zip_online_config_json/'));assert.match(pin.source,/^\/Arknights_EN-[0-9.]+-game$/);
 const obtain=async(name,url,check)=>{
  const target=new URL(name,cache);let raw;
  try{raw=await readFile(target);}catch(error){
   if(!fetching||error.code!=='ENOENT')throw error;
   const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Official source HTTP '+response.status);
   raw=Buffer.from(await response.arrayBuffer());check(raw);await mkdir(cache,{recursive:true});
   const temp=new URL(name+'.'+randomUUID()+'.tmp',cache);
   try{await writeFile(temp,raw,{flag:'wx'});await rename(temp,target);}finally{await rm(temp,{force:true});}
  }
  check(raw);return raw;
 };
 await obtain('manifest.json',pin.manifest.url,b=>verifyWindowsManifest(pin,b));
 for(const file of pin.files)await obtain(file.path.endsWith('.dll')?'GameAssembly.dll':'global-metadata.dat',base+pin.source+file.path,b=>verifyWindowsFile(file,b));
 console.log('Verified two static native files against frozen official manifest, CRC64/XZ and SHA256; no game execution or support admission');
}
