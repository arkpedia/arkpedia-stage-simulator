// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectileSystem} from '../server/sim/projectiles.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const setup=()=>new ProjectileSystem({_safe:fn=>fn()});
test('Native start delay holds a legally born speed projectile and only advances the post-boundary part of a step',()=>{
 const ps=setup();let hits=0,moves=0;const p=ps.add({to:{x:5,y:0},speed:20,startDelay:.25,onHit:()=>hits++,onMove:()=>moves++});
 ps.update(.2);near(p.x,0);assert.equal(moves,0);assert.equal(hits,0);ps.update(.1);near(p.x,1);assert.equal(moves,1);ps.update(.2);near(p.x,5);assert.equal(hits,1);ps.update(1);assert.equal(hits,1);
});
test('A zero-distance native projectile cannot impact before its delay completes',()=>{
 const ps=setup();let hits=0;ps.add({to:{x:0,y:0},startDelay:.25,onHit:()=>hits++});ps.update(.2);assert.equal(hits,0);ps.update(.05);assert.equal(hits,1);
});
test('One coarse step and split steps preserve the same delayed speed transport',()=>{
 const a=setup(),b=setup(),p=a.add({to:{x:10,y:0},speed:20,startDelay:.25}),q=b.add({to:{x:10,y:0},speed:20,startDelay:.25});a.update(.6);for(let i=0;i<12;i++)b.update(.05);near(p.x,7);near(q.x,p.x);
});
test('A delayed homing projectile follows the current target and does not cache its birth position as destination',()=>{
 const ps=setup(),t={x:5,y:0,alive:true,hidden:false,deploySeq:1};let hit;const p=ps.add({target:t,startDelay:.25,speed:20,onHit:c=>hit=c});ps.update(.2);t.x=2;ps.update(.1);near(p.x,1);ps.update(.05);assert.equal(hit.target,t);near(hit.x,2);
});
for(const change of['dead','hidden','life'])test(`A target ${change} during the start delay still fizzles an ordinary homing projectile`,()=>{
 const ps=setup(),t={x:5,y:0,alive:true,hidden:false,deploySeq:1};let hits=0;ps.add({target:t,startDelay:.25,onHit:()=>hits++});ps.update(.1);
 if(change==='dead')t.alive=false;if(change==='hidden')t.hidden=true;if(change==='life')t.deploySeq++;ps.update(.2);assert.equal(hits,0);assert.equal(ps.list.length,0);
});
test('Delayed fixed-time transport keeps an independent travel duration after its start delay',()=>{
 const ps=setup();let hits=0;const p=ps.add({to:{x:10,y:0},flightTime:1,startDelay:.25,speed:100,onHit:()=>hits++});ps.update(.25);near(p.x,0);ps.update(.5);near(p.x,5);assert.equal(hits,0);ps.update(.5);near(p.x,10);assert.equal(hits,1);
 const q=ps.add({to:{x:10,y:0},flightTime:12,startDelay:2});assert.equal(q.maxAge,14);
});
test('Start delay is not multiplied by a projectile speed aura, and interceptors see only post-delay travel',()=>{
 const ps=setup(),u={alive:true,deployed:true,deploySeq:1};let intercepts=0;ps.registerSpeedAura({owner:u,contains:()=>true,scale:.5});ps.registerInterceptor({owner:u,intercept:()=>{intercepts++;return false;}});
 const p=ps.add({to:{x:10,y:0},speed:20,startDelay:.25});ps.update(.2);near(p.x,0);assert.equal(intercepts,0);ps.update(.1);near(p.x,.5);assert.equal(intercepts,1);near(p.startDelay,.25);
});
test('Explicit maxAge remains a birth-time cap while expire-in-place movement excludes the native wait',()=>{
 const ps=setup();let hit;const p=ps.add({to:{x:10,y:0},speed:20,startDelay:.25,maxAge:.4,expireInPlace:true,onHit:c=>hit=c});ps.update(1);near(p.x,3);near(hit.x,3);assert.equal(ps.list.length,0);
});
test('Removing a delayed projectile or clearing the battle cannot later deliver it',()=>{
 const ps=setup();let hits=0;const p=ps.add({startDelay:.25,onHit:()=>hits++});assert.equal(ps.remove(q=>q===p),1);ps.update(1);assert.equal(hits,0);ps.add({startDelay:.25,onHit:()=>hits++});ps.clear();ps.update(1);assert.equal(hits,0);
});
for(const startDelay of[undefined,0,-1,Infinity,NaN,'0.25'])test(`Invalid/absent native delay ${String(startDelay)} retains the legacy speed clock and object shape`,()=>{
 const ps=setup();let hits=0;const p=ps.add({to:{x:2,y:0},speed:2,startDelay,onHit:()=>hits++});assert.equal('startDelay'in p,false);ps.update(1);assert.equal(hits,1);near(p.x,2);
});
