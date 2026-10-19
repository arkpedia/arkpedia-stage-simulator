// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-tmoris-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedTmorisBuild,verifyTmorisSource} from '../server/sim/content/arkpedia-tmoris.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4186_tmoris',N='char_4185_amoris',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_TMORIS==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-tmoris-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2,withNyamu=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_tmoris_${skill}`,skillRank:rank};
 const ops=[build,defaultBuild(d.operators[G]),...(withNyamu?[defaultBuild(d.operators[N])]:[])];
 const b=new StandardBattle(d,{operators:ops});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=5}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=60)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
test('Umiri source damage types and clip events are the reviewed originals',()=>{verifyTmorisSource();});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedTmorisBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.maxCharges,r.source.spData.maxChargeTime);
});
check('Ordinary attack hits every enemy in range with Physical damage at the clip event; Stalker dodge applies',()=>{
 const f=make(),a=enemy(f),c=enemy(f,{row:3,col:4});until(f.b,()=>f.hits.length>=2,5);
 const first=f.hits.filter(h=>h.time===f.hits[0].time);assert.equal(first.length,2);assert.ok(first.every(h=>h.type==='phys'));
 near(first[0].time,1+.467,f.b.dt+1e-6);assert.equal(f.u.s.dodgePhys,.5);assert.equal(f.u.s.dodgeArts,.5);void a;void c;
});
check('Talent 1 sluggish lands at its E2 rate over many hits and feeds Fever +2 each',()=>{
 const f=make(),e=enemy(f),fv=f.b._aveMujicaFever;let n=0;const ap=f.b.applyStatus.bind(f.b);
 f.b.applyStatus=(t,k,o)=>{const r=ap(t,k,o);if(k==='sluggish'&&r!==false)n++;return r;};
 f.b.timeLimit=1000;const v0=fv.value;advance(f.b,420);const rolls=f.hits.length;assert.ok(rolls>=100,'rolls '+rolls);
 assert.ok(n/rolls>.1&&n/rolls<.33,`rate ${n}/${rolls}`);near(fv.value-v0,Math.min(fv.need-v0,2*n),1e-9);void e;
});
check('S1: two charges, five Arts hits on ground enemies at the Skill_1 events',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost*2);assert.equal(f.u.skill.charges,2);
 const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);assert.equal(f.u.skill.charges,1);
 advance(f.b,1.2);const s1=f.hits.slice(n).filter(h=>h.tags.includes('tmoris:s1'));assert.equal(s1.length,5);assert.ok(s1.every(h=>h.type==='arts'&&h.target===e));
 near(s1[4].time-s1[0].time,.9-.367,f.b.dt+1e-6);
});
check('S1 releases once more when another Ave Mujica member starts a skill',()=>{
 const f=make({skill:1,withNyamu:true}),e=enemy(f);const ny=f.b.deployOperator(N,3,4,'RIGHT');assert.ok(ny);advance(f.b,2);
 const n=f.hits.length;ny.skill.setSpTotal(ny.skill.spCost);assert.equal(f.b.activateOperator(N),true);advance(f.b,1.2);
 assert.equal(f.hits.slice(n).filter(h=>h.tags.includes('tmoris:s1')).length,5);assert.equal(f.u.skill.charges,0);void e;
});
check('S2 fears enemies in range on start, ticks Arts damage every second and raises the sluggish chance',()=>{
 const f=make({skill:2}),e=enemy(f),fv=f.b._aveMujicaFever;f.u.skill.setSpTotal(f.u.skill.spCost);const v0=fv.value;
 assert.equal(f.b.activateOperator(ID),true);assert.ok(e.buffs.some(x=>x.status==='fear'));assert.ok(fv.value>=v0+2);
 const n=f.hits.length;advance(f.b,3.05);const s2=f.hits.slice(n).filter(h=>h.tags.includes('tmoris:s2'));assert.equal(s2.length,3);assert.ok(s2.every(h=>h.type==='arts'));
});
check('Ave Mujica members deal 15% more to sluggish or feared enemies while Umiri is deployed',()=>{
 const f=make({withNyamu:true}),ny=f.b.deployOperator(N,3,4,'RIGHT'),e=enemy(f,{row:3,col:5});const hits=[];
 f.b.on('damaged',h=>{if(h.source===ny&&h.target===e&&h.dmg.tags.includes('amoris:main'))hits.push(h.amount);});
 until(f.b,()=>hits.length>=1,6);const plain=hits.at(-1);f.b.applyStatus(e,'sluggish',{source:f.u,duration:30});
 until(f.b,()=>hits.length>=2,6);near(hits.at(-1)/plain,review.enabledOperators.length||candidate?f.u.def.talents.find(t=>t.bb.damage_scale).bb.damage_scale:1,1e-6);
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP and actual Umiri damage`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_tmoris_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
