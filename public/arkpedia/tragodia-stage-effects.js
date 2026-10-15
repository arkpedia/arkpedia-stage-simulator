// SPDX-License-Identifier: GPL-3.0-or-later
// Source cage presentation tied to the actual token life and combat clock.
// Native Animator/FSM, random emission and pixel parity remain unverified.
import {createEffectTrajectory} from '../../shared/arkpedia/native-effect-trail.js';
import {createNativeStageCamera} from './native-stage-camera.js';
export const TRAGODIA_CAGE_ACTOR='token_10055_phatm2_mndclv';
const ROOT='phatm2_skill_03_prison_01';
const PACK='e39769c56a91f5d483632808082a05a3dbe0b71d5a5c99b3ade9ebdee68fd0ff';
const CLIP='battle/prefabs/effects/phatm2.ab:7379801640911501129';
export function createTragodiaStageEffects({three:T,library,sourcePackSha256,heightAt}) {
  if(sourcePackSha256!==PACK||typeof heightAt!=='function'||typeof library?.create!=='function')
    throw Error('Tragodia cage presentation requires original inputs and stage height');
  const scene=new T.Scene(),bridge=createNativeStageCamera(T),entries=new Map(),pending=new Set();
  let battle=null,generation=0,disposed=false,error=null;
  const open=()=>{if(disposed)throw Error('Tragodia stage effects are disposed');};
  function isActor(unit){
    if(unit?.defId!==TRAGODIA_CAGE_ACTOR)return false;
    if(unit.mem?.regularNativeEffect!==ROOT)throw Error('Unreviewed Tragodia cage effect');
    return true;
  }
  function clear(){
    generation++;battle=null;error=null;
    for(const entry of entries.values())entry.instance?.dispose();
    entries.clear();
  }
  function update(next){
    open();if(!next){clear();return;}
    if(!Number.isFinite(next.time)||next.time<0||!Array.isArray(next.units))throw Error('Invalid cage battle clock');
    const tracks=[];
    for(const unit of next.units){
      if(!unit.alive||!unit.deployed||!isActor(unit))continue;
      if(unit.side!=='ally'||!Number.isSafeInteger(unit.deploySeq)||unit.deploySeq<1
        ||!Number.isFinite(unit.deployedAt)||unit.deployedAt<0||unit.deployedAt>next.time
        ||!Number.isSafeInteger(unit.x)||!Number.isSafeInteger(unit.y))throw Error('Invalid cage token life');
      const height=heightAt(unit.y,unit.x);
      if(!Number.isFinite(height))throw Error('Invalid original cage stage height');
      tracks.push({unit,seq:unit.deploySeq,start:unit.deployedAt,position:[unit.x,height,unit.y]});
    }
    // Validate all new tracks before releasing a previous battle's resources.
    if(next!==battle){clear();battle=next;}
    const live=new Set(tracks.map(t=>t.unit));
    for(const [unit,entry]of entries)if(!live.has(unit)){
      entry.instance?.dispose();entries.delete(unit);
    }
    for(const track of tracks){
      let entry=entries.get(track.unit);
      if(entry&&(entry.seq!==track.seq||entry.start!==track.start)){
        entry.instance?.dispose();entries.delete(track.unit);entry=null;
      }
      if(entry&&entry.position.some((v,i)=>v!==track.position[i]))throw Error('Stationary cage moved during its token life');
      if(!entry){
        entry={...track,instance:null,time:next.time-track.start,
          trajectory:createEffectTrajectory([{time:0,position:track.position}])};
        entries.set(track.unit,entry);const token=generation;
        const task=Promise.resolve().then(async()=>{
          if(disposed||generation!==token||entries.get(track.unit)!==entry)return;
          const instance=await library.create(ROOT);
          if(disposed||generation!==token||entries.get(track.unit)!==entry){instance.dispose();return;}
          entry.instance=instance;scene.add(instance.group);
        }).catch(e=>{if(!disposed&&generation===token&&entries.get(track.unit)===entry)error=e;})
          .finally(()=>pending.delete(task));
        pending.add(task);
      }
      entry.time=next.time-track.start;
    }
    if(error)throw error;
  }
  async function ready(){open();await Promise.all([...pending]);if(error)throw error;}
  function render(renderer,stageCamera){
    open();if(error)throw error;if(!entries.size)return;
    const camera=bridge.sync(stageCamera);
    const frame=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
    for(const entry of entries.values())if(entry.instance&&(entry.renderedAt!==entry.time
      ||!entry.cameraFrame||entry.cameraFrame.some((v,i)=>v!==frame[i]))){
      entry.instance.update(entry.time,{camera,clip:CLIP,trajectory:entry.trajectory});
      entry.renderedAt=entry.time;entry.cameraFrame=frame;
    }
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.render(scene,camera);}finally{renderer.autoClear=autoClear;}
  }
  return {scene,camera:bridge.camera,isActor,update,render,ready,clear,
    get instanceCount(){return [...entries.values()].filter(e=>e.instance).length;},
    get pendingCount(){return pending.size;},
    inspect(){return [...entries.values()].map(e=>({unit:e.unit,seq:e.seq,start:e.start,time:e.time,
      position:e.position.slice(),instance:e.instance}));},
    dispose(){if(disposed)return;clear();disposed=true;}
  };
}
