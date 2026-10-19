// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-radian-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {summonCardId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon} from '../server/sim/content/arkpedia-summons.js';
import {selectedRadianBuild,RADIAN_TOWERS} from '../server/sim/content/arkpedia-radian.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4195_radian',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_RADIAN==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-radian-candidate.json',import.meta.url))):normal;
const CARD=summonCardId(ID);
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_radian_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{hits.push({time:b.time,source:h.source,credit:h.credit,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.radianOwner,build:b.bench[ID].build,cost:before-b.dp,hits,state:()=>b.regularSummons.get(CARD)};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const tower=(f,r,c,dir='RIGHT')=>{f.b.addDp('arkpedia',99);f.state().readyAt=0;const t=deployRegularSummon(f.b,CARD,r,c,dir);assert.ok(t);return t;};
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedRadianBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
for(const skill of[1,2,3])check(`S${skill} selects its own original tower; five summons; inspiration on placement`,()=>{
 const f=make({skill});assert.equal(f.state().record.id,RADIAN_TOWERS[skill-1]);assert.equal(f.state().stock,tal(f.u,'cnt').cnt);
 const t=tower(f,...(skill===3?[1,5]:[3,4]));advance(f.b,.1);const t2=tal(f.u,'max_hp');near(t.findBuff('radian:inspire').mods.atkPct,t2.atk,1e-9);assert.equal(t.defId,RADIAN_TOWERS[skill-1]);
});
check('S1: the melee tower blocks and strikes Physical; the skill gives him and his tower DEF and a full-HP barrier, and one more summon',()=>{
 const f=make({skill:1}),t=tower(f,3,4),e=enemy(f,{col:4.4});until(f.b,()=>f.hits.some(h=>h.source===t),8);assert.equal(f.hits.find(h=>h.source===t).type,'phys');
 const stock=f.state().stock;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);assert.equal(f.state().stock,stock+1);
 near(t.findBuff(`radian:skill:${f.u.id}`).mods.defPct,f.u.skill.bb.def,1e-9);assert.ok(t.findBuff(`radian:barrier:${f.u.id}`).shield>0);void e;
});
check('S2: the tower fires piercing Physical bullets forward; during S2 three bullets fly further',()=>{
 const f=make({skill:2}),t=tower(f,3,3,'RIGHT'),pre=[],add0=f.o.bullets.add.bind(f.o.bullets),a=enemy(f,{col:4}),c=enemy(f,{col:5});f.o.bullets.add=x=>{pre.push({p:x,at:f.b.time});return add0(x);};until(f.b,()=>f.hits.filter(h=>h.tags?.includes('radian:bullet')).length>=2,8);
 const hits=f.hits.filter(h=>h.tags?.includes('radian:bullet'));assert.deepEqual(new Set(hits.slice(0,2).map(h=>h.target)),new Set([a,c]),'one bullet pierces both');assert.equal(hits[0].type,'phys');
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const BASE_LIFE=pre[0].p.until-pre[0].at,made=[],add=f.o.bullets.add.bind(f.o.bullets);f.o.bullets.add=x=>{made.push({p:x,at:f.b.time});return add(x);};
 until(f.b,()=>made.length>=3,6);assert.deepEqual(new Set(made.slice(0,3).map(m=>m.p.y)),new Set([t.y-1,t.y,t.y+1]),'three lanes');const life=t=>t.p.until-t.at;assert.ok(made.slice(0,3).every(m=>life(m)>BASE_LIFE),'S2 bullets fly further');
});
check('S3: the ranged tower strikes Arts, joins a linked tower\'s target, and S3 damage leaves enemies sluggish and Arts-fragile',()=>{
 const f=make({skill:3}),near1=tower(f,1,5,'RIGHT'),far=tower(f,1,6,'RIGHT'),e=enemy(f,{row:2,col:7});
 until(f.b,()=>f.hits.some(h=>h.source===near1||h.source===far),8);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 until(f.b,()=>e.findBuff(`radian:fragile:${f.u.id}`),8);assert.ok(e.buffs.some(x=>x.status==='sluggish'));near(e.findBuff(`radian:fragile:${f.u.id}`).mods.artsTakenMul,f.u.skill.bb.damage_scale,1e-9);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_radian_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
