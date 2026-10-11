// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,catalogueFor,recordFor} from '../shared/arkpedia/loadout.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {LAPPLAND_ALTER_ID as ID,selectedLapplandBuild,installLapplandSquad} from '../server/sim/content/arkpedia-lappland-alter.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,seconds){for(let n=0;n<Math.ceil(seconds/b.dt-1e-9);n++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,elite=2,trust=0,extra=[],support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(1));
 const build={...defaultBuild(d.operators[ID]),elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust,skillId:`skchr_whitw2_${skill}`,skillRank:rank};
 const others=extra.map(id=>({...defaultBuild(d.operators[id]),...(id==='char_349_chiave'?{skillId:d.operators[id].skills[1].id}:{})}));
 const b=new StandardBattle(d,support?{operators:others,support:{...build,level:90,potential:6,trust:200}}:{operators:[build,...others]});
 b.autoFinish=false;b.rng=()=>.99;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=999;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 return {b,build:b.bench[ID].build};
}
function target(b,{row=5,col=6}={}){
 const t=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;
 b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return t;
}
test('public catalogue exposes all three source skills and their promotion/rank locks',()=>{
 const c=catalogueFor(data)[ID];assert.deepEqual(c.skills.map(s=>s.id),[1,2,3].map(n=>`skchr_whitw2_${n}`));
 assert.deepEqual(c.skills.map(s=>s.unlockElite),[0,1,2]);assert.deepEqual(c.modules,[]);
 for(const change of [{elite:0,level:1,skillId:'skchr_whitw2_2',skillRank:1},{elite:1,level:1,skillId:'skchr_whitw2_3',skillRank:1},
  {elite:0,level:1,skillRank:5},{elite:1,level:1,skillRank:8},{module:'x'}])
  assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),...change},data));
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`public S${skill} rank ${rank}: source build, natural SP, cast and cleanup`,()=>{
 const {b,build}=make({skill,rank}),r=selectedLapplandBuild(build),before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,5,5,'RIGHT');
 assert.equal(b.dp,before-cost);assert.equal(u.mem.lapplandController.record.index,skill-1);near(u.base.atk,r.stats.atk);near(u.skill.baseSpCost,r.source.spData.spCost);
 near(u.skill.sp,Math.min(u.skill.spCost,r.source.spData.initSp+r.honor.sp));
 const enemy=target(b);assert.equal(b.activateOperator(ID),false);
 const until=b.time+u.skill.spCost+2;while(!u.skill.ready&&b.time<until)b.step();assert.ok(u.skill.ready);assert.deepEqual(b.errors,[]);
 assert.equal(b.activateOperator(ID),true);assert.ok(u.skill.active);assert.equal(u.skill.charges,0);
 advance(b,2);assert.ok(enemy.hp<enemy.s.maxHp);assert.ok(u.mem.lapplandController.valid());
 if(skill===1){assert.equal(skillHud(u.skill).canCancel,true);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);}
 else{assert.equal(b.activateOperator(ID),false);advance(b,r.source.duration);assert.equal(u.skill.active,false);}
 b.retreatOperator(ID);assert.equal(u.mem.lapplandController.stopped,true);assert.equal(u.mem.regularFormVisual,null);
 assert.ok(!b.projectiles.list.some(p=>p.data?.lapplandOwner===u.mem.lapplandController&&p.data.lapplandKind==='drone'));
 advance(b,.6);assert.ok(!b.projectiles.list.some(p=>p.data?.lapplandOwner===u.mem.lapplandController));
 b._finish('victory');assert.deepEqual(b.errors,[]);
});
for(const [dir,visual]of [['RIGHT','RIGHT'],['DOWN','RIGHT'],['LEFT','UP'],['UP','UP']])test(`public ${dir} uses the matching original model/event family`,()=>{
 const {b}=make(),u=b.deployOperator(ID,5,5,dir);assert.equal(u.mem.regularVisualDirection,visual);
 advance(b,1.2);assert.ok(u.mem.regularFormVisual);b.retreatOperator(ID);assert.equal(u.mem.regularVisualDirection,undefined);
});
for(const potential of [1,3,6])test(`P${potential} squad SP exists before Lappland is deployed and persists through retreat/redeploy`,()=>{
 const {b}=make({potential,extra:['char_349_chiave','char_289_gyuki']}),amount=potential>=3?6:5;
 const texas=b.deployOperator('char_349_chiave',5,8,'RIGHT');near(texas.skill.sp,texas.skill.def.initSp+amount);
 const unrelated=b.deployOperator('char_289_gyuki',8,8,'RIGHT');near(unrelated.skill.sp,unrelated.skill.def.initSp);
 b.retreatOperator('char_349_chiave');const lp=b.deployOperator(ID,5,5,'RIGHT');near(lp.skill.sp,lp.skill.def.initSp+amount);
 b.retreatOperator(ID);advance(b,texas.base.respawnTime+1);b.getPlayer('arkpedia').dp=999;
 const again=b.deployOperator('char_349_chiave',5,8,'RIGHT');near(again.skill.sp,again.skill.def.initSp+amount);
 b.emit('deploy',{unit:again});near(again.skill.sp,again.skill.def.initSp+amount);
 assert.throws(()=>installLapplandSquad({battle:b,records:{[ID]:recordFor(b.bench[ID].build,data)}}),/before deployment/);
 b._finish('victory');assert.deepEqual(b.errors,[]);
});
test('a maxed support Lappland supplies the selected squad talent',()=>{
 const {b}=make({support:true,extra:['char_349_chiave']}),u=b.deployOperator('char_349_chiave',5,8,'RIGHT');
 near(u.skill.sp,u.skill.def.initSp+6);const lp=b.deployOperator(ID,5,5,'RIGHT');near(lp.base.atk,427);
});
test('E0/E1 omit the locked squad talent and preserve selected source stats',()=>{
 for(const elite of [0,1]){const {b,build}=make({elite,rank:1,extra:['char_349_chiave']}),u=b.deployOperator('char_349_chiave',5,8,'RIGHT');
  near(u.skill.sp,u.skill.def.initSp);const lp=b.deployOperator(ID,5,5,'RIGHT');near(lp.base.atk,selectedLapplandBuild(build).stats.atk);}
});
test('public placement and premature cast failures spend neither DP nor SP',()=>{
 const {b}=make(),dp=b.dp;b.setViewport('preview');assert.throws(()=>b.deployOperator(ID,5,5,'RIGHT'));assert.equal(b.dp,dp);
 b.setViewport('fullscreen-workspace');assert.throws(()=>b.deployOperator(ID,5,5,'INVALID'));assert.equal(b.dp,dp);
 const u=b.deployOperator(ID,5,5,'RIGHT'),sp=u.skill.sp;assert.equal(b.activateOperator(ID),false);near(u.skill.sp,sp);
 b.addBuff(u,{key:'fixture:disarm',flags:{disarm:true}});u.skill.addCharge(1);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.charges,1);
});
