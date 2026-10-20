// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-halo2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedHalo2Build} from '../server/sim/content/arkpedia-halo2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1047_halo2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_HALO2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-halo2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_halo2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.halo2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4,res=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('halo2'));
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedHalo2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Arts hit at the Attack clip event applies sluggish; each sluggish adds +1 ASPD up to 18 stacks',()=>{
 const f=make({skill:3}),e=enemy(f);until(f.b,()=>f.hits.length>0,6);const h=f.hits[0];assert.equal(h.type,'arts');assert.equal(h.target,e);
 assert.ok(e.buffs.some(x=>x.status==='sluggish'));const t=tal(f.u,'max_stack_cnt');near(f.u.findBuff(`halo2:aspd:${f.u.id}`).mods.aspd,t.attack_speed,1e-9);
 until(f.b,()=>f.o.stacks>=t.max_stack_cnt,60);advance(f.b,4);assert.equal(f.o.stacks,t.max_stack_cnt);near(f.u.findBuff(`halo2:aspd:${f.u.id}`).mods.aspd,t.attack_speed*t.max_stack_cnt,1e-9);
});
check('Talent 2: enemies in range take fragile 12%, rising to 16% after 7 s; leaving range clears it',()=>{
 const f=make({skill:3}),e=enemy(f),t=tal(f.u,'halo2_t_1[weak].damage_scale'),key=`halo2:weak:${f.u.id}`;advance(f.b,.1);
 near(e.findBuff(key).mods.dmgTakenMul,t['halo2_t_1[weak].damage_scale'],1e-9);advance(f.b,7);near(e.findBuff(key).mods.dmgTakenMul,t['halo2_t_1[weak].damage_scale_max'],1e-9);
 e.x=18;e.y=3;f.b._buildEnemyIndex();advance(f.b,.1);assert.ok(!e.findBuff(key));
});
check('S1: ATK up and each hit jumps three times, returning between two enemies',()=>{
 const f=make({skill:1}),a=enemy(f),c=enemy(f,{col:4.8});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>plain(f,n).length>0,4);advance(f.b,.05);const main=plain(f,n)[0],jumps=tagged(f,'halo2:s1-chain',n);
 assert.equal(jumps.length,f.u.skill.bb['attack@chain.max_target']);assert.notEqual(jumps[0].target,main.target);assert.equal(jumps[1].target,main.target);near(jumps[0].raw,f.u.s.atk,1e-6);void a;void c;
});
check('S2: the next attack hits the two farthest enemies for 145%, sluggish 3 s, and links a nearby enemy with a pull',()=>{
 const f=make({skill:2}),near1=enemy(f,{row:3,col:4}),far=enemy(f,{row:3,col:5}),side=enemy(f,{row:3,col:6.5});f.u.skill.setSpTotal(f.u.skill.spCost);const x0=side.x,n=f.hits.length;
 until(f.b,()=>tagged(f,'halo2:s2-link',n).length>0,6);advance(f.b,.3);const bb=f.u.skill.bb,main=plain(f,n);
 assert.equal(main.length,bb.max_target_attack);near(main[0].raw,f.u.s.atk*bb.atk_scale,1e-6);assert.ok(side.x<x0,'pulled toward its target');
 near(tagged(f,'halo2:s2-link',n)[0].raw,f.u.s.atk*bb.atk_scale_link,1e-6);assert.ok(far.buffs.some(x=>x.status==='sluggish'));void near1;
});
check('S3: wider range, two locked targets, and 25% of her Arts on one is shared to the other',()=>{
 const f=make({skill:3}),a=enemy(f),c=enemy(f,{col:5});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'halo2:link',n).length>=2,5);const link=tagged(f,'halo2:link',n),main=plain(f,n);
 assert.equal(f.o.links.length,2);near(link[0].raw,main[0].raw*f.u.skill.bb['attack@atk_share'],1e-6);void a;void c;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_halo2_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
