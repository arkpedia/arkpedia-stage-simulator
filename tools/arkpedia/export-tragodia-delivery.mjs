// SPDX-License-Identifier: GPL-3.0-or-later
// Publishable original inputs only; no executable application code or battle approval.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const cache=path.join(root,'.cache/arkpedia/tragodia-source/effects');
const out=path.join(root,'.cache/arkpedia/tragodia-source/effect-delivery');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const effects=await read(path.join(root,'data/arkpedia-tragodia-effects.json'));
const animation=await read(path.join(root,'data/arkpedia-tragodia-effect-animations.json'));
const shader=await read(path.join(root,'data/arkpedia-tragodia-effect-shaders.json'));
const files=new Map();
function safe(file){if(!/^[\w./-]+\.(bin|json|webp)$/.test(file)||file.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe original effect file');}
async function checked(entry){
  safe(entry.path);const bytes=await readFile(path.join(cache,entry.path));
  if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('Changed original artifact: '+entry.path);
  files.set(entry.path,bytes);return bytes;
}
const raw=await checked(effects.pack),decoded=gunzipSync(raw,{maxOutputLength:64*1024*1024});
if(decoded.length!==effects.pack.decodedBytes||sha(decoded)!==effects.pack.decodedSha256)throw Error('Changed decoded effect pack');
const pack=JSON.parse(decoded);
const animations=JSON.parse(await checked(animation.artifact)),shaders=JSON.parse(await checked(shader.artifact));
if(animations.sourcePackSha256!==effects.pack.sha256||JSON.stringify(shaders.sourceBundle)!==JSON.stringify(shader.sourceBundle)
  ||shaders.operator!==effects.operator||shaders.version!==effects.version)throw Error('Original effect source-chain mismatch');
if(effects.operator!=='char_1042_phatm2'||effects.version!=='26-09-23-17-49-43_b9cc4a'
  ||Object.keys(pack.roots).length!==33||JSON.stringify(pack.roots)!==JSON.stringify(effects.roots))throw Error('Unreviewed Tragodia effect inventory');
for(const entry of Object.values(effects.textures))await checked(entry);
const file=async(relative,source)=>{
  safe(relative);const bytes=await readFile(source);files.set(relative,bytes);
  return{path:relative,bytes:bytes.length,sha256:sha(bytes)};
};
const sourceReceipts={};
for(const [name,source]of [['effects','effects'],['animations','effect-animations'],['shaders','effect-shaders']])
  sourceReceipts[name]=await file(`receipts/${name}.json`,path.join(root,`data/arkpedia-tragodia-${source}.json`));
const builtin=await file('native-builtin-meshes.json',path.join(root,'data/arkpedia-unity-builtin-meshes.json'));
const builtinData=JSON.parse(files.get(builtin.path));
if(!builtinData.supportedEffectPacks[effects.pack.sha256])throw Error('Built-in mesh source is not bound to this pack');
const manifest={schemaVersion:1,id:'tragodia',operator:effects.operator,resourceVersion:effects.version,
  scope:{artworkOnly:true,publicBattleApproved:false,compiledFrameParity:false,nativePixelParity:false,
    preparedRoots:['phatm2_skill_03_prison_01']},
  sourceBundles:effects.sources,pack:effects.pack,animations:animation.artifact,shaders:shader.artifact,
  builtinMeshes:builtin,sourceReceipts,textures:effects.textures,roots:effects.roots,
  unresolvedReferences:effects.unresolvedReferences};
await mkdir(out,{recursive:true});
for(const [file,bytes]of files){await mkdir(path.dirname(path.join(out,file)),{recursive:true});await writeFile(path.join(out,file),bytes);}
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:files.size,bytes:[...files.values()].reduce((n,b)=>n+b.length,0),roots:Object.keys(manifest.roots).length,textures:Object.keys(manifest.textures).length,preparedRoots:manifest.scope.preparedRoots}));
