// SPDX-License-Identifier: GPL-3.0-or-later
// Original-source player shared by inspection and future battle presentation.
// It owns no renderer, DOM, combat clock, camera framing or Animator FSM.
import {webglEffectProgram,selectEffectProgram,effectUniformDeclarations} from '../../shared/arkpedia/native-effect-shader.js';
import {createStationaryParticles} from '../../shared/arkpedia/native-stationary-particles.js';
import {createMovingParticles} from '../../shared/arkpedia/native-moving-particles.js';
import {particleWorldPosition,particleSheetUV} from '../../shared/arkpedia/native-particle-render.js';
import {sampleParticleCurve} from '../../shared/arkpedia/native-particle-curves.js';
import {effectMeshColors} from '../../shared/arkpedia/native-effect-mesh.js';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {createEffectTrail} from '../../shared/arkpedia/native-effect-trail.js';
import {createParticleVertexLayout} from '../../shared/arkpedia/native-particle-custom-data.js';
export function compileNativeEffectPrograms(renderer,shaders){
  const gl=renderer.getContext(), result=[];
  try{
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
  return result;
  }finally{renderer.resetState();}
}

/** Shared textures; instance geometry/materials and clocks remain independent.
 * loadTexture must verify the original entry's bytes/hash before decoding.
 * All update inputs use the original effect's Unity coordinate space. The
 * stage's coordinate/camera bridge and native frame parity remain separate.
 */
export function createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture}){
  if(!T||typeof loadTexture!=='function')throw Error('Native effect library needs Three and an original texture loader');
  let closed=false;
  const textures=new Map(),defaults=new Map(),instances=new Set();
  const assertOpen=()=>{if(closed)throw Error('Native effect library is disposed');};
  const refs=(id,field)=>(pack.records[id].references??[]).filter(r=>r.field===field);
  async function sourceTexture(material,name,shader){
    assertOpen();
    const saved=pack.records[material].data.m_SavedProperties;
    const entry=saved.m_TexEnvs.find(([key])=>key===name)?.[1];
    if(entry?.m_Texture.m_PathID!=='0'&&entry){
      const r=refs(material,'m_Texture').find(r=>r.pointer.m_PathID===entry.m_Texture.m_PathID&&r.pointer.m_FileID===entry.m_Texture.m_FileID);
      if(!r?.target||!pack.textures[r.target])throw Error('Unresolved original texture '+name);
      if(!textures.has(r.target))textures.set(r.target,(async()=>{
        const original=pack.textures[r.target];
        const tex=await loadTexture(original,r.target);
        if(!tex?.isTexture)throw Error('Original effect loader did not return a texture');
        if(closed){tex.dispose();throw Error('Native effect library is disposed');}
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
        return tex;
      })());
      const pending=textures.get(r.target);
      try{return await pending;}catch(error){if(textures.get(r.target)===pending)textures.delete(r.target);throw error;}
    }
    const def=shader.properties.m_Props.find(p=>p.m_Name===name)?.m_DefTexture.m_DefaultName;
    if(!['white','black','gray'].includes(def))throw Error('Unresolved native texture default '+name);
    if(!defaults.has(def)){
      const c={white:255,black:0,gray:128}[def];
      const t=new T.DataTexture(new Uint8Array([c,c,c,255]),1,1,T.RGBAFormat);t.needsUpdate=true;defaults.set(def,t);
    }
    return defaults.get(def);
  }

  const context={three:T,pack,animations,shaders,sourceTexture,assertOpen,
    register(instance){assertOpen();instances.add(instance);},unregister(instance){instances.delete(instance);}};
  const library={
    create(name,options){assertOpen();return createNativeEffectInstance(context,name,options);},
    get instanceCount(){return instances.size;},
    dispose(){
      if(closed)return;closed=true;
      for(const instance of [...instances])instance.dispose();
      // A load still in flight disposes its result before rejecting above.
      for(const pending of textures.values())pending.then(t=>t.dispose(),()=>{});
      for(const t of defaults.values())t.dispose();textures.clear();defaults.clear();
    }
  };
  return library;
}

async function createNativeEffectInstance(library,name,{allowBlocked=false}={}){
  const {three:T,pack,animations,shaders,sourceTexture}=library;
  library.assertOpen();
  const pose=createEffectPose(pack,animations,name),group=new T.Group();
  const draws=[],blocked=[],geometries=new Set(),materials=new Set(),nodeObjects=new Map();
  let disposed=false;
  const assertOpen=()=>{library.assertOpen();if(disposed)throw Error('Native effect instance is disposed');};
  const refs=(id,field)=>(pack.records[id].references??[]).filter(r=>r.field===field);
  const target=(id,field)=>refs(id,field)[0]?.target;
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
    if(q.rtSeparateBlend)throw Error('Separate native blend mode needs review');
    const m=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:port.vertex,fragmentShader:port.fragment,uniforms,
      transparent:true,depthTest:zTest!==0&&zTest!==8,depthFunc:zTest===2?T.LessDepth:T.LessEqualDepth,
      depthWrite:stateValue(q.zWrite,props)!==0,side:[T.DoubleSide,T.BackSide,T.FrontSide][cull],
      blending:T.CustomBlending,blendSrc:src,blendDst:dst,blendEquation:T.AddEquation});
    // Native non-separate RGB/alpha blending uses the same factors for both.
    materials.add(m);return m;
  }
  function geometry(id,color=null){
    const d=pack.meshes[id];if(!d)throw Error('Unresolved original mesh');
    const g=new T.BufferGeometry();geometries.add(g);
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
    const g=new T.PlaneGeometry(1,1);geometries.add(g);
    g.setAttribute('in_POSITION0',g.getAttribute('position'));
    g.setAttribute('in_NORMAL0',g.getAttribute('normal'));
    g.setAttribute('in_TEXCOORD0',g.getAttribute('uv'));
    g.setAttribute('in_COLOR0',new T.Float32BufferAttribute(Array(16).fill(1),4));return g;
  }
  function prepareCustomGeometry(g,layout){
    const uv=g.getAttribute('in_TEXCOORD0');
    if(!uv||uv.itemSize!==2)throw Error('Native custom stream needs two-component source UV');
    const original=uv.array.slice();
    for(let channel=0;channel<8;channel++)g.deleteAttribute('in_TEXCOORD'+channel);
    layout.dimensions.forEach((width,channel)=>g.setAttribute('in_TEXCOORD'+channel,
      new T.Float32BufferAttribute(new Float32Array(uv.count*width),width)));
    return original;
  }
  function samplePose(t,clip,trajectory){
    const state=pose.sample(t,clip);
    if(trajectory){const offset=trajectory.sample(t);for(const n of state.nodes.values())if(!n.parent)n.position=n.position.map((v,i)=>v+offset[i]);}
    return state;
  }
  function updateTrailGeometry(g,data){
    if(g.getAttribute('position').array.length!==data.positions.length){
      // Release old GPU buffers before resizing; equal-size scrubs reuse them.
      g.dispose();
      g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('in_POSITION0',g.getAttribute('position'));
      g.setAttribute('in_COLOR0',new T.Float32BufferAttribute(data.colors,4));g.setAttribute('in_TEXCOORD0',new T.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices);
    }else{
      for(const [name,values]of [['position',data.positions],['in_COLOR0',data.colors],['in_TEXCOORD0',data.uvs]]){
        const attribute=g.getAttribute(name);attribute.array.set(values);attribute.needsUpdate=true;
      }
    }
    if(data.indices.length){g.computeBoundingBox();g.computeBoundingSphere();}
    else{g.boundingBox?.makeEmpty();if(g.boundingSphere)g.boundingSphere.radius=0;}
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
  function particleMatrices(frame,mode){
    const scale=mode===0?frame.scale:mode===1?frame.localScale:new T.Vector3(1,1,1);
    const birth=new T.Matrix4().compose(frame.position,frame.rotation,mode===2?frame.scale:scale);
    const movement=mode===2?new T.Matrix4().compose(frame.position,frame.rotation,new T.Vector3(1,1,1)):birth;
    return {birth,movement,scale};
  }

  function update(clock,{camera,clip=null,trajectory=null}={}){
    assertOpen();
    if(!Number.isFinite(clock)||clock<0)throw Error('Invalid native effect clock');
    if(!camera?.isCamera)throw Error('Native effect update needs its render camera');
    // Native World-space emission/noise must stay in source coordinates. A
    // stage caller needs an explicit camera bridge, not a silent group transform
    // that would convert finished particle paths but sample the wrong field.
    group.updateWorldMatrix(true,false);
    if(group.matrixWorld.elements.some((v,i)=>!Number.isFinite(v)||Math.abs(v-(i%5===0?1:0))>1e-12))
      throw Error('Native effect group must remain in original coordinate space');
    const state=samplePose(clock,clip,trajectory);
    for(const [id,n] of state.nodes){const o=nodeObjects.get(id);o.position.fromArray(n.position);o.scale.fromArray(n.scale);
      if(n.euler)o.quaternion.setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY'));else o.quaternion.fromArray(n.rotation);
      o.visible=n.visible;
    }
    group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const birthStates=new Map();
    for(const entry of draws){
      const {component,mesh,emitter,trail,pool,baseColors,baseUVs,transform,particleSource,alignment}=entry;
      if(trail){
        const history=trajectory?trajectory.times(clock).map(t=>{
          if(!birthStates.has(t))birthStates.set(t,samplePose(t,clip,trajectory));
          const s=birthStates.get(t);return {time:t,position:particleFrame(transform,s).position.toArray(),emitting:s.nodes.get(transform).visible};
        }):[];
        const data=trail.sample(clock,history,camera.position.toArray());entry.trailData=data;
        const g=mesh.geometry,inverse=new T.Matrix4().copy(mesh.parent.matrixWorld).invert();
        mesh.visible=data.indices.length>0&&mesh.parent.matrixWorld.determinant()!==0;
        mesh.matrixAutoUpdate=false;mesh.matrix.copy(inverse);mesh.matrixWorldNeedsUpdate=true;
        updateTrailGeometry(g,data);
      }
      if(emitter){
        const current=particleFrame(transform,state);
        const {birth:frame,movement,scale}=particleMatrices(current,particleSource.scalingMode);
        const frameAt=t=>{
          // Prewarm predates the recorded path: retain the explicit start pose.
          t=Math.max(0,t);if(!birthStates.has(t))birthStates.set(t,samplePose(t,clip,trajectory));
          const matrices=particleMatrices(particleFrame(transform,birthStates.get(t)),particleSource.scalingMode);
          return {birth:matrices.birth.elements,movement:matrices.movement.elements};
        };
        const history=(trajectory?trajectory.times(Math.max(0,clock)):[0]).map(t=>{
          if(!birthStates.has(t))birthStates.set(t,samplePose(t,clip,trajectory));
          return {time:t,position:particleFrame(transform,birthStates.get(t)).position.toArray()};
        });
        const particles=emitter.sample(clock,{frameAt,history});
        entry.lastParticles=particles;
        const inverse=new T.Matrix4().copy(mesh.parent.matrixWorld).invert();
        while(pool.length<particles.length){const clone=mesh.clone();clone.geometry=mesh.geometry.clone();geometries.add(clone.geometry);clone.onBeforeRender=mesh.onBeforeRender;mesh.parent.add(clone);pool.push(clone);}
        pool.forEach((part,i)=>{
          const particle=particles[i];part.visible=!!particle&&mesh.parent.matrixWorld.determinant()!==0;
          if(!particle)return;
          let position=current.position.clone();
          if(particle.position){
            let born=frame;
            if(particle.simulationSpace==='world'){
              // Prewarm precedes visible playback: hold the source start pose
              // before time zero rather than looping a clip into the past.
              born=new T.Matrix4().fromArray(frameAt(particle.birthTime).birth);
            }
            position.fromArray(particleWorldPosition(particle,born.elements,frame.elements,movement.elements));
          }
          // A stage camera bridge can contain the Y/Z reflection. A quaternion
          // cannot represent that basis; retain its columns for view quads.
          const rotation=new T.Matrix4().makeRotationZ(particle.rotation);
          const matrix=alignment===0?new T.Matrix4().copy(camera.matrixWorld)
            :new T.Matrix4().makeRotationFromQuaternion(current.rotation);
          matrix.setPosition(position).multiply(rotation).scale(new T.Vector3().fromArray(particle.size).multiply(scale));
          part.matrixAutoUpdate=false;part.matrix.copy(inverse).multiply(matrix);part.matrixWorldNeedsUpdate=true;
          const colors=part.geometry.getAttribute('in_COLOR0');
          for(let j=0;j<baseColors.length;j++)colors.array[j]=baseColors[j]*particle.color[j%4];
          colors.needsUpdate=true;
          if(entry.customLayout){
            const values=particle.sheet&&(particle.sheet.mask&1)?particleSheetUV(entry.customUVs,particle.sheet):entry.customUVs;
            for(let vertex=0;vertex<values.length/2;vertex++){
              const packed=entry.customLayout.sample([values[vertex*2],values[vertex*2+1]],
                particle.customData??[[0,0,0,0],[0,0,0,0]]);
              packed.forEach((value,channel)=>part.geometry.getAttribute('in_TEXCOORD'+channel).array.set(value,vertex*value.length));
            }
            entry.customLayout.dimensions.forEach((_,channel)=>part.geometry.getAttribute('in_TEXCOORD'+channel).needsUpdate=true);
          }else baseUVs.forEach((values,channel)=>{
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

  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
    materials.clear();geometries.clear();nodeObjects.clear();group.clear();
    library.unregister(instance);
  }
  const periods=[...pose.nodes.values()].flatMap(n=>(pack.records[n.gameObject].references??[])
    .map(r=>pack.records[r.target]).filter(r=>r?.type==='ParticleSystem').map(r=>r.data.lengthInSec*2));
  const timeWindow=Math.max(3,...periods,...pose.instances.map(i=>animations.clips[i.clip].stop));
  const instance={name,pose,group,draws,blocked,timeWindow,update,dispose,get disposed(){return disposed;}};
  library.register(instance);
  try{
    for(const [id,n] of pose.nodes){const o=new T.Group();nodeObjects.set(id,o);(n.parent?nodeObjects.get(n.parent):group).add(o);}
    for(const [component,r] of pose.renderers){
      const record=pack.records[component];if(!r.enabled)continue;
      const beforeGeometry=new Set(geometries),beforeMaterial=new Set(materials);
      try{
        assertOpen();
        if(record.type!=='ParticleSystemRenderer'&&r.materials.length!==1)
          throw Error('Native multi-material renderer needs review');
        let meshId,particleSource,emitter,trail,billboard=false,customLayout=null;
        if(record.type==='MeshRenderer'){
          const go=pack.records[r.gameObject];const filter=(go.references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='MeshFilter');
          meshId=target(filter,'m_Mesh');
        }else if(record.type==='ParticleSystemRenderer'){
          if(![0,4].includes(record.data.m_RenderMode)||![0,2].includes(record.data.m_RenderAlignment)||record.data.m_RenderMode===4&&record.data.m_RenderAlignment!==2)throw Error('Particle alignment/render mode not playing');
          if(Object.values(record.data.m_Pivot).some(v=>v!==0)||Object.values(record.data.m_Flip).some(v=>v!==0))throw Error('Particle pivot/flip need review');
          if(record.data.m_UseCustomVertexStreams)customLayout=createParticleVertexLayout(record.data.m_VertexStreams);
          const ps=(pack.records[r.gameObject].references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='ParticleSystem');
          particleSource=pack.records[ps].data;
          // The recovered particle renderers repeat the same material slot and
          // have their own TrailModule disabled. Different slots or particle-
          // generated trails need a renderer mapping, not silent first-slot use.
          if(particleSource.TrailModule?.enabled||r.materials.some(m=>m?.id!==r.materials[0]?.id))
            throw Error('Native particle trail/multi-material renderer needs review');
          const moving=['ShapeModule','VelocityModule','UVModule','ClampVelocityModule','NoiseModule'].some(k=>particleSource[k]?.enabled)||particleSource.moveWithTransform===1;
          emitter=moving?createMovingParticles(particleSource):createStationaryParticles(particleSource);
          if(![0,1,2].includes(particleSource.scalingMode))throw Error('Native particle scaling mode needs review');
          if(particleSource.moveWithTransform===1){
            const ancestors=new Set();let n=r.transform;while(n){const d=pose.nodes.get(n);ancestors.add(d.gameObject);n=d.parent;}
            if(pose.instances.some(i=>i.bindings.some(b=>ancestors.has(b.gameObject)&&['m_LocalRotation','localEulerAnglesRaw','m_LocalScale'].includes(b.property))))throw Error('Animated world particle velocity frame needs integration');
          }
          billboard=record.data.m_RenderMode===0;
          if(!billboard)meshId=target(component,'m_Mesh');
        }else if(record.type==='TrailRenderer'){
          if(r.materials.length!==1)throw Error('Native multi-material trail needs review');
          trail=createEffectTrail(record.data);
        }
        else throw Error('Native renderer needs review');
        const mat=r.materials[0];if(!mat)throw Error('Unresolved original material');
        const material=await makeMaterial(component,mat.id);assertOpen();
        const g=trail?new T.BufferGeometry():billboard?billboardGeometry():geometry(meshId);
        if(trail){geometries.add(g);g.setAttribute('position',new T.Float32BufferAttribute([],3));g.setAttribute('in_POSITION0',g.getAttribute('position'));g.setAttribute('in_COLOR0',new T.Float32BufferAttribute([],4));g.setAttribute('in_TEXCOORD0',new T.Float32BufferAttribute([],2));}
        if(particleSource?.UVModule?.enabled){
          if(customLayout&&particleSource.UVModule.uvChannelMask!==1)throw Error('Custom particle sheet must address the original UV stream only');
          if(Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)).some(a=>a&&a.itemSize!==2))throw Error('Native multidimensional particle UV stream needs review');
        }
        const customUVs=customLayout?prepareCustomGeometry(g,customLayout):null;
        const mesh=new T.Mesh(g,material);
        mesh.renderOrder=record.data.m_SortingOrder??0;
        if(particleSource){const d=particleSource.InitialModule,x=sampleParticleCurve(d.startSize,0);
          mesh.scale.fromArray(d.size3D?[x,sampleParticleCurve(d.startSizeY,0),sampleParticleCurve(d.startSizeZ,0)]:[x,x,x]);}

        nodeObjects.get(r.transform).add(mesh);draws.push({component,transform:r.transform,particleSource,trail,alignment:record.data.m_RenderAlignment,mesh,emitter,pool:emitter?[mesh]:null,
          baseColors:emitter?g.getAttribute('in_COLOR0').array.slice():null,
          baseUVs:emitter?Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)?.array.slice()??null):null,
          customLayout,customUVs});
        const sourceSide=material.side;
        mesh.onBeforeRender=function(_renderer,_scene,camera){
          const u=material.uniforms,matrix=this.matrixWorld;
          if(!matrix.elements.every(Number.isFinite))throw Error('Invalid source particle matrix '+component);
          if(!camera.matrixWorldInverse.elements.every(Number.isFinite))throw Error('Invalid effect inspection camera');
          if(u.hlslcc_mtx4x4unity_ObjectToWorld)u.hlslcc_mtx4x4unity_ObjectToWorld.value.set(matrix.elements);
          if(u.hlslcc_mtx4x4unity_WorldToObject)u.hlslcc_mtx4x4unity_WorldToObject.value.set(new T.Matrix4().copy(matrix).invert().elements);
          if(u.hlslcc_mtx4x4unity_MatrixVP)u.hlslcc_mtx4x4unity_MatrixVP.value.set(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements);
          // Three accounts for reflected objects, but not a reflected camera.
          // Keep the source face test when the board/source camera swaps Y/Z.
          material.side=camera.matrixWorld.determinant()<0&&sourceSide!==T.DoubleSide
            ?sourceSide===T.FrontSide?T.BackSide:T.FrontSide:sourceSide;
          u._WorldSpaceCameraPos?.value.copy(camera.position);material.uniformsNeedUpdate=true;
        };
      }catch(e){
        for(const g of geometries)if(!beforeGeometry.has(g)){g.dispose();geometries.delete(g);}
        for(const m of materials)if(!beforeMaterial.has(m)){m.dispose();materials.delete(m);}
        assertOpen();blocked.push({component,name:pack.records[r.gameObject].data.m_Name,reason:e.message});}
    }

    assertOpen();
    if(blocked.length&&!allowBlocked)throw Error('Original effect has unplayed components: '+blocked.map(b=>b.name+': '+b.reason).join('; '));
    return instance;
  }catch(error){dispose();throw error;}
}
