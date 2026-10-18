// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import normal from '../data/arkpedia-mvp.json' with{type:'json'};import review from '../data/arkpedia-aegis-runtime-review.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedAegisBuild} from '../server/sim/content/arkpedia-aegis-source.js';import {skillHud} from '../shared/arkpedia/skill-hud.js';import {interfaceAssetUrl} from '../shared/arkpedia/interface-assets.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4218_aigis',candidate=process.env.ARKPEDIA_REVIEW_AEGIS==='1',check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-aegis-candidate.json',import.meta.url))):normal,fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
function until(b,p,seconds=70){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition missing at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false,elite=2,level=[50,70,80][elite]}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level,skillId:`skchr_aigis_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);const hits=[],receipts=[];
 b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});b.on('attack',c=>{if(c.attacker===u)receipts.push({...c,time:b.time});});
 const f={b,u,c:u.mem.aegis,build:b.bench[ID].build,cost:before-b.dp,hits,receipts};fixtures.push(f);return f;
}
function enemy(f,{hp=1e7,col=6,motion='WALK'}={}){const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[2,col]});Object.assign(e.base,{maxHp:hp,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;e.motion=motion;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;}
const hits=(f,s)=>f.hits.filter(h=>h.dmg.tags.includes(`aegis:s${s}`));
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);};
check('Public Aegis binds original source/art/clocks, both skill IDs and four source-ID interface files',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Aegis');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Aegis - Orgia Mode.webp','skill-icons/Aegis - Maximum Firepower.webp']);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['aegis-art','ownerArtworkSha256'],['aegis-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.equal(review.interfaceAssets.length,4);assert.deepEqual(review.interfaceProvenance.map(p=>typeof p.binding==='string'?p.binding:p.binding.sourcePath),['avatar/'+ID+'.png','skill/skill_icon_skchr_aigis_1.png','skill/skill_icon_skchr_aigis_2.png','skin/'+ID+'_1b.png']);
 for(const a of review.interfaceAssets){assert.deepEqual(data.interfaceAssets[a.repository][a.path],{commit:a.commit,bytes:a.bytes,sha256:a.sha256});assert.ok(interfaceAssetUrl(data,a.repository,a.path).includes('/'+a.commit+'/'));}
 const front=data.sd.models[`operator/${ID}/default/front`],back=data.sd.models[`operator/${ID}/default/back`];
 for(const clip of['Skill_1_Begin','Skill_1_Loop','Skill_1_Idle','Skill_2_Begin','Skill_2_Loop','Skill_2_End'])assert.ok(Object.hasOwn(front.animations,clip)&&Object.hasOwn(back.animations,clip));
 assert.equal(front.animations.Skill_2_Loop,0);assert.equal(front.animationRoles.stun,'nSkill_1_Stun');assert.equal(back.animations.nSkill_1_Stun,undefined);assert.equal(front.premultipliedAlpha,true);
});
for(const skill of[1,2])for(const potential of[1,6])for(const trust of[0,200])check(`Public S${skill} P${potential}/trust${trust} preserves source stats, cost, actual coefficient and talent`,()=>{
 const f=make({skill,potential,trust}),r=selectedAegisBuild(f.build);enemy(f);enemy(f,{col:6.3});assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);assert.equal(f.b.deploymentSlotCost(ID),1);
 cast(f);until(f.b,()=>hits(f,skill).length===2);const amount=r.stats.atk*(skill===1?1+r.bb.atk:r.bb.atk_scale)*f.u.s.physDealtMul;
 for(const h of hits(f,skill))near(h.amount,amount);assert.equal(f.receipts.length,1);assert.equal(f.u.skill.gainSp(100,'fixture'),0);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`Public S${skill} rank${rank} keeps its exact manual account and selected payload`,()=>{
 const f=make({skill,rank}),r=selectedAegisBuild(f.build);enemy(f);cast(f);until(f.b,()=>hits(f,skill).length===1);
 near(hits(f,skill)[0].amount,r.stats.atk*(skill===1?1+r.bb.atk:r.bb.atk_scale)*f.u.s.physDealtMul);assert.equal(f.b.activateOperator(ID),false);
 until(f.b,()=>!f.u.skill.active);if(skill===1){assert.equal(f.c.flight.mode,3);until(f.b,()=>f.c.flight.mode===0);}
 else{until(f.b,()=>hits(f,2).length===7);assert.equal(f.receipts.length,2);assert.equal(f.c.flight.skillPhase,null);assert.equal(f.c.phase,null);}
});
for(const skill of[1,2])check(`Public S${skill} support uses a source-maxed build and one slot`,()=>{
 const f=make({skill,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,80,6,200,10]);assert.deepEqual(recordFor(f.build,data).stats,selectedAegisBuild(f.build).stats);assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(skillHud(f.u.skill).ready,false);
});
for(const[elite,skill,rank]of[[0,1,4],[1,1,7],[1,2,7]])check(`Public E${elite} S${skill} retains talent and promotion gates`,()=>{
 const f=make({elite,skill,rank}),r=selectedAegisBuild(f.build);enemy(f);cast(f);until(f.b,()=>hits(f,skill).length===1);assert.equal(!!f.c.talent.parent,elite>0);near(f.u.s.maxHp,r.stats.maxHp);assert.equal(f.cost,r.stats.cost);
});
for(const skill of[1,2])check(`Public S${skill} naturally fills SP, waits for actual manual input and exposes skill HUD`,()=>{
 const f=make({skill});until(f.b,()=>f.u.skill.ready);assert.equal(f.u.skill.activations,0);assert.equal(skillHud(f.u.skill).ready,true);assert.equal(skillHud(f.u.skill).canActivate,skill===1);
 if(skill===2){assert.equal(f.b.activateOperator(ID),false);assert.equal(f.u.skill.charges,1);}enemy(f);assert.equal(f.b.activateOperator(ID),true);assert.equal(skillHud(f.u.skill).ready,false);if(skill===2)assert.equal(skillHud(f.u.skill).text,'Skill active');
 until(f.b,()=>!f.u.skill.active);if(skill===1){assert.equal(f.u.canAct,false);assert.equal(skillHud(f.u.skill).canActivate,false);advance(f.b,1);assert.ok(f.u.skill.sp>.9);}
 else assert.equal(f.receipts.length,2);
});
for(const skill of[1,2])check(`Public S${skill} retreat drains components and finite payloads`,()=>{
 const f=make({skill});enemy(f);cast(f);until(f.b,()=>f.c.payload.flights.size>0);f.b.retreatOperator(ID);advance(f.b,3);
 for(const list of[f.c.handles,f.c.accountHandles,f.c.talent.handles,f.c.flight.handles,f.c.payload.watchers])assert.equal(list.length,0);
 assert.equal(f.c.payload.flights.size,0);assert.equal(f.c.stopped,true);assert.equal(f.b.deployedSlots(),0);
});
check('A held Aegis cannot deploy without its explicit candidate marker',()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/Missing Aegis runtime review/);
});
check('Altered public stats, selected skill blackboard and invented skill IDs fail closed',()=>{
 for(const kind of['stats','skill','id']){const d=structuredClone(data);if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;
  else if(kind==='skill')d.operators[ID].skills[0].levels[9].blackboard[0].value=999;else d.operators[ID].skills[0].id='invented';
  if(kind==='id'){assert.throws(()=>new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]}),/Unsupported regular-stage operator or skill/);continue;}
  const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:'skchr_aigis_1',skillRank:10}]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/original selected Aegis inputs/);
 }
});
for(const skill of[1,2])check(`Public S${skill} fresh redeployment installs a new controller after source cooldown`,()=>{
 const f=make({skill}),old=f.u;f.b.retreatOperator(ID);near(f.b.bench[ID].readyAt-f.b.time,old.base.respawnTime*old.s.redeployMul);advance(f.b,f.b.bench[ID].readyAt-f.b.time+f.b.dt);f.b.getPlayer('arkpedia').dp=99;
 const next=f.b.deployOperator(ID,2,4,'RIGHT');assert.ok(next);assert.notEqual(next,old);assert.notEqual(next.mem.aegis,f.c);assert.equal(f.c.stopped,true);assert.equal(next.skill.activations,0);
});
for(const skill of[1,2])check(`Public S${skill} clears original 0-1 with natural DP, original terrain/waves and actual Aegis damage`,()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_aigis_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0;
 for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,1,4,'UP');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,activations:u?.skill.activations,actualDamage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0&&casts>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
check('Pending normal build and conflicting candidates reject without replacing the normal snapshot',async()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;const path=new URL('../data/arkpedia-mvp.json',import.meta.url),before=await readFile(path);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--sd-commit','093459289e71538b1169a10c42c3198d33021ec9'],{stdio:'pipe'}),/Aegis lacks/);assert.deepEqual(await readFile(path),before);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--review-candidate-aegis','--review-candidate-skybox'],{stdio:'pipe'}),/Review one candidate/);
});
