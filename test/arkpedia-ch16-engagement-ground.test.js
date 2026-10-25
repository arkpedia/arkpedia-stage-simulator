// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{makeBattle}from'./helpers/battleHarness.js';
import{attach,installFeatureDispatch}from'../server/sim/content/enemies.js';
import{miner}from'../server/sim/content/chapter16.js';
import{blockMcreep}from'../server/sim/content/chapter16-engagement.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const key='enemy_10120_uaghst',mk='enemy_3010_mcreep';
test('retained miner movement selector is WALK_ONLY',()=>{
 const rows=read('candidates/arkpedia-ch16-native-10120.json').prefabs['dyn/battle/prefabs/enemies/'+key+'.prefab'];
 const select=JSON.parse(rows.find(r=>r.objectName==='SelectNearestMcreep'&&!r.referenced).originalJson);
 const selector=JSON.parse(rows.find(r=>r.pathId===select._selector.m_PathID).originalJson);
 assert.equal(selector._targetMotion,1);assert.equal(selector._buffKey,'enemy_mcreep_able_to_be_blocked');
});
for(const flag of['flying','liftoff'])test(`new movement links and the melee selector exclude ${flag} miners`,()=>{
 const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,defs:{enemies:{[key]:records[key].levels[0],[mk]:records[mk].levels[0]}}});
 h.b.start();const e=h.spawn(key,{pos:[10,7]}),m=h.spawn(mk,{pos:[10,7.5]});
 attach(h.b,e,[blockMcreep({cnt:3,range:.9,rangeAdd:.1,attackRange:1})]);attach(h.b,m,[miner(records[mk].levels[0])]);
 e.base.moveSpeed=m.base.moveSpeed=0;e.atkCd=m.atkCd=1e6;e.markDirty();m.markDirty();
 let buff;if(flag==='flying')m.motion='FLY';else buff=h.b.addBuff(m,{key:'lifted',persist:true,flags:{liftoff:true}});
 const a=e.mem.ab.list[0];assert.equal(e.profile.meleeTarget(),null);h.run(.34);assert.equal(a.engagements.size,0);
 if(flag==='flying')m.motion='WALK';else h.b.removeBuff(m,buff);
 h.run(.34);assert.equal(a.engagements.size,1);assert.equal(e.profile.meleeTarget(),m);assert.deepEqual(h.b.errors,[]);
});
