// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleEffectClip} from './native-effect-animation.js';

// An explicit clip inspection pose, not an implementation of Unity Animator
// state transitions. All properties reset before sampling, so reverse scrubbing
// and changing clips cannot retain changes from a previous inspection frame.
export function createEffectPose(pack, animations, rootName) {
  const records=pack.records, root=pack.roots[rootName];
  if (!root) throw new Error('Unknown original effect root');
  const refs=(id,field)=>(records[id].references??[]).filter(r=>r.field===field).map(r=>r.target);
  const one=(id,field)=>{
    const r=refs(id,field);if(r.length!==1||!r[0])throw new Error('Missing original effect hierarchy reference');
    return r[0];
  };
  const nodes=new Map(), renderers=new Map(), visited=new Set();
  function walk(go,parent=null) {
    if(visited.has(go))throw new Error('Ambiguous original effect hierarchy');
    visited.add(go);
    const components=refs(go,'component'), tr=components.filter(k=>records[k]?.type==='Transform');
    if(tr.length!==1)throw new Error('Missing original effect transform');
    const d=records[tr[0]].data;
    nodes.set(tr[0],{gameObject:go, parent, name:records[go].data.m_Name,
      position:['x','y','z'].map(k=>d.m_LocalPosition[k]),
      rotation:['x','y','z','w'].map(k=>d.m_LocalRotation[k]),
      scale:['x','y','z'].map(k=>d.m_LocalScale[k]), active:records[go].data.m_IsActive});
    for(const component of components)if(['MeshRenderer','ParticleSystemRenderer','TrailRenderer'].includes(records[component]?.type)){
      const r=records[component];
      renderers.set(component,{gameObject:go, transform:tr[0], enabled:r.data.m_Enabled,
        materials:refs(component,'m_Materials').map(id=>id?{id,properties:materialProperties(records[id].data)}:null)});
    }
    for(const child of refs(tr[0],'m_Children'))walk(one(child,'m_GameObject'),tr[0]);
  }
  walk(root);
  const instances=animations.instances.filter(i=>visited.has(one(i.animator,'m_GameObject')));
  const baseNodes=structuredClone(nodes), baseRenderers=structuredClone(renderers);
  function sample(time, clipId=null) {
    const currentNodes=structuredClone(baseNodes), currentRenderers=structuredClone(baseRenderers);
    if(clipId!==null){
      if(!instances.some(i=>i.clip===clipId))throw new Error('Clip is outside the selected original effect');
      const clip=animations.clips[clipId], values=sampleEffectClip(clip,time);
      for(const instance of instances.filter(i=>i.clip===clipId))for(const [index,target] of instance.bindings.entries()){
        const binding=clip.bindings[index], v=values.slice(binding.offset,binding.offset+binding.size);
        const node=[...currentNodes.values()].find(n=>n.gameObject===target.gameObject);
        if(!node)throw new Error('Animated node is outside the selected hierarchy');
        switch(target.property){
          case 'm_LocalPosition':node.position=v;break;
          case 'm_LocalRotation':node.rotation=v;delete node.euler;break;
          case 'm_LocalScale':node.scale=v;break;
          case 'localEulerAnglesRaw':node.euler=v;break;
          case 'm_IsActive':node.active=v[0]!==0;break;
          default:{
            const renderer=currentRenderers.get(target.component);
            if(!renderer)throw new Error('Missing original animated renderer');
            const match=/^material\.([\w]+)(?:\.([rgbaxyzw]))?$/.exec(target.property);
            if(!match||binding.size!==1)throw new Error('Unsupported resolved material binding');
            const [,name,channel]=match;
            // Unity material animation applies to the renderer's instantiated
            // material. Each renderer owns its copies; shared native material
            // identity must not cause unrelated effect instances to change.
            const first=renderer.materials[0];
            if(!first||!Object.hasOwn(first.properties,name))throw new Error('Missing animated source material property');
            if(channel){
              const slot='rgba'.includes(channel)?'rgba'.indexOf(channel):'xyzw'.indexOf(channel);
              if(!Array.isArray(first.properties[name])||slot>=first.properties[name].length)throw new Error('Invalid material component');
              first.properties[name][slot]=v[0];
            }else first.properties[name]=v[0];
          }
        }
      }
    }
    for(const node of currentNodes.values())node.visible=node.active && (node.parent===null||currentNodes.get(node.parent).visible);
    return {nodes:currentNodes, renderers:currentRenderers};
  }
  return {rootName,nodes,renderers,instances,sample};
}

export function materialProperties(data) {
  const saved=data.m_SavedProperties, properties=Object.fromEntries(saved.m_Floats);
  for(const [name,color] of saved.m_Colors)properties[name]=['r','g','b','a'].map(k=>color[k]);
  for(const [name,tex] of saved.m_TexEnvs)properties[name+'_ST']=[tex.m_Scale.x,tex.m_Scale.y,tex.m_Offset.x,tex.m_Offset.y];
  return properties;
}
