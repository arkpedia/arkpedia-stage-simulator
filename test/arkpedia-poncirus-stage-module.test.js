// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import tables from '../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import aliases from '../data/candidates/arkpedia-blockee-event-alias-source.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {genericKit} from '../server/sim/content/generic.js';
import {defaultBuild,catalogueFor} from '../shared/arkpedia/loadout.js';
import {customizeFiveStarVanguardKit,installFiveStarVanguard} from '../server/sim/content/arkpedia-five-star-vanguards.js';
import {poncirusStageBuild,poncirusStageRecord,verifyPoncirusStageModule} from '../server/sim/content/arkpedia-poncirus-stage-module.js';
const ID='char_488_buildr',build=poncirusStageBuild(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,t){for(let i=0;i<Math.ceil(t/b.dt-1e-8);i++)b.step();assert.deepEqual(b.errors,[]);}
function fixture({deploy=true}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const raw=poncirusStageRecord(build,d),def=normalizeChess(raw),u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',2,7,{dir:'RIGHT'}),kit=genericKit(def.skill.bb,def.raw,def);
 customizeFiveStarVanguardKit({battle:b,id:ID,def,unit:u,kit});b._setupUnit(u,kit);installFiveStarVanguard({battle:b,unit:u,def});if(deploy)assert.ok(b._deploy(u));u.atkCd=1000;
 const enemy=()=>{const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=u.x;e.y=u.y;e.base.maxHp=e.hp=1e6;e.base.moveSpeed=0;e.markDirty();b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});return e;};
 return{b,u,raw,enemy,c:u.mem.poncirusStageModule};
}
test('the exact hidden build gains module stats and its strengthened talent without public admission',()=>{
 const r=poncirusStageRecord(build,data);near(r.stats.maxHp,2475);near(r.stats.atk,475);near(r.stats.def,447);assert.deepEqual(r.talents[0].bb,{interval:30,max_hp:.2});
 assert.deepEqual(catalogueFor(data)[ID].modules,[]);assert.throws(()=>new StandardBattle(structuredClone(data),{operators:[build]}));
 for(const change of [{level:79},{potential:5},{trust:200},{skillRank:10},{moduleLevel:2},{stage:'17-14'},{skillId:'skcom_charge_cost[3]'}])assert.throws(()=>poncirusStageRecord({...build,...change},data),/Unreviewed/);
});
test('real blocking admits one additive ATK/DEF bonus, and releasing each last enemy removes it',()=>{
 const f=fixture(),e=f.enemy();assert.ok(f.b._checkBlock(e));assert.equal(e.blockedBy,f.u);near(f.u.s.atk,475*1.08);near(f.u.s.def,447*1.08);
 const e2=f.enemy();assert.ok(f.b._checkBlock(e2));near(f.u.s.atk,475*1.08);f.b.kill(e,null);near(f.u.s.atk,475*1.08);
 f.b._unblock(e2);near(f.u.s.atk,475);near(f.u.s.def,447);assert.equal(f.u.findBuff('buildr_trait[e_002_blocked]'),null);
});
test('a one-sided or dead block relation never grants the derived buff',()=>{
 const f=fixture(),e=f.enemy();f.u.blocking.push(e);f.c.sync();near(f.u.s.atk,475);e.blockedBy=f.u;f.c.sync();near(f.u.s.atk,513);
 e.alive=false;f.c.sync();near(f.u.s.atk,475);assert.deepEqual(f.b.errors,[]);
});
test('module and skill percentages add, and the second S2 keeps its native DP pulse',()=>{
 const f=fixture();assert.ok(f.b._checkBlock(f.enemy()));f.b.getPlayer('arkpedia').dp=0;
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.ok(f.u.skill.activate('manual'));near(f.b.dp,11);near(f.u.s.atk,475*1.28);near(f.u.s.def,447*1.58);
 advance(f.b,15.1);assert.equal(f.u.skill.active,false);near(f.u.s.atk,513);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.ok(f.u.skill.activate('manual'));near(f.b.dp,22);advance(f.b,8);near(f.b.dp,24);assert.equal(f.u.skill.active,true);
});
test('the strengthened HP talent waits 30 seconds and preserves the current HP ratio',()=>{
 const f=fixture();f.u.hp=f.u.s.maxHp/2;advance(f.b,29.9);near(f.u.s.maxHp,2475);advance(f.b,.15);near(f.u.s.maxHp,2970);near(f.u.hp,1485);
});
test('an old deployment timer and module cannot cross into a replacement lifetime',()=>{
 const f=fixture();assert.ok(f.b._checkBlock(f.enemy()));advance(f.b,20);f.u.deploySeq++;f.b.releaseBlocked(f.u);advance(f.b,10.1);
 near(f.u.s.maxHp,2475);near(f.u.s.atk,475);assert.equal(f.u.findBuff('poncirus:endurance'),null);
});
test('movement notifications do not start another deployment timer',()=>{
 const f=fixture(),count=()=>f.b._sched.filter(s=>s.owner===f.u&&!s.cancelled).length,n=count();
 f.b.emit('deploy',{unit:f.u,move:true});assert.equal(count(),n);advance(f.b,30.1);near(f.u.s.maxHp,2970);
});
test('a target life replaced during endurance admission cannot inherit the old talent timer',()=>{
 const f=fixture();f.b.on('beforeBuff',ctx=>{if(ctx.unit===f.u&&ctx.buff.key==='poncirus:endurance')f.u.deploySeq++;});
 advance(f.b,30.1);near(f.u.s.maxHp,2475);assert.equal(f.u.findBuff('poncirus:endurance'),null);
});
test('retirement during block-buff admission cannot attach a late derived effect',()=>{
 const f=fixture();f.b.on('beforeBuff',ctx=>{if(ctx.unit===f.u&&ctx.buff.key==='buildr_trait[e_002_blocked]')f.b.retreat(f.u,{permanent:true});});
 f.b._checkBlock(f.enemy());assert.equal(f.u.deployed,false);assert.equal(f.u.findBuff('buildr_trait[e_002_blocked]'),null);assert.deepEqual(f.b.errors,[]);
});
test('battle completion removes derived coverage and cancels the pending endurance admission',()=>{
 const f=fixture();f.b._checkBlock(f.enemy());f.b.finished=true;f.b.emit('battleEnd',{});near(f.u.s.atk,475);advance(f.b,31);near(f.u.s.maxHp,2475);
});
test('every retained module, template, prefab and exact card field is bound by its source receipt',()=>{
 for(const change of [t=>t.modules.uniequip_002_buildr.phase.attributeBlackboard[0].value++,t=>t.stages['17-16'].predefines.characterCards.find(c=>c.inst.characterKey===ID).hidden=false]){
  const t=structuredClone(tables);change(t);assert.throws(()=>verifyPoncirusStageModule(t,native),/Unreviewed/);
 }
 const n=structuredClone(native);n.templates['buildr_trait[e_002]'].eventToActions._items[0].key++;assert.throws(()=>verifyPoncirusStageModule(tables,n),/Unreviewed/);
 const n2=structuredClone(native);n2.prefabs.buildr_equip_1_3_p1.components[0].pathId='changed';assert.throws(()=>verifyPoncirusStageModule(tables,n2),/Unreviewed/);
 const a=structuredClone(aliases);a.events['37'].name='ON_BUFF_TRIGGER';assert.throws(()=>verifyPoncirusStageModule(tables,native,a),/Unreviewed/);
});
