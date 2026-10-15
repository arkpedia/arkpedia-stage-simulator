// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-varkis-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedVarkisBuild} from '../server/sim/content/arkpedia-varkis-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/varkis-fixture.js';
const ID='char_4166_varkis';
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached');}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,attacker=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_varkis_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,2,6,'UP');near(before-b.dp,cost);
 const heals=[],hits=[];b.on('calculatedHeal',c=>{if(c.source===u)heals.push({...c,time:b.time});});b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});
 let enemy;if(attacker){enemy=b.spawnEnemy('enemy_1007_slime',{pos:[2,6]});Object.assign(enemy.base,{maxHp:1e9,atk:u.s.def+1,def:0,res:0,moveSpeed:0,bat:.5});enemy.markDirty();void enemy.s;enemy.hp=enemy.s.maxHp;b.addBuff(enemy,{key:'qa:pin',flags:{noMove:true}});b._buildEnemyIndex();}
 return{b,u,build:b.bench[ID].build,controller:u.mem.varkis,heals,hits,enemy};
}
test('public Varkáris retains source names, original models and four pinned interface inputs',async()=>{
 const op=data.operators[ID];assert.equal(data.reviewCandidates,undefined);assert.equal(op.name,'Varkáris');assert.equal(op.sourceName,'摆渡人');assert.equal(op.sourceAppellation,'Varkáris');assert.equal(op.sourceChannel,'cn');
 assert.deepEqual(op.skills.map(s=>s.assetIcon),['skill-icons/Varkáris - Raging River.webp','skill-icons/Varkáris - The Will of His People.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4166_varkis','sourceFoundationSha256'],['varkis-art','ownerArtworkSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[key,model]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
});
for(let rank=1;rank<=10;rank++)test(`public S1/rank ${rank} naturally earns offensive SP and emits three separate hits with one attack`,()=>{
 const f=make({rank,attacker:true}),{b,u,controller:c}=f;until(b,()=>c.phase?.s1&&c.phase.index===0,40);
 assert.ok(u.stats.attacks>=u.skill.spCost);assert.equal(b.activateOperator(ID),false);assert.equal(skillHud(u.skill).text,'Skill active · Three-strike burst');
 const hits=f.hits.length,attacks=u.stats.attacks;until(b,()=>!u.skill.active,2);
 assert.equal(f.hits.length-hits,3);assert.equal(u.stats.attacks-attacks,1);assert.equal(new Set(f.hits.slice(hits).map(h=>h.dmg.attackId)).size,1);
 assert.ok(f.hits[hits+2].time>f.hits[hits].time);assert.equal(f.heals.length,0);assert.deepEqual(b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`public S2/rank ${rank} naturally charges, uses native Begin and retains an overheal barrier after finish`,()=>{
 const f=make({skill:2,rank,attacker:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,40);assert.equal(b.activateOperator(ID),true);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.equal(c.resources.mode,0);advance(b,.3);assert.equal(c.resources.mode,0);
 until(b,()=>c.resources.mode===1,1);until(b,()=>f.heals.length>0,3);near(f.heals[0].amount,u.s.maxHp*c.record.bb['attack@hp_ratio']);
 until(b,()=>!u.skill.active,35);assert.equal(c.resources.mode,0);
 // The explicit Idle mix does not invent an attack lock when ordinary CD is already due.
 if(u.mem.regularFormVisual.clip==='Attack'){assert.equal(c.phase.kind,'attack');assert.equal(c.phase.s2,false);}
 else{assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.ok(c.mixUntil>b.time);}
 const shield=u.findBuff(c.resources.key).shield;assert.ok(shield>0);advance(b,1.1);assert.ok((u.findBuff(c.resources.key)?.shield??0)<shield);assert.deepEqual(b.errors,[]);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public E${elite}/P${potential} preserves exact selected source stats, talent and support build`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedVarkisBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);near(f.u.s.blockCnt,r.stats.blockCnt);
});
test('public retreat and redeployment replace controllers, barrier and source initial SP',()=>{
 const f=make({skill:2,potential:6});f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.controller.resources.stopped,true);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;
 const u=f.b.deployOperator(ID,2,6,'DOWN');assert.notEqual(u.mem.varkis,f.controller);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.equal(u.findBuff(u.mem.varkis.resources.key),null);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public S${skill} attacks original 0-1 waves with unchanged terrain, natural DP and Melantha`,()=>{
 const build={...defaultBuild(data.operators[ID]),skillId:`skchr_varkis_${skill}`},M='char_208_melan';
 const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0,heals=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});b.on('calculatedHeal',c=>{if(c.source?.defId===ID)heals++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,3,3,'RIGHT');owner=true;}
  const u=b.bench[ID].unit;if(skill===2&&u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result();assert.ok(owner&&helper);assert.equal(r.reason,'cleared');assert.equal(r.total,11);assert.ok(hits>0);
 const leaked=r.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;assert.equal(r.killed,11);assert.equal(leaked,0);assert.equal(b.life,data.stage.battle.max_life);
 if(skill===2){assert.ok(heals>0);assert.ok(b.bench[ID].unit.skill.activations>0);}else assert.equal(heals,0);
 assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({skill,kills:r.killed,leaks:leaked,life:b.life,hits,heals,activations:b.bench[ID].unit.skill.activations}));
});
