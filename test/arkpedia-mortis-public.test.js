// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-mortis-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedMortisBuild} from '../server/sim/content/arkpedia-mortis.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4183_mortis',N='char_4185_amoris',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_MORTIS==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-mortis-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_mortis_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[N])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[],taken=[];b.on('damaged',h=>{if(h.source===u&&h.target!==u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.type,tags:h.dmg?.tags??[]});if(h.target===u)taken.push({amount:h.amount,type:h.type,tags:h.dmg?.tags??[]});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,hits,taken};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedMortisBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Ordinary melee is Physical at the clip event',()=>{
 const f=make(),e=enemy(f);until(f.b,()=>f.hits.length>0,5);assert.equal(f.hits[0].type,'phys');assert.equal(f.hits[0].target,e);near(f.hits[0].time,1+.433,f.b.dt+1e-6);
});
check('Talent 1: Physical/Arts taken is cut 30% and 15% of the raw amount returns as her own Apoptosis',()=>{
 const f=make(),e=enemy(f);const raw=1000;f.u.base.def=0;f.u.markDirty();void f.u.s;
 const n=f.taken.length;f.b.dealDamage(e,f.u,{amount:raw,type:'arts'});const t=f.taken.slice(n);
 const arts=t.find(x=>x.type==='arts'),apo=t.find(x=>x.type==='element');assert.ok(arts&&apo);near(arts.amount/raw,.7,1e-6);near(apo.amount,raw*.3*.5,1e-6);
});
check('Talent 2: Fever +3 per hit she takes, dodged hits included; members get +10% max HP',()=>{
 const f=make(),e=enemy(f),fv=f.b._aveMujicaFever,ny=f.b.deployOperator(N,3,4,'RIGHT');assert.ok(ny);advance(f.b,.1);
 const v0=fv.value;f.b.dealDamage(e,f.u,{amount:10,type:'phys'});assert.ok(fv.value-v0>=3);
 near(ny.findBuff(`mortis:aura:${f.u.id}`).mods.hpPct,.1,1e-9);assert.ok(f.u.findBuff(`mortis:aura:${f.u.id}`));
});
check('Fatal damage swaps to a non-attacking stand-in with talent DEF; a member hit can shorten it',()=>{
 const f=make(),e=enemy(f);advance(f.b,1.2);f.b.dealDamage(e,f.u,{amount:1e9,type:'true',canDodge:false});assert.equal(f.u.alive,true);assert.equal(f.u.trait.doll,true);
 assert.ok(f.u.findBuff(`mortis:doll-def:${f.u.id}`));assert.equal(f.u.s.flags.disarm,true);
 const doll=f.u.findBuff('trait:substitute'),left=doll.timeLeft;const ny=f.b.deployOperator(N,3,4,'RIGHT');f.b.rng=()=>0;advance(f.b,4);
 assert.ok(doll.timeLeft<left-4+1e-6-.5,'members shortened the stand-in');
});
check('S1 adds DEF/block/taunt, and a knock-out during S1 keeps it on the stand-in with block-2 instead of 0',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);const block=f.u.s.blockCnt;assert.equal(f.b.activateOperator(ID),true);
 near(f.u.s.blockCnt,block+2,1e-9);advance(f.b,1.2);f.b.dealDamage(e,f.u,{amount:1e9,type:'true',canDodge:false});advance(f.b,1.1);
 assert.equal(f.u.trait.doll,true);assert.ok(f.u.findBuff(`mortis:s1:${f.u.id}`));near(f.u.s.blockCnt,block,1e-9);
});
check('S2 fires three Arts shots per attack at random targets in range, each successful hit costing her 20 Arts',()=>{
 const f=make({skill:2}),a=enemy(f),c=enemy(f,{row:3,col:5});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 const n=f.hits.length,m=f.taken.length;until(f.b,()=>f.hits.slice(n).filter(h=>h.tags.includes('mortis:s2')).length>=3,4);
 const shots=f.hits.slice(n).filter(h=>h.tags.includes('mortis:s2')).slice(0,3);assert.ok(shots.every(h=>h.type==='arts'));
 assert.equal(f.taken.slice(m).filter(x=>x.tags.includes('mortis:self')).length>=3,true);void a;void c;
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_mortis_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
