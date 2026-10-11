// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-wisadel-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { WISADEL_ID as ID, selectedWisadelBuild } from '../server/sim/content/arkpedia-wisadel-attacks.js';
import { WISADEL_S3_CONTRACT as CONTRACT,prepareWisadelS3,WISADEL_S3_TARGET,WISADEL_S3_TOKEN_MARK } from '../server/sim/content/arkpedia-wisadel-s3.js';
import { WISADEL_AFTERIMAGE as MARK } from '../server/sim/content/arkpedia-wisadel-projectiles.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function until(f,p,s=12) { const end=f.b.time+s; while(!p()&&f.b.time<end) advance(f.b,f.b.dt);
  assert.ok(p(),`Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`); }
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=3,dir='RIGHT',defer=false,battle=null,contract=CONTRACT,disableShadowAttacks=true}={}) {
  const d=structuredClone(data); d.stage.geometry.waves[0].spawns=[]; d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19; d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=battle??new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
  b.rng=()=>.99; b.autoFinish=false; b.recordEvents=true; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const build={elite,level,potential,trust,skillId:`skchr_wisdel_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedWisadelBuild(build), c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,
    subProfessionId:c.subProfessionId,position:c.position,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
  const prepared=prepareWisadelS3(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[],impacts=[],explosions=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('wisadelProjectileImpact',ctx=>{if(ctx.owner===u)impacts.push({...ctx,time:b.time});});
  b.on('wisadelAfterimageExplosion',ctx=>{if(ctx.owner===u)explosions.push({...ctx,time:b.time});});
  b.on('wisadelShadowSpawn',ctx=>{if(disableShadowAttacks&&ctx.owner===u)b.addBuff(ctx.token,{key:'fixture:no-shadow-attacks',flags:{disarm:true}});});
  if(!defer)deploy(); return {b,u,build,deploy,hits,attacks,births,impacts,explosions,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:500,def,res,moveSpeed:0,tauntLevel:taunt}); t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY'; f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
const ready=f=>f.u.skill.addCharge(1);

const activate=f=>{ready(f);assert.equal(f.u.skill.activate('fixture'),true);};
const shots=f=>f.births.filter(v=>v.command.mode==='s3');
const receipts=f=>f.hits.filter(v=>v.dmg?.isSkill&&!v.dmg.tags?.includes('afterimage'));
const tokens=f=>[...f.shadows.tokens.keys()];
const noTerrain=f=>{for(const t of f.b.grid.tiles)t.build='NONE';};
test('S3 requires the exact fresh selected source and contract under the public factory',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'wisadel');assert.ok(data.operators[ID]);
  assert.equal(CONTRACT.frameParity,false);assert.deepEqual(e.enabledOperators,[ID]);
  assert.throws(()=>make({skill:1}),/Incomplete/);assert.throws(()=>make({skill:2}),/Incomplete/);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  const f=make({defer:true});
  for(const mutate of [d=>d.stats.atk++,d=>{d.rangeGrid=[];},d=>d.skill.spCost++,d=>d.skill.initSp++,
    d=>d.skill.duration++,d=>{d.skill.spType='attack';},d=>{d.skill.skillType='AUTO';},
    d=>d.skill.bb.atk++,d=>d.skill.bb.base_attack_time++,d=>d.skill.bb['attack@atk_scale_3']++,
    d=>d.skill.bb['attack@trigger_time']++,d=>{d.raw.arkpedia.module='wisdel-x';}]){
    const def=structuredClone(f.u.def);mutate(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    const hooks=Object.values(f.b._hooks).flat().length;
    assert.throws(()=>prepareWisadelS3(f.b,u,{contract:CONTRACT}));assert.equal(Object.values(f.b._hooks).flat().length,hooks);
  }
});
test('all ten ranks retain six rounds, manual time SP, source ATK/BAT, cached scaled main and half shock',()=>{
  const atk=[.95,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8],scale=[1.6,1.65,1.7,1.75,1.8,1.85,1.9,2,2.1,2.2];
  const cost=[70,68,66,64,62,60,58,55,53,50],initial=[25,25,25,30,30,30,35,36,38,40];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});enemy(f);near(f.u.skill.sp,initial[rank-1]);assert.equal(f.u.skill.manual,true);activate(f);
    near(f.u.s.atk,687*(1+atk[rank-1]));near(f.u.s.bat,5);near(f.u.s.interval,5);
    assert.equal(f.u.skill.ammoLeft,6);assert.equal(f.u.skill.ammoMax,6);assert.equal(f.u.skill.spCost,cost[rank-1]);
    until(f,()=>receipts(f).length===2);const amount=687*(1+atk[rank-1])*scale[rank-1]*1.15;
    near(receipts(f)[0].amount,amount);near(receipts(f)[1].amount,amount*.5);assert.equal(f.u.skill.ammoLeft,5);
    assert.equal(f.attacks.length,1);assert.equal(f.explosions.length,1);assert.equal(shots(f).length,1);
  }
});
test('all four facings retain original entrance, Begin and OnAttack clocks before homing receipts',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];enemy(f,{row,col});activate(f);
    assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Begin');
    until(f,()=>shots(f).length===1);const m=e.models[ID][['UP','LEFT'].includes(dir)?'Back':'Front'];
    const start=Math.max(m.durations.Start,m.durations.Skill_3_Begin);
    const event=m.eventPayloads.Skill_3_Loop.find(v=>v.name==='OnAttack').time;
    assert.ok(shots(f)[0].time>=start+event-f.b.dt);assert.ok(shots(f)[0].time<=start+event+2*f.b.dt);
    assert.equal(f.hits.length,0);until(f,()=>receipts(f).length===2);
    near(receipts(f)[1].time-receipts(f)[0].time,.15,f.b.dt);
  }
});
test('S3 accepts airborne trace and main/shock collateral without changing ordinary ground-only targeting',()=>{
  const f=make(),air=enemy(f,{fly:true}),a=enemy(f,{col:7}),farAir=enemy(f,{col:8,fly:true});activate(f);
  until(f,()=>receipts(f).length===6);assert.equal(shots(f)[0].command.target,air);
  assert.deepEqual(receipts(f).map(v=>v.target),[air,a,farAir,air,a,farAir]);
  const z=make();enemy(z,{fly:true});advance(z.b,4);assert.equal(z.births.length,0);
});
test('two-second raw-input mark guides strike-time selection; unrelated afterimages do not become selection marks',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:7});activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  assert.equal(a.findBuff(WISADEL_S3_TARGET).source,f.u);near(a.findBuff(WISADEL_S3_TARGET).duration,2);
  z.base.tauntLevel=20;z.markDirty();f.b.addBuff(z,{key:MARK,data:{wisadelLife:z.deploySeq}});
  until(f,()=>shots(f).length===1);assert.equal(shots(f)[0].command.target,a);
});
test('strike falls back to a fresh current target when marked input leaves range',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:7});activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  a.x=14;a.tileC=14;f.b._buildEnemyIndex();until(f,()=>shots(f).length===1);
  assert.equal(shots(f)[0].command.target,z);assert.equal(f.u.skill.ammoLeft,5);
});
test('slow windup expires the two-second mark and permits current priority fallback',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:7});f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-90}});
  activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');near(f.controller.phase.speed,.2);
  z.base.tauntLevel=20;z.markDirty();until(f,()=>shots(f).length===1,10);
  assert.equal(a.findBuff(WISADEL_S3_TARGET),null);assert.equal(shots(f)[0].command.target,z);
});
test('shared foreign selection mark is eligible and is never overwritten by the private controller',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:7,taunt:10});
  const old=f.b.addBuff(a,{key:WISADEL_S3_TARGET,source:{foreign:true},duration:10});activate(f);
  until(f,()=>shots(f).length===1);assert.equal(shots(f)[0].command.target,z);
  assert.equal(a.findBuff(WISADEL_S3_TARGET),old);
});
test('S3 target-free filters exclude sleep, hidden units, stealth and unblocked camouflage; splash admits camouflage',()=>{
  const f=make(),a=enemy(f),camou=enemy(f,{col:6.5,flags:{camou:true}});
  for(const flags of [{sleep:true},{stealth:true},{untargetable:true}])enemy(f,{flags});enemy(f).hidden=true;activate(f);
  until(f,()=>receipts(f).length===4);assert.equal(shots(f).length,1);assert.equal(shots(f)[0].command.target,a);
  assert.deepEqual(receipts(f).map(v=>v.target),[a,camou,a,camou]);assert.equal(camou.findBuff(MARK),null);
});
test('S3 main/shock ATK and coefficient are captured at birth while afterimage explosion reads live source ATK',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);
  const cached=shots(f)[0].command.cachedAtk;near(cached,687*2.8);
  f.b.addBuff(f.u,{key:'fixture:late-atk',mods:{atkPct:1}});until(f,()=>receipts(f).length===2);
  near(receipts(f)[0].amount,cached*2.2*1.15);near(receipts(f)[1].amount,cached*2.2*1.15*.5);
  const boom=f.hits.filter(v=>v.dmg.tags?.includes('afterimage'));near(boom[0].amount,687*3.8*1.5);
  assert.equal(a.findBuff(MARK),null);
});
test('a manually discarded last born round retains cached damage and guaranteed detonation after mode expiry',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);
  f.u.skill.end('manual');near(f.u.s.atk,687);assert.equal(f.u.skill.active,false);
  until(f,()=>receipts(f).length===2);near(receipts(f)[0].amount,687*2.8*2.2*1.15);
  near(receipts(f)[1].amount,687*2.8*2.2*1.15*.5);assert.equal(f.explosions.length,1);
});
test('final exhaustion holds skill/SP through OnAttackFinished then plays End without deleting persistent Shadows',()=>{
  const f=make();enemy(f);activate(f);const summoned=tokens(f);f.u.skill.ammoLeft=1;
  until(f,()=>shots(f).length===1);assert.equal(f.u.skill.ammoLeft,0);assert.equal(f.u.skill.active,true);
  const p=f.controller.phase;assert.ok(p.finishedAt>f.b.time);near(f.u.skill.sp,0);
  f.u.skill.gainSp(10,'external');near(f.u.skill.sp,0);
  until(f,()=>!f.u.skill.active);assert.ok(f.b.time>=p.finishedAt-f.b.dt);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End');assert.deepEqual(tokens(f),summoned);
  advance(f.b,.6);assert.ok(f.u.skill.sp>.4);near(f.u.s.atk,687);assert.equal(shots(f).length,1);
});
test('all six rounds produce one attack event and ammo event each without phantom offensive SP',()=>{
  const f=make();enemy(f);let ammo=0;f.b.on('ammoUsed',ctx=>{if(ctx.unit===f.u)ammo++;});activate(f);
  until(f,()=>!f.u.skill.active,35);assert.equal(shots(f).length,6);assert.equal(f.attacks.length,6);assert.equal(ammo,6);
  assert.equal(tokens(f).length,3);near(f.u.skill.sp,0,f.b.dt*2);
});
test('high ASPD caps playback at one and respects finished-event floor instead of waiting for full five-second art',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:haste',mods:{aspd:400}});activate(f);
  until(f,()=>shots(f).length===2);near(shots(f)[1].time-shots(f)[0].time,1.5,f.b.dt*2);
  assert.equal(f.controller.phase.speed,1);near(f.u.s.interval,1);
});
test('capture slow playback and event clocks before later ASPD changes',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-50}});activate(f);
  until(f,()=>f.controller.phase?.kind==='s3-attack');const p=f.controller.phase;near(p.speed,.5);
  f.b.removeBuff(f.u,'fixture:slow');until(f,()=>shots(f).length===1);
  assert.ok(shots(f)[0].time>=p.releaseAt-f.b.dt);near(shots(f)[0].command.cachedAtk,687*2.8);
});
test('no targets, lost windup input and hook-rejected release do not spend a round or create damage',()=>{
  for(const mode of ['empty','lost','rejected']){
    const f=make(),a=mode==='empty'?null:enemy(f);activate(f);
    if(mode==='lost'){until(f,()=>f.controller.phase?.kind==='s3-attack');f.b.kill(a);}
    if(mode==='rejected')f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
    advance(f.b,4);assert.equal(shots(f).length,0);assert.equal(f.u.skill.ammoLeft,6);assert.equal(f.u.skill.active,true);
  }
});
test('changed target life inside beforeAttack cannot receive an accepted round',()=>{
  const f=make(),a=enemy(f);activate(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)a.deploySeq++;});
  advance(f.b,3);assert.equal(shots(f).length,0);assert.equal(f.u.skill.ammoLeft,6);
});
test('changed born trace cannot redirect homing into a new victim life',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);
  a.deploySeq++;a.x=16;a.tileC=16;const z=enemy(f,{col:8});f.b._buildEnemyIndex();
  until(f,()=>receipts(f).length===2);assert.deepEqual(receipts(f).map(v=>v.target),[z,z]);
  assert.equal(a.hp,a.s.maxHp);assert.equal(a.findBuff(MARK),null);assert.equal(f.explosions.length,0);
});
test('transient control cancels an unborn round without spending ammunition',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.5);
  assert.equal(shots(f).length,0);assert.equal(f.u.skill.ammoLeft,6);assert.equal(f.u.skill.active,true);
  until(f,()=>shots(f).length===1);assert.equal(f.u.skill.ammoLeft,5);
});
test('control after birth preserves projectile receipts; control of an exhausted holder releases its skill',()=>{
  const f=make();enemy(f);activate(f);f.u.skill.ammoLeft=1;until(f,()=>shots(f).length===1);
  f.b.applyStatus(f.u,'freeze',{duration:2});until(f,()=>receipts(f).length===2);
  assert.equal(f.u.skill.active,false);assert.equal(shots(f).length,1);
});
test('silence does not suppress native nonsilenceable S3; genuine control prevents activation',()=>{
  const f=make();enemy(f);f.b.applyStatus(f.u,'silence',{duration:5});activate(f);until(f,()=>shots(f).length===1);
  const z=make();ready(z);z.b.applyStatus(z.u,'stun',{duration:3});assert.equal(z.u.skill.activate(),false);
});
test('manual cancellation before birth discards rounds but leaves Shadows, marks and no orphaned phase',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  const summoned=tokens(f);f.u.skill.end('manual');assert.equal(f.controller.phase.kind,'s3-transition');
  assert.equal(f.u.skill.ammoLeft,0);assert.deepEqual(tokens(f),summoned);assert.ok(a.findBuff(WISADEL_S3_TARGET));
  advance(f.b,.4);assert.equal(shots(f).length,0);assert.equal(f.u.findBuff(WISADEL_S3_TOKEN_MARK),null);
});
test('skill end cannot be reactivated from its own callback until End transition completes',()=>{
  const f=make();activate(f);let accepted=null;
  f.b.on('skillEnd',ctx=>{if(ctx.unit===f.u){ready(f);accepted=f.u.skill.activate('reentrant');}});
  f.u.skill.end('manual');assert.equal(accepted,false);advance(f.b,1.1);assert.equal(f.u.skill.activate(),true);
});
test('all ranks create source one/two new Shadows, gift only first fresh Shadow and keep DP/slots unchanged',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank}),old=tokens(f)[0];old.skill.sp=1;const dp=f.u.player.dp,slots=f.b.deployedSlots();
    activate(f);const added=tokens(f).filter(t=>t!==old);assert.equal(added.length,rank<7?1:2);
    near(old.skill.sp,1);near(added[0].skill.sp,3);if(added.length>1)near(added[1].skill.sp,0);
    assert.equal(f.u.player.dp,dp);assert.equal(f.b.deployedSlots(),slots);
    assert.ok(added.every(t=>t.deploymentSlotCost===0));assert.equal(f.u.findBuff(WISADEL_S3_TOKEN_MARK),null);
  }
});
test('existing three-Shadow cap grants no new SP and skill still activates at full ammunition',()=>{
  const f=make();f.shadows.spawn(2);for(const t of tokens(f))t.skill.sp=1;
  activate(f);assert.equal(tokens(f).length,3);for(const t of tokens(f))near(t.skill.sp,1);
  assert.equal(f.u.skill.ammoLeft,6);assert.ok(f.u.findBuff(WISADEL_S3_TOKEN_MARK));
  f.u.skill.end('manual');assert.equal(f.u.findBuff(WISADEL_S3_TOKEN_MARK),null);
});
test('no legal spawn tile does not prevent S3 activation or erase existing Shadows',()=>{
  const f=make();const old=tokens(f)[0];noTerrain(f);activate(f);
  assert.equal(f.u.skill.ammoLeft,6);assert.deepEqual(tokens(f),[old]);assert.ok(f.u.skill.active);
});
test('source non-forced fresh-Shadow SP grant respects noSp and consumes the owner one-shot marker',()=>{
  const f=make();f.b.on('wisadelShadowSpawn',ctx=>{if(ctx.owner===f.u)f.b.addBuff(ctx.token,{key:'fixture:no-sp',flags:{noSp:true}});});
  activate(f);assert.equal(tokens(f).length,3);near(tokens(f)[1].skill.sp,0);near(tokens(f)[2].skill.sp,0);
  assert.equal(f.u.findBuff(WISADEL_S3_TOKEN_MARK),null);
});
test('owner withdrawal cancels unborn rounds and removes every owned Shadow/camouflage',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');f.b.retreat(f.u,{permanent:true});
  advance(f.b,2);assert.equal(shots(f).length,0);assert.equal(tokens(f).length,0);
  assert.equal(f.u.skill.active,false);assert.equal(f.u.s.flags.camou||false,false);assert.equal(f.controller.handles.length,0);
});
test('owner withdrawal preserves born cached main/shock but clears parent afterimages and detonation',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);f.b.retreat(f.u,{permanent:true});
  until(f,()=>receipts(f).length===2);near(receipts(f)[0].amount,687*2.8*2.2);near(receipts(f)[1].amount,687*2.8*2.2*.5);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.explosions.length,0);assert.equal(tokens(f).length,0);
  assert.equal(f.controller.projectiles.handles.length,0);
});
test('battle finish cancels S3 pending output, active skill, owned Shadows and all timers/hooks',()=>{
  const f=make();enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);
  f.b.finished=true;f.b.emit('battleEnd',{});advance(f.b,2);
  assert.equal(f.hits.length,0);assert.equal(f.u.skill.active,false);assert.equal(tokens(f).length,0);
  assert.equal(f.controller.projectiles.outputs.size,0);assert.equal(f.controller.projectiles.handles.length,0);
  assert.equal(f.controller.handles.length,0);assert.equal(f.shadows.handles.length,0);
});
test('lethal S3 shock uses the original dead centre for one all-motion afterimage explosion',()=>{
  const f=make(),a=enemy(f,{hp:687*2.8*2.2*1.15*1.2}),air=enemy(f,{col:6.5,fly:true});activate(f);
  until(f,()=>f.explosions.length===1);assert.equal(a.alive,false);assert.equal(a.findBuff(MARK),null);
  const boom=f.hits.filter(v=>v.dmg.tags?.includes('afterimage'));assert.ok(boom.some(v=>v.target===air));
  assert.equal(f.u.stats.kills,1);assert.equal(shots(f).length,1);
});
test('phys dodge and DEF mitigation remain separate for cached main/shock and live talent explosion',()=>{
  for(const dodge of [false,true]){
    const f=make(),a=enemy(f,{def:100});if(dodge)f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgePhys:1}});activate(f);
    until(f,()=>f.explosions.length===1);
    if(dodge){assert.equal(f.hits.length,0);near(a.hp,a.s.maxHp);}else{
      near(receipts(f)[0].amount,687*2.8*2.2*1.15-100);near(receipts(f)[1].amount,687*2.8*2.2*1.15*.5-100);
    }
    assert.equal(a.findBuff(MARK),null);assert.ok(a.findBuff('stun'));
  }
});
test('removal during selection mark attachment cannot create an unborn S3 phase or spend a round',()=>{
  const f=make();enemy(f);activate(f);let acted=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===WISADEL_S3_TARGET&&!acted){acted=true;f.b.retreat(f.u,{permanent:true});}});
  advance(f.b,2);assert.equal(shots(f).length,0);assert.equal(f.controller.phase,null);assert.equal(tokens(f).length,0);
});
test('owner removal from first S3 spawned-token callback leaves no second token, gift or active skill',()=>{
  const f=make();f.b.on('wisadelShadowSpawn',ctx=>{if(ctx.owner===f.u)f.b.retreat(f.u,{permanent:true});});
  activate(f);assert.equal(tokens(f).length,0);assert.equal(f.u.skill.active,false);assert.equal(f.controller.handles.length,0);
  assert.equal(f.u.findBuff(WISADEL_S3_TOKEN_MARK),null);
});
test('manual cancellation inside ammoUsed preserves the born round and cannot decrement a replacement activation',()=>{
  const f=make();enemy(f);activate(f);f.b.on('ammoUsed',ctx=>{if(ctx.unit===f.u){f.u.skill.end('manual');ready(f);assert.equal(f.u.skill.activate(),false);}});
  until(f,()=>shots(f).length===1);assert.equal(f.u.skill.active,false);until(f,()=>receipts(f).length===2);
  advance(f.b,.6);assert.equal(f.u.skill.activate(),true);assert.equal(f.u.skill.ammoLeft,6);
});
test('battle end during first main receipt prevents shock/explosion and cleans pending Shadow state',()=>{
  const f=make();enemy(f);activate(f);f.b.on('damaged',ctx=>{if(ctx.source===f.u){f.b.finished=true;f.b.emit('battleEnd',{});}});
  until(f,()=>f.hits.length===1);advance(f.b,1);assert.equal(f.hits.length,1);assert.equal(f.explosions.length,0);
  assert.equal(tokens(f).length,0);assert.equal(f.controller.projectiles.outputs.size,0);
});
test('the first fresh Shadow casts sooner from its one-shot three-SP gift, without gifting old or second new Shadow',()=>{
  const f=make({disableShadowAttacks:false}),a=enemy(f,{col:8}),old=tokens(f)[0];let firstBirth=null;
  f.b.on('wisadelShadowProjectileBirth',ctx=>{if(ctx.owner===f.u&&!firstBirth)firstBirth={...ctx,time:f.b.time};});
  activate(f);const [gifted,other]=tokens(f).filter(t=>t!==old);
  near(gifted.skill.sp,3);near(other.skill.sp,0);near(old.skill.sp,0);
  until(f,()=>firstBirth!==null,4);assert.equal(firstBirth.token,gifted);assert.ok(firstBirth.time<2.2);
  assert.ok(a.alive);assert.equal(f.u.skill.active,true);
});
test('a native five-second homing timeout retains captured S3 impact coordinates and radius',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);until(f,()=>shots(f).length===1);
  f.b.addBuff(f.u,{key:'fixture:stop-new-attacks',flags:{disarm:true}});const p=shots(f)[0].command;
  while(f.b.time-p.bornAt<5.25){a.x=f.b.tickCount%2?0:20;a.tileC=Math.round(a.x);
    f.b._buildEnemyIndex();advance(f.b,f.b.dt);}
  assert.equal(p.parts[0].done,true);near(p.x,p.parts[0].lastX);assert.ok(f.b.time-p.bornAt>=5);
  assert.equal(p.parts[0].spec.radius,2.5);assert.equal(shots(f).length,1);assert.equal(f.impacts.length,2);
  near(f.impacts[1].time-f.impacts[0].time,.15,f.b.dt);
});
test('source selection-mark control callbacks cannot bypass an unborn attack epoch',()=>{
  const f=make();enemy(f);activate(f);let acted=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===WISADEL_S3_TARGET&&!acted){acted=true;f.b.applyStatus(f.u,'stun',{duration:.001});}});
  until(f,()=>acted);assert.equal(f.controller.phase,null);assert.equal(f.u.skill.ammoLeft,6);
  until(f,()=>shots(f).length===1);assert.equal(f.u.skill.ammoLeft,5);
});
test('last-round natural expiry keeps cached main and half shock, captured probability and live-source explosion',()=>{
  const f=make(),a=enemy(f,{col:8});activate(f);f.u.skill.ammoLeft=1;until(f,()=>shots(f).length===1);
  a.x=17;a.tileC=17;f.b._buildEnemyIndex();until(f,()=>!f.u.skill.active);
  assert.equal(f.hits.length,0);until(f,()=>receipts(f).length===2);
  near(receipts(f)[0].amount,687*2.8*2.2*1.15);near(receipts(f)[1].amount,687*2.8*2.2*1.15*.5);
  near(f.hits.find(v=>v.dmg.tags?.includes('afterimage')).amount,687*1.5);assert.equal(f.explosions.length,1);
});
test('accepted rounds respect an external spare-ammo hook without duplicating attack/projectile events',()=>{
  const f=make();enemy(f);f.b.rng=()=>0;
  f.b.on('beforeAmmoUse',ctx=>{if(ctx.unit===f.u)ctx.spareShotProb=1;});activate(f);
  until(f,()=>shots(f).length===2);assert.equal(f.u.skill.ammoLeft,6);assert.equal(f.attacks.length,2);
});
test('owner withdrawal during the detonation roll cannot consume a foreign afterimage',()=>{
  const f=make(),a=enemy(f,{col:8});
  const mark=f.b.addBuff(a,{key:MARK,source:{foreign:true},data:{wisadelLife:a.deploySeq}});
  activate(f);until(f,()=>shots(f).length===1);let acted=false;
  f.b.rng=()=>{if(!acted){acted=true;f.b.retreat(f.u,{permanent:true});}return 0;};
  until(f,()=>receipts(f).length===2);assert.equal(acted,true);
  assert.equal(f.u.removed,true);assert.equal(f.explosions.length,0);assert.equal(a.findBuff(MARK),mark);
  assert.equal(tokens(f).length,0);assert.equal(f.controller.projectiles.handles.length,0);
});
