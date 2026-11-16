// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDeviceSp,deviceSp,addDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {makeBattle} from './helpers/battleHarness.js';
function fixture(){const h=makeBattle({content:'none',autoFinish:false});h.b.start();const u=h.b.spawnDevice('SP-fixture',10,6);let sp=0,active=false;const off=registerDeviceSp(h.b,u,{get:()=>sp,add:n=>{if(active)return 0;const before=sp;sp=Math.min(500,sp+n);return sp-before;}});return{...h,u,off,setActive:v=>active=v};}
test('device SP adapters expose the existing gauge and its capacity/active rules without copying state',()=>{
 const h=fixture();assert.equal(deviceSp(h.b,h.u),0);assert.equal(addDeviceSp(h.b,h.u,20),20);assert.equal(deviceSp(h.b,h.u),20);assert.equal(addDeviceSp(h.b,h.u,1000),480);assert.equal(deviceSp(h.b,h.u),500);
 h.setActive(true);assert.equal(addDeviceSp(h.b,h.u,1),0);assert.deepEqual(h.b.errors,[]);
});
test('SP refusal, lifecycle and provider replacement preserve battle/deployment ownership',()=>{
 const h=fixture(),other=fixture();h.b.addBuff(h.u,{key:'noSP',flags:{noSp:true}});assert.equal(addDeviceSp(h.b,h.u,10),0);h.b.removeBuff(h.u,'noSP');assert.equal(addDeviceSp(other.b,h.u,10),0);
 assert.throws(()=>registerDeviceSp(h.b,h.u,{get:()=>0,add:()=>0}),/Duplicate/);h.u.deploySeq++;assert.equal(deviceSp(h.b,h.u),null);assert.equal(addDeviceSp(h.b,h.u,10),0);
 let count=4;registerDeviceSp(h.b,h.u,{get:()=>count,add:n=>(count+=n,n)});h.off();assert.equal(deviceSp(h.b,h.u),4);assert.equal(addDeviceSp(h.b,h.u,2),2);assert.equal(count,6);h.b.kill(h.u);assert.equal(deviceSp(h.b,h.u),null);assert.equal(addDeviceSp(h.b,h.u,2),0);
});
test('the ordinary SkillRuntime boundary remains available and malformed additions fail before callbacks',()=>{
 const h=fixture();h.off();let sp=0,calls=0;h.u.skill={noSkill:false,get sp(){return sp;},gainSp(n,reason){assert.equal(reason,'nativeBuff');calls++;sp+=n;return n;}};
 assert.equal(addDeviceSp(h.b,h.u,3.5),3.5);assert.equal(deviceSp(h.b,h.u),3.5);const other=fixture();assert.equal(addDeviceSp(other.b,h.u,2),0);assert.equal(deviceSp(other.b,h.u),null);for(const n of[-1,Infinity,NaN,1000001,'2'])assert.throws(()=>addDeviceSp(h.b,h.u,n));assert.equal(calls,1);
});
