// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import review from '../data/arkpedia-branch-runtime-review.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedBranchBuild } from '../server/sim/content/arkpedia-branch-source.js';
import { advance, near } from './helpers/branch-fixture.js';
const ID='char_4207_branch';
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached');}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,attacker=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_branch_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,2,6,'UP');near(before-b.dp,cost);
 const heals=[],hits=[];b.on('calculatedHeal',c=>{if(c.source===u)heals.push({...c,time:b.time});});b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});
 let enemy;if(attacker){enemy=b.spawnEnemy('enemy_1007_slime',{pos:[2,6]});Object.assign(enemy.base,{maxHp:1e9,atk:u.s.def+50,def:0,res:0,moveSpeed:0,bat:.5});enemy.markDirty();void enemy.s;enemy.hp=enemy.s.maxHp;b.addBuff(enemy,{key:'qa:pin',flags:{noMove:true}});b._buildEnemyIndex();}
 return{b,u,build:b.bench[ID].build,controller:u.mem.branch,heals,hits,enemy};
}
test('public Vetochki retains source names, selected Stronghold reuse, original models and pinned interface inputs',async()=>{
 const op=data.operators[ID];assert.equal(data.reviewCandidates,undefined);assert.equal(op.name,'Vetochki');assert.equal(op.sourceName,'折桠');assert.equal(op.sourceAppellation,'Веточки');assert.equal(op.sourceChannel,'cn');
 assert.deepEqual(op.skills.map(s=>s.assetIcon),['skill-icons/Vetochki - Desperate Resistance.webp','skill-icons/Vetochki - Set on Survival.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of [['native-operators/char_4207_branch','sourceFoundationSha256'],['branch-art','ownerArtworkSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[key,model]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
});
for(let rank=1;rank<=10;rank++)test(`public S1/rank ${rank} naturally receives defensive SP, owns resistance and heals on normal finish`,()=>{
 const f=make({rank,attacker:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,40);assert.ok(f.enemy.stats.attacks>0);assert.equal(b.activateOperator(ID),true);
 near(u.s.def,c.record.stats.def*(1+c.record.bb.def));near(b.resistOf(u),-c.record.bb.one_minus_status_resistance);
 const held=u.skill.spTotal;advance(b,1);near(u.skill.spTotal,held);until(b,()=>!u.skill.active,20);
 assert.ok(f.heals.length>0);near(f.heals[0].amount,u.s.maxHp*c.record.talentBb[0].hp_ratio);near(b.resistOf(u),0);assert.deepEqual(b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`public S2/rank ${rank} naturally charges, delays Tremble, attacks and restores HP at finish`,()=>{
 const f=make({skill:2,rank,attacker:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,40);assert.equal(b.activateOperator(ID),true);
 const count=f.hits.length,at=b.time;assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(b,.55);assert.ok(!f.enemy.s.flags.tremble);assert.equal(f.hits.length,count);
 until(b,()=>f.enemy.s.flags.tremble,1);near(b.time-at,.6,b.dt);until(b,()=>f.hits.length>count,3);
 near(u.s.atk,c.record.stats.atk*(1+c.record.bb.atk));until(b,()=>!u.skill.active,20);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');
 assert.ok(f.heals.length>0);near(f.heals[0].amount,u.s.maxHp*c.record.talentBb[0].hp_ratio);advance(b,.11);assert.ok(['Idle','Attack'].includes(u.mem.regularFormVisual.clip));assert.deepEqual(b.errors,[]);
});
for(const elite of [0,1,2])for(const potential of [1,6])test(`public E${elite}/P${potential} keeps exact trust/potential stats and support selection`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedBranchBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);assert.equal(f.u.profile.noHeal,true);
});
test('public retreat and redeployment replace the source controller and restore native initial SP',()=>{
 const f=make({skill:2,potential:6});f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);
 f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,2,6,'DOWN');assert.notEqual(u.mem.branch,f.controller);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of [1,2])test(`public S${skill} keeps original waves, DP and terrain and actually attacks the original enemies`,()=>{
 const build={...defaultBuild(data.operators[ID]),skillId:`skchr_branch_${skill}`},M='char_208_melan';
 const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0,heals=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});b.on('calculatedHeal',c=>{if(c.source?.defId===ID)heals++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,3,3,'RIGHT');owner=true;}
  const u=b.bench[ID].unit;if(u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result();assert.ok(owner&&helper);assert.equal(r.reason,'cleared');assert.equal(r.total,11);assert.ok(hits>0);
 const leaked=r.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;assert.equal(r.killed+leaked,11);assert.equal(r.killed,11);assert.equal(leaked,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(heals>0);assert.ok(b.bench[ID].unit.skill.activations>0);
 assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
