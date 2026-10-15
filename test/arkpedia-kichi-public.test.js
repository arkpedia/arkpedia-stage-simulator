// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-kichi-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedKichiBuild} from '../server/sim/content/arkpedia-kichi-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/kichi-fixture.js';
const ID='char_4203_kichi',candidate=process.env.ARKPEDIA_REVIEW_KICHI==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-kichi-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_kichi_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,1,6,'UP');near(before-b.dp,cost);
 const hits=[],attacks=[],states=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u&&c.isSkill)attacks.push({...c,time:b.time});});
 b.on('calculatedDamage',c=>{if(c.source===u&&c.dmg.isSkill)states.push({slow:!!c.target.findBuff('sluggish'),bind:!!c.target.findBuff('bind'),stun:!!c.target.findBuff('stun')});});
 const enemies=[];if(target)for(const dc of[0,-.35]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[2,6+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});enemies.push(e);}b._buildEnemyIndex();
 return {b,u,build:b.bench[ID].build,controller:u.mem.kichi,hits,attacks,states,enemies};
}
test('Kichisei public source, exact clocks, original models and four interface inputs stay pinned',async()=>{
 const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Kichisei');assert.equal(o.sourceName,'吉星');assert.equal(o.sourceAppellation,'Kichisei');assert.equal(o.sourceChannel,'cn');
 assert.deepEqual(o.skills.map(s=>s.assetIcon),['skill-icons/Kichisei - Irasshaimase!.webp','skill-icons/Kichisei - Lucky Star, Shining Bright!.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4203_kichi','sourceFoundationSha256'],['kichi-art','ownerArtworkSha256'],['kichi-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 const art=JSON.parse(await readFile(new URL('../data/arkpedia-kichi-art.json',import.meta.url)));
 assert.equal(art.recipeSha256,createHash('sha256').update(await readFile(new URL('../data/arkpedia-kichi-art-recipe.json',import.meta.url))).digest('hex'));
});
for(let rank=1;rank<=10;rank++)test(`public S1 rank ${rank} naturally charges and stacks once for each multi-target wave`,()=>{
 const f=make({rank,target:true}),{b,u}=f,atk=u.s.atk;until(b,()=>u.skill.ready,40);assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');near(u.s.interval,2.8);
 for(let n=1;n<=4;n++){
  until(b,()=>f.attacks.length===n,5);assert.equal(f.controller.resources.skillStacks,n);const hits=f.hits.filter(h=>h.dmg.isSkill);assert.equal(hits.length,n*2);
  for(const h of hits.slice(-2))near(h.amount,atk*(1+(n-1)*f.controller.record.bb.atk)*1.5);
 }
 const ids=f.hits.filter(h=>h.dmg.isSkill).map(h=>h.dmg.attackId);assert.equal(new Set(ids).size,4);
 advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(f.controller.resources.skillStacks,0);near(u.s.atk,atk);
});
for(let rank=1;rank<=10;rank++)test(`public S2 rank ${rank} naturally charges and shares one Slow/Bind/Stun phase across each wave`,()=>{
 const f=make({skill:2,rank,target:true}),{b,u}=f,atk=u.s.atk;until(b,()=>u.skill.ready,40);assert.equal(b.activateOperator(ID),true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');near(u.s.interval,3);
 for(let n=1;n<=3;n++){
  until(b,()=>f.attacks.length===n,5);assert.equal(f.controller.resources.cycle,n%3);
  for(const s of f.states.slice(-2))assert.equal(s[['slow','bind','stun'][n-1]],true);
  for(const h of f.hits.filter(h=>h.dmg.isSkill).slice(-2))near(h.amount,atk*(1+f.controller.record.bb.atk)*1.5);
 }
 advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(f.controller.resources.cycle,0);near(u.s.atk,atk);near(u.s.interval,2.3);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public E${elite}/P${potential} preserves selected source stats and maxed support policy`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedKichiBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public retreat/redeployment replaces stack, kill-set and front-mark ownership and resets source SP',()=>{
 const f=make({potential:6,target:true});until(f.b,()=>f.u.skill.ready,40);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.controller.resources.skillStacks===1,3);
 f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.controller.resources.marked.size,0);assert.equal(f.controller.resources.skillStacks,0);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,1,6,'DOWN');assert.notEqual(u.mem.kichi,f.controller);assert.equal(u.mem.kichi.resources.kills.size,0);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public S${skill} clears original 0-1 with natural DP, unchanged terrain and Melantha`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:`skchr_kichi_${skill}`};const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,1,2,'UP');owner=true;}
  const u=b.bench[ID].unit;if(u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit.skill.activations}));
});
