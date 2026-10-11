// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createEffectTrail,createEffectTrajectory} from '../shared/arkpedia/native-effect-trail.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function source(){return {m_Enabled:true,m_Emitting:true,m_Autodestruct:false,m_Time:1,m_MinVertexDistance:.1,
 m_Parameters:{alignment:0,textureMode:0,numCapVertices:0,numCornerVertices:0,generateLightingData:false,widthMultiplier:2,
 widthCurve:{m_PreInfinity:2,m_PostInfinity:2,m_Curve:[{time:0,value:1,inSlope:-1,outSlope:-1,weightedMode:0},{time:1,value:0,inSlope:-1,outSlope:-1,weightedMode:0}]},
 colorGradient:{m_Mode:0,m_NumColorKeys:2,m_NumAlphaKeys:2,ctime0:0,ctime1:65535,atime0:0,atime1:65535,key0:{r:1,g:0,b:0,a:1},key1:{r:0,g:0,b:1,a:0}}}};}
const history=[{time:0,position:[0,0,0]},{time:.1,position:[.2,0,0]},{time:.2,position:[1,0,0]}];
test('trail gradients, width and stretch UV follow distance along the trail rather than age or index',()=>{
 const s=source(),before=structuredClone(s),d=createEffectTrail(s).sample(.5,history,[0,0,5]);
 assert.deepEqual(d.points.map(p=>p.time),[.2,.1,0]);
 const us=[0,.8,1];
 us.forEach((u,i)=>{
  near(d.uvs[i*4],u);near(d.widths[i],2*(1-u));
  const a=d.positions.slice(i*6,i*6+3),b=d.positions.slice(i*6+3,i*6+6);
  near(Math.hypot(...a.map((v,k)=>v-b[k])),d.widths[i]);
  d.colors.slice(i*8,i*8+4).forEach((v,k)=>near(v,[1-u,0,u,1-u][k]));
  assert.deepEqual(d.colors.slice(i*8,i*8+4),d.colors.slice(i*8+4,i*8+8));
 });
 assert.deepEqual(d.indices,[0,1,2,1,3,2,2,3,4,3,5,4]);assert.deepEqual(s,before);
});
test('minimum distance rejects repeated or short moves, lifetime expires old points, rewind drops future points',()=>{
 const s=source(),t=createEffectTrail(s),h=[history[0],{time:.05,position:[.01,0,0]},...history.slice(1),{time:.3,position:[1,0,0]}];
 assert.deepEqual(t.sample(.5,h,[0,0,5]).points.map(p=>p.time),[.2,.1,0]);
 assert.deepEqual(t.sample(1.1,h,[0,0,5]).points.map(p=>p.time),[.2]);
 assert.deepEqual(t.sample(2,h,[0,0,5]).indices,[]);
 const early=t.sample(.15,h,[0,0,5]);assert.deepEqual(early.points.map(p=>p.time),[.1,0]);
 assert.deepEqual(t.sample(.15,h,[0,0,5]),early);
 assert.deepEqual(t.sample(.1,[{time:0,position:[0,0,0]},{time:.1,position:[0,0,0]}],[0,0,5]).indices,[]);
});
test('emission pause lets old points fade and resume does not refresh their clocks',()=>{
 const t=createEffectTrail(source()),h=[...history,{time:.3,position:[2,0,0],emitting:false},{time:1.3,position:[3,0,0]}];
 assert.deepEqual(t.sample(.5,h,[0,0,5]).points.map(p=>p.time),[.2,.1,0]);
 assert.equal(t.sample(1.2,h,[0,0,5]).points.length,0);
 assert.deepEqual(t.sample(1.3,h,[0,0,5]).points.map(p=>p.time),[1.3]);
 const off=source();off.m_Emitting=false;assert.deepEqual(createEffectTrail(off).sample(.5,history,[0,0,5]).indices,[]);
});
test('camera-facing ribbons stay finite at reversal, camera poles and zero width',()=>{
 const t=createEffectTrail(source()),h=[{time:0,position:[0,0,0]},{time:.1,position:[1,0,0]},{time:.2,position:[0,0,0]}];
 for(const camera of [[0,0,0],[5,0,0],[0,0,5]]){
  const d=t.sample(.3,h,camera);assert.ok(d.positions.every(Number.isFinite));assert.equal(d.positions.length,18);
  for(let i=0;i<d.points.length;i++){
   const centre=d.positions.slice(i*6,i*6+3).map((v,k)=>(v+d.positions[i*6+3+k])/2);
   centre.forEach((v,k)=>near(v,d.points[i].position[k]));
  }
 }
});
test('unsupported trail modes and malformed motion are rejected rather than silently approximated',()=>{
 for(const [key,value]of [['alignment',1],['textureMode',1],['numCapVertices',2],['numCornerVertices',2],['generateLightingData',true]]){
  const s=source();s.m_Parameters[key]=value;assert.throws(()=>createEffectTrail(s),/needs review/);
 }
 const s=source();s.m_Parameters.widthCurve.m_Curve[0].weightedMode=1;assert.throws(()=>createEffectTrail(s),/Weighted/);
 const t=createEffectTrail(source());assert.throws(()=>t.sample(0,[history[1],history[0]],[0,0,1]),/Unordered/);
 assert.throws(()=>t.sample(0,[{time:0,position:[NaN,0,0]}],[0,0,1]),/Invalid/);
 assert.throws(()=>t.sample(0,history,[Infinity,0,1]),/Invalid/);
 for(const h of [[],[{time:1,position:[0,0,0]}],[history[0],history[0]],[{time:0,position:[1,2]}]])assert.throws(()=>createEffectTrajectory(h));
});
test('recorded movement interpolates explicit samples and preserves history across arbitrary scrubs',()=>{
 const input=[history[0],{time:1,position:[2,4,6]}],before=structuredClone(input),m=createEffectTrajectory(input);
 assert.deepEqual(m.sample(.25),[.5,1,1.5]);assert.deepEqual(m.sample(-1),[0,0,0]);assert.deepEqual(m.sample(2),[2,4,6]);
 assert.deepEqual(m.times(.25),[0,.25]);assert.deepEqual(m.times(1),[0,1]);assert.deepEqual(m.times(2),[0,1,2]);
 m.sample(2);assert.deepEqual(m.sample(.25),[.5,1,1.5]);assert.deepEqual(input,before);
 input[1].position[0]=100;assert.deepEqual(m.sample(.25),[.5,1,1.5]);assert.equal(m.scope.compiledFrameParity,false);
});
test('all 27 pinned native trail profiles replay source widths and lifetime without enabling Lappland battle support',async t=>{
 let raw;try{raw=await readFile('.cache/arkpedia/lappland-alter-source/effects/native-effects.bin');}catch(error){if(error.code==='ENOENT'){t.skip('Original native source cache unavailable');return;}throw error;}
 assert.equal(createHash('sha256').update(raw).digest('hex'),'4b3f9646b38f84eee29667053d265bde63a3756bd600e3f558fb28d97b94dbc5');
 const pack=JSON.parse(gunzipSync(raw)),records=Object.values(pack.records).filter(r=>r.type==='TrailRenderer');assert.equal(records.length,27);
 const h=Array.from({length:121},(_,i)=>({time:i/60,position:[i/60,.05*Math.sin(i/20),0]}));
 for(const r of records){const s=r.data,t=createEffectTrail(s),d=t.sample(1,h,[0,0,5]);
  assert.equal(s.m_Materials.length,1);
  assert.ok(d.indices.length>0);assert.ok(d.positions.every(Number.isFinite));
  near(d.widths[0],s.m_Parameters.widthMultiplier*s.m_Parameters.widthCurve.m_Curve[0].value);
  assert.ok(d.points.every(p=>1-p.time<s.m_Time));assert.deepEqual(t.sample(1,h,[0,0,5]),d);
  assert.equal(t.scope.compiledFrameParity,false);
 }
 const meta=JSON.parse(await readFile('data/arkpedia-lappland-effects.json'));assert.deepEqual(meta.scope.enabledOperators,[]);assert.equal(meta.scope.rendererVerified,false);
});
