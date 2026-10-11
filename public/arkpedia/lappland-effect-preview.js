// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect original meshes, supported source emitters and explicit clips.
// This is not a completed particle/trail lifecycle or reviewed battle renderer.
import * as T from '/vendor/three.module.js';
import {webglEffectProgram,selectEffectProgram,effectUniformDeclarations} from '/shared/arkpedia/native-effect-shader.js';
import {createStationaryParticles} from '/shared/arkpedia/native-stationary-particles.js';
import {createMovingParticles} from '/shared/arkpedia/native-moving-particles.js';
import {particleWorldPosition,particleSheetUV} from '/shared/arkpedia/native-particle-render.js';
import {sampleParticleCurve} from '/shared/arkpedia/native-particle-curves.js';
import {effectMeshColors} from '/shared/arkpedia/native-effect-mesh.js';
import {createEffectPose} from '/shared/arkpedia/native-effect-pose.js';
const effect=document.querySelector('#effect'),clipSelect=document.querySelector('#clip'),time=document.querySelector('#time');
const status=document.querySelector('#status'),play=document.querySelector('#play'),host=document.querySelector('#scene');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#142027');
const camera=new T.PerspectiveCamera(35,1,.001,100);camera.up.set(0,1,0);
let pack,animations,shaders,pose,group,playing=false,clock=0,timeWindow=3,last,draws=[],blocked=[],geometries=[],materials=[];
const textures=new Map(),defaults=new Map(),nodeObjects=new Map();
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function bytes(entry){
  const r=await fetch('/review-assets/'+entry.path);if(!r.ok)throw Error('Start the isolated original-effect review server first.');
  const b=await r.arrayBuffer();if(b.byteLength!==entry.bytes||await sha(b)!==entry.sha256)throw Error('Changed original review asset');return b;
}
const refs=(id,field)=>(pack.records[id].references??[]).filter(r=>r.field===field);
const target=(id,field)=>refs(id,field)[0]?.target;
function compilePrograms(){
  const gl=renderer.getContext(), result=[];
  for(const shader of Object.values(shaders.shaders))for(const p of Object.values(shader.programs)){
    const port=webglEffectProgram(p.source), program=gl.createProgram(), compiled=[];
    try{
      for(const [kind,code] of [[gl.VERTEX_SHADER,port.vertex],[gl.FRAGMENT_SHADER,port.fragment]]){
        const s=gl.createShader(kind);compiled.push(s);gl.shaderSource(s,'#version 300 es\n'+code);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      result.push({shader:shader.name,blobIndex:p.blobIndex,keywords:p.keywords});
    }finally{for(const s of compiled)gl.deleteShader(s);gl.deleteProgram(program);}
  }
  renderer.resetState();return result;
}
async function sourceTexture(material,name,shader){
  const saved=pack.records[material].data.m_SavedProperties;
  const entry=saved.m_TexEnvs.find(([key])=>key===name)?.[1];
  if(entry?.m_Texture.m_PathID!=='0'&&entry){
    const r=refs(material,'m_Texture').find(r=>r.pointer.m_PathID===entry.m_Texture.m_PathID&&r.pointer.m_FileID===entry.m_Texture.m_FileID);
    if(!r?.target||!pack.textures[r.target])throw Error('Unresolved original texture '+name);
    if(!textures.has(r.target)){
      const original=pack.textures[r.target],b=await bytes(original),url=URL.createObjectURL(new Blob([b],{type:'image/webp'}));
      let tex;try{tex=await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
      // Original UV/image orientation; shader arithmetic consumes source values.
      const settings=pack.records[r.target].data.m_TextureSettings;
      const wrap={0:T.RepeatWrapping,1:T.ClampToEdgeWrapping,2:T.MirroredRepeatWrapping};
      if(settings.m_FilterMode!==1||wrap[settings.m_WrapU]===undefined||wrap[settings.m_WrapV]===undefined){
        tex.dispose();throw Error('Original texture sampler needs review');
      }
      // Keep color-space interpretation explicit and unverified. The original
      // shaders are unmodified; no brightness compensation is added here.
      tex.colorSpace=T.NoColorSpace;tex.wrapS=wrap[settings.m_WrapU];tex.wrapT=wrap[settings.m_WrapV];
      tex.minFilter=tex.magFilter=T.LinearFilter;tex.generateMipmaps=false;
      textures.set(r.target,tex);
    }
    return textures.get(r.target);
  }
  const def=shader.properties.m_Props.find(p=>p.m_Name===name)?.m_DefTexture.m_DefaultName;
  if(!['white','black','gray'].includes(def))throw Error('Unresolved native texture default '+name);
  if(!defaults.has(def)){
    const c={white:255,black:0,gray:128}[def];
    const t=new T.DataTexture(new Uint8Array([c,c,c,255]),1,1,T.RGBAFormat);t.needsUpdate=true;defaults.set(def,t);
  }
  return defaults.get(def);
}
const factor=value=>({0:T.ZeroFactor,1:T.OneFactor,2:T.DstColorFactor,3:T.SrcColorFactor,4:T.OneMinusDstColorFactor,
  5:T.SrcAlphaFactor,6:T.OneMinusSrcColorFactor,7:T.DstAlphaFactor,8:T.OneMinusDstAlphaFactor,9:T.SrcAlphaSaturateFactor,10:T.OneMinusSrcAlphaFactor})[value];
function stateValue(v,props){if(v.name.startsWith('_')){if(!Object.hasOwn(props,v.name))throw Error('Missing native pass property');return props[v.name];}return v.val;}
async function makeMaterial(component,material){
  const data=pack.records[material].data,shader=shaders.shaders[target(material,'m_Shader')];
  if(!shader||shader.passes.length!==1)throw Error('Unsupported native multipass shader');
  const source=selectEffectProgram(shader,data.m_ValidKeywords),port=webglEffectProgram(source.source),props=pose.renderers.get(component).materials[0].properties;
  const uniforms={};
  const declarations=effectUniformDeclarations(port);
  for(const {type,name,count:size} of declarations){
    if(size){if(type!=='vec4'||size!==4||!name.startsWith('hlslcc_mtx4x4'))throw Error('Unsupported native uniform array');uniforms[name]={value:new Float32Array(16)};continue;}
    if(type==='sampler2D'){uniforms[name]={value:await sourceTexture(material,name,shader)};continue;}
    if(name==='_WorldSpaceCameraPos'){uniforms[name]={value:new T.Vector3()};continue;}
    if(name==='_Time'||name==='_SinTime'||name==='_CosTime'){uniforms[name]={value:new T.Vector4()};continue;}
    let value=props[name];
    if(value===undefined){
      const d=shader.properties.m_Props.find(p=>p.m_Name===name);
      if(!d)throw Error('Unmapped native uniform '+name);
      value=['float','int'].includes(type)?d['m_DefValue[0]']:Array.from({length:Number(type.slice(3))},(_,i)=>d['m_DefValue['+i+']']);
    }
    if(['float','int'].includes(type)&&typeof value!=='number'||!['float','int'].includes(type)&&!Array.isArray(value))throw Error('Native uniform shape mismatch '+name);
    if(type==='int'&&!Number.isInteger(value))throw Error('Noninteger native shader toggle '+name);
    uniforms[name]={value:['float','int'].includes(type)?value:new T['Vector'+type.slice(3)](...value)};
  }
  const q=shader.passes[0].state,b=q.rtBlend0,zTest=stateValue(q.zTest,props),cull=stateValue(q.culling,props);
  if(![0,2,4,8].includes(zTest)||![0,1,2].includes(cull))throw Error('Native depth/cull mode needs review');
  const src=factor(stateValue(b.srcBlend,props)),dst=factor(stateValue(b.destBlend,props));
  if(src===undefined||dst===undefined||stateValue(b.blendOp,props)!==0)throw Error('Native blend mode needs review');
  const m=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:port.vertex,fragmentShader:port.fragment,uniforms,
    transparent:true,depthTest:zTest!==0&&zTest!==8,depthFunc:zTest===2?T.LessDepth:T.LessEqualDepth,
    depthWrite:stateValue(q.zWrite,props)!==0,side:[T.DoubleSide,T.BackSide,T.FrontSide][cull],
    blending:T.CustomBlending,blendSrc:src,blendDst:dst,blendEquation:T.AddEquation});
  // Native non-separate RGB/alpha blending uses the same factors for both.
  if(q.rtSeparateBlend)throw Error('Separate native blend mode needs review');
  materials.push(m);return m;
}
function geometry(id,color=null){
  const d=pack.meshes[id];if(!d)throw Error('Unresolved original mesh');
  const g=new T.BufferGeometry();geometries.push(g);
  g.setAttribute('in_POSITION0',new T.Float32BufferAttribute(d.positions.flat(),d.positions[0].length));
  if(d.normals)g.setAttribute('in_NORMAL0',new T.Float32BufferAttribute(d.normals.flat(),d.normals[0].length));
  d.uvChannels.forEach((uv,i)=>{if(uv)g.setAttribute('in_TEXCOORD'+i,new T.Float32BufferAttribute(uv.flat(),uv[0].length));});
  g.setAttribute('in_COLOR0',new T.Float32BufferAttribute(effectMeshColors(d,color??[1,1,1,1]),4));
  // Three's bounds computation uses the standard attribute name even though
  // the original shader binds its original GLES input name.
  g.setAttribute('position',g.getAttribute('in_POSITION0'));g.setIndex(d.submeshTriangles.flat(2));return g;
}
function billboardGeometry(){
  // Billboard mode has no authored Mesh asset: its quad is generated by the
  // particle renderer. This local XY mapping is explicit, not a replacement for
  // an unresolved source Mesh reference.
  const g=new T.PlaneGeometry(1,1);geometries.push(g);
  g.setAttribute('in_POSITION0',g.getAttribute('position'));
  g.setAttribute('in_NORMAL0',g.getAttribute('normal'));
  g.setAttribute('in_TEXCOORD0',g.getAttribute('uv'));
  g.setAttribute('in_COLOR0',new T.Float32BufferAttribute(Array(16).fill(1),4));return g;
}
let rebuildQueue=Promise.resolve();
function rebuild(){
  const name=effect.value;
  const next=rebuildQueue.then(()=>rebuildRoot(name));
  rebuildQueue=next.catch(()=>{});return next;
}
async function rebuildRoot(name){
  effect.disabled=clipSelect.disabled=time.disabled=play.disabled=true;
  playing=false;play.textContent='Play';pose=null;effect.value=name;
  try{
  for(const m of materials)m.dispose();for(const g of geometries)g.dispose();materials=[];geometries=[];draws=[];blocked=[];
  if(group)scene.remove(group);group=new T.Group();scene.add(group);nodeObjects.clear();
  pose=createEffectPose(pack,animations,effect.value);
  for(const [id,n] of pose.nodes){const o=new T.Group();nodeObjects.set(id,o);(n.parent?nodeObjects.get(n.parent):group).add(o);}
  for(const [component,r] of pose.renderers){
    const record=pack.records[component];if(!r.enabled)continue;
    try{
      let meshId,particleSource,emitter,billboard=false;
      if(record.type==='MeshRenderer'){
        const go=pack.records[r.gameObject];const filter=(go.references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='MeshFilter');
        meshId=target(filter,'m_Mesh');
      }else if(record.type==='ParticleSystemRenderer'){
        if(![0,4].includes(record.data.m_RenderMode)||![0,2].includes(record.data.m_RenderAlignment)||record.data.m_RenderMode===4&&record.data.m_RenderAlignment!==2)throw Error('Particle alignment/render mode not playing');
        if(record.data.m_UseCustomVertexStreams||Object.values(record.data.m_Pivot).some(v=>v!==0)||Object.values(record.data.m_Flip).some(v=>v!==0))throw Error('Particle vertex streams/pivot/flip need review');
        const ps=(pack.records[r.gameObject].references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='ParticleSystem');
        particleSource=pack.records[ps].data;
        const moving=['ShapeModule','VelocityModule','UVModule','ClampVelocityModule','NoiseModule'].some(k=>particleSource[k]?.enabled)||particleSource.moveWithTransform===1;
        emitter=moving?createMovingParticles(particleSource):createStationaryParticles(particleSource);
        if(![0,1,2].includes(particleSource.scalingMode))throw Error('Native particle scaling mode needs review');
        if(particleSource.moveWithTransform===1){
          const ancestors=new Set();let n=r.transform;while(n){const d=pose.nodes.get(n);ancestors.add(d.gameObject);n=d.parent;}
          if(pose.instances.some(i=>i.bindings.some(b=>ancestors.has(b.gameObject)&&['m_LocalRotation','localEulerAnglesRaw','m_LocalScale'].includes(b.property))))throw Error('Animated world particle velocity frame needs integration');
        }
        billboard=record.data.m_RenderMode===0;
        if(!billboard)meshId=target(component,'m_Mesh');
      }else throw Error('Trail lifecycle not playing');
      const mat=r.materials[0];if(!mat)throw Error('Unresolved original material');
      const material=await makeMaterial(component,mat.id),g=billboard?billboardGeometry():geometry(meshId);
      if(particleSource?.UVModule?.enabled&&Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)).some(a=>a&&a.itemSize!==2))throw Error('Native multidimensional particle UV stream needs review');
      const mesh=new T.Mesh(g,material);
      if(particleSource){const d=particleSource.InitialModule,x=sampleParticleCurve(d.startSize,0);
        mesh.scale.fromArray(d.size3D?[x,sampleParticleCurve(d.startSizeY,0),sampleParticleCurve(d.startSizeZ,0)]:[x,x,x]);}

      nodeObjects.get(r.transform).add(mesh);draws.push({component,transform:r.transform,particleSource,alignment:record.data.m_RenderAlignment,mesh,emitter,pool:emitter?[mesh]:null,
        baseColors:emitter?g.getAttribute('in_COLOR0').array.slice():null,
        baseUVs:emitter?Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)?.array.slice()??null):null});
      mesh.onBeforeRender=function(){
        const u=material.uniforms,matrix=this.matrixWorld;
        if(!matrix.elements.every(Number.isFinite))throw Error('Invalid source particle matrix '+component);
        if(!camera.matrixWorldInverse.elements.every(Number.isFinite))throw Error('Invalid effect inspection camera');
        if(u.hlslcc_mtx4x4unity_ObjectToWorld)u.hlslcc_mtx4x4unity_ObjectToWorld.value.set(matrix.elements);
        if(u.hlslcc_mtx4x4unity_WorldToObject)u.hlslcc_mtx4x4unity_WorldToObject.value.set(new T.Matrix4().copy(matrix).invert().elements);
        if(u.hlslcc_mtx4x4unity_MatrixVP)u.hlslcc_mtx4x4unity_MatrixVP.value.set(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements);
        u._WorldSpaceCameraPos?.value.copy(camera.position);material.uniformsNeedUpdate=true;
      };
    }catch(e){blocked.push({component,name:pack.records[r.gameObject].data.m_Name,reason:e.message});}
  }
  clipSelect.replaceChildren(new Option('Static native pose',''));
  for(const id of new Set(pose.instances.map(i=>i.clip)))clipSelect.add(new Option(animations.clips[id].name,id));
  if(clipSelect.options.length>1)clipSelect.selectedIndex=1;
  // Inspect two native emitter periods rather than cutting five-second systems
  // off at the old fixed three-second review window.
  const periods=[...pose.nodes.values()].flatMap(n=>(pack.records[n.gameObject].references??[])
    .map(r=>pack.records[r.target]).filter(r=>r?.type==='ParticleSystem').map(r=>r.data.lengthInSec*2));
  timeWindow=Math.max(3,...periods,...pose.instances.map(i=>animations.clips[i.clip].stop));time.max=String(timeWindow);
  clock=0;time.value='0';draw();
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group),centre=bounds.getCenter(new T.Vector3());
  const extent=bounds.getSize(new T.Vector3()).length(),size=Number.isFinite(extent)?Math.max(extent,.5):.5;
  if(!centre.toArray().every(Number.isFinite))centre.set(0,0,0);
  camera.position.copy(centre).add(new T.Vector3(.2,.35,1).normalize().multiplyScalar(size*1.8));camera.lookAt(centre);draw();
  status.textContent=`${draws.length} original mesh/billboard components inspected. ${blocked.length} components remain unplayed.\nSource-emitter/explicit-clip inspection: box/straight-cone emission, velocity, grid frames and a local curl-noise/speed-limit replay are playing. Other shapes, trails, script motion and Animator transitions remain unplayed. Noise field, timing, native coordinates and color management are not verified against game frames.`;
  globalThis.effectReview={compileResults,pose,draws,blocked,setTime(t){clock=t;time.value=String(t);draw();},setClip(id){clipSelect.value=id;draw();},
    async selectRoot(name){effect.value=name;await rebuild();}};
  }finally{effect.disabled=clipSelect.disabled=time.disabled=play.disabled=false;}
}
function particleFrame(transform,state){
  const worlds=new Map();
  function world(id){
    if(worlds.has(id))return worlds.get(id);
    const n=state.nodes.get(id),q=n.euler?new T.Quaternion().setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY')):new T.Quaternion().fromArray(n.rotation);
    const scale=new T.Vector3().fromArray(n.scale),m=new T.Matrix4().compose(new T.Vector3().fromArray(n.position),q,scale);
    if(n.parent){const parent=world(n.parent);m.premultiply(parent.matrix);q.premultiply(parent.rotation);scale.multiply(parent.scale);}
    const result={matrix:m,rotation:q,scale};worlds.set(id,result);return result;
  }
  // Read rotation from the original quaternion chain, not matrix decomposition:
  // source clips may scale to zero, and decomposing that matrix produces NaNs.
  const frame=world(transform),position=new T.Vector3().setFromMatrixPosition(frame.matrix);
  const e=frame.matrix.elements;
  const scale=new T.Vector3(...[0,4,8].map((i,axis)=>Math.hypot(e[i],e[i+1],e[i+2])*(Math.sign(frame.scale.getComponent(axis))||1)));
  return {...frame,position,scale,localScale:new T.Vector3().fromArray(state.nodes.get(transform).scale)};
}
function draw(){
  if(!pose)return;
  const state=pose.sample(clock,clipSelect.value||null);
  for(const [id,n] of state.nodes){const o=nodeObjects.get(id);o.position.fromArray(n.position);o.scale.fromArray(n.scale);
    if(n.euler)o.quaternion.setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY'));else o.quaternion.fromArray(n.rotation);
    o.visible=n.visible;
  }
  group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const birthStates=new Map();
  for(const entry of draws){
    const {component,mesh,emitter,pool,baseColors,baseUVs,transform,particleSource,alignment}=entry;
    if(emitter){
      const particles=emitter.sample(clock);
      const current=particleFrame(transform,state);
      const scale=particleSource.scalingMode===0?current.scale:particleSource.scalingMode===1?current.localScale:new T.Vector3(1,1,1);
      const frame=current.matrix.clone();frame.compose(current.position,current.rotation,particleSource.scalingMode===2?current.scale:scale);
      const movement=particleSource.scalingMode===2?new T.Matrix4().compose(current.position,current.rotation,new T.Vector3(1,1,1)):frame;
      const inverse=new T.Matrix4().copy(mesh.parent.matrixWorld).invert();
      while(pool.length<particles.length){const clone=mesh.clone();clone.geometry=mesh.geometry.clone();geometries.push(clone.geometry);clone.onBeforeRender=mesh.onBeforeRender;mesh.parent.add(clone);pool.push(clone);}
      pool.forEach((part,i)=>{
        const particle=particles[i];part.visible=!!particle&&mesh.parent.matrixWorld.determinant()!==0;
        if(!particle)return;
        let position=current.position.clone();
        if(particle.position){
          let born=frame;
          if(particle.simulationSpace==='world'){
            // Prewarm precedes visible playback: hold the source start pose
            // before time zero rather than looping a clip into the past.
            const t=Math.max(0,particle.birthTime);
            if(!birthStates.has(t))birthStates.set(t,pose.sample(t,clipSelect.value||null));
            const b=particleFrame(transform,birthStates.get(t));
            born=new T.Matrix4().compose(b.position,b.rotation,particleSource.scalingMode===0||particleSource.scalingMode===2?b.scale:b.localScale);
          }
          position.fromArray(particleWorldPosition(particle,born.elements,frame.elements,movement.elements));
        }
        const rotation=alignment===0?camera.quaternion.clone():current.rotation.clone();
        rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),particle.rotation));
        const matrix=new T.Matrix4().compose(position,rotation,new T.Vector3().fromArray(particle.size).multiply(scale));
        part.matrixAutoUpdate=false;part.matrix.copy(inverse).multiply(matrix);part.matrixWorldNeedsUpdate=true;
        const colors=part.geometry.getAttribute('in_COLOR0');
        for(let j=0;j<baseColors.length;j++)colors.array[j]=baseColors[j]*particle.color[j%4];
        colors.needsUpdate=true;
        baseUVs.forEach((values,channel)=>{
          if(!values)return;
          const uv=part.geometry.getAttribute('in_TEXCOORD'+channel);
          uv.array.set(particle.sheet&&(particle.sheet.mask&(1<<channel))?particleSheetUV(values,particle.sheet):values);uv.needsUpdate=true;
        });
      });
    }
    const p=state.renderers.get(component).materials[0].properties,u=mesh.material.uniforms;
    for(const [name,{value}] of Object.entries(u))if(Object.hasOwn(p,name)){
      if(typeof p[name]==='number')u[name].value=p[name];else value.fromArray(p[name]);
    }
    u._Time?.value.set(clock/20,clock,clock*2,clock*3);
    u._SinTime?.value.set(Math.sin(clock/8),Math.sin(clock/4),Math.sin(clock/2),Math.sin(clock));
    u._CosTime?.value.set(Math.cos(clock/8),Math.cos(clock/4),Math.cos(clock/2),Math.cos(clock));
  }
  renderer.render(scene,camera);document.querySelector('#clock').textContent=clock.toFixed(2)+'s';
}
const observer=new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();draw();});observer.observe(host);
let compileResults;
try{
  const r=await fetch('/review-assets/manifest.json');if(!r.ok)throw Error('Start tools/arkpedia/preview-lappland-effects.mjs to inspect the cached original assets.');
  const meta=await r.json(),raw=await bytes(meta.effects.pack);
  pack=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  animations=JSON.parse(new TextDecoder().decode(await bytes(meta.animations.artifact)));
  shaders=JSON.parse(new TextDecoder().decode(await bytes(meta.shaders.artifact)));
  compileResults=compilePrograms();
  for(const name of Object.keys(pack.roots))effect.add(new Option(name.replace('whitw2_',''),name));
  effect.value='whitw2_token_01';await rebuild();
  effect.disabled=clipSelect.disabled=time.disabled=play.disabled=false;
  effect.onchange=async()=>{playing=false;play.textContent='Play';await rebuild();};
  clipSelect.onchange=()=>{playing=false;play.textContent='Play';clock=0;time.value='0';draw();};
  time.oninput=()=>{playing=false;play.textContent='Play';clock=Number(time.value);draw();};
  play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';last=undefined;};
  function frame(now){if(playing){clock=(clock+(last===undefined?0:(now-last)/1000))%timeWindow;time.value=String(clock);draw();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(e){status.textContent=e.message;console.error(e);}
addEventListener('pagehide',()=>{observer.disconnect();renderer.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();for(const t of [...textures.values(),...defaults.values()])t.dispose();},{once:true});
