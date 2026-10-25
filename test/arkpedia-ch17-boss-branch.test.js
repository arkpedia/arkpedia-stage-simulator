// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17BossBranch as install} from '../server/sim/content/chapter17-boss-branch.js';
import {chapter17BossBranchRecord as record} from '../server/sim/content/chapter17-boss-branch-records.js';
import {pollutionBrute} from '../server/sim/content/chapter17-brute.js';
import {pollute} from '../server/sim/content/chapter17.js';
import {chapter17BossCounterSnapshot as buttons,clickChapter17BossCounter as click} from '../server/sim/content/chapter17-boss-counter.js';
import {reviewBossBranch} from '../tools/arkpedia/boss-branch-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-boss-branch-contract.json'),source=read('data/candidates/arkpedia-stage-17-18-source.json'),canonical=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies,review=read('data/candidates/arkpedia-ch17-reviewed-brute.json');
const snake='enemy_1593_musnake',brute='enemy_10207_mubrut_2_a';
function fixture({autoFinish=false,operator=false}={}){
 const g=source.geometry,chars=g.tileLegend.map((_,i)=>String.fromCharCode(65+i));
 // Only canonical terrain is installed here. This fixture makes no claim to
 // room, story, device or complete stage admission.
 const stage={id:'internal-17-18-branch',rows:g.tileGrid.map(row=>row.map(i=>chars[i]).join('')),legend:Object.fromEntries(g.tileLegend.map((t,i)=>[chars[i],{height:t.height.toUpperCase(),build:t.deployable.toUpperCase(),pass:t.walkable?'ALL':t.flyable?'FLY':'NONE',key:t.key}]))};
 const h=makeBattle({stage,rect:{r0:0,r1:16,c0:0,c1:10},content:'none',autoFinish,timeLimit:1e6,defs:{chess:{branch_op:chessRec({id:'branch_op',stats:{maxHp:1e6,atk:0,def:0,blockCnt:3}})}},units:operator?[{chessId:'branch_op',row:11,col:7}]:[]});
 h.b.life=3;h.b.start();for(const u of h.allies())u.profile.noAttack=true;const waves=[];
 const branch=install(h.b,{stage:'17-18',finishWave:r=>waves.push(r)});return{h,b:h.b,branch,waves};
}
test('boss branch source receipt binds exact conditional actions, extra routes and isolated local records',()=>{
 for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.deepEqual(reviewBossBranch(source,canonical,review),{entries:contract.entries,records:contract.records});
 assert.deepEqual(contract.entries.map(e=>e.time),[3,6,9]);assert.deepEqual(contract.entries.map(e=>e.extraRouteIndex),[0,1,2]);
 assert.deepEqual(record('17-18',snake),canonical[snake].levels[0]);const r=record('17-18',brute);assert.equal(r.notCountInTotal,true);assert.equal(r.stats.lpr,1);assert.equal(r.stats.hitRatePhys,0);assert.equal(r.sp.increment,1);
 assert.throws(()=>pollutionBrute(r),/Unreviewed/);assert.throws(()=>pollutionBrute(r,{stage:'17-17'}),/Unreviewed/);assert.ok(pollutionBrute(r,{stage:'17-18'}));
 const changed=structuredClone(r);changed.stats.atk++;assert.throws(()=>pollutionBrute(changed,{stage:'17-18'}),/Unreviewed/);
});
test('branch offsets are relative to explicit start and pending branch work prevents premature clear',()=>{
 const f=fixture({autoFinish:true});f.b.time=7.25;assert.equal(f.branch.start(),true);assert.equal(f.branch.start(),false);const at=f.b.time;
 f.h.run(2.9);assert.equal(f.branch.spawned.length,0);assert.equal(f.b.finished,false);f.h.run(.2);assert.equal(f.branch.spawned.length,1);
 assert.ok(f.branch.spawned[0].enemy.mem.ch17SnakeCore?.active);f.b.kill(f.branch.spawned[0].enemy,null);assert.equal(f.b.killed,1);f.h.run(2.8);assert.equal(f.b.finished,false);assert.equal(f.branch.spawned.length,1);
 f.h.run(.2);assert.equal(f.branch.spawned.length,2);f.h.run(3.1);assert.equal(f.branch.spawned.length,3);
 for(const [i,s]of f.branch.spawned.entries()){assert.ok(Math.abs(s.time-at-contract.entries[i].time)<=f.b.dt+1e-6);assert.equal(s.enemy.mem.ch17BossBranch.extraRouteIndex,i);}
 assert.equal(f.b.total,1);for(const s of f.branch.spawned.slice(1)){assert.equal(s.enemy.counted,false);assert.equal(s.enemy.lpr,1);assert.ok(s.enemy.mem.ch17PollutionReaction);}
 for(const s of f.branch.spawned.slice(1))f.b.kill(s.enemy,null);f.h.step();assert.equal(f.b.finished,true);assert.equal(f.b.killed,1);assert.equal(f.branch.active,false);
 assert.deepEqual(f.b.errors,[]);
});
test('the canonical extra route reaches its first checkpoint and waits twenty world seconds without walking to its sentinel',()=>{
 const f=fixture();f.branch.start();f.h.run(6.1);const e=f.branch.spawned[1].enemy;
 assert.equal(f.h.runUntil(()=>e.route.waitLeft!==null,20),true);const at=f.b.time,pos=[e.y,e.x];assert.equal(e.y,12);assert.ok(Math.abs(e.x-9)<=.05+1e-6);assert.ok(e.route.waitLeft>19.9);
 f.h.run(19);assert.deepEqual([e.y,e.x],pos);assert.ok(e.route.waitLeft>0);assert.equal(e.route.legIdx,1);
 assert.equal(f.h.runUntil(()=>e.route.legIdx>1,2),true);assert.ok(f.b.time-at>=19.9);assert.ok(e.y>=0);assert.equal(e.route.visitEveryCheckPoint,false);assert.deepEqual(f.b.errors,[]);
});
test('a spawned local Brute keeps its native pollution triplet and DISABLE_COMBAT blocks its existing blocking attack',()=>{
 const f=fixture({operator:true});f.branch.start();f.h.run(6.1);const e=f.branch.spawned[1].enemy,u=f.h.allies()[0];assert.ok(u);
 e.base.moveSpeed=0;e.markDirty();e.x=u.x;e.y=u.y;assert.equal(f.b._checkBlock(e),true);const actor=e.mem.ab.list.find(a=>a.contact),hits=[];f.b.on('ch17BruteHit',c=>{if(c.attacker===e)hits.push(c);});
 f.b.addBuff(e,{key:'fixture:no-combat',flags:{noCombat:true}});pollute(f.b,e);assert.equal(actor.cast(),false);assert.equal(e.blockedBy,u);f.b.removeBuff(e,'fixture:no-combat');
 assert.equal(actor.cast(),true);f.h.run(2.3);assert.equal(hits.length,3);assert.ok(hits.every(h=>h.mode===1));assert.equal(actor.mode,0);assert.equal(e.s.atk,2100);assert.deepEqual(f.b.errors,[]);
});
test('branch snake terminal uses the actual final counter and forwards one native wave intent',()=>{
 const f=fixture();f.branch.start();f.h.run(3.1);const e=f.branch.spawned[0].enemy;
 f.b.dealDamage(null,e,{amount:e.s.maxHp*100,type:'true'});assert.equal(e.hp,1);f.h.run(.6);const button=buttons(f.b).find(c=>c.kind==='final');assert.ok(button);assert.equal(button.required,15);
 for(let i=0;i<15;i++)assert.equal(click(f.b,button),true);assert.equal(e.alive,false);assert.equal(f.waves.length,1);assert.equal(f.waves[0].source,e);assert.ok(f.waves[0].action.$type.endsWith('+FinishCurrentWave'));assert.equal(f.b.leakedCount,0);assert.equal(click(f.b,button),false);assert.deepEqual(f.b.errors,[]);
});
test('cancelling a branch stops only unborn work, while a born snake keeps its own lifecycle',()=>{
 const f=fixture();f.branch.start();f.h.run(3.1);const e=f.branch.spawned[0].enemy;f.branch.stop();f.h.run(7);assert.equal(f.branch.spawned.length,1);assert.equal(e.mem.ch17SnakeCore.active,true);assert.equal(f.branch.start(),false);
 assert.throws(()=>install(f.b,{stage:'17-18',finishWave:()=>{}}),/Only one/);assert.deepEqual(f.b.errors,[]);
 const g=fixture();g.branch.start();g.b.forceEnd('fixture');g.h.run(10);assert.equal(g.branch.spawned.length,0);assert.equal(g.branch.active,false);
});
test('reentrant branch starts cannot duplicate spawns, and a replaced spawn life is not given the original core',()=>{
 const f=fixture();f.b.on('enemySpawn',()=>assert.equal(f.branch.start(),false));f.branch.start();f.h.run(9.1);assert.equal(f.branch.spawned.length,3);assert.deepEqual(f.b.errors,[]);
 const g=fixture();g.b.on('enemySpawn',({enemy})=>{if(enemy.defId===snake)enemy.deploySeq++;});g.branch.start();g.h.run(3.1);const e=g.h.enemies().find(e=>e.defId===snake);assert.ok(e);assert.equal(e.mem.ch17SnakeCore,undefined);assert.equal(g.branch.spawned.length,0);assert.deepEqual(g.b.errors,[]);
});
test('branch source mutations reject wrong timing, scheduler flags, route space and active traversal changes',()=>{
 for(const mutate of [s=>s.rawLevel.branches.boss.phases[0].actions[1].preDelay=9,s=>s.rawLevel.branches.boss.phases[0].actions[0].managedByScheduler=false,s=>s.conditional[1].time=9,s=>s.rawLevel.extraRoutes[1].checkpoints[1].time=21,s=>s.rawLevel.extraRoutes[0].visitEveryCheckPoint=true,s=>s.rawLevel.extraRoutes[0].spawnOffset.x=1,s=>s.rawLevel.branches.boss.phases[0].actions[0].routeIndex=1]){
  const s=structuredClone(source);mutate(s);assert.throws(()=>reviewBossBranch(s,canonical,review),/Unreviewed|disagrees/);
 }
 const changed=structuredClone(review),native=changed.enemies.enemy_10207_mubrut_2.native,index=native.findIndex(s=>Object.hasOwn(JSON.parse(s),'_damageType')),component=JSON.parse(native[index]);component._damageType=2;native[index]=JSON.stringify(component);assert.throws(()=>reviewBossBranch(source,canonical,changed),/physical melee source/);
});
test('branch admission rejects foreign stage options and runtime overrides before scheduling',()=>{
 const f=fixture();assert.throws(()=>install(f.b,{stage:'17-17',finishWave:()=>{}}),/canonical/);assert.throws(()=>install(f.b,{stage:'17-18'}),/canonical/);
 f.b.enemyOverrides[brute]={stats:{atk:1}};assert.throws(()=>f.branch.start(),/runtime override/);assert.equal(f.branch.started,false);assert.equal(f.b._sched.some(s=>s.holdsBattle),false);
 delete f.b.enemyOverrides[brute];assert.equal(f.branch.start(),true);assert.deepEqual(f.b.errors,[]);
});
test('a battle ending inside spawn observers does not receive a late snake core or branch mutation',()=>{
 const f=fixture();f.b.on('enemySpawn',()=>f.b.forceEnd('fixture'));f.branch.start();f.h.run(3.1);
 assert.equal(f.b.finished,true);assert.equal(f.branch.active,false);assert.equal(f.branch.spawned.length,0);const e=f.b.enemies.find(e=>e.defId===snake);assert.ok(e);assert.equal(e.mem.ch17SnakeCore,undefined);assert.equal(e.mem.ch17BossBranch,undefined);assert.deepEqual(f.b.errors,[]);
});
