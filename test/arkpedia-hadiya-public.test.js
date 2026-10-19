// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-hadiya-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {interfaceAssetUrl} from '../shared/arkpedia/interface-assets.js';
import {selectedHadiyaBuild} from '../server/sim/content/arkpedia-hadiya-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_394_hadiya',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_HADIYA==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-hadiya-candidate.json',import.meta.url))):normal;
const fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0)){assert.deepEqual(f.b.errors,[]);f.u.mem.hadiyaOwner?.stop();}});
function until(b,p,seconds=60){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,elite=2,support=false,dp=99}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_hadiya_${skill}`,skillRank:rank,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators[G])],support:build}:{operators:[build,defaultBuild(d.operators[G])]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=dp;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 const hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});
 const f={b,u,c:u.mem.hadiyaOwner,build:b.bench[ID].build,cost:before-b.dp,hits};fixtures.push(f);return f;
}
function enemy(f,{hp=1e8,col=4,row=3}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
 Object.assign(e.base,{maxHp:hp,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
const born=f=>until(f.b,()=>f.c.phase?.kind!=='born',3);
const fill=f=>f.u.skill.setSpTotal(f.u.skill.spCost);
check('Admission binds the reviewed original art, interface pixels and source receipts without changing prior records',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Hadiya');assert.equal(data.operatorSourceChannels[ID],'cn');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Hadiya - Enhanced Desert Tactics.webp','skill-icons/Hadiya - Blade of the Qarnsayf.webp']);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['hadiya-art','ownerArtworkSha256'],['hadiya-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 for(const a of review.interfaceAssets){assert.equal(data.sources[a.repository],a.commit);assert.ok(interfaceAssetUrl(data,a.repository,a.path).includes('/'+a.commit+'/'));}
 assert.deepEqual(data.stage.geometry,normal.stage.geometry);assert.deepEqual(data.enemies,normal.enemies);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`Public S${skill} rank ${rank} keeps source stats/cost and the real SP account`,()=>{
 const f=make({skill,rank}),r=selectedHadiyaBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);// One original talent stack is granted at deployment (E2: +4% at P1).
 near(f.u.s.atk,r.stats.atk*1.04);near(f.cost,r.stats.cost);
 assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.mem.regularSecondaryAction?.label,'Equipment Adaptation');
});
check('Public S1 manual cast is free; adaptation starts it for 10 DP with the extra ATK and is spent once',()=>{
 const f=make({skill:1});born(f);enemy(f);const r=selectedHadiyaBuild(f.build);
 assert.equal(f.b.secondaryActionOperator(ID),false);fill(f);assert.equal(f.u.mem.regularSecondaryAction.available(),true);
 const dp=f.b.dp;assert.equal(f.b.secondaryActionOperator(ID),true);assert.equal(f.b.dp,dp-10);assert.equal(f.u.skill.activations,1);
 until(f.b,()=>!!f.c.state?.extra,3);assert.equal(f.u.mem.regularSecondaryAction.available(),false);assert.equal(f.b.secondaryActionOperator(ID),false);assert.equal(f.b.dp,dp-10);
 near(r.skill?.bb?.['extra.atk']??1,1);
});
check('Public S1 ordinary activation spends no DP; adaptation during the skill costs 10 DP once',()=>{
 const f=make({skill:1});born(f);enemy(f);fill(f);const dp=f.b.dp;assert.equal(f.b.activateOperator(ID),true);assert.equal(f.b.dp,dp);
 until(f.b,()=>!!f.c.state,3);assert.equal(f.u.mem.regularSecondaryAction.available(),true);assert.equal(f.b.secondaryActionOperator(ID),true);assert.equal(f.b.dp,dp-10);
 assert.equal(f.u.mem.regularSecondaryAction.available(),false);assert.equal(f.b.secondaryActionOperator(ID),false);assert.equal(f.u.skill.activations,1);
});
check('Public S2 costs 10 DP; adaptation extends it once for 15 DP',()=>{
 const f=make({skill:2});born(f);enemy(f);fill(f);const dp=f.b.dp;assert.equal(f.u.mem.regularSecondaryAction.available(),false);
 assert.equal(f.b.activateOperator(ID),true);assert.equal(f.b.dp,dp-10);until(f.b,()=>f.c.state?.deadline!=null,4);
 const before=f.c.state.deadline;assert.equal(f.b.secondaryActionOperator(ID),true);assert.equal(f.b.dp,dp-25);
 until(f.b,()=>f.c.state?.deadline>before,1);near(f.c.state.deadline-before,15);assert.equal(f.b.secondaryActionOperator(ID),false);
});
check('Public S2 cannot start or adapt without enough DP, and refuses adaptation under stun',()=>{
 const f=make({skill:2});born(f);fill(f);f.b.getPlayer('arkpedia').dp=5;assert.equal(f.b.activateOperator(ID),false);assert.equal(f.b.dp,5);
 f.b.getPlayer('arkpedia').dp=20;assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.c.state?.deadline!=null,4);
 assert.equal(f.b.dp,10);assert.equal(f.u.mem.regularSecondaryAction.available(),false);assert.equal(f.b.secondaryActionOperator(ID),false);
 f.b.getPlayer('arkpedia').dp=99;f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true},duration:2});assert.equal(f.b.secondaryActionOperator(ID),false);assert.equal(f.b.dp,99);
});
for(const skill of[1,2])check(`Public S${skill} deals ordinary and skill Physical damage to an actual target`,()=>{
 const f=make({skill});born(f);enemy(f);until(f.b,()=>f.hits.length>0,6);assert.ok(f.hits.every(h=>h.amount>0&&h.dmg.type==='phys'));
 fill(f);assert.equal(f.b.activateOperator(ID),true);const n=f.hits.length;until(f.b,()=>f.hits.length>n,8);assert.equal(skillHud(f.u.skill).canActivate,false);
});
for(const skill of[1,2])check(`Public S${skill} retreat stops the owner and removes the field action; redeployment is fresh`,()=>{
 const f=make({skill});born(f);const old=f.u,owner=f.c;f.b.retreatOperator(ID);advance(f.b,1);assert.equal(owner.stopped,true);assert.equal(old.mem.regularSecondaryAction,undefined);
 advance(f.b,f.b.bench[ID].readyAt-f.b.time+f.b.dt);f.b.getPlayer('arkpedia').dp=99;const next=f.b.deployOperator(ID,3,3,'RIGHT');assert.ok(next);assert.notEqual(next.mem.hadiyaOwner,owner);
 assert.ok(next.mem.regularSecondaryAction);next.mem.hadiyaOwner.stop();
});
check('Maxed support keeps the original build and rejects altered source inputs',()=>{
 const f=make({skill:2,support:true});assert.deepEqual([f.build.elite,f.build.potential,f.build.trust,f.build.skillRank],[2,6,200,10]);
 for(const kind of['stats','skill']){const d=structuredClone(data);if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;else d.operators[ID].skills[0].levels[9].blackboard[0].value=999;
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,3,3,'RIGHT'));}
});
for(const skill of[1,2])check(`Public S${skill} clears unchanged original 0-1 with natural DP and actual Hadiya damage`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_hadiya_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 const tiles=structuredClone(b.grid.tiles);let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,time:b.time,activations:u?.skill.activations,actualDamage:u?.stats.dmg}));assert.ok(u&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);u.mem.hadiyaOwner?.stop();
});
check('A missing candidate marker or pending normal build fails without replacing the published snapshot',async()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;
 const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,3,3,'RIGHT'),/Missing Hadiya runtime review/);
 const path=new URL('../data/arkpedia-mvp.json',import.meta.url),before=await readFile(path);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--sd-commit',data.sd.commit],{stdio:'pipe'}),/Hadiya lacks/);assert.deepEqual(await readFile(path),before);
});
