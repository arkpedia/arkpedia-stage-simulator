// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-mantra-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedMantraBuild} from '../server/sim/content/arkpedia-mantra.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4204_mantra',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_MANTRA==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-mantra-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_mantra_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.mantraOwner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4,atk=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('mantra'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedMantraBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: a triggered palsy costs the enemy 145% ATK elemental damage',()=>{
 const f=make({skill:2}),g=f.b.deployOperator(G,3,3,'RIGHT'),e=enemy(f,{col:3.4,atk:100});f.b.applyStatus(e,'palsy',{value:3,duration:Infinity,source:f.u});const n=f.hits.length;
 until(f.b,()=>tagged(f,'mantra:t1',n).length>0,8);const t=tagged(f,'mantra:t1',n)[0];assert.equal(t.type,'elemental');near(t.raw,t.atk*tal(f.u,'prob').atk_scale,1e-6);void g;
});
check('Talent 2: enemies appearing at the spawn point nearest to her get one palsy layer',()=>{
 const f=make({skill:2});const s=f.o.spawn;assert.ok(s);const e=f.b.spawnEnemy('enemy_1007_slime',{pos:s});assert.equal(e.findBuff('palsy')?.stacks,1);
});
check('S1: the next attack deals 325% Arts with 30% neural injury, and 200% elemental on a burst target',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;until(f.b,()=>tagged(f,'mantra:injury',n).length>0,6);
 const main=plain(f,n)[0],inj=tagged(f,'mantra:injury',n)[0],bb=f.u.skill.bb;near(main.raw,main.atk*bb.atk_scale,1e-6);near(inj.raw,main.amount*bb.ep_damage_ratio,1e-6);
 f.b.addBuff(e,{key:'neuralBurst',duration:10});f.u.skill.setSpTotal(f.u.skill.spCost);const m=f.hits.length;until(f.b,()=>tagged(f,'mantra:s1-burst',m).length>0,6);
 near(tagged(f,'mantra:s1-burst',m)[0].raw,tagged(f,'mantra:s1-burst',m)[0].atk*bb.element_atk_scale,1e-6);
});
check('S2: 240% Arts then three chain jumps of 120% with neural injury',()=>{
 const f=make({skill:2}),a=enemy(f),c=enemy(f,{col:5}),d=enemy(f,{col:3}),e=enemy(f,{row:2,col:3});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'mantra:s2-chain',n).length>=3,6);const ch=tagged(f,'mantra:s2-chain',n);near(ch[0].raw,ch[0].atk*f.u.skill.bb['attack@chain.atk_scale'],1e-6);
 assert.equal(new Set(ch.slice(0,3).map(h=>h.target)).size,3);assert.ok(tagged(f,'mantra:injury',n).length>=4);void a;void c;void d;void e;
});
check('S3: skill starts in range add two palsy, capped at 2 with every extra layer launching 185% elemental jumps',()=>{
 const f=make({skill:3}),a=enemy(f),c=enemy(f,{col:5});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.equal(a.findBuff('palsy').stacks,2);assert.equal(f.o.triggers,1);f.b.applyStatus(a,'palsy',{value:1,duration:Infinity,source:f.u});const n=f.hits.length;
 until(f.b,()=>tagged(f,'mantra:s3-overflow',n).length>=2,4);assert.equal(a.findBuff('palsy').stacks,2);
 near(tagged(f,'mantra:s3-overflow',n)[0].raw,tagged(f,'mantra:s3-overflow',n)[0].atk*f.u.skill.bb.atk_scale,1e-6);void c;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_mantra_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
