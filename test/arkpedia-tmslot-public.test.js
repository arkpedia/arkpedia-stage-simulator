// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4236_tmslot.json' with {type:'json'};
import review from '../data/arkpedia-tmslot-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedTimeslotBuild} from '../server/sim/content/arkpedia-tmslot-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/tmslot-fixture.js';
const SKILLS=['skcom_atk_up[3]','skchr_tmslot_2'];
const ID='char_4236_tmslot',candidate=process.env.ARKPEDIA_REVIEW_TMSLOT==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-tmslot-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:SKILLS[skill-1],skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,1,5,'UP');near(before-b.dp,cost);
 const hits=[],attacks=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const enemies=[];if(target)for(const dc of[0,-.35]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,5+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});enemies.push(e);}b._buildEnemyIndex();
 return {b,u,build:b.bench[ID].build,controller:u.mem.tmslot,hits,attacks,enemies};
}
test('Timeslot public source, exact clocks, original models and interface inputs stay pinned',async()=>{
 const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Timeslot');assert.equal(o.sourceName,source.tables.character.name);assert.equal(o.sourceAppellation,'Timeslot');assert.equal(o.sourceChannel,'cn');
 assert.deepEqual(o.skills.map(s=>s.assetIcon),['skill-icons/Timeslot - ATK Up γ.webp','skill-icons/Timeslot - Technology and Traditional Rituals.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4236_tmslot','sourceFoundationSha256'],['tmslot-art','ownerArtworkSha256'],['tmslot-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-tmslot-overdrive-source.json',import.meta.url))).digest('hex'),review.sourceOverdriveSha256);
 const art=JSON.parse(await readFile(new URL('../data/arkpedia-tmslot-art.json',import.meta.url)));assert.equal(art.recipeSha256,createHash('sha256').update(await readFile(new URL('../data/arkpedia-tmslot-art-recipe.json',import.meta.url))).digest('hex'));
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`public Timeslot S${skill} rank ${rank} preserves selected modes, owner receipts and independent drones`,()=>{
 const f=make({skill,rank,target:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,60);const atk=u.s.atk,aspd=u.s.aspd;
 assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
 if(skill===1){near(u.s.atk,c.record.stats.atk*(1+c.talent.atk+c.record.bb.atk));assert.equal(c.mode,1);assert.equal(u.skill.id,SKILLS[0]);}
 else{near(u.s.atk,atk);near(u.s.aspd,aspd);assert.equal(c.mode,2);until(b,()=>c.slots[0].pulses>0,4);assert.equal(c.slots[0].target,c.slots[1].target);
  until(b,()=>c.mode===3,21);assert.equal(skillHud(u.skill).state,'overloaded');near(u.s.atk,c.record.stats.atk*(1+c.talent.atk+c.record.bb.atk));
  const n=f.attacks.length,pulses=c.slots[0].pulses;advance(b,2);assert.equal(f.attacks.length,n);assert.ok(c.slots[0].pulses>pulses);}
 assert.ok(f.attacks.every(a=>a.targets.length===1));assert.ok(f.hits.length>0);
 advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(c.mode,0);assert.equal(c.marks.size,0);near(u.s.atk,atk);near(u.s.aspd,aspd);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public Timeslot E${elite}/P${potential} preserves source selection and maxed support policy`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedTimeslotBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk*(1+(r.talentBb[0]?.atk??0)));if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public Timeslot retreat/redeployment resets source SP and resource ownership',()=>{
 const f=make({skill:2,potential:6,target:true});until(f.b,()=>f.u.skill.ready,40);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.controller.slots[0].pulses>0,4);
 f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.controller.marks.size,0);assert.equal(f.u.findBuff(f.controller.skillKey),null);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,4,5,'DOWN');assert.notEqual(u.mem.tmslot,f.controller);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public Timeslot S${skill} clears original 0-1 with natural DP and unchanged terrain`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:SKILLS[skill-1]};const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,4,5,'DOWN');owner=true;}
  const u=b.bench[ID].unit;if(u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit?.skill.activations,reason:r.reason}));
 assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});

for(const overloaded of[false,true])test(`public Timeslot S2 can be manually stopped during ${overloaded?'overload':'its first phase'}`,()=>{
 const f=make({skill:2,target:true});until(f.b,()=>f.u.skill.ready,50);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.controller.slots[0].pulses>0,4);
 if(overloaded)until(f.b,()=>f.controller.mode===3,21);assert.equal(skillHud(f.u.skill).canCancel,true);const activations=f.u.skill.activations;
 assert.equal(f.b.activateOperator(ID),true);assert.equal(f.u.skill.active,false);assert.equal(f.controller.mode,0);assert.equal(f.controller.marks.size,0);assert.ok(f.controller.slots.every(s=>s.target===null));assert.equal(f.u.skill.activations,activations);near(f.u.skill.spTotal,0);
});
