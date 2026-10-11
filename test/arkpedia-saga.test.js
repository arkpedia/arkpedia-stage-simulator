// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-saga-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { makeDamageInfo } from '../server/sim/damage.js';
import { dirVec } from '../server/sim/dir.js';
const ID = 'char_362_saga';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a-z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i=0; i<Math.ceil(seconds/b.dt-1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill=0, rank=10, elite=2, potential=1, other=false }={}) {
  const src=structuredClone(data), op=src.operators[ID];
  src.stage.geometry.waves[0].spawns=[]; src.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op), elite, level:op.phases[elite].maxLevel,
    potential, skillId:op.skills[skill].id, skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
  const b=new StandardBattle(src,{operators:[build,...(other?[defaultBuild(src.operators.char_103_angel)]:[])]});
  b.autoFinish=false; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[]; b.on('damaged',ctx=>hits.push(ctx));
  const deploy=(r=3,c=4,dir='RIGHT')=>{
    b.getPlayer('arkpedia').dp=60; const u=b.deployOperator(ID,r,c,dir); assert.ok(u);
    u.atkCd=1000; u.skill.rule='NEVER'; return u;
  };
  return {b,deploy,hits};
}
function enemy(b,{r=3,c=5,hp=100000,def=0,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:hp,def,res:0,moveSpeed:0}); e.markDirty(); void e.s; e.hp=hp;
  if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}}); b._buildEnemyIndex(); return e;
}
function cast(b,u,charges=1) { u.skill.setSpTotal(u.skill.spCost*charges); assert.equal(b.activateOperator(ID),true); }
function shot(b,u,e) { u.trait.hadTarget=true; assert.equal(b.forceAttack(u,[e]),true); u.atkCd=1000; }
const outputs=(hits,u)=>hits.filter(h=>h.source===u && h.type!=='element');

test('Saga retains all30 source ranks and actual facing bytes, including native animation aliases',()=>{
  assert.equal(evidence.frameParity,false); assert.equal(evidence.source.bundles.length,5);
  for(const s of data.operators[ID].skills)
    assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?
      {...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  const anim=evidence.chararts[ID][0].data._animations;
  assert.equal(anim.find(a=>a.animKey==='Skill_2').animName,'Skill');
  assert.equal(anim.find(a=>a.animKey==='Skill_3_Loop').animName,'Skill_2_Loop');
  assert.equal(evidence.templates.saga_t_1.eventToActions.ON_OUTPUT_DAMAGE[0]._sharedFlagIndex,'DAMAGE_IS_UNDEADABLE_THIS_TIME');
});
test('Saga damage floors are per receipt, post-shield, bounded and absent on unrelated attacks and HP loss',()=>{
  const {b,deploy,hits}=make(),u=deploy(),e=enemy(b,{hp:100});
  b.addBuff(e,{key:'test:shield',shield:200});
  b.dealDamage(u,e,{amount:100,type:'true'}); near(e.hp,100); assert.equal(e.findBuff('cripple'),null);
  b.dealDamage(u,e,{amount:300,type:'true'}); near(e.hp,1); assert.ok(e.findBuff('cripple')); near(outputs(hits,u).at(-1).hpLoss,99);
  const z=enemy(b,{hp:100}); b.loseHp(z,200,{source:u}); assert.equal(z.alive,false);
  const f=enemy(b,{hp:100}); b.dealDamage(null,f,{amount:200,type:'true'}); assert.equal(f.alive,false);
  assert.equal(makeDamageInfo({hpFloor:NaN}).hpFloor,0);
  assert.equal(makeDamageInfo({hpFloor:Infinity}).hpFloor,0);
  const tiny=enemy(b,{hp:.5}); b.dealDamage(u,tiny,{amount:200,type:'true'}); near(tiny.hp,.5);
});
test('Preaching is present at E0 and E1, never refreshes wounds, and grants selected1/2SP to the real killer',()=>{
  for(const [elite,gift] of [[0,1],[1,2],[2,2]]) {
    const {b,deploy}=make({elite,other:true}),u=deploy(),e=enemy(b,{hp:100});
    const a=b.deployOperator('char_103_angel',2,4,'RIGHT'); assert.ok(a); a.atkCd=1000; a.skill.rule='NEVER'; a.skill.setSpTotal(0);
    b.dealDamage(u,e,{amount:200,type:'true'}); assert.equal(e.hp,1);
    advance(b,9); b.dealDamage(u,e,{amount:200,type:'true'});
    a.skill.setSpTotal(0); b.dealDamage(a,e,{amount:10,type:'true'}); near(a.skill.spTotal,gift);
    assert.equal(e.alive,false); assert.equal(e.findBuff('cripple'),null);
  }
});
test('Preaching ignores dodged, canceled and gauge-only receipts; cleansed wound hooks do not grant gifts',()=>{
  const {b,deploy}=make({other:true}),u=deploy(),e=enemy(b,{hp:100});
  b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});
  b.dealDamage(u,e,{amount:200,type:'phys'}); near(e.hp,100); assert.equal(e.findBuff('cripple'),null);
  b.on('hit',ctx=>{if(ctx.dmg.tags.includes('test:cancel'))ctx.dmg.cancel=true;});
  b.dealDamage(u,e,{amount:200,type:'true',tags:['test:cancel']}); near(e.hp,100);
  e.hp=1; b.dealDamage(u,e,{amount:10,type:'element',element:'erosion'}); assert.equal(e.findBuff('cripple'),null);
  b.dealDamage(u,e,{amount:200,type:'true'}); assert.ok(e.findBuff('cripple')); b.removeBuff(e,'cripple');
  const a=b.deployOperator('char_103_angel',2,4,'RIGHT'); a.skill.setSpTotal(0); a.skill.rule='NEVER'; a.atkCd=1000;
  b.kill(e,a); near(a.skill.spTotal,0); advance(b,10.1);
});
test('wounds prevent attacks, blocking and all healing, and their10s no-source expiry does not grant SP',()=>{
  const {b,deploy}=make(),u=deploy(),e=enemy(b,{hp:100});
  e.base.moveSpeed=1; e.base.hpRecoveryPerSec=20; e.markDirty();
  e.blockedBy=u; u.blocking.push(e); b.dealDamage(u,e,{amount:200,type:'true'});
  assert.equal(e.blockedBy,null); assert.equal(u.blocking.includes(e),false);
  assert.equal(e.s.flags.unblockable,true); assert.equal(e.s.flags.disarm,true); near(e.s.moveSpeed,.2); near(e.s.hpRegen,0);
  near(b.heal(u,e,100),0); near(b.heal(e,e,100,{self:true}),0);
  advance(b,9.9); assert.equal(e.alive,true); b.dealDamage(u,e,{amount:0,type:'true'});
  u.skill.setSpTotal(0); advance(b,.2); assert.equal(e.alive,false); near(e.deathAt,10); near(u.skill.spTotal,.2);
});
test('target-owned wounds and SP gifts survive Saga retirement and honor killer no-SP gates',()=>{
  const {b,deploy}=make({other:true}),u=deploy(),a=b.deployOperator('char_103_angel',2,4,'RIGHT');
  a.atkCd=1000; a.skill.rule='NEVER'; const e=enemy(b,{hp:100}); b.dealDamage(u,e,{amount:200,type:'true'});
  b.retreatOperator(ID); a.skill.setSpTotal(0); b.kill(e,a); near(a.skill.spTotal,2);
  b.bench[ID].readyAt=b.time; const v=deploy(),z=enemy(b,{hp:100}); b.dealDamage(v,z,{amount:200,type:'true'});
  a.skill.setSpTotal(0); b.addBuff(a,{key:'test:noSp',flags:{noSp:true}}); b.kill(z,a); near(a.skill.spTotal,0);
  const f=enemy(b,{hp:100}); b.dealDamage(v,f,{amount:200,type:'true'}); b.retreatOperator(ID); advance(b,10.1); assert.equal(f.alive,false);
});
test('hidden wound trigger finishes without kill, while reappearance before trigger kills without a source',()=>{
  const {b,deploy}=make(),u=deploy(),e=enemy(b,{hp:100}); b.dealDamage(u,e,{amount:200,type:'true'});
  e.hidden=true; advance(b,10.1); assert.equal(e.alive,true); assert.equal(e.findBuff('cripple'),null);
  const z=enemy(b,{hp:100}); b.dealDamage(u,z,{amount:200,type:'true'}); z.hidden=true;
  b.emit('enemyBeforeAppear',{enemy:z}); assert.equal(z.alive,false);
});
test('normal attacks exclude wounds, keep one input and use actual first-only Begin/Loop timing for both facings',()=>{
  for(const dir of ['UP','RIGHT','LEFT','DOWN'])for(const aspd of [-50,0,100]) {
    const {b,deploy,hits}=make(),u=deploy(3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
    b.addBuff(u,{key:'test:aspd',mods:{aspd}}); const p=effectiveProfile(u),speed=u.s.aspd/100;
    near(p.windup(b,u,[e]),.266/speed); near(p.windup(b,u,[e]),.133/speed);
    u.mem.sagaNormalBegun=false; shot(b,u,e); advance(b,.266/speed+.1); assert.equal(outputs(hits,u).length,1);
  }
  const {b,deploy,hits}=make(),u=deploy(),e=enemy(b,{hp:100}),z=enemy(b,{c:5.1});
  b.dealDamage(u,e,{amount:200,type:'true'}); assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);
  hits.length=0; shot(b,u,z); b.kill(z,null); advance(b,.4); assert.equal(outputs(hits,u).length,0);
});
test('S1 all10 ranks grant exact automatic DP and can recast without replacing ordinary combat',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy,hits}=make({rank}),u=deploy(),e=enemy(b); const before=b.dp;
    u.skill.rule='SP_FULL'; u.skill.setSpTotal(u.skill.spCost); advance(b,.1);
    near(b.dp,before+u.def.skill.bb.cost); assert.equal(u.skill.active,false);
    shot(b,u,e); advance(b,.4); assert.equal(outputs(hits,u).length,1);
    u.skill.setSpTotal(u.skill.spCost); advance(b,.1); near(b.dp,before+u.def.skill.bb.cost*2);
  }
});
test('S2 all10 ranks consume one selected charge, grant4DP in an empty cast and use unclamped actual Skill timing',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy}=make({skill:1,rank}),u=deploy(); const before=b.dp;
    const charges=u.skill.maxCharges; assert.equal(charges,u.def.skill.maxCharges); cast(b,u,charges);
    near(b.dp,before+u.def.skill.bb.cost); assert.equal(u.skill.charges,charges-1);
    near(u.skill.timeLeft,.833); assert.equal(b.activateOperator(ID),false);
    advance(b,.9); assert.equal(u.skill.active,false); assert.equal(u.mem.sagaCast,null);
  }
  const {b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b);
  b.addBuff(u,{key:'test:aspd',mods:{aspd:100}}); cast(b,u); advance(b,.1); assert.equal(outputs(hits,u).length,0);
  advance(b,.1); assert.equal(outputs(hits,u).length,1); near(outputs(hits,u)[0].hpLoss,u.s.atk*4);
  advance(b,.3); assert.equal(u.skill.active,false); assert.equal(e.alive,true);
});
test('S2 targets only six legal ground enemies in its actual cross at release, then finishes wounds after.7s',()=>{
  const {b,deploy,hits}=make({skill:1}),u=deploy(),victims=[];
  for(let i=0;i<7;i++)victims.push(enemy(b,{c:5+i*.01,hp:100}));
  const air=enemy(b,{c:5.2,hp:100,fly:true}),outside=enemy(b,{r:4,c:5,hp:100}),stealth=enemy(b,{c:5.25,hp:100});
  b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});
  cast(b,u); advance(b,.3); assert.equal(outputs(hits,u).length,0); advance(b,.1);
  assert.equal(outputs(hits,u).length,6); assert.equal(victims.filter(e=>e.findBuff('cripple')).length,6);
  assert.equal(victims.filter(e=>!e.alive).length,0); advance(b,.6); assert.equal(victims.filter(e=>!e.alive).length,0);
  u.skill.setSpTotal(0); advance(b,.1); assert.equal(victims.filter(e=>!e.alive).length,6); near(u.skill.spTotal,12.1);
  for(const e of [air,outside,stealth])near(e.hp,100);
});
test('S2 selects at release and finishes independently after retirement; canceled unborn casts emit no damage',()=>{
  const {b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b,{r:4,c:5,hp:100});
  cast(b,u); e.y=3; b._buildEnemyIndex(); advance(b,.4); assert.ok(e.findBuff('cripple'));
  b.retreatOperator(ID); advance(b,.7); assert.equal(e.alive,false);
  b.bench[ID].readyAt=b.time; const v=deploy(),z=enemy(b); hits.length=0; cast(b,v); b.applyStatus(v,'stun',{duration:1});
  advance(b,1); assert.equal(outputs(hits,v).length,0); near(z.hp,100000); assert.equal(v.mem.sagaCast,null);
});
test('S2 can select existing wounds and its delayed finisher survives a dodged primary, but respects cleansing',()=>{
  const {b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{hp:100}),z=enemy(b,{c:5.1,hp:100});
  for(const victim of [e,z]){ b.dealDamage(u,victim,{amount:200,type:'true'}); b.addBuff(victim,{key:'test:dodge',mods:{dodgePhys:1}}); }
  cast(b,u); advance(b,.4); b.removeBuff(z,'cripple'); advance(b,.7);
  assert.equal(e.alive,false); assert.equal(z.alive,true);
});
test('S3 all10 ranks apply selected modifiers and deliver exactly20 delayed1DP pulses, ending cleanly',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy}=make({skill:2,rank}),u=deploy(),atk=u.s.atk,interval=u.s.interval,before=b.dp; cast(b,u);
    near(u.s.atk,atk*(1+u.def.skill.bb.atk)); near(u.s.interval,interval+.5); near(b.dp,before);
    advance(b,.9); near(b.dp,before); advance(b,.1); near(b.dp,before+1);
    advance(b,19); near(b.dp,before+20); assert.equal(u.skill.active,false); near(u.s.atk,atk); near(u.s.interval,interval);
    assert.equal(u.findBuff('saga:dp'),null); assert.equal(u.mem.regularFormVisual,null);
    advance(b,2); near(b.dp,before+20);
  }
});
test('S3 uses extended range and Block-stat target cap, prioritizes actual blockers and excludes existing wounds',()=>{
  const {b,deploy}=make({skill:2}),u=deploy(),a=enemy(b),z=enemy(b,{c:6}),far=enemy(b,{c:7}),crit=enemy(b,{hp:100});
  b.dealDamage(u,crit,{amount:200,type:'true'}); cast(b,u); b._refreshRange(u); const p=effectiveProfile(u);
  assert.deepEqual(acquireTargets(b,u,p),[a,z]); assert.equal(acquireTargets(b,u,p).includes(far),false);
  b.addBuff(u,{key:'test:block',mods:{blockCnt:-1}}); z.blockedBy=u; u.blocking.push(z);
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);
});
test('S3 strictly-below-half extra NORMAL hit is independent Physical damage and can wound without killing',()=>{
  for(const ratio of [.49,.5,.51]) {
    const {b,deploy,hits}=make({skill:2}),u=deploy(),e=enemy(b,{hp:10000,def:100}); e.hp=e.s.maxHp*ratio;
    cast(b,u); advance(b,.2); shot(b,u,e); advance(b,.4);
    const out=outputs(hits,u); assert.equal(out.length,ratio<.5?2:1);
    for(const h of out)near(h.hpLoss,u.s.atk-100);
  }
  const {b,deploy,hits}=make({skill:2}),u=deploy(),e=enemy(b,{hp:100}); e.hp=20; cast(b,u); advance(b,.2);
  shot(b,u,e); advance(b,.4); assert.equal(outputs(hits,u).length,2); near(e.hp,1); assert.equal(e.alive,true);
});
test('S3 control interrupts only unborn attacks and retirement stops future DP pulses',()=>{
  const {b,deploy,hits}=make({skill:2}),u=deploy(),e=enemy(b); cast(b,u); advance(b,.2); shot(b,u,e);
  b.applyStatus(u,'freeze',{duration:1}); advance(b,.5); assert.equal(outputs(hits,u).length,0);
  advance(b,.3); b.retreatOperator(ID); const dp=b.dp; advance(b,5); near(b.dp,dp);
});
test('Clear Mind uses elite/potential healing and Physical-only dodge once per deployment, with HP-loss triggering',()=>{
  for(const [elite,potential,regen,duration]of [[0,1,0,0],[1,1,0,0],[2,1,.05,15],[2,5,.06,17]]) {
    const {b,deploy}=make({elite,potential}),u=deploy(),e=enemy(b); const max=u.s.maxHp;
    b.loseHp(u,max*.61,{source:e}); advance(b,.1);
    if(!regen){assert.equal(u.findBuff('saga:mind'),null);continue;}
    near(u.s.dodgePhys,.7); near(u.s.dodgeArts,0); near(u.s.hpRegen,max*regen);
    const hp=u.hp; advance(b,1); near(u.hp-hp,max*regen,1.1);
    advance(b,duration); assert.equal(u.findBuff('saga:mind'),null);
    u.hp=max*.2; advance(b,.1); assert.equal(u.findBuff('saga:mind'),null);
    b.retreatOperator(ID); b.bench[ID].readyAt=b.time; const v=deploy(); v.hp=v.s.maxHp*.2; advance(b,.1); assert.ok(v.findBuff('saga:mind'));
  }
});
test('ordinary AI attacks only one normal victim, then shares wounded kills with another operator without inherited modules',()=>{
  const {b,deploy}=make({other:true}),u=deploy(),a=enemy(b,{hp:100}),z=enemy(b,{c:5.1,hp:100});
  u.atkCd=0; advance(b,.4); assert.ok(a.findBuff('cripple')); near(z.hp,100);
  const ally=b.deployOperator('char_103_angel',2,4,'RIGHT'); ally.skill.setSpTotal(0); ally.skill.rule='NEVER';
  b.kill(a,ally); near(ally.skill.spTotal,2); assert.equal(effectiveProfile(u).hitAllBlocked,false);
  assert.equal(u.findBuff('saga_e_003[damage_scale]'),null); assert.equal(u.s.flatDamageResistance,0);
});
