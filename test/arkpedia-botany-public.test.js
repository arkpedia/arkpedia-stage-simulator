// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-botany-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedBotanyBuild} from '../server/sim/content/arkpedia-botany-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4223_botany',candidate=process.env.ARKPEDIA_REVIEW_BOTANY==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-botany-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=60){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_botany_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const hits=[],receipts=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});
 b.on('attack',c=>{if(c.attacker===u)receipts.push({...c,time:b.time});});
 return{b,u,c:u.mem.botany,build:b.bench[ID].build,cost:before-b.dp,hits,receipts};
}
function enemy(f,{hp=1e7,col=6}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[2,col]});
 Object.assign(e.base,{maxHp:hp,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);if(f.build.skillId.endsWith('_2'))assert.equal(f.b.activateOperator(ID),true);else until(f.b,()=>f.u.skill.active);}
const hits=(f,tag)=>f.hits.filter(h=>h.dmg.tags.includes(tag));
check('Public Botani binds the original source/art/clocks, catalogue name and exact skill IDs to four interface files',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Botani');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Botani - Disharmonization.webp','skill-icons/Botani - Echoes Through Quietude.webp']);
 assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['botany-art','ownerArtworkSha256'],['botany-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.ok(data.sd.models[`operator/${ID}/default/front`].animations.Die);assert.equal(data.sd.models[`operator/${ID}/default/back`].animations.Die,undefined);
 assert.deepEqual(review.interfaceProvenance.map(p=>typeof p.binding==='string'?p.binding:p.binding.sourcePath),
  ['avatar/'+ID+'.png','skill/skill_icon_skchr_botany_1.png','skill/skill_icon_skchr_botany_2.png','skin/'+ID+'_1b.png']);
});
for(const skill of[1,2])for(const potential of[1,6])for(const trust of[0,200])check(`Public Botani S${skill} P${potential}/trust ${trust} retains source stats, cost and real skill payloads`,()=>{
 const f=make({skill,potential,trust}),r=selectedBotanyBuild(f.build);enemy(f);if(skill===2)enemy(f,{col:6.3});
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);
 assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(f.u.skill.spCost,r.source.spData.spCost);cast(f);
 until(f.b,()=>hits(f,`botany:s${skill}-injury`).length===(skill===1?1:2));
 if(skill===1){near(hits(f,'botany:s1')[0].amount,r.stats.atk*r.bb.atk_scale);near(hits(f,'botany:s1-extra')[0].amount,r.stats.atk*r.bb['botany_s1_extra.atk_scale']);assert.equal(f.u.skill.maxCharges,1);}
 else{assert.equal(hits(f,'botany:s2').length,2);near(hits(f,'botany:s2-extra')[0].amount,r.stats.atk*r.bb['attack@extra_atk_scale']);near(f.u.s.atk,r.stats.atk);}
 assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])for(const rank of[1,4,7,10])check(`Public Botani S${skill} rank ${rank} preserves its source account and control mode`,()=>{
 const f=make({skill,rank}),r=selectedBotanyBuild(f.build);enemy(f);cast(f);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.gainSp(5,'fixture'),0);
 if(skill===1){assert.equal(f.b.activateOperator(ID),false);assert.equal(skillHud(f.u.skill).ready,false);until(f.b,()=>!f.u.skill.active);assert.equal(f.u.skill.charges,0);}
 else{assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(f.b,.4);assert.equal(f.c.mode,true);advance(f.b,r.source.duration);assert.equal(f.u.skill.active,false);assert.equal(f.c.mode,false);near(f.u.s.atk,r.stats.atk);}
});
for(const skill of[1,2])check(`Public Botani S${skill} support keeps a maxed source build and one deployment slot`,()=>{
 const f=make({skill,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,80,6,200,10]);
 assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(skillHud(f.u.skill).ready,false);assert.deepEqual(recordFor(f.build,data).stats,selectedBotanyBuild(f.build).stats);
});
check('Public S1 naturally stores one charge without a target and automatically attacks a healthy enemy',()=>{
 const f=make();until(f.b,()=>f.u.skill.charges===1);assert.equal(f.u.skill.activations,0);assert.equal(f.b.activateOperator(ID),false);
 const e=enemy(f);until(f.b,()=>hits(f,'botany:s1-extra').length>0);assert.ok(e.hp<e.s.maxHp);assert.equal(f.u.skill.activations,1);
});
check('Public S2 waits for a real manual command after natural SP readiness, then causes two erosion bursts and talent gifts',()=>{
 const f=make({skill:2});until(f.b,()=>f.u.skill.ready);assert.equal(f.u.skill.activations,0);assert.equal(skillHud(f.u.skill).ready,true);
 const a=enemy(f),b=enemy(f,{col:6.3});assert.equal(f.b.activateOperator(ID),true);assert.equal(skillHud(f.u.skill).ready,false);
 until(f.b,()=>!!a.findBuff('erosionBurst')&&!!b.findBuff('erosionBurst'));assert.equal(f.c.talent.gift.stacks,2);assert.equal(f.c.recovery.records.size,2);
});
for(const skill of[1,2])check(`Public S${skill} retreat drains owned source components and finite transport`,()=>{
 const f=make({skill});enemy(f);cast(f);until(f.b,()=>f.c.flights.size>0);f.b.retreatOperator(ID);advance(f.b,3);
 assert.equal(f.c.handles.length,0);assert.equal(f.c.talent.handles.length,0);assert.equal(f.c.watchers.length,0);assert.equal(f.c.flights.size,0);
 if(skill===2){assert.equal(f.c.recovery.handles.length,0);assert.equal(f.c.recovery.records.size,0);}assert.equal(f.b.deployedSlots(),0);
});
check('A held Botani cannot deploy without its explicit candidate marker',()=>{
 if(!candidate)return;const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});
 b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/Missing Botany runtime review/);
});
check('Tampered public stats or skill inputs cannot fall through to a generic replacement',()=>{
 for(const kind of['stats','skill']){const d=structuredClone(data);
  if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;
  else d.operators[ID].skills[0].levels[9].blackboard[0].value=999;
  const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:'skchr_botany_1',skillRank:10}]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/original selected Botany inputs/);
 }
});
for(const skill of[1,2])check(`Public S${skill} clears original 0-1 with natural DP, unchanged waves/terrain and actual Botani damage`,()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_botany_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});
 b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,1,4,'UP');
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');
  if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,automaticActivations:u?.skill.activations,actualDamage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0);assert.ok(u.skill.activations>0);if(skill===2)assert.ok(casts>0);
 assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);
 assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
