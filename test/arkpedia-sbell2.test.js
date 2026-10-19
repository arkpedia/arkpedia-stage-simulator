// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-sbell2-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedSbell2Build} from '../server/sim/content/arkpedia-sbell2.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_1046_sbell2',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_SBELL2==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-sbell2-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_sbell2_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.sbell2Owner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4,atk=0,pin=true}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def:0,res:0,moveSpeed:pin?0:1});e.markDirty();void e.s;e.hp=1e9;
 if(pin)f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('sbell2'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedSbell2Build(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: every 5.5 s ground tiles in range gain snow; an enemy on it takes 80% ATK Arts once and is slowed 12% per layer',()=>{
 const f=make({skill:3}),t=tal(f.u,'max_cast_cnt');advance(f.b,t.interval+.1);assert.equal(f.o.layers(3,4),1);advance(f.b,t.interval);assert.equal(f.o.layers(3,4),2);
 const e=enemy(f);advance(f.b,.1);const hit=tagged(f,'sbell2:t1-enter');assert.equal(hit.length,1);near(hit[0].raw,hit[0].atk*t.talent_magic_scale,1e-6);
 near(e.findBuff(`sbell2:snow:${f.u.id}`).mods.movePct,t.move_speed*2,1e-9);advance(f.b,1);assert.equal(tagged(f,'sbell2:t1-enter').length,1,'once per entry');
 assert.equal(plain(f).length,0,'Phalanx: no attacks while idle');
});
check('The first enemy leaving a snowy tile clears it',()=>{
 const f=make({skill:3}),t=tal(f.u,'max_cast_cnt');advance(f.b,t.interval+.1);const e=enemy(f);advance(f.b,.1);e.x=5;f.b._buildEnemyIndex();advance(f.b,.1);assert.equal(f.o.layers(3,4),0);
});
check('Talent 2: attackers become cold; the first fatal damage restores her HP and freezes her and enemies in range',()=>{
 const f=make({skill:3}),e=enemy(f),t=tal(f.u,'freeze');f.b.dealDamage(e,f.u,{amount:10,type:'phys'});assert.ok(e.s.flags.cold);
 f.b.dealDamage(null,f.u,{amount:f.u.hp*10,type:'true',sourceless:true,canDodge:false});advance(f.b,.1);
 assert.equal(f.u.alive,true);near(f.u.hp,f.u.s.maxHp,1);assert.ok(f.u.s.flags.freeze||f.u.s.flags.stun);assert.ok(e.s.flags.freeze);
 f.b.dealDamage(null,f.u,{amount:f.u.hp*10,type:'true',sourceless:true,canDodge:false});assert.equal(f.u.alive,false,'only once');void t;
});
check('S1: 520% Arts, cold and a push to every enemy in range, then snow spreads ahead',()=>{
 const f=make({skill:1}),e=enemy(f,{pin:false});f.b.addBuff(e,{key:'fixture:still',flags:{disarm:true}});const y0=e.y;f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;assert.equal(f.b.activateOperator(ID),true);
 const s1=tagged(f,'sbell2:s1',n);assert.equal(s1.length,1);near(s1[0].raw,s1[0].atk*f.u.skill.bb.atk_scale,1e-6);assert.ok(e.s.flags.cold);assert.notEqual(e.y,y0);
 assert.ok([...f.o.snow.keys()].length>=1,'snow spread ahead');
});
check('S2: infinite 380% attacks, snow damage 20% a second, and cold on leaving snow',()=>{
 const f=make({skill:2}),t=tal(f.u,'max_cast_cnt');advance(f.b,t.interval+.1);const e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.timeLeft,Infinity);
 const n=f.hits.length;until(f.b,()=>tagged(f,'sbell2:s2-snow',n).length>0&&plain(f,n).length>0,8);const bb=f.u.skill.bb;near(plain(f,n)[0].raw,plain(f,n)[0].atk*bb['attack@atk_scale_s2'],1e-6);
 near(tagged(f,'sbell2:s2-snow',n)[0].raw,tagged(f,'sbell2:s2-snow',n)[0].atk*bb['talent@s2_magic_scale'],1e-6);e.x=5;f.b._buildEnemyIndex();advance(f.b,.1);assert.ok(e.s.flags.cold);
});
check('S3: enemies in range are attracted, snow forms every 1.5 s, and attacks deal 260%',()=>{
 const f=make({skill:3}),e=enemy(f,{pin:false,col:5});f.b.addBuff(e,{key:'fixture:still',flags:{disarm:true}});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.ok(e.s.flags.attract,JSON.stringify({inr:f.u.rangeKeySet.has(3*21+5),pos:[e.y,e.x],b:e.buffs.map(x=>x.key)}));advance(f.b,1.6);assert.ok([...f.o.snow.values()].some(v=>v>=1));const n=f.hits.length;until(f.b,()=>plain(f,n).length>0,6);near(plain(f,n)[0].raw,plain(f,n)[0].atk*f.u.skill.bb['attack@atk_scale_s3'],1e-6);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_sbell2_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,3,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
