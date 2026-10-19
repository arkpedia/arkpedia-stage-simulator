// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-chen3-runtime-review.json' with {type:'json'};
import evidence from '../data/arkpedia-native-operators/char_1050_chen3.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedChen3Build,verifyChen3Source} from '../server/sim/content/arkpedia-chen3.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1050_chen3',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_CHEN3==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-chen3-candidate.json',import.meta.url))):normal;
const M=evidence.models[ID].Front;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_chen3_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.chen3Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=3.4,def=0,res=0,hp=1e9,atk=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:hp,atk,def,res,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
test('Sword wave speed, life, hit distance and bounce flags are the original prefab values',()=>verifyChen3Source());
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedChen3Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1 ATK/ASPD; weakness damage chooses Physical against high RES and Arts against high DEF',()=>{
 const f=make(),e=enemy(f,{res:90});const t=f.u.findBuff('chen3:t1');assert.ok(t);near(t.mods.atkPct,f.u.def.talents.find(x=>x.bb.attack_speed!=null).bb.atk,1e-9);
 until(f.b,()=>f.hits.length>0,6);assert.equal(f.hits[0].type,'phys');assert.equal(f.hits[0].target,e);
 const g=make(),h=enemy(g,{def:2000});until(g.b,()=>g.hits.length>0,6);assert.equal(g.hits[0].type,'arts');void h;
});
check('Talent 2: seven quiet seconds heal and grant one evade; damage restarts the count; the evade cancels the next hit',()=>{
 const f=make();f.u.hp=1;let healed=0;f.b.on('heal',c=>{if(c.target===f.u)healed+=c.amount??0;});advance(f.b,6.5);assert.equal(f.o.evade,false);
 advance(f.b,1);assert.equal(f.o.evade,true);assert.ok(f.u.hp>1);
 const e=enemy(f,{atk:200});const hp=f.u.hp;until(f.b,()=>f.o.evade===false,6);assert.equal(f.u.hp,hp,'first hit evaded');
 until(f.b,()=>f.u.hp<hp,6);advance(f.b,6.5);assert.equal(f.o.evade,false,'count restarted by damage');void e;void healed;
});
check('S1: ATK up, two hits per attack at the Skill_1_Loop events, struck enemies silenced until the skill ends',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'chen3:s1-second',n).length>0,5);const first=f.hits.slice(n).find(h=>!h.tags?.includes('chen3')),second=tagged(f,'chen3:s1-second',n)[0];
 near(second.time-first.time,(M.hits.Skill_1_Loop[1]-M.hits.Skill_1_Loop[0])/(f.u.base.bat/f.u.s.interval),f.b.dt*2+1e-6);assert.ok(e.s.flags.silence);
 f.u.skill.end('test');advance(f.b,.1);assert.ok(!e.s.flags.silence);
});
check('S2: away and invincible for 2 s, ten 480% slashes with a kill transfer adding one, then a move onto the survivor with ATK and evasion',()=>{
 const f=make({skill:2}),weak=enemy(f,{hp:1}),tough=enemy(f,{col:4});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.equal(f.u.skill.spTotal,0);assert.ok(f.u.s.flags.invulnerable);const n=f.hits.length,atk=f.u.s.atk;advance(f.b,2.6);
 const slashes=tagged(f,'chen3:s2-slash',n);assert.equal(slashes.length,11);near(slashes[0].raw,atk*f.u.skill.bb.atk_scale,1e-6);
 assert.equal(weak.alive,false);assert.ok(!f.u.s.flags.invulnerable);assert.deepEqual([f.u.tileR,f.u.tileC],[3,4]);
 near(f.u.findBuff('chen3:s2-respawn').mods.atkPct,f.u.skill.bb['chen3_s2[respawn_buff].atk'],1e-9);void tough;
});
check('S3: wider range, four targets hit three times, and the sword wave bounces dealing max(6% current HP, 580% ATK)',()=>{
 const f=make({skill:3}),a=enemy(f,{col:4,hp:2e4}),c=enemy(f,{col:5}),d=enemy(f,{col:6});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;
 until(f.b,()=>tagged(f,'chen3:s3-wave',n).length>=3,6);const w=tagged(f,'chen3:s3-wave',n),bb=f.u.skill.bb;
 const onA=w.find(h=>h.target===a),onC=w.find(h=>h.target===c);near(onA.raw,f.u.s.atk*bb.projectile_min_atk_scale,1e-6);near(onC.raw,1e9*bb.hp_ratio,1e3);
 until(f.b,()=>tagged(f,'chen3:s3-wave',n).length>=6,12);assert.ok(tagged(f,'chen3:s3-hit',n).length>=2);void d;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_chen3_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
