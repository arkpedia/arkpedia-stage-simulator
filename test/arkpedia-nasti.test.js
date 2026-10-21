// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-nasti-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {summonCardId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {selectedNastiBuild,NASTI_DEVICES} from '../server/sim/content/arkpedia-nasti.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4212_nasti',G='char_122_beagle',Ex='char_103_angel',candidate=process.env.ARKPEDIA_REVIEW_NASTI==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-nasti-candidate.json',import.meta.url))):normal;
const CARD=summonCardId(ID);
function make({skill=1,rank=10,elite=2,at=[3,4],dir='RIGHT'}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_nasti_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[Ex])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,at[0],at[1],dir);assert.ok(u);
 const hits=[];b.on('damaged',h=>hits.push({time:b.time,source:h.source,target:h.target,amount:h.amount,type:h.dmg.type}));
 return{b,u,o:u.mem.nastiOwner,build:b.bench[ID].build,cost:before-b.dp,hits,state:()=>b.regularSummons.get(CARD)};
}
function enemy(f,{row=3,col=5,ranged=false}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});if(ranged)e.def={...e.def,applyWay:'RANGED'};e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const device=(f,r,c,dir='RIGHT')=>{f.b.addDp('arkpedia',99);f.state().readyAt=0;const t=deployRegularSummon(f.b,CARD,r,c,dir);assert.ok(t);return t;};
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,.05);};
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedNastiBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
for(const skill of[1,2,3])check(`S${skill} uses its own device with three in stock and gains one more ${skill===2?'when it ends':'when it starts'}`,()=>{
 const f=make({skill});assert.equal(f.state().record.id,NASTI_DEVICES[skill-1]);assert.equal(f.state().stock,tal(f.u,'cnt').cnt);
 cast(f);assert.equal(f.state().stock,tal(f.u,'cnt').cnt+(skill===2?0:1));if(skill===2){until(f.b,()=>!f.u.skill.active,10);assert.equal(f.state().stock,tal(f.u,'cnt').cnt+1);}
});
check('Talent 2: Sanctuary, stronger for her and high-ground operators once a ranged enemy appears, and SP over time',()=>{
 const f=make(),{b,u}=f,t2=tal(u,'nasti_t2[res].damage_resistance');advance(b,.1);
 near(u.findBuff(`nasti:t2:${u.id}`).mods.physTakenMul,1-t2['nasti_t2[res].damage_resistance'],1e-9);
 const x=b.deployOperator(Ex,1,3,'RIGHT');advance(b,.1);assert.equal(x.findBuff(`nasti:t2:${u.id}`),null);
 enemy(f,{ranged:true});advance(b,.1);near(u.findBuff(`nasti:t2:${u.id}`).mods.physTakenMul,1-t2['nasti_t2[res_plus].damage_resistance'],1e-9);near(x.findBuff(`nasti:t2:${u.id}`).mods.physTakenMul,1-t2['nasti_t2[res_plus].damage_resistance'],1e-9);
 const sp=u.skill.sp;advance(b,t2['nasti_t2[add_sp].interval']+.05);assert.ok(u.skill.sp>=sp+t2['nasti_t2[add_sp].interval']+1-1e-6,'1 SP more than time');
});
check('S1: the inspector raises its front operator DEF; during S1 it adds block and more DEF while it decays, and she hits every blocked enemy',()=>{
 const f=make({skill:1}),{b,u,o}=f,g=b.deployOperator(G,3,6,'LEFT'),d=device(f,3,5,'RIGHT');advance(b,.1);
 const k=`nasti:inspector:${d.id}`;assert.ok(g.findBuff(k).mods.defPct>0);const blk=g.s.blockCnt;
 cast(f);advance(b,.1);assert.equal(g.s.blockCnt,blk+1);const hp=d.hp;advance(b,1);near(hp-d.hp,d.s.maxHp*.02,.5);
 const a=enemy(f,{col:4.3}),c=enemy(f,{col:4.4});until(b,()=>[a,c].every(e=>f.hits.some(h=>h.source===u&&h.target===e)),6);void o;
});
check('S2: supervisors feed their front operator SP and a capped barrier while they drain, leave at the end, and she shields herself without attacking',()=>{
 const f=make({skill:2}),{b,u,o}=f,g=b.deployOperator(G,3,6,'LEFT'),d=device(f,3,5,'RIGHT');advance(b,.1);assert.ok(d.hp<d.s.maxHp);
 d.hp=d.s.maxHp;const e=enemy(f,{col:4.3}),sp=g.skill.sp;cast(f);advance(b,1.05);
 assert.ok(g.findBuff(`nasti:supervisor:shield:${u.id}`).shield>0);assert.ok(g.skill.sp>sp+1);assert.ok(d.hp<d.s.maxHp);
 assert.ok(u.findBuff(`nasti:s2:shield:${u.id}`).shield>0);assert.ok(!f.hits.some(h=>h.source===u&&h.time>b.time-1),'no attacks');
 until(b,()=>!u.skill.active,6);advance(b,.1);assert.equal(d.alive,false);void e;void o;
});
check('S3: an engineer builds a platform in front; at full SP it upgrades, takes a ranged operator, blocks, buffs, outlives her at level 6 and drops its guest when it falls',()=>{
 const f=make({skill:3,at:[2,1]}),{b,u,o}=f,eng=device(f,3,3,'RIGHT');advance(b,.1);const p=o.platform;
 assert.deepEqual([p.tileR,p.tileC],[3,4]);assert.equal(p.mem.nastiLevel,3);assert.equal(p.s.blockCnt,0);
 assert.match(b.placementError(Ex,3,4)??'',/ranged tile/);f.state().readyAt=0;assert.match(summonPlacementError(b,CARD,2,2)??'',/limit/);
 until(b,()=>p.mem.nastiLevel===4,60);assert.equal(p.s.blockCnt,1);assert.equal(b.placementError(Ex,3,4),null);
 const x=b.deployOperator(Ex,3,4,'RIGHT');advance(b,.1);assert.equal(x.ground,false);assert.equal(b.unitAt(3,4),p);assert.equal(p.mem.regularHost.guest,x);
 assert.ok(x.findBuff(`nasti:platform:bonus:${p.id}`).mods.atkPct>0);assert.match(b.placementError(G,3,4)??'',/melee tile/);
 const e=enemy(f,{col:4.3});advance(b,.2);assert.equal(e.blockedBy,p);
 cast(f);until(b,()=>p.mem.nastiLevel===6,200);assert.equal(p.mem.regularKeepOnOwnerRemoved,true);
 b.retreatOperator(ID);advance(b,.1);assert.equal(p.alive,true,'the level-6 platform stays');assert.equal(eng.alive,false);
 b.dealDamage(null,p,{amount:1e9,type:'true',sourceless:true});advance(b,.1);assert.equal(p.alive,false);assert.equal(x.alive,false,'its guest leaves');
 assert.deepEqual(b.errors,[]);void u;
});
check('A guest moved off the platform (relocate) leaves it free for another ranged operator',()=>{
 const f=make({skill:3,at:[2,1]}),{b,o}=f;device(f,3,3,'RIGHT');advance(b,.1);const p=o.platform;until(b,()=>p.mem.nastiLevel===4,60);
 const x=b.deployOperator(Ex,3,4,'RIGHT');advance(b,.05);assert.equal(p.mem.regularHost.guest,x);
 assert.equal(b.relocate(x,1,5),true);assert.equal(p.mem.regularHost.guest,null);assert.equal(x.mem.regularHostedBy,undefined);assert.equal(b.unitAt(3,4),p,'the platform keeps its tile');
 assert.equal(p.mem.regularHost.accepts({defId:Ex,kind:'op'}),true);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_nasti_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,5,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(g&&!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,2,5,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u?.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
