// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-wisadel-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { WISADEL_ID as ID, WISADEL_ATTACK_CONTRACT as CONTRACT, selectedWisadelBuild,
  prepareWisadelAttacks } from '../server/sim/content/arkpedia-wisadel-attacks.js';
import { WISADEL_AFTERIMAGE as MARK } from '../server/sim/content/arkpedia-wisadel-projectiles.js';
import { WisadelShadows,WISADEL_SHADOW,WISADEL_CAMOUFLAGE,WISADEL_SHADOW_CONTRACT } from '../server/sim/content/arkpedia-wisadel-shadows.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function until(f,p,s=12) { const end=f.b.time+s; while(!p()&&f.b.time<end) advance(f.b,f.b.dt);
  assert.ok(p(),`Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`); }
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,battle=null,contract=CONTRACT,shadowContract=WISADEL_SHADOW_CONTRACT,installShadows=true}={}) {
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
  const prepared=prepareWisadelAttacks(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const shadows=new WisadelShadows(prepared.controller,{contract:shadowContract});if(installShadows)shadows.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[],impacts=[],explosions=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('wisadelProjectileImpact',ctx=>{if(ctx.owner===u)impacts.push({...ctx,time:b.time});});
  b.on('wisadelAfterimageExplosion',ctx=>{if(ctx.owner===u)explosions.push({...ctx,time:b.time});});
  const shadowBirths=[],shadowHits=[],refills=[];
  b.on('wisadelShadowProjectileBirth',ctx=>{if(ctx.owner===u)shadowBirths.push({...ctx,time:b.time});});
  b.on('wisadelShadowRefill',ctx=>{if(ctx.owner===u)refills.push({...ctx,time:b.time});});
  b.on('damaged',ctx=>{if(ctx.source.ownerUnit===u)shadowHits.push({...ctx,time:b.time});});
  if(!defer){deploy();b.addBuff(u,{key:'fixture:no-owner-attacks',flags:{disarm:true}});}
  return {b,u,build,deploy,hits,attacks,births,impacts,explosions,shadows,shadowBirths,shadowHits,refills,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:500,def,res,moveSpeed:0,tauntLevel:taunt}); t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY'; f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
const ready=f=>f.u.skill.addCharge(1);

const first=f=>[...f.shadows.tokens.keys()][0];
const entry=(f,t=first(f))=>f.shadows.tokens.get(t);
const charge=(f,t=first(f))=>t.skill.addCharge(1);
test('Shadow helper requires exact selected fresh owner and contract under the public factory',()=>{
  const f=make();assert.equal(REGULAR_OPERATORS[ID].mechanic,'wisadel');assert.ok(data.operators[ID]);
  assert.equal(WISADEL_SHADOW_CONTRACT.frameParity,false);
  assert.throws(()=>make({shadowContract:{...WISADEL_SHADOW_CONTRACT}}),/contract/);
  assert.throws(()=>new WisadelShadows(f.controller,{contract:WISADEL_SHADOW_CONTRACT}),/fresh/);
  const z=make({defer:true,installShadows:false});z.u.def.stats.atk++;
  assert.throws(()=>new WisadelShadows(z.controller,{contract:WISADEL_SHADOW_CONTRACT}),/source/);
});
test('E2 birth creates one selected original Shadow; E0/E1 never fabricate talent2',()=>{
  for(const elite of [0,1,2]){
    const f=make({elite});assert.equal(f.shadows.tokens.size,elite===2?1:0);
    if(elite<2)assert.deepEqual(f.shadows.spawn(3),[]);
    else{const t=first(f);assert.equal(t.defId,WISADEL_SHADOW);assert.equal(t.ownerUnit,f.u);
      assert.equal(t.deploymentSlotCost,0);assert.equal(t.mem.regularFormVisual.clip,'Start');assert.equal(t.skill.sp,0);
      assert.equal(t.s.maxHp,3500);assert.equal(t.s.atk,777);assert.equal(t.s.def,650);assert.equal(t.s.res,50);assert.equal(t.s.blockCnt,0);}
  }
});
test('all ten owner ranks retain paired Shadow skills and token level excludes owner trust/potential ATK',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank,level:1,potential:6,trust:200}),t=first(f);
    assert.equal(t.s.atk,660);assert.equal(t.s.def,585);assert.equal(t.skill.spCost,5);
    assert.equal(t.skill.initSp,0);assert.deepEqual(t.skill.bb,{sluggish:1,sp_min:0,sp_max:3});
    assert.equal(t.base.cost,0);assert.equal(t.base.respawnTime,5);
  }
});
test('nearest legal placement accepts source ALL tiles, including high-ground, and enemy occupancy',()=>{
  const f=make({defer:true});
  const keys=f.controller.record.rangeGrid;assert.ok(keys.length);
  const d=f.b.grid.tile(5,6);d.height='HIGH';d.build='RANGED';enemy(f,{row:5,col:6});
  // Exclude all other candidates so the height-agnostic source path is exercised.
  for(const t of f.b.grid.tiles)if(t!==d)t.build='NONE';
  f.deploy();assert.equal(f.shadows.tokens.size,1);const t=first(f);
  assert.equal(t.tileR,5);assert.equal(t.tileC,6);assert.equal(t.ground,false);
});
test('automatic Shadow stock costs no DP/slots, caps at three, and refuses illegal/occupied tiles',()=>{
  const f=make(),dp=f.b.getPlayer('arkpedia').dp;assert.equal(f.shadows.spawn(8).length,2);
  assert.equal(f.shadows.tokens.size,3);assert.deepEqual(f.shadows.spawn(1),[]);
  assert.equal(f.b.getPlayer('arkpedia').dp,dp);
  for(const t of f.shadows.tokens.keys())assert.equal(t.deploymentSlotCost,0);
  assert.equal(f.shadows.place({row:5,col:5}),null);assert.equal(f.shadows.place({row:-1,col:0}),null);
});
test('failed initial placement does not create delayed replenishment or block the operator',()=>{
  const f=make({defer:true});for(const t of f.b.grid.tiles)t.build='NONE';f.deploy();
  assert.equal(f.u.alive,true);assert.equal(f.shadows.tokens.size,0);
  for(const t of f.b.grid.tiles)t.build='ALL';advance(f.b,8);assert.equal(f.shadows.tokens.size,0);
});
test('native no-healing flag does not invent isolation or prohibit nonhealing friendly selection',()=>{
  const f=make(),t=first(f);assert.equal(t.s.flags.noHeal,true);assert.equal(t.s.flags.healFree,true);
  assert.ok(!t.s.flags.isolated);assert.equal(f.b.allySelectable(t,f.u),true);
  t.hp-=500;f.b.heal(f.u,t,500);near(t.hp,t.s.maxHp-500);
});
test('camouflage is host-only and initial x-5-derived; no periodic range aura is invented',()=>{
  const f=make(),t=first(f);assert.equal(f.u.s.flags.camou,true);assert.equal(f.u.findBuff(WISADEL_CAMOUFLAGE).source,t);
  const ally=f.b._makeAlly(f.u.player,f.u.def,'op',t.tileR,t.tileC+1);f.b._setupUnit(ally,{skill:null,trait:{noAttack:true}});
  if(f.b._deploy(ally,{initial:false}))assert.ok(!ally.s.flags.camou);
  t.tileR=10;t.tileC=10;t.x=10;t.y=10;advance(f.b,.1);assert.equal(f.u.s.flags.camou,true);
  f.b.retreat(t,{permanent:true});assert.ok(!f.u.s.flags.camou);
});
test('multiple born near-host claims keep one camouflage buff until the final claiming token ends',()=>{
  const f=make();const t=f.shadows.place({row:6,col:5});assert.ok(t);
  const a=first(f);assert.equal(f.u.buffs.filter(b=>b.key===WISADEL_CAMOUFLAGE).length,1);
  f.b.retreat(a,{permanent:true});assert.equal(f.u.s.flags.camou,true);assert.equal(f.u.findBuff(WISADEL_CAMOUFLAGE).source,t);
  f.b.retreat(t,{permanent:true});assert.ok(!f.u.s.flags.camou);
});
test('distant captured Shadow creates no host camouflage and a foreign claim is never removed',()=>{
  const f=make(),a=first(f);f.b.retreat(a,{permanent:true});
  const foreign=f.b.addBuff(f.u,{key:WISADEL_CAMOUFLAGE,source:{external:true},flags:{camou:true}});
  const t=f.shadows.place({row:5,col:8});assert.ok(t);assert.equal(entry(f,t).claimEligible,false);
  f.b.retreat(t,{permanent:true});assert.equal(f.u.findBuff(WISADEL_CAMOUFLAGE),foreign);
});
test('ready Shadow waits for a host-range ground target rather than attacking within its own one-tile range',()=>{
  const f=make(),t=first(f);charge(f);enemy(f,{row:t.tileR,col:t.tileC+5});advance(f.b,.5);
  assert.equal(t.skill.ready,true);assert.equal(f.shadowBirths.length,0);
  enemy(f,{row:5,col:8});until(f,()=>f.shadowHits.length===1);assert.equal(t.skill.activations,1);
  near(f.shadowHits[0].amount,777);assert.equal(f.shadowHits[0].type,'arts');
});
test('unmarked enemies precede marked higher-taunt enemies; all marked still permit attacks',()=>{
  const f=make(),a=enemy(f,{col:7,taunt:10}),z=enemy(f,{col:8});
  f.controller.projectiles.attach(a,a.deploySeq);charge(f);until(f,()=>f.shadowBirths.length===1);
  assert.equal(f.shadowBirths[0].output.target,z);until(f,()=>f.shadowHits.length===1);
  assert.equal(z.findBuff(MARK).source,first(f));
  charge(f);until(f,()=>f.shadowBirths.length===2);assert.equal(f.shadowBirths[1].output.target,a);
});
test('Shadow trigger ignores air, hidden, sleeping, stealth, target-free and unblocked camouflage',()=>{
  for(const flags of [{sleep:true},{stealth:true},{untargetable:true},{camou:true}]){
    const f=make();enemy(f,{flags});charge(f);advance(f.b,.5);assert.equal(f.shadowBirths.length,0);
  }
  const f=make();enemy(f,{fly:true});charge(f);advance(f.b,.5);assert.equal(f.shadowBirths.length,0);
});
test('casts use original marker and custom .2 window; time SP and gifts are held, refill stays fractional',()=>{
  const f=make(),t=first(f);enemy(f,{col:8});charge(f);f.b.rng=()=>.5;
  until(f,()=>entry(f).phase);const start=f.b.time-f.b.dt;
  t.skill.gainSp(99,'gift');near(t.skill.sp,0);until(f,()=>f.shadowBirths.length===1);
  near(f.shadowBirths[0].time-start,.033333335,f.b.dt*2);until(f,()=>f.refills.length===1);
  near(f.refills[0].time-start,.2,f.b.dt*2);near(f.refills[0].value,1.5);
  assert.ok(t.skill.sp>=1.5&&t.skill.sp<1.6);assert.equal(t.skill.active,false);
  assert.equal(t.mem.regularFormVisual.clip,'Attack');
});
test('source forced refill bypasses a concurrent noSp effect without enabling natural recovery',()=>{
  const f=make(),t=first(f);enemy(f);charge(f);f.b.rng=()=>.999;
  until(f,()=>f.shadowBirths.length===1);f.b.addBuff(t,{key:'fixture:stop-sp',flags:{noSp:true}});
  until(f,()=>f.refills.length===1);near(t.skill.sp,2.997);advance(f.b,.3);near(t.skill.sp,2.997);
});
test('Shadow skill is not silenceable; genuine control stops casting while time SP continues',()=>{
  const f=make(),t=first(f);enemy(f);f.b.addBuff(t,{key:'fixture:silence',flags:{silence:true}});charge(f);
  until(f,()=>f.shadowBirths.length===1);assert.equal(t.skill.activations,1);
  const z=make(),s=first(z);enemy(z);z.b.addBuff(s,{key:'fixture:freeze',flags:{freeze:true}});
  advance(z.b,6);assert.equal(s.skill.ready,true);assert.equal(z.shadowBirths.length,0);
});
test('control cancels unborn casts without a refund, while born shots finish',()=>{
  for(const born of [false,true]){
    const f=make(),t=first(f);enemy(f);charge(f);until(f,()=>born?f.shadowBirths.length===1:entry(f).phase);
    f.b.addBuff(t,{key:'fixture:stun',flags:{stun:true}});advance(f.b,.5);
    assert.equal(f.shadowBirths.length,born?1:0);assert.equal(f.shadowHits.length,born?1:0);
    assert.equal(f.refills.length,0);assert.equal(t.skill.ready,false);assert.equal(t.skill.active,false);
  }
});
test('transient control invalidates a pending cast and immunity preserves it',()=>{
  for(const immune of [false,true]){
    const f=make(),t=first(f);enemy(f);charge(f);until(f,()=>entry(f).phase);
    if(immune)t.def.immune.add('stun');
    f.b.applyStatus(t,'stun',{duration:.01});advance(f.b,.5);
    assert.equal(f.shadowBirths.length,immune?1:0);
  }
});
test('lost original target before birth restores its charge without a random end refill',()=>{
  const f=make(),t=first(f),a=enemy(f);charge(f);until(f,()=>entry(f).phase);f.b.kill(a);
  advance(f.b,.3);assert.equal(t.skill.ready,true);assert.equal(f.shadowBirths.length,0);assert.equal(f.refills.length,0);
});
test('changed-life input during skillStart cannot be inherited by the accepted cast',()=>{
  const f=make(),a=enemy(f),t=first(f);let changed=false;
  f.b.on('skillStart',ctx=>{if(ctx.unit===t&&!changed){a.deploySeq++;changed=true;f.b.kill(a);}});
  charge(f);advance(f.b,.2);assert.equal(f.shadowBirths.length,0);assert.equal(t.skill.ready,true);
});
test('token death cancels unborn casting but born Arts/Slow survives without orphaning parent marks',()=>{
  for(const born of [false,true]){
    const f=make(),t=first(f),a=enemy(f,{col:8});charge(f);until(f,()=>born?f.shadowBirths.length===1:entry(f).phase);
    f.b.kill(t);advance(f.b,.5);assert.equal(f.shadowHits.length,born?1:0);assert.equal(f.shadows.tokens.size,0);
    assert.equal(f.refills.length,0);if(born){assert.equal(a.findBuff(MARK).source,t);assert.ok(a.findBuff('sluggish'));}
    advance(f.b,6);assert.equal(f.shadows.tokens.size,0);
  }
});
test('owner finish kills all owned tokens; born bolts finish with Slow but cannot attach derived afterimages',()=>{
  const f=make(),a=enemy(f,{col:8});f.shadows.spawn(2);for(const t of f.shadows.tokens.keys())charge(f,t);
  until(f,()=>f.shadowBirths.length===3);f.b.retreat(f.u,{permanent:true});advance(f.b,.5);
  assert.equal(f.shadows.tokens.size,0);assert.equal(f.shadowHits.length,3);assert.equal(a.findBuff(MARK),null);
  assert.ok(a.findBuff('sluggish'));assert.equal(f.shadows.outputs.size,0);assert.equal(f.shadows.handles.length,0);
});
test('battle finish cancels every born bolt, cast and host claim',()=>{
  const f=make();enemy(f,{col:8});charge(f);until(f,()=>f.shadowBirths.length===1);
  f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(f.shadows.outputs.size,0);assert.equal(f.shadows.tokens.size,0);
  assert.equal(f.shadows.handles.length,0);assert.ok(!f.u.s.flags.camou);assert.equal(f.shadowHits.length,0);
});
test('born projectile reads live token ATK and target RES; changed-life target gets no damage/status',()=>{
  for(const changeLife of [false,true]){
    const f=make(),t=first(f),a=enemy(f,{col:8,res:50});charge(f);until(f,()=>f.shadowBirths.length===1);
    f.b.addBuff(t,{key:'fixture:attack',mods:{atkPct:1}});if(changeLife)a.deploySeq++;
    advance(f.b,.5);assert.equal(f.shadowHits.length,changeLife?0:1);
    if(!changeLife)near(f.shadowHits[0].amount,777);else assert.equal(a.findBuff(MARK),null);
  }
});
test('moving trace keeps identity at captured line arrival without homing or collateral splash',()=>{
  const f=make(),a=enemy(f,{col:8}),z=enemy(f,{col:7});charge(f);
  // Target farther enemy using explicit taunt so travel can be observed.
  a.base.tauntLevel=10;a.markDirty();until(f,()=>f.shadowBirths.length===1);
  const born=f.shadowBirths[0];a.x=16;a.tileC=16;until(f,()=>f.shadowHits.length===1);
  assert.equal(f.shadowHits[0].target,a);assert.ok(f.shadowHits[0].time-born.time<.3);assert.equal(z.hp,z.s.maxHp);
});
test('native nondamage-missable statuses survive Arts dodge and obey Slow immunity without Resist shortening',()=>{
  for(const immune of [false,true]){
    const f=make(),a=enemy(f);
    if(immune)f.b.on('beforeStatus',ctx=>{if(ctx.target===a&&ctx.status==='sluggish')ctx.cancel=true;});
    else f.b.addBuff(a,{key:'fixture:resist',flags:{resist:true}});
    f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgeArts:1}});charge(f);
    until(f,()=>f.shadowBirths.length===1);until(f,()=>f.shadows.outputs.size===0);
    assert.equal(f.shadowHits.length,0);near(a.hp,a.s.maxHp);assert.ok(a.findBuff(MARK));
    assert.equal(!!a.findBuff('sluggish'),!immune);if(!immune)near(a.findBuff('sluggish').timeLeft,1,f.b.dt*2);
  }
});
test('Shadow-created afterimage uses host talent parent and is consumable by an owner aftershock',()=>{
  const f=make(),a=enemy(f);charge(f);until(f,()=>f.shadowHits.length===1);
  assert.equal(a.findBuff(MARK).source,first(f));assert.equal(f.controller.projectiles.marks.size,1);
  f.b.rng=()=>0;const command=f.controller.projectiles.launch(a,{attackId:100},false);
  until(f,()=>f.explosions.length===1);assert.equal(f.explosions[0].mark.source,first(f));
  assert.equal(a.findBuff(MARK),null);assert.equal(command.cancelled,false);
});
test('reentrant token withdrawal during camouflage attachment leaves no claim or token behind',()=>{
  const f=make({defer:true});let acted=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===WISADEL_CAMOUFLAGE&&!acted){acted=true;f.b.retreat(ctx.buff.source,{permanent:true});}});
  f.deploy();assert.equal(f.shadows.tokens.size,0);assert.ok(!f.u.s.flags.camou);assert.equal(f.shadows.claim,null);
});
test('owner removal from Shadow spawn callback leaves no surviving tokens or handles',()=>{
  const f=make({defer:true});f.b.on('wisadelShadowSpawn',ctx=>{if(ctx.owner===f.u)f.b.retreat(f.u,{permanent:true});});
  f.deploy();assert.equal(f.shadows.tokens.size,0);assert.equal(f.shadows.handles.length,0);assert.ok(!f.u.alive);
});
test('owner removal inside a mark callback still allows born Arts/Slow but leaves no parent mark',()=>{
  const f=make(),a=enemy(f);charge(f);let acted=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===MARK&&!acted){acted=true;f.b.retreat(f.u,{permanent:true});}});
  until(f,()=>f.shadowHits.length===1);assert.equal(a.findBuff(MARK),null);assert.equal(f.shadows.handles.length,0);
});
test('battle end inside first bolt damage stops simultaneous bolts and future statuses',()=>{
  const f=make(),a=enemy(f,{col:8});f.shadows.spawn(2);for(const t of f.shadows.tokens.keys())charge(f,t);
  f.b.on('damaged',ctx=>{if(ctx.source.ownerUnit===f.u){f.b.finished=true;f.b.emit('battleEnd',{});}});
  until(f,()=>f.shadowHits.length===1);assert.equal(f.shadowBirths.length,3);assert.equal(f.shadowHits.length,1);
  assert.equal(a.findBuff('sluggish'),null);assert.equal(a.findBuff(MARK),null);assert.equal(f.shadows.outputs.size,0);
});
test('manual activation cannot bypass the Shadow automatic controller or duplicate an active cast',()=>{
  const f=make(),t=first(f);enemy(f);charge(f);assert.equal(t.skill.activate('manual'),false);
  let retried=null;
  f.b.on('skillStart',ctx=>{if(ctx.unit===t){t.skill.addCharge(1);retried=t.skill.activate('reentrant');}});
  until(f,()=>f.shadowBirths.length===1);assert.equal(retried,false);assert.equal(t.skill.activations,1);
});
test('owner exit during refill RNG cannot give a removed token SP or retain output hooks',()=>{
  const f=make(),t=first(f);enemy(f);charge(f);until(f,()=>f.shadowBirths.length===1);
  f.b.rng=()=>{f.b.retreat(f.u,{permanent:true});return .5;};advance(f.b,.5);
  assert.equal(f.refills.length,0);assert.equal(f.shadows.tokens.size,0);assert.equal(f.shadows.handles.length,0);
});
test('owner exit from skillEnd stops before drawing the Shadow refill RNG',()=>{
  const f=make(),t=first(f);enemy(f);charge(f);until(f,()=>f.shadowBirths.length===1);
  let draws=0;f.b.rng=()=>{draws++;return .5;};
  f.b.on('skillEnd',ctx=>{if(ctx.unit===t)f.b.retreat(f.u,{permanent:true});});
  advance(f.b,.5);assert.equal(draws,0);assert.equal(f.refills.length,0);
  assert.equal(f.shadows.tokens.size,0);assert.equal(f.shadows.handles.length,0);
});
test('changed-life victim from a mark callback never inherits Shadow damage or Slow',()=>{
  const f=make(),a=enemy(f);charge(f);let changed=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===MARK&&!changed){a.deploySeq++;changed=true;}});
  until(f,()=>f.shadowBirths.length===1);until(f,()=>f.shadows.outputs.size===0);
  assert.equal(f.shadowHits.length,0);assert.equal(a.findBuff(MARK),null);assert.equal(a.findBuff('sluggish'),null);
});
test('token removal from skillStart cannot create an unborn phase or leave noSp/skill state active',()=>{
  const f=make(),t=first(f);enemy(f);charge(f);
  f.b.on('skillStart',ctx=>{if(ctx.unit===t)f.b.retreat(t,{permanent:true});});advance(f.b,.3);
  assert.equal(f.shadowBirths.length,0);assert.equal(f.shadows.tokens.size,0);assert.equal(t.skill.active,false);
  assert.equal(t.findBuff('wisadel:shadow-cast'),null);
});
test('Shadow Arts has its own lethal kill credit without a fabricated owner attack/SP event',()=>{
  const f=make(),t=first(f),a=enemy(f,{hp:500});charge(f);const ownerSp=f.u.skill.sp;
  until(f,()=>f.shadowHits.length===1);assert.equal(a.alive,false);assert.equal(t.stats.kills,1);
  assert.equal(f.u.stats.kills,0);assert.equal(f.attacks.length,0);near(f.u.skill.sp,ownerSp);
  assert.equal(a.findBuff(MARK),null);assert.equal(a.findBuff('sluggish'),null);
});
test('the same Shadow class never owns a foreign host mark or erases a foreign camouflage replacement',()=>{
  const f=make(),a=enemy(f),t=first(f);const foreign={foreign:true};
  const mark=f.b.addBuff(a,{key:MARK,source:foreign,data:{wisadelLife:a.deploySeq}});
  charge(f);until(f,()=>f.shadowHits.length===1);assert.equal(a.findBuff(MARK),mark);
  f.b.removeBuff(f.u,WISADEL_CAMOUFLAGE);
  const camou=f.b.addBuff(f.u,{key:WISADEL_CAMOUFLAGE,source:foreign,flags:{camou:true}});
  f.b.retreat(t,{permanent:true});assert.equal(a.findBuff(MARK),mark);assert.equal(f.u.findBuff(WISADEL_CAMOUFLAGE),camou);
});
