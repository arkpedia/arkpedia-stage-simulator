// SPDX-License-Identifier: GPL-3.0-or-later
// Held battle rays -> complete original beam prefabs. No combat/clock ownership.
import {APHRISSA_BEAM_OWNER as ID,APHRISSA_BEAM_PACK,APHRISSA_BEAM_CONTRACT,validateAphrissaBeamTrack} from '../../shared/arkpedia/aphrissa-beam-presentation.js';
import {aphrissaReviewSupport} from '../../shared/arkpedia/aphrissa-review-operator.js';
import {createNativeStageCamera} from './native-stage-camera.js';
const vector=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export function createAphrissaStageBeams({three:T,library,sourcePackSha256,contract,heightAt,anchorAt,shaderGlobals}){
  if(contract!==APHRISSA_BEAM_CONTRACT||sourcePackSha256!==APHRISSA_BEAM_PACK
    ||typeof library?.create!=='function'||typeof heightAt!=='function'||typeof anchorAt!=='function'
    ||!shaderGlobals||Object.keys(shaderGlobals).length!==1||![0,1].includes(shaderGlobals._HG_UV_ROTATION))
    throw Error('Held Aphrissa beam pass requires original inputs and explicit mounts/globals');
  const expectedGlobals=JSON.stringify(shaderGlobals),scene=new T.Scene(),bridge=createNativeStageCamera(T),entries=new Map(),pending=new Set();
  let battle=null,generation=0,disposed=false,error=null;
  const open=()=>{if(disposed)throw Error('Aphrissa stage beams are disposed');};
  function clear(){generation++;battle=null;error=null;for(const e of entries.values())e.instance?.dispose();entries.clear();}
  function update(next){
    open();if(!next){clear();return;}
    if(!Number.isFinite(next.time)||next.time<0||!Array.isArray(next.units)
      ||!aphrissaReviewSupport(ID,next.regularReviewCandidates))throw Error('Explicit held Aphrissa battle required');
    const segments=[],seen=new Set();
    for(const unit of next.units){
      if(unit.def?.charId!==ID||!unit.alive||!unit.deployed||unit.removed||unit._removing||unit.hidden)continue;
      if(unit.side!=='ally'||typeof unit.mem.aphrissaLinePresentation?.snapshot!=='function')throw Error('Missing held Aphrissa beam owner');
      for(const track of unit.mem.aphrissaLinePresentation.snapshot()){
        validateAphrissaBeamTrack(track);
        if(track.ownerId!==unit.id||track.ownerLife!==unit.deploySeq||track.clipStartedAt>next.time||seen.has(track.id))
          throw Error('Changed held Aphrissa beam life/clock');
        seen.add(track.id);
        const points=track.points.map(point=>{
          let value;
          if(point.role==='waypoint'){
            const participant=next.units.find(u=>u.id===point.unitId&&u.deploySeq===point.life&&u.alive&&u.deployed&&!u.removed&&!u._removing&&!u.hidden&&u.side===unit.side);
            if(!participant)throw Error('Retired Aphrissa ray participant');
            const h=heightAt(point.row,point.col);if(!Number.isFinite(h))throw Error('Invalid original beam tile height');
            value=[point.col,h+point.fixedHeight,point.row];
          }else value=anchorAt({point:structuredClone(point),track:structuredClone(track),owner:unit,battle:next});
          if(!vector(value))throw Error('Invalid explicit Aphrissa mount position');return value.slice();
        });
        for(let i=1;i<points.length;i++)segments.push({key:track.id+':'+(i-1),unit,track,positions:[points[i-1],points[i]]});
      }
    }
    // Validate the complete new view before changing an existing scene.
    if(next===battle)for(const segment of segments){const entry=entries.get(segment.key);
      if(entry&&(entry.unit!==segment.unit||entry.track.ownerLife!==segment.track.ownerLife||entry.track.mode!==segment.track.mode
        ||entry.track.root!==segment.track.root||entry.track.startedAt!==segment.track.startedAt))throw Error('Changed original Aphrissa beam identity');}
    if(next!==battle){clear();battle=next;}
    const live=new Set(segments.map(s=>s.key));
    for(const [key,entry]of entries)if(!live.has(key)){entry.instance?.dispose();entries.delete(key);}
    for(const segment of segments){
      let entry=entries.get(segment.key);
      if(!entry){
        entry={...segment,instance:null,time:next.time-segment.track.clipStartedAt};entries.set(segment.key,entry);
        const token=generation;
        const task=Promise.resolve().then(async()=>{
          if(disposed||generation!==token||entries.get(segment.key)!==entry)return;
          const instance=await library.create(segment.track.root,{linePositions:()=>
            !disposed&&generation===token&&entries.get(segment.key)===entry?entry.positions.map(p=>p.slice()):null});
          if(disposed||generation!==token||entries.get(segment.key)!==entry){instance.dispose();return;}
          if(instance.inspection!==null||!Array.isArray(instance.blocked)||instance.blocked.length
            ||JSON.stringify(instance.shaderGlobals)!==expectedGlobals){
            instance.dispose();throw Error('Unreviewed Aphrissa beam renderer/environment');
          }
          entry.instance=instance;scene.add(instance.group);
        }).catch(e=>{if(!disposed&&generation===token&&entries.get(segment.key)===entry)error=e;}).finally(()=>pending.delete(task));
        pending.add(task);
      }
      entry.track=segment.track;entry.positions=segment.positions;entry.time=next.time-segment.track.clipStartedAt;
    }
    if(error)throw error;
  }
  async function ready(){open();while(pending.size)await Promise.all([...pending]);if(error)throw error;}
  function render(renderer,stageCamera){
    open();if(error)throw error;if(!entries.size)return;
    const camera=bridge.sync(stageCamera),frame=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
    for(const entry of entries.values())if(entry.instance){
      const signature=JSON.stringify([entry.time,entry.track.clip,entry.positions,frame]);
      if(signature!==entry.rendered){entry.instance.update(entry.time,{camera,clip:entry.track.clip});entry.rendered=signature;}
    }
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.render(scene,camera);}finally{renderer.autoClear=autoClear;}
  }
  return {scene,camera:bridge.camera,scope:APHRISSA_BEAM_CONTRACT,update,ready,render,clear,
    isActor(){return false;},
    get instanceCount(){return [...entries.values()].filter(e=>e.instance).length;},get pendingCount(){return pending.size;},
    inspect(){return [...entries.values()].map(e=>({key:e.key,track:structuredClone(e.track),positions:structuredClone(e.positions),time:e.time,instance:e.instance}));},
    dispose(){if(disposed)return;clear();disposed=true;}
  };
}
