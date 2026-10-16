// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4234_pedro.json' with {type:'json'};
import review from '../data/arkpedia-pedro-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedPedroBuild} from '../server/sim/content/arkpedia-pedro-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/pedro-fixture.js';
const SKILLS=['skchr_pedro_1','skchr_pedro_2'],ID='char_4234_pedro',candidate=process.env.ARKPEDIA_REVIEW_PEDRO==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-pedro-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:SKILLS[skill-1],skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,1,5,'UP');near(before-b.dp,cost);
 const hits=[],attacks=[];b.on('damaged',c=>{if(c.source===u||c.credit===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const enemies=[];if(target)for(const dc of[0,-.35]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,5+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});enemies.push(e);}b._buildEnemyIndex();
 return{b,u,build:b.bench[ID].build,controller:u.mem.pedro,resources:u.mem.pedroResources,hits,attacks,enemies};
}
test('Pedro public source, exact clocks, original models and all four interface assets remain pinned',async()=>{
 const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Pedro');assert.equal(o.sourceName,source.tables.character.name);assert.equal(o.sourceAppellation,'Pedro');assert.equal(o.sourceChannel,'cn');
 assert.deepEqual(o.skills.map(s=>s.assetIcon),['skill-icons/Pedro - Marking Shot.webp','skill-icons/Pedro - Alternate Evacuation.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4234_pedro','sourceFoundationSha256'],['pedro-art','ownerArtworkSha256'],['pedro-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 const art=JSON.parse(await readFile(new URL('../data/arkpedia-pedro-art.json',import.meta.url)));assert.equal(art.recipeSha256,createHash('sha256').update(await readFile(new URL('../data/arkpedia-pedro-art-recipe.json',import.meta.url))).digest('hex'));
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`public Pedro S${skill} rank ${rank} preserves natural SP, selected work and original source receipts`,()=>{
 const f=make({skill,rank,target:true}),{b,u,controller:c,resources:r}=f;const atk=u.s.atk;
 if(skill===1){until(b,()=>f.attacks.some(a=>a.isSkill),35);until(b,()=>f.enemies.every(t=>!!t.findBuff('pedro:s1:trigger')),2);const receipts=f.attacks.filter(a=>a.isSkill);assert.equal(receipts.length,1);assert.equal(receipts[0].targets.length,2);assert.equal(u.skill.spTotal,0);}
 else{until(b,()=>u.skill.ready,30);assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);until(b,()=>!!u.findBuff('pedro:s2:protection'),2);assert.equal(u.skill.active,true);assert.ok(f.attacks.every(a=>!a.isSkill));}
 until(b,()=>!u.skill.active,4);assert.equal(c.phase?.kind==='s2',false);near(u.s.atk,atk);assert.ok(f.hits.length>0||skill===2);assert.deepEqual(b.errors,[]);assert.ok(r.valid());
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public Pedro E${elite}/P${potential} preserves selected stats and maxed support policy`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedPedroBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public Pedro retreat/redeployment resets owner SP while legally born protection remains recipient-owned',()=>{
 const f=make({skill:2,potential:6}),{b,u}=f;until(b,()=>u.skill.ready,30);assert.equal(b.activateOperator(ID),true);until(b,()=>!!u.findBuff('pedro:s2:protection'),2);b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.resources.allyMarks.size,0);
 until(b,()=>b.bench[ID].readyAt<=b.time,90);b.getPlayer('arkpedia').dp=99;const next=b.deployOperator(ID,4,5,'DOWN');assert.notEqual(next.mem.pedro,f.controller);near(next.skill.spTotal,next.skill.initSp);assert.equal(next.skill.active,false);assert.deepEqual(b.errors,[]);
});
for(const skill of[1,2])test(`public Pedro S${skill} clears original 0-1 with natural DP and unchanged terrain`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:SKILLS[skill-1]};const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID||c.credit?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,4,5,'DOWN');owner=true;}
  const u=b.bench[ID].unit;if(skill===2&&u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit?.skill.activations,reason:r.reason}));
 assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
