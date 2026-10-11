// SPDX-License-Identifier: GPL-3.0-or-later
// Full selected-loadout and regular-stage transactions on the original 0-1 map.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-rosmontis-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor,catalogueFor} from '../shared/arkpedia/loadout.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {regularSummonCards} from '../server/sim/content/arkpedia-summons.js';
import {regularTokenIdsFor} from '../shared/arkpedia/summons.js';
import {selectedRosmontisBuild} from '../server/sim/content/arkpedia-rosmontis-attacks.js';
const ID='char_391_rosmon',TOKEN='token_10012_rosmon_shield';
const flat=rows=>Object.fromEntries(rows.map(v=>[v.key,v.value]));
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const advance=(b,s)=>{for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,level,deploy=true,companions=[]}={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  const op=d.operators[ID],build={...defaultBuild(op),elite,level:level??op.phases[elite].maxLevel,potential,trust,
    skillId:`skchr_rosmon_${skill}`,skillRank:rank};
  const b=new StandardBattle(d,{operators:[build,...companions.map(id=>defaultBuild(d.operators[id]))]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const u=deploy?b.deployOperator(ID,1,1,'RIGHT'):null,hits=[],attacks=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  return {b,u,build,hits,attacks,controller:u?.mem.rosmontisController};
}
function enemy(f,{row=2,col=2,def=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});t.def={...t.def,immune:new Set(t.def.immune)};
  Object.assign(t.base,{maxHp:1e7,atk:0,def,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;
  f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});f.b._buildEnemyIndex();return t;
}
const activate=f=>{f.u.skill.addCharge(1);assert.equal(f.b.activateOperator(ID),true);};

test('public Rosmontis selects all thirty source ranks with one controller and original owner/equipment art',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'rosmontis');assert.deepEqual(source.enabledOperators,[ID]);
  assert.deepEqual(source.heldOperators,[]);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
  assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.equal(data.tokens[TOKEN].automaticOnly,true);
  assert.equal(data.tokens[TOKEN].avatar,null);
  for(const face of ['front','back']){
    const own=data.sd.models[`operator/${ID}/default/${face}`],token=data.sd.models[`operator/${TOKEN}/default/${face}`];
    assert.equal(own.skeleton.sha256,source.models[ID][face==='front'?'Front':'Back'].sha256);
    assert.equal(token.skeleton.sha256,source.tokenModels[TOKEN][face].sha256);
    assert.equal(token.source.bundle.sha256,source.tokenArtwork.sourceBundle.sha256);assert.equal(token.avatar,undefined);
    assert.equal(token.animationRoles.attack,null);assert.equal(token.animationRoles.deploy,'Start');
  }
  for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++){
    const f=make({skill,rank}),s=source.tables.skills[f.build.skillId].levels[rank-1];
    assert.deepEqual(f.u.def.skill.bb,flat(s.blackboard));assert.equal(f.controller.record.index,skill-1);
    assert.equal(f.u.skill.kind,skill===1?'instant':'duration');assert.equal(f.u.skill.manual,skill!==1);
    assert.equal(f.u.mem.rosmontisAttackController,f.controller);assert.equal(f.u.kit.install,null);
    assert.equal(f.u.profile.install,null);assert.deepEqual(f.u.kit.talents,[]);
  }
});
test('public level, trust and potential stats match exact selected source without generic talent bonuses',()=>{
  for(const elite of [0,1,2])for(const potential of [1,5,6])for(const trust of [0,57,100,200]){
    const f=make({elite,potential,trust,rank:[4,7,10][elite]}),r=selectedRosmontisBuild(f.build);
    for(const key of ['maxHp','atk','def'])near(f.u.s[key],r.stats[key]);near(f.u.s.defIgnoreFlat,r.penetration);
    assert.deepEqual(f.u.def.raw.arkpedia.modifiers,{});assert.equal(f.u.def.raw.arkpedia.critical,undefined);
    near(f.b.cost(ID),Math.floor(r.stats.cost*1.5));near(f.u.base.respawnTime,r.stats.respawnTime);
  }
  for(const level of [1,44]){
    const f=make({level,trust:37,potential:6}),r=selectedRosmontisBuild(f.build);near(f.u.s.atk,r.stats.atk);
  }
});
test('public skill unlock, mastery and module gates reject invalid builds before deployment',()=>{
  const f=make({deploy:false}),catalogue=catalogueFor(data)[ID];assert.deepEqual(catalogue.modules,[]);
  assert.deepEqual(catalogue.skills.map(s=>s.unlockElite),[0,1,2]);
  for(const build of [{...f.build,elite:0,level:50,skillRank:4,skillId:'skchr_rosmon_2'},
    {...f.build,elite:1,level:80,skillRank:7,skillId:'skchr_rosmon_3'},
    {...f.build,elite:1,level:80,skillRank:10},{...f.build,level:91},
    {...f.build,module:{id:'unreviewed',stage:3}}])assert.throws(()=>recordFor(build,data));
});
test('public deployment preserves fullscreen, high ground, facing, DP and slot transactions',()=>{
  const f=make({deploy:false}),dp=f.b.dp,cost=f.b.cost(ID);f.b.setViewport('preview');
  assert.throws(()=>f.b.deployOperator(ID,1,1,'RIGHT'),/fullscreen/);f.b.setViewport('fullscreen-workspace');
  assert.throws(()=>f.b.deployOperator(ID,1,1,'invalid'),/facing/);
  assert.throws(()=>f.b.deployOperator(ID,2,2,'RIGHT'),/ranged tile/);near(f.b.dp,dp);assert.equal(f.b.deployedSlots(),0);
  const u=f.b.deployOperator(ID,1,1,'LEFT');near(f.b.dp,dp-cost);assert.equal(f.b.deployedSlots(),1);assert.equal(u.dir,'LEFT');
  assert.throws(()=>f.b.deployOperator(ID,1,1,'RIGHT'),/unavailable/);near(f.b.dp,dp-cost);
});
test('public S1 is automatic offensive SP and adds Arts only to its main splash',()=>{
  const f=make(),a=enemy(f);f.u.skill.addCharge(1);assert.equal(f.b.activateOperator(ID),false);
  until(f,()=>f.hits.length===3);assert.equal(f.attacks.length,1);near(f.hits[0].amount,688);
  near(f.hits[1].amount,1238.4);near(f.hits[2].amount,344);assert.equal(f.hits[0].target,a);
  assert.equal(f.u.skill.manual,false);assert.equal(skillHud(f.u.skill).canActivate,false);near(f.u.skill.sp,0);
});
test('public S2 readiness/activation exposes ordinary SP and four separately delayed projectiles',()=>{
  const f=make({skill:2});enemy(f);assert.match(skillHud(f.u.skill).text,/20 \/ 30 SP/);activate(f);
  assert.equal(skillHud(f.u.skill).state,'active');near(f.u.s.atk,1066.4);near(f.u.s.interval,3.15);
  until(f,()=>f.hits.length===4);assert.equal(f.attacks.length,1);near(f.hits[0].amount,1066.4);
  for(const h of f.hits.slice(1))near(h.amount,533.2);
});
test('public S3 spawns original automatic equipment with no DP, deck or slot charge',()=>{
  const f=make({skill:3}),a=enemy(f);a.def.immune.add('stun');const dp=f.b.dp,slots=f.b.deployedSlots();activate(f);
  const pool=f.controller.equipment,tokens=[...pool.tokens.keys()];assert.equal(tokens.length,2);
  for(const t of tokens){assert.equal(t.defId,TOKEN);assert.equal(t.deploymentSlotCost,0);assert.equal(t.dir,'RIGHT');near(t.s.maxHp,5000);}
  near(f.b.dp,dp);assert.equal(f.b.deployedSlots(),slots);assert.equal(f.b.bench[TOKEN],undefined);
  assert.equal(regularSummonCards(f.b).some(x=>x.record.id===TOKEN),false);
  until(f,()=>a.blockedBy&&f.hits.length>=2);assert.ok(tokens.includes(a.blockedBy));near(a.s.def,0);
  near(f.hits[0].amount,1204);near(f.hits[1].amount,602);assert.equal(f.attacks.length,1);
});
test('public S3 activation with no legal tile still buffs and attacks another operators blockee',()=>{
  const f=make({skill:3,companions:['char_208_melan']});const guard=f.b.deployOperator('char_208_melan',2,2,'RIGHT');
  const a=enemy(f);f.b.grid.tiles=f.b.grid.tiles.map(t=>({...t,build:t.build==='MELEE'?'NONE':t.build}));activate(f);
  assert.equal(f.controller.equipment.tokens.size,0);near(f.u.s.atk,1204);until(f,()=>f.hits.length>=2);
  assert.equal(a.blockedBy,guard);
});
test('public equipment death and owner retreat clean claims without inherited normal aftershocks',()=>{
  const f=make({skill:3}),a=enemy(f,{def:500});a.def.immune.add('stun');activate(f);
  until(f,()=>a.blockedBy&&f.hits.length>=2);near(a.s.def,340);const t=a.blockedBy;f.b.kill(t);
  near(a.s.def,500);assert.equal(f.controller.equipment.tokens.size,1);f.b.retreatOperator(ID);
  assert.equal(f.controller.equipment.tokens.size,0);assert.equal(f.controller.equipment.claims.size,0);
  assert.equal(f.controller.handles.length,0);assert.equal(f.u.skill.active,false);
});
test('public Caster aura is conditional, source-owned and removed with the owner',()=>{
  const f=make({companions:['char_002_amiya']}),caster=f.b.deployOperator('char_002_amiya',1,3,'RIGHT'),base=caster.base.atk;
  near(f.u.s.atk,688*1.08);near(caster.s.atk,base*1.08);f.b.retreatOperator(ID);near(caster.s.atk,base);
  assert.equal(f.controller.aura.claims.size,0);
});
test('public redeployment creates a fresh controller without old equipment, mode, SP or output',()=>{
  const f=make({skill:3});enemy(f);activate(f);const old=f.u,oldController=f.controller;f.b.retreatOperator(ID);
  assert.equal(oldController.equipment.tokens.size,0);advance(f.b,old.base.respawnTime+.1);f.b.addDp('arkpedia',99);
  const fresh=f.b.deployOperator(ID,1,1,'RIGHT');assert.notEqual(fresh.id,old.id);assert.notEqual(fresh.mem.rosmontisController,oldController);
  assert.equal(fresh.skill.active,false);near(fresh.skill.sp,35);assert.equal(fresh.mem.rosmontisController.equipment.tokens.size,0);
  assert.equal(fresh.mem.regularFormVisual.clip,'Start');assert.equal(oldController.outputs.size,0);
});
test('public battle finish ends active mode and equipment, clears claims and cancels born output',()=>{
  const f=make({skill:3});enemy(f);activate(f);f.b._finish('fixture');assert.equal(f.u.skill.active,false);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.controller.equipment.tokens.size,0);
  assert.equal(f.controller.finishHook,null);assert.equal(f.controller.handles.length,0);
});
