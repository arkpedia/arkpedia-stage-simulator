// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4225_tanya.json' with {type:'json'};
import review from '../data/arkpedia-tanya-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedTanyaBuild} from '../server/sim/content/arkpedia-tanya-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance,near} from './helpers/tanya-fixture.js';
const ID='char_4225_tanya',candidate=process.env.ARKPEDIA_REVIEW_TANYA==='1';
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-tanya-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,support=false,target=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_tanya_${skill}`,skillRank:rank,elite,level:d.operators[ID].phases[elite].maxLevel,potential,trust};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,cost=b.cost(ID),u=b.deployOperator(ID,3,6,'UP');near(before-b.dp,cost);
 const hits=[],attacks=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const enemies=[];if(target)for(const dc of[0,-.35]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,6+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});enemies.push(e);}b._buildEnemyIndex();
 return {b,u,build:b.bench[ID].build,controller:u.mem.tanya,hits,attacks,enemies};
}
test('Crackborne public source, exact clocks, original models and interface inputs stay pinned',async()=>{
 const o=data.operators[ID];assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(o.name,'Crackborne');assert.equal(o.sourceName,source.tables.character.name);assert.equal(o.sourceAppellation,'Crackborne');assert.equal(o.sourceChannel,'cn');
 assert.deepEqual(o.skills.map(s=>s.assetIcon),['skill-icons/Crackborne - Cleanse.webp','skill-icons/Crackborne - Wash Away.webp']);assert.equal(review.interfaceAssets.length,4);
 for(const[path,key]of[['native-operators/char_4225_tanya','sourceFoundationSha256'],['tanya-art','ownerArtworkSha256'],['tanya-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 const art=JSON.parse(await readFile(new URL('../data/arkpedia-tanya-art.json',import.meta.url)));assert.equal(art.recipeSha256,createHash('sha256').update(await readFile(new URL('../data/arkpedia-tanya-art-recipe.json',import.meta.url))).digest('hex'));
});
for(let rank=1;rank<=10;rank++)test(`public Crackborne S1 rank ${rank} immediately gains HP and naturally recovers/attacks`,()=>{
 const f=make({rank,target:true}),{b,u,controller:c}=f,max=u.s.maxHp;until(b,()=>u.skill.ready,50);u.elem.burn=500;
 assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');assert.equal(c.mode,1);near(u.s.maxHp,max*(1+c.record.bb.max_hp));
 const count=f.attacks.length;until(b,()=>f.attacks.length>count,4);assert.equal(f.attacks.at(-1).targets.length,1);assert.equal(f.attacks.at(-1).isSkill,true);
 until(b,()=>c.resources.s1Ticks>0,2);near(u.elem.burn,Math.max(0,500-c.record.bb.ep_heal*c.resources.s1Ticks));
 advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(c.mode,0);near(u.s.maxHp,max);assert.equal(c.resources.s1Ticks,20);
});
for(let rank=1;rank<=10;rank++)test(`public Crackborne S2 rank ${rank} grants permanent DEF and responds only to accepted HP loss`,()=>{
 const f=make({skill:2,rank,target:true}),{b,u,controller:c}=f;until(b,()=>u.skill.ready,50);const attacks=f.attacks.length,def=u.s.def;
 assert.equal(b.activateOperator(ID),true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2');assert.equal(c.resources.stacks(),0);
 until(b,()=>c.phase?.released,2);assert.equal(f.attacks.length,attacks);assert.equal(c.resources.stacks(),5);near(u.s.def,def*(1+5*c.record.bb.def));
 b.dealDamage(null,u,{amount:1,type:'element',element:'burn',canDodge:false});assert.equal(c.resources.stacks(),5);
 b.dealDamage(null,u,{amount:10,type:'true',canDodge:false});assert.equal(c.resources.stacks(),4);assert.equal(f.attacks.length,attacks);
 for(const t of f.enemies)near(t.elem.erosion,u.s.atk*c.record.bb.ep_damage_ratio);
 until(b,()=>!u.skill.active,2);assert.equal(c.resources.stacks(),4);advance(b,1);assert.equal(c.resources.stacks(),4);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`public Crackborne E${elite}/P${potential} preserves source selection and maxed support policy`,()=>{
 const f=make({elite,potential,trust:200,rank:[4,7,10][elite],support:potential===6}),r=selectedTanyaBuild(f.build);
 assert.deepEqual(recordFor(f.build,data).stats,r.stats);assert.deepEqual(f.controller.record.talentBb,r.talentBb);near(f.u.s.atk,r.stats.atk);if(potential===6){assert.equal(f.build.elite,2);assert.equal(f.build.level,80);}
});
test('public Crackborne retreat/redeployment resets source SP and resource ownership',()=>{
 const f=make({potential:6,target:true});until(f.b,()=>f.u.skill.ready,40);assert.equal(f.b.activateOperator(ID),true);until(f.b,()=>f.controller.mode===1,1);
 f.b.retreatOperator(ID);assert.equal(f.controller.stopped,true);assert.equal(f.controller.resources.stacks(),0);assert.equal(f.u.findBuff(f.controller.resources.hpKey),null);
 until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,90);f.b.getPlayer('arkpedia').dp=99;const u=f.b.deployOperator(ID,3,6,'DOWN');assert.notEqual(u.mem.tanya,f.controller);near(u.skill.spTotal,u.skill.initSp);assert.equal(u.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`public Crackborne S${skill} clears original 0-1 with natural DP and unchanged terrain`,()=>{
 const M='char_208_melan',build={...defaultBuild(data.operators[ID]),skillId:`skchr_tanya_${skill}`};const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);
 let helper=false,owner=false,hits=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});
 for(let n=0;n<9001&&!b.finished;n++){
  if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}
  if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,3,5,'RIGHT');owner=true;}
  const u=b.bench[ID].unit;if(u?.alive&&u.skill.ready)b.activateOperator(ID);b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,kills:r.killed,leaks,life:b.life,hits,activations:b.bench[ID].unit?.skill.activations,reason:r.reason}));
 assert.ok(helper&&owner);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(b.bench[ID].unit.skill.activations>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
