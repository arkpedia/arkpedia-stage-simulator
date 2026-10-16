// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near,until} from './helpers/mcnist-fixture.js';
import {MCNIST_CONTRACT as CONTRACT} from '../server/sim/content/arkpedia-mcnist.js';
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)test(`Selected complete Mechanist S${skill}/rank ${rank} composes the source owner, original McGraf, barriers and expected activation`,()=>{
 const f=make({skill,rank}),e=enemy(f,{x:skill===3?12:6,y:5});if(skill!==1)until(f,()=>f.u.skill.ready,50);
 const t=f.controller.deck.place(5,9);assert.equal(f.controller.deck,t.ownerUnit.mem.mcgrafLifecycle);assert.equal(f.controller.record.index,skill-1);assert.equal(f.u.mem.mcnistAttacks,f.controller.owner);assert.equal(t.mem.mcgrafAttacks.token,true);assert.equal(f.resources.tokens.get(t).life,t.deploySeq);
 if(skill===1){until(f,()=>f.u.skill.active,25);until(f,()=>f.hits.some(h=>h.dmg.tags?.includes('mcnist:s1-burst')),3);assert.equal(f.u.skill.spTotal,0);}
 else{until(f,()=>f.u.skill.ready,50);assert.equal(f.u.skill.activate('fixture'),true);if(skill===2){const bar=f.controller.owner.shields.entries.get(t);assert.ok(bar);near(bar.buff.shield,350);}else{assert.equal(t.alive,false);until(f,()=>f.controller.deck.arrivals===1,3);assert.equal(f.controller.deck.point.unit.mem.mcgrafS3Aura.active(),true);}}
 assert.equal(e.alive,true);assert.deepEqual(f.b.errors,[]);
});
test('E0 selected S1 installs no token card or hidden alternate McGraf fallback',()=>{
 const f=make({elite:0,skill:1,rank:4});assert.equal(f.controller.deck,null);assert.equal(f.b.regularSummons?.size??0,0);assert.equal(f.resources.tokens.size,0);enemy(f,{x:6,y:5});until(f,()=>f.hits.length>0,3);assert.equal(f.controller.valid(),true);
});
for(const skill of[1,2,3])for(const mode of['stop','retreat','battle-end'])test(`Complete S${skill} ${mode} disposes its linked card/token and owner hooks`,()=>{
 const f=make({skill}),t=f.controller.deck.place(5,9);if(mode==='stop')f.controller.stop();if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='battle-end'){f.b.finished=true;f.b.emit('battleEnd',{});}
 assert.equal(f.controller.stopped,true);assert.equal(f.controller.deck.stopped,true);assert.equal(f.controller.owner.handles.length,0);assert.equal(f.controller.deck.handles.length,0);assert.equal(t.alive,false);assert.equal(f.b.regularSummons.size,0);assert.equal(f.resources.tokens.size,0);
});
test('A complete-controller battle-end stop also removes independent born charge transport',()=>{
 const f=make({skill:3});f.controller.deck.place(5,9);f.u.skill.setSpTotal(f.u.skill.spCost);f.u.skill.activate('fixture');assert.ok(f.controller.deck.flight);f.controller.stop(true);assert.equal(f.controller.deck.transports.size,0);assert.equal(f.controller.deck.transportHandles.length,0);assert.equal(f.b.projectiles.list.length,0);
});
test('Selected complete Mechanist refuses cloned/missing contract, changed source inputs and reinstall',()=>{
 assert.throws(()=>make({contract:{...CONTRACT}}));assert.throws(()=>make({contract:null}));assert.throws(()=>make({mutate:d=>d.stats.atk++}));const f=make();assert.throws(()=>f.controller.install());assert.equal(f.b.regularSummons.size,1);assert.equal(CONTRACT.frameParity,false);
});
test('Low-rank S2 natural recovery does not illegally extend an earlier McGraf lifetime',()=>{
 const f=make({skill:2,rank:1}),t=f.controller.deck.place(5,9);until(f,()=>f.u.skill.ready,50);assert.equal(t.alive,false);assert.equal(f.controller.deck.stock,1);assert.ok(f.controller.deck.readyAt>f.b.time);assert.equal(f.u.skill.activate('fixture'),true);assert.equal(f.controller.owner.shields.entries.has(t),false);assert.equal(f.controller.owner.shields.entries.has(f.u),true);assert.equal(f.resources.tokens.size,0);
});
