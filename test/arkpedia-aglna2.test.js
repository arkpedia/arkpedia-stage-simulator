// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-aglna2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedAglna2Build} from '../server/sim/content/arkpedia-aglna2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1015_aglna2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_AGLNA2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-aglna2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_aglna2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.aglna2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4,mass=0,fly=false,atk=0,pin=true}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:pin?0:1,massLevel:mass});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=1e9;
 if(pin)f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('aglna2'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedAglna2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('S1 passive: lifted off from deployment with two targets; talent Arts riders by weight and the weightless field',()=>{
 const f=make({skill:1}),light=enemy(f),heavy=enemy(f,{col:5,mass:5});advance(f.b,.1);assert.ok(f.u.s.flags.liftoff);assert.ok(f.u.findBuff(`aglna2:t2:${f.u.id}`));
 assert.ok(light.findBuff(`aglna2:weightless:${f.u.id}`));until(f.b,()=>tagged(f,'aglna2:t1').length>=2,6);const t=tal(f.u,'atk_scale_lo');
 const onLight=tagged(f,'aglna2:t1').find(h=>h.target===light),onHeavy=tagged(f,'aglna2:t1').find(h=>h.target===heavy);
 near(onLight.raw,onLight.atk*t.atk_scale_hi,1e-6);near(onHeavy.raw,onHeavy.atk*t.atk_scale_lo,1e-6);
});
check('Talent 2: a lifted-off ally regenerates 10% max HP a second while blocking',()=>{
 const f=make({skill:1}),e=enemy(f,{fly:true,col:3});advance(f.b,.2);f.u.hp=f.u.s.maxHp*.5;const hp=f.u.hp;advance(f.b,1);assert.equal(e.blockedBy,f.u,'blocks the flier');assert.ok(f.u.hp>=hp+f.u.s.maxHp*tal(f.u,'hp_recovery_per_sec_by_max_hp_ratio').hp_recovery_per_sec_by_max_hp_ratio*.9);
});
check('S2: a 2.5 s glide levitates ground enemies and ground-binds fliers, then five-target Arts attacks',()=>{
 const f=make({skill:2}),g=enemy(f),fl=enemy(f,{col:5,fly:true});f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);
 assert.ok(g.s.flags.levitate);assert.equal(fl.motion,'WALK');assert.ok(fl.s.flags.noMove);advance(f.b,2.4);assert.equal(plain(f,n).length,0,'no attacks while gliding');
 until(f.b,()=>plain(f,n).length>0,4);assert.equal(plain(f,n)[0].type,'arts');advance(f.b,f.u.skill.bb.buff_duration_ground_bound);assert.equal(fl.motion,'FLY');
});
check('S3: ammo-bound liftoff with air protection, slowed fliers, and a move onto an unblocked flier',()=>{
 const f=make({skill:3}),fl=enemy(f,{col:5,fly:true,pin:false});f.b.addBuff(fl,{key:'fixture:still',flags:{disarm:true,noMove:true}});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.ok(f.u.s.flags.liftoff);advance(f.b,.1);assert.ok(fl.findBuff(`aglna2:s3-slow:${f.u.id}`));assert.deepEqual([f.u.tileR,f.u.tileC],[3,5]);
 const hp=f.u.hp;f.b.dealDamage(fl,f.u,{amount:1000,type:'true'});const tr=f.u.hp;f.u.hp=hp;f.b.dealDamage(fl,f.u,{amount:1000,type:'phys',canDodge:false});
 assert.ok(hp-f.u.hp<(hp-tr)*(1-f.u.skill.bb.damage_resistance)+1,'air protection');
 f.o.ammo=1;until(f.b,()=>!f.u.skill.active,8);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_aglna2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
