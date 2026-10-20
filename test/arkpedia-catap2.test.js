// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-catap2-runtime-review.json' with {type:'json'};
import evidence from '../data/arkpedia-native-operators/char_1049_catap2.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedCatap2Build} from '../server/sim/content/arkpedia-catap2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1049_catap2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_CATAP2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-catap2-candidate.json',import.meta.url))):normal;
const M=evidence.models[ID].Front;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_catap2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.catap2Owner,build:b.bench[ID].build,cost:before-b.dp,hits,p:b.getPlayer('arkpedia')};
}
function enemy(f,{row=3,col=3.4,atk=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const tal=u=>u.def.talents.find(t=>t.bb.extend_duration_ratio_each!=null).bb;
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost, SP and charges`,()=>{
 const f=make({skill,rank}),r=selectedCatap2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.maxCharges,r.source.spData.maxChargeTime);
});
check('Ordinary Physical hit at the Attack clip event on the blocked enemy',()=>{
 const f=make(),e=enemy(f);until(f.b,()=>f.hits.length>0,6);assert.equal(f.hits[0].type,'phys');assert.equal(f.hits[0].target,e);assert.equal(e.blockedBy,f.u);
});
check('A cast needs and pays its DP cost; every stored charge becomes a layer extending the skill',()=>{
 const f=make({skill:1});f.p.dp=f.u.skill.bb.cost-1;f.u.skill.setSpTotal(f.u.skill.spCost*3);assert.equal(f.b.activateOperator(ID),false);
 f.p.dp=50;assert.equal(f.b.activateOperator(ID),true);assert.equal(f.p.dp,50-f.u.skill.bb.cost);assert.equal(f.o.layers,3);assert.equal(f.u.skill.spTotal,0);
 near(f.u.skill.timeLeft,f.u.skill.duration*(1+tal(f.u).extend_duration_ratio_each*3),1e-6);
});
check('S1: five morph-slash hits at the Begin events, then alternating five- and ten-hit combos, each with a 35% Arts rider',()=>{
 const f=make({skill:1}),e=enemy(f);advance(f.b,.5);f.u.skill.setSpTotal(f.u.skill.spCost*5);const t0=f.b.time;assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 advance(f.b,M.durations.Skill_1_Begin);const morph=tagged(f,'catap2:morph',n);assert.equal(morph.length,M.hits.Skill_1_Begin.length);near(morph[0].time-t0,M.hits.Skill_1_Begin[0],f.b.dt+1e-6);
 until(f.b,()=>tagged(f,'catap2:combo',n).length>=4+9,15);advance(f.b,.1);
 const magic=tagged(f,'catap2:s1-magic',n);near(magic[0].raw,f.u.s.atk*f.u.skill.bb.atk_magic,1e-6);void e;
 const phys=f.hits.slice(n).filter(h=>h.type==='phys');assert.ok(phys.length>=5+5+10);assert.equal(magic.length,phys.length);
});
check('S2: ATK/DEF up, morph slash with damage resistance; adaptation pays 10 DP, strikes once Physical plus one Arts hit per layer and ends the skill',()=>{
 const f=make({skill:2}),e=enemy(f,{atk:300});advance(f.b,.5);f.u.skill.setSpTotal(f.u.skill.spCost*2);assert.equal(f.b.activateOperator(ID),true);assert.equal(f.o.layers,2);
 assert.ok(f.u.findBuff('catap2:begin').mods.physTakenMul<1);assert.equal(f.b.secondaryActionOperator(ID),false,'not during Begin');
 advance(f.b,M.durations.Skill_2_Begin+.05);const dp=f.p.dp,n=f.hits.length;assert.equal(f.b.secondaryActionOperator(ID),true);assert.equal(f.p.dp,dp-f.u.skill.bb.retrigger_cost);
 const atk=f.u.s.atk;advance(f.b,M.durations.Skill_2_Overload+.1);const bb=f.u.skill.bb;
 const ph=tagged(f,'catap2:s2-adapt-physic',n),mg=tagged(f,'catap2:s2-adapt-magic',n);assert.equal(ph.length,1);near(ph[0].raw,atk*bb['attack@extra_physic_atk_scale'],1e-6);
 assert.equal(mg.length,2);assert.equal(f.u.skill.active,false);void e;
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_catap2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
