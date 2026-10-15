// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4196_reckpr.json' with { type: 'json' };
import { RECKPR_ID as ID, selectedReckprBuild, reckprNativeInputs } from '../server/sim/content/arkpedia-reckpr-source.js';
import { make, ally, damage, cast, advance, until, near } from './helpers/reckpr-fixture.js';
test('Record Keeper source preserves the complete original native receipt without public or frame approval', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.deepEqual(e.nativeTemplateGaps, []); assert.deepEqual(e.jsonTemplateGaps, []);
  assert.equal(e.source.bundles.length, 5); assert.equal(Object.keys(e.templates).length, 5);
  assert.deepEqual(e.skillBindings, { skchr_reckpr_1: ['skchr_reckpr_1'], skchr_reckpr_2: ['skchr_reckpr_2'] });
  const n = reckprNativeInputs(); assert.equal(n.s1._maxAnimScale, 1); assert.equal(n.ordinary._maxAnimScale, -1);
  assert.equal(n.talentActions.at(-1)._succeedNodes[0]._forceFlag, false);
  assert.equal(n.talentActions.at(-1)._failNodes[0]._forceFlag, true);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`selected E${elite}/P${potential} stats, trust, talent and promotion`, () => {
  const f = make({ elite, potential, trust: 200 }), r = selectedReckprBuild(f.build);
  near(r.stats.maxHp, [1180, 1422, 1580][elite]); near(r.stats.atk, [291, 416, 502][elite] + 75 + (potential === 6 ? 27 : 0));
  near(r.stats.cost, [17, 19, 19][elite] - (potential === 6 ? 2 : 0)); near(r.stats.respawnTime, potential === 6 ? 66 : 70);
  if (elite) { near(r.talentBb[0].attack_speed, elite === 1 ? 8 : 16); near(r.talentBb[0].duration, potential === 6 ? 10 : 8); }
  else assert.deepEqual(r.talentBb, []);
});
test('incomplete, locked, moduled and uncontracted source selections fail before controller installation', () => {
  assert.throws(() => make({ contract: {} })); assert.throws(() => make({ elite: 0, skill: 2 }));
  for (const mutate of [d => d.stats.atk++, d => d.skill.spCost++, d => d.skill.bb.atk = 123,
    d => d.raw.arkpedia.skillId = 'skchr_reckpr_2', d => d.raw.arkpedia.module = 'mod-x', d => d.tags = ['invented']]) assert.throws(() => make({ mutate }));
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} heals two distinct wounded allies with one charge and exact source scale`, () => {
  const f = make({ rank }), a = ally(f), z = ally(f, { col: 5, hp: 2000 });
  f.u.skill.setSpTotal(f.u.skill.spCost * f.u.skill.maxCharges); const before = f.u.skill.spTotal;
  until(f, () => f.shots.length >= 2, 3); assert.equal(f.shots.length, 2); assert.equal(f.attacks.length, 1);
  assert.equal(f.attacks[0].isSkill, true); assert.deepEqual(new Set(f.shots.map(s => s.target)), new Set([a, z]));
  assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.pending, false);
  assert.ok(f.u.skill.spTotal < before); until(f, () => f.heals.length >= 2, 1);
  for (const h of f.heals) near(h.amount, f.u.s.atk * f.record.bb.heal_scale);
  assert.ok(f.shots.every(s => s.data.nativeKey === 'projectile_chr_reckpr_s1')); assert.deepEqual(f.b.errors, []);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank} applies its exact source fixed-heal listener and it persists after skill end`, () => {
  const f = make({ skill: 2, rank }), a = ally(f); advance(f.b, 1.1); cast(f);
  until(f, () => f.heals.length >= 1, 4); const marker = a.findBuff(`reckpr:s2:${f.u.id}`); assert.ok(marker);
  near(marker.timeLeft, f.record.bb['attack@buff_duration'], f.b.dt); f.u.skill.end('diagnostic');
  const before = a.hp; damage(f, a, 250); near(a.hp, before - 250 + f.record.bb['attack@fixed_heal_value']);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Idle'); assert.deepEqual(f.b.errors, []);
});
test('ordinary healing is single-target, follows HP ratio and includes the owner without spending an S1 charge', () => {
  const f = make(), a = ally(f), z = ally(f, { col: 5, hp: 2000 });
  f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } });
  until(f, () => f.heals.length >= 1, 3); assert.equal(f.heals.length, 1); assert.equal(f.heals[0].target, a);
  assert.equal(f.u.skill.activations, 0); near(f.heals[0].amount, f.u.s.atk); assert.equal(f.attacks[0].isSkill, false);
  a.hp = a.s.maxHp; z.hp = z.s.maxHp; f.u.hp = 1;
  until(f, () => f.heals.length >= 2, 4); assert.equal(f.heals[1].target, f.u);
});
test('talent filters live root-tile operators, refreshes one ASPD buff and preserves different S1/S2 SP holds', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }), a = ally(f), token = ally(f, { row: 2, col: 4, kind: 'token' }), outside = ally(f, { row: 0, col: 7 });
    f.u.skill.setSpTotal(0); f.b.emit('skillStart', { unit: a }); near(f.u.skill.spTotal, 1); near(f.u.s.aspd, 116);
    f.b.emit('skillStart', { unit: token }); f.b.emit('skillStart', { unit: outside }); near(f.u.skill.spTotal, 1);
    f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } }); f.b.emit('skillStart', { unit: a }); near(f.u.skill.spTotal, skill === 1 ? 2 : 1);
    f.b.emit('skillStart', { unit: a }); assert.equal(f.u.buffs.filter(v => v.key.startsWith('reckpr:talent:')).length, 1); near(f.u.s.aspd, 116);
    advance(f.b, 8.1); near(f.u.s.aspd, 100);
  }
});
test('S2 own activation grants its ASPD but does not grant SP during the active timed skill', () => {
  const f = make({ skill: 2 }); advance(f.b, 1.1); cast(f);
  near(f.u.skill.spTotal, 0); near(f.u.s.aspd, 116); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_Begin');
  advance(f.b, .6); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_Idle');
});
test('native S1 speed is capped while ordinary/S2 windups accelerate; Front/Back S2 events remain distinct', () => {
  for (const [skill, dir, row, col, event, charged] of [[1, 'RIGHT', 3, 4, .5666666626930237, true],
    [1, 'RIGHT', 3, 4, .5666666626930237, false],
    [2, 'RIGHT', 3, 4, .6000000238418579], [2, 'UP', 4, 3, .5666666626930237]]) {
    const f = make({ skill, dir }); ally(f, { row, col });
    f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 400 } });
    if (charged) f.u.skill.setSpTotal(f.u.skill.spCost); else if (skill === 2) cast(f);
    until(f, () => f.controller.phase?.kind === 'attack', 4); const p = f.controller.phase;
    const speed = charged ? 1 : f.u.base.bat / f.u.s.interval;
    const started = p.startedAt; near(p.releaseAt - started, event / speed);
    assert.equal(p.s1, !!charged); assert.equal(p.s2, skill === 2);
    advance(f.b, event / speed - .05); assert.equal(f.shots.length, 0);
    until(f, () => f.shots.length > 0, 1); near(f.shots[0].time - started, event / speed, f.b.dt);
  }
});
test('ready S1 waits for an injured eligible target and its own start forces one source talent SP through noSp', () => {
  const f = make(), a = ally(f, { hp: 10000 }); f.u.skill.setSpTotal(f.u.skill.spCost);
  f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } }); advance(f.b, 2);
  assert.equal(f.u.skill.activations, 0); assert.equal(f.shots.length, 0);
  a.hp = 1000; until(f, () => f.u.skill.activations === 1, 1); near(f.u.skill.spTotal, 1);
  assert.equal(f.u.skill.pending, true); near(f.u.s.aspd, 116);
});
test('S1 retains an interrupted pending heal and cannot spend a second charge or accept reentrant forced targets', () => {
  const f = make(); ally(f); f.u.skill.setSpTotal(f.u.skill.spCost * 3);
  until(f, () => f.controller.phase?.s1, 2); f.b.applyStatus(f.u, 'stun', { duration: .2, source: f.u });
  advance(f.b, .1); assert.equal(f.shots.length, 0); assert.equal(f.u.skill.pending, true); assert.equal(f.u.skill.activations, 1);
  const reject = f.b.on('beforeAttack', ctx => {
    if (ctx.attacker === f.u) { f.b.forceAttack(f.u, ctx.targets); ctx.cancel = true; }
  });
  advance(f.b, 4); assert.equal(f.shots.length, 0); assert.equal(f.u.skill.activations, 1); f.b.off(reject);
  until(f, () => f.shots.length === 1, 4); assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.pending, false);
});
test('all dead captured S1 inputs refund the pending charge rather than retargeting a third ally', () => {
  const f = make(), a = ally(f), z = ally(f, { col: 5, hp: 2000 });
  f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } }); f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.controller.phase?.s1, 2); ally(f, { row: 2, col: 4, hp: 3000 }); f.b.kill(a); f.b.kill(z);
  advance(f.b, .7); assert.equal(f.shots.length, 0); assert.equal(f.u.skill.pending, false);
  near(f.u.skill.spTotal, f.u.skill.spCost + 1); assert.equal(f.u.skill.activations, 1);
});
test('ordinary and S1 shots keep captured targets after range exit but reject a different life on impact', () => {
  const f = make(), a = ally(f); f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } });
  until(f, () => f.controller.phase?.kind === 'attack', 2); a.x = 7;
  until(f, () => f.shots.length > 0, 1); assert.equal(f.shots[0].target, a);
  until(f, () => f.heals.length > 0, 1); assert.equal(f.heals[0].target, a);
  const g = make(), z = ally(g); g.u.skill.setSpTotal(g.u.skill.spCost);
  until(g, () => g.shots.length > 0, 3); z.deploySeq++; advance(g.b, .2); assert.equal(g.heals.length, 0);
});
test('S2 emitted healing samples current ATK after mode end and applies its listener even if HP filled in flight', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f);
  until(f, () => f.shots.length > 0, 3); f.u.skill.end('diagnostic'); a.hp = a.s.maxHp;
  until(f, () => f.heals.length > 0, 1); near(f.heals[0].amount, f.u.base.atk);
  assert.ok(a.findBuff(`reckpr:s2:${f.u.id}`)); const before = a.hp;
  damage(f, a, 250); near(a.hp, before - 250 + f.record.bb['attack@fixed_heal_value']);
});
test('same-source repeated S2 heals refresh one listener without duplicate damage-trigger healing', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f);
  until(f, () => f.shots.length >= 3, 12); until(f, () => f.heals.length >= 3, 1);
  assert.equal(f.controller.reactiveBuffs.size, 1); assert.equal(a.buffs.filter(x => x.key.startsWith('reckpr:s2:')).length, 1);
  const before = a.hp, n = f.heals.length; damage(f, a, 300);
  assert.equal(f.heals.length, n + 1); near(a.hp, before - 300 + f.record.bb['attack@fixed_heal_value']);
});
test('S2 applied listeners and in-flight shots outlive retreat, then expire and release their event handles', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f);
  until(f, () => f.shots.length > 0, 3); f.b.retreat(f.u, { permanent: true });
  until(f, () => f.heals.length > 0, 1); assert.equal(f.controller.stopped, true);
  const before = a.hp; damage(f, a, 250); near(a.hp, before - 250 + f.record.bb['attack@fixed_heal_value']);
  advance(f.b, f.record.bb['attack@buff_duration'] + .1); assert.equal(f.controller.reactiveBuffs.size, 0);
  const expired = a.hp, n = f.heals.length; damage(f, a, 100); near(a.hp, expired - 100); assert.equal(f.heals.length, n);
});
test('reactive heal includes an accepted shielded hit, excludes injury fill/HP loss and never resurrects a lethal target', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f); until(f, () => f.heals.length > 0, 3);
  f.u.skill.end('diagnostic'); f.b.addBuff(a, { key: 'fixture:shield', shield: 1000 });
  const before = a.hp, fixed = f.record.bb['attack@fixed_heal_value']; damage(f, a, 250); near(a.hp, before + fixed);
  f.b.removeBuff(a, 'fixture:shield'); const n = f.heals.length, loss = a.hp;
  f.b.loseHp(a, 100, f.u); near(a.hp, loss - 100); assert.equal(f.heals.length, n);
  damage(f, a, 1e6); assert.equal(a.alive, false); assert.equal(a.hp, 0); assert.equal(f.heals.length, n);
});
test('HealFree, no-heal, isolated, hidden, untargetable and device targets are excluded; normal tokens may heal', () => {
  const f = make();
  const flags = [{ healFree: true }, { noHeal: true }, { isolated: true }, { untargetable: true }];
  for (const [i, pos] of [[3, 4], [2, 4], [4, 4], [3, 5]].entries()) ally(f, { row: pos[0], col: pos[1], flags: flags[i] });
  const hidden = ally(f, { row: 2, col: 5 }); hidden.hidden = true; ally(f, { row: 4, col: 5, kind: 'device' });
  const token = ally(f, { col: 6, kind: 'token', hp: 3000 });
  assert.deepEqual(f.controller.targets(20), [token]); until(f, () => f.heals.length > 0, 3); assert.equal(f.heals[0].target, token);
});
test('vetoed recipient buffs cannot leave a damage listener and battle end removes applied markers safely', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f);
  const hook = f.b.on('beforeBuff', ctx => { if (ctx.unit === a && ctx.buff.key.startsWith('reckpr:s2:')) ctx.cancel = true; });
  until(f, () => f.heals.length > 0, 3); assert.equal(f.controller.reactiveBuffs.size, 0); f.b.off(hook);
  until(f, () => f.heals.length >= 2, 4); assert.equal(f.controller.reactiveBuffs.size, 1);
  f.b.forceEnd('diagnostic'); assert.equal(f.controller.reactiveBuffs.size, 0); assert.equal(f.controller.stopped, true);
  assert.equal(a.findBuff(`reckpr:s2:${f.u.id}`), null); assert.deepEqual(f.b.errors, []);
});
test('retirement during first projectile birth stops the second unlaunched S1 shot without erasing the first', () => {
  const f = make(), a = ally(f), z = ally(f, { col: 5, hp: 2000 }); f.u.skill.setSpTotal(f.u.skill.spCost);
  const add = f.b.addProjectile.bind(f.b); let emitted = false;
  f.b.addProjectile = p => { const result = add(p); if (p.source === f.u && !emitted) { emitted = true; f.b.retreat(f.u, { permanent: true }); } return result; };
  until(f, () => f.shots.length > 0, 3); assert.equal(f.shots.length, 1); assert.equal(f.controller.stopped, true);
  until(f, () => f.heals.length > 0, 1); assert.equal(f.heals[0].target, a); near(z.hp, 2000);
});
test('reentrant talent-buff removal cannot gift SP to a retired owner', () => {
  const f = make(), a = ally(f); f.u.skill.setSpTotal(0);
  f.b.on('beforeBuff', ctx => {
    if (ctx.unit === f.u && ctx.buff.key.startsWith('reckpr:talent:')) f.b.retreat(f.u, { permanent: true });
  });
  f.b.emit('skillStart', { unit: a }); assert.equal(f.u.alive, false); near(f.u.skill.spTotal, 0); assert.deepEqual(f.b.errors, []);
});
test('a recipient removed during reactive-buff attachment receives no stale listener or healing', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f);
  f.b.on('beforeBuff', ctx => { if (ctx.unit === a && ctx.buff.key.startsWith('reckpr:s2:')) f.b.retreat(a, { permanent: true }); });
  until(f, () => f.shots.length > 0, 3); advance(f.b, 1);
  assert.equal(a.alive, false); assert.equal(f.controller.reactiveBuffs.size, 0); assert.equal(f.heals.length, 0); assert.deepEqual(f.b.errors, []);
});
test('S1 holds ordinary SP during its pending windup, admits forced talent SP, then resumes natural recovery', () => {
  const f = make(), a = ally(f); f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.controller.phase?.s1, 2); const before = f.u.skill.spTotal;
  assert.equal(f.u.s.flags.noSp, true); advance(f.b, .4); near(f.u.skill.spTotal, before);
  f.b.emit('skillStart', { unit: a }); near(f.u.skill.spTotal, before + 1);
  until(f, () => f.shots.length > 0, 1); assert.equal(!!f.u.s.flags.noSp, false);
  const released = f.u.skill.spTotal; advance(f.b, .2); assert.ok(f.u.skill.spTotal > released);
});
