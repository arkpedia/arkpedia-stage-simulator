// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-skybox-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedSkyboxBuild} from '../server/sim/content/arkpedia-skybox-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4213_skybx',candidate=process.env.ARKPEDIA_REVIEW_SKYBOX==='1',check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-skybox-candidate.json',import.meta.url))):normal;
const fixtures=[];test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
function until(b,p,seconds=70){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false,elite=2,level=[50,70,80][elite]}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level,skillId:`skchr_skybx_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const hits=[],receipts=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});b.on('attack',c=>{if(c.attacker===u)receipts.push({...c,time:b.time});});
 const f={b,u,c:u.mem.skybox,build:b.bench[ID].build,cost:before-b.dp,hits,receipts};fixtures.push(f);return f;
}
function enemy(f,{hp=1e7,col=6,motion='WALK'}={}){const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[2,col]});
 Object.assign(e.base,{maxHp:hp,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;e.motion=motion;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;}
const hits=(f,skill)=>f.hits.filter(h=>h.dmg.tags.includes(`skybox:s${skill}`));
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);if(f.build.skillId.endsWith('_2'))assert.equal(f.b.activateOperator(ID),true);else until(f.b,()=>f.u.skill.active);}
check('Public Skybox binds source/art/clocks, exact skill IDs and four source-ID interface files',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Skybox');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Skybox - Gunpowder Soiree.webp','skill-icons/Skybox - EMP Benefaction.webp']);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['skybox-art','ownerArtworkSha256'],['skybox-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.equal(review.interfaceAssets.length,4);assert.deepEqual(review.interfaceProvenance.map(p=>typeof p.binding==='string'?p.binding:p.binding.sourcePath),
 ['avatar/'+ID+'.png','skill/skill_icon_skchr_skybx_1.png','skill/skill_icon_skchr_skybx_2.png','skin/'+ID+'_1b.png']);
 const front=data.sd.models[`operator/${ID}/default/front`],back=data.sd.models[`operator/${ID}/default/back`];
 for(const clip of['Skill_1_Begin','Skill_1_End','Skill_2_Begin','Skill_2_Idle','Skill_2_Loop','Skill_2_Close','Skill_2_End'])assert.ok(front.animations[clip]&&back.animations[clip]);
 assert.ok(front.animations.Die_2);assert.equal(back.animations.Die_2,undefined);assert.equal(front.premultipliedAlpha,true);
});
for(const skill of[1,2])for(const potential of[1,6])for(const trust of[0,200])check(`Public S${skill} P${potential}/trust${trust} preserves source stats, cost, input and area coefficient`,()=>{
 const f=make({skill,potential,trust}),r=selectedSkyboxBuild(f.build);enemy(f);enemy(f,{col:6.3});
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);assert.equal(f.b.deploymentSlotCost(ID),1);
 cast(f);until(f.b,()=>hits(f,skill).length===2);const amount=r.stats.atk*r.bb[skill===1?'atk_scale':'attack@atk_scale'];
 for(const h of hits(f,skill))near(h.amount,amount);assert.equal(f.receipts.length,1);
 assert.equal(f.u.skill.gainSp(100,'fixture'),0);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`Public S${skill} rank${rank} keeps its source account and actual selected payload`,()=>{
 const f=make({skill,rank}),r=selectedSkyboxBuild(f.build);enemy(f);cast(f);until(f.b,()=>hits(f,skill).length===1);
 near(hits(f,skill)[0].amount,r.stats.atk*r.bb[skill===1?'atk_scale':'attack@atk_scale']);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
 if(skill===1){assert.equal(f.u.skill.maxCharges,rank<7?1:2);assert.equal(f.b.activateOperator(ID),false);until(f.b,()=>!f.u.skill.active);}
 else{assert.equal(f.u.skill.ammoLeft,9);assert.equal(f.c.flight.modeParent.times,9);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>!f.u.skill.active);}
});
for(const skill of[1,2])check(`Public S${skill} support uses a source-maxed build and one deployment slot`,()=>{
 const f=make({skill,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,80,6,200,10]);
 assert.deepEqual(recordFor(f.build,data).stats,selectedSkyboxBuild(f.build).stats);assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(skillHud(f.u.skill).ready,false);
});
for(const [elite,skill,rank]of[[0,1,4],[1,1,7],[1,2,7]])check(`Public E${elite} S${skill} retains source talent gates and promotion stats`,()=>{
 const f=make({elite,skill,rank}),e=enemy(f),r=selectedSkyboxBuild(f.build);cast(f);until(f.b,()=>hits(f,skill).length===1);
 assert.equal(!!e.s.flags.silence,elite>0);near(f.u.s.maxHp,r.stats.maxHp);near(f.u.s.atk,r.stats.atk);assert.equal(f.cost,r.stats.cost);
});
check('Public S1 naturally stores two charges without ground ordinary fire, then automatically lands and releases one bomb',()=>{
 const f=make();until(f.b,()=>f.u.skill.charges===2);assert.equal(f.u.skill.activations,0);assert.equal(f.b.activateOperator(ID),false);
 const e=enemy(f);until(f.b,()=>hits(f,1).length===1);assert.ok(e.hp<e.s.maxHp);assert.equal(f.u.skill.activations,1);assert.equal(f.u.skill.charges,1);
});
check('Public S2 naturally waits for manual input, shares ammo/overload HUD and closes through the real operator button',()=>{
 const g=make({skill:2});until(g.b,()=>g.u.skill.ready);assert.equal(g.u.skill.activations,0);assert.equal(skillHud(g.u.skill).ready,true);
 enemy(g);assert.equal(g.b.activateOperator(ID),true);until(g.b,()=>g.u.skill.ammoLeft===5);assert.equal(skillHud(g.u.skill).state,'overloaded');
 assert.equal(g.b.activateOperator(ID),true);assert.equal(skillHud(g.u.skill).canCancel,false);assert.equal(g.c.phase.count,5);assert.equal(g.b.activateOperator(ID),false);
 until(g.b,()=>!g.u.skill.active);until(g.b,()=>hits(g,2).length===10);assert.equal(g.receipts.length,10);assert.equal(g.c.flight.mode,0);
});
for(const skill of[1,2])check(`Public S${skill} retreat drains source components and finite shells`,()=>{
 const f=make({skill});enemy(f);cast(f);until(f.b,()=>f.c.payload.flights.size===1);f.b.retreatOperator(ID);advance(f.b,3);
 assert.equal(f.c.handles.length,0);assert.equal(f.c.accountHandles.length,0);assert.equal(f.c.talent.handles.length,0);assert.equal(f.c.flight.handles.length,0);
 assert.equal(f.c.payload.flights.size,0);assert.equal(f.c.payload.watchers.length,0);assert.equal(f.c.watchers.length,0);assert.equal(f.b.deployedSlots(),0);
});
check('A held Skybox cannot deploy without the explicit candidate marker',()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});
 b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/Missing Skybox runtime review/);
});
check('Altered public stats, selected skill blackboards or invented skill IDs fail closed',()=>{
 for(const kind of['stats','skill','id']){const d=structuredClone(data);if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;
  else if(kind==='skill')d.operators[ID].skills[0].levels[9].blackboard[0].value=999;else d.operators[ID].skills[0].id='invented';
  if(kind==='id'){assert.throws(()=>new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]}),/Unsupported regular-stage operator or skill/);continue;}
  const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:'skchr_skybx_1',skillRank:10}]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/original selected Skybox inputs/);
 }
});
for(const skill of[1,2])check(`Public S${skill} fresh redeployment installs a distinct controller life after cooldown`,()=>{
 const f=make({skill}),old=f.u;f.b.retreatOperator(ID);near(f.b.bench[ID].readyAt-f.b.time,old.base.respawnTime*old.s.redeployMul);advance(f.b,f.b.bench[ID].readyAt-f.b.time+f.b.dt);f.b.getPlayer('arkpedia').dp=99;
 const next=f.b.deployOperator(ID,2,4,'RIGHT');assert.ok(next);assert.notEqual(next,old);assert.notEqual(next.mem.skybox,f.c);assert.equal(f.c.stopped,true);assert.equal(next.skill.activations,0);
});
for(const skill of[1,2])check(`Public S${skill} clears original 0-1 with natural DP, original terrain/waves and actual Skybox damage`,()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_skybx_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});
 b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,1,4,'UP');
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');
  if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,activations:u?.skill.activations,actualDamage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0&&u.skill.activations>0);if(skill===2)assert.ok(casts>0);
 assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
check('Pending normal build and conflicting candidates reject before replacing the existing normal snapshot',async()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;const path=new URL('../data/arkpedia-mvp.json',import.meta.url),before=await readFile(path);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--sd-commit','3c669260a0de9eb1c13f11f905f6a4c4d522daac'],{stdio:'pipe'}),/Skybox lacks/);
 assert.deepEqual(await readFile(path),before);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--review-candidate-skybox','--review-candidate-botany'],{stdio:'pipe'}),/Review one candidate/);
});
