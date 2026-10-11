// SPDX-License-Identifier: GPL-3.0-or-later
// Live private S3 presentation, observed through the source-bound recorder.
// No combat mutation, no authored stand-ins and no native FSM/fidelity claim.
import {readLapplandMotionInput} from '../../shared/arkpedia/lappland-effect-motion.js';
import {createEffectTrajectory} from '../../shared/arkpedia/native-effect-trail.js';
import {createNativeStageCamera} from './native-stage-camera.js';
export function createLapplandStageEffects({three:T,library,sourcePackSha256,recordMotion}){
  if(!/^[a-f0-9]{64}$/.test(sourcePackSha256)||typeof recordMotion!=='function')throw Error('Native S3 presentation requires pinned source motion');
  const scene=new T.Scene(),bridge=createNativeStageCamera(T),entries=new Map(),pending=new Set();
  let battle=null,recorder=null,generation=0,disposed=false,error=null;
  const assertOpen=()=>{if(disposed)throw Error('Lappland stage effects are disposed');};
  function read(rec){
    const report=readLapplandMotionInput(rec.activeSnapshot(),sourcePackSha256,{allowEmpty:true});
    if(report.kind!=='lappland-s3-battle-motion')throw Error('Live presentation requires original battle motion');
    return report;
  }
  function clear(){
    generation++;recorder?.dispose();recorder=null;battle=null;error=null;
    for(const entry of entries.values())entry.instance?.dispose();entries.clear();
  }
  function update(nextBattle){
    assertOpen();if(!nextBattle)return;
    if(nextBattle!==battle){
      // Validate and install the new recorder before retiring the old battle.
      // Late activation fails explicitly rather than inventing a birth path.
      const next=recordMotion(nextBattle);
      try{read(next);}
      catch(e){next.dispose();throw e;}
      clear();battle=nextBattle;recorder=next;
    }
    const report=read(recorder);
    for(const track of report.tracks){
      if(track.end!==null)throw Error('An active drone cannot contain a closed effect segment');
      const entry=entries.get(track.id);
      if(entry&&(entry.track.owner!==track.owner||entry.track.deploySeq!==track.deploySeq||entry.track.generation!==track.generation
        ||entry.track.slot!==track.slot||entry.track.start!==track.start||entry.track.effect!==track.effect))
        throw Error('Changed live source drone identity');
    }
    const active=new Set(report.tracks.map(t=>t.id));
    for(const [key,entry]of entries)if(!active.has(key)){entry.instance?.dispose();entries.delete(key);}
    for(const track of report.tracks){
      let entry=entries.get(track.id);
      if(!entry){
        entry={track,instance:null,trajectory:null,time:0};entries.set(track.id,entry);const token=generation;
        const task=Promise.resolve().then(async()=>{
          if(disposed||generation!==token||entries.get(track.id)!==entry)return;
          const instance=await library.create(track.effect);
          if(disposed||generation!==token||entries.get(track.id)!==entry){instance.dispose();return;}
          entry.instance=instance;scene.add(instance.group);
        }).catch(e=>{if(!disposed&&generation===token&&entries.get(track.id)===entry)error=e;})
          .finally(()=>pending.delete(task));pending.add(task);
      }
      entry.track=track;entry.trajectory=createEffectTrajectory(track.samples);entry.time=track.samples.at(-1).time;
    }
    if(error)throw error;
  }
  async function ready(){await Promise.all([...pending]);if(error)throw error;}
  function render(renderer,stageCamera){
    assertOpen();if(error)throw error;
    if(!entries.size)return;
    const camera=bridge.sync(stageCamera);
    for(const entry of entries.values())entry.instance?.update(entry.time,{camera,trajectory:entry.trajectory});
    // The converted camera gives the same clip-space depth as the board camera;
    // preserve its depth buffer and restore the caller's clearing policy.
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.render(scene,camera);}finally{renderer.autoClear=autoClear;}
  }
  return {scene,camera:bridge.camera,update,render,ready,clear,
    get instanceCount(){return [...entries.values()].filter(e=>e.instance).length;},
    get pendingCount(){return pending.size;},
    inspect(){return [...entries.values()].map(e=>({track:structuredClone(e.track),time:e.time,instance:e.instance}));},
    dispose(){if(disposed)return;clear();disposed=true;}
  };
}
