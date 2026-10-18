// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-taraxa-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedTaraxaBuild} from '../server/sim/content/arkpedia-taraxa-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4222_taraxa',M='char_208_melan',T='char_4191_tippi',candidate=process.env.ARKPEDIA_REVIEW_TARAXA==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-taraxa-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=60){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition missing at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_taraxa_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators[M]),defaultBuild(d.operators[T])],support:build}
  :{operators:[build,defaultBuild(d.operators[M]),defaultBuild(d.operators[T])]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);const cost=before-b.dp;
 const target=b.deployOperator(M,2,5,'RIGHT');assert.ok(target);target.hp=target.s.maxHp*.1;
 const heals=[];b.on('calculatedHeal',h=>{if(h.source===u)heals.push({...h,time:b.time});});
 return{b,u,c:u.mem.taraxa,build:b.bench[ID].build,cost,target,heals};
}
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);}
const skillHeals=f=>f.heals.filter(h=>h.opts.isSkill);
check('Public Taraxacum binds original source/art/clocks and four pinned interface images',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Taraxacum');assert.equal(data.operators[ID].skills.length,2);
 assert.equal(review.interfaceAssets.length,4);for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['taraxa-art','ownerArtworkSha256'],['taraxa-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.ok(data.sd.models[`operator/${ID}/default/front`].animations.Skill_Die);assert.equal(data.sd.models[`operator/${ID}/default/back`].animations.Skill_Die,undefined);
});
for(const skill of[1,2])for(const potential of[1,6])for(const trust of[0,200])check(`Public S${skill} P${potential}/trust${trust} preserves selected source stats, cost and actual healing`,()=>{
 const f=make({skill,potential,trust}),r=selectedTaraxaBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);
 near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);near(f.u.s.physTakenMul,1);assert.equal(f.b.deploymentSlotCost(ID),1);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);cast(f);until(f.b,()=>skillHeals(f).length>0);
 near(f.u.s.physTakenMul,1-r.talentBb[0].damage_resistance);near(f.u.s.blockCnt,r.stats.blockCnt+r.talentBb[0].block_cnt);
 const h=skillHeals(f)[0];assert.equal(h.target.id,f.target.id);near(h.amount,r.stats.atk*(skill===2?1+r.bb['attack@atk']:1)*r.bb['attack@heal_scale']);
 assert.ok(f.u.stats.heal>0);assert.equal(f.u.skill.active,true);assert.equal(skillHud(f.u.skill).ready,false);
});
for(const skill of[1,2])for(const rank of[1,4,7,10])check(`Public S${skill} rank${rank} preserves the manual account, original modes and normal landing`,()=>{
 const f=make({skill,rank}),r=selectedTaraxaBuild(f.build);cast(f);assert.equal(f.c.flight.mode,skill===1?1:4);
 assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_Begin`);assert.equal(f.u.skill.gainSp(5,'fixture'),0);
 until(f.b,()=>f.c.flight.mode===(skill===1?2:5));until(f.b,()=>skillHeals(f).length>0);
 until(f.b,()=>!f.u.skill.active);assert.equal(f.c.flight.mode,skill===1?3:6);assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_End`);
 until(f.b,()=>f.c.flight.mode===0);near(f.u.s.atk,r.stats.atk);near(f.u.s.interval,r.stats.baseAttackTime??2.85);near(f.u.s.physTakenMul,1);
 assert.equal(!!f.u.s.flags.liftoff,false);assert.ok(f.u.skill.sp>0);
});
for(const skill of[1,2])check(`Public S${skill} support is a maxed source build with one normal deployment slot`,()=>{
 const f=make({skill,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,80,6,200,10]);
 assert.deepEqual(recordFor(f.build,data).stats,selectedTaraxaBuild(f.build).stats);assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(skillHud(f.u.skill).ready,false);
});
for(const skill of[1,2])check(`Public S${skill} recovers natural SP and waits for a real manual activation command`,()=>{
 const f=make({skill});f.target.hp=f.target.s.maxHp;until(f.b,()=>f.u.skill.ready);
 assert.equal(f.u.skill.activations,0);assert.equal(skillHud(f.u.skill).ready,true);assert.equal(skillHud(f.u.skill).canActivate,true);
 assert.equal(f.b.activateOperator(ID),true);assert.equal(skillHud(f.u.skill).ready,false);assert.equal(f.u.skill.sp,0);
});
check('Public S2 interoperates with actual Tippi liftoff and grants conditional aura/extra healing',()=>{
 const f=make({skill:2}),t=f.b.deployOperator(T,2,6,'RIGHT');assert.ok(t);t.skill.setSpTotal(t.skill.spCost);assert.equal(f.b.activateOperator(T),true);
 advance(f.b,1.1);assert.equal(t.s.flags.liftoff,true);t.hp=t.s.maxHp*.2;cast(f);
 until(f.b,()=>f.heals.some(h=>h.opts.tags.includes('taraxa:s2-secondary'))&&f.heals.some(h=>h.opts.tags.includes('taraxa:s2-primary')));
 assert.ok(f.heals.some(h=>h.opts.tags.includes('taraxa:s2-primary')&&h.target.id===t.id));
 assert.ok(f.heals.some(h=>h.opts.tags.includes('taraxa:s2-secondary')&&h.target.id===f.target.id));
 near(t.s.physTakenMul,.9);assert.ok(f.heals.some(h=>h.opts.tags.includes('taraxa:s2-splash'))||f.c.payload.flights.size>0);
});
for(const skill of[1,2])check(`Public S${skill} retreat drains owned mode/aura/flight callbacks and finite transport finishes`,()=>{
 const f=make({skill});cast(f);until(f.b,()=>skillHeals(f).length>0);f.b.retreatOperator(ID);advance(f.b,3);
 for(const c of[f.c,f.c.flight,f.c.aura])assert.equal(c.handles.length,0);
 assert.equal(f.c.flights.size,0);assert.equal(f.c.watchers.length,0);if(skill===2){assert.equal(f.c.payload.flights.size,0);assert.equal(f.c.payload.watchers.length,0);}
 assert.ok(!f.u.buffs.some(x=>x.key.startsWith('taraxa')));assert.equal(f.b.deployedSlots(),1);
});
check('A held Taraxacum cannot be deployed without the explicit candidate marker',()=>{
 if(!candidate)return;const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});
 b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/Missing Taraxacum runtime review/);
});
check('Tampered candidate stats or skill blackboards cannot fall through to a generic replacement',()=>{
 for(const kind of['stats','skill']){const d=structuredClone(data);
  if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;
  else d.operators[ID].skills[0].levels[9].blackboard[0].value=999;
  const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:'skchr_taraxa_1',skillRank:10}]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/original selected Taraxacum inputs/);
 }
});
for(const skill of[1,2])check(`Public S${skill} clears original 0-1 with natural DP, unchanged waves/terrain and actual healing`,()=>{
 const G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_taraxa_${skill}`},
  {...defaultBuild(data.operators[M]),elite:0,level:1,skillRank:1},defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let u,m,g,casts=0;for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,4,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,1,4,'UP');
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,1,'RIGHT');if(u?.skill.ready&&casts===0&&b.activateOperator(ID))casts++;b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,actualHealing:u?.stats.heal}));
 assert.ok(u&&m&&g&&u.stats.heal>0);assert.equal(casts,1);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);
 assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});

for(const skill of[1,2])check(`Public S${skill} owns its immediate native block-mode notification on takeoff and landing`,()=>{
 const f=make({skill});near(f.u.s.physTakenMul,1);cast(f);near(f.u.s.physTakenMul,.9);
 f.u.skill.end('fixture');until(f.b,()=>f.c.flight.mode===0);assert.equal(!!f.u.s.flags.liftoff,false);near(f.u.s.physTakenMul,1);
});
