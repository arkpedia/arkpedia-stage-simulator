// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-titi-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedTitiBuild} from '../server/sim/content/arkpedia-titi.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4056_titi',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_TITI==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-titi-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,90][elite],skillId:`skchr_titi_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'UP');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,o:u.mem.titiOwner,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{row=3,col=4}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const until=(b,p,s=30)=>{const end=b.time+s;while(!p()&&b.time<end)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);};
const tal=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null).bb;
const tagged=(f,t,from=0)=>f.hits.slice(from).filter(h=>h.tags?.includes(t));
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP`,()=>{
 const f=make({skill,rank}),r=selectedTitiBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Arts hit at the Attack clip event heals an ally for half the damage; non-moving targets take the talent bonus',()=>{
 const f=make(),e=enemy(f),g=f.b.deployOperator(G,3,3,'RIGHT');g.hp=1;until(f.b,()=>f.hits.length>=2,6);
 const main=f.hits.find(h=>!h.tags?.includes('titi')),still=tagged(f,'titi:still')[0];assert.equal(main.type,'arts');assert.equal(main.target,e);
 near(still.amount,f.u.s.atk*tal(f.u,'extra_atk_scale').extra_atk_scale,1e-6);assert.ok(g.hp>1);
});
check('Talent 1: she reaches sleeping enemies and sleepers take 32% ATK Arts each second',()=>{
 const f=make(),e=enemy(f);f.b.applyStatus(e,'sleep',{duration:30});const n=f.hits.length;advance(f.b,3.05);
 const burn=tagged(f,'titi:sleeping',n);assert.ok(burn.length>=3);near(burn[0].amount,f.u.s.atk*tal(f.u,'damage_atk_scale').damage_atk_scale,1e-6);
 assert.ok(f.hits.slice(n).some(h=>!h.tags?.includes('titi')&&h.target===e),'ordinary hit lands on a sleeper');
});
check('Talent 2: Sargon Titi above half HP has vigor ASPD, lost at or below half',()=>{
 const f=make();advance(f.b,.1);const v=f.u.findBuff('titi:vigor');assert.ok(v);near(v.mods.aspd,tal(f.u,'hp_ratio').attack_speed,1e-9);
 assert.equal(f.b.regularNations[ID],'sargon');assert.ok(!f.b.allyUnits.find(a=>a.defId===G)?.findBuff?.('titi:vigor'));
 f.u.hp=f.u.s.maxHp*.5;advance(f.b,.1);assert.ok(!f.u.findBuff('titi:vigor'));
});
check('S1: ATK up and attacks put targets to sleep for 3 s by chance',()=>{
 const f=make({skill:1}),e=enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 until(f.b,()=>e.s.flags.sleep,15);assert.ok(e.buffs.some(x=>x.status==='sleep'||x.key==='sleep'||x.flags?.sleep));
});
check('S2: stops attacking, sleeps herself and the lowest-HP ally, keeps nearby enemies asleep, talent x3.3, manual stop',()=>{
 const f=make({skill:2}),e=enemy(f,{col:3.6}),g=f.b.deployOperator(G,3,3,'RIGHT');g.hp=g.s.maxHp*.3;advance(f.b,1);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,1.05);
 assert.equal(f.u.s.flags.sleep,true);assert.equal(g.s.flags.sleep,true);assert.equal(e.s.flags.sleep,true);
 const n=f.hits.length;advance(f.b,3);assert.equal(f.hits.slice(n).filter(h=>!h.tags?.includes('titi')).length,0,'no ordinary attacks');
 near(tagged(f,'titi:sleeping',n)[0].amount,f.u.s.atk*tal(f.u,'damage_atk_scale').damage_atk_scale*f.u.skill.bb.talent_scale,1e-6);
 assert.equal(f.b.activateOperator(ID),true);assert.equal(f.u.skill.active,false);assert.ok(!f.u.s.flags.sleep&&!g.s.flags.sleep);
});
check('S3: two targets slept for 5 s; a wake costs scaled Arts and chains sleep; fatal hits on allies in range become sleep',()=>{
 const f=make({skill:3}),a=enemy(f),c=enemy(f,{col:4.6}),d=enemy(f,{col:5.5}),g=f.b.deployOperator(G,3,3,'RIGHT');
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>a.s.flags.sleep&&c.s.flags.sleep,5);
 const n=f.hits.length;until(f.b,()=>tagged(f,'titi:s3-wake',n).length>0,7);const w=tagged(f,'titi:s3-wake',n)[0],bb=f.u.skill.bb;
 assert.ok(w.amount>=f.u.s.atk*bb.min_atk_scale-1e-6&&w.amount<=f.u.s.atk*bb.max_atk_scale+1e-6);
 f.b.dealDamage(a,g,{amount:1e9,type:'true',canDodge:false});assert.equal(g.alive,true);assert.equal(g.hp,1);assert.equal(g.s.flags.sleep,true);
 f.u.skill.end('test');advance(f.b,.1);assert.ok(!g.s.flags.sleep);void d;
});
for(const skill of[1,2,3])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_titi_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready&&skill!==2)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
