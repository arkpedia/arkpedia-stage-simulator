// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4214_cairn.json' with {type:'json'};
import review from '../data/arkpedia-cairn-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedCairnBuild} from '../server/sim/content/arkpedia-cairn-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/cairn-fixture.js';
const ID='char_4214_cairn',candidate=process.env.ARKPEDIA_REVIEW_CAIRN==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-cairn-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_cairn_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,3,6,'UP');near(before-b.dp,cost);
 const hits=[],attacks=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const enemies=[];if(target)for(const dc of[0,-.35]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,6+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});enemies.push(e);}b._buildEnemyIndex();
 return {b,u,build:b.bench[ID].build,controller:u.mem.cairn,hits,attacks,enemies};
}
test('Cairn public source, exact clocks, original models and interface inputs stay pinned',async()=>{
 const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Cairn');assert.equal(o.sourceName,source.tables.character.name);assert.equal(o.sourceAppellation,'Cairn');assert.equal(o.sourceChannel,'cn');
 assert.deepEqual(o.skills.map(s=>s.assetIcon),['skill-icons/Cairn - Covered Consolidation.webp','skill-icons/Cairn - Stunning Directives.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4214_cairn','sourceFoundationSha256'],['cairn-art','ownerArtworkSha256'],['cairn-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 const art=JSON.parse(await readFile(new URL('../data/arkpedia-cairn-art.json',import.meta.url)));assert.equal(art.recipeSha256,createHash('sha256').update(await readFile(new URL('../data/arkpedia-cairn-art-recipe.json',import.meta.url))).digest('hex'));
});
for(let rank=1;rank<=10;rank++)test(`public Cairn S1 rank ${rank} naturally charges, enters timed HP mode and attacks one target`,()=>{
 const f=make({rank,target:true}),{b,u,controller:c}=f,max=u.s.maxHp;until(b,()=>u.skill.ready,50);assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');near(u.s.maxHp,max);until(b,()=>c.mode===1,1);near(u.s.maxHp,max*(1+c.record.bb.max_hp));
 const count=f.attacks.length;until(b,()=>f.attacks.length>count,4);assert.equal(f.attacks.at(-1).targets.length,1);assert.equal(f.attacks.at(-1).isSkill,true);
 advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(c.mode,0);near(u.s.maxHp,max);
});
for(let rank=1;rank<=10;rank++)test(`public Cairn S2 rank ${rank} applies one shield and snapshotted recipient DOT through manual cast`,()=>{
 const f=make({skill:2,rank,target:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,50);const attacks=f.attacks.length;
 assert.equal(b.activateOperator(ID),true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2');assert.equal(u.findBuff(c.resources.shieldKey),null);
 until(b,()=>c.phase?.released,2);assert.equal(f.attacks.length,attacks);near(u.findBuff(c.resources.shieldKey).shield,u.s.maxHp*c.record.bb.shield_hp_ratio);
 assert.ok(f.enemies.every(e=>e.findBuff(c.resources.dotKey)));until(b,()=>f.hits.filter(h=>h.dmg.tags.includes('cairn:s2-dot')).length===2,2);
 for(const h of f.hits.filter(h=>h.dmg.tags.includes('cairn:s2-dot')))near(h.amount,u.s.atk*c.record.bb.atk_scale);
 until(b,()=>!u.skill.active,2);assert.ok(u.findBuff(c.resources.shieldKey));advance(b,10.1);assert.equal(u.findBuff(c.resources.shieldKey),null);assert.ok(f.enemies.every(e=>!e.findBuff(c.resources.dotKey)));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public Cairn E${elite}/P${potential} preserves source selection and maxed support policy`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedCairnBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public Cairn retreat/redeployment resets source SP and resource ownership',()=>{
 const f=make({potential:6,target:true});until(f.b,()=>f.u.skill.ready,40);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.controller.mode===1,1);
 f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.controller.resources.blocked.size,0);assert.equal(f.u.findBuff(f.controller.resources.hpKey),null);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,3,6,'DOWN');assert.notEqual(u.mem.cairn,f.controller);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public Cairn S${skill} clears original 0-1 with natural DP and unchanged terrain`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:`skchr_cairn_${skill}`};const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,3,5,'RIGHT');owner=true;}
  const u=b.bench[ID].unit;if(u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit?.skill.activations,reason:r.reason}));
 assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
