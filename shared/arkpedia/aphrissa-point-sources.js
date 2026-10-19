// SPDX-License-Identifier: GPL-3.0-or-later
// Check original prefab/controller bindings. This does not execute native FSMs.
import {createEffectPose} from './native-effect-pose.js';
import {APHRISSA_BEAM_PACK,APHRISSA_BEAM_STYLES} from './aphrissa-beam-presentation.js';
export function validateAphrissaPointSources(pack,animations){
  const fail=()=>{throw Error('Changed original Aphrissa point-effect binding');},records=pack.records;
  if(animations.sourcePackSha256!==APHRISSA_BEAM_PACK)fail();
  const refs=(id,field)=>(records[id]?.references??[]).filter(r=>r.field===field).map(r=>r.target),
    styles=new Map(Object.values(APHRISSA_BEAM_STYLES).flatMap(s=>Object.values(s.points).map(p=>[p.root,p]))),result=[];
  for(const [root,style]of styles){
    const pose=createEffectPose(pack,animations,root),objects=new Set([...pose.nodes.values()].map(n=>n.gameObject)),
      components=[...objects].flatMap(go=>refs(go,'component')),
      drivers=components.filter(id=>records[id]?.type==='Animator'&&records[id].data.m_Enabled),
      fx=refs(pack.roots[root],'component').filter(id=>records[id]?.type==='MonoBehaviour'&&Object.hasOwn(records[id].data,'_isLoop'));
    if(fx.length!==1||drivers.length!==Number(style.clip!==null))fail();
    let controller=null,onEnd=null;
    if(drivers.length){
      const links=refs(drivers[0],'m_Controller');if(links.length!==1)fail();controller=links[0];
      const r=records[controller],c=r?.data.m_Controller,clips=refs(controller,'m_AnimationClips'),machines=c?.m_StateMachineArray,layers=c?.m_LayerArray,
        states=machines?.[0]?.data.m_StateConstantArray?.map(s=>s.data),names=new Map(r?.data.m_TOS??[]);
      if(r?.type!=='AnimatorController'||layers?.length!==1||layers[0].data.m_StateMachineIndex!==0
        ||machines?.length!==1||machines[0].data.m_DefaultState!==0||states?.length!==(style.end?2:1)
        ||machines[0].data.m_AnyStateTransitionConstantArray.length||r.data.m_StateMachineBehaviours.length)fail();
      for(const [index,expected]of [style.clip,style.end].filter(Boolean).entries()){
        const state=states[index],tree=state.m_BlendTreeConstantArray?.[0]?.data,nodes=tree?.m_NodeArray,
          clip=clips[index],native=animations.clips[clip];
        if(state.m_BlendTreeConstantArray.length!==1||nodes?.length!==1||nodes[0].data.m_ClipID!==index
          ||nodes[0].data.m_ChildIndices.length||clip!==expected.id||!native||native.stop-native.start!==expected.duration
          ||state.m_Speed!==1||state.m_CycleOffset!==0||state.m_SpeedParamID!==0||state.m_TimeParamID!==0||state.m_Mirror
          ||!pose.instances.some(i=>i.animator===drivers[0]&&i.controller===controller&&i.clip===clip))fail();
      }
      const transitions=states[0].m_TransitionConstantArray;
      if(style.end){
        const t=transitions[0]?.data,conditions=t?.m_ConditionConstantArray;
        if(transitions.length!==1||t.m_DestinationState!==1||t.m_HasExitTime||t.m_TransitionDuration!==0||t.m_TransitionOffset!==0
          ||conditions?.length!==1||conditions[0].data.m_ConditionMode!==6||conditions[0].data.m_EventThreshold!==1
          ||names.get(conditions[0].data.m_EventID)!=='OnEnd'||states[1].m_TransitionConstantArray.length)fail();
        onEnd={parameter:'OnEnd',mode:6,value:1,destination:1,duration:0};
      }else if(transitions.length)fail();
    }else if(pose.instances.length)fail();
    const source=records[fx[0]].data;
    const start=root.endsWith('_start_01'),s2=root.includes('skill_02');
    if(source.m_Enabled!==1||source._isLoop!==Number(!start||s2)||source._holdByOwner!==Number(start&&!root.includes('skill_03'))
      ||source._delayToFinish!==(s2?0:.5)||source._rotateType!==(start?2:0)
      ||source._spawnLocation!==Number(root==='aphris_attack_line_point_01')||source._delayToPlay!==0||source._randomPlayDelay!==0
      ||source._usePlaybackSpeed!==0||source._heightOffset!==0||source._overwriteHeight!==0||source._inactiveOnFinish.length)fail();
    result.push({root,controller,clip:style.clip,end:style.end,onEnd,effect:fx[0],
      isLoop:source._isLoop,holdByOwner:source._holdByOwner,delayToFinish:source._delayToFinish,
      rotateType:source._rotateType,spawnLocation:source._spawnLocation});
  }
  return {sourcePackSha256:APHRISSA_BEAM_PACK,profiles:result,nativeMountMappingVerified:false,nativeFinishDispatchVerified:false};
}
