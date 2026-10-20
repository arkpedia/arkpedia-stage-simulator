// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-kalts2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {summonCardId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {selectedKalts2Build,KALTS2_ANCHOR,KALTS2_SPLASH,KALTS2_FLIGHT_SPEED} from '../server/sim/content/arkpedia-kalts2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1052_kalts2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_KALTS2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-kalts2-candidate.json',import.meta.url))):normal;
const CARD=summonCardId(ID);
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_kalts2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const hits=[],heals=[];b.on('damaged',h=>hits.push({time:b.time,source:h.source,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags}));
 b.on('heal',h=>heals.push({time:b.time,source:h.source,target:h.target,amount:h.amount}));
 return{b,u,o:u.mem.kalts2Owner,build:b.bench[ID].build,cost:before-b.dp,hits,heals};
}
function enemy(f,{row=3,col=5,fly=false,atk=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);};
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedKalts2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: she lifts off with more HP, DEF and block, and blocks fliers only over a wider radius',()=>{
 const f=make(),t=tal(f.u,'block_radius_scale'),r=selectedKalts2Build(f.build).stats;
 assert.equal(f.u.s.flags.liftoff,true);assert.equal(f.u.s.blockCnt,r.blockCnt+t.block_cnt);near(f.u.s.maxHp,Math.round(r.maxHp*(1+t.max_hp)),1);near(f.u.hp,f.u.s.maxHp,1e-6);near(f.u.s.blockRadiusScale,t.block_radius_scale,1e-9);
 const ground=enemy(f,{row:2,col:4}),flier=enemy(f,{row:2,col:5,fly:true});flier.x=4+1.05;advance(f.b,.1);
 assert.equal(flier.blockedBy,f.u,'1.05 tiles is inside the 0.894 x 1.23 air radius');assert.notEqual(ground.blockedBy,f.u,'no ground block');
});
check('Talent 2: an operator entering her range gets Rhodes-doubled regeneration and a one-hit shield, once',()=>{
 const f=make(),t=tal(f.u,'hp_recovery_per_sec');f.b.getPlayer('arkpedia').dp=99;const a=f.b.deployOperator(G,3,5,'RIGHT');advance(f.b,.1);
 const regen=a.findBuff(`kalts2:t2:regen:${f.u.id}`),shield=a.findBuff(`kalts2:t2:shield:${f.u.id}`);assert.ok(regen&&shield);
 near(regen.mods.hpRegen,t.hp_recovery_per_sec*(a.def.tags.includes('rhodes')?t.rhodes_bonus:1),1e-9);near(regen.timeLeft,t.buff_duration,.2);assert.equal(shield.shieldHits,1);
 const hp=a.hp,e=enemy(f,{row:3,col:6});f.b.dealDamage(e,a,{amount:500,type:'phys'});assert.equal(a.hp,hp,'the shield absorbs one hit');assert.equal(a.findBuff(`kalts2:t2:shield:${f.u.id}`),null);
 advance(f.b,1);assert.equal(a.findBuff(`kalts2:t2:shield:${f.u.id}`),null,'no new shield while it stays in range');
});
check('S1: ATK and ASPD, and every other lifted-off ally blocks over a wider radius',()=>{
 const f=make({skill:1}),a=f.b.deployOperator(G,3,5,'RIGHT');f.b.addBuff(a,{key:'fixture:lift',flags:{liftoff:true}});cast(f);advance(f.b,.5);
 near(a.s.blockRadiusScale,f.u.skill.bb['attack@block_radius_scale'],1e-9);assert.ok(f.u.s.atk>f.u.base.atk*1.5);
 f.u.skill.end('manual');advance(f.b,.5);near(a.s.blockRadiusScale,0,1e-9);
});
check('S2: a medical unit at an enemy deals true damage and sluggish around it and heals allies there; with no enemy it goes to an injured ally',()=>{
 const f=make({skill:2}),a=f.b.deployOperator(G,3,5,'RIGHT');cast(f);a.hp=a.s.maxHp/2;
 until(f.b,()=>f.heals.some(h=>h.source===f.u&&h.target===a),8);assert.ok(!f.hits.some(h=>h.source===f.u),'no enemy, no damage');
 const e=enemy(f,{row:3,col:6});until(f.b,()=>f.hits.some(h=>h.source===f.u&&h.target===e),8);
 const h=f.hits.find(x=>x.source===f.u&&x.target===e);assert.equal(h.type,'true');assert.ok(h.tags.includes('kalts2:s2'));assert.ok(e.buffs.some(x=>x.status==='sluggish'));
 near(KALTS2_SPLASH,1.5,1e-9);
 until(f.b,()=>!f.u.skill.active,60);assert.equal(f.u.skill.activations,1);
});
check('S3: the anchor card goes outside her range; she flies there, two operators come back free into her new range',()=>{
 const f=make({skill:3}),{b,u}=f,a=b.deployOperator(G,3,5,'RIGHT');
 assert.match(summonPlacementError(b,CARD,1,1)??'',/S3/);cast(f);
 assert.match(summonPlacementError(b,CARD,1,5)??'',/outside/);assert.match(summonPlacementError(b,CARD,3,4)??'',/high-ground/);
 const dp=b.dp,t=deployRegularSummon(b,CARD,4,1,'RIGHT');assert.equal(t.defId,KALTS2_ANCHOR);assert.equal(dp-b.dp,t.base.cost??3);
 const left=u.skill.timeLeft,flight=Math.hypot(1-4,4-2)/KALTS2_FLIGHT_SPEED;assert.ok(f.o.flight);assert.equal(u.s.flags.untargetable,true);
 advance(b,.7);near(u.skill.timeLeft,left,1e-6);assert.equal(a.alive,false,'withdrawn after 0.6 s');
 assert.equal(b.cost(G),0);assert.ok(b.bench[G].readyAt<=b.time);assert.match(b.placementError(G,3,3)??'',/land/);
 until(b,()=>!f.o.flight,flight+1);assert.equal(u.tileR,4);assert.equal(u.tileC,1);assert.equal(t.alive,false);assert.equal(!!u.s.flags.untargetable,false);
 assert.match(b.placementError(G,3,6)??'',/inside/);assert.equal(b.placementError(G,3,3),null);
 const back=b.deployOperator(G,3,3,'RIGHT');assert.ok(back);assert.equal(b.dp,dp-3);
 assert.equal(summonPlacementError(b,CARD,1,6)?.length>0,true,'one anchor per cast');
 until(b,()=>!u.skill.active,60);assert.equal(b.placementError(G,3,6),'Operator is unavailable.');
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_kalts2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(g&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u?.alive);if(skill===2)assert.ok(u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
