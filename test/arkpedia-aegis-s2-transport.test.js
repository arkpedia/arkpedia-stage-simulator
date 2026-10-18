// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/aegis-fixture.js';
import {AegisSkillTwoTransport,AEGIS_S2_TRANSPORT_CONTRACT,verifyAegisS2Transport} from '../server/sim/content/arkpedia-aegis-s2-transport.js';
import {aegisNativeInputs} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[],make=opts=>{const f=fixture({skill:2,...opts,defer:true});fs.push(f);const payload=new AegisSkillTwoTransport(f.b,f.u,{contract:AEGIS_S2_TRANSPORT_CONTRACT});f.deploy();payload.bind();return{...f,payload};};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('aegis:s2')),launch=(f,target,more={})=>{const p=f.payload.launch({target,attackId:7,...more});assert.ok(p);return p;};
test('Exact selected S2, fresh deployment and all six original mover identities are required',()=>{
 const n=verifyAegisS2Transport();assert.deepEqual(n.missiles.map(p=>p.period),[.25,.30000001192092896,.25,.4000000059604645,.4000000059604645,.4000000059604645]);
 assert.deepEqual(n.missiles.map(p=>p.ratio),[.375,.625,.25,.75,0,1]);assert.deepEqual(n.missiles.map(p=>p.mount),[18,21,19,22,20,23]);
 const f=fixture({skill:2,defer:true});assert.throws(()=>new AegisSkillTwoTransport(f.b,f.u),/exact transport/);assert.throws(()=>make({skill:1}),/exact transport/);
 const g=make();assert.throws(()=>g.payload.bind(),/one living/);assert.throws(()=>g.payload.launch({kind:'guess'}),/Exact Aegis/);assert.throws(()=>g.payload.launch({index:7}),/Exact Aegis/);
});
for(const change of['count','mount','cache','radius','motion','life','period','near','inherit','ratio','speed','inertia','kickDelay','kickFollow'])test(`Changed ${change} cannot retain original S2 transport approval`,()=>{
 const n=structuredClone(aegisNativeInputs()),parts=n.projectiles.projectile_chr_aigis_s2_1.flatMap(r=>r.components),d=parts.map(p=>p.data),
  kick=n.projectiles.projectile_chr_aigis_s2_kick.flatMap(r=>r.components).map(p=>p.data),first=d.find(p=>p._addInertia===1),control=d.find(p=>p._periodTimeSlots);
 if(change==='count')n.s2Missiles._additionalTimes=4;if(change==='mount')n.s2Missiles._mountPointGroup.reverse();if(change==='cache')n.s2Kick._useCachedAtkOnly=1;
 if(change==='radius')parts.find(p=>p.type==='CircleCollider2D').data.m_Radius=2;if(change==='motion')d.find(p=>p._targetOptions)._targetOptions.targetMotion=2;
 if(change==='life')d.find(p=>p._lifeTime!=null)._stopWhenSourceInvalid=1;if(change==='period')control._periodTimeSlots[0]=1;
 if(change==='near')control._nearTargetDistance=2;if(change==='inherit')control._inheritDirectionWhenSwitch=0;if(change==='ratio')first._sourceDirectionArcAngleRatio=.5;
 if(change==='speed')first._speed=8;if(change==='inertia')first._addInertia=0;if(change==='kickDelay')kick.find(p=>p._immediatelyReach!=null)._delayTime=1;
 if(change==='kickFollow')kick.find(p=>p._immediatelyReach!=null)._followTarget=1;assert.throws(()=>verifyAegisS2Transport(n),/Changed original/);
});
for(let index=1;index<=6;index++)test(`Missile${index} keeps its original prefab, mount and staged curved trajectory before one radius1.1 impact`,()=>{
 const f=make(),a=enemy(f,{col:13}),nearby=enemy(f,{col:13.5,motion:'FLY'}),outside=enemy(f,{col:14.101});const p=launch(f,a,{index});
 assert.equal(p.projectile.data.projectileKey,'projectile_chr_aigis_s2_'+index);assert.equal(p.projectile.data.mount,[18,21,19,22,20,23][index-1]);
 advance(f.b,.1);assert.equal(hits(f).length,0);assert.equal(p.motion.stage,0);assert.ok(p.projectile.x>f.u.x);
 assert.ok(index%2===1?p.projectile.y<f.u.y:p.projectile.y>f.u.y);until(f,()=>p.finished,3);
 assert.equal(p.motion.stage,1);assert.equal(hits(f).length,2);near(hits(f)[0].amount,f.u.s.atk*f.record.bb.atk_scale*f.u.s.physDealtMul);
 assert.ok(hits(f).some(h=>h.target===nearby));near(outside.hp,outside.s.maxHp);assert.equal(f.payload.watchers.length,0);
});
test('A near input switches immediately to direct homing without inventing a minimum curved-flight duration',()=>{
 const f=make(),a=enemy(f,{col:6});const p=launch(f,a,{index:5});advance(f.b,.04);assert.equal(p.motion.stage,1);near(p.projectile.y,5);until(f,()=>p.finished,1);assert.equal(hits(f).length,1);
});
test('The same geometric substeps reproduce a coarse update and split updates',()=>{
 const a=make(),b=make(),p=launch(a,enemy(a,{col:15}),{index:6}),q=launch(b,enemy(b,{col:15}),{index:6});
 a.b.projectiles.update(.5);for(let i=0;i<20;i++)b.b.projectiles.update(.025);near(p.projectile.x,q.projectile.x,1e-6);near(p.projectile.y,q.projectile.y,1e-6);assert.equal(p.motion.stage,q.motion.stage);
});
test('Owner ASPD and slowdown cannot stretch the born missile mover or its stage clock',()=>{
 const a=make(),b=make();b.b.addBuff(b.u,{key:'fixture:clock',mods:{aspd:300,slowDownMul:.1}});
 const p=launch(a,enemy(a,{col:15}),{index:5}),q=launch(b,enemy(b,{col:15}),{index:5});advance(a.b,.2);advance(b.b,.2);
 near(p.projectile.x,q.projectile.x);near(p.projectile.y,q.projectile.y);near(p.motion.age,q.motion.age);
});
test('Left presentation mirrors the original ratio fan relative to the input bearing',()=>{
 const a=make({dir:'RIGHT'}),b=make({dir:'LEFT'}),p=launch(a,enemy(a,{col:13}),{index:5}),q=launch(b,enemy(b,{col:13}),{index:5});advance(a.b,.1);advance(b.b,.1);
 near(p.projectile.x,q.projectile.x);near(p.projectile.y-5,5-q.projectile.y);
});
test('Shared projectile speed reduction scales travel independently from the original phase clock',()=>{
 const a=make(),b=make();b.b.projectiles.registerSpeedAura({owner:b.u,contains:()=>true,scale:.5});
 const p=launch(a,enemy(a,{col:15}),{index:5}),q=launch(b,enemy(b,{col:15}),{index:5});advance(a.b,.2);advance(b.b,.2);
 near(p.motion.age,q.motion.age);assert.ok(Math.hypot(q.projectile.x-5,q.projectile.y-5)<Math.hypot(p.projectile.x-5,p.projectile.y-5)*.6);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank} reads live ATK and selected missile/kick coefficients independently`,()=>{
 const f=make({rank}),a=enemy(f,{col:13});launch(f,a);f.b.addBuff(f.u,{key:'fixture:late',mods:{atkPct:1,atkScaleMul:2}});const atk=f.u.s.atk*f.u.s.atkScaleMul,scale=f.u.s.physDealtMul;
 until(f,()=>hits(f).length===1,3);near(hits(f)[0].amount,atk*f.record.bb.atk_scale*scale);const before=[f.u.tileR,f.u.tileC,f.u.x,f.u.y];
 const kick=launch(f,a,{kind:'kick'});assert.equal(kick.projectile.target,null);assert.equal(kick.projectile.x,a.x);advance(f.b,.1);assert.equal(hits(f).length,1);
 advance(f.b,.07);assert.equal(hits(f).length,2);near(hits(f)[1].amount,atk*f.record.bb.kick_atk_scale*scale);assert.deepEqual([f.u.tileR,f.u.tileC,f.u.x,f.u.y],before);assert.equal(kick.finished,true);
});
test('Kick stops at its captured reached position, affects ground/air in radius2 and cannot force a moved primary back in',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:8.5,motion:'FLY'}),edge=enemy(f,{col:9}),outside=enemy(f,{col:9.01});const p=launch(f,a,{kind:'kick'});a.x=15;
 advance(f.b,.2);assert.equal(p.finished,true);assert.equal(hits(f).length,2);assert.ok(hits(f).some(h=>h.target===other));assert.ok(hits(f).some(h=>h.target===edge));near(a.hp,a.s.maxHp);near(outside.hp,outside.s.maxHp);
});
for(const state of['dead','hidden','replacement'])test(`Missile target ${state} keeps its last destination instead of redirecting to the changed input`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});const p=launch(f,a);if(state==='dead')f.b.kill(a,null);if(state==='hidden')a.hidden=true;if(state==='replacement'){a.deploySeq++;a.x=15;}
 until(f,()=>p.finished,2);assert.equal(hits(f).length,1);assert.equal(hits(f)[0].target.id,other.id);near(p.projectile.x,7);
});
test('A target moving within its retained life remains a homing missile input',()=>{
 const f=make(),a=enemy(f,{col:13}),p=launch(f,a,{index:6});advance(f.b,.1);a.x=11;a.y=7;until(f,()=>p.finished,3);near(p.projectile.x,11);near(p.projectile.y,7);assert.equal(hits(f).length,1);
});
for(const kind of['missile','kick'])for(const flag of['stealth','untargetable','sleep'])test(`${kind} area check excludes ${flag} recipients without a retained-primary bypass`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2,flags:{[flag]:true}}),p=launch(f,a,{kind});f.b.addBuff(a,{key:'fixture:primary',flags:{[flag]:true}});
 until(f,()=>p.finished,2);assert.equal(hits(f).length,0);near(other.hp,other.s.maxHp);
});
test('Both source area types ignore camouflage and apply Physical mitigation per action',()=>{
 const f=make(),a=enemy(f,{flags:{camou:true}});a.base.def=100;a.markDirty();f.b.addBuff(f.u,{key:'fixture:penetration',mods:{defIgnoreFlat:50}});
 for(const kind of['missile','kick']){const before=hits(f).length,p=launch(f,a,{kind});until(f,()=>p.finished,2);assert.equal(hits(f).length,before+1);
  near(hits(f).at(-1).amount,(f.u.s.atk*f.record.bb[kind==='kick'?'kick_atk_scale':'atk_scale']-50)*f.u.s.physDealtMul);}
});
for(const kind of['missile','kick'])test(`${kind} claims its impact before a damage callback can replay its hit handler`,()=>{
 const f=make(),a=enemy(f),p=launch(f,a,{kind});f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('aegis:s2'))p.projectile.onHit({x:a.x,y:a.y});});until(f,()=>p.finished,2);assert.equal(hits(f).length,1);
});
for(const event of['outputDamage','hit','calculatedDamage'])test(`${event} cannot give an old captured area action to a replacement recipient`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.on(event,c=>{if(c.target===a&&c.dmg.tags.includes('aegis:s2'))other.deploySeq++;});const p=launch(f,a,{kind:'kick'});
 until(f,()=>p.finished,2);assert.equal(hits(f).length,1);near(other.hp,other.s.maxHp);
});
for(const why of['retreat','death','replacement'])test(`Born missiles survive source ${why} on the original launch view and damage ledger`,()=>{
 const f=make(),a=enemy(f,{col:13}),atk=f.u.s.atk,scale=f.u.s.physDealtMul,ledger=f.u.stats,p=launch(f,a);
 if(why==='death')f.b.kill(f.u,null);else f.b.retreat(f.u);if(why==='replacement'){f.u.deploySeq++;f.u.base.atk=9999;f.u.stats={...ledger,dmg:0};f.u.markDirty();}
 until(f,()=>p.finished,3);assert.equal(hits(f).length,1);near(hits(f)[0].amount,atk*f.record.bb.atk_scale*scale);assert.equal(hits(f)[0].source.stats,ledger);assert.notEqual(hits(f)[0].source,f.u);
 assert.equal(f.payload.launch({target:a}),null);assert.equal(f.payload.watchers.length,0);
});
test('Native mover timeout explicitly reaches the last point at its finite boundary without inventing a forced primary hit',()=>{
 const f=make(),a=enemy(f),p=launch(f,a);a.x=10000;f.b.kill(a,null);p.projectile.tx=10000;f.b.projectiles.update(10);
 assert.equal(p.finished,true);assert.equal(p.claimed,true);near(p.projectile.x,10000);assert.equal(hits(f).length,0);assert.equal(f.payload.watchers.length,0);
});
for(const why of['intercept','drain','battleEnd'])test(`${why} finishes invalidation tickets and owned watchers without pending damage`,()=>{
 const f=make(),a=enemy(f),p=launch(f,a),kick=launch(f,a,{kind:'kick'});
 if(why==='intercept')f.b.removeProjectiles(q=>f.payload.flights.has(q));if(why==='drain')f.payload.drain();if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}
 advance(f.b,1);assert.equal(p.finished,true);assert.equal(kick.finished,true);assert.equal(f.payload.active(p),false);assert.equal(hits(f).length,0);assert.equal(f.payload.watchers.length,0);
});
