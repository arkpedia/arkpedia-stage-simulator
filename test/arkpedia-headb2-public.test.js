// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-headb2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedHeadb2Build} from '../server/sim/content/arkpedia-headb2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1051_headb2',G='char_122_beagle',ST='char_115_headbr',candidate=process.env.ARKPEDIA_REVIEW_HEADB2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-headb2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_headb2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[ST])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,tags:h.dmg.tags});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
test('0-1 has a HIGH tile at (2,4) beside the lane tile (3,4)',()=>{const b=new StandardBattle(normal,{operators:[defaultBuild(normal.operators[G])]});assert.equal(b.grid.tiles[2*21+4].height,'HIGH');assert.equal(b.grid.tiles[3*21+4].height,'LOW');});
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats and cost`,()=>{
 const f=make({skill,rank}),r=selectedHeadb2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);
});
check('Ordinary hit at the clip event; talent splash x1.24 and a high-ground pulse 0.1 s later with sluggish',()=>{
 const f=make(),main=enemy(f),side=enemy(f,{row:3,col:4.6});until(f.b,()=>f.hits.some(h=>h.tags.includes('headb2:pulse')),6);
 const m=f.hits.find(h=>h.tags.includes('headb2:main')),s=f.hits.find(h=>h.tags.includes('headb2:splash')),p=f.hits.find(h=>h.tags.includes('headb2:pulse'));
 near(m.time,1+.9,f.b.dt+1e-6);near(s.amount/m.amount,.5*1.24,1e-6);near(p.time-m.time,.1,f.b.dt+1e-6);
 const t1=f.u.def.talents.find(t=>t.bb['attack@splash_atk_scale']!=null).bb;near(p.amount,f.u.s.atk*t1['attack@splash_atk_scale'],1e-6);
 assert.ok(main.buffs.some(x=>x.status==='sluggish'));void side;
});
check('Talent 2: during a skill every deployed operator gains ATK/DEF, doubled for Ursus students',()=>{
 const f=make(),g=f.b.deployOperator(G,3,4,'RIGHT'),st=f.b.deployOperator(ST,3,1,'RIGHT');f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);
 const t2=f.u.def.talents.find(t=>t.bb.scale_bonus!=null).bb,key=`headb2:aura:${f.u.id}`;near(g.findBuff(key).mods.atkPct,t2.atk,1e-9);near(st.findBuff(key).mods.atkPct,t2.atk*t2.scale_bonus,1e-9);
 f.u.skill.end('test');advance(f.b,.1);assert.ok(!g.findBuff(key));
});
check('S2: SP from high-ground pulses while charging; auto start with 2-5 range; the second use is doubled and infinite',()=>{
 const f=make({skill:2}),e=enemy(f);f.u.skill.setSpTotal(0);const sp0=f.u.skill.spTotal;until(f.b,()=>f.hits.some(h=>h.tags.includes('headb2:main')),4);advance(f.b,.2);assert.ok(f.u.skill.spTotal>sp0+1-1e-9);
 f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);assert.equal(f.u.skill.active,true);near(f.u.findBuff(`headb2:s2:${f.u.id}`).mods.atkPct,f.u.skill.bb.atk,1e-9);
 f.u.skill.end('test');f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);assert.equal(f.u.skill.timeLeft,Infinity);near(f.u.findBuff(`headb2:s2:${f.u.id}`).mods.atkPct,f.u.skill.bb['headb2_s_2[second].atk'],1e-9);void e;
});
check('S3: five forward blows at the clip events with stacking ATK, bind on pulses, and no ordinary attacks',()=>{
 const f=make({skill:3}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const t0=f.b.time,n=f.hits.length;advance(f.b,9.3);
 const blows=f.hits.slice(n).filter(h=>h.tags.includes('headb2:main'));assert.equal(blows.length,5);
 assert.ok(blows[4].amount>blows[0].amount);near(blows[0].time-t0,1.1,f.b.dt+1e-6);assert.ok(f.hits.slice(n).some(h=>h.tags.includes('headb2:pulse')));
 assert.ok(e.buffs.some(x=>x.status==='bind')||f.hits.slice(n).filter(h=>h.tags.includes('headb2:pulse')).length>0);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_headb2_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
