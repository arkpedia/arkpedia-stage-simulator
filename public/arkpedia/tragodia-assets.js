// SPDX-License-Identifier: GPL-3.0-or-later
// Public delivery loader: immutable metadata and original bytes, no art fallback.
import review from '../../data/arkpedia-tragodia-runtime-review.json' with {type:'json'};
import {createNativeEffectLibrary,compileNativeEffectPrograms} from './native-effect-player.js';
import {createTragodiaStageEffects} from './tragodia-stage-effects.js';
const PACK='e39769c56a91f5d483632808082a05a3dbe0b71d5a5c99b3ade9ebdee68fd0ff';
const VERSION='26-09-23-17-49-43_b9cc4a';
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function readPinnedEffectBytes(base,entry,fetcher=fetch){
  if(typeof entry?.path!=='string'||!/^[\w./-]+\.(json|bin|webp)$/.test(entry.path)
    ||entry.path.split('/').some(p=>!p||p==='.'||p==='..')
    ||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>64*1024*1024
    ||!/^[a-f0-9]{64}$/.test(entry.sha256??''))throw Error('Invalid native effect file reference');
  const response=await fetcher(base+entry.path);
  if(!response.ok)throw Error('Original cage asset unavailable: '+entry.path);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==entry.bytes||await hash(bytes)!==entry.sha256)throw Error('Changed original cage asset: '+entry.path);
  return bytes;
}
export async function loadTragodiaStageEffects({three:T,renderer,descriptor,heightAt}){
  if(descriptor?.repository!=='arkpedia/arkpedia-sd-assets'||!/^[a-f0-9]{40}$/.test(descriptor.commit??'')
    ||JSON.stringify(descriptor.manifest)!==JSON.stringify(review.nativeEffectManifest))throw Error('Unreviewed cage asset delivery');
  const remote=`https://raw.githubusercontent.com/${descriptor.repository}/${descriptor.commit}/`;
  const local=`/arkpedia-assets/${descriptor.commit}/`;
  if(descriptor.localBase!==undefined&&descriptor.localBase!==local)throw Error('Invalid local cage asset base');
  const base=descriptor.localBase??remote;
  const meta=JSON.parse(new TextDecoder().decode(await readPinnedEffectBytes(base,descriptor.manifest)));
  if(meta.operator!=='char_1042_phatm2'||meta.resourceVersion!==VERSION||meta.pack.sha256!==PACK
    ||meta.scope.publicBattleApproved!==false||meta.scope.nativePixelParity!==false
    ||JSON.stringify(meta.scope.preparedRoots)!==JSON.stringify(['phatm2_skill_03_prison_01']))throw Error('Unreviewed native cage package');
  const prefix=base+descriptor.manifest.path.slice(0,-'manifest.json'.length);
  const bytes=e=>readPinnedEffectBytes(prefix,e),json=async e=>JSON.parse(new TextDecoder().decode(await bytes(e)));
  const compressed=await bytes(meta.pack);
  const decoded=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(decoded.byteLength!==meta.pack.decodedBytes||await hash(decoded)!==meta.pack.decodedSha256)throw Error('Changed original cage decoded pack');
  const pack=JSON.parse(new TextDecoder().decode(decoded));
  const [animations,shaders,builtinMeshes]=await Promise.all([meta.animations,meta.shaders,meta.builtinMeshes].map(json));
  if(animations.sourcePackSha256!==PACK||animations.operator!==meta.operator||animations.version!==VERSION
    ||shaders.operator!==meta.operator||shaders.version!==VERSION||!builtinMeshes.supportedEffectPacks?.[PACK]
    ||JSON.stringify(pack.roots)!==JSON.stringify(meta.roots)||JSON.stringify(pack.textures)!==JSON.stringify(meta.textures))
    throw Error('Changed original cage source bindings');
  compileNativeEffectPrograms(renderer,shaders);
  const library=createNativeEffectLibrary({three:T,pack,animations,shaders,builtinMeshes,loadTexture:async e=>{
    const url=URL.createObjectURL(new Blob([await bytes(e)],{type:'image/webp'}));
    try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
  }});
  try{
    const probe=await library.create('phatm2_skill_03_prison_01');probe.dispose();
    const pass=createTragodiaStageEffects({three:T,library,sourcePackSha256:PACK,heightAt});
    const dispose=pass.dispose;pass.dispose=()=>{dispose();library.dispose();};return pass;
  }catch(e){library.dispose();throw e;}
}
