// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {createLapplandMotionFixture} from '../tools/arkpedia/lappland-motion-fixture.mjs';
import {recordLapplandS3Motion} from '../server/sim/content/arkpedia-lappland-motion.js';
import {readLapplandMotionInput,LAPPLAND_S3_TRAIL_ROOT} from '../shared/arkpedia/lappland-effect-motion.js';
import effects from '../data/arkpedia-lappland-effects.json' with {type:'json'};
import {prepareLapplandAttacks,LAPPLAND_ATTACK_CONTRACT} from '../server/sim/content/arkpedia-lappland-alter.js';
const SHA=effects.pack.sha256,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const hooks=b=>Object.values(b._hooks).flat().length;
function setup(){const f=createLapplandMotionFixture();return {...f,recorder:recordLapplandS3Motion(f.b)};}
test('real S3 motion samples retain source cruise binding, source clocks and current drone coordinates',()=>{
 const f=setup();f.enemy();f.activate();const born=f.recorder.snapshot();assert.equal(born.tracks.length,3);
 assert.ok(born.tracks.every(t=>t.start===f.b.time&&t.samples.length===1&&t.samples[0].time===0&&t.effect===LAPPLAND_S3_TRAIL_ROOT));
 f.b.on('tick',()=>{const report=f.recorder.snapshot();for(const d of f.controller.s3.drones){const t=report.tracks.find(t=>t.slot===d.slot);assert.deepEqual(t.samples.at(-1).position,[d.x,0,d.y]);near(t.samples.at(-1).time,f.b.time-t.start);}},{priority:-200});
 for(let i=0;i<18;i++)f.advance(f.b.dt);
 const input=readLapplandMotionInput(f.recorder.snapshot(),SHA);assert.equal(input.tracks.length,3);assert.equal(input.kind,'lappland-s3-battle-motion');
 input.tracks[0].samples[0].position[0]=999;assert.notEqual(f.recorder.snapshot().tracks[0].samples[0].position[0],999);f.recorder.dispose();
});
test('recording does not change combat, RNG, events, drone paths or source-controller cleanup',()=>{
 const a=createLapplandMotionFixture(),b=setup();a.enemy();b.enemy();a.activate();b.activate();a.advance(6);b.advance(6);
 assert.deepEqual(a.b.snapshot(),b.b.snapshot());assert.deepEqual(a.b.drainEvents(),b.b.drainEvents());
 assert.deepEqual(a.controller.s3.drones.map(d=>[d.x,d.y,d.phase,d.heading,d.speed]),b.controller.s3.drones.map(d=>[d.x,d.y,d.phase,d.heading,d.speed]));
 assert.equal(b.recorder.snapshot().scope.compiledFrameParity,false);assert.deepEqual(b.recorder.snapshot().scope.enabledOperators,[]);b.recorder.dispose();
});
test('attachment closes cruise motion and reappearance starts a separate zero-time segment without a teleport trail',()=>{
 const f=setup(),target=f.enemy();f.activate();for(let i=0;i<450&&!f.recorder.snapshot().tracks.some(t=>t.reason==='attach');i++)f.advance(f.b.dt);
 const first=f.recorder.snapshot().tracks.find(t=>t.reason==='attach');assert.ok(first);assert.equal(first.end,first.start+first.samples.at(-1).time);
 const length=first.samples.length;target.hidden=true;f.advance(f.b.dt);const report=f.recorder.snapshot();
 assert.equal(report.tracks.find(t=>t.id===first.id).samples.length,length);
 const fresh=report.tracks.find(t=>t.slot===first.slot&&t.id!==first.id);assert.ok(fresh);assert.equal(fresh.samples[0].time,0);assert.notDeepEqual(fresh.samples[0].position,first.samples.at(-1).position);
 readLapplandMotionInput(report,SHA);f.recorder.dispose();
});
test('skill end and restart use separate generation identities and no stale future samples',()=>{
 const f=setup();f.activate();f.advance(.5);f.u.skill.end('fixture');const old=f.recorder.snapshot();assert.ok(old.tracks.every(t=>t.reason==='skill-end'));
 f.activate();f.advance(.5);const next=f.recorder.snapshot();assert.equal(next.tracks.length,6);assert.ok(next.tracks.slice(3).every(t=>t.generation>old.tracks[0].generation&&t.samples[0].time===0));
 assert.deepEqual(next.tracks.slice(0,3),old.tracks);f.recorder.dispose();const done=f.recorder.snapshot();f.advance(1);assert.deepEqual(f.recorder.snapshot(),done);
});
test('owner retreat and battle finish close motion and dispose all recorder hooks',()=>{
 const f=createLapplandMotionFixture(),count=hooks(f.b),recorder=recordLapplandS3Motion(f.b);f.activate();f.advance(.5);f.b.retreat(f.u,{permanent:true});
 assert.ok(recorder.snapshot().tracks.every(t=>t.end===f.b.time&&t.reason==='skill-end'));recorder.dispose();assert.ok(hooks(f.b)<count);recorder.dispose();
 const g=createLapplandMotionFixture(),base=hooks(g.b),r=recordLapplandS3Motion(g.b);g.activate();g.advance(.5);g.b.forceEnd('fixture');assert.ok(hooks(g.b)<=base);const done=r.snapshot();assert.ok(done.tracks.every(t=>t.end!==null));r.dispose();assert.deepEqual(r.snapshot(),done);
});
test('source review parser rejects corrupted binding, source hash, lifecycle and movement inputs',()=>{
 const f=setup();f.activate();f.advance(.5);f.recorder.dispose();const raw=f.recorder.snapshot();readLapplandMotionInput(raw,SHA);
 for(const change of [v=>v.sourcePackSha256='wrong',v=>v.scope.compiledFrameParity=true,v=>v.scope.enabledOperators.push('char_1038_whitw2'),
  v=>v.tracks[0].effect='other',v=>v.tracks[0].id=v.tracks[1].id,v=>v.tracks[0].slot=4,v=>v.tracks[0].samples[0].time=1,
  v=>v.tracks[0].samples[0].position[0]=NaN,v=>v.tracks[0].end+=1,v=>v.tracks[0].reason=null]){
  const bad=structuredClone(raw);change(bad);assert.throws(()=>readLapplandMotionInput(bad,SHA));
 }
 assert.equal(readLapplandMotionInput([{time:0,position:[0,0,0]}],SHA).kind,'movement');assert.throws(()=>readLapplandMotionInput([],SHA));
});
test('reentrant retirement during birth cannot leave motion for an already-invalid drone',()=>{
 const f=createLapplandMotionFixture();f.b.on('lapplandS3DroneBirth',()=>f.b.retreat(f.u,{permanent:true}),{priority:0});const recorder=recordLapplandS3Motion(f.b);
 f.activate();assert.equal(recorder.snapshot().tracks.length,0);assert.equal(f.controller.s3.drones.length,0);recorder.dispose();
});

test('Alpha Wolf extra drone is recorded at its actual delayed birth rather than backdated to the cast',()=>{
 const f=setup();f.advance(40.5);f.activate();f.advance(20.1);const tracks=f.recorder.snapshot().tracks;
 assert.equal(tracks.length,4);const extra=tracks.find(t=>t.slot===3);assert.ok(extra);near(extra.start,60);assert.equal(extra.samples[0].time,0);
 assert.ok(tracks.slice(0,3).every(t=>t.start===40.5));readLapplandMotionInput(f.recorder.snapshot(),SHA);f.recorder.dispose();
});
test('recording starts before a cast and does not invent birth history for already-running drones',()=>{
 const f=createLapplandMotionFixture();f.activate();const count=hooks(f.b);assert.throws(()=>recordLapplandS3Motion(f.b),/before skill activation/);assert.equal(hooks(f.b),count);
 const normal=createLapplandMotionFixture({skill:1}),r=recordLapplandS3Motion(normal.b);normal.enemy();normal.activate();normal.advance(1);assert.deepEqual(r.snapshot().tracks,[]);r.dispose();
});

test('multiple owners with identical slots retain independent motion and cleanup',()=>{
 const f=setup(),def=structuredClone(f.u.def),other=f.b._makeAlly(f.u.player,def,'op',8,5,{dir:'RIGHT'});
 const prepared=prepareLapplandAttacks(f.b,other,{contract:LAPPLAND_ATTACK_CONTRACT});f.b._setupUnit(other,prepared.kit);prepared.controller.install();assert.ok(f.b._deploy(other,{initial:false}));
 f.activate();other.skill.addCharge(1);assert.ok(prepared.controller.toggle());f.advance(.5);
 const report=f.recorder.snapshot();assert.equal(report.tracks.length,6);assert.equal(new Set(report.tracks.map(t=>t.id)).size,6);assert.equal(new Set(report.tracks.map(t=>t.owner)).size,2);
 f.u.skill.end('fixture');const before=f.recorder.snapshot().tracks.filter(t=>t.owner===String(f.u.id));f.advance(.5);
 assert.deepEqual(f.recorder.snapshot().tracks.filter(t=>t.owner===String(f.u.id)),before);
 assert.ok(f.recorder.snapshot().tracks.filter(t=>t.owner===String(other.id)).every(t=>t.end===null&&t.samples.at(-1).time>.5));f.recorder.dispose();
});
test('same-frame cast restart during a source birth records only the surviving generation',()=>{
 const f=setup();let restarted=false;f.b.on('lapplandS3DroneBirth',()=>{if(restarted)return;restarted=true;f.u.skill.end('fixture');f.activate();},{priority:0});
 f.activate();f.advance(.5);const report=f.recorder.snapshot();assert.equal(report.tracks.length,3);assert.ok(report.tracks.every(t=>t.generation===f.controller.modeEpoch));
 for(const d of f.controller.s3.drones)assert.deepEqual(report.tracks.find(t=>t.slot===d.slot).samples.at(-1).position,[d.x,0,d.y]);readLapplandMotionInput(report,SHA);f.recorder.dispose();
});
test('sample-budget overflow is explicit rather than silently exporting a truncated motion history',()=>{
 const raw={schemaVersion:1,kind:'lappland-s3-battle-motion',sourcePackSha256:SHA,scope:{simulationMotion:true,compiledFrameParity:false,enabledOperators:[]},tracks:[
  {id:'1',effect:LAPPLAND_S3_TRAIL_ROOT,owner:'fixture',deploySeq:1,generation:1,slot:0,start:0,end:null,reason:null,samples:Array.from({length:20001},(_,i)=>({time:i/30,position:[0,0,0]}))}]};
 assert.throws(()=>readLapplandMotionInput(raw,SHA),/history/);
});
test('live snapshots retain only current cruise segments and remain detached from controller history',()=>{
 const f=setup();f.enemy();assert.equal(f.recorder.activeSnapshot().tracks.length,0);f.activate();
 const initial=f.recorder.activeSnapshot();assert.equal(initial.tracks.length,3);initial.tracks[0].samples[0].position[0]=999;
 assert.notEqual(f.recorder.activeSnapshot().tracks[0].samples[0].position[0],999);
 f.advance(6);assert.equal(f.recorder.activeSnapshot().tracks.length,0);assert.equal(f.recorder.snapshot().tracks.length,3);
 f.recorder.dispose();assert.equal(f.recorder.activeSnapshot().tracks.length,0);
});
