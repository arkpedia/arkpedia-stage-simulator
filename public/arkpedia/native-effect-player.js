// SPDX-License-Identifier: GPL-3.0-or-later
// Original-source player shared by inspection and future battle presentation.
// It owns no renderer, DOM, combat clock, camera framing or Animator FSM.
import {webglEffectProgram,selectEffectProgram,effectUniformDeclarations} from '../../shared/arkpedia/native-effect-shader.js';
import {createStationaryParticles} from '../../shared/arkpedia/native-stationary-particles.js';
import {createMovingParticles} from '../../shared/arkpedia/native-moving-particles.js';
import {createParentParticleMotion} from '../../shared/arkpedia/native-parent-particle-motion.js';
import {createBuiltinMeshResolver} from '../../shared/arkpedia/native-builtin-mesh.js';
import {createParticlePivot} from '../../shared/arkpedia/native-particle-pivot.js';
import {createTextureRotations} from '../../shared/arkpedia/native-texture-rotation.js';
import {createParticleStretch,particleWorldVelocity} from '../../shared/arkpedia/native-particle-stretch.js';
import {createParticleTrails} from '../../shared/arkpedia/native-particle-trails.js';
import {particleWorldPosition,particleSheetUV} from '../../shared/arkpedia/native-particle-render.js';
import {sampleParticleCurve} from '../../shared/arkpedia/native-particle-curves.js';
import {effectMeshColors} from '../../shared/arkpedia/native-effect-mesh.js';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {createEffectTrail} from '../../shared/arkpedia/native-effect-trail.js';
import {createParticleVertexLayout} from '../../shared/arkpedia/native-particle-custom-data.js';
import {createSubEmitterGraph} from '../../shared/arkpedia/native-sub-emitter-graph.js';
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
export function createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture,builtinMeshes=null}){
  if(!T||typeof loadTexture!=='function')throw Error('Native effect library needs Three and an original texture loader');
  const builtin=builtinMeshes?createBuiltinMeshResolver(builtinMeshes,animations.sourcePackSha256):null;
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

  const context={three:T,pack,animations,shaders,builtin,sourceTexture,assertOpen,
    register(instance){assertOpen();instances.add(instance);},unregister(instance){instances.delete(instance);}};
  const library={
    create(name,options){assertOpen();return createNativeEffectInstance(context,name,options);},
    inspectParticle(id,options){
      assertOpen();const record=pack.records[id];
      if(record?.type!=='ParticleSystem')throw Error('Unknown original particle inspection source');
      const go=(record.references??[]).find(r=>r.field==='m_GameObject')?.target;
      if(pack.records[go]?.type!=='GameObject')throw Error('Missing original particle inspection object');
      // Address the existing original object as an explicit isolated inspection
      // root. No source record or missing resource is replaced. The production
      // effect's parent relationships remain blocked until dispatch is playing.
      const name='particle-inspection:'+id;
      return createNativeEffectInstance({...context,pack:{...pack,roots:{...pack.roots,[name]:go}},inspectionSource:id},name,options);
    },
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
  const subEmitters=createSubEmitterGraph(pack);
  const particleTransforms=new Map();
  for(const[id,n]of pose.nodes)for(const ref of pack.records[n.gameObject].references??[])
    if(pack.records[ref.target]?.type==='ParticleSystem')particleTransforms.set(ref.target,id);
  let activeClip=null,activeTrajectory=null;
  const sourceFrameAt=(id,t)=>{
    const transform=particleTransforms.get(id);if(!transform)throw Error('Parent particle transform is outside original source root');
    const state=samplePose(Math.max(0,t),activeClip,activeTrajectory);
    const frame=particleMatrices(particleFrame(transform,state),pack.records[id].data.scalingMode);
    return{birth:frame.birth.elements,movement:frame.movement.elements};
  };
  const parentMotion=createParentParticleMotion(pack,{parentIds:[...particleTransforms.keys()].filter(id=>pack.records[id].data.SubModule?.enabled),frameAt:sourceFrameAt});
  const draws=[],blocked=[],geometries=new Set(),materials=new Set(),nodeObjects=new Map();
  let disposed=false;
  const assertOpen=()=>{library.assertOpen();if(disposed)throw Error('Native effect instance is disposed');};
  const refs=(id,field)=>(pack.records[id].references??[]).filter(r=>r.field===field);
  const target=(id,field)=>refs(id,field)[0]?.target;
  const factor=value=>({0:T.ZeroFactor,1:T.OneFactor,2:T.DstColorFactor,3:T.SrcColorFactor,4:T.OneMinusDstColorFactor,
    5:T.SrcAlphaFactor,6:T.OneMinusSrcColorFactor,7:T.DstAlphaFactor,8:T.OneMinusDstAlphaFactor,9:T.SrcAlphaSaturateFactor,10:T.OneMinusSrcAlphaFactor})[value];
  function stateValue(v,props){if(v.name.startsWith('_')){if(!Object.hasOwn(props,v.name))throw Error('Missing native pass property');return props[v.name];}return v.val;}
  async function makeMaterial(component,material,slot=0){
    const data=pack.records[material].data,shader=shaders.shaders[target(material,'m_Shader')];
    if(!shader||shader.passes.length!==1)throw Error('Unsupported native multipass shader');
    const source=selectEffectProgram(shader,data.m_ValidKeywords),port=webglEffectProgram(source.source),props=pose.renderers.get(component).materials[slot].properties;
    const uniforms={};
    const declarations=effectUniformDeclarations(port);
    const rotations=createTextureRotations(pack,component,declarations,animations);
    for(const {type,name,count:size} of declarations){
      if(size){if(type!=='vec4'||size!==4||!name.startsWith('hlslcc_mtx4x4'))throw Error('Unsupported native uniform array');uniforms[name]={value:new Float32Array(16)};continue;}
      if(type==='sampler2D'){uniforms[name]={value:await sourceTexture(material,name,shader)};continue;}
      if(name==='_WorldSpaceCameraPos'){uniforms[name]={value:new T.Vector3()};continue;}
      if(name==='_Time'||name==='_SinTime'||name==='_CosTime'){uniforms[name]={value:new T.Vector4()};continue;}
      let value=props[name];
      if(rotations&&Object.hasOwn(rotations.values,name)){
        if(value!==undefined)throw Error('Conflicting source material/script texture rotation');
        value=rotations.values[name];
      }
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
    if(rotations)m.userData.textureRotations=rotations;
    materials.add(m);return m;
  }
  function geometry(id,color=null,referenceSource=null){
    const d=pack.meshes[id]??(library.builtin&&referenceSource?library.builtin.resolve(referenceSource,refs(referenceSource,'m_Mesh')[0]):null);
    if(!d)throw Error('Unresolved original mesh');
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
    const index=g.index?.array,indexChanged=!index||index.length!==data.indices.length||index.some((v,i)=>v!==data.indices[i]);
    if(g.getAttribute('position').array.length!==data.positions.length||indexChanged){
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

  function update(clock,{camera,clip=null,trajectory=null,scheduledParticles=null}={}){
    assertOpen();
    if(!Number.isFinite(clock)||clock<0)throw Error('Invalid native effect clock');
    if(!camera?.isCamera)throw Error('Native effect update needs its render camera');
    // External parent motion is allowed only in isolated source inspection.
    // It must never bypass the full effect's unsupported parent dispatch.
    if(scheduledParticles&&(!library.inspectionSource||!Array.isArray(scheduledParticles.records)
      ||['frameAt','emitterVelocityAt','worldPosition'].some(k=>typeof scheduledParticles.frames?.[k]!=='function')))
      throw Error('Scheduled particles require isolated inspection and explicit child frames');
    // Native World-space emission/noise must stay in source coordinates. A
    // stage caller needs an explicit camera bridge, not a silent group transform
    // that would convert finished particle paths but sample the wrong field.
    group.updateWorldMatrix(true,false);
    if(group.matrixWorld.elements.some((v,i)=>!Number.isFinite(v)||Math.abs(v-(i%5===0?1:0))>1e-12))
      throw Error('Native effect group must remain in original coordinate space');
    activeClip=clip;activeTrajectory=trajectory;
    const state=samplePose(clock,clip,trajectory);
    for(const [id,n] of state.nodes){const o=nodeObjects.get(id);o.position.fromArray(n.position);o.scale.fromArray(n.scale);
      if(n.euler)o.quaternion.setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY'));else o.quaternion.fromArray(n.rotation);
      o.visible=n.visible;
    }
    group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const birthStates=new Map();
    for(const entry of draws){
      const {component,mesh,emitter,trail,pool,baseColors,baseUVs,transform,particleSource,alignment,stretch}=entry;
      if(trail){
        const history=trajectory?trajectory.times(clock).map(t=>{
          if(!birthStates.has(t))birthStates.set(t,samplePose(t,clip,trajectory));
          const s=birthStates.get(t);return {time:t,position:particleFrame(transform,s).position.toArray(),emitting:s.nodes.get(transform).visible};
        }):[];
        const data=trail.sample(clock,history,new T.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray());entry.trailData=data;
        const g=mesh.geometry,inverse=new T.Matrix4().copy(mesh.parent.matrixWorld).invert();
        mesh.visible=data.indices.length>0&&mesh.parent.matrixWorld.determinant()!==0;
        mesh.matrixAutoUpdate=false;mesh.matrix.copy(inverse);mesh.matrixWorldNeedsUpdate=true;
        updateTrailGeometry(g,data);
      }
      if(entry.particleTrails){
        const owner=entry.sourceEntry,current=particleFrame(transform,state),frame=particleMatrices(current,owner.particleSource.scalingMode);
        const data=owner.emitter.withTrailHistory(replay=>entry.particleTrails.sample(clock,owner.emitter.births(clock),{
          stateAt(t,birth){return replay([{...birth,age:Math.max(0,(t-birth.birthTime)*owner.particleSource.simulationSpeed)}],t)[0];},
          project(p){return particleWorldPosition(p,frame.birth.elements,frame.birth.elements,frame.movement.elements);},
          camera:new T.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),widthScale:Math.abs(frame.scale.x)
        }));
        entry.trailData=data;const collapsed=mesh.parent.matrixWorld.determinant()===0;
        mesh.visible=data.indices.length>0&&!collapsed;mesh.matrixAutoUpdate=false;
        mesh.matrix.copy(collapsed?new T.Matrix4():new T.Matrix4().copy(mesh.parent.matrixWorld).invert());mesh.matrixWorldNeedsUpdate=true;
        updateTrailGeometry(mesh.geometry,data);
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
        const emitterVelocityAt=t=>{
          // Explicit local 60 Hz backward Transform difference in real effect
          // seconds. Native velocity acquisition/frame timing is unverified.
          if(t<=0)return [0,0,0];
          const from=Math.max(0,t-1/60),a=frameAt(from).birth,b=frameAt(t).birth;
          return [0,1,2].map(i=>(b[12+i]-a[12+i])/(t-from));
        };
        const history=(trajectory?trajectory.times(Math.max(0,clock)):[0]).map(t=>{
          if(!birthStates.has(t))birthStates.set(t,samplePose(t,clip,trajectory));
          return {time:t,position:particleFrame(transform,birthStates.get(t)).position.toArray()};
        });
        const dispatch=subEmitters.parents(entry.particleId).length&&library.inspectionSource!==entry.particleId&&parentMotion.ready(entry.particleId);
        const scheduled=scheduledParticles&&entry.particleId===library.inspectionSource?scheduledParticles:dispatch
          ?{records:parentMotion.records(entry.particleId,clock),frames:parentMotion.childFrames(entry.particleId,sourceFrameAt)}:null;
        const particles=scheduled?emitter.sampleRecords(scheduled.records,clock,scheduled.frames):emitter.sample(clock,{frameAt,history,emitterVelocityAt});
        entry.lastParticles=particles;
        const worldAt=(t,p)=>{
          const age=Math.max(0,(t-p.birthTime)*particleSource.simulationSpeed);
          const sampled=emitter.sampleRecords([{...p,age}],t,scheduled?scheduled.frames:{frameAt,emitterVelocityAt})[0];
          if(scheduled)return scheduled.frames.worldPosition(sampled,t);
          const at=frameAt(t),born=frameAt(p.birthTime);
          if(!sampled.position)return [at.birth[12],at.birth[13],at.birth[14]];
          return particleWorldPosition(sampled,born.birth,at.birth,at.movement);
        };
        const parentCollapsed=mesh.parent.matrixWorld.determinant()===0;
        const inverse=parentCollapsed?new T.Matrix4():new T.Matrix4().copy(mesh.parent.matrixWorld).invert();
        while(pool.length<particles.length){const clone=mesh.clone();clone.geometry=mesh.geometry.clone();geometries.add(clone.geometry);clone.onBeforeRender=mesh.onBeforeRender;mesh.parent.add(clone);pool.push(clone);}
        pool.forEach((part,i)=>{
          const particle=particles[i];part.visible=!!particle&&!parentCollapsed;
          if(!particle)return;
          if(parentCollapsed){
            // Keep the existing collapsed-parent hold without an all-zero
            // inverse matrix (w=0), which corrupts Three's CPU bounds.
            part.matrixAutoUpdate=false;part.matrix.identity();part.matrixWorldNeedsUpdate=true;return;
          }
          let position=current.position.clone();
          if(scheduled){
            const positioned=particle.position?particle:{...particle,origin:[0,0,0],displacement:[0,0,0],velocitySpace:'local',simulationSpace:particleSource.moveWithTransform===1?'world':'local'};
            position.fromArray(scheduled.frames.worldPosition(positioned,clock));
            if(!position.toArray().every(Number.isFinite))throw Error('Invalid scheduled child world position');
          }else if(particle.position){
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
          // Unity applies Z then X then Y around fixed axes; Three's intrinsic
          // Euler order is reversed to produce the same matrix product.
          const rotation=particle.rotation3D
            ?new T.Matrix4().makeRotationFromEuler(new T.Euler(...particle.rotation3D,'YXZ'))
            :new T.Matrix4().makeRotationZ(particle.rotation);
          let matrix=alignment===0?new T.Matrix4().copy(camera.matrixWorld)
            :new T.Matrix4().makeRotationFromQuaternion(current.rotation);
          if(stretch){
            const timed={...particle,birthTime:particle.birthTime??clock-particle.age/particleSource.simulationSpeed};
            const velocity=particleWorldVelocity(timed,clock,worldAt,particleSource.simulationSpeed);
            const stretched=stretch.sample({position:position.toArray(),velocity,size:new T.Vector3().fromArray(particle.size).multiply(scale).toArray(),cameraPosition:new T.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),rotation:particle.rotation});
            if(!stretched){part.visible=false;part.matrixAutoUpdate=false;part.matrix.identity();part.matrixWorldNeedsUpdate=true;return;}
            matrix.fromArray(stretched);
          }else matrix.setPosition(position).multiply(rotation).scale(new T.Vector3().fromArray(particle.size).multiply(scale));
          matrix.fromArray(entry.pivot.sample(matrix.elements));
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
      const p=state.renderers.get(component).materials[entry.materialSlot??0].properties,u=mesh.material.uniforms;
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
    for(const entry of draws)entry.emitter?.clearTrailHistoryCache?.();
    for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
    materials.clear();geometries.clear();nodeObjects.clear();group.clear();
    library.unregister(instance);
  }
  const periods=[...pose.nodes.values()].flatMap(n=>(pack.records[n.gameObject].references??[])
    .map(r=>pack.records[r.target]).filter(r=>r?.type==='ParticleSystem').map(r=>r.data.lengthInSec*2));
  const timeWindow=Math.max(3,...periods,...pose.instances.map(i=>animations.clips[i.clip].stop));
  const inspection=library.inspectionSource?{particle:library.inspectionSource,parents:subEmitters.parents(library.inspectionSource),fullEffect:false}:null;
  const instance={name,pose,group,draws,blocked,timeWindow,inspection,parentMotion,update,dispose,get disposed(){return disposed;}};
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
        let meshId,meshReferenceSource,particleId,particleSource,emitter,trail,pivot,particleTrails=null,stretch=null,billboard=false,customLayout=null;
        if(record.type==='MeshRenderer'){
          const go=pack.records[r.gameObject];const filter=(go.references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='MeshFilter');
          meshId=target(filter,'m_Mesh');
          meshReferenceSource=filter;
        }else if(record.type==='ParticleSystemRenderer'){
          if(record.data.m_RenderMode===1)stretch=createParticleStretch(record.data);
          else if(![0,4].includes(record.data.m_RenderMode)||![0,2].includes(record.data.m_RenderAlignment)||record.data.m_RenderMode===4&&record.data.m_RenderAlignment!==2)throw Error('Particle alignment/render mode not playing');
          pivot=createParticlePivot(record.data,{stretch});
          if(record.data.m_UseCustomVertexStreams)customLayout=createParticleVertexLayout(record.data.m_VertexStreams);
          const ps=(pack.records[r.gameObject].references??[]).map(r=>r.target).find(k=>pack.records[k]?.type==='ParticleSystem');
          particleId=ps;
          particleSource=pack.records[ps].data;
          if(subEmitters.parents(ps).length&&library.inspectionSource!==ps&&!parentMotion.ready(ps))
            throw Error('Original sub-emitter parent dispatch not playing');
          if((particleSource.InitialModule.rotation3D||particleSource.RotationModule?.enabled&&particleSource.RotationModule.separateAxes)&&record.data.m_RenderMode!==4)
            throw Error('Native 3D billboard start rotation needs review');
          if(particleSource.TrailModule?.enabled){
            particleTrails=createParticleTrails(particleSource);
            if(r.materials.length!==2||!r.materials[1]||record.data.m_UseCustomVertexStreams)
              throw Error('Native particle trail material/vertex stream needs review');
          }else if(r.materials.some(m=>m?.id!==r.materials[0]?.id))
            throw Error('Native particle trail/multi-material renderer needs review');
          const moving=['ShapeModule','VelocityModule','UVModule','ClampVelocityModule','NoiseModule','InheritVelocityModule','ForceModule'].some(k=>particleSource[k]?.enabled)||particleSource.moveWithTransform===1;
          emitter=moving?createMovingParticles(particleSource,{particleTrails,subEmitterSchedule:parentMotion.parentReady(ps)?parentMotion.schedule:null}):createStationaryParticles(particleSource);
          if(![0,1,2].includes(particleSource.scalingMode))throw Error('Native particle scaling mode needs review');
          if(particleSource.moveWithTransform===1&&!emitter.worldMotion){
            const ancestors=new Set();let n=r.transform;while(n){const d=pose.nodes.get(n);ancestors.add(d.gameObject);n=d.parent;}
            if(pose.instances.some(i=>i.bindings.some(b=>ancestors.has(b.gameObject)&&['m_LocalRotation','localEulerAnglesRaw','m_LocalScale'].includes(b.property))))throw Error('Animated world particle velocity frame needs integration');
          }
          billboard=[0,1].includes(record.data.m_RenderMode);
          if(!billboard){meshId=target(component,'m_Mesh');meshReferenceSource=component;}
        }else if(record.type==='TrailRenderer'){
          if(r.materials.length!==1)throw Error('Native multi-material trail needs review');
          trail=createEffectTrail(record.data);
        }
        else throw Error('Native renderer needs review');
        const mat=r.materials[0];if(!mat)throw Error('Unresolved original material');
        const material=await makeMaterial(component,mat.id);assertOpen();
        let particleTrailMesh=null;
        if(particleTrails){
          const trailMaterial=await makeMaterial(component,r.materials[1].id,1);assertOpen();
          const trailGeometry=new T.BufferGeometry();geometries.add(trailGeometry);
          trailGeometry.setAttribute('position',new T.Float32BufferAttribute([],3));trailGeometry.setAttribute('in_POSITION0',trailGeometry.getAttribute('position'));
          trailGeometry.setAttribute('in_COLOR0',new T.Float32BufferAttribute([],4));trailGeometry.setAttribute('in_TEXCOORD0',new T.Float32BufferAttribute([],2));
          particleTrailMesh=new T.Mesh(trailGeometry,trailMaterial);particleTrailMesh.renderOrder=record.data.m_SortingOrder??0;
        }
        const g=trail?new T.BufferGeometry():billboard?billboardGeometry():geometry(meshId,null,meshReferenceSource);
        if(trail){geometries.add(g);g.setAttribute('position',new T.Float32BufferAttribute([],3));g.setAttribute('in_POSITION0',g.getAttribute('position'));g.setAttribute('in_COLOR0',new T.Float32BufferAttribute([],4));g.setAttribute('in_TEXCOORD0',new T.Float32BufferAttribute([],2));}
        if(particleSource?.UVModule?.enabled){
          // The admitted stream layouts have UV0 as their sole UV semantic.
          // Sheet masks address those logical UVs before packing; custom data
          // stored in TEXCOORD components is not another texture UV channel.
          if(customLayout&&(particleSource.UVModule.uvChannelMask< -1||particleSource.UVModule.uvChannelMask>255))throw Error('Invalid custom particle sheet mask');
          if(Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)).some(a=>a&&a.itemSize!==2))throw Error('Native multidimensional particle UV stream needs review');
        }
        const customUVs=customLayout?prepareCustomGeometry(g,customLayout):null;
        const mesh=new T.Mesh(g,material);
        mesh.renderOrder=record.data.m_SortingOrder??0;
        if(particleSource){const d=particleSource.InitialModule,x=sampleParticleCurve(d.startSize,0);
          mesh.scale.fromArray(d.size3D?[x,sampleParticleCurve(d.startSizeY,0),sampleParticleCurve(d.startSizeZ,0)]:[x,x,x]);}

        const sourceEntry={component,transform:r.transform,particleId,particleSource,trail,pivot,stretch,alignment:record.data.m_RenderAlignment,mesh,emitter,pool:emitter?[mesh]:null,
          baseColors:emitter?g.getAttribute('in_COLOR0').array.slice():null,
          baseUVs:emitter?Array.from({length:8},(_,i)=>g.getAttribute('in_TEXCOORD'+i)?.array.slice()??null):null,
          customLayout,customUVs};
        nodeObjects.get(r.transform).add(mesh);draws.push(sourceEntry);
        const bindMaterial=material=>{const sourceSide=material.side;return function(_renderer,_scene,camera){
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
          u._WorldSpaceCameraPos?.value.setFromMatrixPosition(camera.matrixWorld);material.uniformsNeedUpdate=true;
        };};
        mesh.onBeforeRender=bindMaterial(material);
        if(particleTrailMesh){
          particleTrailMesh.onBeforeRender=bindMaterial(particleTrailMesh.material);nodeObjects.get(r.transform).add(particleTrailMesh);
          draws.push({component,transform:r.transform,mesh:particleTrailMesh,particleTrails,sourceEntry,materialSlot:1});
        }
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
