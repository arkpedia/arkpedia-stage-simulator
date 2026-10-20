// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-orchd2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedOrchd2Build,verifyOrchd2Source} from '../server/sim/content/arkpedia-orchd2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1048_orchd2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_ORCHD2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-orchd2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2,deploy=true,at=[2,4,'UP']}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_orchd2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=deploy?b.deployOperator(ID,...at):b.bench[ID].unit;if(deploy)assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===b.bench[ID].unit||h.credit===b.bench[ID].unit)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u?.mem.orchd2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('orchd2'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
test('Salvo counts, S2 additional arrows and the S3 arrow clock are the original prefab values',()=>verifyOrchd2Source());
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost, SP and charges`,()=>{
 const f=make({skill,rank}),r=selectedOrchd2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,{...r.stats,respawnTime:r.stats.respawnTime+tal(f.u,'respawn_time').respawn_time});near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.maxCharges,r.source.spData.maxChargeTime);
});
check('Ordinary attacks fire a three-arrow salvo at a third each; the first cast powers the next fifty to 120%',()=>{
 const f=make({skill:3}),e=enemy(f);until(f.b,()=>plain(f).length>=3,6);const salvo=plain(f).slice(0,3);assert.ok(salvo.every(h=>h.time===salvo[0].time));
 near(salvo[0].amount,f.u.s.atk*tal(f.u,'attack@damage_scale')['attack@damage_scale'],1e-6);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const t=tal(f.u,'power_attack_count');assert.equal(f.o.power,t.power_attack_count);
 const n=f.hits.length;until(f.b,()=>plain(f,n).length>=3,8);near(plain(f,n)[0].amount,f.u.s.atk*t.power_attack_scale*tal(f.u,'attack@damage_scale')['attack@damage_scale'],1e-6);
 advance(f.b,.1);assert.equal(f.o.power,t.power_attack_count-1);void e;
});
check('Talent 2: shorter redeploy, unchanged cost, and a return deployment beside her last tile may use a melee tile with ATK +15%',()=>{
 const f=make({skill:3}),cost=f.b.cost(ID),t=tal(f.u,'atk_duration');f.b.retreatOperator?.(ID)??f.b.retreat(f.u);const entry=f.b.bench[ID];
 near(entry.readyAt-f.b.time,(f.u.def.stats.respawnTime)*f.u.s.redeployMul,1e-6);assert.equal(f.u.def.stats.respawnTime,selectedOrchd2Build(f.build).stats.respawnTime+tal(f.u,'respawn_time').respawn_time);assert.equal(f.b.cost(ID),cost);
 entry.readyAt=f.b.time;assert.equal(f.b.placementError(ID,3,4),null);assert.match(f.b.placementError(ID,3,7)??'',/ranged/);
 const u=f.b.deployOperator(ID,3,4,'RIGHT');assert.ok(u);near(u.findBuff('orchd2:return').mods.atkPct,t.atk,1e-9);
});
check('S1: four 160% arrows; with a spare charge the stunning five-arrow 刚连射; auto release at full charges',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost*2);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);advance(f.b,3);
 const a=tagged(f,'orchd2:s1',n),p=tagged(f,'orchd2:s1-power',n),bb=f.u.skill.bb;assert.equal(a.length,4);assert.equal(p.length,5);near(a[0].raw,f.u.s.atk*bb.atk_scale_1,1e-6);near(p[0].raw,f.u.s.atk*bb.atk_scale_2,1e-6);
 f.u.skill.setSpTotal(f.u.skill.spCost*f.u.skill.maxCharges);advance(f.b,.1);assert.ok(f.u.findBuff('orchd2:cast'),'auto release at full charges');void e;
});
check('S2: cast on deployment without SP, lifts off, fires 3/4/5 arrows at every enemy in range, then lands with 300%',()=>{
 const f=make({skill:2,at:[3,2,'RIGHT']}),a=enemy(f,{col:4}),c=enemy(f,{col:5});const n=f.hits.length;until(f.b,()=>f.u.skill.active,3);assert.equal(f.u.skill.charges,0);assert.ok(f.u.s.flags.liftoff);
 until(f.b,()=>tagged(f,'orchd2:s2-land',n).length>0,6);const loop=tagged(f,'orchd2:s2-loop',n),bb=f.u.skill.bb;
 assert.equal(loop.filter(h=>h.target===a).length,12);assert.equal(loop.filter(h=>h.target===c).length,12);near(loop[0].raw,f.u.s.atk*bb['attack@atk_scale_loop'],1e-6);assert.ok(!f.u.s.flags.liftoff);
});
check('S3: after the charge a piercing arrow deals 360% Physical and 60% Arts every quarter tile and pushes each enemy once',()=>{
 const f=make({skill:3,at:[3,2,'RIGHT']}),e=enemy(f,{col:4});f.b.removeBuff(e,'fixture:pin');f.b.addBuff(e,{key:'fixture:still',flags:{disarm:true}});const x0=e.x;
 f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>tagged(f,'orchd2:s3',n).length>0,5);advance(f.b,.5);
 const p=tagged(f,'orchd2:s3',n),m=tagged(f,'orchd2:s3-magic',n),bb=f.u.skill.bb;assert.ok(p.length>=1);assert.equal(p.length,m.length);near(p[0].raw,f.u.s.atk*bb.atk_scale,1e-6);near(m[0].raw,f.u.s.atk*bb.atk_scale_magic,1e-6);
 assert.ok(e.x>x0,'pushed along her facing');
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_orchd2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
