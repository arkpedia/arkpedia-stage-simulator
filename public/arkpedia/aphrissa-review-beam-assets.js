// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit loopback review loader only. No normal battle asset registration.
import effects from '../../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import {APHRISSA_BEAM_CONTRACT} from '../../shared/arkpedia/aphrissa-beam-presentation.js';
import {createNativeEffectLibrary,compileNativeEffectPrograms} from './native-effect-player.js';
import {createAphrissaStageBeams} from './aphrissa-stage-beams.js';
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function loadAphrissaReviewBeams({three:T,renderer,heightAt,anchorAt,shaderGlobals}){
  if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw Error('Aphrissa effect inputs are held for loopback review');
  const bytes=async e=>{
    if(!Number.isSafeInteger(e.bytes)||e.bytes<1||e.bytes>64*1024*1024||!/^[a-f0-9]{64}$/.test(e.sha256)
      ||!/^([\w-]+\/)*[\w.-]+\.(bin|json|webp)$/.test(e.path))throw Error('Invalid pinned Aphrissa effect reference');
    const response=await fetch('/review-assets/'+e.path);if(!response.ok)throw Error('Original Aphrissa effect input unavailable');
    const b=await response.arrayBuffer();if(b.byteLength!==e.bytes||await hash(b)!==e.sha256)throw Error('Changed original Aphrissa effect input');return b;
  };
  const raw=await bytes(effects.pack),decoded=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(decoded.byteLength!==effects.pack.decodedBytes||await hash(decoded)!==effects.pack.decodedSha256)throw Error('Changed decoded Aphrissa source pack');
  const pack=JSON.parse(new TextDecoder().decode(decoded));
  const [animations,shaders]=await Promise.all([animationMeta.artifact,shaderMeta.artifact].map(async e=>JSON.parse(new TextDecoder().decode(await bytes(e)))));
  if(animations.sourcePackSha256!==effects.pack.sha256||pack.operator!==effects.operator||pack.version!==effects.version
    ||shaders.operator!==effects.operator||shaders.version!==effects.version)throw Error('Changed Aphrissa effect source bindings');
  compileNativeEffectPrograms(renderer,shaders);
  const library=createNativeEffectLibrary({three:T,pack,animations,shaders,shaderGlobals,loadTexture:async e=>{
    const url=URL.createObjectURL(new Blob([await bytes(e)],{type:'image/webp'}));
    try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
  }});
  try{
    const pass=createAphrissaStageBeams({three:T,library,sourcePackSha256:effects.pack.sha256,contract:APHRISSA_BEAM_CONTRACT,heightAt,anchorAt,shaderGlobals});
    const dispose=pass.dispose;pass.dispose=()=>{dispose();library.dispose();};return pass;
  }catch(error){library.dispose();throw error;}
}
