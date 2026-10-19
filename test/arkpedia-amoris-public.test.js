// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-amoris-runtime-review.json' with {type:'json'};
import fever from '../data/arkpedia-fever-source.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedAmorisBuild,amorisSplashRadii} from '../server/sim/content/arkpedia-amoris.js';
import {feverSource} from '../tools/arkpedia/fever-source.mjs';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4185_amoris',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_AMORIS==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-amoris-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,potential=1,trust=0,elite=2,dir='RIGHT'}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_amoris_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,3,3,dir);assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,tags:h.dmg.tags,isSkill:h.dmg.isSkill,attackId:h.dmg.attackId});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,hits,fever:b._aveMujicaFever};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=60)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const attacks=(f,pred=()=>true)=>[...new Map(f.hits.filter(pred).map(h=>[h.attackId,h])).keys()];

test('Fever source reproduces the official constants and every member skill component',async()=>{
 const bytes=await readFile(new URL('../.cache/arkpedia/fever/gamedata_const.json',import.meta.url)).catch(()=>null);
 if(bytes){assert.equal(createHash('sha256').update(bytes).digest('hex'),fever.source.cachedSha256);assert.deepEqual(await feverSource(bytes,fever.source),fever);}
 assert.equal(fever.feverNeed,450);assert.equal(fever.feverDuration,20);assert.equal(Object.keys(fever.members).length,5);assert.equal(Object.keys(fever.skills).length,11);
 for(const[id,m]of Object.entries(fever.members))assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-native-operators/${id}.json`,import.meta.url))).digest('hex'),m.foundationSha256);
});
test('Nyamu hit colliders come from the original projectile prefabs',()=>{
 assert.deepEqual(amorisSplashRadii(),{projectile_chr_amoris:1,projectile_chr_amoris_s1_1:1.5,projectile_chr_amoris_s1_2:1,projectile_chr_amoris_s2_1:1,projectile_chr_amoris_s2_2:1});
});
check('Admission binds the reviewed source, art and interface pins',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Yūtenji Nyamu');
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 for(const a of review.interfaceAssets)assert.equal(data.sources[a.repository],a.commit);
 assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-fever-source.json',import.meta.url))).digest('hex'),review.extraSources['fever-source']);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedAmorisBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.sp,r.source.spData.initSp);
});
check('Ordinary attack: one hit at the original event with 50% splash; Ave Mujica ATK aura applies to her',()=>{
 const f=make(),r=selectedAmorisBuild(f.build),main=enemy(f),side=enemy(f,{col:4.6});
 until(f.b,()=>f.hits.length>=2,5);const first=f.hits.filter(h=>h.attackId===f.hits[0].attackId);
 near(first[0].time,1+0.667,f.b.dt+1e-6);assert.equal(first.length,2);
 near(f.u.s.atk,r.stats.atk*(1+r.talentBb[1].atk));
 const m=first.find(h=>h.target===main),s=first.find(h=>h.target===side);assert.ok(m&&s);assert.ok(Math.abs(s.amount/m.amount-.5)<.05||Math.abs(s.amount/m.amount-.54)<.01);
});
check('Continuous attack strikes the front tile with only splash when nothing is in range',()=>{
 // 4.9 is outside her 1-1 range (columns 3-4) but within the front tile's splash circle.
 const f=make(),far=enemy(f,{row:3,col:4.9});assert.deepEqual(f.u.rangeKeys,[3*21+3,3*21+4]);
 until(f.b,()=>f.hits.length>0,5);assert.ok(f.hits.every(h=>h.target===far&&h.tags.includes('amoris:splash')));
});
check('S1 is three hits at the original events: 160% then 20%/20%, heavy splash radius 1.5',()=>{
 const f=make({skill:1}),main=enemy(f);until(f.b,()=>f.hits.length>0,5);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const t0=f.b.time,n=f.hits.length;
 until(f.b,()=>f.hits.filter(h=>h.isSkill&&h.target===main).length>=3,6);
 const s1=f.hits.slice(n).filter(h=>h.isSkill&&h.target===main).slice(0,3);
 near(s1[1].amount/s1[0].amount,.2/1.6,1e-3);near(s1[2].amount/s1[0].amount,.2/1.6,1e-3);
 near(s1[1].time-s1[0].time,.6,f.b.dt+1e-6);near(s1[2].time-s1[1].time,.6,f.b.dt+1e-6);assert.ok(s1[0].time>t0);
});
check('S2 is eight hits per attack with heavy first and fifth, spread over random targets in its 3x3 range',()=>{
 const f=make({skill:2}),a=enemy(f),c=enemy(f,{row:4,col:4});until(f.b,()=>f.hits.length>0,5);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>f.hits.slice(n).filter(h=>h.tags.includes('amoris:main')).length>=8,4);
 const mains=f.hits.slice(n).filter(h=>h.tags.includes('amoris:main')).slice(0,8),heavy=[0,4];
 for(const[i,h]of mains.entries())assert.equal(heavy.includes(i)?h.amount>500:h.amount<300,true,`hit ${i}: ${h.amount}`);
 assert.ok(new Set(mains.map(h=>h.target)).size>=1);assert.ok([a,c].every(e=>e.alive));
});
check('Fever: +3 per second while deployed, a manual cast at 450 starts 20 s, holds the skill timer and stops SP',()=>{
 const f=make({skill:2}),fv=f.b._aveMujicaFever;assert.ok(fv);enemy(f);
 advance(f.b,10);near(fv.value,30,3+1e-6);fv.value=fv.need;
 assert.equal(fv.add(f.u,3),0);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.equal(fv.active,true);assert.equal(fv.value,0);const left=f.u.skill.timeLeft;
 advance(f.b,10);near(f.u.skill.timeLeft,left,1e-9);assert.equal(f.u.s.flags.noSp,true);assert.equal(fv.add(f.u,3),0);
 advance(f.b,10.1);assert.equal(fv.active,false);assert.ok(f.u.skill.timeLeft<left);assert.notEqual(f.u.s.flags.noSp,true);
});
check('Fever is not started by a cast below 450, and retreat leaves Fever cleanly',()=>{
 const f=make({skill:1}),fv=f.b._aveMujicaFever;fv.value=449;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);assert.equal(fv.active,false);
 f.u.skill.end('test');fv.value=450;advance(f.b,1);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);assert.equal(fv.active,true);
 f.b.retreatOperator(ID);advance(f.b,.1);assert.equal(fv.joined.size,0);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP and actual Nyamu damage`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_amoris_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
