// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-ju-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedJuBuild} from '../server/sim/content/arkpedia-ju-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4221_ju',candidate=process.env.ARKPEDIA_REVIEW_JU==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-ju-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=60){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_ju_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});
 return{b,u,c:u.mem.ju,build:b.bench[ID].build,cost:before-b.dp,hits};
}
function enemy(f,{hp=1e7,ratio=.49,col=6}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[2,col]});
 Object.assign(e.base,{maxHp:hp,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp*ratio;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);if(f.build.skillId.endsWith('_2'))assert.equal(f.b.activateOperator(ID),true);else until(f.b,()=>f.u.skill.active);}
check('Public Ju binds the original source/art/clocks and four pinned interface files',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Ju');
 assert.equal(data.operators[ID].skills.length,2);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['ju-art','ownerArtworkSha256'],['ju-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
});
for(const skill of[1,2])for(const potential of[1,6])for(const trust of[0,200])check(`Public Ju S${skill} P${potential}/trust ${trust} retains source stats and real skill damage`,()=>{
 const f=make({skill,potential,trust}),r=selectedJuBuild(f.build);enemy(f);if(skill===2)enemy(f,{col:6.3});
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);
 assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(f.u.skill.spCost,r.source.spData.spCost);cast(f);
 if(skill===1){until(f.b,()=>f.hits.some(h=>h.dmg.tags.includes('ju:s1')));near(f.hits.find(h=>h.dmg.tags.includes('ju:s1')).amount,r.stats.atk*r.bb.atk_scale_s1);assert.equal(f.u.skill.maxCharges,2);}
 else{until(f.b,()=>f.hits.filter(h=>h.dmg.tags.includes('ju:s2:attack')).length===2);near(f.u.s.atk,r.stats.atk*(1+r.bb.atk));until(f.b,()=>f.hits.filter(h=>h.dmg.tags.includes('ju_s2_extra')).length===2);}
 assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])for(const rank of[1,4,7,10])check(`Public S${skill} rank ${rank} preserves its original account and control mode`,()=>{
 const f=make({skill,rank}),r=selectedJuBuild(f.build);enemy(f);cast(f);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.gainSp(5,'fixture'),0);
 if(skill===1){assert.equal(f.b.activateOperator(ID),false);assert.equal(skillHud(f.u.skill).ready,false);until(f.b,()=>!f.u.skill.active);assert.equal(f.u.skill.charges,0);}
 else{assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(f.b,.6);assert.equal(f.c.mode,true);advance(f.b,r.source.duration);assert.equal(f.u.skill.active,false);assert.equal(f.c.mode,false);near(f.u.s.atk,r.stats.atk);}
});
check('Public Ju support keeps a maxed source build and one ordinary deployment slot',()=>{
 const f=make({skill:2,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,80,6,200,10]);
 assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(skillHud(f.u.skill).ready,false);
});
check('Public S1 naturally stores both charges without an eligible input and never accepts a manual command',()=>{
 const f=make();enemy(f,{ratio:.9});until(f.b,()=>f.u.skill.charges===2);
 assert.equal(f.u.skill.activations,0);assert.equal(f.b.activateOperator(ID),false);assert.equal(skillHud(f.u.skill).ready,false);
 assert.ok(f.hits.some(h=>h.dmg.tags.includes('ju:ordinary')));
});
check('Public retreat drains source components while an accepted wound remains finite and target-owned',()=>{
 const f=make({skill:2}),e=enemy(f,{hp:100,ratio:1});cast(f);until(f.b,()=>!!e.findBuff('cripple'));
 f.b.retreatOperator(ID);assert.equal(f.c.handles.length,0);assert.equal(f.c.extra.handles.length,0);assert.equal(f.c.wounds.handles.length,0);
 assert.equal(e.alive,true);until(f.b,()=>!e.alive,12);assert.equal(f.c.wounds.watchers.length,0);assert.equal(f.c.extra.watchers.length,0);assert.equal(f.c.watchers.length,0);
});
for(const skill of[1,2])check(`Public S${skill} clears original 0-1 with natural DP, unchanged waves and terrain`,()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_ju_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});
 b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0,wounds=0;
 b.on('damaged',h=>{if(h.source===u&&h.target.findBuff('cripple'))wounds++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,1,4,'UP');
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');
  if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,wounds,actualDamage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0);if(skill===2)assert.ok(casts>0);
 assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);
 assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
