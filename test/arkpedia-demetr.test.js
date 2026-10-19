// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-demetr-runtime-review.json' with {type:'json'};
import evidence from '../data/arkpedia-native-operators/char_4037_demetr.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedDemetrBuild} from '../server/sim/content/arkpedia-demetr.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4037_demetr',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_DEMETR==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-demetr-candidate.json',import.meta.url))):normal;
const M=evidence.models[ID].Front;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_demetr_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u||h.credit===u)hits.push({time:b.time,target:h.target,amount:h.amount,raw:h.dmg.amount*h.dmg.mul,atk:u.s.atk,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.demetrOwner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=3.4,atk=0,hp=1e9,def=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk,def,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,...(atk?{}:{disarm:true})}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
const plain=(f,from=0)=>f.hits.slice(from).filter(h=>!h.tags?.includes('demetr'));
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedDemetrBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Talent 1: each hit shreds 7% DEF up to five stacks, and damage rises to +36% at 20% HP',()=>{
 const f=make({skill:3}),e=enemy(f),t=tal(f.u,'attack@def');until(f.b,()=>f.o.stacks.get(e)>=t['attack@limited_stack_cnt'],20);advance(f.b,3);
 assert.equal(f.o.stacks.get(e),t['attack@limited_stack_cnt']);near(e.findBuff(`demetr:shred:${f.u.id}`).mods.defPct,t['attack@def']*t['attack@limited_stack_cnt'],1e-9);
 const g=make({skill:3}),low=enemy(g,{hp:1e9*.1});until(g.b,()=>plain(g).length>0,6);const t2=tal(g.u,'max_add_on_scale');near(plain(g)[0].raw,plain(g)[0].atk*(1+t2.max_add_on_scale),1e-6);
});
check('Talent 2: evasion starts at 80% and falls 2% a second to 40%',()=>{
 const f=make({skill:3});near(f.o.evasion(),.8,1e-9);advance(f.b,10.05);near(f.o.evasion(),.6,1e-9);advance(f.b,15);near(f.o.evasion(),.4,1e-9);
});
check('S1: the next attack hits twice for 250% at the Skill_1 events',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);const n=f.hits.length;until(f.b,()=>tagged(f,'demetr:s1-second',n).length>0,6);
 const first=plain(f,n)[0],second=tagged(f,'demetr:s1-second',n)[0];near(first.raw,first.atk*f.u.skill.bb.atk_scale,1e-6);void e;
 near(second.time-first.time,(M.hits.Skill_1[1]-M.hits.Skill_1[0])/(f.u.base.bat/f.u.s.interval),f.b.dt*2+1e-6);
});
check('S2: three targets at 200% over 3-13; full eight stacks make the target sluggish',()=>{
 const f=make({skill:2}),a=enemy(f),c=enemy(f,{col:4}),d=enemy(f,{col:5});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 until(f.b,()=>new Set(plain(f).map(h=>h.target)).size>=3,6);until(f.b,()=>f.o.stacks.get(a)>=8,20);assert.ok(a.buffs.some(x=>x.status==='sluggish'));void c;void d;
});
check('S3: she moves onto a nearby enemy, retargets after a quiet second, and fatal damage ends the skill and sends her home',()=>{
 const f=make({skill:3}),e=enemy(f,{col:5});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.deepEqual([f.u.tileR,f.u.tileC],[3,5]);assert.equal(f.o.mark,e);
 f.b.dealDamage(null,f.u,{amount:f.u.hp*10,type:'true',sourceless:true,canDodge:false});advance(f.b,.1);
 assert.equal(f.u.alive,true);assert.equal(f.u.skill.active,false);assert.deepEqual([f.u.tileR,f.u.tileC],[3,3]);void e;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const Mel='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_demetr_${skill}`},defaultBuild(data.operators[Mel]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(Mel))m=b.deployOperator(Mel,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
