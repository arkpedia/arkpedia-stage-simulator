// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import review from '../data/arkpedia-tragodia-runtime-review.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {catalogueFor,defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {regularTokenIdsFor} from '../shared/arkpedia/summons.js';
import {regularSummonCards,summonPlacementError,deployRegularSummon,retreatRegularSummon} from '../server/sim/content/arkpedia-summons.js';
import {selectedTragodiaBuild} from '../server/sim/content/arkpedia-tragodia-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const ID='char_1042_phatm2',LURE='token_10054_phatm2_encdool',CAGE='token_10055_phatm2_mndclv',CARD=`summon:${ID}`;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,s){for(let n=0;n<Math.ceil(s/b.dt-1e-9);n++)b.step();assert.deepEqual(b.errors,[]);}
function until(b,p,s=140){const end=b.time+s;while(!p()&&b.time<end)advance(b,b.dt);assert.ok(p(),`Missing condition at ${b.time}`);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_phatm2_${skill}`,skillRank:rank,elite,
  level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_124_kroos)],support:build}:{operators:[build]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',x=>{if(x.source?.defId===ID)hits.push(x);});
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,5,5,'RIGHT');near(before-b.dp,cost);
 return{b,u,build:b.bench[ID].build,c:u.mem.tragodiaController,hits};
}
function enemy(b,col=6){const t=b.spawnEnemy('enemy_1007_slime',{pos:[5,col]});
 Object.assign(t.base,{maxHp:1e9,atk:100,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e9;
 b.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return t;}

test('public review binds source, owner/lure artwork and original effect delivery without inventing cage Spine art',async()=>{
 assert.deepEqual(REGULAR_OPERATORS[ID].skillIds,[1,2,3].map(n=>`skchr_phatm2_${n}`));assert.ok(catalogueFor(data)[ID]);
 assert.deepEqual(regularTokenIdsFor([ID]),[LURE]);assert.equal(data.tokens[CAGE].renderingKind,'effect-only');
 assert.equal(data.sd.models[`operator/${CAGE}/default/front`],undefined);
 for(const [name,key]of [['prefabs','sourceFoundationSha256'],['device-art','deviceArtworkSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-tragodia-${name}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const [key,model]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
 assert.deepEqual(data.nativeEffects.tragodia.manifest,review.nativeEffectManifest);
 assert.equal(data.nativeEffects.tragodia.commit,data.sd.commit);
 assert.equal(review.frameParity,false);assert.equal(review.nativePixelParity,false);assert.equal(review.moduleSupport,false);
});
for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++)test(`public S${skill} rank ${rank} naturally charges, uses its selected controller and retires owned tokens`,()=>{
 const{b,u,c,hits}=make({skill,rank}),target=enemy(b);
 assert.equal(c.record.index,skill-1);assert.equal(c.record.build.skillRank,rank);assert.equal(u.skill.spTotal,u.skill.initSp);
 const slots=b.deployedSlots();
 if(skill===1){
  until(b,()=>u.skill.activations>0);until(b,()=>hits.some(h=>h.dmg.tags.includes('tragodia:s1')));
  const account=hits.find(h=>h.dmg.tags.includes('tragodia:s1')).dmg.attackId;
  until(b,()=>hits.filter(h=>h.dmg.tags.includes('tragodia:s1')&&h.dmg.attackId===account).length===2,2);
  assert.deepEqual(regularSummonCards(b),[]);assert.equal(c.lure,undefined);assert.equal(c.cages,undefined);
 }else if(skill===2){
  assert.match(summonPlacementError(b,CARD,5,6),/Activate S2/);
  until(b,()=>u.skill.active&&c.skills.mode===2);
  assert.equal(b.activateOperator(ID),false,'automatic S2 does not become a manual button');
  const card=regularSummonCards(b).find(x=>x.key===CARD);assert.ok(card.available);assert.equal(card.cost,5);
  assert.equal(card.record.arkpedia.elite,2);assert.equal(card.record.arkpedia.skillRank,rank);
  const before=b.dp,t=deployRegularSummon(b,CARD,5,6);near(before-b.dp,5);assert.equal(t.defId,LURE);assert.equal(t.deploymentSlotCost,0);
  assert.equal(t.mem.regularDeathVisual,undefined,'controller End is not replayed as Die');
  until(b,()=>!t.alive,14);assert.deepEqual(t.mem.regularDeathVisual,{hide:true});until(b,()=>hits.some(h=>h.dmg.tags.includes('tragodia:s2-lure-dot')),4);
  assert.ok(c.lure.readyAt>b.time);assert.equal(regularSummonCards(b).length,1);
 }else{
  assert.deepEqual(regularSummonCards(b),[]);until(b,()=>skillHud(u.skill).canActivate);
  assert.equal(b.activateOperator(ID),true);
  until(b,()=>c.cages.tokens.size>0,45);
  const cage=[...c.cages.tokens.keys()][0];assert.equal(cage.defId,CAGE);assert.equal(cage.deploymentSlotCost,0);
  assert.equal(cage.hp,3);assert.equal(target.blockedBy,cage);assert.equal(cage.mem.regularNativeEffect,'phatm2_skill_03_prison_01');
  until(b,()=>hits.some(h=>h.dmg.tags.includes('tragodia:s3')),5);
 }
 assert.equal(b.deployedSlots(),slots);
 b.retreatOperator(ID);assert.equal(c.stopped,true);assert.deepEqual(c.handles,[]);
 if(c.lure){assert.equal(c.lure.stopped,true);assert.equal(c.lure.point,null);assert.equal(regularSummonCards(b).length,0);}
 if(c.cages)assert.equal(c.cages.tokens.size,0);
 advance(b,2);assert.equal(b.deployedSlots(),0);
});
for(const elite of [0,1,2])for(const potential of [1,6])test(`public E${elite}/P${potential} keeps selected owner stats, talents and support scaling`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6});
 const source=selectedTragodiaBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,source.stats);
 assert.equal(f.u.s.atk,source.stats.atk);assert.equal(f.u.s.maxHp,source.stats.maxHp);
 assert.deepEqual(f.c.record.talentBb,source.talentBb);assert.deepEqual(f.u.def.tags,source.tags);
});
test('public S2 uses the common summon placement, full-screen, cost, refund and owner-removal transaction',()=>{
 const f=make({skill:2}),{b,u,c}=f;until(b,()=>u.skill.active);
 b.setViewport('preview');const before=b.dp;assert.match(summonPlacementError(b,CARD,5,7),/fullscreen/);
 assert.throws(()=>deployRegularSummon(b,CARD,5,7));near(b.dp,before);b.setViewport('fullscreen-workspace');
 b.getPlayer('arkpedia').dp=4;assert.match(summonPlacementError(b,CARD,5,7),/DP/);
 b.getPlayer('arkpedia').dp=99;const t=deployRegularSummon(b,CARD,5,7);near(b.dp,94);
 retreatRegularSummon(b,`token:${t.id}`);near(b.dp,94);assert.equal(t.alive,false);assert.ok(c.lure.readyAt>b.time);
 b.retreatOperator(ID);assert.deepEqual(regularSummonCards(b),[]);
});
for(const skill of [1,2,3])test(`public S${skill} resolves unchanged 0-1 waves with natural DP and cleans up`,()=>{
 const build={...defaultBuild(data.operators[ID]),skillId:`skchr_phatm2_${skill}`};
 const b=new StandardBattle(data,{operators:[build]});b.setViewport('fullscreen-workspace');
 const tiles=structuredClone(b.grid.tiles),hits=[];b.on('damaged',x=>{if(x.source?.defId===ID)hits.push(x);});let deployed=false;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!deployed&&b.dp>=b.cost(ID)){b.deployOperator(ID,4,6,'DOWN');deployed=true;}
  const u=b.bench[ID].unit;if(skill===3&&u&&skillHud(u.skill).canActivate)b.activateOperator(ID);
  b.step();
 }
 const result=b.result();assert.equal(result.reason,'cleared');assert.equal(result.total,11);
 const leaks=result.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;assert.equal(result.killed+leaks,11);
 assert.equal(b.life,data.stage.battle.max_life-leaks);assert.ok(hits.length>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
 const c=b.bench[ID].unit.mem.tragodiaController;assert.equal(c.stopped,true);
 if(c.cages)assert.equal(c.cages.tokens.size,0);if(c.lure)assert.equal(c.lure.point,null);
});
