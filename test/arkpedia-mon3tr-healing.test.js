// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { MON3TR_ID as ID } from '../server/sim/content/arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-mon3tr-healing.js';
import { make, ally, advance, until, near, disarm } from './helpers/mon3tr-fixture.js';

test('healing diagnostics require exact source and contract and do not enable S2/S3 or public selection', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /healing contract/);
  assert.throws(() => make({ mutate: def => { def.stats.atk++; } }), /selected source/);
  assert.equal(data.operators[ID], undefined);
  for (const skill of [2, 3]) {
    const f = make({ skill }); ally(f); f.u.skill.setSpTotal(99);
    assert.equal(f.u.skill.activate(), false); assert.equal(f.u.skill.active, false);
  }
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} heals four counted recipients with source scaling, decay and one attack account`, () => {
  const f = make({ rank });
  const recipients = [6, 7, 8, 9, 10].map((col, i) => ally(f, { col, ratio: .05 + i * .1 }));
  f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.heals.length >= 4);
  assert.deepEqual(f.heals.map(h => h.target), recipients.slice(0, 4));
  f.heals.forEach((h, i) => near(h.amount, f.record.stats.atk * f.record.bb.heal_scale * .75 ** i));
  assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.activations, 1);
  assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.active, false);
});
test('ordinary chain release waits for the native event and flying speed; S1 charges only ordinary attack accounts', () => {
  const f = make({ rank: 1 }), t = ally(f, { hp: 1e6 });
  advance(f.b, 1); assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
  until(f, () => f.attacks.length === 1);
  const release = f.b.time; assert.ok(release >= 1 + .5666666626930237 - f.b.dt);
  assert.equal(f.heals.length, 0); assert.equal(f.u.skill.sp, 1);
  until(f, () => f.heals.length === 1);
  assert.ok(f.heals[0].time > release); near(f.heals[0].amount, f.record.stats.atk);
  until(f, () => f.u.skill.activations === 1 && !f.u.skill.active, 30);
  assert.equal(f.attacks.length, f.u.skill.spCost + 1); assert.equal(f.u.skill.sp, 0);
  assert.ok(t.alive);
});
test('Reconstruction adds a free recipient and no extra decay, and cannot be visited twice in one chain', () => {
  const f = make({ skill: 2 });
  const a = ally(f, { col: 6, ratio: .05 }), token = ally(f, { col: 7, token: true, ratio: .1 });
  const c = ally(f, { col: 8, ratio: .2 }), d = ally(f, { col: 9, ratio: .3 });
  until(f, () => f.heals.length === 4);
  assert.deepEqual(f.heals.map(h => h.target), [a, token, c, d]);
  for (const [i, scale] of [1, .75, .75, .75 ** 2].entries()) near(f.heals[i].amount, f.record.stats.atk * scale);
  assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.sp, f.record.source.spData.initSp + 1);
});
test('foreign ordinary healers cannot heal attached Reconstruction; Mon3tr and self healing remain accepted', () => {
  const f = make(), t = ally(f, { token: true }), other = ally(f, { row: 6 });
  const hp = t.hp;
  assert.equal(f.b.heal(other, t, 100, { ignoreHealFree: true }), 0); near(t.hp, hp);
  near(f.b.heal(f.u, t, 100, { ignoreHealFree: true }), 100);
  near(f.b.heal(t, t, 100), 100);
  assert.throws(() => f.controller.attachReconstruction(t), /fresh owned/);
  assert.throws(() => f.controller.attachReconstruction(other), /fresh owned/);
});
test('recipient masks exclude ordinary heal-free allies while retaining the marked Reconstruction exception', () => {
  const f = make({ skill: 2 });
  for (const [i, flags] of [{ isolated: true }, { noHeal: true }, { untargetable: true }].entries())
    ally(f, { row: 4 + i, col: 6, ratio: .001, flags });
  ally(f, { row: 4, col: 7, ratio: .001, flags: { healFree: true } });
  const t = ally(f, { row: 5, col: 7, token: true, flags: { healFree: true } });
  const device = f.b.spawnDevice('fixture:device', 5, 8, { hp: 1e4 }); device.hp = 1;
  until(f, () => f.heals.length === 1);
  assert.equal(f.heals[0].target, t); near(device.hp, 1);
});
test('healing selects the lowest ratio, reaches outside owner range by bounce and does not revisit a full or seen recipient', () => {
  const f = make({ skill: 2 });
  const a = ally(f, { col: 6, ratio: .05 }), c = ally(f, { col: 7, ratio: .1 });
  const d = ally(f, { col: 8, ratio: .15 }), full = ally(f, { row: 4, col: 7, ratio: 1 });
  until(f, () => f.heals.length === 3);
  assert.deepEqual(f.heals.map(h => h.target), [a, c, d]); near(full.hpRatio, 1);
});
test('an unfired heal is interrupted by control and a dead primary does not receive a heal or a stale chain', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  disarm(f); advance(f.b, .8);
  assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
  f.b.removeBuff(f.u, 'fixture:disarm'); until(f, () => f.attacks.length === 1);
  f.b._remove(t, 'fixture:remove', null, true); advance(f.b, .5);
  assert.equal(f.heals.length, 0); assert.equal(f.b.projectiles.list.length, 0);
});
test('an already fired heal survives owner retirement but does not revive it or grant it a new ASPD buff', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.attacks.length === 1); const amount = f.record.stats.atk;
  f.b._remove(f.u, 'fixture:remove', null, true);
  until(f, () => f.heals.length === 1);
  near(f.heals[0].amount, amount); assert.ok(t.hp > 1000);
  assert.equal(f.u.alive, false); assert.equal(f.u.findBuff(`mon3tr:${f.u.id}:coordination`), null);
  assert.equal(f.controller.stopped, true);
});
for (const elite of [0, 1, 2]) test(`E${elite} base talent grants selected ASPD and renews its ten-second gift without stacking`, () => {
  const f = make({ elite, potential: 6 }), t = ally(f, { hp: 1e6 });
  until(f, () => f.heals.length === 1); disarm(f);
  const talent = f.record.talentBb[1], key = `mon3tr:${f.u.id}:coordination`;
  if (elite === 0) { assert.equal(t.findBuff(key), null); return; }
  near(f.u.s.aspd, 100 + talent.attack_speed); near(t.s.aspd, 100 + talent.attack_speed);
  const buff = t.findBuff(key); advance(f.b, 2); const left = buff.timeLeft;
  const before = f.heals.filter(h => h.target === t).length;
  f.controller.chain(t); until(f, () => f.heals.filter(h => h.target === t).length > before);
  const renewed = t.findBuff(key);
  assert.notEqual(renewed, buff); assert.ok(renewed.timeLeft > left); near(t.s.aspd, 100 + talent.attack_speed);
  near(renewed.timeLeft, talent.buff_duration, f.b.dt * 2);
  advance(f.b, .3); // Complete the later bounce onto the full-health caster.
  advance(f.b, f.heals.at(-1).time + talent.buff_duration - f.b.time + f.b.dt * 2);
  near(t.s.aspd, 100); near(f.u.s.aspd, 100);
});
test('a cancelled heal does not grant Tactical Coordination, and a modifier removing its target cannot leave a stale bounce', () => {
  const f = make({ skill: 2 }), a = ally(f), next = ally(f, { col: 7, ratio: .2 });
  f.b.on('heal', ctx => { if (ctx.target === a) { ctx.amount = 0; f.b._remove(a, 'fixture:modifier', null, true); } });
  until(f, () => f.attacks.length === 1); advance(f.b, .3); disarm(f);
  assert.equal(f.heals.length, 0); assert.equal(next.hp, 2000);
  assert.equal(f.u.findBuff(`mon3tr:${f.u.id}:coordination`), null);
});
test('overlapping Tactical Coordination sources use the strongest live bucket and resume a weaker unexpired source', () => {
  const f = make({ skill: 2 }), t = ally(f);
  const otherU = f.b._makeAlly(f.u.player, f.u.def, 'op', 6, 5, { dir: 'RIGHT' });
  const other = prepareMon3trHealing(f.b, otherU, { contract: CONTRACT });
  f.b._setupUnit(otherU, other.kit); other.controller.install();
  assert.ok(f.b._deploy(otherU, { initial: false }));
  disarm(f); f.b.addBuff(otherU, { key: 'fixture:disarm', flags: { disarm: true } });
  f.controller.coordination(t, { attack_speed: 22, buff_duration: 2 });
  other.controller.coordination(t, { attack_speed: 10, buff_duration: 4 });
  near(t.s.aspd, 122); advance(f.b, 2.1); near(t.s.aspd, 110);
  advance(f.b, 2); near(t.s.aspd, 100);
});
test('healing at the cap still carries the accepted modifier and talent without creating HP beyond max', () => {
  const f = make({ skill: 2 }), t = ally(f, { ratio: 1 }); disarm(f);
  f.controller.chain(t); until(f, () => f.heals.length === 1);
  near(t.hpRatio, 1); near(t.s.aspd, 120);
  assert.equal(f.u.stats.heal, 0);
});
test('a short control that expires before the next tick still cancels the unfired source ability', () => {
  const f = make({ skill: 2 }); ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const control = f.b.addBuff(f.u, { key: 'fixture:brief-control', flags: { stun: true } });
  f.b.removeBuff(f.u, control); advance(f.b, .8);
  assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
});
test('a redeployed projectile recipient is a new life and never inherits a stale in-flight heal', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.attacks.length === 1);
  t.deploySeq = ++f.b._deploySeq; advance(f.b, .3); disarm(f);
  assert.equal(f.heals.length, 0); near(t.hp, 1000);
});
test('source Front and Back attack events remain literal and animation speed is capped independently of cadence', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['UP', 4, 5]]) {
    const f = make({ skill: 2, dir }); ally(f, { row, col });
    f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 200 } });
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    near(p.releaseAt - p.startedAt, .5666666626930237);
    assert.equal(f.u.mem.regularFormVisual.speed, 1);
    assert.equal(f.u.mem.regularVisualDirection, dir === 'UP' ? 'UP' : 'RIGHT');
    until(f, () => f.heals.length === 1); assert.ok(f.heals[0].time >= p.releaseAt);
  }
});
test('S1 retains four counted allies plus the free Reconstruction recipient', () => {
  const f = make(), token = ally(f, { col: 6, token: true, ratio: .05 });
  const others = [7, 8, 9, 10].map((col, i) => ally(f, { col, ratio: .1 + i * .1 }));
  f.u.skill.setSpTotal(f.u.skill.spCost); until(f, () => f.heals.length === 5);
  assert.deepEqual(f.heals.map(h => h.target), [token, ...others]);
  f.heals.forEach((h, i) => near(h.amount, f.record.stats.atk * f.record.bb.heal_scale * .75 ** Math.max(0, i - 1)));
  assert.equal(f.attacks.length, 1);
});
test('temporary hiding pauses the healer without permanently retiring its deployment controller', () => {
  const f = make({ skill: 2 }); ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.u.hidden = true; advance(f.b, 3);
  assert.equal(f.heals.length, 0); assert.equal(f.controller.stopped, false);
  f.u.hidden = false; until(f, () => f.heals.length === 1);
  assert.equal(f.controller.stopped, false);
});
test('Reconstruction rejects foreign healing before unrelated output modifiers can turn it back into positive healing', () => {
  const f = make(), token = ally(f, { token: true }), other = ally(f, { row: 6 });
  let modified = false;
  f.b.on('heal', ctx => { if (ctx.target === token) { modified = true; ctx.amount = 100; } });
  const hp = token.hp;
  near(f.b.heal(other, token, 100, { ignoreHealFree: true }), 0);
  near(token.hp, hp); assert.equal(modified, false);
});
test('a zeroed accepted heal grants no coordination while the chain retains its independent bounce budget', () => {
  const f = make({ skill: 2 }), a = ally(f), next = ally(f, { col: 7, ratio: .2 });
  f.b.on('heal', ctx => { if (ctx.target === a) ctx.amount = 0; });
  until(f, () => f.heals.length === 2); disarm(f);
  near(f.heals[0].amount, 0); near(a.hp, 1000);
  assert.equal(a.findBuff(`mon3tr:${f.u.id}:coordination`), null);
  assert.equal(f.heals[1].target, next); near(f.heals[1].amount, f.record.stats.atk * .75);
});
test('hiding during the shared pre-attack callback rejects release and offensive SP without retiring the controller', () => {
  const f = make({ skill: 2 }); ally(f);
  const sp = f.u.skill.sp;
  f.b.on('beforeAttack', ({ attacker }) => { if (attacker === f.u) f.u.hidden = true; });
  until(f, () => f.u.hidden); advance(f.b, .3);
  assert.equal(f.heals.length, 0); near(f.u.skill.sp, sp); assert.equal(f.controller.stopped, false);
});
test('S1 retains the native non-silenceable controller and does not suppress its selected healing talent', () => {
  const f = make(), t = ally(f);
  f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
  f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.heals.length === 1);
  near(f.heals[0].amount, f.record.stats.atk * f.record.bb.heal_scale);
  near(t.s.aspd, 120); assert.equal(f.u.skill.activations, 1);
});
test('a full-health ally carries a bounce to an injured recipient outside the primary bounce range', () => {
  const f = make({ skill: 2 }), a = ally(f, { col: 6 }), bridge = ally(f, { col: 7, ratio: 1 });
  const t = ally(f, { col: 8, ratio: .2 });
  until(f, () => f.heals.length === 3);
  assert.deepEqual(f.heals.map(h => h.target), [a, bridge, t]);
  near(bridge.hpRatio, 1); near(f.heals[2].amount, f.record.stats.atk * .75 ** 2);
});
test('equal-HP primary inputs and bounce ties prefer the newest deployment', () => {
  const f = make({ skill: 2 }), older = ally(f, { row: 4, col: 6 }), newer = ally(f, { row: 5, col: 6 });
  until(f, () => f.heals.length === 2);
  assert.deepEqual(f.heals.map(h => h.target), [newer, older]);
});
test('the ordinary selector does not spend attacks or SP on an unrelated heal-free unit', () => {
  const f = make({ skill: 2 }), t = ally(f, { flags: { healFree: true } });
  advance(f.b, 4); assert.equal(f.attacks.length, 0); assert.equal(f.heals.length, 0);
  near(f.u.skill.sp, f.record.source.spData.initSp); near(t.hp, 1000);
});
