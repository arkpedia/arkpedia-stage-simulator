// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID as ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { prepareMarcilFamiliar as prepare, MARCIL_FAMILIAR_CONTRACT as contract, verifyMarcilFamiliarSource }
  from '../server/sim/content/arkpedia-marcil-familiar.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { make as baseMake, advance, until, born, enemy } from './helpers/marcil-fixture.js';
const make = opts => baseMake({ skill: 2, prepare, contract, ...opts });
const near = (a,z) => assert.ok(Math.abs(a-z) < 1e-5, `${a} != ${z}`);
function enable(f) { until(f, () => f.controller.mode === 's2', 20); }
function upgrade(f) {
  f.u.skill.setSpTotal(80); enable(f);
  assert.equal(f.controller.tier, 1); f.b.bench[ID] = { unit: f.u };
  assert.equal(f.b.activateOperator(ID), true); enable(f);
  assert.equal(f.controller.tier, 2);
}

test('S2 requires source-selected ranks, native projectile chains and its own opt-in contract', () => {
  verifyMarcilFamiliarSource(); assert.equal(contract.frameParity, false);
  assert.deepEqual(evidence.enabledOperators, []); assert.equal(data.operators[ID], undefined);
  assert.throws(() => make({ contract: { ...contract } }), /explicit familiar contract/);
  for (const skill of [1,3]) assert.throws(() => make({ skill }), /selected S2/);
  for (const mutate of [d=>d.stats.atk++, d=>d.skill.bb.attack_speed++, d=>d.skill.bb.sp_cost++,
    d=>d.skill.rangeGrid=[[1,99]], d=>d.talents[0].bb.atk++]) assert.throws(()=>make({mutate}), /Incomplete/);
});

for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank} automatically chants, debits once and keeps its first familiar indefinitely`,()=>{
  const f=make({rank}); const mana=f.wallet.value, ordinary=f.u.s.atk;
  advance(f,.1); assert.equal(f.controller.mode,'ordinary'); assert.equal(f.u.skill.active,false);
  assert.equal(f.u.mem.regularFormVisual.clip,'Start'); born(f); assert.equal(f.controller.mode,'chant'); assert.equal(f.u.skill.active,true);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin_A'); near(f.u.s.atk,ordinary);
  assert.equal(f.u.skill.end('manual'),false); advance(f,.5);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Chant'); assert.equal(f.wallet.value,mana);
  enable(f); assert.equal(f.controller.tier,1); assert.equal(f.wallet.value,mana-f.record.bb.skill_cost_min_sp);
  near(f.u.s.atk,f.u.base.atk*(1+f.record.bb.atk));
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle_A'); advance(f,30);
  assert.equal(f.u.skill.active,true); assert.equal(f.u.skill.activations,1); assert.equal(f.wallet.value,0);
  assert.equal(f.u.skill.gainSp(99,'gift'),0); assert.equal(f.controller.canCancel(),true);
  const target = enemy(f); until(f, () => f.hits.length === 1);
  near(f.hits[0].hpLoss, f.u.base.atk * (1 + f.record.bb.atk));
  near(target.findBuff('sluggish').duration, f.record.bb['attack@sluggish']);
});

test('not enough starting mana at E1 waits for a legal grant, without an invented on-field recharge',()=>{
  const f=make({elite:1,rank:7}); advance(f,30);
  assert.equal(f.controller.mode,'ordinary'); assert.equal(f.wallet.value,10); assert.equal(f.u.skill.active,false);
  assert.equal(f.u.skill.gainSp(25,'gift'),25); advance(f,f.b.dt);
  assert.equal(f.controller.mode,'chant'); enable(f); assert.equal(f.wallet.value,0);
});

test('a failed chant costs nothing and creates no persistent enhancement mark',()=>{
  const f=make(); born(f); assert.equal(f.controller.mode,'chant');
  f.mana.controller.consume(1); // move below its source minimum after the automatic cast
  until(f,()=>!f.u.skill.active,1);
  assert.equal(f.wallet.value,34); assert.equal(f.controller.enhancement,false);
  assert.equal(f.controller.tier,0); assert.equal(f.u.findBuff('marcil:s2'),null);
  f.u.skill.gainSp(1,'gift'); enable(f); assert.equal(f.controller.tier,1); assert.equal(f.wallet.value,0);
});

test('first successful cancel preserves the mark and remaining mana; the next enable upgrades and cannot be manually canceled',()=>{
  const f=make(); upgrade(f);
  assert.equal(f.wallet.value,10); assert.equal(f.u.skill.activations,2);
  near(f.u.s.atk,f.u.base.atk*(1+f.record.bb.atk+f.record.talentBb[0].atk));
  near(f.u.s.aspd,100+f.record.bb.attack_speed);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle_B');
  assert.equal(f.b.activateOperator(ID),false); assert.equal(f.u.skill.end('manual'),false);
  assert.equal(skillHud(f.u.skill).canCancel,false); assert.equal(skillHud(f.u.skill).canActivate,false);
  advance(f,50); assert.equal(f.wallet.value,10); assert.equal(f.u.skill.active,true);
});

test('S2 projectile births use the original loop event, source speed and cached ATK, with no per-shot mana cost',()=>{
  const f=make(); enable(f); const t=enemy(f); until(f,()=>f.b.projectiles.list.length===1);
  const p=f.b.projectiles.list[0]; assert.equal(p.speed,10); assert.equal(p.maxAge,10);
  assert.equal(p.data.projectileKey,'projectile_chr_marcil_s2_1'); assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop_A');
  assert.equal(f.u.mem.regularFormVisual.idle, 'Skill_2_Idle_A');
  assert.equal(f.hits.length,0); const atk=f.u.s.atk, phase=f.controller.phase;
  near(phase.releaseAt-phase.startedAt,.4333333373069763);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:5}});
  until(f,()=>f.hits.length===1); near(f.hits[0].hpLoss,atk); assert.equal(f.hits[0].target,t);
  assert.equal(f.hits[0].dmg.isSkill,true); assert.equal(f.hits[0].dmg.isSplash,true);
  assert.equal(f.wallet.value,0); assert.equal(!!t.s.flags.stun,false); assert.ok(t.findBuff('sluggish'));
});

test('upgraded original range reaches the additional front column and its B event creates the enhanced projectile',()=>{
  const f=make(); enable(f); const t=enemy(f,{col:9}); advance(f,4); assert.equal(f.hits.length,0);
  f.b.bench[ID]={unit:f.u}; assert.equal(f.b.activateOperator(ID),true); f.u.skill.gainSp(80,'gift'); enable(f);
  until(f,()=>f.b.projectiles.list.length===1);
  assert.equal(f.b.projectiles.list[0].data.projectileKey,'projectile_chr_marcil_s2_2_power');
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop_B'); until(f,()=>f.hits.length===1);
  assert.equal(f.u.mem.regularFormVisual.idle, 'Skill_2_Idle_B');
  assert.equal(f.hits[0].target,t); assert.ok(t.s.flags.stun);
});

test('selected mana branch changes only the splash circle; upgraded stun applies only to its retained main target',()=>{
  for(const power of [false,true]){
    const f=make(); if(power)f.u.skill.setSpTotal(80); enable(f);
    const main=enemy(f), second=enemy(f,{col:8.3});
    until(f,()=>f.hits.length>0);
    assert.equal(f.hits.some(x=>x.target===second),power); assert.ok(main.findBuff('sluggish'));
    assert.equal(f.wallet.value,power?45:0);
  }
  const f=make(); upgrade(f); const main=enemy(f), second=enemy(f,{row:5.5});
  until(f,()=>f.hits.length===2); assert.ok(main.s.flags.stun); assert.ok(main.findBuff('sluggish'));
  assert.ok(second.findBuff('sluggish')); assert.equal(!!second.s.flags.stun,false);
  assert.equal(f.hits[0].dmg.attackId,f.hits[1].dmg.attackId); assert.equal(f.wallet.value,10);
});

test('long born flights do not block later shots; cancellation retains captured projectiles without another debit',()=>{
  const f=make(); enable(f); const t=enemy(f); until(f,()=>f.b.projectiles.list.length===1);
  const first=f.b.projectiles.list[0]; first.speed=.01; t.x=15; t.y=5;
  f.b.bench[ID]={unit:f.u}; assert.equal(f.b.activateOperator(ID),true);
  assert.equal(f.u.skill.active,false); assert.equal(f.wallet.value,0);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:5}});
  first.speed=10; until(f,()=>f.hits.length===1,2);
  near(f.hits[0].hpLoss,f.u.base.atk*(1+f.record.bb.atk));
  const g=make(); enable(g); const target=enemy(g); until(g,()=>g.b.projectiles.list.length===1);
  const flight=g.b.projectiles.list[0]; flight.speed=.01; target.x=8; target.y=5;
  advance(g,3); assert.equal(g.attacks.length,2); assert.equal(g.wallet.value,0);
});

test('beforeAttack cancellation or retirement never births an S2 shot',()=>{
  for(const action of ['targets','retreat','cancel']){
    const f=make(); enable(f); enemy(f); let invoked=false;
    f.b.on('beforeAttack',x=>{if(x.attacker!==f.u)return;invoked=true;
      if(action==='targets')x.targets=[];if(action==='retreat')f.b.retreat(f.u,{permanent:true});
      if(action==='cancel')f.u.skill.end('manual');});
    until(f,()=>invoked); assert.equal(f.b.projectiles.list.length,0); assert.equal(f.hits.length,0);
    assert.equal(f.attacks.length,0); assert.equal(f.wallet.value,0);
  }
});

test('control interrupts a main chant, but a running familiar keeps its modifier while discarding an unfired attack',()=>{
  const f=make(); advance(f,.2); f.b.applyStatus(f.u,'stun',{duration:2}); advance(f,.1);
  assert.equal(f.u.skill.active,false); assert.equal(f.wallet.value,35); assert.equal(f.controller.enhancement,false);
  advance(f,2); enable(f); assert.equal(f.controller.tier,1);
  const g=make(); enable(g); enemy(g); until(g,()=>g.controller.phase?.kind==='attack');
  const atk=g.u.s.atk; g.b.applyStatus(g.u,'stun',{duration:g.b.dt}); advance(g,.1);
  assert.equal(g.u.skill.active,true); near(g.u.s.atk,atk); assert.equal(g.b.projectiles.list.length,0);
  until(g,()=>g.hits.length>0); assert.equal(g.wallet.value,0);
});

test('familiar shots outlive death/retreat using their own cached damage, and a fresh owner does not retain enhancement',()=>{
  for(const action of ['death','retreat']){
    const f=make(); upgrade(f); enemy(f); until(f,()=>f.b.projectiles.list.length===1);
    const atk=f.u.s.atk, p=f.b.projectiles.list[0]; p.speed=.1;
    if(action==='death')f.b.kill(f.u);else f.b.retreat(f.u,{permanent:true});
    assert.equal(f.controller.stopped,true); assert.equal(f.u.findBuff('marcil:s2'),null);
    f.u.base.atk=99999; f.u.markDirty(); const next=f.create();
    assert.equal(next.controller.enhancement,false); assert.equal(next.wallet,f.wallet);
    assert.equal(next.u.skill.active,false); p.speed=10; until(f,()=>f.hits.length===1);
    near(f.hits[0].hpLoss,atk); assert.equal(f.wallet.value,10);
  }
});

test('hidden, dead and life-changed inputs cannot birth a projectile; dead targets during flight still leave a splash centre',()=>{
  for(const action of ['hidden','dead','new-life']){
    const f=make(); enable(f); const t=enemy(f); until(f,()=>f.controller.phase?.kind==='attack');
    if(action==='hidden')t.hidden=true;if(action==='dead')f.b.kill(t);if(action==='new-life')t.deploySeq++;
    advance(f,.6); assert.equal(f.b.projectiles.list.length,0); assert.equal(f.hits.length,0);
  }
  const f=make(); f.u.skill.setSpTotal(80); enable(f); const main=enemy(f),second=enemy(f,{row:5.5});
  until(f,()=>f.b.projectiles.list.length===1);f.b.kill(main);until(f,()=>f.hits.length===1);
  assert.equal(f.hits[0].target,second); assert.equal(f.wallet.value,45);
});

test('four familiar facings use native loops and both normal/upgraded ranges without inventing Back death art',()=>{
  for(const [dir,row,col,face]of[['RIGHT',5,7,'Front'],['UP',6,6,'Back'],['LEFT',5,5,'Back'],['DOWN',4,6,'Front']]){
    const f=make({dir}); enable(f); const t=enemy(f,{row,col}); until(f,()=>f.hits.length===1);
    assert.equal(f.hits[0].target,t); assert.equal(f.controller.model(),evidence.models[ID][face]);
    assert.equal(f.u.mem.regularDeathVisual?.clip,face==='Front'?'Die':undefined);
  }
});

test('source-retirement inside familiar buff enable leaves no modifier or future attack',()=>{
  const f=make(); f.b.on('beforeBuff',x=>{if(x.unit===f.u&&x.buff?.key==='marcil:s2')f.b.retreat(f.u,{permanent:true});});
  advance(f,15); assert.equal(f.u.alive,false); assert.equal(f.u.findBuff('marcil:s2'),null);
  assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.attacks.length,0);
});

test('battle end cancels pending flights and cleans native resource and familiar modifiers',()=>{
  const f=make(); enable(f); enemy(f);until(f,()=>f.b.projectiles.list.length===1);
  f.b.forceEnd('fixture');assert.equal(f.controller.stopped,true);assert.equal(f.wallet.closed,true);
  assert.equal(f.controller.handles.length,0);assert.equal(f.controller.flights.size,0);
  assert.equal(f.u.findBuff('marcil:s2'),null);assert.equal(f.u.skill.active,false);
  assert.equal(f.b.projectiles.list.length,0);advance(f,20);assert.equal(f.hits.length,0);
});

test('upgraded displayed range follows its original fixed grid and restores on removal', () => {
  const f = make(); upgrade(f);
  assert.ok(f.u.rangeKeys.includes(5 * 21 + 9)); assert.ok(f.controller.keys().has(5 * 21 + 9));
  f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 3 } }); f.b.refreshRange(f.u);
  assert.equal(f.u.rangeKeys.includes(5 * 21 + 10), false);
  f.b.kill(f.u); assert.equal(f.u.skill.spec.targeting, undefined);
});

test('original familiar events cap at one playback speed and stretch with slow attack speed', () => {
  for (const [aspd, speed] of [[200, 1], [-50, .5]]) {
    const f = make(); enable(f); enemy(f); f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
    near(p.speed, speed); near(p.releaseAt - p.startedAt, .4333333373069763 / speed);
    near(p.readyAt - p.startedAt, Math.max(f.u.s.interval, 2 / speed));
  }
});

test('source projectile branches retain aerial/area selection and normal status immunity', () => {
  const f = make(); upgrade(f); const main = enemy(f, { fly: true });
  main.def = { ...main.def, immune: new Set([...main.def.immune, 'stun']) }; main.markDirty();
  const second = enemy(f, { row: 5.5, flags: { camou: true } });
  const stealth = enemy(f, { row: 5.6, flags: { stealth: true } });
  const sleeping = enemy(f, { row: 5.7 }); f.b.applyStatus(sleeping, 'sleep', { duration: 20 });
  until(f, () => f.hits.length === 2);
  assert.ok(f.hits.some(h => h.target === main)); assert.ok(f.hits.some(h => h.target === second));
  assert.equal(!!main.s.flags.stun, false); assert.ok(main.findBuff('sluggish'));
  assert.equal(f.hits.some(h => h.target === stealth || h.target === sleeping), false);
});

test('a removed projectile cannot manufacture a later splash or a mana debit', () => {
  const f = make(); enable(f); enemy(f); until(f, () => f.b.projectiles.list.length === 1);
  f.b.removeProjectiles(p => p.source === f.u); advance(f, .6);
  assert.equal(f.controller.flights.size, 0); assert.equal(f.hits.length, 0); assert.equal(f.wallet.value, 0);
});

test('original off-field wallet recovery can fund both source enables without forced activation or on-field recharge', () => {
  const f = make({ deferred: true }); advance(f, 46); assert.equal(f.wallet.value, 80);
  assert.ok(f.b._deploy(f.u, { initial: false })); enable(f); assert.equal(f.wallet.value, 45);
  f.b.bench[ID] = { unit: f.u }; assert.equal(f.b.activateOperator(ID), true);
  enable(f); assert.equal(f.wallet.value, 10); assert.equal(f.controller.tier, 2);
});

test('a temporarily hidden owner cannot resume a stale familiar windup or retain an incomplete chant', () => {
  for (const phase of ['chant', 'familiar']) {
    const f = make();
    if (phase === 'chant') advance(f, 1);
    else { enable(f); enemy(f); until(f, () => f.controller.phase?.kind === 'attack'); }
    f.u.hidden = true; advance(f, 1); assert.equal(f.b.projectiles.list.length, 0);
    assert.equal(f.controller.phase, null); assert.equal(f.u.skill.active, phase === 'familiar');
    f.u.hidden = false; advance(f, .1); assert.equal(f.hits.length, 0);
    if (phase === 'familiar') until(f, () => f.hits.length === 1);
    else { enable(f); assert.equal(f.controller.tier, 1); }
  }
});

test('real Senshi final meals cannot recharge either S2 main chanting or a running familiar', () => {
  for (const phase of ['chant', 'familiar']) {
    const f = make(); if (phase === 'familiar') enable(f);
    const senshi = f.b.deployOperator('char_4143_sensi', 5, 5, 'RIGHT');
    senshi.atkCd = 1000; senshi.skill.rule = 'NEVER';
    senshi.skill.setSpTotal(senshi.skill.spCost); assert.equal(senshi.skill.activate('fixture'), true);
    const mana = f.wallet.value; advance(f, 9.4);
    assert.equal(f.wallet.value, mana); assert.equal(f.u.skill.active, true);
    assert.equal(f.controller.mode, phase === 'chant' ? 'chant' : 's2');
  }
});

test('battle finish inside a splash callback prevents later damage and status application', () => {
  const f = make(); enable(f); const main = enemy(f), second = enemy(f, { row: 5.5 });
  f.b.on('damaged', x => { if (x.source === f.u) f.b.forceEnd('fixture'); });
  until(f, () => f.b.finished);
  assert.equal(f.hits.length, 1); assert.ok(main.hp < main.s.maxHp); assert.equal(second.hp, second.s.maxHp);
  assert.equal(main.findBuff('sluggish'), null); assert.equal(second.findBuff('sluggish'), null);
  assert.equal(f.controller.flights.size, 0); assert.equal(f.u.findBuff('marcil:s2'), null);
});
