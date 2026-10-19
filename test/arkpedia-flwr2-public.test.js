// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-flwr2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedFlwr2Build} from '../server/sim/content/arkpedia-flwr2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1022_flwr2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_FLWR2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-flwr2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_flwr2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const heals=[],hits=[];b.on('heal',h=>{if(h.source===u)heals.push({time:b.time,target:h.target,amount:h.amount});});
 b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.type});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,heals,hits};
}
function enemy(f,{row=3,col=5}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats and cost`,()=>{
 const f=make({skill,rank}),r=selectedFlwr2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);
});
check('With S1 she attacks with Arts at the clip event',()=>{
 const f=make(),e=enemy(f),at=[];f.b.on('attack',c=>{if(c.attacker===f.u)at.push(f.b.time);});until(f.b,()=>f.hits.length>0,5);assert.equal(f.hits[0].type,'arts');assert.equal(f.hits[0].target,e);near(at[0],1+.533,f.b.dt+1e-6);
});
check('Talent: Sanctuary covers allies in range at or below her HP ratio only',()=>{
 const f=make(),g=f.b.deployOperator(G,3,4,'RIGHT');f.u.skill.setSpTotal(0);f.u.skill.charges=0;advance(f.b,.1);const key=`flwr2:sanctuary:${f.u.id}`;
 assert.ok(g.findBuff(key));g.hp=g.s.maxHp;f.u.hp=f.u.s.maxHp*.5;advance(f.b,.1);assert.ok(!g.findBuff(key));
 g.hp=g.s.maxHp*.4;advance(f.b,.1);const t=f.u.def.talents.find(x=>x.bb.damage_resistance).bb.damage_resistance;near(g.findBuff(key).mods.physTakenMul,1-t,1e-9);assert.ok(!f.u.findBuff(key));
});
check('S1 auto: two charges, each an immediate 500% heal on the lowest ally and +25% DEF for 10 s',()=>{
 const f=make({skill:1}),g=f.b.deployOperator(G,3,4,'RIGHT');g.hp=100;const def=g.s.def;f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);
 const h=f.heals.find(x=>x.target===g);assert.ok(h);near(h.amount,f.u.s.atk*f.u.skill.bb.heal_scale,1e-6);near(g.findBuff(`flwr2:s1:${f.u.id}`).mods.defPct,f.u.skill.bb.def,1e-9);assert.ok(g.s.def>def);
});
check('S2 passive: she heals instead of attacking, ASPD +50, double Sanctuary, and heals grant ATK with HP loss',()=>{
 const f=make({skill:2}),g=f.b.deployOperator(G,3,4,'RIGHT'),e=enemy(f);advance(f.b,1);g.hp=g.s.maxHp*.3;f.u.hp=f.u.s.maxHp*.9;
 until(f.b,()=>f.heals.some(h=>h.target===g),6);assert.equal(f.hits.length,0);
 const buff=g.findBuff(`flwr2:s2:${f.u.id}`);assert.ok(buff);near(buff.mods.atkPct,f.u.skill.bb['attack@atk'],1e-9);
 const t=f.u.def.talents.find(x=>x.bb.damage_resistance).bb.damage_resistance;near(g.findBuff(`flwr2:sanctuary:${f.u.id}`).mods.physTakenMul,1-t*f.u.skill.bb.talent_scale,1e-9);void e;
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_flwr2_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(g&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'RIGHT');b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
