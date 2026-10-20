// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-haruka-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedHarukaBuild} from '../server/sim/content/arkpedia-haruka.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4202_haruka',G='char_122_beagle',M='char_208_melan',candidate=process.env.ARKPEDIA_REVIEW_HARUKA==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-haruka-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_haruka_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[M])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.harukaOwner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=3.4,atk=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedHarukaBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1/2: allies in range get a 30% Sanctuary bubble each attack interval; it bursts 0.5 s after enemy damage and heals 28% ATK',()=>{
 const f=make(),g=f.b.deployOperator(G,3,3,'RIGHT');advance(f.b,.1);const key=`haruka:bubble:${f.u.id}`;assert.ok(g.findBuff(key)||f.u.findBuff(key));
 const t=tal(f.u,'damage_resistance');advance(f.b,f.u.s.interval*2);assert.ok(g.findBuff(key));
 g.hp=g.s.maxHp*.5;let healed=0;f.b.on('heal',c=>{if(c.target===g&&c.opts?.tags?.includes('haruka:t2'))healed=c.amount;});const e=enemy(f,{atk:300});
 until(f.b,()=>!g.findBuff(key),8);near(healed,f.u.s.atk*tal(f.u,'heal_scale').heal_scale,1e-6);assert.ok(!f.o.bubbles.has(g));void e;void t;
});
check('S1: ASPD, healing in place of attacks, and a burst passes a bubble to a neighbour without one',()=>{
 const f=make({skill:1}),g=f.b.deployOperator(G,3,3,'RIGHT'),m=f.b.deployOperator(M,2,3,'RIGHT');advance(f.b,.1);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);for(const a of[...f.o.bubbles.keys()])f.o.burst(a);f.o.give(g);f.o.give(f.u);for(const a of[...f.o.bubbles.keys()])if(a===m)f.o.burst(a);
 assert.ok(!f.o.bubbles.has(m));f.o.burst(g);assert.ok(f.o.bubbles.has(m),'passed to the neighbour');
});
check('S2: two heal targets, two bubbles, and each heal deals 200% of the heal as Arts to enemies around the ally; the second use is infinite',()=>{
 const f=make({skill:2}),g=f.b.deployOperator(G,3,3,'RIGHT'),e=enemy(f);g.hp=g.s.maxHp*.3;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'haruka:s2-extra',n).length>0,8);f.u.skill.end('test');f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.equal(f.u.skill.timeLeft,Infinity);near(f.u.findBuff('haruka:s2-second').mods.atkPct,f.u.skill.bb.atk,1e-9);void e;
});
check('S3: bubble Sanctuary doubled, and an enemy hitting a bubbled ally levitates taking 80% ATK Arts each second',()=>{
 const f=make({skill:3}),g=f.b.deployOperator(G,3,3,'RIGHT');f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);
 for(const a of[...f.o.bubbles.keys()])if(a!==g)f.o.burst(a);f.o.give(g);advance(f.b,.05);const key=`haruka:bubble:${f.u.id}`,t=tal(f.u,'damage_resistance');
 near(1-g.findBuff(key).mods.physTakenMul,t.damage_resistance*f.u.skill.bb.damage_resistance_scale,1e-9);
 const e=enemy(f,{atk:300});const n=f.hits.length;until(f.b,()=>tagged(f,'haruka:s3-float',n).length>0,8);assert.ok(e.s.flags.levitate||tagged(f,'haruka:s3-float',n).length>0);
 const fl=tagged(f,'haruka:s3-float',n)[0];near(fl.raw,fl.atk*f.u.skill.bb.atk_scale,1e-6);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_haruka_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
