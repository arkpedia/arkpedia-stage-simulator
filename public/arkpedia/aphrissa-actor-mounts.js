// SPDX-License-Identifier: GPL-3.0-or-later
import source from '../../data/arkpedia-aphrissa-mounts.json' with {type:'json'};
import {actorBoneAnchor} from '../../shared/arkpedia/actor-bone-anchor.js';
import {regularVisualHeight} from './regular-form-visual.js';
import {APHRISSA_BEAM_OWNER as ID,APHRISSA_BEAM_CONTRACT} from '../../shared/arkpedia/aphrissa-beam-presentation.js';
export function createAphrissaActorMounts({three:T,renderer,contract,endAt,orientationAt}){
  if(contract!==APHRISSA_BEAM_CONTRACT||source.operator!==ID||typeof renderer?.views?.get!=='function'
    ||typeof renderer?.preloaded?.get!=='function'||typeof endAt!=='function'||typeof orientationAt!=='function')
    throw Error('Aphrissa actor mounts require the held renderer and explicit endpoint/orientation policies');
  const bindings=structuredClone(source.bindings),receipts=new Map();let battle=null,closed=false;
  const open=()=>{if(closed)throw Error('Aphrissa actor mounts are disposed');};
  function anchorAt(context){
    open();const {point,track,owner,battle:next}=context;
    if(point.role!=='start')return endAt(context);
    if(owner?.def?.charId!==ID||!owner.alive||!owner.deployed||owner.hidden||owner.removed||owner._removing
      ||track.ownerId!==owner.id||track.ownerLife!==owner.deploySeq||point.unitId!==owner.id||point.life!==owner.deploySeq
      ||!next?.units?.includes(owner)||!Number.isFinite(next.time))throw Error('Unowned Aphrissa actor mount');
    const view=renderer.views.get(owner.id),binding=bindings[view?.key],loaded=renderer.preloaded.get(view?.key),spine=view?.actor?.spine;
    if(!binding||view.unit!==owner||view.life!==owner.deploySeq||view.dying||!loaded||view.actor.entry!==loaded.entry
      ||spine?.spineData!==loaded.skeleton||spine.skeleton?.data!==loaded.skeleton)
      throw Error('Original live Aphrissa actor is unavailable for its muzzle mount');
    const size=renderer.three.getSize(new T.Vector2()),height=renderer.heightAt(Math.round(owner.y),Math.round(owner.x))
      +regularVisualHeight(owner.mem?.regularFormVisual,next.time),sample=actorBoneAnchor({three:T,spine,boneName:binding.bone,
        boardPosition:[owner.x,owner.y,height],camera:renderer.camera,width:size.x,height:size.y});
    if(next!==battle){receipts.clear();battle=next;}
    receipts.set(owner.id,{owner,actor:view.actor,loaded,life:owner.deploySeq,key:view.key,bone:binding.bone,time:next.time,...sample});
    return sample.position.slice();
  }
  return {anchorAt,pointFrameAt(context){open();const frame=orientationAt(context);return {...frame,position:context.position.slice()};},
    scope:Object.freeze({heldOnly:true,originalMuzzleBones:true,renderedActorPlane:true,nativeMountTypeMappingVerified:false,nativeDepthVerified:false,nativeRotationVerified:false,compiledFrameParity:false}),
    inspect(){open();const result=[];for(const [id,r]of receipts){const view=renderer.views.get(id);
      if(r.time!==battle?.time||!r.owner.alive||!r.owner.deployed||r.owner.hidden||r.owner.removed||r.owner._removing||r.owner.deploySeq!==r.life
        ||view?.unit!==r.owner||view.life!==r.life||view.key!==r.key||view.actor!==r.actor||renderer.preloaded.get(r.key)!==r.loaded){receipts.delete(id);continue;}
      const {owner,actor,loaded,...record}=r;result.push({ownerId:id,...structuredClone(record)});
    }return result;},
    dispose(){if(closed)return;closed=true;receipts.clear();battle=null;}
  };
}
