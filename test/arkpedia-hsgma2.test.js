// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-hsgma2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedHsgma2Build,verifyHsgma2Source} from '../server/sim/content/arkpedia-hsgma2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1044_hsgma2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_HSGMA2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-hsgma2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_hsgma2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.hsgma2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=3.4,atk=0,hp=1e9}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:hp,atk,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const hit=(f,amount)=>f.b.dealDamage(null,f.u,{amount,type:'true',sourceless:true,canDodge:false});
test('Shield radius, angular speed and sweep are the original prefab values',()=>verifyHsgma2Source());
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedHsgma2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: at 0 HP she stays in the field, is heal-free, accumulates damage and falls at 200% of max HP',()=>{
 const f=make(),mh=f.u.s.maxHp;hit(f,f.u.hp+mh*.5);assert.equal(f.u.alive,true);assert.equal(f.o.minus,true);near(f.o.pool,mh*.5,1e-3);assert.ok(f.u.s.flags.noHeal);
 hit(f,mh*1.4);assert.equal(f.u.alive,true);hit(f,mh*.2);assert.equal(f.u.alive,false);
});
check('Talent 1: after 4 quiet seconds she recovers 5% max HP per second and leaves the state above 0 HP',()=>{
 const f=make(),mh=f.u.s.maxHp,t=tal(f.u,'max_minus_hp_ratio');hit(f,f.u.hp+mh*.1);advance(f.b,t['hsgma2_t_1[heal].interval']-.1);assert.equal(f.o.minus,true);near(f.o.pool,mh*.1,1e-3);
 advance(f.b,2.2);assert.equal(f.o.minus,false);assert.ok(f.u.hp>0&&f.u.hp<mh*.02);
});
check('Talent 2: berserk ATK/RES rise as HP falls to 30% and stay full in the minus state',()=>{
 const f=make(),t=tal(f.u,'min_hp_ratio');advance(f.b,.1);near(f.u.findBuff('hsgma2:berserk').mods.atkPct,0,1e-9);
 f.u.hp=f.u.s.maxHp*.65;advance(f.b,.05);near(f.u.findBuff('hsgma2:berserk').mods.atkPct,t.min_atk*.5,1e-6);near(f.u.findBuff('hsgma2:berserk').mods.resFlat,t.min_magic_resistance*.5,1e-6);
 hit(f,f.u.hp+10);advance(f.b,.05);near(f.u.findBuff('hsgma2:berserk').mods.atkPct,t.min_atk,1e-9);
});
check('S1: charged by damage taken, then permanent ATK/DEF, Arts attacks, and 175% Arts back at every attacker',()=>{
 const f=make({skill:1}),e=enemy(f,{atk:300});until(f.b,()=>f.u.skill.active,60);assert.equal(f.u.skill.timeLeft,Infinity);const n=f.hits.length;
 until(f.b,()=>tagged(f,'hsgma2:s1-return',n).length>0,6);near(tagged(f,'hsgma2:s1-return',n)[0].raw,f.u.s.atk*f.u.skill.bb.atk_scale,f.u.s.atk*.01,'berserk ATK moves with HP');
 until(f.b,()=>f.hits.slice(n).some(h=>!h.tags?.includes('hsgma2')),6);assert.equal(f.hits.slice(n).find(h=>!h.tags?.includes('hsgma2')).type,'arts');void e;
});
check('S2: a three-hit throw, then the shield circles once applying sluggish, Arts every 0.5 s and healing her',()=>{
 const f=make({skill:2}),e=enemy(f),side=enemy(f,{row:2,col:3});f.u.hp=f.u.s.maxHp*.5;f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;
 until(f.b,()=>tagged(f,'hsgma2:s2-throw',n).length>=2,6);until(f.b,()=>tagged(f,'hsgma2:s2-shield',n).length>0,6);
 const sh=tagged(f,'hsgma2:s2-shield',n)[0];near(sh.raw,f.u.s.atk*f.u.skill.bb.shield_atk_scale,1e-6);assert.ok(sh.target.buffs.some(x=>x.status==='sluggish'));
 assert.ok(f.u.hp>f.u.s.maxHp*.5);advance(f.b,5);assert.equal(f.o.shield,null,'one turn then gone');void e;void side;
});
check('S3: max HP and ATK, a manual stop starts an undying last stand protecting allies, then a forced defeat',()=>{
 const f=make({skill:3}),e=enemy(f),g=f.b.deployOperator(G,3,4,'RIGHT');f.u.skill.setSpTotal(f.u.skill.spCost);const mh=f.u.s.maxHp;assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);
 near(f.u.s.maxHp,mh*(1+f.u.skill.bb.max_hp),1);assert.equal(f.b.activateOperator(ID),true,'manual stop');assert.ok(f.o.stand);assert.equal(f.b.activateOperator(ID),false);
 advance(f.b,.1);assert.ok(g.findBuff('hsgma2:aura'));f.b.dealDamage(null,g,{amount:g.hp+500,type:'true',sourceless:true,canDodge:false});assert.equal(g.alive,true);
 hit(f,f.u.hp*10);assert.equal(f.u.alive,true);advance(f.b,f.u.skill.bb.before_dead_duration);assert.equal(f.u.alive,false);assert.ok(!g.findBuff('hsgma2:aura'));void e;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_hsgma2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready&&skill===3)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
