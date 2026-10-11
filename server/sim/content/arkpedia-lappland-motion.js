// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only presentation bridge: real simulator positions, never combat RNG.
import evidence from '../../../data/arkpedia-lappland-alter-prefabs.json' with {type:'json'};
import effects from '../../../data/arkpedia-lappland-effects.json' with {type:'json'};
import {LAPPLAND_S3_TRAIL_ROOT} from '../../../shared/arkpedia/lappland-effect-motion.js';
const ID='char_1038_whitw2';
const position=d=>{
 const p=[d.x,0,d.y];if(!p.every(Number.isFinite))throw Error('Invalid Lappland recorded position');return p;
};

export function recordLapplandS3Motion(battle){
 if(battle.units.some(u=>u.mem?.lapplandController?.s3?.running))throw Error('Install Lappland motion recording before skill activation');
 // Bind the original cruise effect; attachment projectiles have no main effect.
 for(let slot=1;slot<=4;slot++){
  const cruise=evidence.projectiles[`projectile_chr_whitw2_funnel_s3_${slot}`].flatMap(r=>r.components).filter(c=>c.data._mainEffect!==undefined);
  const attach=evidence.projectiles[`projectile_chr_whitw2_funnel_s3_${slot}_attach`].flatMap(r=>r.components).filter(c=>c.data._mainEffect!==undefined);
  if(cruise.length!==1||cruise[0].data._mainEffect!==LAPPLAND_S3_TRAIL_ROOT||attach.length!==1||attach[0].data._mainEffect!=='')throw Error('Changed Lappland source motion/effect binding');
 }
 const tracks=[],active=new Map(),hooks=[];let disposed=false;
 const append=(entry,drone)=>{
  const time=battle.time-entry.track.start;
  if(!Number.isFinite(time)||time<0)throw Error('Invalid Lappland recorded clock');
  const sample={time,position:position(drone)},last=entry.track.samples.at(-1);
  if(last?.time===time)entry.track.samples[entry.track.samples.length-1]=sample;
  else{
   if(last&&last.time>time)throw Error('Lappland recording cannot run backwards');
   if(entry.track.samples.length>=20000)throw Error('Lappland motion recording exceeds sample budget');
   entry.track.samples.push(sample);
  }
 };
 const close=(drone,reason)=>{
  const entry=active.get(drone);if(!entry)return;append(entry,drone);active.delete(drone);
  entry.track.end=battle.time;entry.track.reason=reason;
 };
 const begin=({owner,drone})=>{
  if(disposed||owner.def.charId!==ID||!owner.mem.lapplandController?.s3?.valid(drone))return;
  if(active.has(drone))return;
  if(tracks.length>=256)throw Error('Lappland motion recording exceeds track budget');
  const track={id:String(tracks.length+1),effect:LAPPLAND_S3_TRAIL_ROOT,owner:String(owner.id),deploySeq:owner.deploySeq,
   generation:drone.epoch,slot:drone.slot,start:battle.time,end:null,reason:null,samples:[]};
  const entry={owner,track};tracks.push(track);active.set(drone,entry);append(entry,drone);
 };
 const reconcile=()=>{
  for(const [drone,entry] of active){
   const controller=entry.owner.mem.lapplandController?.s3;
   if(!controller?.valid(drone)||entry.owner.deploySeq!==entry.track.deploySeq)close(drone,'retired');
   else if(drone.phase==='attach')close(drone,'attach');
   else append(entry,drone);
  }
 };
 const on=(name,fn)=>hooks.push(battle.on(name,fn,{priority:-100}));
 on('lapplandS3DroneBirth',begin);on('lapplandS3Reappear',begin);
 on('lapplandS3Attach',({drone})=>close(drone,'attach'));
 on('skillEnd',({unit})=>{for(const [drone,entry] of active)if(entry.owner===unit)close(drone,'skill-end');});
 for(const name of ['removed','death'])on(name,({unit})=>{for(const [drone,entry] of active)if(entry.owner===unit)close(drone,name);});
 on('tick',reconcile);
 const dispose=()=>{
  if(disposed)return;disposed=true;for(const drone of [...active.keys()])close(drone,'recorder-end');
  for(const h of hooks)battle.off(h);
 };
 on('battleEnd',dispose);
 return {
  snapshot(){return structuredClone({schemaVersion:1,kind:'lappland-s3-battle-motion',sourcePackSha256:effects.pack.sha256,
   scope:{simulationMotion:true,compiledFrameParity:false,enabledOperators:[]},tracks});},
  dispose,
 };
}
