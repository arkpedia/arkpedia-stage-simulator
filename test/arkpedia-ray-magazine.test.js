// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-ray-prefabs.json' with {type:'json'};
import { RayMagazine, SandbeastMagazine } from '../server/sim/content/arkpedia-ray-magazine.js';
const ID='char_4117_ray', TOKEN='token_10034_ray_sndbst';
const bb=rows=>Object.fromEntries(rows.map(r=>[r.key,r.value]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function empty(m){for(let i=0;i<m.capacity;i++)assert.equal(m.commitFire(0),true);}

for(const elite of[0,1,2])test(`Ray E${elite} starts full and loads at original fixed interval`,()=>{
 const m=new RayMagazine({elite});assert.deepEqual(m.ammoUi,{current:[4,6,8][elite],maximum:[4,6,8][elite]});
 empty(m);assert.equal(m.commitFire(0),false);const r=m.beginReload(0);near(r.interval,1.6);
 assert.equal(m.finishReload(1.599,r.generation),0);assert.equal(m.finishReload(1.6,r.generation),1);
 assert.equal(m.finishReload(99,r.generation),0);assert.equal(m.bullets,1);
});
for(const direction of['RIGHT','LEFT','UP','DOWN'])test(`${direction} preserves separate ordinary/S2/S3 native mode gates`,()=>{
 const m=new RayMagazine({elite:2,direction});assert.equal(m.modeIndex,0);
 assert.equal(m.setSkillMode(2,0),direction==='DOWN'?2:1);
 assert.equal(m.setSkillMode(3,0),direction==='DOWN'?5:4);near(m.reloadInterval,.4);
 m.commitFire(0);assert.equal(m.setSkillMode(3,0),direction==='DOWN'?6:3);
 assert.equal(m.canFire,false);assert.equal(m.breakForFire(0),null);
 const r=m.beginReload(0);assert.equal(m.finishReload(.4,r.generation),1);
 assert.equal(m.modeIndex,direction==='DOWN'?5:4);assert.equal(m.canFire,true);
 m.setSkillMode(0,.4);near(m.reloadInterval,1.6);
});
test('late fixed refill produces one bullet and never catches up extra attacks',()=>{
 const m=new RayMagazine({elite:2});empty(m);const r=m.beginReload(0);assert.equal(m.finishReload(40,r.generation),1);assert.equal(m.bullets,1);assert.equal(m.reload,null);
});
test('partial normal refill may break but empty refill must finish first',()=>{
 const m=new RayMagazine({elite:2});m.commitFire(0);const r=m.beginReload(0),breakInfo=m.breakForFire(.5);
 near(breakInfo.breakTime,evidence.models[ID].Front.durations.Reload_Break);
 assert.equal(m.finishReload(1.6,r.generation),0);assert.equal(m.bullets,7);
 m.commitFire(1.6);assert.equal(m.reloadFlag,false);
 const e=new RayMagazine({elite:2});empty(e);const q=e.beginReload(0);assert.equal(e.breakForFire(.5),null);assert.equal(e.finishReload(1.6,q.generation),1);
});
test('reload detach/control cannot add ammunition or consume queued S1 kill bonus',()=>{
 const m=new RayMagazine({elite:2});empty(m);m.queueKillReload(2);const r=m.beginReload(0);m.cancelReload(.8);
 assert.equal(m.finishReload(1.6,r.generation),0);assert.equal(m.bullets,0);assert.equal(m.extra,2);
 const q=m.beginReload(1.6);assert.equal(m.finishReload(3.2,q.generation,{canAct:false}),0);
 assert.equal(m.finishReload(3.3,q.generation),3);assert.equal(m.extra,0);
});
test('conditional native flag reset cannot clear while still in attack state',()=>{
 const m=new RayMagazine({elite:2});m.commitFire(0);m.beginReload(0);m.cancelReload(.5);
 assert.equal(m.resetFlag(.699),false);assert.equal(m.resetFlag(.7,{attacking:true}),false);
 assert.equal(m.reloadFlag,true);assert.equal(m.resetFlag(.8),true);assert.equal(m.reloadFlag,false);
});
test('S1 special projectile does not consume ordinary ammunition even at zero',()=>{
 const m=new RayMagazine({elite:2});empty(m);assert.equal(m.commitFire(0,{special:true}),true);assert.equal(m.bullets,0);
 assert.equal(m.commitFire(0),false);
});
test('all S1 ranks preserve accumulating next-refill kill bonus with capacity clamp',()=>{
 for(const rank of evidence.tables.skills.skchr_ray_1.levels){const m=new RayMagazine({elite:2});empty(m);const n=bb(rank.blackboard).cnt;m.queueKillReload(n);m.queueKillReload(n);const r=m.beginReload(0);assert.equal(m.finishReload(1.6,r.generation),1+2*n);assert.equal(m.extra,0);const q=m.beginReload(1.6);assert.equal(m.finishReload(3.2,q.generation),1);}
 const m=new RayMagazine({elite:0});m.commitFire(0);m.queueKillReload(20);const r=m.beginReload(0);assert.equal(m.finishReload(1.6,r.generation),1);assert.equal(m.extra,0);assert.equal(m.bullets,4);
});
test('S3 must refill every missing bullet before attack, then does not re-enter initial fill on normal consumption',()=>{
 const m=new RayMagazine({elite:2});empty(m);m.setSkillMode(3,0);
 for(let i=0;i<8;i++){const r=m.beginReload(i*.4);assert.equal(m.breakForFire(i*.4),null);m.finishReload((i+1)*.4,r.generation);assert.equal(m.canFire,i===7);}
 assert.equal(m.bullets,8);assert.equal(m.commitFire(3.2),true);assert.equal(m.canFire,true);
});
test('changing mode invalidates old reload work and restores the correct interval',()=>{
 const m=new RayMagazine({elite:2});empty(m);const r=m.beginReload(0);m.setSkillMode(3,.5);
 assert.equal(m.finishReload(1.6,r.generation),0);const q=m.beginReload(1.6);near(q.interval,.4);
 m.setSkillMode(0,1.8);assert.equal(m.finishReload(2,q.generation),0);const z=m.beginReload(2);near(z.interval,1.6);
});
for(const elite of[1,2])test(`Sandbeast E${elite} counter is independent, capped and returned once`,()=>{
 const owner=new RayMagazine({elite}),token=new SandbeastMagazine({elite,enabled:true});
 empty(owner);for(let i=0;i<token.capacity+5;i++)token.collect();assert.equal(token.collected,[6,8][elite-1]);assert.equal(owner.bullets,0);
 assert.equal(token.finish(owner,{emptySeed:0}),owner.capacity);assert.equal(token.finish(owner,{emptySeed:0}),0);assert.equal(token.collect(),false);
 assert.equal(token.capacity,bb(evidence.tables.tokens[TOKEN].trait.candidates[elite-1].blackboard).value);
});
test('Sandbeast refund consumes queued extra once and needs explicit zero-bullet seed contract',()=>{
 const owner=new RayMagazine({elite:2});empty(owner);owner.queueKillReload(2);const token=new SandbeastMagazine({elite:2,enabled:true});token.collect();
 assert.throws(()=>token.finish(owner),/contract/);assert.equal(token.finished,false);assert.equal(owner.extra,2);assert.equal(owner.bullets,0);
 assert.equal(token.finish(owner,{emptySeed:0}),3);assert.equal(owner.extra,0);assert.equal(owner.bullets,3);
});
test('Sandbeast counters stay disabled with S1/S3; owner removal prevents resurrection or transfer',()=>{
 const owner=new RayMagazine({elite:2}),token=new SandbeastMagazine({elite:2,enabled:false});assert.equal(token.collect(),false);assert.equal(token.finish(owner,{emptySeed:0}),0);
 const active=new SandbeastMagazine({elite:2,enabled:true});active.collect();owner.commitFire(0);const r=owner.beginReload(0);owner.remove(.5);
 assert.equal(active.finish(owner,{emptySeed:0}),0);assert.equal(owner.finishReload(2,r.generation),0);assert.equal(owner.commitFire(2,{special:true}),false);assert.equal(owner.canFire,false);
});
test('source resource rejects invalid builds, negative/fractional counters and time reversal',()=>{
 assert.throws(()=>new RayMagazine({elite:3}));assert.throws(()=>new RayMagazine({elite:1,direction:'diagonal'}));
 const m=new RayMagazine({elite:2});m.cancelReload(1);assert.throws(()=>m.beginReload(.9));assert.throws(()=>m.beginReload(NaN));assert.throws(()=>m.queueKillReload(-1));assert.throws(()=>m.receiveCollected(.5,{emptySeed:0}));assert.throws(()=>new SandbeastMagazine({elite:0,enabled:true}));
});
