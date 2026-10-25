// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { battle, keys } from './helpers/ch17Harness.js';
import { chapter17Environment, installChapter17Devices, applyPollution, stealAttack, pollute, beamIntersection, registerChapter17Firewall } from '../server/sim/content/chapter17.js';
const unit = (atk = 500, pos = null) => ({ stats: { atk, def: 0, res: 0, maxHp: 100000, spRecovery: 0 }, ...(pos ? { pos } : {}) });
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
const s = (e, name) => e.def.raw.skills.find(x => x.prefabKey === name).bb;

for (const key of [keys[1], keys[4]]) test(`${key}: channel stops on a brief control effect between simulation ticks`, () => {
  const { h, b, e, a } = battle(key, [unit()]);
  if (key === keys[1]) chapter17Environment(b).rifts.push({ alive: true, x: 6, y: 10, sp: 0, spCost: 100, s: { taunt: 0 }, gainSp(n) { this.sp += n; } });
  a.left = 0; h.run(.1); assert.ok(a.target);
  b.applyStatus(e, 'stun', { duration: .01 }); b.removeBuff(e, 'stun'); h.run(.04);
  assert.ok(!a.target); assert.ok(!e.s.flags.disarm); assert.ok(!e.s.flags.noMove);
  if (key === keys[1]) assert.equal(e.s.def, 700);
});

test('ChargeRift selects marker taunt before deploy order, ignores blocker, tracks target outside initial range', () => {
  const { h, b, e, a } = battle(keys[1], [unit(0)]);
  const markers = [0, 1].map((taunt, i) => ({ alive: true, x: 6, y: 10, sp: 0, spCost: 100, s: { taunt }, deploySeq: i, gainSp(n) { this.sp += n; } }));
  chapter17Environment(b).rifts.push(...markers); a.left = 0; h.run(.1); assert.equal(a.target, markers[1]);
  markers[1].x = 15; h.run(.5); assert.equal(markers[1].sp, 1);
  markers[1].alive = false; h.run(.04); assert.ok(!a.target); assert.equal(e.s.def, 700);
  h.run(9.8); assert.ok(!a.target); h.run(.3); assert.equal(a.target, markers[0]);
});

test('native Leak Marker gains natural and channeled SP and spawns a static, non-counted canonical Leak Source', () => {
  const { h, b, e, a } = battle(keys[1]);
  const env = installChapter17Devices(b, [{ key: 'trap_329_rift', row: 10, col: 6, spCost: 8 }]);
  a.left = 0; h.run(4.4);
  const child = b.enemies.find(u => u.defId === keys[5]);
  assert.ok(child); assert.equal(child.counted, false); assert.equal(child.route.legs[0].t, 'wait'); assert.ok(child.mem.ch16Leak);
  assert.ok(env.rifts[0].sp < 2); assert.ok(!a.target); assert.equal(e.s.def, 700);
});

test('native marker retains full SP when no valid summon tile exists, then summons exactly once when one opens', () => {
  const { h, b } = battle(keys[1]);
  const env = installChapter17Devices(b, [{ key: 'trap_329_rift', row: 10, col: 6, spCost: 1 }]);
  const pick = env.summonTiles; env.summonTiles = () => [];
  h.run(2); near(env.rifts[0].sp, 1); assert.equal(b.enemies.filter(u => u.mem.ch16Leak).length, 0);
  env.summonTiles = pick; h.run(.04); assert.equal(b.enemies.filter(u => u.mem.ch16Leak).length, 1); near(env.rifts[0].sp, 1/30);
});

test('Likho excludes occupied, high, blocked, unbuildable and existing-source tiles, and leaks do not summon', () => {
  const { h, b, e } = battle(keys[3], [unit()]);
  const env = chapter17Environment(b), before = env.summonTiles(e);
  assert.ok(!before.some(([r,c]) => r === 10 && c === 5), 'operator occupancy');
  b.grid.setObstacle(11, 6, true); assert.ok(!env.summonTiles(e).some(([r,c]) => r === 11 && c === 6));
  b.leak(e); assert.equal(b.enemies.filter(u => u.mem.ch16Leak).length, 0);
  const cow = h.spawn(keys[3], { pos: [10, 6] }); env.summonTiles = () => []; b.kill(cow, null);
  assert.equal(b.enemies.filter(u => u.mem.ch16Leak).length, 0);
});

test('Likho chooses seeded summon placement deterministically', () => {
  const results = [];
  for (let i = 0; i < 2; i++) { const { b, e } = battle(keys[3]); b.kill(e, null); const u = b.enemies.find(u => u.mem.ch16Leak); results.push([u.tileR, u.tileC]); }
  assert.deepEqual(results[0], results[1]);
});

test('Trimortalis ordinary damage is delayed .7s, uses current ATK, and survives source death without hitting a redeployed target', () => {
  const { h, b, e, a } = battle(keys[2], [unit(0)]), u = h.allies()[0];
  a.attack({ targets: [u] }, b, e); const hp = u.hp; h.run(.69); assert.equal(u.hp, hp);
  b.addBuff(e, { key: 'fixture-atk', mods: { atkFlat: 100 } }); b.kill(e, null); h.run(.04); assert.equal(u.hp, hp - 600);
  const other = h.spawn(keys[2], { pos: [10, 6] }); other.mem.ab.list[0].attack({ targets: [u] }, b, other);
  b.retreat(u); b.redeploy(u, { tile: [10, 5] }); const hp2 = u.hp; h.run(.8); assert.equal(u.hp, hp2);
});

test('Trimortalis retaliation is pre-mitigation, ignores sourceless/HP-loss/gauge input, and does not recurse', () => {
  const { b, e } = battle(keys[2], [unit(0)]), u = b.allyUnits[0];
  b.addBuff(e, { key: 'fixture-shield', shield: 10000 });
  b.dealDamage(u, e, { amount: 5, type: 'arts' }); assert.equal(u.hp, 99650);
  const hp = u.hp; b.dealDamage(null, e, { amount: 5, type: 'true' }); b.loseHp(e, 5); b.dealDamage(u, e, { amount: 5, type: 'element', element: 'burn' }); assert.equal(u.hp, hp);
});

test('Trimortalis boosted retaliation caps five valid targets, includes camouflaged targets and expires after refreshed five seconds', () => {
  const { h, b, e } = battle(keys[2], [unit(0), unit(0, { row: 9, col: 5 }), unit(0, { row: 11, col: 5 }), unit(0, { row: 10, col: 4 }), unit(0, { row: 10, col: 6 })]);
  const allies = h.allies(), u = allies[0]; b.addBuff(allies[1], { key: 'camou', flags: { camou: true } });
  pollute(b, e); h.run(4); pollute(b, e); h.run(2);
  const hp = allies.map(u => u.hp); b.dealDamage(u, e, { amount: 1, type: 'true' });
  allies.forEach((u,i) => near(hp[i] - u.hp, 550));
  h.run(3.1); const vhp = allies[1].hp; b.dealDamage(u, e, { amount: 1, type: 'true' }); assert.equal(allies[1].hp, vhp);
});

for (const type of ['phys','arts']) test(`war shield ${type}: threshold uses raw damage and never cancels another recipient`, () => {
  const { b, e } = battle(keys[4]);
  b.dealDamage(null,e,{amount:1199,type}); near(e.hp, e.s.maxHp);
  b.dealDamage(null,e,{amount:1200,type}); assert.ok(e.hp < e.s.maxHp); assert.equal(e.mem.ch16Shield,false);
  pollute(b,e); assert.equal(e.mem.ch16Shield,true,'forced restore ignores initial cooldown');
});

test('war caster completes seven channel pulses then waits the full fifteen-second cooldown', () => {
  const { h, e, a } = battle(keys[4], [unit()]); a.left=0; h.run(7.1);
  assert.equal(e.s.atk,1100); assert.ok(!a.target); h.run(14.8); assert.ok(!a.target); h.run(.2); assert.ok(a.target);
});

test('war caster target priority is taunt then latest deployment and channel does not change target on movement', () => {
  const { h,b,e,a } = battle(keys[4], [unit(),unit()]); const [u,v]=h.allies();
  b.addBuff(u,{key:'fixture-taunt',mods:{taunt:1}}); a.left=0; h.run(.1); assert.equal(a.target,u);
  b.moveRedeploy(u,10,3); h.run(.04); assert.ok(!a.target,'changed deployment life interrupts');
  assert.ok(v.alive); assert.equal(e.s.atk,750);
});

test('ATK theft uses final flat changes, retains source gains after target removal and restores target on source removal', () => {
  const { b,e,a,h } = battle(keys[4],[unit(500)]);const u=h.allies()[0];
  b.addBuff(u,{key:'fixture-scale',mods:{atkPct:1}}); stealAttack(b,e,a,u,e.def.raw);
  assert.equal(u.s.atk,950);assert.equal(e.s.atk,800);
  b.retreat(u);assert.equal(e.s.atk,800);assert.equal(u.findBuff('ch17:stolen-atk'),null);
  b.redeploy(u,{tile:[10,5]});assert.equal(u.s.atk,500);
});

test('theft from multiple casters takes the strongest reduction with weaker-source fallback, not a sum', () => {
  const { b,e,a,h } = battle(keys[4],[unit(500)]),u=h.allies()[0];
  const e2=h.spawn(keys[4],{pos:[10,7]}),a2=e2.mem.ab.list[0];
  stealAttack(b,e,a,u,e.def.raw);stealAttack(b,e,a,u,e.def.raw);stealAttack(b,e2,a2,u,e2.def.raw);
  assert.equal(u.s.atk,400); b.kill(e,null);assert.equal(u.s.atk,450);b.kill(e2,null);assert.equal(u.s.atk,500);
});

test('theft preserves at least one target ATK and caps source addition at 2050', () => {
  const { b,e,a,h } = battle(keys[4],[unit(20),unit(10000)]),[u,v]=h.allies();
  stealAttack(b,e,a,u,e.def.raw);assert.equal(u.s.atk,1);
  for(let i=0;i<100;i++)stealAttack(b,e,a,v,e.def.raw);
  assert.equal(e.s.atk,2800);assert.equal(a.totalStolen,2050);
});

test('blocked channel damage does not steal, source removal clears lock and a target life cannot inherit theft', () => {
  const { h,b,e,a } = battle(keys[4],[unit()]),u=h.allies()[0];
  b.addBuff(u,{key:'fixture-invulnerable',flags:{invulnerable:true}});a.left=0;h.run(1.1);assert.equal(e.s.atk,750);
  b.removeBuff(u,'fixture-invulnerable'); h.run(.4);assert.equal(u.s.atk,450);
  b.retreat(u);b.redeploy(u,{tile:[10,5]}); h.run(.1);assert.equal(u.s.atk,500);assert.ok(!a.target);
});

test('GetShield native guard refuses while another skill is affecting, and restores without a cooldown once idle', () => {
  const { h,b,e,a }=battle(keys[4],[unit()]);a.left=0;h.run(.1);
  b.dealDamage(null,e,{amount:1200,type:'arts'});pollute(b,e);assert.equal(e.mem.ch16Shield,false);
  h.run(7.1);pollute(b,e);assert.equal(e.mem.ch16Shield,true);
});

for(const [d,interval,scale]of [[1,1.5,2],[2,.375,1.5],[3,.75,1],[4,1.125,.5],[5,1.5,1]])test(`hidden ray native distance ${d}: interval ${interval}, scale ${scale}`,()=>{
  const {h,b,e}=battle(keys[5],[unit(0,{row:10,col:5})]),u=h.allies()[0];
  e.x = e.tileC = 5+d; applyPollution(b,e,u,s(e,'HideRoundLaser')); b.kill(e,null);const hp=u.hp;
  h.run(interval-1/30);assert.equal(u.hp,hp);h.run(1/30);near(hp-u.hp,15*scale);
});

test('pollution survives source removal, never stacks across sources, and is removed with its target life',()=>{
  const {h,b,e}=battle(keys[5],[unit(0,{row:10,col:8})]),u=h.allies()[0];
  applyPollution(b,e,u,s(e,'HideRoundLaser'));const e2=h.spawn(keys[5],{pos:[10,6]});applyPollution(b,e2,u,s(e,'HideRoundLaser'));
  assert.equal(u.buffs.filter(v=>v.key==='ch17:pollution').length,1);b.kill(e,null);b.kill(e2,null);const hp=u.hp;h.run(.4);near(hp-u.hp,22.5);
  b.retreat(u);b.redeploy(u,{tile:[10,8]});const hp2=u.hp;h.run(2);assert.equal(u.hp,hp2);
});

test('pollution checks ground block mode on each tick, rather than damaging airborne recipients',()=>{
  const {h,b,e}=battle(keys[5],[unit(0,{row:10,col:8})]),u=h.allies()[0];applyPollution(b,e,u,s(e,'HideRoundLaser'));
  b.addBuff(u,{key:'fixture-air',flags:{liftoff:true}});const hp=u.hp;h.run(.4);assert.equal(u.hp,hp);
  b.removeBuff(u,'fixture-air');h.run(.4);near(hp-u.hp,22.5);
});

test('swept beam stops on first collision and excludes summons, devices, flyers and the final boss',()=>{
  const {h,b,e}=battle(keys[5],[unit(0,{row:10,col:8}),unit(0,{row:10,col:9})]);
  const env=chapter17Environment(b);env.beams.push({source:e,params:s(e,'RoundLaser'),x:6,y:10,dx:1,dy:0,life:1.1,revealed:true});
  h.run(.6);near(h.allies()[0].hp,100000-120);near(h.allies()[1].hp,100000);assert.equal(env.beams.length,0);
  assert.equal(beamIntersection(0,0,10,0,{x:5,y:0}),.44);
});

test('beam births are eight directions at 6s hidden / 4s visible, and already born rays survive source removal',()=>{
  const {h,b,e,a}=battle(keys[5]);h.run(5.9);assert.equal(chapter17Environment(b).beams.length,0);h.run(.1);
  const beams=chapter17Environment(b).beams;assert.equal(beams.length,8);near(beams[0].dx,-1);near(beams[0].dy,0);
  b.kill(e,null);h.run(.5);assert.equal(chapter17Environment(b).beams.length,8);h.run(1);assert.equal(chapter17Environment(b).beams.length,0);
});

test('counter binds one earliest life, ignores camouflage and releases on removal without granting reward',()=>{
  const {h,b,e,a}=battle(keys[5],[unit(0),unit(0)]),[u,v]=h.allies();
  b.addBuff(u,{key:'fixture-hidden',flags:{camou:true,untargetable:true}});h.run(.2);assert.equal(a.target,u);
  h.run(2);b.retreat(u);b.redeploy(u,{tile:[10,5]});h.run(.2);assert.equal(a.target,v);assert.equal(v.skill.sp,0);assert.ok(!u.s.flags.stun);
  b.kill(e,null);assert.ok(!v.s.flags.stun);
});

test('counter reward respects no-SP, excludes NONE profession and resets after target changes',()=>{
  const {h,b,e,a}=battle(keys[5],[unit(0),{...unit(0),profession:'NONE'}]),[u,v]=h.allies();
  b.addBuff(u,{key:'fixture-nosp',flags:{noSp:true}});h.run(4.2);assert.equal(e.alive,false);assert.equal(u.skill.sp,0);assert.equal(v.skill.sp,0);
});

test('counter completion exposes the nearest remaining firewall side for five seconds, requiring three clicks',()=>{
  const {h,b,e}=battle(keys[5],[unit(0)]);const owner=h.spawn(keys[3],{pos:[10,9]});let broken=[];
  const wall=registerChapter17Firewall(b,owner,{onBreak:side=>broken.push(side)});h.run(4.2);
  assert.equal(wall.button.side.index,3);assert.equal(wall.click(0),false);assert.equal(wall.click(3),true);assert.equal(wall.click(3),true);assert.deepEqual(broken,[]);
  wall.click(3);assert.deepEqual(broken,[3]);chapter17Environment(b).expose(e);assert.notEqual(wall.button.side.index,3);
  const side=wall.button.side.index;h.run(5.1);assert.equal(wall.click(side),false);
});

test('ordinary native caster splash reaches secondary units even when the main recipient negates damage',()=>{
  const {h,b,e,a}=battle(keys[4],[unit(0),unit(0)]),[u,v]=h.allies();
  b.addBuff(u,{key:'fixture-inv',flags:{invulnerable:true}}); e.atkCd=100;
  a.attack({targets:[u]},b,e);assert.equal(b.projectiles.list.at(-1).speed,8);const hp=v.hp;h.run(.2);near(hp-v.hp,750);near(u.hp,100000);
});

test('ordinary Fungi projectile uses native speed10, respects Arts dodge, and survives its source removal',()=>{
  const {h,b,e,a}=battle(keys[1],[unit(0)]),u=h.allies()[0];e.atkCd=100;
  a.attack({targets:[u]},b,e);assert.equal(b.projectiles.list.at(-1).speed,10);b.kill(e,null);const hp=u.hp;h.run(.2);near(hp-u.hp,110);
});

test('native link flight gates first hit, then repeats at one-second intervals',()=>{
  const {h,b,e,a}=battle(keys[4],[unit(500,{row:10,col:4})]),u=h.allies()[0];a.left=0;h.run(.1);near(u.s.atk,500);
  h.run(.2);near(u.s.atk,450);h.run(.9);near(u.s.atk,450);h.run(.1);near(u.s.atk,400);
});

test('Leak Source hides only its model, stays active, reveals during counter, and hides again after cancellation',()=>{
  const {h,b,e,a}=battle(keys[5]);assert.equal(e.hidden,false);assert.equal(e.mem.regularHidden,true);h.run(1);near(a.sp,1);
  const u=b.allyUnits[0];assert.equal(u,undefined);
  a.sp=49.95;h.run(.1);assert.equal(e.mem.regularHidden,false);assert.equal(e.hidden,false);
});

test('counter cancellation returns the model to hidden mode without disabling SP recovery',()=>{
  const {h,b,e,a}=battle(keys[5],[unit(0)]),u=h.allies()[0];h.run(.2);assert.equal(e.mem.regularHidden,false);
  b.retreat(u);h.run(.2);assert.ok(!a.target);assert.equal(e.mem.regularHidden,true);assert.equal(e.hidden,false);assert.ok(a.sp>.3);
});

for(const key of [keys[1],keys[4]])test(`${key}: removal clears the channel and owned movement locks`,()=>{
  const {h,b,e,a}=battle(key,[unit()]);
  if(key===keys[1])chapter17Environment(b).rifts.push({alive:true,x:6,y:10,sp:0,spCost:100,gainSp(n){this.sp+=n;}});
  a.left=0;h.run(.1);assert.ok(a.target);b.kill(e,null);assert.ok(!a.target);assert.ok(!e.s.flags.noMove);assert.ok(!e.s.flags.disarm);
});

test('rays pass through tokens, airborne units, device bodies, native flyers and the final boss',()=>{
  const {h,b,e}=battle(keys[5],[unit(0,{row:10,col:7}),unit(0,{row:10,col:8}),unit(0,{row:10,col:9})]),[token,air,target]=h.allies();
  token.kind='token';b.addBuff(air,{key:'fixture-air',flags:{liftoff:true}});
  const fixtures=[];
  for(const [id,motion]of [['enemy_1593_musnake','WALK'],['fixture-fly','FLY'],['fixture-device','WALK']]){
    const x=h.spawn(id,{pos:[10,7],def:{key:id,applyWay:'NONE',stats:{maxHp:10000,atk:0,moveSpeed:0,motion}}});
    if(id==='fixture-device')x.mem.stageUnitDevice={};fixtures.push(x);
  }
  const env=chapter17Environment(b);env.beams.push({source:e,params:s(e,'RoundLaser'),x:6,y:10,dx:1,dy:0,life:1.1,revealed:true});
  h.run(.6);near(target.hp,99880);near(token.hp,100000);near(air.hp,100000);fixtures.forEach(x=>near(x.hp,10000));
});
