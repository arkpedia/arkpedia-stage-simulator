// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-leizi2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedLeizi2Build} from '../server/sim/content/arkpedia-leizi2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1043_leizi2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_LEIZI2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-leizi2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_leizi2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.leizi2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost, SP and charges`,()=>{
 const f=make({skill,rank}),r=selectedLeizi2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.maxCharges,r.source.spData.maxChargeTime);
});
check('Liberator: no attacks and lifted off while idle; talent thunder strikes her range tiles for 100% ATK Arts',()=>{
 const f=make({skill:3}),e=enemy(f);advance(f.b,.1);assert.ok(f.u.s.flags.liftoff);advance(f.b,30);
 assert.equal(f.hits.filter(h=>!h.tags?.includes('leizi2')).length,0,'no ordinary attacks');const t=tagged(f,'leizi2:thunder');assert.ok(t.length>=1);
 near(t[0].raw,t[0].atk*tal(f.u,'atk_scale_t').atk_scale_t,1e-6);assert.equal(t[0].type,'arts');void e;
});
check('Talent 2 strikes every ground tile at a skill start with tremble; during skills her damage uses 111% ATK',()=>{
 const f=make({skill:3}),e=enemy(f);advance(f.b,.1);f.u.skill.setSpTotal(f.u.skill.spCost);const atk=f.u.s.atk,n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);
 const t2=tagged(f,'leizi2:t2',n);assert.equal(t2.length,1);near(t2[0].raw,atk*tal(f.u,'atk_scale_t2').atk_scale_t2*tal(f.u,'atk_scale[skill_up]')['atk_scale[skill_up]'],1e-6);
 assert.ok(e.s.flags.tremble);assert.ok(!f.u.s.flags.liftoff);
});
check('S1: one 355% strike per direction of 3-19, and the trait ATK is kept while charges remain',()=>{
 const f=make({skill:1}),fwd=enemy(f,{col:5}),side=enemy(f,{row:2,col:3});advance(f.b,10);const ramp=f.u.trait.ramp;assert.ok(ramp>0);
 f.u.skill.setSpTotal(f.u.skill.spCost*2);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);advance(f.b,.5);
 const s1=tagged(f,'leizi2:s1',n);assert.equal(s1.length,2);assert.deepEqual(new Set(s1.map(h=>h.target)),new Set([fwd,side]));
 assert.ok(f.u.trait.ramp>=ramp,'ramp kept with a charge left');f.u.skill.setSpTotal(0);void fwd;
});
check('S2: four targets at 150% over a ground-extended range and every thunder strike adds 10% ATK up to 25 stacks',()=>{
 const f=make({skill:2}),e=enemy(f),far=enemy(f,{col:6});advance(f.b,.1);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.ok(f.u.rangeKeySet.has(3*21+6),'range reaches three steps further');until(f.b,()=>f.o.stacks>=1,20);near(f.u.findBuff('leizi2:s2-thunder').mods.atkPct,f.u.skill.bb.thunder_atk*f.o.stacks,1e-9);
 until(f.b,()=>f.hits.some(h=>!h.tags?.includes('leizi2')&&h.target===far),10);void e;
});
check('S3: splash attacks spawn currents that deal 70% Arts every 0.6 s and may tremble',()=>{
 const f=make({skill:3}),e=enemy(f),c=enemy(f,{col:5});advance(f.b,.1);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'leizi2:s3-current',n).length>=2,10);const cur=tagged(f,'leizi2:s3-current',n);
 near(cur[0].raw,f.u.s.atk*f.u.skill.bb['attack@atk_scale_current']*tal(f.u,'atk_scale[skill_up]')['atk_scale[skill_up]'],1e-6);assert.ok(f.hits.slice(n).some(h=>!h.tags?.includes('leizi2')&&h.target===c),'splash');void e;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_leizi2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
