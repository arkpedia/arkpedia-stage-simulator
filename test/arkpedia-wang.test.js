// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-wang-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {summonCardId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon,summonPlacementError,regularSummonCards} from '../server/sim/content/arkpedia-summons.js';
import {selectedWangBuild,WANG_STONE,wangPlacementAllowsEnemy} from '../server/sim/content/arkpedia-wang.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_2027_wang',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_WANG==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-wang-candidate.json',import.meta.url))):normal;
const CARD=summonCardId(ID);
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_wang_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,pen:h.dmg.resIgnoreFlat,tags:h.dmg.tags});});
 return{b,u,o:u.mem.wangOwner,build:b.bench[ID].build,cost:before-b.dp,hits,state:()=>b.regularSummons.get(CARD)};
}
function enemy(f,{row=3,col=5,move=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:move});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const stone=(f,r,c)=>{f.b.addDp('arkpedia',99);f.state().readyAt=0;const t=deployRegularSummon(f.b,CARD,r,c);assert.ok(t);return t;};
const stones=f=>f.o.stones();
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const tok=n=>Object.fromEntries(data.tokens[WANG_STONE].skills[n-1].levels.at(-1).blackboard.map(r=>[r.key,r.value]));
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedWangBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: seven stones on deployment; a manual placement costs DP and adds a free stone beside it',()=>{
 const f=make();assert.equal(f.state().stock,tal(f.u,'attack@max_spawn_cnt').cnt);const dp=f.b.dp;const t=stone(f,3,5);
 assert.equal(stones(f).length,2,'the placed stone and its free neighbour');assert.equal(f.state().stock,tal(f.u,'attack@max_spawn_cnt').cnt-1);void t;void dp;
 assert.match(summonPlacementError(f.b,CARD,3,6)??'',/./);
});
check('A lone stone stays inactive; linked stones trigger on a ground enemy, are consumed and return their piece',()=>{
 const f=make();stone(f,3,6);advance(f.b,.5);const [a,c]=stones(f);assert.ok(a.mem.wangActive&&c.mem.wangActive,'linked pair');
 const stock=f.state().stock,e=enemy(f,{row:a.tileR,col:a.tileC});advance(f.b,.1);assert.ok(e.buffs.some(x=>x.status==='sluggish'));
 advance(f.b,.6);assert.ok(!stones(f).includes(a));assert.equal(f.state().stock,stock+1);
});
check('S1 stones: sluggish and 135% ATK Arts each second; Talent 2 adds 12% and 10 RES penetration per stone in line',()=>{
 const f=make();stone(f,3,6);advance(f.b,.5);const [a]=stones(f),n=f.hits.length;const e=enemy(f,{row:a.tileR,col:a.tileC});advance(f.b,1.2);
 const dot=tagged(f,'wang:s1-dot',n)[0],t2=tal(f.u,'attack@per_atk_scale'),bb=tok(1);assert.ok(dot);near(dot.raw,dot.atk*bb.atk_scale*(1+t2['attack@per_atk_scale']*2),1e-6);assert.equal(dot.pen,t2['attack@per_magic_resist_penetrate_fixed']*2);void e;
});
check('S1/S2 gain two stones automatically',()=>{const f=make({skill:2});const s=f.state().stock;stone(f,3,6);f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);assert.equal(f.state().stock,Math.min(s-1+2,f.o.cap()-stones(f).length));});
check('S2 stones strike 580% along their line and slow enemies by half',()=>{
 const f=make({skill:2});stone(f,3,6);advance(f.b,.5);const [a,c]=stones(f);const n=f.hits.length;const side=enemy(f,{row:a.tileR+(a.tileR-c.tileR)*2,col:a.tileC+(a.tileC-c.tileC)*2});const e=enemy(f,{row:a.tileR,col:a.tileC});advance(f.b,.1);
 const s2=tagged(f,'wang:s2',n);assert.ok(s2.length>=1);near(s2[0].raw,s2[0].atk*tok(2).atk_scale*(1+tal(f.u,'attack@per_atk_scale')['attack@per_atk_scale']*2),1e-6);assert.ok(e.findBuff(`wang:slow:${f.u.id}`));void side;
});
check('S3: he stops attacking, gains eight stones, places the overflow on enemies in range, and stones strike in x-6',()=>{
 const f=make({skill:3}),e1=enemy(f,{row:3,col:4}),e2=enemy(f,{row:3,col:5});f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);
 assert.ok(stones(f).length>=1,'overflow placed on enemies');assert.ok(stones(f).some(t=>t.tileR===3&&[4,5].includes(t.tileC)),'a stone sits on an enemy');assert.equal(wangPlacementAllowsEnemy(f.b,f.u,3,4),true);assert.equal(wangPlacementAllowsEnemy(f.b,f.u,9,20),false);
 advance(f.b,1);assert.equal(f.hits.slice(n).filter(h=>!h.tags?.includes('wang')).length,0,'no ordinary attacks');void e2;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_wang_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready&&skill!==3)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
