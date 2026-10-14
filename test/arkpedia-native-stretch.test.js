// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createParticleStretch,particleWorldVelocity}from'../shared/arkpedia/native-particle-stretch.js';import{createParticlePivot}from'../shared/arkpedia/native-particle-pivot.js';
import f from'./fixtures/arkpedia-particle-stretch.json'with{type:'json'};import m from'../data/arkpedia-particle-stretch.json'with{type:'json'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),source=()=>structuredClone(Object.values(f)[0].data);
const probe={position:[1,2,3],velocity:[0,2,0],size:[2,3,4],cameraPosition:[1,2,9],rotation:0};
test('all 52 original stretched renderer controls retain an explicit unverified native geometry boundary',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-particle-stretch.json',import.meta.url));assert.equal(raw.length,m.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),m.fixture.sha256);
 assert.deepEqual(m.counts,{renderers:52,matrices:156});assert.equal(m.scope.nativeBasisOrderVerified,false);assert.equal(m.scope.compiledFrameParity,false);assert.deepEqual(m.scope.enabledOperators,[]);
});
for(const[id,row]of Object.entries(f))test(id+' binds original signed length and pivot to a validated velocity renderer',()=>{
 const s=structuredClone(row.data),before=structuredClone(s),stretch=createParticleStretch(s),pivot=createParticlePivot(s,{stretch}),frame=stretch.sample(probe),matrix=pivot.sample(frame);
 assert.deepEqual(frame.slice(0,3),[2,0,0]);near(frame[5],3*s.m_LengthScale);assert.deepEqual(frame.slice(12,15),probe.position);
 for(let i=0;i<3;i++)near(matrix[i]*s.m_Pivot.x+matrix[i+4]*s.m_Pivot.y+matrix[i+8]*s.m_Pivot.z+matrix[i+12],probe.position[i]);
 assert.deepEqual(s,before);assert.equal(stretch.scope.nativeBasisOrderVerified,false);assert.equal(stretch.ownsRenderer(structuredClone(s)),false);
 assert.throws(()=>createParticlePivot(s),/mode\/alignment/);assert.deepEqual(stretch.sample(probe),frame);
});
test('legacy head-on thinning and signed/zero lengths preserve geometry instead of selecting an arbitrary camera heading',()=>{
 const s=source();s.m_LengthScale=-2;const stretch=createParticleStretch(s),frame=stretch.sample(probe);near(frame[5],-6);
 const head=stretch.sample({...probe,cameraPosition:[1,8,3]});assert.deepEqual(head.slice(0,3),[0,0,0]);near(head[5],-6);
 const diagonal=stretch.sample({...probe,cameraPosition:[1,8,9]});near(Math.hypot(...diagonal.slice(0,3)),Math.SQRT2);
 assert.equal(stretch.sample({...probe,velocity:[0,0,0]}),null);assert.equal(stretch.sample({...probe,cameraPosition:probe.position}),null);
 s.m_LengthScale=0;assert.equal(stretch.ownsRenderer(s),false);const zero=createParticleStretch(s).sample(probe);assert.deepEqual(zero.slice(4,7),[0,0,0]);
});
test('velocity reconstruction retains world displacement, simulated clocks and one-sided momentum at birth',()=>{
 const p={birthTime:1,lifetime:2},at=t=>[t*t,2*t,-t];
 const calls=[],velocity=particleWorldVelocity(p,1,(t,p)=>{calls.push(t);return at(t);},2);near(velocity[0],2+1/60);near(velocity[1],2);near(velocity[2],-1);assert.deepEqual(calls,[1,1+1/60]);
 const current=particleWorldVelocity(p,1.5,at,2);near(current[0],3-1/60);near(current[1],2);near(current[2],-1);
 const prewarm=particleWorldVelocity({birthTime:-1,lifetime:2},0,at,1);assert.ok(prewarm.every(Number.isFinite));
 assert.deepEqual(particleWorldVelocity(p,1.5,at,2),current);assert.deepEqual(p,{birthTime:1,lifetime:2});
 for(const args of[[p,.5,at,1],[p,3,at,1],[p,1,at,0],[p,1,()=>[NaN,0,0],1],[p,1,null,1]])assert.throws(()=>particleWorldVelocity(...args));
});
test('unknown stretch controls and invalid frame inputs remain held',()=>{
 for(const mutate of[s=>s.m_CameraVelocityScale=1,s=>s.m_VelocityScale=1,s=>s.m_FreeformStretching=true,s=>s.m_LengthScale=NaN,s=>s.m_RenderMode=0,s=>s.m_RenderAlignment=1,s=>s.m_AllowRoll=false,s=>s.m_RotateWithStretchDirection=false]){const s=source();mutate(s);assert.throws(()=>createParticleStretch(s),/controls/);}
 const stretch=createParticleStretch(source());for(const mutate of[p=>p.size=[1,2],p=>p.velocity=[NaN,1,0],p=>p.rotation=Infinity,p=>p.position=[-1e308,0,0]]){const p=structuredClone(probe);mutate(p);if(p.position[0]===-1e308)p.cameraPosition=[1e308,0,0];assert.throws(()=>stretch.sample(p));}
});
