// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { VARKIS_ID as ID, selectedVarkisBuild } from '../server/sim/content/arkpedia-varkis-source.js';
import { prepareVarkisResources, VARKIS_RESOURCE_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-varkis-resources.js';
import { near, advance } from './helpers/mon3tr-fixture.js';
function make({rank=10,skill=2,contract=CONTRACT,mutate}={}) {
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite:2,level:80,potential:1,trust:0,module:'none',skillId:`skchr_varkis_${skill}`,skillRank:rank},r=selectedVarkisBuild(build);
 const def=normalizeChess({chessId:ID,charId:ID,name:'Varkáris',profession:'WARRIOR',position:'MELEE',subProfessionId:'centurion',
  stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,arkpedia:build,
  skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid,trigger:{rule:'NEVER'}}});
 mutate?.(def);const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',3,3,{dir:'RIGHT'});
 const c=prepareVarkisResources(b,u,{contract});
 // Diagnostic modes only. No native attack/cast/FSM controller is installed.
 b._setupUnit(u,{talents:[],skill:{kind:'duration',duration:30,trigger:{rule:'NEVER'}},trait:{noAttack:true}});
 c.install();assert.ok(b._deploy(u));
 return {b,u,c,r,shield:()=>u.findBuff(c.key)?.shield??0};
}
for(let rank=1;rank<=10;rank++)test(`rank ${rank} S2 converts only excess accepted healing, caps and uses the shared damage barrier`,()=>{
 const f=make({rank}),{b,u,c}=f;c.setSourceMode(1);const missing=u.s.maxHp*.02;u.hp-=missing;
 const amount=u.s.maxHp*f.r.bb['attack@hp_ratio'];near(b.heal(u,u,amount),missing);near(f.shield(),amount-missing);
 b.heal(u,u,u.s.maxHp*3);near(f.shield(),u.s.maxHp);
 b.dealDamage(null,u,{amount:100,type:'true',canDodge:false});near(f.shield(),u.s.maxHp-100);near(u.hp,u.s.maxHp);
 assert.deepEqual(b.errors,[]);
});
test('ordinary mode and S1 never turn healing into this S2 barrier',()=>{
 for(const skill of [1,2]){const f=make({skill});f.b.heal(f.u,f.u,100);near(f.shield(),0);}
 assert.throws(()=>make({skill:1}).c.setSourceMode(1));
});
test('healing modifiers settle before overflow; heal-free and skipped modifier paths produce no barrier',()=>{
 const f=make(),{b,u,c}=f;c.setSourceMode(1);
 b.addBuff(u,{key:'qa:healing',mods:{healingTakenMul:.5}});
 b.heal(u,u,200);near(f.shield(),100);
 b.addBuff(u,{key:'qa:heal-free',flags:{healFree:true}});b.heal(u,u,300);near(f.shield(),100);
 b.removeBuff(u,'qa:heal-free');u.hp-=100;b.heal(u,u,200,{skipModifierEvent:true});near(f.shield(),100);
 b.heal(u,u,300,{regen:true});near(f.shield(),100);
});
test('external accepted healing also converts overflow and an earlier rejected heal cannot grant capacity',()=>{
 const f=make(),{b,u,c}=f;c.setSourceMode(1);b.heal(null,u,500);near(f.shield(),500);
 const h=b.on('heal',ctx=>{if(ctx.target===u)ctx.amount=0;});b.heal(null,u,1000);near(f.shield(),500);b.off(h);
});
test('barrier remains after active mode and loses 100 once each passive second, including consumed capacity',()=>{
 const f=make(),{b,u,c}=f;c.setSourceMode(1);b.heal(u,u,550);advance(b,2.4);near(f.shield(),550);
 c.setSourceMode(0);advance(b,.5);near(f.shield(),550);advance(b,.11);near(f.shield(),450);
 b.dealDamage(null,u,{amount:175,type:'true',canDodge:false});near(f.shield(),275);
 advance(b,1);near(f.shield(),175);advance(b,2);near(f.shield(),0);
});
test('recurring active mode suspends decay without replacing previously retained capacity',()=>{
 const f=make(),{b,u,c}=f;c.setSourceMode(1);b.heal(u,u,500);c.setSourceMode(0);advance(b,1.1);near(f.shield(),400);
 c.setSourceMode(1);advance(b,3);near(f.shield(),400);b.heal(u,u,200);near(f.shield(),600);
 c.setSourceMode(0);advance(b,1);near(f.shield(),500);
});
test('retirement immediately removes owned barrier/listeners and refuses stale mode changes',()=>{
 const f=make(),{b,u,c}=f;c.setSourceMode(1);b.heal(u,u,500);b.retreat(u,{permanent:true});
 assert.equal(c.stopped,true);assert.equal(c.handles.length,0);near(f.shield(),0);assert.equal(c.setSourceMode(1),false);
 advance(b,3);assert.deepEqual(b.errors,[]);
});
test('battle end cleans up resources and explicit contract/source selection guards reject before installation',()=>{
 const f=make();f.c.setSourceMode(1);f.b.heal(f.u,f.u,300);f.b.emit('battleEnd',{});
 assert.equal(f.c.stopped,true);near(f.shield(),0);assert.equal(f.c.handles.length,0);
 assert.throws(()=>make({contract:{...CONTRACT}}));
 assert.throws(()=>make({mutate:d=>d.stats.atk++}));
 assert.throws(()=>make({mutate:d=>d.skill.bb.max_hp_ratio=99}));
 assert.throws(()=>f.c.install());
});
