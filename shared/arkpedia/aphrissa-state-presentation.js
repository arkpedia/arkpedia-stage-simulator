// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit held buff-state presentation; original enums are retained, not inferred.
import animations from '../../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import {APHRISSA_BEAM_PACK} from './aphrissa-beam-presentation.js';
import {createEffectPose} from './native-effect-pose.js';
const clip=name=>{const rows=Object.entries(animations.clips).filter(([,c])=>c.name===name);
  if(rows.length!==1)throw Error('Missing original Aphrissa state clip');return rows[0][0];};
const make=(root,names,extra={})=>Object.freeze({root,clips:Object.freeze(names.map(clip)),...extra});
export const APHRISSA_STATE_STYLES=Object.freeze({
  s1:make('aphris_skill_01_buff_01',[]),
  charge:make('aphris_skill_03_charge_01',['aphris_skill_03_charge_start']),
  chargeEnd:make('aphris_skill_03_charge_01_end',['aphris_skill_03_charge_01_end'],{retention:.6666666865348816}),
  active:make('aphris_skill_03_buff_01',['aphris_skill_03_buff_01']),
  wing:make('aphris_skill_03_buff_02_front',['aphris_skill_03_buff_02','aphris_skill_03_buff_02_rotation'],
    {back:'aphris_skill_03_buff_02_back'})
});
export const APHRISSA_STATE_CONTRACT=Object.freeze({heldOnly:true,compiledDispatchVerified:false,nativeMountMappingVerified:false,
  nativeFinishDispatchVerified:false,nativeFaceSwitchVerified:false,frameParity:false,
  policy:'Observe exact owned S1 stat and S3 charge/stat/wing buff records. Buff rejection or removal affects only its own presentation; finish actions are limited to the exact parents owned by this controller, without inferred cross-source overwrite behavior. The local S3 charge-to-active boundary maps native event 6 to the wing grant; wing start finishes the owned charge buff. Charge removal creates the original charge-end prefab for its finite clip window. Buff loops end with their parent; native emission-stop/tail semantics remain unverified. Caller supplies mount/orientation and the actual rendered face. Original front/back wing roots keep their parent birth clock across face switches. Compose the explicit disjoint source Animator and legacy rotation clips; no blending or native FSM execution is inferred.'});
export function validateAphrissaState(t){
  const s=typeof t?.kind==='string'&&Object.hasOwn(APHRISSA_STATE_STYLES,t.kind)?APHRISSA_STATE_STYLES[t.kind]:null,
    id=v=>typeof v==='string'&&!!v||Number.isSafeInteger(v)&&v>0;
  if(!s||typeof t.id!=='string'||!t.id||!id(t.ownerId)||!Number.isSafeInteger(t.ownerLife)||t.ownerLife<1
    ||!Number.isSafeInteger(t.activation)||t.activation<1||!Number.isFinite(t.startedAt)||t.startedAt<0||t.root!==s.root)
    throw Error('Invalid held Aphrissa state effect');
  return s;
}
export function validateAphrissaStateSources(pack,native){
  const fail=()=>{throw Error('Changed original Aphrissa state prefab binding');},r=pack.records,
    refs=(id,field)=>(r[id]?.references??[]).filter(x=>x.field===field).map(x=>x.target),result=[];
  if(native.sourcePackSha256!==APHRISSA_BEAM_PACK||animations.sourcePackSha256!==APHRISSA_BEAM_PACK)fail();
  for(const [kind,style]of Object.entries(APHRISSA_STATE_STYLES))for(const root of [style.root,style.back].filter(Boolean)){
    const pose=createEffectPose(pack,native,root),components=[...pose.nodes.values()].flatMap(n=>refs(n.gameObject,'component')),
      fxs=refs(pack.roots[root],'component').filter(id=>r[id].type==='MonoBehaviour'&&Object.hasOwn(r[id].data,'_isLoop'));
    if(fxs.length!==1||pose.instances.length!==style.clips.length||style.clips.some(id=>!pose.instances.some(i=>i.clip===id)))fail();
    for(const i of pose.instances){
      if(i.bindings.some(b=>b.unresolved)||native.clips[i.clip]?.sourceSha256!==animations.clips[i.clip]?.sourceSha256)fail();
      if(i.animator){const controller=r[i.controller],c=controller?.data.m_Controller,m=c?.m_StateMachineArray?.[0]?.data,
        state=m?.m_StateConstantArray?.[0]?.data,nodes=state?.m_BlendTreeConstantArray?.[0]?.data.m_NodeArray;
        if(r[i.animator].data.m_Enabled!==1||refs(i.animator,'m_Controller').join()!==i.controller
          ||c.m_LayerArray.length!==1||c.m_LayerArray[0].data.m_StateMachineIndex!==0||c.m_StateMachineArray.length!==1||m.m_DefaultState!==0
          ||m.m_StateConstantArray.length!==1||m.m_AnyStateTransitionConstantArray.length||state.m_TransitionConstantArray.length
          ||state.m_Speed!==1||state.m_CycleOffset!==0||state.m_SpeedParamID||state.m_TimeParamID||state.m_Mirror
          ||state.m_BlendTreeConstantArray.length!==1||nodes.length!==1||nodes[0].data.m_ChildIndices.length
          ||nodes[0].data.m_ClipID!==0||refs(i.controller,'m_AnimationClips').join()!==i.clip
          ||controller.data.m_StateMachineBehaviours.length)fail();
      }else{const d=r[i.animation]?.data;
        if(!d||d.m_Enabled!==1||!d.m_PlayAutomatically||d.m_AnimatePhysics||d.m_WrapMode!==0
          ||refs(i.animation,'m_Animation').join()!==i.clip||refs(i.animation,'m_Animations').join()!==i.clip)fail();
      }
    }
    // This also rejects any overlap between the source wing's two clocks.
    pose.sample(.2,style.clips.length?style.clips:null);
    const d=r[fxs[0]].data,charge=kind.startsWith('charge'),wing=kind==='wing';
    if(d.m_Enabled!==1||d._isLoop!==1||d._holdByOwner!==Number(kind!=='s1')||d._spawnLocation!==(charge?9:wing?8:1)
      ||d._rotateType!==Number(!charge&&!wing)||d._delayToFinish!==(kind==='s1'?.5:0)
      ||d._delayToPlay!==0||d._randomPlayDelay!==0||d._usePlaybackSpeed!==0||d._heightOffset!==0||d._overwriteHeight!==0
      ||d._inactiveOnFinish.length||d._maxLifetime!==-1)fail();
    if(charge||wing){const follow=components.filter(id=>r[id].type==='MonoBehaviour'&&Object.hasOwn(r[id].data,'_mountPointType'));
      if(follow.length!==1||r[follow[0]].data._mountPointType!==(charge?6:5))fail();}
    if(root===style.root&&wing){const face=components.filter(id=>r[id].type==='MonoBehaviour'&&Object.hasOwn(r[id].data,'_backEffect'));
      if(face.length!==1||r[face[0]].data._backEffect!==style.back||r[face[0]].data._createEffectOnStart!==0
        ||r[face[0]].data._forceCheckInUpdate!==1||r[face[0]].data._oneShot!==0)fail();}
    if(kind==='chargeEnd'&&native.clips[style.clips[0]].stop-native.clips[style.clips[0]].start!==style.retention)fail();
    result.push({kind,root,clips:style.clips,renderers:pose.renderers.size,effect:fxs[0]});
  }
  return result;
}
