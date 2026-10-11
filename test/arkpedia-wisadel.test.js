// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds and transactions on the original 0-1 map.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor,catalogueFor} from '../shared/arkpedia/loadout.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {regularSummonCards} from '../server/sim/content/arkpedia-summons.js';
import {regularTokenIdsFor} from '../shared/arkpedia/summons.js';
import {selectedWisadelBuild} from '../server/sim/content/arkpedia-wisadel-attacks.js';
import {WISADEL_AFTERIMAGE as MARK} from '../server/sim/content/arkpedia-wisadel-projectiles.js';
const ID='char_1035_wisdel',TOKEN='token_10035_wisdel_wward';
const flat=rows=>Object.fromEntries(rows.map(v=>[v.key,v.value]));
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const advance=(b,s)=>{for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,level,deploy=true,dir='RIGHT'}={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  const op=d.operators[ID],build={...defaultBuild(op),elite,level:level??op.phases[elite].maxLevel,potential,trust,
    skillId:`skchr_wisdel_${skill}`,skillRank:rank};
  const b=new StandardBattle(d,{operators:[build]});b.rng=()=>.99;
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const u=deploy?b.deployOperator(ID,1,1,dir):null,hits=[],attacks=[],births=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  return {b,u,build,hits,attacks,births,controller:u?.mem.wisadelController};
}
function enemy(f,{row=2,col=2,fly=false}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return t;
}
const activate=f=>{f.u.skill.addCharge(1);assert.equal(f.b.activateOperator(ID),true);};
const tokens=f=>[...f.controller.shadows.tokens.keys()];

test('public Wisadel selects all thirty ranks with one controller, paired Shadows and original artwork',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'wisadel');assert.deepEqual(source.enabledOperators,[ID]);
  assert.deepEqual(source.heldOperators,[]);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
  assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.equal(data.tokens[TOKEN].automaticOnly,true);
  assert.equal(data.tokens[TOKEN].avatar,null);
  for(const face of ['front','back']){
    const own=data.sd.models[`operator/${ID}/default/${face}`],token=data.sd.models[`operator/${TOKEN}/default/${face}`];
    assert.equal(own.skeleton.sha256,source.models[ID][face==='front'?'Front':'Back'].sha256);
    assert.equal(token.skeleton.sha256,source.tokenModels[TOKEN][face].sha256);
    assert.equal(token.source.bundle.sha256,source.tokenArtwork.sourceBundle.sha256);
    assert.equal(token.animationRoles.attack,'Attack');assert.equal(token.animationRoles.deploy,'Start');
  }
  for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++){
    const f=make({skill,rank}),s=source.tables.skills[f.build.skillId].levels[rank-1];
    assert.deepEqual(f.u.def.skill.bb,flat(s.blackboard));assert.equal(f.controller.record.index,skill-1);
    assert.equal(f.u.skill.kind,['instant','duration','ammo'][skill-1]);assert.equal(f.u.skill.manual,skill!==1);
    assert.equal(f.u.mem.wisadelAttackController,f.controller);assert.equal(f.u.mem.wisadelShadows,f.controller.shadows);
    assert.equal(f.u.kit.install,null);assert.equal(f.u.profile.install,null);assert.deepEqual(f.u.kit.talents,[]);
    assert.equal(tokens(f).length,1);assert.equal(f.controller.shadows.handles.length,4);
  }
});
test('public promotion, level, trust and potential match selected source with no fabricated E0/E1 Shadow',()=>{
  for(const elite of [0,1,2])for(const potential of [1,5,6])for(const trust of [0,57,100,200]){
    const f=make({elite,potential,trust,rank:[4,7,10][elite]}),r=selectedWisadelBuild(f.build);
    for(const key of ['maxHp','atk','def'])near(f.u.s[key],r.stats[key]);
    assert.deepEqual(f.u.def.raw.arkpedia.modifiers,{});assert.equal(f.u.def.raw.arkpedia.critical,undefined);
    near(f.b.cost(ID),Math.floor(r.stats.cost*1.5));near(f.u.base.respawnTime,r.stats.respawnTime);
    assert.equal(tokens(f).length,elite===2?1:0);
  }
  const f=make({level:44,trust:37,potential:6}),r=selectedWisadelBuild(f.build);near(f.u.s.atk,r.stats.atk);
});
test('public skill unlock, mastery and module gates reject invalid builds before any deployment',()=>{
  const f=make({deploy:false}),catalogue=catalogueFor(data)[ID];assert.deepEqual(catalogue.modules,[]);
  assert.deepEqual(catalogue.skills.map(s=>s.unlockElite),[0,1,2]);
  for(const build of [{...f.build,elite:0,level:50,skillRank:4,skillId:'skchr_wisdel_2'},
    {...f.build,elite:1,level:80,skillRank:7,skillId:'skchr_wisdel_3'},
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
test('public automatic Shadow costs no DP, deck or deployment slot and retains the original deck flag as source data',()=>{
  const f=make(),[t]=tokens(f);assert.equal(t.defId,TOKEN);assert.equal(t.deploymentSlotCost,0);
  assert.equal(f.b.deployedSlots(),1);near(t.s.maxHp,3500);near(t.s.atk,777);near(t.s.def,650);near(t.s.res,50);
  assert.equal(f.b.bench[TOKEN],undefined);assert.equal(regularSummonCards(f.b).some(x=>x.record.id===TOKEN),false);
  assert.equal(t.kit.trait.noAttack,true);assert.equal(t.s.flags.noHeal,true);
  const root=source.tokens[TOKEN].flatMap(r=>r.components).find(c=>c.pathId==='7531983340995195566');
  assert.equal(root.data._notShowInDeck,0);
});
test('public S1 stays automatic offensive SP, emits three separate aftershocks and has no inherited duplicate attack',()=>{
  const f=make(),a=enemy(f);f.u.skill.addCharge(1);assert.equal(f.b.activateOperator(ID),false);
  until(f,()=>f.hits.length===4);assert.equal(f.attacks.length,1);assert.equal(f.births.length,1);
  near(f.hits[0].amount,687*1.15);for(const h of f.hits.slice(1))near(h.amount,687*1.15*1.2);
  assert.equal(f.hits[0].target,a);assert.equal(skillHud(f.u.skill).canActivate,false);near(f.u.skill.sp,0);
});
test('public S2 readiness, both phase gauges and cancellation retain the paired Shadow',()=>{
  const f=make({skill:2}),[t]=tokens(f);enemy(f);assert.match(skillHud(f.u.skill).text,/15 \/ 25 SP/);activate(f);
  assert.equal(skillHud(f.u.skill).canCancel,true);near(f.u.s.atk,687*1.35);
  until(f,()=>f.hits.length>=2);assert.equal(f.attacks.length,1);assert.equal(f.births.length,1);
  advance(f.b,25-f.b.time+.1);assert.equal(f.controller.mode,2);assert.equal(skillHud(f.u.skill).state,'overloaded');
  assert.equal(tokens(f)[0],t);f.u.skill.end('manual');assert.equal(f.controller.mode,0);
  assert.equal(tokens(f)[0],t);assert.equal(f.u.skill.active,false);
});
test('public S3 spawn transaction grants only the first new Shadow SP and exposes six-round HUD',()=>{
  const f=make({skill:3}),old=tokens(f)[0],dp=f.b.dp;activate(f);const [gifted,other]=tokens(f).filter(t=>t!==old);
  assert.equal(tokens(f).length,3);near(gifted.skill.sp,3);near(other.skill.sp,0);near(old.skill.sp,0);
  near(f.b.dp,dp);assert.equal(f.b.deployedSlots(),1);assert.equal(skillHud(f.u.skill).text,'6 ammo remaining');
  assert.equal(skillHud(f.u.skill).canCancel,true);
});
test('public S3 hits airborne targets with cached main, independent aftershock and live talent explosion',()=>{
  const f=make({skill:3}),a=enemy(f,{fly:true});activate(f);until(f,()=>f.hits.length===3);
  near(f.hits[0].amount,687*2.8*2.2*1.15);near(f.hits[1].amount,687*2.8*2.2*1.15*.5);
  near(f.hits[2].amount,687*2.8*1.5);assert.equal(a.findBuff(MARK),null);
  assert.equal(f.u.skill.ammoLeft,5);assert.equal(f.attacks.length,1);assert.equal(skillHud(f.u.skill).text,'5 ammo remaining');
});
test('public Shadow automatically casts Arts/Slow without an ordinary attack and uses its own SP gauge',()=>{
  const f=make(),a=enemy(f),[t]=tokens(f),hits=[],attacks=[];
  f.b.on('damaged',ctx=>{if(ctx.source===t)hits.push(ctx);});f.b.on('attack',ctx=>{if(ctx.attacker===t)attacks.push(ctx);});
  assert.equal(skillHud(t.skill).canActivate,false);assert.match(skillHud(t.skill).text,/0 \/ 5 SP/);
  until(f,()=>hits.length===1,8);near(hits[0].amount,777);assert.equal(hits[0].dmg.type,'arts');
  assert.ok(a.findBuff('sluggish'));assert.equal(attacks.length,0);assert.ok(t.skill.sp>=0&&t.skill.sp<3.5);
});
test('public S3 empty placement still activates and neither refills existing Shadows nor invents a token',()=>{
  const f=make({skill:3}),old=tokens(f)[0];old.skill.gainSp(1);const dp=f.b.dp;
  f.b.grid.tiles=f.b.grid.tiles.map(tile=>({...tile,build:'NONE'}));activate(f);
  assert.deepEqual(tokens(f),[old]);near(old.skill.sp,1);near(f.b.dp,dp);assert.equal(f.u.skill.ammoLeft,6);
});
test('public Shadow death and owner retreat clean Camouflage, derived marks and every manager hook',()=>{
  const f=make({skill:3}),a=enemy(f);activate(f);until(f,()=>f.hits.length>=1);
  assert.ok(a.findBuff(MARK));f.b.kill(tokens(f)[0]);assert.equal(tokens(f).length,2);
  f.b.retreatOperator(ID);assert.equal(tokens(f).length,0);assert.equal(f.u.s.flags.camou||false,false);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.u.skill.active,false);assert.equal(f.controller.handles.length,0);
  until(f,()=>f.controller.projectiles.outputs.size===0&&f.controller.shadows.outputs.size===0);
  assert.equal(f.controller.shadows.handles.length,0);assert.equal(f.controller.projectiles.handles.length,0);
});
test('public redeployment creates a fresh controller, one fresh Shadow and source initial SP',()=>{
  for(const skill of [1,2,3]){
    const f=make({skill}),old=f.u,controller=f.controller;if(skill!==1)activate(f);f.b.retreatOperator(ID);
    assert.equal(controller.shadows.tokens.size,0);advance(f.b,old.base.respawnTime+.1);f.b.addDp('arkpedia',99);
    const fresh=f.b.deployOperator(ID,1,1,'RIGHT');assert.notEqual(fresh.id,old.id);assert.notEqual(fresh.mem.wisadelController,controller);
    assert.equal(fresh.skill.active,false);near(fresh.skill.sp,source.tables.skills[f.build.skillId].levels[9].spData.initSp);
    assert.equal(fresh.mem.wisadelShadows.tokens.size,1);assert.equal(fresh.mem.regularFormVisual.clip,'Start');
    assert.equal(controller.shadows.outputs.size,0);assert.equal(controller.projectiles.outputs.size,0);
  }
});
test('public battle finish clears all three selected skill modes, Shadows, marks and born outputs',()=>{
  for(const skill of [1,2,3]){
    const f=make({skill});enemy(f);if(skill!==1)activate(f);until(f,()=>f.births.length===1);
    f.b._finish('fixture');assert.equal(f.u.skill.active,false);assert.equal(tokens(f).length,0);
    assert.equal(f.controller.projectiles.outputs.size,0);assert.equal(f.controller.projectiles.marks.size,0);
    assert.equal(f.controller.handles.length,0);assert.equal(f.controller.shadows.handles.length,0);
  }
});
