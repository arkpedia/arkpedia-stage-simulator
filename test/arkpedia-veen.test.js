// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-veen-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedVeenBuild} from '../server/sim/content/arkpedia-veen.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4226_veen',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_VEEN==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-veen-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_veen_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.veenOwner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('veen'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedVeenBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('With no target he stores energy each interval up to nine units, merged into transposed energy with the talent ATK buff',()=>{
 const f=make();advance(f.b,f.u.s.interval*1.5);assert.equal(f.o.units,1);assert.ok(f.u.findBuff('veen:t1').mods.aspd>0);
 advance(f.b,f.u.s.interval*12);assert.equal(f.o.units,9);assert.deepEqual(f.o.stored(),{merged:3,singles:0});near(f.u.findBuff('veen:t1').mods.atkPct,tal(f.u,'attack_speed').atk,1e-9);
});
check('An attack fires every stored energy: a transposed one deals three times ATK and adds three damage-over-time stacks',()=>{
 const f=make();until(f.b,()=>f.o.units===4,20);assert.deepEqual(f.o.stored(),{merged:1,singles:1});const e=enemy(f);
 until(f.b,()=>plain(f).length>0,6);advance(f.b,.05);const m=tagged(f,'veen:merged'),s=tagged(f,'veen:energy');assert.equal(m.length,1);assert.equal(s.length,1);
 near(m[0].raw,m[0].atk*3,1e-6);assert.equal(f.o.units,0);assert.equal(f.o.dots.get(e).stacks,tal(f.u,'attack@value')['attack@max_stack_cnt']);
});
check('Talent 2 damage ticks 90 per stack each second, and he will not target an enemy carrying it',()=>{
 const f=make(),a=enemy(f);until(f.b,()=>plain(f).length>0,6);const c=enemy(f,{col:5});const n=f.hits.length;advance(f.b,1.05);
 const dot=tagged(f,'veen:dot',n);assert.ok(dot.length>=1);near(dot[0].raw,tal(f.u,'attack@value')['attack@value']*f.o.dots.get(a).stacks,1e-6);
 until(f.b,()=>plain(f,n).length>0,6);assert.equal(plain(f,n)[0].target,c,'skips the marked enemy');
});
check('S1: automatic ASPD',()=>{const f=make({skill:1});f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);assert.equal(f.u.skill.active,true);assert.ok(f.u.s.aspd>=100+f.u.skill.bb.attack_speed);});
check('S2: each attack stacks ATK/ASPD and a transposed release adds three, to nine stacks',()=>{
 const f=make({skill:2});until(f.b,()=>f.o.units===3,20);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const e=enemy(f);
 until(f.b,()=>plain(f).length>0,6);advance(f.b,.05);assert.equal(f.o.stacks,1+3);const bb=f.u.skill.bb;near(f.u.findBuff('veen:s2').mods.atkPct,bb['attack@veen_s_2_buff[stack].atk']*4,1e-9);
 const c=enemy(f,{col:5}),d=enemy(f,{col:3});until(f.b,()=>f.o.stacks>=bb['attack@veen_s_2_buff[stack].max_stack_cnt'],30);void e;void c;void d;
});
check('S3: fired energy hits then bounces at 165% (a transposed one three times), spending ammo until the skill ends',()=>{
 const f=make({skill:3});until(f.b,()=>f.o.units===4,20);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);assert.equal(f.o.ammo,27);
 const e=enemy(f),c=enemy(f,{col:5});until(f.b,()=>tagged(f,'veen:s3-bounce').length>=4,6);assert.equal(f.o.ammo,27-4);
 const bo=tagged(f,'veen:s3-bounce');near(bo[0].raw,bo[0].atk*f.u.skill.bb['attack@bounce_atk_scale'],1e-6);
 f.o.ammo=1;f.o.units=1;until(f.b,()=>!f.u.skill.active,6);void e;void c;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_veen_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
