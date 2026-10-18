// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {ProjectileSystem} from '../server/sim/projectiles.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const setup=()=>{const errors=[],b={_safe:(fn,label)=>{try{return fn();}catch(e){errors.push(label);}}};return{ps:new ProjectileSystem(b),errors};};
test('Source motion replaces the speed step while shared arrival delivers once at its actual endpoint',()=>{
 const{ps,errors}=setup();let hit,moves=0;const p=ps.add({to:{x:20,y:0},speed:1,advanceMotion:({projectile:p,dt})=>({x:p.x+10*dt,y:2,reached:p.age>=.5}),onMove:()=>moves++,onHit:c=>hit=c});
 ps.update(.2);near(p.x,2);near(p.y,2);assert.equal(hit,undefined);ps.update(.3);near(hit.x,5);near(hit.y,2);assert.equal(moves,2);assert.equal(ps.list.length,0);ps.update(1);assert.equal(moves,2);assert.deepEqual(errors,[]);
});
test('Native source motion receives current target coordinates and original target life tracking',()=>{
 const{ps}=setup(),t={x:5,y:0,alive:true,hidden:false,deploySeq:1},seen=[];ps.add({target:t,advanceMotion:({projectile:p})=>{seen.push([p.tx,p.ty,p.target?.deploySeq??null]);return{x:p.x,y:p.y,reached:false};}});
 ps.update(.1);t.x=7;t.y=2;ps.update(.1);t.deploySeq++;ps.update(.1);assert.deepEqual(seen,[[5,0,1],[7,2,1]]);assert.equal(ps.list.length,0);
});
for(const kind of['dead','hidden','replacement'])test(`hitDead source motion freezes its last destination after target ${kind}`,()=>{
 const{ps}=setup(),t={x:5,y:0,alive:true,hidden:false,deploySeq:1},seen=[];let hit;
 ps.add({target:t,hitDead:true,advanceMotion:({projectile:p})=>{seen.push([p.tx,p.ty,p.target?.deploySeq??null]);return{x:p.tx,y:p.ty,reached:p.age>.2};},onHit:c=>hit=c});
 ps.update(.1);if(kind==='dead')t.alive=false;if(kind==='hidden')t.hidden=true;if(kind==='replacement')t.deploySeq++;t.x=99;
 ps.update(.2);assert.deepEqual(seen,[[5,0,1],[5,0,null]]);assert.equal(hit.target,null);near(hit.x,5);
});
test('A start delay holds custom motion and only exposes the post-delay, pre-expiry part of a coarse step',()=>{
 const{ps}=setup(),steps=[];const p=ps.add({startDelay:.25,maxAge:.6,advanceMotion:c=>{steps.push({dt:c.dt,expires:c.expires});return{x:c.projectile.x+c.dt,y:0,reached:false};}});
 ps.update(.2);assert.deepEqual(steps,[]);ps.update(.2);near(steps[0].dt,.15);ps.update(1);near(steps[1].dt,.2);assert.equal(steps[1].expires,true);near(p.x,.35);assert.equal(ps.list.length,0);
});
test('Finite expiry without an explicitly reached source state never fabricates a hit',()=>{
 const{ps}=setup();let hits=0;ps.add({maxAge:.2,advanceMotion:()=>({x:1,y:2,reached:false}),onHit:()=>hits++});ps.update(1);assert.equal(ps.list.length,0);assert.equal(hits,0);
 ps.add({maxAge:.2,advanceMotion:({projectile:p,expires})=>({x:p.tx,y:p.ty,reached:expires}),onHit:()=>hits++});ps.update(1);assert.equal(hits,1);
});
test('Interceptors see the actual custom segment before a reached source can dispatch damage',()=>{
 const{ps}=setup(),u={alive:true,deployed:true,deploySeq:1},segments=[];let hits=0;
 ps.registerInterceptor({owner:u,intercept:c=>{segments.push([c.from.x,c.from.y,c.to.x,c.to.y]);return true;}});
 ps.add({from:{x:1,y:2},advanceMotion:()=>({x:3,y:4,reached:true}),onHit:()=>hits++});ps.update(.1);
 assert.deepEqual(segments,[[1,2,3,4]]);assert.equal(hits,0);assert.equal(ps.list.length,0);
});
test('A source mover receives the shared projectile speed aura without scaling its world-clock dt',()=>{
 const{ps}=setup(),u={alive:true,deployed:true,deploySeq:1};let contains=0;ps.registerSpeedAura({owner:u,contains:()=>{contains++;return true;},scale:.5});let ctx;
 ps.add({advanceMotion:c=>{ctx=c;return{x:0,y:0,reached:false};}});ps.update(.2);near(ctx.dt,.2);near(ctx.speedScale,.5);near(ctx.projectile.age,.2);assert.equal(contains,1);
});
for(const state of[null,{},false,{x:NaN,y:0,reached:true},{x:0,y:Infinity,reached:true},{x:0,y:0},{x:0,y:0,reached:1}])test(`Invalid source state ${JSON.stringify(state)} fizzles without a hit`,()=>{
 const{ps}=setup();let hits=0;const p=ps.add({advanceMotion:()=>state,onHit:()=>hits++});ps.update(.1);assert.equal(ps.list.length,0);assert.equal(p.removed,true);assert.equal(hits,0);
});
test('A throwing source mover is reported once and cannot leak an unfinished projectile',()=>{
 const{ps,errors}=setup();let hits=0;ps.add({advanceMotion:()=>{throw Error('fixture');},onHit:()=>hits++});ps.update(.1);ps.update(1);
 assert.deepEqual(errors,['projectile.advanceMotion']);assert.equal(hits,0);assert.equal(ps.list.length,0);
});
for(const phase of['mover','onMove','otherArrival'])test(`Removal from ${phase} prevents a captured reached custom impact`,()=>{
 const{ps}=setup();let p,hits=0;
 if(phase==='otherArrival')ps.add({to:{x:0,y:0},onHit:()=>ps.remove(q=>q===p)});
 p=ps.add({advanceMotion:()=>{if(phase==='mover')ps.remove(q=>q===p);return{x:1,y:1,reached:true};},onMove:()=>{if(phase==='onMove')ps.remove(q=>q===p);},onHit:()=>hits++});
 ps.update(.1);assert.equal(hits,0);assert.equal(ps.list.length,0);
});
for(const phase of['mover','onMove','otherArrival'])test(`Clearing from ${phase} cancels captured custom motion and later arrivals`,()=>{
 const{ps}=setup();let hits=0;
 if(phase==='otherArrival')ps.add({to:{x:0,y:0},onHit:()=>ps.clear()});
 ps.add({advanceMotion:()=>{if(phase==='mover')ps.clear();return{x:1,y:1,reached:true};},onMove:()=>{if(phase==='onMove')ps.clear();},onHit:()=>hits++});
 ps.update(.1);assert.equal(hits,0);assert.equal(ps.list.length,0);assert.equal(ps.arriving.length,0);
});
for(const value of[undefined,null,false,1,{},'motion'])test(`Absent/invalid source mover ${JSON.stringify(value)} preserves legacy object shape and speed arrival`,()=>{
 const{ps}=setup();let hits=0;const p=ps.add({to:{x:1,y:0},speed:2,advanceMotion:value,onHit:()=>hits++});assert.equal('advanceMotion'in p,false);ps.update(.5);near(p.x,1);assert.equal(hits,1);
});

test('Custom motion without start delay also receives only its remaining finite lifetime',()=>{
 const{ps}=setup(),steps=[];ps.add({maxAge:.3,advanceMotion:({projectile:p,dt,expires})=>{steps.push([dt,expires]);return{x:p.x+dt,y:0,reached:false};}});
 ps.update(.2);ps.update(1);near(steps[0][0],.2);near(steps[1][0],.1);assert.equal(steps[1][1],true);assert.equal(ps.list.length,0);
});
