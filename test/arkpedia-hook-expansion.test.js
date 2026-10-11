// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-hook-expansion-prefabs.json' with { type: 'json' };
import { HOOK_EXPANSION_OPERATORS as configs } from '../shared/arkpedia/hook-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const SNS = 'char_383_snsant', ALM = 'char_4105_almond';
const near = (v, e, tolerance = 1e-6) => assert.ok(Math.abs(v-e) < tolerance, `${v} != ${e}`);
const nodes = rows => rows.flatMap(r => r.components);
function make(id = SNS, { skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = [];
  src.stage.battle.dp_per_second = 0;
  const op = src.operators[id], build = { ...defaultBuild(op), elite, potential,
    level: op.phases[elite].maxLevel, skillId: op.skills[skill].id, skillRank: rank };
  const b = new StandardBattle(src, { operators: [build] }); b.autoFinish = false;
  b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const deploy = () => { b.addDp('arkpedia', 99); const u = b.deployOperator(id, 3, 4, dir);
    assert.ok(u); u.atkCd = 1000; u.skill.rule = 'NEVER'; return u; };
  return { b, u: deploy(), deploy };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds/b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function enemy(b, { r = 3, c = 5, fly = false, def = 300, res = 0, infection = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [r,c] });
  Object.assign(e.base, { maxHp: 100000, atk: 0, def, res, moveSpeed: 0 });
  e.def = { ...e.def, immune: new Set(e.def.immune) };
  e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY'; if (infection) e.tags.add('infection');
  b.addBuff(e, { key: 'test:quiet', flags: { disarm: true } }); b._buildEnemyIndex(); return e;
}
function move(b, e, r, c) { Object.assign(e, { x:c, y:r, tileR:r, tileC:c }); b._enemiesDirty = true; b._buildEnemyIndex(); }
function cast(u, full = true) { u.skill.setSpTotal(u.skill.spCost * (full ? u.skill.maxCharges : 1));
  assert.equal(u.skill.activate('test'), true); u.atkCd = 1000; }
function shot(b,u,targets) { assert.equal(b.forceAttack(u,targets), true); u.atkCd = 1000; }
function untilFinished(b,u) {
  for (let i=0;i<240 && u.mem.hookCast;i++) b.step();
  assert.equal(u.mem.hookCast,null); assert.deepEqual(b.errors,[]);
}

test('complete hooks retain four source skills, literal selectors and exact original facing bindings', () => {
  assert.deepEqual(Object.keys(configs), [SNS, ALM]); assert.equal(source.frameParity, false);
  assert.equal(source.source.bundles.length, 6);
  for (const id of Object.keys(configs)) for (const facing of ['Front','Back']) {
    assert.match(source.models[id][facing].sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.models[id][facing].hits.Attack.length);
  }
  const sns = nodes(source.skills.skchr_snsant_2).find(c => c._maxNum === 3);
  assert.equal(sns._limitTargetNum, 0); assert.equal(sns._targetMotion, 1);
  const alm = nodes(source.skills.skchr_almond_1).find(c => c._maxAnimScale != null);
  assert.equal(alm._maxAnimScale, -1);
  const gift = source.buffTemplates.almond_t_1.eventToActions.ON_SKILL_FINISH[0];
  assert.equal(gift._forceFlag, true); assert.equal(gift._spString, 'sp');
  assert.ok(source.limitations.some(v => v.includes('trajectory')));
});

test('both complete kits load every selected source skill and all ten ranks', () => {
  for (const id of Object.keys(configs)) for (let skill=0; skill<2; skill++) for (let rank=1; rank<=10; rank++) {
    const {b,u} = make(id,{skill,rank});
    assert.equal(u.skill.id,configs[id].skillIds[skill]); assert.equal(u.skill.noSkill,false);
    near(u.skill.spCost,u.def.skill.spCost); assert.deepEqual(b.errors,[]);
  }
});

test('ordinary attacks cap ASPD at native1 and keep distance-dependent projectile flight', () => {
  for (const id of [SNS,ALM]) {
    const {b,u}=make(id),e=enemy(b,{c:6});
    near(u.profile.windup(b,u),id===SNS?.467:.5);
    b.addBuff(u,{key:'test:fast',mods:{aspd:200}});
    near(u.profile.windup(b,u),id===SNS?.467:.5);
    shot(b,u,[e]); advance(b,(id===SNS?.467:.5)+.07); near(e.hp,100000);
    assert.equal(b.projectiles.list.length,1); advance(b,.23);
    near(100000-e.hp,u.s.atk-e.s.def);
  }
});

test('Snowsant S1 uses both motion classes and selects the farthest recipient', () => {
  const {b,u}=make(),close=enemy(b,{c:5}),far=enemy(b,{c:6,fly:true}); cast(u);
  const p=effectiveProfile(u); assert.equal(p.canHitFly,true);
  assert.deepEqual(acquireTargets(b,u,p),[far]); near(p.windup(b,u),.533/2);
  shot(b,u); advance(b,.5); assert.ok(far.hp<100000); near(close.hp,100000);
});

test('Snowsant S1 selected ranks apply one mitigated physical hit, source force and delayed80percent sluggish', () => {
  for (const rank of [1,7,10]) {
    const {b,u}=make(SNS,{rank}),e=enemy(b); const pulls=[];
    b.pullToFront=(target,unit,force)=>pulls.push([target,unit,force]);
    cast(u); const bb=u.def.skill.bb; shot(b,u,[e]); advance(b,.5);
    near(100000-e.hp,Math.max(u.s.atk*bb.atk_scale-e.s.def,u.s.atk*bb.atk_scale*.05));
    assert.equal(e.findBuff('sluggish'),null); near(pulls[0][2],bb.force);
    advance(b,1.1); assert.ok(e.findBuff('sluggish')); near(e.s.moveSpeed,0);
    assert.equal(u.s.flags.disarm,true); advance(b,1.1); assert.equal(!!u.s.flags.disarm,false);
  }
});

test('Snowsant infection talent adds E2force and only silences infected recipients at cast completion', () => {
  for (const elite of [1,2]) for (const potential of [1,5]) {
    const {b,u}=make(SNS,{elite,potential,rank:elite===1?7:10}),e=enemy(b,{infection:true});
    const forces=[]; b.pullToFront=(_e,_u,f)=>forces.push(f); cast(u); shot(b,u,[e]); advance(b,.5);
    near(forces[0],u.def.skill.bb.force+(elite===2?1:0)); assert.equal(e.findBuff('silence'),null);
    advance(b,2.2); const silence=e.findBuff('silence'); assert.ok(silence);
    near(silence.duration,u.def.talents[0].bb['skill@silence']);
  }
  const {b,u}=make(),e=enemy(b); cast(u); shot(b,u,[e]); advance(b,3);
  assert.equal(e.findBuff('silence'),null);
});

test('Snowsant S2 catches every nearby ground recipient in the target-centered net without an invented three-target cap', () => {
  const {b,u}=make(SNS,{skill:1}); const all=Array.from({length:6},(_,i)=>enemy(b,{c:5+i*.1,res:20}));
  const flyer=enemy(b,{fly:true}); b.pullToFront=()=>{}; cast(u); advance(b,1.2);
  for (const e of all) near(100000-e.hp,u.s.atk*u.def.skill.bb.atk_scale*.8);
  near(flyer.hp,100000); advance(b,1.5); assert.ok(all.every(e=>e.findBuff('sluggish')));
});

test('Snowsant S2 CAST selection acquires new arrivals and drops those leaving before release', () => {
  const {b,u}=make(SNS,{skill:1}),old=enemy(b); cast(u); move(b,old,0,0);
  const arriving=enemy(b,{c:6}); b.pullToFront=()=>{}; advance(b,1.3);
  near(old.hp,100000); assert.ok(arriving.hp<100000);
});

test('Snowsant S2 empty or flyer-only range cannot consume a charged manual cast', () => {
  const {b,u}=make(SNS,{skill:1}); u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.activate('test'),false); enemy(b,{fly:true});
  assert.equal(u.skill.activate('test'),false); near(u.skill.spTotal,u.skill.spCost);
});

test('Almond S1 uses ground normal priority, uncapped ASPD and original stored-charge limits', () => {
  for (const rank of [1,7,10]) {
    const {b,u}=make(ALM,{rank}),e=enemy(b); enemy(b,{c:6,fly:true}); cast(u);
    assert.equal(u.skill.maxCharges,u.def.skill.bb.cnt); near(u.skill.charges,u.skill.maxCharges-1);
    b.addBuff(u,{key:'test:fast',mods:{aspd:100}}); const p=effectiveProfile(u);
    near(p.windup(b,u),.25); assert.equal(p.canHitFly,false); assert.deepEqual(acquireTargets(b,u,p),[e]);
  }
});

test('Almond S1 INPUT selection does not retarget a vanished locked enemy and refunds original dead-target SP', () => {
  const {b,u}=make(ALM),dead=enemy(b); cast(u); const spent=u.skill.spTotal;
  shot(b,u,[dead]); b.kill(dead,null); const other=enemy(b);
  advance(b,1.7); near(other.hp,100000);
  near(u.skill.spTotal,Math.min(u.skill.spCost*u.skill.maxCharges,spent+u.skill.spCost+u.def.talents[0].bb.sp));
});

test('Almond first-activation forced SP arrives after cast completion and is not repeated on subsequent casts', () => {
  const {b,u}=make(ALM),e=enemy(b); b.pullToFront=()=>{}; cast(u,false); shot(b,u,[e]);
  advance(b,.7); near(u.skill.spTotal,0); untilFinished(b,u);
  near(u.skill.spTotal,u.def.talents[0].bb.sp,b.dt+.0001);
  cast(u,false); shot(b,u,[e]); advance(b,2.6); assert.ok(u.skill.spTotal<1);
});

test('Almond first-activation claim remains spent across owner retreat and redeployment', () => {
  const {b,u,deploy}=make(ALM),e=enemy(b); b.pullToFront=()=>{}; cast(u,false); shot(b,u,[e]); advance(b,2.7);
  b.retreat(u); b.bench[ALM].readyAt=b.time; const next=deploy();
  cast(next,false); shot(b,next,[e]); advance(b,2.6); assert.ok(next.skill.spTotal<1);
});

test('Almond E1/E2potential select exact first-activation talent SP blackboards', () => {
  for (const elite of [1,2]) for (const potential of [1,5]) {
    const {b,u}=make(ALM,{elite,potential,rank:elite===1?7:10}),e=enemy(b); b.pullToFront=()=>{};
    cast(u,false); shot(b,u,[e]); advance(b,.7); untilFinished(b,u);
    near(u.skill.spTotal,u.def.talents[0].bb.sp,b.dt+.0001);
  }
});

test('Almond S2 binds its farthest ground or aerial input, pulses at1.5/3seconds and waits source end clip', () => {
  const {b,u}=make(ALM,{skill:1}),close=enemy(b),far=enemy(b,{c:6,fly:true});
  const forces=[]; b.pullToFront=(_e,_u,f)=>forces.push(f); cast(u);
  advance(b,.95); assert.equal(far.s.flags.bind,true); near(far.hp,100000); near(close.hp,100000);
  advance(b,1.3); near(far.hp,100000); advance(b,.15);
  const damage=u.s.atk*u.def.skill.bb.atk_scale-far.s.def; near(100000-far.hp,damage);
  advance(b,1.5); near(100000-far.hp,damage*2); assert.deepEqual(forces,[2,2]);
  advance(b,1.15); assert.equal(!!far.s.flags.bind,false); assert.equal(u.s.flags.disarm,true);
  advance(b,.8); assert.equal(u.skill.active,false); assert.equal(!!u.s.flags.disarm,false);
});

test('Almond S2 bind immunity leaves damage and force pulses while respecting bind immunity', () => {
  const {b,u}=make(ALM,{skill:1}),e=enemy(b); e.def.immune.add('bind'); b.pullToFront=()=>{};
  cast(u); advance(b,1); assert.equal(!!e.s.flags.bind,false); advance(b,1.5); assert.ok(e.hp<100000);
});

test('Almond S2 ends early when its linked input dies and never transfers the link to another enemy', () => {
  const {b,u}=make(ALM,{skill:1}),e=enemy(b); cast(u); advance(b,1); b.kill(e,null);
  const other=enemy(b); advance(b,.9); assert.equal(u.skill.active,false);
  assert.equal(!!other.s.flags.bind,false); near(other.hp,100000);
});

test('stun before release interrupts hooks without emitting a projectile or later damage', () => {
  for (const id of [SNS,ALM]) {
    const {b,u}=make(id,{skill:1}),e=enemy(b); cast(u); advance(b,.1);
    b.applyStatus(u,'stun',{duration:2}); advance(b,3); near(e.hp,100000);
    assert.equal(b.projectiles.list.length,0); assert.equal(u.skill.active,false);
    assert.equal(!!u.s.flags.disarm,false);
  }
});

test('withdrawal and control interruption remove only the cast-owned link and its queued pulses', () => {
  for (const retreat of [false,true]) {
    const {b,u}=make(ALM,{skill:1}),e=enemy(b); cast(u); advance(b,1);
    b.addBuff(e,{key:'test:anotherbind',flags:{bind:true,noMove:true}});
    if (retreat) b.retreat(u); else b.applyStatus(u,'stun',{duration:2});
    advance(b,5); near(e.hp,100000); assert.ok(e.findBuff('test:anotherbind'));
    assert.equal(e.buffs.some(v=>v.key.startsWith('almond:hook:')),false);
  }
});

test('source facings and literal begin clips survive attack events and natural AI activates the charged hook', () => {
  const {b,u}=make(ALM,{dir:'LEFT'}),e=enemy(b,{c:3}); cast(u,false); u.atkCd=0;
  advance(b,.1); const attack=b._evq.filter(v=>v[0]==='atk').at(-1);
  assert.equal(attack[4].animation,'Skill_1_Begin'); near(attack[4].windup,.5);
  advance(b,2.5); assert.ok(e.hp<100000); assert.equal(!!u.s.flags.disarm,false);
});

test('Snowsant net is centered on the farthest trigger victim and leaves distant groups untouched', () => {
  const {b,u}=make(SNS,{skill:1}); const close=enemy(b,{c:5}),far=enemy(b,{c:7});
  const neighbor=enemy(b,{r:3.5,c:7}),outside=enemy(b,{r:2,c:7});
  b.pullToFront=()=>{}; cast(u); advance(b,1.5);
  assert.ok(far.hp<100000); assert.ok(neighbor.hp<100000);
  near(close.hp,100000); near(outside.hp,100000);
});

test('living INPUT disappearance suppresses the hit without a dead-target refund', () => {
  const {b,u}=make(ALM),e=enemy(b); cast(u,false); shot(b,u,[e]);
  e.hidden=true; advance(b,.7); untilFinished(b,u);
  near(e.hp,100000); near(u.skill.spTotal,u.def.talents[0].bb.sp,b.dt+.0001);
});

test('interruption of Snowsant link cancels delayed sluggish and end-of-cast silence', () => {
  const {b,u}=make(),e=enemy(b,{infection:true}); cast(u); shot(b,u,[e]); advance(b,.5);
  b.applyStatus(u,'stun',{duration:2}); advance(b,3);
  assert.equal(e.findBuff('sluggish'),null); assert.equal(e.findBuff('silence'),null);
  assert.equal(u.mem.hookCast,null); assert.equal(!!u.s.flags.noSp,false);
});
