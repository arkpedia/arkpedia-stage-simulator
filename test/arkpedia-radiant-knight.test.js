// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-radiant-knight-prefabs.json' with {type:'json'};
import {RADIANT_KNIGHT_OPERATORS as configs} from '../shared/arkpedia/radiant-knight-operators.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
const ID='char_1014_nearl2',SUN='token_10019_nearl2_sword',KAZ='char_237_gravel',OTHER='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const rows=r=>r.flatMap(x=>x.components.map(c=>({pathId:c.pathId,...c.data})));
function build(id=ID,{skill=0,rank=10,elite=null,potential=1,level=null,trust=0}={}) {
  const op=data.operators[id];assert.ok(op,`Reviewed ${id} snapshot needed`);elite??=op.phases.length-1;
  rank=Math.min(rank,[4,7,10][elite]);return {...defaultBuild(op),elite,level:level??op.phases[elite].maxLevel,
    potential,trust,skillId:op.skills[skill].id,skillRank:rank};
}
function make(opts={},more=[],support=false) {
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  const b=new StandardBattle(d,support?{operators:more.map(id=>build(id)),support:{id:ID,skillId:'skchr_nearl2_3'}}
    :{operators:[build(ID,opts),...more.map(id=>build(id))]});
  b.setViewport('fullscreen-workspace');b.autoFinish=false;b.recordEvents=true;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  b.receipts=[];b.on('damaged',c=>b.receipts.push({...c,time:b.time}));
  return {b,deploy:(id=ID,r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);
    assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{r=3,c=5,hp=100000,def=0,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});e.def={...e.def,immune:new Set(e.def.immune)};
  e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,e?[e]:undefined),true);u.atkCd=1000;}
function event(b,u){return b._evq.filter(x=>x[0]==='atk'&&x[1]===u.id).at(-1)[4];}
function hits(b,e,tag=null){return b.receipts.filter(c=>c.target===e&&(!tag||c.dmg.tags.includes(tag)));}
function forceSun(b,key=3*21+5){const pick=b.rng.pick;b.rng.pick=xs=>xs.includes(key)?key:pick(xs);}
function forbidSun(b,u){for(const[r,c]of[[3,3],[3,5],[2,4],[4,4]])b.grid.tiles[r*21+c]={...b.grid.tiles[r*21+c],build:'NONE'};}

test('Nearl2 preserves five verified bundles, original facing pointer chains and exact Sun graph',()=>{
  assert.deepEqual(Object.keys(configs),[ID]);assert.equal(source.frameParity,false);assert.equal(source.sourceBundles.length,5);
  for(const b of source.sourceBundles)assert.match(b.sha256,/^[0-9a-f]{64}$/);
  for(const f of['Front','Back'])assert.equal(source.originalModels[ID][f].sha256,source.officialSkeletonBindings[ID][f].sha256);
  const zero=rows(source.skills.skchr_nearl2_2).find(x=>x.pathId==='-1291650482406657799');assert.equal(zero._dontOccupyDeployCnt,1);
  const root=rows(source.tokens[SUN]).find(x=>x.pathId==='-6441875690030589171');assert.equal(root._occupiedRemainingCharacterCnt,0);
  assert.equal(root._useRealBornTimeFromAnim,1);assert.equal(root._category,1);near(source.sunModel.durations.Start,.333);
  assert.deepEqual(source.sunModel.hits,{});assert.ok(source.verificationLimits.some(x=>x.includes('waitForAttackEvent1')));
});
test('all thirty selected ranks instantiate exact SP, duration and source percentages',()=>{
  for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.id,configs[ID].skillIds[skill]);
    const s=data.operators[ID].skills[skill].levels[rank-1];near(u.skill.spCost,s.spData.spCost);
    if(skill!==1)cast(u);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));
    if(skill===0)assert.equal(u.skill.timeLeft,Infinity);else near(u.skill.timeLeft,s.duration);
    assert.deepEqual(b.errors,[]);
  }
});
test('promotion and potential select exact birth talent and DEF ignore without E0 leakage',()=>{
  for(const[elite,potential,scale,pen]of[[0,1,0,0],[1,1,.5,0],[2,1,.8,.2],[2,5,.8,.23]]){
    const{b,deploy}=make({elite,potential}),e=enemy(b),u=deploy();near(100000-e.hp,u.base.atk*scale);
    near(u.s.defIgnorePct,pen);assert.equal(u.def.talents.length,elite===0?0:elite===1?1:2);
    assert.equal(Boolean(e.s.flags.stun),elite!==0);
  }
});
test('ordinary attack first begin plus literal .433 loop hits one ground victim after DEF ignore',()=>{
  const{b,deploy}=make(),u=deploy(),e=enemy(b,{def:200}),air=enemy(b,{fly:true});shot(b,u,e);
  near(event(b,u).windup,.1+.433);assert.equal(event(b,u).animation.begin,'Attack_Begin');
  advance(b,.5);near(e.hp,100000);advance(b,.12);near(100000-e.hp,u.s.atk-200*.8);near(air.hp,100000);
  assert.equal(b.projectiles.list.length,0);assert.equal(hits(b,e)[0].dmg.applyWay,'melee');
});
test('native uncapped ASPD scales first begin and ordinary hit deadline independently of DEF receipt',()=>{
  const{b,deploy}=make(),u=deploy(),e=enemy(b);b.addBuff(u,{key:'aspd',mods:{aspd:200}});shot(b,u,e);
  near(event(b,u).windup,(.1+.433)/3);near(event(b,u).animation.beginDuration,.1/3);advance(b,.3);near(100000-e.hp,u.s.atk);
});
test('talent birth x-5 is ground-only adjacent, rejecting diagonal/flying/hidden/untargetable/stealth/sleep',()=>{
  const{b,deploy}=make(),ground=enemy(b),diagonal=enemy(b,{r:4,c:5}),air=enemy(b,{fly:true}),hidden=enemy(b),free=enemy(b),stealth=enemy(b),sleep=enemy(b);
  hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep',{duration:5});
  const u=deploy();near(100000-ground.hp,u.s.atk*.8);for(const e of[diagonal,air,hidden,free,stealth,sleep])near(e.hp,100000);
});
test('previous Kaz operator doubles separate birth receipts even after retirement or death',()=>{
  for(const kind of['live','retreat','death']){
    const{b,deploy}=make({},[KAZ]),a=deploy(KAZ,1,1);if(kind==='retreat')b.retreatOperator(KAZ);else if(kind==='death')b.kill(a);
    const e=enemy(b),u=deploy();near(100000-e.hp,2*u.s.atk*.8);assert.equal(hits(b,e,'radiant-knight:birth').length,2);
  }
});
test('history excludes enemy/token/device births and rejected placement, but a later ordinary operator replaces Kaz',()=>{
  const{b,deploy}=make({},[KAZ,OTHER]),a=deploy(KAZ,1,1);enemy(b,{r:1,c:8});b.spawnDevice('test',1,2,{blockCnt:0});
  assert.throws(()=>b.deployOperator(OTHER,1,1,'RIGHT'));const e=enemy(b),u=deploy();near(100000-e.hp,2*u.s.atk*.8);
  b.retreatOperator(ID);b.bench[ID].readyAt=b.time;deploy(OTHER,1,3);const z=enemy(b),v=deploy();near(100000-z.hp,v.s.atk*.8);
});
test('redeploying Nearl herself counts as a prior Kaz operator, while support participates in the same actual history',()=>{
  const{b,deploy}=make(),u=deploy();b.retreatOperator(ID);b.bench[ID].readyAt=b.time;const e=enemy(b),v=deploy();near(100000-e.hp,2*v.s.atk*.8);
  const s=make({},[KAZ],true);s.deploy(KAZ,1,1);const z=enemy(s.b),w=s.deploy();near(100000-z.hp,2*w.s.atk*.8);
});
test('birth damage and stun use ordinary true-damage/shield/fatal paths, not a scripted kill',()=>{
  const{b,deploy}=make(),e=enemy(b,{def:9999}),z=enemy(b,{hp:1,c:5.1});b.addBuff(e,{key:'shield',shield:100000});
  const u=deploy();near(e.hp,100000);near(e.findBuff('shield').shield,100000-u.s.atk*.8);assert.equal(Boolean(e.s.flags.stun),true);
  assert.equal(z.alive,false);near(z.stats.taken,1);near(hits(b,z,'radiant-knight:birth')[0].amount,u.s.atk*.8);
});
test('S1 selected ATK/ASPD are additive beside external modifiers and remain unlimited',()=>{
  const{b,deploy}=make(),u=deploy();b.addBuff(u,{key:'external',mods:{atkPct:.2,aspd:30}});cast(u);
  near(u.s.atk,u.base.atk*1.9);near(u.s.aspd,180);advance(b,80);assert.equal(u.skill.active,true);
  assert.equal(u.skill.spec.manualCancel,undefined);assert.equal(b.activateOperator(ID),false);
});
test('S1 actual range acquires front2 while excluding front3 and releases exact Down/source clips',()=>{
  for(const dir of['RIGHT','DOWN','LEFT','UP']){
    const r0=dir==='UP'?2:3;const{b,deploy}=make(),u=deploy(ID,r0,4,dir);cast(u);advance(b,.2);
    const dr=dir==='UP'?1:dir==='DOWN'?-1:0,dc=dir==='RIGHT'?1:dir==='LEFT'?-1:0;
    const e=enemy(b,{r:r0+dr*2,c:4+dc*2}),z=enemy(b,{r:r0+dr*3,c:4+dc*3});
    assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);
    assert.equal(event(b,u).animation,dir==='DOWN'?'Skill_1_Loop_Down':'Skill_1_Loop');
    near(event(b,u).windup,.467/1.5);advance(b,.5);near(100000-e.hp,u.s.atk);near(z.hp,100000);
  }
});
test('S1 mapped original Begin gates attacks .1 and cleans correctly on owner withdrawal',()=>{
  const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);u.atkCd=0;advance(b,.09);near(e.hp,100000);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');b.retreatOperator(ID);advance(b,.4);near(e.hp,100000);
  assert.equal(u.mem.regularFormVisual,null);
});
test('S2 selected skill has zero slots in actual placement and deployed count; S1/S3 still cost one',()=>{
  for(const skill of[0,1,2]){
    const{b,deploy}=make({skill},[OTHER]);b.unitLimit=1;deploy(OTHER,1,1);
    assert.equal(b.deploymentSlotCost(ID),skill===1?0:1);
    if(skill===1){const u=deploy();assert.equal(u.deploymentSlotCost,0);assert.equal(b.deployedSlots(),1);}
    else assert.equal(b.placementError(ID,3,4),'Deployment limit reached.');
  }
});
test('S2 activates only on successful deployment with exact duration and ATK, even without enemies',()=>{
  const{b,deploy}=make({skill:1}),u=deploy();assert.equal(u.skill.active,true);near(u.skill.timeLeft,27);near(u.s.atk,u.base.atk*2.6);
  assert.equal(u.findBuff('radiant-knight:s2-shield').shieldHits,4);assert.equal(u.stats.attacks,0);near(u.skill.spTotal,0);
});
test('all S2 ranks preserve actual two-to-four shield layer count independently of the duration table',()=>{
  for(let rank=1;rank<=10;rank++){
    const{deploy}=make({skill:1,rank}),u=deploy();const bb=u.skill.bb;
    assert.equal(u.findBuff('radiant-knight:s2-shield').shieldHits,bb.times);near(u.skill.timeLeft,u.def.skill.duration);
  }
});
test('S2 shields consume one actual physical/Arts/True ordinary hit while direct HP loss/gauge bypass',()=>{
  const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);const hp=u.hp;
  for(const type of['phys','arts','true']){b.dealDamage(e,u,{amount:100,type});near(u.hp,hp);}
  assert.equal(u.findBuff('radiant-knight:s2-shield').shieldHits,1);
  b.loseHp(u,10,{source:e});near(u.hp,hp-10);b.dealDamage(e,u,{amount:50,type:'element',element:'burn'});
  assert.equal(u.findBuff('radiant-knight:s2-shield').shieldHits,1);
  b.dealDamage(e,u,{amount:100,type:'true'});near(u.hp,hp-10);assert.equal(u.findBuff('radiant-knight:s2-shield'),null);
  b.dealDamage(e,u,{amount:100,type:'true'});near(u.hp,hp-110);
});
test('shield layer is not consumed by rejected invulnerability or a completely dodged source hit',()=>{
  for(const kind of['invuln','dodge']){
    const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);
    b.addBuff(u,{key:'external',...(kind==='invuln'?{flags:{invulnerable:true}}:{mods:{dodgePhys:1}})});
    b.dealDamage(e,u,{amount:100,type:'phys'});assert.equal(u.findBuff('radiant-knight:s2-shield').shieldHits,4);
  }
});
test('S2 auto completion refunds actual paid half cost and multiplies final cooldown once',()=>{
  const{b,deploy}=make({skill:1}),u=deploy();const paid=b.bench[ID].lastCost;
  b.addBuff(u,{key:'external',persist:true,mods:{redeployMul:.8}});b.getPlayer('arkpedia').dp=0;
  advance(b,27+b.dt);assert.equal(u.alive,false);near(b.dp,Math.floor(paid/2));
  near(b.bench[ID].readyAt-u.deathAt,u.base.respawnTime*.8*1.25);
});
test('S2 prior Kaz removes penalty, later deployment cannot change captured branch',()=>{
  const{b,deploy}=make({skill:1},[KAZ,OTHER]);deploy(KAZ,1,1);const u=deploy();deploy(OTHER,1,2);
  assert.equal(u.mem.radiantKnightS2Kaz,true);advance(b,27+b.dt);near(b.bench[ID].readyAt-u.deathAt,u.base.respawnTime);
});
test('S2 early manual withdrawal and actual death apply no chosen auto-duration penalty or double refund',()=>{
  for(const kind of['manual','death']){
    const{b,deploy}=make({skill:1}),u=deploy(),paid=b.bench[ID].lastCost;b.getPlayer('arkpedia').dp=0;
    if(kind==='manual')b.retreatOperator(ID);else b.kill(u);
    near(b.bench[ID].readyAt-b.time,u.base.respawnTime);near(b.dp,kind==='manual'?Math.floor(paid/2):0);
    advance(b,28);near(b.dp,kind==='manual'?Math.floor(paid/2):0);
  }
});
test('S2 multiplier is consumed by next spawn and never accumulates across fresh deployments',()=>{
  const{b,deploy}=make({skill:1},[OTHER]);let u=deploy();advance(b,27+b.dt);
  b.bench[ID].readyAt=b.time;deploy(OTHER,1,1);u=deploy();near(u.s.redeployMul,1);advance(b,27+b.dt);
  near(b.bench[ID].readyAt-u.deathAt,u.base.respawnTime*1.25);
});
test('S3 creates exactly one free adjacent ground Sun with original zero-slot defenses and no normal attack',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();forceSun(b);cast(u);const t=u.mem.radiantKnightSun;
  assert.equal(t.defId,SUN);assert.equal(t.ownerUnit,u);assert.equal(t.deploymentSlotCost,0);near(t.s.maxHp,6000);
  near(t.s.def,600);near(t.s.res,20);near(t.s.blockCnt,2);assert.equal(b.deployedSlots(),1);
  advance(b,3);assert.equal(t.stats.attacks,0);
});
test('Sun defense interpolation ignores owner trust/potential and inherits only selected source promotion/level',()=>{
  for(const potential of[1,6]){
    const{b,deploy}=make({skill:2,level:45,trust:200,potential}),u=deploy();cast(u);const t=u.mem.radiantKnightSun;
    near(t.s.maxHp,6000);near(t.s.def,Math.round(540+60*(44/89)));near(t.s.res,20);near(t.base.atk,10);
  }
});
test('Sun actual HealFree blocks ordinary healing and both HP/SP regeneration',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();cast(u);const t=u.mem.radiantKnightSun;
  b.loseHp(t,1000);const hp=t.hp;assert.equal(b.heal(u,t,1000),0);
  b.addBuff(t,{key:'external',mods:{hpRegen:100,spRecoveryFlat:100}});advance(b,2);near(t.hp,hp);near(t.s.hpRegen,0);near(t.s.spRecovery,0);
});
test('Sun exact Start .333 delays its ground birth burst and uses current skill owner ATK twice for prior Nearl',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();forceSun(b);const e=enemy(b,{c:6});cast(u);const t=u.mem.radiantKnightSun;
  advance(b,.3);near(e.hp,100000);b.addBuff(u,{key:'external',mods:{atkPct:.2}});const atk=u.s.atk;
  advance(b,.1);near(100000-e.hp,2*atk*1.1);assert.equal(hits(b,e,'radiant-knight:birth').length,2);
  assert.equal(hits(b,e)[0].source,t);assert.equal(Boolean(e.s.flags.stun),true);
});
test('Sun birth-phase operator history honors an intervening non-Kaz operator but not a token/device',()=>{
  for(const kind of['operator','device']){
    const{b,deploy}=make({skill:2},[OTHER]),u=deploy();forceSun(b);const e=enemy(b,{c:6});cast(u);
    if(kind==='operator')deploy(OTHER,1,1);else b.spawnDevice('test',1,1,{blockCnt:0});
    advance(b,.5);near(100000-e.hp,(kind==='operator'?1:2)*u.s.atk*1.1);
  }
});
test('S3 no legal ground summon tile produces no fallback explosion or extra token',()=>{
  const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);forbidSun(b,u);cast(u);advance(b,.5);
  assert.equal(u.mem.radiantKnightSun,undefined);near(e.hp,100000);assert.equal(u.skill.active,true);
});
test('S3 actual range expands and emits source Skill3 .5 clip for ground one-target attack',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();forbidSun(b,u);cast(u);const e=enemy(b,{c:6}),air=enemy(b,{fly:true,c:6});
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);assert.equal(event(b,u).animation,'Skill_3');near(event(b,u).windup,.5);
  advance(b,.65);near(100000-e.hp,u.s.atk);near(air.hp,100000);assert.equal(hits(b,e)[0].dmg.type,'phys');
});
test('S3 damage converts only own blocker or exact own living Sun, never another ally or another owner token',()=>{
  for(const blocker of['self','sun','ally','foreign-token','unblocked']){
    const{b,deploy}=make({skill:2},[OTHER]),u=deploy(),a=deploy(OTHER,1,1);cast(u);advance(b,.4);const t=u.mem.radiantKnightSun,e=enemy(b,{def:500,c:6});
    const foreign=b.spawnDevice('foreign',1,2,{blockCnt:0});
    e.blockedBy=blocker==='self'?u:blocker==='sun'?t:blocker==='ally'?a:blocker==='foreign-token'?foreign:null;
    // Test the source blocker predicate at the actual damage callback. Natural
    // blocking/retargeting and .5 release are independently covered above.
    const p=effectiveProfile(u);p.launchAttack(b,u,p,e,{attackId:1,isSkill:true});
    const pure=blocker==='self'||blocker==='sun';near(100000-e.hp,pure?u.s.atk:u.s.atk-500*.8);
    assert.equal(hits(b,e)[0].dmg.type,pure?'true':'phys');
  }
});
test('S3 sub-tick accepted control cancels unborn ordinary hit, while rejected immunity retains it',()=>{
  for(const immune of[false,true]){
    const{b,deploy}=make({skill:2}),u=deploy();forbidSun(b,u);cast(u);const e=enemy(b);
    u.def={...u.def,immune:new Set(u.def.immune)};if(immune)u.def.immune.add('stun');
    shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);near(100000-e.hp,immune?u.s.atk:0);
  }
});
test('Sun death before its birth phase cancels burst; skill finish/owner withdrawal removes only own Sun',()=>{
  for(const kind of['sun-death','skill','owner']){
    const{b,deploy}=make({skill:2}),u=deploy();forceSun(b);const e=enemy(b,{c:6});cast(u);const t=u.mem.radiantKnightSun;
    const foreign=b.spawnDevice('foreign',1,1,{blockCnt:0});
    if(kind==='sun-death')b.kill(t);else if(kind==='skill')u.skill.end('manual');else b.retreatOperator(ID);
    advance(b,.5);near(e.hp,100000);assert.equal(t.alive,false);assert.equal(foreign.alive,true);
  }
});
test('S3 complete duration restores original ATK/DEF/range, clears form and retires the Sun',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();cast(u);const t=u.mem.radiantKnightSun;advance(b,25+b.dt);
  near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);assert.equal(t.alive,false);assert.equal(u.mem.regularFormVisual,null);
  assert.equal(u.skill.active,false);assert.deepEqual(u.rangeKeys,u.baseRangeKeys);
});
test('CAST release reacquires legal current victim and does not double an expired or hidden startup target',()=>{
  const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});shot(b,u,e);e.hidden=true;move(b,z,3,5);
  advance(b,.7);near(e.hp,100000);near(100000-z.hp,u.s.atk);assert.equal(hits(b,z).length,1);
});
test('ordinary disengagement finishes End and next engagement replays first-only Begin',()=>{
  const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);advance(b,.7);move(b,e,1,8);advance(b,1.1);
  assert.equal(u.mem.radiantKnightOpening,true);move(b,e,3,5);shot(b,u,e);assert.equal(event(b,u).animation.begin,'Attack_Begin');assert.equal(u.mem.regularFormVisual,null);advance(b,.7);
  near(100000-e.hp,2*u.s.atk);
});

test('Sun hidden birth skill rejects current action-stopping control at its mapped Start phase',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();forceSun(b);const e=enemy(b,{c:6});cast(u);const t=u.mem.radiantKnightSun;
  b.applyStatus(t,'stun',{duration:1});advance(b,.5);near(e.hp,100000);advance(b,1);near(e.hp,100000);
});

test('natural S3 release reads the actual engine blocker Unit and converts its one ordinary hit to True',()=>{
  const{b,deploy}=make({skill:2}),u=deploy();forbidSun(b,u);cast(u);const e=enemy(b,{c:4,def:10000});u.atkCd=0;
  advance(b,.7);assert.equal(e.blockedBy,u);assert.equal(hits(b,e).length,1);assert.equal(hits(b,e)[0].dmg.type,'true');near(100000-e.hp,u.s.atk);
});
