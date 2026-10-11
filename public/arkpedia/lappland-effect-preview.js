// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect original mesh templates and explicit clip poses. This deliberately
// does not stand in for particle/trail lifecycle or a reviewed battle renderer.
import * as T from '/vendor/three.module.js';
import {webglEffectProgram,selectEffectProgram} from '/shared/arkpedia/native-effect-shader.js';
import {createEffectPose} from '/shared/arkpedia/native-effect-pose.js';
const effect=document.querySelector('#effect'),clipSelect=document.querySelector('#clip'),time=document.querySelector('#time');
const status=document.querySelector('#status'),play=document.querySelector('#play'),host=document.querySelector('#scene');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#142027');
const camera=new T.PerspectiveCamera(35,1,.001,100);camera.up.set(0,1,0);
let pack,animations,shaders,pose,group,playing=false,clock=0,last,draws=[],blocked=[],geometries=[],materials=[];
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
  const declarations=[...new Map([...port.vertex.matchAll(/uniform\s+(?:(?:highp|mediump|lowp)\s+)?(float|vec[234]|sampler2D)\s+(\w+)(?:\[(\d+)\])?\s*;/g),
    ...port.fragment.matchAll(/uniform\s+(?:(?:highp|mediump|lowp)\s+)?(float|vec[234]|sampler2D)\s+(\w+)(?:\[(\d+)\])?\s*;/g)].map(m=>[m[2],m])).values()];
  for(const [,type,name,size] of declarations){
    if(size){if(type!=='vec4'||size!=='4'||!name.startsWith('hlslcc_mtx4x4'))throw Error('Unsupported native uniform array');uniforms[name]={value:new Float32Array(16)};continue;}
    if(type==='sampler2D'){uniforms[name]={value:await sourceTexture(material,name,shader)};continue;}
    if(name==='_WorldSpaceCameraPos'){uniforms[name]={value:new T.Vector3()};continue;}
    if(name==='_Time'||name==='_SinTime'||name==='_CosTime'){uniforms[name]={value:new T.Vector4()};continue;}
    let value=props[name];
    if(value===undefined){
      const d=shader.properties.m_Props.find(p=>p.m_Name===name);
      if(!d)throw Error('Unmapped native uniform '+name);
      value=type==='float'?d['m_DefValue[0]']:Array.from({length:Number(type.slice(3))},(_,i)=>d['m_DefValue['+i+']']);
    }
    if(type==='float'&&typeof value!=='number'||type!=='float'&&!Array.isArray(value))throw Error('Native uniform shape mismatch '+name);
    uniforms[name]={value:type==='float'?value:new T['Vector'+type.slice(3)](...value)};
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
  const colors=d.colors??d.positions.map(()=>[1,1,1,1]);
  g.setAttribute('in_COLOR0',new T.Float32BufferAttribute(colors.flatMap(c=>c.map((v,i)=>v*(color?.[i]??1))),4));
  // Three's bounds computation uses the standard attribute name even though
  // the original shader binds its original GLES input name.
  g.setAttribute('position',g.getAttribute('in_POSITION0'));g.setIndex(d.submeshTriangles.flat(2));return g;
}
function constant(curve){if(curve.minMaxState!==0)throw Error('Particle template has a varying initial curve');return curve.scalar;}
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
      let meshId,size=1,angle=0,color=null;
      if(record.type==='MeshRenderer'){
        const go=pack.records[r.gameObject];const filter=(go.references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='MeshFilter');
        meshId=target(filter,'m_Mesh');
      }else if(record.type==='ParticleSystemRenderer'){
        if(record.data.m_RenderMode!==4)throw Error('Billboard particle lifecycle not playing');
        const ps=(pack.records[r.gameObject].references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='ParticleSystem');
        const d=pack.records[ps].data.InitialModule;
        if(d.size3D||d.rotation3D||d.startColor.minMaxState!==0)throw Error('Dynamic particle template needs lifecycle playback');
        size=constant(d.startSize);angle=constant(d.startRotation);color=['r','g','b','a'].map(k=>d.startColor.maxColor[k]);
        meshId=target(component,'m_Mesh');
      }else throw Error('Trail lifecycle not playing');
      const mat=r.materials[0];if(!mat)throw Error('Unresolved original material');
      const material=await makeMaterial(component,mat.id),g=geometry(meshId,color);
      const mesh=new T.Mesh(g,material);mesh.scale.setScalar(size);mesh.rotation.z=angle;
      nodeObjects.get(r.transform).add(mesh);draws.push({component,mesh});
      mesh.onBeforeRender=()=>{
        const u=material.uniforms,matrix=mesh.matrixWorld;
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
  clock=0;time.value='0';draw();
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group),centre=bounds.getCenter(new T.Vector3());
  const size=Math.max(bounds.getSize(new T.Vector3()).length(),.5);camera.position.copy(centre).add(new T.Vector3(.2,.35,1).normalize().multiplyScalar(size*1.8));camera.lookAt(centre);draw();
  status.textContent=`${draws.length} original mesh templates rendered. ${blocked.length} components remain unplayed.\nMesh/explicit-clip inspection only: emission, trails, script motion and Animator transitions are not playing. Native coordinates, color management and camera mapping are not yet verified against a game frame.`;
  globalThis.effectReview={compileResults,pose,draws,blocked,setTime(t){clock=t;time.value=String(t);draw();},setClip(id){clipSelect.value=id;draw();},
    async selectRoot(name){effect.value=name;await rebuild();}};
  }finally{effect.disabled=clipSelect.disabled=time.disabled=play.disabled=false;}
}
function draw(){
  if(!pose)return;
  const state=pose.sample(clock,clipSelect.value||null);
  for(const [id,n] of state.nodes){const o=nodeObjects.get(id);o.position.fromArray(n.position);o.scale.fromArray(n.scale);
    if(n.euler)o.quaternion.setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY'));else o.quaternion.fromArray(n.rotation);
    o.visible=n.visible;
  }
  for(const {component,mesh} of draws){const p=state.renderers.get(component).materials[0].properties,u=mesh.material.uniforms;
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
  function frame(now){if(playing){clock=(clock+(last===undefined?0:(now-last)/1000))%3;time.value=String(clock);draw();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(e){status.textContent=e.message;console.error(e);}
addEventListener('pagehide',()=>{observer.disconnect();renderer.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();for(const t of [...textures.values(),...defaults.values()])t.dispose();},{once:true});
