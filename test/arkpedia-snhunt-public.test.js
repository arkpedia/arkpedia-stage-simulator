// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-snhunt-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedSnhuntBuild} from '../server/sim/content/arkpedia-snhunt-source.js';
import {ammunitionHud,skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/snhunt-fixture.js';
const ID='char_4211_snhunt';
const candidate=process.env.ARKPEDIA_REVIEW_SNHUNT==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-snhunt-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_snhunt_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,1,6,'UP');near(before-b.dp,cost);
 const hits=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});
 let enemy;if(target){enemy=b.spawnEnemy('enemy_1007_slime',{pos:[2,6]});Object.assign(enemy.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});enemy.markDirty();void enemy.s;enemy.hp=enemy.s.maxHp;b.addBuff(enemy,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();}
 return{b,u,build:b.bench[ID].build,controller:u.mem.snhunt,hits,enemy};
}
test('Snow Hunter public source, exact clocks, original artwork and interface bindings remain pinned',async()=>{
 const op=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(op.name,'Snow Hunter');assert.equal(op.sourceName,'雪猎');assert.equal(op.sourceAppellation,'Snow Hunter');assert.equal(op.sourceChannel,'cn');
 assert.deepEqual(op.skills.map(s=>s.assetIcon),['skill-icons/Snow Hunter - Power Strike β.webp','skill-icons/Snow Hunter - Twin Blizzard Bolts.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4211_snhunt','sourceFoundationSha256'],['snhunt-art','ownerArtworkSha256'],['snhunt-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[key,model]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
});
for(let rank=1;rank<=10;rank++)test(`public S1/rank ${rank} earns offensive SP and spends one round on one powered shot`,()=>{
 const f=make({rank,target:true}),{b,u}=f;until(b,()=>f.controller.phase?.s1&&!f.controller.phase.released,40);
 assert.equal(b.activateOperator(ID),false);assert.equal(skillHud(u.skill).canActivate,false);const ammo=f.controller.magazine.bullets,attacks=u.stats.attacks;
 until(b,()=>f.hits.some(h=>h.dmg.tags.includes('snhunt:s1')),2);const h=f.hits.find(h=>h.dmg.tags.includes('snhunt:s1'));
 near(h.amount,u.s.atk*1.2*f.controller.record.bb.atk_scale);assert.equal(u.stats.attacks-attacks,1);assert.equal(f.controller.magazine.bullets,ammo-1);
 assert.equal(u.skill.spTotal,0);assert.equal(f.enemy.s.flags.cold,true);assert.equal(f.hits.filter(h=>h.dmg.tags.includes('snhunt:beast')).length,1);
});
for(let rank=1;rank<=10;rank++)test(`public S2/rank ${rank} naturally charges and fires two independent shots without spending magazine rounds`,()=>{
 const f=make({skill:2,rank,target:true}),{b,u}=f;until(b,()=>u.skill.ready,40);const ammo=f.controller.magazine.bullets,attacks=u.stats.attacks;
 assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');
 until(b,()=>!u.skill.active,3);const hits=f.hits.filter(h=>h.dmg.tags.includes('snhunt:s2'));assert.equal(hits.length,2);
 assert.equal(hits[0].dmg.attackId,hits[1].dmg.attackId);assert.ok(hits[1].time>hits[0].time);for(const h of hits)near(h.amount,u.s.atk*1.2*f.controller.record.bb.atk_scale_2);
 assert.equal(u.stats.attacks,attacks);assert.equal(f.controller.magazine.bullets,ammo);assert.equal(f.enemy.s.flags.cold,true);
 assert.equal(ammunitionHud(u).current,ammo);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public E${elite}/P${potential} retains selected source build and support capacity`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedSnhuntBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);
 near(f.u.s.atk,r.stats.atk);assert.equal(f.controller.magazine.capacity,[4,6,8][f.build.elite]);
 if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public retreat/redeployment replaces controller and ammunition and restores source initial SP',()=>{
 const f=make({skill:2,potential:6}),old=f.controller;old.magazine.consume();f.b.retreatOperator(ID);assert.equal(old.stopped,true);assert.equal(old.magazine.removed,true);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,1,6,'DOWN');
 assert.notEqual(u.mem.snhunt,old);assert.equal(u.mem.snhunt.magazine.bullets,8);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public S${skill} clears original 0-1 with natural DP, unchanged terrain and Melantha`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:`skchr_snhunt_${skill}`};
 const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,1,2,'UP');owner=true;}
  const u=b.bench[ID].unit;if(skill===2&&u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 assert.ok(owner&&helper);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);
 assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit.skill.activations}));
});
