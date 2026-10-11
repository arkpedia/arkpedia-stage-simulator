// SPDX-License-Identifier: GPL-3.0-or-later
import {createEffectTrajectory} from './native-effect-trail.js';
export const LAPPLAND_S3_TRAIL_ROOT='whitw2_skill_03_token_trail_01';

// Parse data only. Root selection is constrained to the recovered cruise effect;
// positions are explicit Unity-axis offsets, not executable scene instructions.
export function readLapplandMotionInput(value,sourcePackSha256,{allowEmpty=false}={}){
 if(Array.isArray(value)){createEffectTrajectory(value);return {kind:'movement',tracks:[{id:'movement',samples:structuredClone(value)}]};}
 if(value?.schemaVersion!==1||value.kind!=='lappland-s3-battle-motion'||value.sourcePackSha256!==sourcePackSha256
  ||value.scope?.simulationMotion!==true||value.scope.compiledFrameParity!==false||!Array.isArray(value.scope.enabledOperators)||value.scope.enabledOperators.length
  ||!Array.isArray(value.tracks)||value.tracks.length<(allowEmpty===true?0:1)||value.tracks.length>256)throw Error('Invalid or changed Lappland battle motion');
 const ids=new Set();
 const tracks=value.tracks.map(t=>{
  if(typeof t.id!=='string'||!/^\d+$/.test(t.id)||ids.has(t.id)||t.effect!==LAPPLAND_S3_TRAIL_ROOT||typeof t.owner!=='string'||!t.owner.length||t.owner.length>128
   ||![t.deploySeq,t.generation,t.slot].every(Number.isInteger)||t.deploySeq<1||t.generation<1||t.slot<0||t.slot>3
   ||!Number.isFinite(t.start)||t.start<0||t.end!==null&&(!Number.isFinite(t.end)||t.end<t.start)
   ||!['attach','skill-end','removed','death','retired','recorder-end',null].includes(t.reason)
   ||(t.end===null)!==(t.reason===null))throw Error('Invalid Lappland battle motion track');
  ids.add(t.id);createEffectTrajectory(t.samples);
  if(t.end!==null&&Math.abs(t.samples.at(-1).time-(t.end-t.start))>1e-8)throw Error('Incomplete Lappland motion endpoint');
  return structuredClone(t);
 });
 return {kind:value.kind,tracks};
}
