// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import review from '../data/arkpedia-reckpr-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedReckprBuild } from '../server/sim/content/arkpedia-reckpr-source.js';
import { advance, near } from './helpers/reckpr-fixture.js';
const ID='char_4196_reckpr', ALLY='char_122_beagle', OTHER='char_208_melan';
function until(b, predicate, seconds=90) { const end=b.time+seconds;while(!predicate() && b.time<end&&!b.finished)b.step();assert.ok(predicate(),'Condition not reached'); }
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false}={}) {
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_reckpr_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const allies=[defaultBuild(d.operators[ALLY]),defaultBuild(d.operators[OTHER])];
 const b=new StandardBattle(d,support?{operators:allies,support:build}:{operators:[build,...allies]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,3,3,'RIGHT');near(before-b.dp,cost);
 const targets=[b.deployOperator(ALLY,3,4,'RIGHT'),b.deployOperator(OTHER,4,4,'RIGHT')];
 for(const a of targets){a.base.maxHp=100000;a.markDirty();void a.s;a.hp=10000;b.addBuff(a,{key:'qa:still',flags:{disarm:true}});}
 const shots=[],heals=[],add=b.addProjectile.bind(b);b.addProjectile=p=>{if(p.source===u)shots.push({...p,time:b.time});return add(p);};
 b.on('calculatedHeal',c=>{if(c.source===u)heals.push({...c,time:b.time});});
 return{b,u,targets,shots,heals,build:b.bench[ID].build,controller:u.mem.reckpr};
}
test('public Record Keeper binds exact selected source, original artwork and four pinned interface assets',async()=>{
 assert.equal(data.reviewCandidates,undefined);assert.equal(data.operators[ID].name,'Record Keeper');assert.equal(data.operators[ID].sourceChannel,'cn');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Record Keeper - Learning by Analogy.webp','skill-icons/Record Keeper - Sage Advice.webp']);
 assert.equal(review.interfaceAssets.length,4);
 for(const[name,key]of [['native-operators/char_4196_reckpr','sourceFoundationSha256'],['reckpr-art','ownerArtworkSha256']]){
  const path=`../data/arkpedia-${name}.json`;
  assert.equal(createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex'),review[key]);
 }
 for(const[key,model]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
});
for(let rank=1;rank<=10;rank++)test(`public S1/rank ${rank} naturally charges and releases two captured healing projectiles`,()=>{
 const f=make({rank}),{b,u}=f;
 until(b,()=>f.shots.filter(p=>p.data.nativeKey==='projectile_chr_reckpr_s1').length>=2,60);
 const shots=f.shots.filter(p=>p.data.nativeKey==='projectile_chr_reckpr_s1');assert.equal(shots.length,2);
 assert.notEqual(shots[0].target,shots[1].target);near(shots[0].time,shots[1].time);assert.equal(u.skill.activations,1);
 advance(b,.4);assert.ok(f.targets.every(a=>a.hp>10000));assert.equal(b.activateOperator(ID),false);
 assert.deepEqual(b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`public S2/rank ${rank} naturally charges, activates and retains recipient healing after retreat`,()=>{
 const f=make({skill:2,rank}),{b,u,controller:c}=f,key=`reckpr:s2:${u.id}`;
 until(b,()=>u.skill.ready);assert.equal(b.activateOperator(ID),true);
 until(b,()=>f.targets.some(a=>a.findBuff(key)),10);
 const a=f.targets.find(a=>a.findBuff(key)),e=b.spawnEnemy('enemy_1007_slime',{pos:[3,7]});
 b.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});
 const before=a.hp;b.dealDamage(e,a,{amount:100,type:'true',isAttack:true});near(a.hp,before-100+c.record.bb['attack@fixed_heal_value']);
 b.retreatOperator(ID);assert.equal(c.stopped,true);
 const after=a.hp;b.dealDamage(e,a,{amount:100,type:'true',isAttack:true});near(a.hp,after-100+c.record.bb['attack@fixed_heal_value']);
 advance(b,c.record.bb['attack@buff_duration']+.1);assert.equal(a.findBuff(key),null);assert.equal(c.reactiveBuffs.size,0);
 assert.deepEqual(b.errors,[]);
});
for(const elite of [0,1,2])for(const potential of [1,6])test(`public E${elite}/P${potential} uses exact stats, trust, talent and maxed support selection`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedReckprBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.maxHp,r.stats.maxHp);near(f.u.s.atk,r.stats.atk);
 assert.deepEqual(f.u.def.tags,r.tags);assert.deepEqual(f.controller.record.talentBb,r.talentBb);
});
test('public redeployment has a fresh source controller and initial SP; old callbacks stay retired',()=>{
 const f=make({skill:2,potential:6});f.b.retreatOperator(ID);until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);
 f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,3,3,'UP');assert.notEqual(u.mem.reckpr,f.controller);
 assert.equal(f.controller.stopped,true);near(u.skill.spTotal,u.skill.initSp);advance(f.b,1.1);
 assert.ok(['Idle','Attack'].includes(u.mem.regularFormVisual.clip));assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of [1,2])test(`public S${skill} preserves original waves, DP, terrain and life/kill/leak accounting`,()=>{
 const build={...defaultBuild(data.operators[ID]),skillId:`skchr_reckpr_${skill}`};
 const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[ALLY])]});b.setViewport('fullscreen-workspace');
 const tiles=structuredClone(b.grid.tiles);let healer=false,defender=false,heals=0;
 b.on('calculatedHeal',c=>{if(c.source?.defId===ID&&c.target?.defId===ALLY)heals++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!defender&&b.dp>=b.cost(ALLY)){b.deployOperator(ALLY,2,6,'RIGHT');defender=true;}
  if(!healer&&b.dp>=b.cost(ID)){b.deployOperator(ID,1,6,'UP');healer=true;}
  const u=b.bench[ID].unit;if(u?.alive&&skill===2&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const result=b.result();assert.ok(healer&&defender);assert.ok(heals>0,'Original-wave Beagle receives Record Keeper healing');assert.equal(result.reason,'cleared');assert.equal(result.total,11);
 const leaked=result.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;assert.equal(result.killed+leaked,11);assert.equal(result.killed,11);assert.equal(leaked,0);
 assert.equal(b.life,data.stage.battle.max_life-leaked);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
