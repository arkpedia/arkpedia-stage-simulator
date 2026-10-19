// SPDX-License-Identifier: GPL-3.0-or-later
// Original literal special-point followers; the caller owns enum/depth policy.
import foundation from '../../data/arkpedia-native-operators/char_4229_aphris.json' with {type:'json'};
import models from '../../data/arkpedia-aphrissa-mounts.json' with {type:'json'};
import {APHRISSA_STATE_CONTRACT,APHRISSA_STATE_STYLES,validateAphrissaState} from '../../shared/arkpedia/aphrissa-state-presentation.js';
import {actorBoneAnchor} from '../../shared/arkpedia/actor-bone-anchor.js';
import {regularVisualHeight} from './regular-form-visual.js';
const ID='char_4229_aphris',controller=foundation.chararts[ID][0],rows=foundation.artworkHierarchy[ID];
function binding(face,field){
  const selected=controller.data['_'+face],pointer=selected[field],row=rows.find(r=>r.components.some(c=>c.pathId===pointer?.m_PathID)),
    follower=row?.components.filter(c=>c.type==='MonoBehaviour'&&Object.hasOwn(c.data,'boneName'));
  if(!['specialPoint0','specialPoint1'].includes(field)||pointer?.m_FileID!==0||follower?.length!==1)throw Error('Missing literal Aphrissa special-point follower');
  const f=follower[0],d=f.data;
  if(d.m_Enabled!==1||d.skeletonRenderer.m_PathID!==selected.skeleton.m_PathID||d.skeletonRenderer.m_FileID!==0
    ||['followXYPosition','followZPosition','followSkeletonFlip','followLocalScale','maintainedAxisOrientation','initializeOnAwake'].some(k=>d[k]!==1)
    ||d.followBoneRotation!==0||d.useAppliedLocalScale!==0)throw Error('Changed Aphrissa special-point follower');
  return{field,transform:pointer.m_PathID,follower:f.pathId,bone:d.boneName,skeleton:models.bindings[`operator/${ID}/default/${face}`].skeleton};
}
export const APHRISSA_STATE_MOUNTS=Object.freeze(Object.fromEntries(['front','back'].map(face=>[face,Object.freeze(Object.fromEntries(
  ['specialPoint0','specialPoint1'].map(field=>[field,Object.freeze(binding(face,field))])))])));
export function createAphrissaStateMounts({three:T,renderer,contract,anchorFor,orientationAt}){
  if(contract!==APHRISSA_STATE_CONTRACT||typeof anchorFor!=='function'||typeof orientationAt!=='function'
    ||typeof renderer?.views?.get!=='function'||typeof renderer?.preloaded?.get!=='function')throw Error('Explicit held state mount policies required');
  let closed=false;const receipts=new Map();let battle=null;
  function stateFrameAt(context){
    if(closed)throw Error('Aphrissa state mounts are disposed');
    const {state,owner,battle:next}=context,style=validateAphrissaState(state),view=renderer.views.get(owner?.id),loaded=renderer.preloaded.get(view?.key),spine=view?.actor?.spine,
      face=view?.key===`operator/${ID}/default/front`?'front':view?.key===`operator/${ID}/default/back`?'back':null;
    if(owner?.def?.charId!==ID||!owner.alive||!owner.deployed||owner.hidden||owner.removed||owner._removing||!next?.units?.includes(owner)
      ||state.ownerId!==owner.id||state.ownerLife!==owner.deploySeq||!face||view.unit!==owner||view.life!==owner.deploySeq||view.dying
      ||!loaded||view.actor.entry!==loaded.entry||spine?.spineData!==loaded.skeleton||spine.skeleton?.data!==loaded.skeleton)
      throw Error('Original live Aphrissa actor is unavailable for its state mount');
    const policy=anchorFor(context),height=renderer.heightAt(Math.round(owner.y),Math.round(owner.x))
      +regularVisualHeight(owner.mem?.regularFormVisual,next.time),boardPosition=[owner.x,owner.y,height];
    let sample,source=null;
    if(policy==='actorFoot')sample={position:[owner.x,height,owner.y]};
    else{source=APHRISSA_STATE_MOUNTS[face][policy];if(!source)throw Error('Unknown explicit Aphrissa special-point policy');
      const size=renderer.three.getSize(new T.Vector2());sample=actorBoneAnchor({three:T,spine,boneName:source.bone,boardPosition,
        camera:renderer.camera,width:size.x,height:size.y});}
    const root=face==='back'&&style.back?style.back:style.root,frame={...orientationAt({...context,face,policy}),position:sample.position.slice(),root};
    if(next!==battle){receipts.clear();battle=next;}
    receipts.set(state.id,{stateId:state.id,ownerId:owner.id,ownerLife:owner.deploySeq,time:next.time,root,face,policy,
      ...(source?{source:structuredClone(source)}:{}),...sample});return frame;
  }
  return{stateFrameAt,scope:APHRISSA_STATE_CONTRACT,inspect(){return [...receipts.values()].filter(r=>r.time===battle?.time).map(r=>structuredClone(r));},
    dispose(){closed=true;battle=null;receipts.clear();}};
}
