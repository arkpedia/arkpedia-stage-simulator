// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import review from '../data/arkpedia-mcnist-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedMechanistBuild} from '../server/sim/content/arkpedia-mcnist-source.js';
import {regularSummonCards,deployRegularSummon,selectedRegularSummon} from '../server/sim/content/arkpedia-summons.js';
import {regularTokenIdsFor} from '../shared/arkpedia/summons.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/mon3tr-fixture.js';
const ID='char_4230_mcnist',TOKEN='token_10069_mcnist_mcgraf',CARD=`summon:${ID}`,candidate=process.env.ARKPEDIA_REVIEW_MCNIST==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-mcnist-candidate.json',import.meta.url))):normal;
// A held candidate is exercised explicitly; normal full-suite runs do not admit it.
const enabled=candidate||review.enabledOperators.includes(ID),check=enabled?test:test.skip;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_mcnist_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,3,3,'RIGHT');near(before-b.dp,cost);
 const hits=[],attacks=[];b.on('damaged',c=>{if(c.source===u||c.credit===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,4]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();
 return {b,u,e,build:b.bench[ID].build,c:u.mem.mcnist,hits,attacks};
}
check('Mechanist public source, all original models and five interface assets remain pinned',async()=>{
 assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Mechanist');assert.equal(o.sourceName,source.tables.character.name);assert.equal(o.sourceChannel,'cn');assert.equal(review.interfaceAssets.length,5);
 for(const[path,key]of[['native-operators/char_4230_mcnist','sourceFoundationSha256'],['mcnist-art','ownerArtworkSha256'],['mcnist-token-art','tokenArtworkSha256'],['mcnist-clocks','sourceClocksSha256'],['mcnist-token-avatar','tokenAvatarSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.equal(data.sd.models[`operator/${TOKEN}/default/front`].avatar.sha256,'d665f457f1eb8233b410ce1e971eac123a04721adba1dbacf12d29a74cd21871');
});
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`Public Mechanist S${skill} rank ${rank} uses natural SP, selected source work and zero-slot McGraf`,()=>{
 const f=make({skill,rank}),{b,u,c}=f;
 if(skill!==1)until(b,()=>u.skill.ready,60);
 assert.equal(selectedRegularSummon(b,CARD).record.id,TOKEN);assert.equal(selectedRegularSummon(b,CARD).record.arkpedia.elite,2);
 const before=b.dp,slots=b.deployedSlots(),t=deployRegularSummon(b,CARD,3,5,'LEFT');near(before-b.dp,10);assert.equal(b.deployedSlots(),slots);assert.equal(t.def.charId,TOKEN);assert.equal(skillHud(t.skill).ready,false);assert.equal(t.skill.kind,'passive');
 if(skill===1){until(b,()=>u.skill.active,30);until(b,()=>f.hits.some(h=>h.dmg.tags?.includes('mcnist:s1-burst')),4);assert.equal(u.skill.spTotal,0);}
 else{assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
  if(skill===2){assert.ok(c.owner.shields.entries.has(t));assert.ok(c.owner.shields.entries.has(u));assert.equal(regularSummonCards(b)[0].hidden,undefined);}
  else{assert.equal(t.alive,false);assert.equal(regularSummonCards(b)[0].hidden,true);assert.equal(selectedRegularSummon(b,CARD).hidden,true);assert.equal(c.deck.flight.projectile.startDelay,.25);advance(b,.2);assert.equal(c.deck.arrivals,0);until(b,()=>c.deck.arrivals===1,3);assert.equal(regularSummonCards(b)[0].hidden,false);assert.notEqual(c.deck.point.unit,t);assert.ok(skillHud(c.deck.point.unit.skill).fraction>.99);assert.ok(c.deck.point.unit.mem.mcgrafS3Aura.active());}
 }
 assert.ok(c.resources.valid());assert.deepEqual(b.errors,[]);
});
for(const elite of[0,1,2])for(const potential of[1,6])check(`Public Mechanist E${elite}/P${potential} keeps original stats, E0 token absence and maxed support`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedMechanistBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);assert.equal(regularSummonCards(f.b).length,f.build.elite>0?1:0);if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,90);}
});
for(const skill of[1,2,3])check(`Public Mechanist S${skill} retirement removes its card and token, and redeployment gets a fresh controller`,()=>{
 const f=make({skill,potential:6}),t=deployRegularSummon(f.b,CARD,3,5,'LEFT');f.b.retreatOperator(ID);assert.equal(f.c.stopped,true);assert.equal(t.alive,false);assert.equal(regularSummonCards(f.b).length,0);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const next=f.b.deployOperator(ID,3,3,'RIGHT');assert.notEqual(next.mem.mcnist,f.c);near(next.skill.spTotal,next.skill.initSp);assert.equal(regularSummonCards(f.b).length,1);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2,3])check(`Public Mechanist S${skill} clears unchanged original 0-1 using natural DP`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:`skchr_mcnist_${skill}`},b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let helper=false,owner=false,hits=0;
 b.on('damaged',c=>{if(c.source?.defId===ID||c.credit?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,3,3,'RIGHT');owner=true;}
  const u=b.bench[ID].unit;if(skill!==1&&u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit?.skill.activations,reason:r.reason}));
 assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
