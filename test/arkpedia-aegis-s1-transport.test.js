// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance} from './helpers/aegis-fixture.js';
import {AegisSkillOneTransport,AEGIS_S1_TRANSPORT_CONTRACT,verifyAegisS1Transport} from '../server/sim/content/arkpedia-aegis-s1-transport.js';
import {aegisNativeInputs} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[],make=opts=>{const f=fixture({...opts,defer:true});fs.push(f);const payload=new AegisSkillOneTransport(f.b,f.u,{contract:AEGIS_S1_TRANSPORT_CONTRACT});f.deploy();payload.bind();return{...f,payload};};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const launch=(f,t,more={})=>assert.equal(f.payload.launch({target:t,attackId:1,...more}),true),hits=f=>f.hits.filter(h=>h.dmg.tags.includes('aegis:s1'));
test('Original selected S1, one deployment and exact transport contract are required',()=>{
 assert.deepEqual(verifyAegisS1Transport(),{delay:.20000000298023224,radius:1.100000023841858,lifeTime:10});
 const f=fixture({defer:true});assert.throws(()=>new AegisSkillOneTransport(f.b,f.u),/exact transport/);assert.throws(()=>make({skill:2}),/exact transport/);
 const g=make();assert.throws(()=>g.payload.bind(),/one living/);assert.throws(()=>new AegisSkillOneTransport(g.b,g.u,{contract:AEGIS_S1_TRANSPORT_CONTRACT}),/Fresh selected/);
});
for(const field of['radius','motion','hit','life','cache','follow','immediate','delay','stop','forcedPrimary','fallback'])test(`Changed ${field} cannot retain original Aegis S1 payload approval`,()=>{
 const n=structuredClone(aegisNativeInputs()),parts=n.projectiles.projectile_chr_aigis_s1.flatMap(r=>r.components),body=parts.find(p=>p.data._lifeTime!=null).data,
  move=parts.find(p=>p.data._immediatelyReach!=null).data,area=parts.find(p=>p.data._onlyCheckHitWhenStop!=null).data;
 if(field==='radius')parts.find(p=>p.type==='CircleCollider2D').data.m_Radius=2;if(field==='motion')area._targetOptions.targetMotion=2;
 if(field==='hit')body._hitNumType=1;if(field==='life')body._managedBySource=1;if(field==='cache')n.modes[2].attack._useCachedAtkOnly=1;
 if(field==='follow')move._followTarget=1;if(field==='immediate')move._immediatelyReach=0;if(field==='delay')move._delayTime=1;
 if(field==='stop')area._onlyCheckHitWhenStop=0;if(field==='forcedPrimary')body._alwaysHitTraceTargetInTheEnd=1;
 if(field==='fallback')n.modes[2].attack._emitToInputPosWhenTargetIsInvalid=0;assert.throws(()=>verifyAegisS1Transport(n),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} uses live S1 holder ATK with a delayed radius1.1 mixed-motion impact`,()=>{
 const f=make({rank,skillFlight:true});assert.ok(f.flight.beginSkillOne());assert.ok(f.flight.completeLanding());
 const a=enemy(f),air=enemy(f,{col:7.5,motion:'FLY'}),edge=enemy(f,{col:8.1}),outside=enemy(f,{col:8.101});launch(f,a);
 assert.equal(f.b.projectiles.list[0].x,a.x);assert.equal(f.b.projectiles.list[0].target,null);advance(f.b,.1);assert.equal(hits(f).length,0);
 f.b.addBuff(f.u,{key:'fixture:late-atk',mods:{atkPct:1,atkScaleMul:2}});const expected=f.u.s.atk*f.u.s.atkScaleMul*f.u.s.physDealtMul;
 advance(f.b,.2);assert.equal(hits(f).length,3);for(const t of[a,air,edge])near(t.s.maxHp-t.hp,expected);near(outside.hp,outside.s.maxHp);
 assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);assert.equal(hits(f).find(h=>h.target===a).dmg.isSplash,false);
});
test('Distance, ASPD, source slow-down and speed auras do not turn reached-delay into homing travel',()=>{
 for(const col of[7,17]){const f=make(),a=enemy(f,{col});f.b.addBuff(f.u,{key:'fixture:clock',mods:{aspd:400,slowDownMul:.1}});
  f.b.projectiles.registerSpeedAura({owner:f.u,contains:()=>true,scale:.01});launch(f,a);advance(f.b,.1);assert.equal(hits(f).length,0);
  advance(f.b,.14);assert.equal(hits(f).length,1);near(hits(f)[0].time,.2,1e-6);
 }
});
test('Impact stays at the reached point; a primary that leaves the radius is not force-included',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a);a.x=15;f.b._buildEnemyIndex();advance(f.b,.3);
 assert.equal(hits(f).length,1);assert.equal(hits(f)[0].target.id,other.id);near(a.hp,a.s.maxHp);
});
test('Recipients entering before stop are included while those leaving before stop are excluded',()=>{
 const f=make(),a=enemy(f),leave=enemy(f,{col:7.2}),enter=enemy(f,{col:10});launch(f,a);leave.x=10;enter.x=7.3;f.b._buildEnemyIndex();advance(f.b,.3);
 assert.deepEqual(hits(f).map(h=>h.target.id).sort(),[a.id,enter.id].sort());near(leave.hp,leave.s.maxHp);
});
for(const flag of['stealth','untargetable','sleep','hidden'])test(`${flag} recipients are excluded without a special retained-primary bypass`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.3});launch(f,a);
 if(flag==='hidden'){a.hidden=true;other.hidden=true;}else{f.b.addBuff(a,{key:'fixture:flag',flags:{[flag]:true}});f.b.addBuff(other,{key:'fixture:flag',flags:{[flag]:true}});}
 advance(f.b,.3);assert.equal(hits(f).length,0);
});
test('The native area check ignores camouflage and applies shared Physical mitigation separately per victim',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.3,flags:{camou:true}});a.base.def=100;a.markDirty();
 launch(f,a);f.b.addBuff(f.u,{key:'fixture:penetration',mods:{defIgnoreFlat:50,physDealtMul:2}});const atk=f.u.s.atk,scale=f.u.s.physDealtMul;advance(f.b,.3);
 near(hits(f).find(h=>h.target===a).amount,(atk-50)*scale);near(hits(f).find(h=>h.target===other).amount,atk*scale);
});
for(const change of['dead','replacement','hidden'])test(`${change} input can use the explicitly retained input position without homing to a new life`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),life=a.deploySeq,x=a.x,y=a.y;
 if(change==='dead')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}if(change==='hidden')a.hidden=true;
 launch(f,a,{life,x,y});advance(f.b,.3);assert.equal(hits(f).length,1);assert.equal(hits(f)[0].target.id,other.id);
});
for(const event of['outputDamage','hit','calculatedDamage'])test(`${event} recipient replacement cannot reuse a captured old-life area action`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.on(event,c=>{if(c.dmg.tags.includes('aegis:s1')&&c.target===a)other.deploySeq++;});
 launch(f,a);advance(f.b,.3);assert.equal(hits(f).length,1);near(other.hp,other.s.maxHp);
});
test('The one stop is claimed before damage callbacks can replay it',()=>{
 const f=make(),a=enemy(f);launch(f,a);const p=[...f.payload.flights.keys()][0];
 f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('aegis:s1'))p.onHit({x:a.x,y:a.y});});advance(f.b,.3);assert.equal(hits(f).length,1);
});
test('Uncached damage reads live ATK for each separately dispatched area action',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),atk=f.u.s.atk,scale=f.u.s.physDealtMul;
 f.b.on('damaged',c=>{if(c.target===a&&c.dmg.tags.includes('aegis:s1'))f.b.addBuff(f.u,{key:'fixture:between',mods:{atkPct:1}});});
 launch(f,a);advance(f.b,.3);near(hits(f).find(h=>h.target===a).amount,atk*scale);near(hits(f).find(h=>h.target===other).amount,atk*scale*2);
});
for(const reason of['retreat','death','replacement'])test(`Born payload survives source ${reason} with its documented launch view and old ledger`,()=>{
 const f=make(),a=enemy(f),atk=f.u.s.atk,scale=f.u.s.physDealtMul,ledger=f.u.stats;launch(f,a);
 if(reason==='death')f.b.kill(f.u,null);else f.b.retreat(f.u);
 if(reason==='replacement'){f.u.deploySeq++;f.u.stats={...ledger,dmg:0};f.u.base.atk=9999;f.u.markDirty();}
 advance(f.b,.3);assert.equal(hits(f).length,1);near(hits(f)[0].amount,atk*scale);assert.equal(hits(f)[0].source.stats,ledger);assert.notEqual(hits(f)[0].source,f.u);
 assert.equal(f.payload.watchers.length,0);assert.equal(f.payload.launch({target:a}),false);
});
test('Source retirement inside the first action irreversibly switches later actions to the old launch view',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),atk=f.u.s.atk,scale=f.u.s.physDealtMul,ledger=f.u.stats;
 f.b.on('outputDamage',c=>{if(c.target!==a||!c.dmg.tags.includes('aegis:s1'))return;
  f.b.retreat(f.u);Object.assign(f.u,{alive:true,deployed:true,removed:false,stats:{...ledger,dmg:0}});f.u.base.atk=9999;f.u.markDirty();
 });launch(f,a);advance(f.b,.3);const later=hits(f).find(h=>h.target===other);assert.ok(later);near(later.amount,atk*scale);assert.equal(later.source.stats,ledger);assert.notEqual(later.source,f.u);
});
for(const why of['intercept','battleEnd','drain'])test(`${why} removes born payload and every owned watcher without delayed output`,()=>{
 const f=make(),a=enemy(f);launch(f,a);if(why==='intercept')f.b.removeProjectiles(p=>f.payload.flights.has(p));
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(why==='drain')f.payload.drain();advance(f.b,.5);
 assert.equal(hits(f).length,0);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);assert.equal(f.b.projectiles.list.length,0);
});
