// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import evidence from '../data/arkpedia-blaze-igniting-prefabs.json' with{type:'json'};
import review from '../data/arkpedia-blaze-igniting-runtime-review.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,catalogueFor,recordFor} from '../shared/arkpedia/loadout.js';
import {BLAZE_IGNITING_ID as ID,selectedBlazeIgnitingBuild} from '../server/sim/content/arkpedia-blaze-igniting.js';
const near=(a,z)=>assert.ok(Math.abs(a-z)<1e-5,`${a} != ${z}`);
function advance(b,s){for(let n=0;n<Math.ceil(s/b.dt-1e-9);n++)b.step();assert.deepEqual(b.errors,[]);}
function until(b,p,s=90){const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),`Expected condition at ${b.time}`);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(d.operators[ID]),elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust,skillId:`skchr_blaze2_${skill}`,skillRank:rank},ally=defaultBuild(d.operators.char_289_gyuki);
 const b=new StandardBattle(d,support?{operators:[ally],support:{...build,elite:2,level:90,potential:6,trust:200}}:{operators:[build,ally]});
 b.autoFinish=false;b.rng=()=>.99;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=999;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return{b,build:b.bench[ID].build};
}
function enemy(b,row=5,col=6){
 const t=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;
 b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return t;
}
test('public Blaze approval binds the immutable native foundation while preserving its historical hold',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-blaze-igniting-prefabs.json',import.meta.url));
 assert.equal(review.sourceFoundationSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(review.enabledOperators,[ID]);assert.deepEqual(evidence.enabledOperators,[]);assert.deepEqual(evidence.heldOperators,[ID]);
 assert.equal(evidence.source.commit,data.sources[evidence.source.repository]);assert.equal(review.frameParity,false);assert.equal(review.moduleSupport,false);
 const c=catalogueFor(data)[ID];assert.deepEqual(c.skills.map(s=>s.id),[1,2,3].map(n=>`skchr_blaze2_${n}`));assert.deepEqual(c.skills.map(s=>s.unlockElite),[0,1,2]);assert.deepEqual(c.modules,[]);
 for(const change of [{elite:0,level:1,skillId:'skchr_blaze2_2',skillRank:1},{elite:1,level:1,skillId:'skchr_blaze2_3',skillRank:1},{module:'x'}])assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),...change},data));
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`public Blaze S${skill} rank${rank}: real deployment, natural SP, skill output and cleanup`,()=>{
 const {b,build}=make({skill,rank}),r=selectedBlazeIgnitingBuild(build);advance(b,2);
 const ally=b.deployOperator('char_289_gyuki',5,6,'RIGHT'),dp=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.blazeIgnitingController;
 near(b.dp,dp-cost);near(u.base.atk,r.stats.atk);near(u.skill.sp,r.source.spData.initSp);assert.equal(c.record.index,skill-1);
 const t=enemy(b),hits=[];b.on('damaged',ctx=>{if(ctx.dmg.tags.some(t=>t.startsWith('blaze2:s')))hits.push(ctx);});assert.equal(b.activateOperator(ID),false);
 if(skill===1)until(b,()=>c.s1.fields.size>0);
 else{until(b,()=>u.skill.ready);assert.equal(b.activateOperator(ID),true);}
 const tag=skill===1?'blaze2:s1-field':skill===2?'blaze2:s2-tile':'blaze2:s3-shot';until(b,()=>hits.some(h=>h.dmg.tags.includes(tag)));
 if(skill===1){assert.ok(ally.findBuff('blaze2_s_1'));assert.ok(hits.find(h=>h.dmg.tags.includes(tag)).dmg.sourceless);}
 if(skill===2){assert.ok(c.s2.tiles.size>0);assert.ok(t.findBuff('blaze2_s_2[on_tile]'));assert.ok(u.hp<u.s.maxHp);}
 if(skill===3){assert.ok(u.skill.ammoLeft<r.bb['attack@trigger_time']);const before=u.skill.ammoLeft;
  b.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'burn',canDodge:false});assert.equal(u.skill.ammoLeft,before+2);}
 assert.equal(c.valid(),true);b.retreatOperator(ID);assert.equal(c.stopped,true);assert.equal(c.handles.length,0);
 if(skill===1){assert.ok(c.s1.fields.size>0);advance(b,21);assert.equal(c.s1.fields.size,0);}
 if(skill===2){assert.equal(c.s2.tiles.size,0);assert.equal(t.findBuff('blaze2_s_2[on_tile]'),null);}
 if(skill===3){assert.equal(c.s3.drain,null);assert.equal(u.skill.active,false);}
 b._finish('victory');assert.deepEqual(b.errors,[]);
});
for(const dir of ['RIGHT','DOWN','LEFT','UP'])test(`public Blaze ${dir} original facing and late/repeated deployment`,()=>{
 const {b}=make({skill:3});advance(b,5);const u=b.deployOperator(ID,5,5,dir),old=u.mem.blazeIgnitingController;advance(b,2);
 assert.equal(u.mem.regularVisualDirection,['UP','LEFT'].includes(dir)?'UP':'RIGHT');assert.equal(old.valid(),true);
 b.retreatOperator(ID);advance(b,75);b.getPlayer('arkpedia').dp=999;const v=b.deployOperator(ID,5,5,dir);assert.notEqual(v.mem.blazeIgnitingController,old);
 assert.equal(old.stopped,true);assert.equal(v.skill.active,false);assert.equal(v.mem.blazeIgnitingController.valid(),true);b._finish('victory');assert.equal(v.mem.blazeIgnitingController.stopped,true);
});
for(const elite of [0,1,2])test(`public Blaze E${elite} selected stats, trust, potential and promotion talents`,()=>{
 const {b,build}=make({elite,rank:1,potential:6,trust:200}),r=selectedBlazeIgnitingBuild(build),u=b.deployOperator(ID,5,5,'RIGHT');
 for(const k of ['atk','maxHp','def','cost'])near(u.base[k],r.stats[k]);near(u.base.res,r.stats.magicResistance);assert.equal(u.mem.blazeIgnitingController.record.revival.dynamic>0,elite===2);
 b._finish('victory');
});
for(const skill of [1,2,3])test(`public Blaze S${skill} fatal downing interrupts the mode and revives through natural regeneration`,()=>{
 const {b}=make({skill}),u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.blazeIgnitingController;enemy(b);
 if(skill===1)until(b,()=>u.skill.active);else{until(b,()=>u.skill.ready);assert.equal(b.activateOperator(ID),true);}
 b.dealDamage(null,u,{amount:u.hp+1,type:'true',canDodge:false});assert.equal(c.reborn.kind,'downed');assert.equal(u.skill.active,false);assert.equal(c.s2?.tiles.size??0,0);assert.equal(c.s3?.drain??null,null);
 until(b,()=>!c.reborn,40);assert.equal(u.alive,true);assert.ok(u.hp>u.s.maxHp*.99);assert.equal(!!u.s.flags.disarm,false);b._finish('victory');
});
test('maxed support Blaze and rejected public commands preserve DP and SP',()=>{
 const {b,build}=make({skill:3,support:true}),r=selectedBlazeIgnitingBuild(build),dp=b.dp;
 b.setViewport('preview');assert.throws(()=>b.deployOperator(ID,5,5,'RIGHT'));near(b.dp,dp);b.setViewport('fullscreen-workspace');
 assert.throws(()=>b.deployOperator(ID,5,5,'INVALID'));near(b.dp,dp);const u=b.deployOperator(ID,5,5,'RIGHT');near(u.base.atk,r.stats.atk);
 const sp=u.skill.sp;assert.equal(b.activateOperator(ID),false);near(u.skill.sp,sp);b._finish('victory');
});
