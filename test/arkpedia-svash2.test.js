// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-svash2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {summonCardId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {selectedSvash2Build,SVASH2_EYES} from '../server/sim/content/arkpedia-svash2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1045_svash2',Mel='char_208_melan',G='char_122_beagle',Am='char_002_amiya',Ch='char_010_chen',Yak='char_199_yak',candidate=process.env.ARKPEDIA_REVIEW_SVASH2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-svash2-candidate.json',import.meta.url))):normal;
const CARD=summonCardId(ID);
function make({skill=1,rank=10,elite=2,ops=[Mel,G,Am,Ch,Yak]}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_svash2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,...ops.map(o=>defaultBuild(d.operators[o]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,4,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>hits.push({time:b.time,source:h.source,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags,sourceless:!!h.dmg.sourceless}));
 advance(b,.1);
 return{b,u,o:u.mem.svash2Owner,build:b.bench[ID].build,cost:before-b.dp,hits,dp:()=>b.dp};
}
function enemy(f,{row=3,col=5}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const spot=(f,id)=>{const ranged=f.b.data.getChess(id).position==='RANGED';for(const[r,c]of ranged?[[1,1],[1,2],[1,3],[4,1],[4,2]]:[[2,1],[2,2],[2,3],[3,1],[3,3]])if(!f.b.unitAt(r,c))return[r,c];};
const put=(f,id)=>{const[r,c]=spot(f,id);return f.b.deployOperator(id,r,c,'RIGHT');};
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost*f.u.skill.maxCharges);if(f.u.skill.trigger==='SP_FULL'||f.u.skill.spec?.trigger==='SP_FULL'){advance(f.b,.2);return;}assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);};
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedSvash2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
for(const skill of[1,2,3])check(`S${skill}: the skill's own Eye card joins a cost-sorted deck while he is deployed, as a marker outside S3`,()=>{
 const f=make({skill}),order=f.b.regularDeckOrder(),deck=order.slice(0,order.indexOf(ID)>=0?order.length:order.length);
 assert.equal(f.b.regularSummons.get(CARD).record.id,SVASH2_EYES[skill-1]);assert.ok(order.includes(CARD));
 const costs=f.o.deck().map(id=>f.o.cardCost(id));assert.deepEqual(costs,[...costs].sort((a,b)=>a-b));void deck;
 if(skill<3)assert.match(summonPlacementError(f.b,CARD,3,1)??'',/only during/);
 f.b.retreatOperator(ID);advance(f.b,.1);assert.equal(f.b.regularDeckOrder(),null,'no Eye and no sorting once he leaves');
});
check('Talent 1: he and operators deployed from left of the Eye gain SP; their next redeployment is faster',()=>{
 const f=make({skill:1}),{b,o}=f,t1=tal(f.u,'respawn_time');
 near(f.u.skill.sp,f.u.skill.spec?.initSp??f.u.def.skill.initSp??f.u.skill.sp,100);
 const left=o.leftOfEye();assert.ok(left.length>0,'a card left of the Eye');const id=left[0];
 const a=put(f,id);advance(b,.05);assert.ok(o.marked.has(id));
 const sp0=a.skill.sp;assert.ok(sp0>=t1.sp-1e-6,'SP from the talent');
 b.retreatOperator(id);const wait=b.bench[id].readyAt-b.time;near(wait,a.base.respawnTime*t1.respawn_time,1e-6);
});
check('Talent 2: other Kjerag operators gain DEF and regeneration, doubled after 15 s, and cannot be frozen',()=>{
 const f=make(),{b}=f,t2=tal(f.u,'interval'),y=b.deployOperator(Yak,3,3,'RIGHT');advance(b,.1);
 near(y.findBuff(`svash2:t2:${f.u.id}`).mods.defFlat,t2.def,1e-9);near(y.findBuff(`svash2:t2:${f.u.id}`).mods.hpRegenRatio,t2.hp_recovery_per_sec_by_max_hp_ratio,1e-9);
 assert.equal(f.u.findBuff(`svash2:t2:${f.u.id}`),null,'not himself');
 until(b,()=>y.findBuff(`svash2:t2:${f.u.id}`)?.mods.defFlat===t2.def*2,t2.interval+1);assert.ok(b.time>=t2.interval);
 assert.equal(b.applyStatus(y,'freeze',{duration:3}),false);
});
check('S1: DP at once, and the card nearest the Eye costs less and gains a barrier when deployed',()=>{
 const f=make({skill:1}),{b,o}=f,bb=f.u.skill.bb,id=o.nearest(),before=b.cost(id),dp=b.dp;cast(f);
 near(b.dp,dp+bb.cost,1e-6);assert.equal(b.cost(id),before-bb['svash2_s_1[deck].cost']);
 const a=put(f,id);advance(b,.05);near(a.findBuff(`svash2:s1:barrier:${f.u.id}`).shield,f.u.s.maxHp*bb['svash2_s_1[deck].shield'],1);
});
check('S2: cold strikes ahead, a discount, and cards left of the Eye store a deploy cast that fires with their own ATK',()=>{
 const f=make({skill:2}),{b,o}=f,bb=f.u.skill.bb,e=enemy(f),near1=o.nearest(),before=b.cost(near1);cast(f);
 const h=f.hits.find(x=>x.target===e&&x.tags?.includes('svash2:s2'));assert.ok(h);assert.equal(h.type,'phys');assert.ok(e.buffs.some(x=>x.status==='cold'));
 assert.equal(b.cost(near1),before-bb.cost);const stored=[...o.casts.keys()];assert.ok(stored.length>0);
 cast(f);assert.equal(o.casts.get(stored[0]).count,2,'two stacks at most');cast(f);assert.equal(o.casts.get(stored[0]).count,Math.min(bb.max_stack_cnt,3));
 const n=f.hits.length,a=put(f,stored[0]);e.x=a.tileC+1;e.y=a.tileR;b._buildEnemyIndex();advance(b,.9);assert.equal(f.hits.slice(n).filter(x=>x.sourceless).length,0);
 advance(b,.2);assert.equal(f.hits.slice(n).filter(x=>x.sourceless&&x.tags?.includes('svash2:s2')).length,1,'first cast 1 s after deployment');
 advance(b,.4);assert.equal(f.hits.slice(n).filter(x=>x.sourceless&&x.tags?.includes('svash2:s2')).length,2,'second cast 0.4 s later');void a;
});
check('S3: DP over time, a one-time base-cost swap, line strikes with fragility, and the Eye on an operator',()=>{
 const f=make({skill:3}),{b,o}=f,bb=f.u.skill.bb,e=enemy(f,{col:6}),dp=b.dp;
 const base=id=>b.bench[id].baseCost??b.data.getChess(id).stats.cost,before=Object.fromEntries([Mel,Ch,G,Am,Yak].map(id=>[id,base(id)]));cast(f);
 near(b.dp,dp+bb['svash2_s_3[start_cost].cost'],1e-6);advance(b,bb['svash2_s_3[cost].interval']+.05);near(b.dp,dp+bb['svash2_s_3[start_cost].cost']+bb['svash2_s_3[cost].cost'],1e-6);
 const [hi,lo]=o.swappedCards;assert.equal(base(hi),before[lo]);assert.equal(base(lo),before[hi]);assert.equal(b.data.getChess(hi).profession??'WARRIOR','WARRIOR');
 until(b,()=>f.hits.some(x=>x.target===e&&x.tags?.includes('svash2:s3')),5);assert.ok(e.findBuff(`svash2:s3:weak:${f.u.id}`));
 const a=b.deployOperator(G,2,5,'RIGHT');advance(b,.05);assert.equal(o.eyeHolder,a,'first operator deployed in S3 takes the Eye');
 const y=b.deployOperator(Yak,3,3,'RIGHT');advance(b,.05);assert.equal(o.eyeHolder,a);
 const dp2=b.dp;deployRegularSummon(b,CARD,3,3);assert.equal(o.eyeHolder,y);near(b.dp,dp2,1e-6);
 assert.match(summonPlacementError(b,CARD,2,1)??'',/deployed operator/);
 const e2=enemy(f,{row:3,col:5});const n=f.hits.length;until(b,()=>f.hits.slice(n).some(x=>x.tags?.includes('svash2:eye')),5);void e2;
 until(b,()=>!f.u.skill.active,60);assert.equal(o.eyeHolder,null);
 b.bench[ID].unit.skill.setSpTotal(f.u.skill.spCost);const swapped=JSON.stringify([base(hi),base(lo)]);b.activateOperator(ID);advance(b,.1);assert.equal(JSON.stringify([base(hi),base(lo)]),swapped,'the swap happens once per battle');
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_svash2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,5,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(g&&!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,2,5,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u?.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
