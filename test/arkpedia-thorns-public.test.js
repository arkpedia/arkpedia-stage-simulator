// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,catalogueFor,recordFor} from '../shared/arkpedia/loadout.js';
import {THORNS_LODESTAR_ID as ID,selectedThornsBuild} from '../server/sim/content/arkpedia-thorns-lodestar.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,s){for(let n=0;n<Math.ceil(s/b.dt-1e-9);n++)b.step();assert.deepEqual(b.errors,[]);}
function until(b,p,s=90){const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),`condition not reached at ${b.time}`);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(d.operators[ID]),elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust,skillId:`skchr_thorn2_${skill}`,skillRank:rank};
 const ally=defaultBuild(d.operators.char_289_gyuki);
 const b=new StandardBattle(d,support?{operators:[ally],support:{...build,elite:2,level:90,potential:6,trust:200}}:{operators:[build,ally]});
 b.autoFinish=false;b.rng=()=>.99;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=999;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 return {b,build:b.bench[ID].build};
}
function enemy(b,{row=5,col=6}={}){
 const t=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e7,atk:100,def:100,res:20,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;
 b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return t;
}
test('public Thorns catalogue retains all source skills, locks and no unreviewed modules',()=>{
 const c=catalogueFor(data)[ID];assert.deepEqual(c.skills.map(s=>s.id),[1,2,3].map(n=>`skchr_thorn2_${n}`));assert.deepEqual(c.skills.map(s=>s.unlockElite),[0,1,2]);assert.deepEqual(c.modules,[]);
 for(const change of [{elite:0,level:1,skillId:'skchr_thorn2_2',skillRank:1},{elite:1,level:1,skillId:'skchr_thorn2_3',skillRank:1},{module:'x'}])assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),...change},data));
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`public Thorns S${skill} rank ${rank}: natural SP, selected field and removal`,()=>{
 const {b,build}=make({skill,rank}),r=selectedThornsBuild(build),cost=b.cost(ID);
 // This is a real delayed public deployment, not a private controller fixture.
 advance(b,2);const ally=b.deployOperator('char_289_gyuki',5,6,'RIGHT');ally.hp=ally.s.maxHp/2;
 const before=b.dp,u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.thornsController;assert.equal(b.dp,before-cost);
 near(u.base.atk,r.stats.atk);near(u.skill.sp,r.source.spData.initSp);assert.equal(c.record.index,skill-1);
 const t=enemy(b,{row:5,col:6}),system=c[`s${skill}`],dots=[];
 b.on('damaged',ctx=>{if(ctx.target===t&&ctx.dmg?.tags?.includes(`thorns:s${skill}`))dots.push(ctx);});assert.equal(b.activateOperator(ID),false);
 if(skill===1)until(b,()=>system.fields.length>0);
 else{until(b,()=>u.skill.ready);assert.equal(b.activateOperator(ID),true);until(b,()=>system.fields.length>0);}
 const field=system.fields[0];assert.ok(field.duration>0||field.expiresAt>b.time);
 if(skill===1){assert.ok(ally.s.hpRegen>0);assert.ok(ally.s.def>ally.base.def);}
 else{const hp=t.hp;advance(b,2);assert.ok(t.hp<hp);assert.ok(dots.length>0);assert.equal(dots[0].dmg.sourceless,true);assert.equal(dots[0].dmg.isAttack,false);
  if(skill===3){assert.ok(t.s.def<t.base.def);assert.ok(t.s.res<t.base.res);}}
 assert.ok(c.valid());b.retreatOperator(ID);assert.equal(c.stopped,true);assert.ok(system.fields.some(f=>f.active));
 advance(b,r.bb.projectile_delay_time+20);assert.equal(system.fields.length,0);b._finish('victory');assert.deepEqual(b.errors,[]);
});
for(const dir of ['RIGHT','DOWN','LEFT','UP'])test(`public Thorns ${dir} original model and attack family`,()=>{
 const {b}=make({skill:3}),u=b.deployOperator(ID,5,5,dir);advance(b,2);
 assert.equal(u.mem.regularVisualDirection,['UP','LEFT'].includes(dir)?'UP':'RIGHT');assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Idle');
 b.retreatOperator(ID);assert.equal(u.mem.regularVisualDirection,undefined);
});
test('public redeploy creates a fresh controller using the original terrain snapshot',()=>{
 const {b}=make({skill:2}),u=b.deployOperator(ID,5,5,'RIGHT'),old=u.mem.thornsController;
 assert.ok(old.roads.size>0);b.retreatOperator(ID);b.grid.tiles=b.grid.tiles.map(t=>({...t,pass:'FLY'}));
 advance(b,75);b.getPlayer('arkpedia').dp=999;const v=b.deployOperator(ID,5,5,'LEFT'),c=v.mem.thornsController;
 assert.notEqual(v,u);assert.notEqual(c,old);assert.equal(c.roads,old.roads);assert.equal(old.stopped,true);assert.equal(c.valid(),true);
 b._finish('victory');assert.equal(c.stopped,true);
});
for(const elite of [0,1,2])test(`public Thorns E${elite} source stats and talent unlocks`,()=>{
 const {b,build}=make({elite,rank:1,potential:6,trust:200}),r=selectedThornsBuild(build),u=b.deployOperator(ID,5,5,'RIGHT');
 near(u.base.atk,r.stats.atk);near(u.s.atk,u.base.atk*(1+r.extension.atk));near(u.base.res,r.stats.magicResistance);near(u.base.cost,r.stats.cost);
 const ally=b.deployOperator('char_289_gyuki',5,7,'RIGHT');advance(b,.1);assert.equal(ally.s.aspd>ally.base.aspd,elite===2);
});
test('maxed support Thorns and rejected public commands preserve resources',()=>{
 const {b,build}=make({skill:3,support:true}),r=selectedThornsBuild(build),dp=b.dp;
 b.setViewport('preview');assert.throws(()=>b.deployOperator(ID,5,5,'RIGHT'));near(b.dp,dp);b.setViewport('fullscreen-workspace');
 assert.throws(()=>b.deployOperator(ID,5,5,'INVALID'));near(b.dp,dp);const u=b.deployOperator(ID,5,5,'RIGHT');near(u.base.atk,r.stats.atk);
 const sp=u.skill.sp;assert.equal(b.activateOperator(ID),false);near(u.skill.sp,sp);b._finish('victory');
});
