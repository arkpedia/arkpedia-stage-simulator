// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-oblvns-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedOblvnsBuild,verifyOblvnsSource} from '../server/sim/content/arkpedia-oblvns.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4182_oblvns',NY='char_4185_amoris',UM='char_4186_tmoris',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_OBLVNS==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-oblvns-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2,extra=[]}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_oblvns_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),...extra.map(([id,s])=>({...defaultBuild(d.operators[id]),...(s?{skillId:s}:{})}))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.oblvnsOwner,build:b.bench[ID].build,cost:before-b.dp,hits,fever:b._aveMujicaFever};
}
function enemy(f,{row=3,col=5,res=0,def=0}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def,res,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
test('Note speeds and tracing times are the original projectile prefab values',()=>verifyOblvnsSource());
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedOblvnsBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Ordinary notes fly, track and hit with the Lord 80% on unblocked enemies; each live note grants members penetration',()=>{
 const f=make(),e=enemy(f);until(f.b,()=>f.o.notes.length>0,4);const pen=f.u.findBuff(`oblvns:notes:${f.u.id}`);assert.ok(pen);
 const t2=f.u.def.talents.find(t=>t.bb.max_cnt).bb;near(pen.mods.defIgnorePct,t2.def_penetrate_ratio*Math.min(t2.max_cnt,f.o.notes.length),1e-9);
 until(f.b,()=>f.hits.length>0,4);const h=f.hits[0];assert.equal(h.target,e);assert.equal(h.type,'phys');near(h.amount,f.u.s.atk*.8,1e-6);
});
check('Talent 2: Fever +3 per damage dealt and the ASPD aura covers allies in her range',()=>{
 const f=make(),e=enemy(f),g=f.b.deployOperator(G,3,4,'RIGHT');until(f.b,()=>f.hits.length>=2,6);
 assert.ok(f.fever.value>=3*f.hits.length);assert.ok(g.findBuff(`oblvns:aspd:${f.u.id}`));void e;
});
check('Members whose range overlaps hers gain her range as an extension',()=>{
 const f=make({extra:[[NY]]});const ny=f.b.deployOperator(NY,3,4,'RIGHT');advance(f.b,.2);
 assert.ok(ny.extraRangeKeys?.length>0);assert.ok(ny.rangeKeySet.has(3*21+6));
});
check('S1 fires eight Arts notes scaled 100%..5% and auto-releases at full charges without starting Fever',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost*2);f.fever.value=f.fever.need;advance(f.b,.1);
 assert.ok(f.u.skill.activations>=1);assert.equal(f.fever.active,false);
 until(f.b,()=>f.hits.filter(h=>h.tags.includes('oblvns:s1')).length>=8,5);
 const s1=f.hits.filter(h=>h.tags.includes('oblvns:s1')).slice(0,8).map(h=>h.amount).sort((a,b)=>b-a);
 const bb=f.u.skill.bb;near(s1[0]/s1[7],bb.atk_scale/bb.atk_scale_8,1e-6);void e;
});
check('S2 switches piano (initial, ATK, Physical piercing) to organ (ASPD, Arts); during Fever it cannot be cast and fires two notes',()=>{
 const f=make({skill:2}),e=enemy(f);until(f.b,()=>f.hits.length>0,4);assert.equal(f.hits[0].type,'phys');assert.equal(f.o.instrument,'piano');
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);assert.equal(f.o.instrument,'organ');const n=f.hits.length;
 until(f.b,()=>f.hits.slice(n).some(h=>h.tags.includes('oblvns:organ')),5);assert.equal(f.hits.slice(n).find(h=>h.tags.includes('oblvns:organ')).type,'arts');
 f.fever.value=f.fever.need;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);assert.equal(f.o.instrument,'organ');assert.equal(f.fever.active,true);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),false);void e;
});
check('S3 fires two Physical notes at the highest-RES and two Arts at the highest-DEF enemy',()=>{
 const f=make({skill:3}),a=enemy(f,{res:50}),c=enemy(f,{row:3,col:4,def:500});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 const n=f.hits.length;until(f.b,()=>f.hits.slice(n).filter(h=>h.tags.includes('oblvns:s3')).length>=4,5);
 const s3=f.hits.slice(n).filter(h=>h.tags.includes('oblvns:s3')).slice(0,4);assert.equal(s3.filter(h=>h.type==='phys'&&h.target===a).length,2);assert.equal(s3.filter(h=>h.type==='arts'&&h.target===c).length,2);
});
check('Fever with three members: a manual cast at 450 starts it, idle members are started, timers held, S3 keeps members alive until it ends',()=>{
 const f=make({skill:3,extra:[[NY,'skchr_amoris_2'],[UM,'skchr_tmoris_1']]}),e=enemy(f);
 const ny=f.b.deployOperator(NY,3,4,'RIGHT'),um=f.b.deployOperator(UM,3,1,'RIGHT');assert.ok(ny&&um);advance(f.b,1.5);
 f.fever.value=f.fever.need;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 assert.equal(f.fever.active,true);assert.equal(ny.skill.active,true);assert.equal(f.fever.joined.size,3);
 const left=ny.skill.timeLeft;advance(f.b,5);near(ny.skill.timeLeft,left,1e-9);assert.ok(um.skill.activations>=2,'continuous S1 casts');
 f.b.dealDamage(e,ny,{amount:1e9,type:'true',canDodge:false});assert.equal(ny.alive,true);assert.equal(ny.hp,1);
 advance(f.b,15.1);assert.equal(f.fever.active,false);assert.equal(ny.deployed&&ny.alive,false);
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP and actual Sakiko damage`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_oblvns_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
