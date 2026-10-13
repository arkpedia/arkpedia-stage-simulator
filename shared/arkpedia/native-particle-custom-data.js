// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';

// Authored Custom Data module at normalized particle age. External script writes,
// native random ordering and compiled Unity dispatch are not reproduced here.
export function createParticleCustomData(module){
  if(!module?.enabled)return null;
  const modes=[module.mode0,module.mode1];
  for(const [stream,mode] of modes.entries()){
    if(![0,1,2].includes(mode))throw Error('Unsupported native custom data mode');
    if(mode===1){
      const count=module['vectorComponentCount'+stream];
      if(!Number.isInteger(count)||count<1||count>4)throw Error('Invalid native custom data vector width');
      for(let channel=0;channel<count;channel++)for(const time of [0,1])for(const factor of [0,1])
        sampleParticleCurve(module[`vector${stream}_${channel}`],time,factor);
    }
    if(mode===2)for(const time of [0,1])for(const factor of [0,1])
      sampleParticleGradient(module['color'+stream],time,factor);
  }
  return {sample(age,lifetime,random){
    if(!Number.isFinite(age)||age<0||!Number.isFinite(lifetime)||lifetime<=0||typeof random!=='function')
      throw Error('Invalid native custom data sample');
    const time=Math.max(0,Math.min(1,age/lifetime));
    return modes.map((mode,stream)=>{
      // Disabled streams use explicit local zero values. Runtime script writes
      // need a separate input contract rather than implied module animation.
      if(mode===0)return [0,0,0,0];
      if(mode===2)return sampleParticleGradient(module['color'+stream],time,random(stream,0));
      const count=module['vectorComponentCount'+stream];
      return Array.from({length:4},(_,channel)=>channel<count
        ?sampleParticleCurve(module[`vector${stream}_${channel}`],time,random(stream,channel)):0);
    });
  }};
}

// Unity 2021.3 ParticleSystemEnums + RendererModuleUI pack nonsemantic streams
// consecutively into TEXCOORD components, including across a vec4 boundary.
// Position/normal/color keep their own semantics. Unknown streams stay held.
export function createParticleVertexLayout(streams){
  if(!Array.isArray(streams)||!streams.length||streams[0]!==0||new Set(streams).size!==streams.length)
    throw Error('Invalid native particle vertex streams');
  const channels=[];
  for(const stream of streams){
    if([0,1,3].includes(stream))continue;
    if(stream===4){channels.push({kind:'uv',channel:0},{kind:'uv',channel:1});continue;}
    if(stream>=31&&stream<=38&&Number.isInteger(stream)){
      const group=stream<35?0:1,count=stream-(group?34:30);
      for(let channel=0;channel<count;channel++)channels.push({kind:'custom',group,channel});
      continue;
    }
    throw Error('Unsupported native particle vertex stream '+stream);
  }
  if([0,1,3,4].some(stream=>!streams.includes(stream)))
    throw Error('Native particle position/normal/color/UV streams are required');
  const dimensions=Array.from({length:Math.ceil(channels.length/4)},(_,i)=>Math.min(4,channels.length-i*4));
  function sample(uv,custom){
    if(!Array.isArray(uv)||uv.length!==2||uv.some(v=>!Number.isFinite(v))
      ||!Array.isArray(custom)||custom.length!==2||custom.some(v=>!Array.isArray(v)||v.length!==4||v.some(c=>!Number.isFinite(c))))
      throw Error('Invalid native particle vertex values');
    const values=channels.map(c=>c.kind==='uv'?uv[c.channel]:custom[c.group][c.channel]);
    return dimensions.map((width,i)=>values.slice(i*4,i*4+width));
  }
  return {dimensions,sample};
}
