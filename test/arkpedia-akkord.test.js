// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-akkord-prefabs.json' with { type: 'json' };
import { AKKORD_CONTRACT } from '../server/sim/content/arkpedia-akkord.js';
import { selectedAkkordBuild as select, AKKORD_ID as ID } from '../server/sim/content/arkpedia-akkord-source.js';
import { performAttack } from '../server/sim/ai.js';
import { make, enemy, ally, advance, until, near } from './helpers/akkord-fixture.js';
const charge = f => f.u.skill.setSpTotal(f.u.skill.maxCharges * f.u.skill.spCost);
const cast = f => { charge(f); assert.equal(f.u.skill.activate(), true); };
const disarm = f => f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
test('CN foundation stays separate from kit approval and exact source build/contract is required', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(e.source.nativeClient, '26-09-22-07-47-20_6c71fa');
  assert.deepEqual(Object.keys(e.templates).sort(), ['akkord_s_2[aoe]', 'akkord_s_2[aoe_damage]', 'akkord_t_1', 'empty', 'switch_mode_restart_fsm']);
  assert.deepEqual(e.projectiles, {});
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[flag], false);
  assert.throws(() => make({ contract: { ...AKKORD_CONTRACT } }), /source contract/);
  assert.throws(() => make({ mutate: def => { def.stats.atk++; } }), /selected source/);
  const good = make().build;
  for (const patch of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 71 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { skillRank: 11 }, { skillId: 'other' }, { module: 'mod-x' }, { elite: 0, skillRank: 5 },
    { elite: 0, skillRank: 4, skillId: 'skchr_akkord_2' }]) assert.throws(() => select({ ...good, ...patch }));
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`E${elite}/P${potential} preserves source max stats, potential and conditional talent`, () => {
  const f = make({ elite, potential, trust: 200 }), r = f.record;
  near(r.stats.maxHp, [952, 1237, 1528][elite]); near(r.stats.atk, [423, 564, 680][elite] + 60 + (potential === 6 ? 32 : 0));
  near(r.stats.def, [71, 98, 110][elite]); near(r.stats.cost, [29, 32, 32][elite] - (potential === 6 ? 2 : 0));
  near(r.stats.respawnTime, potential === 6 ? 66 : 70);
  assert.equal(r.rangeGrid.length, elite === 0 ? 5 : 6);
  ally(f); advance(f.b, f.b.dt);
  near(f.u.s.atk, r.stats.atk * (1 + (elite === 0 ? 0 : [0, .08, .15][elite] + (potential === 6 ? .02 : 0))));
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: two charges, native windup, Arts scaling on all line enemies and one account`, () => {
  const f = make({ rank }), a = enemy(f), z = enemy(f, { col: 9, fly: true, res: 20 });
  enemy(f, { row: 6, col: 6 }); charge(f);
  near(f.u.skill.spCost, [12, 12, 11, 11, 10, 10, 9, 9, 8, 8][rank - 1]);
  until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
  near(p.releaseAt - p.startedAt, .6666666865348816); assert.equal(p.s1, true); assert.equal(f.hits.length, 0);
  const sp = f.u.skill.spTotal; advance(f.b, .3); near(f.u.skill.spTotal, sp);
  until(f, () => f.hits.length > 0);
  assert.deepEqual(f.hits.map(h => h.target), [a, z]); assert.equal(f.attacks.length, 1);
  const scale = [1.3, 1.35, 1.4, 1.45, 1.5, 1.6, 1.7, 1.8, 1.9, 2][rank - 1];
  near(f.hits[0].amount, 680 * scale); near(f.hits[1].amount, 680 * scale * .8);
  assert.equal(f.hits.every(h => h.type === 'arts' && h.dmg.isAttack && h.dmg.isSkill), true);
  assert.equal(new Set(f.hits.map(h => h.dmg.attackId)).size, 1);
  assert.equal(f.u.skill.charges, 1); assert.equal(f.u.skill.active, false);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: manual activation, independent ally blasts, current source damage and no extra accounts`, () => {
  const f = make({ skill: 2, rank }); const a = enemy(f, { col: 7 }), outside = enemy(f, { row: 6, col: 7 });
  // Two qualifying allied positions, one within .9 of the off-line enemy.
  ally(f, { col: 7 }); ally(f, { col: 8 }); outside.x = 7; outside.y = 5.8;
  cast(f); const sp = f.u.skill.spTotal; advance(f.b, .5); near(f.u.skill.spTotal, sp);
  until(f, () => f.hits.length > 0);
  const bonus = [.3, .3, .35, .35, .4, .45, .45, .5, .55, .6][rank - 1];
  const aoe = [.1, .1, .1, .15, .15, .15, .2, .2, .2, .25][rank - 1];
  const power = 680 * (1 + .15 + bonus);
  const line = f.hits.filter(h => h.dmg.tags.includes('akkord:line'));
  const bursts = f.hits.filter(h => h.dmg.tags.includes('akkord:burst'));
  assert.equal(line.length, 1); assert.equal(line[0].target, a); near(line[0].amount, power);
  assert.equal(bursts.length, 2); assert.deepEqual(new Set(bursts.map(h => h.target)), new Set([a, outside]));
  bursts.forEach(h => near(h.amount, power * aoe));
  assert.equal(f.attacks.length, 1); assert.equal(new Set(f.hits.map(h => h.dmg.attackId)).size, 1);
  disarm(f); until(f, () => !f.u.skill.active, 34); near(f.u.s.atk, 680 * 1.15);
});
test('ordinary attacks charge time SP naturally, hit all current line enemies including air and respect source range', () => {
  const f = make({ elite: 0 }), first = enemy(f), a = enemy(f, { col: 9, fly: true });
  const out = enemy(f, { col: 10 });
  until(f, () => f.controller.phase?.kind === 'attack');
  first.x = 12; const newcomer = enemy(f, { col: 8 });
  until(f, () => f.attacks.length === 1);
  assert.deepEqual(f.hits.map(h => h.target), [a, newcomer]); near(out.hp, out.s.maxHp);
  f.hits.forEach(h => near(h.amount, 423)); assert.ok(f.u.skill.sp > 1.5);
});
test('talent counts other normal professions, ignores isolation/TargetFree/noHeal, never stacks and tracks leaving', () => {
  const f = make(); const token = ally(f, { profession: 'TOKEN', col: 6 });
  advance(f.b, .1); near(f.u.s.atk, 680);
  const a = ally(f, { flags: { isolated: true, untargetable: true, noHeal: true } });
  advance(f.b, .1); near(f.u.s.atk, 782);
  const z = ally(f, { col: 8 }); advance(f.b, .1); near(f.u.s.atk, 782);
  a.hidden = true; z.x = 15; advance(f.b, .1); near(f.u.s.atk, 680);
  assert.ok(token.alive);
});
test('S2 overlapping allied bursts can hit one enemy more than once, without another normal attack or recursion', () => {
  const f = make({ skill: 2 }), t = enemy(f, { col: 7 });
  ally(f, { col: 7 }); const a = ally(f, { col: 8, flags: { isolated: true, untargetable: true } }); a.x = 7.8;
  ally(f, { col: 9, profession: 'TOKEN' }); cast(f);
  until(f, () => f.hits.length > 0);
  assert.equal(f.hits.length, 3); assert.equal(f.hits.every(h => h.target === t), true); assert.equal(f.attacks.length, 1);
  near(f.hits[0].amount, 1190); f.hits.slice(1).forEach(h => near(h.amount, 297.5));
});
test('S2 empty release still blasts after an enemy started the windup; no enemy means no new attack', () => {
  const f = make({ skill: 2 }), t = enemy(f); ally(f, { col: 7 });
  cast(f); until(f, () => f.controller.phase?.kind === 'attack');
  t.x = 12; const out = enemy(f, { row: 6, col: 7 }); out.y = 5.8;
  until(f, () => f.attacks.length === 1); assert.deepEqual(f.attacks[0].targets, []);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, out);
  advance(f.b, 8); assert.equal(f.attacks.length, 1);
});
test('dead starting inputs refund one S1 charge without losing partial next SP; leaving range does not refund', () => {
  for (const dead of [false, true]) {
    const f = make(), t = enemy(f); f.u.skill.setSpTotal(f.u.skill.spCost + 3);
    until(f, () => f.controller.phase?.kind === 'attack'); const sp = f.u.skill.spTotal;
    if (dead) f.b._remove(t, 'fixture:dead', null, true); else t.x = 14;
    until(f, () => f.attacks.length === 1);
    assert.deepEqual(f.attacks[0].targets, []); assert.equal(f.hits.length, 0);
    near(f.u.skill.spTotal, sp + (dead ? f.u.skill.spCost : 0));
    assert.equal(f.u.skill.active, false);
  }
});
test('area API cannot count unarmed/recursive forced attacks or turn a hook-cancelled selection into empty release', () => {
  const f = make({ skill: 2 }), t = enemy(f); cast(f);
  assert.equal(f.b.forceAttack(f.u, [t]), false); assert.equal(f.b.forceAttack(f.u, [], { allowEmpty: true }), false);
  assert.equal(f.u.stats.attacks, 0);
  const h = f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = []; });
  until(f, () => f.controller.phase?.released); assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0);
  f.b.off(h);
  const nested = [], onHit = [];
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) nested.push(f.b.forceAttack(f.u, [t])); });
  f.b.on('damaged', ctx => { if (ctx.source === f.u) onHit.push(f.b.forceAttack(f.u, [t])); });
  until(f, () => f.attacks.length === 1);
  assert.deepEqual(nested, [false]); assert.deepEqual(onHit, [false]); assert.equal(f.u.stats.attacks, 1);
});
test('an explicit hook veto also cancels an empty source release, and direct empty attacks need opt-in', () => {
  const f = make({ skill: 2 }), t = enemy(f); cast(f);
  until(f, () => f.controller.phase?.kind === 'attack'); t.x = 14;
  f.controller.accepting = true;
  performAttack(f.b, f.u, f.b.effectiveProfile(f.u), []);
  f.controller.accepting = false; assert.equal(f.u.stats.attacks, 0);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.cancel = true; });
  until(f, () => f.controller.phase?.released); assert.equal(f.u.stats.attacks, 0);
  assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0);
});
test('ordinary targeting respects camouflage, stealth, sleep and TargetFree; S2 area bursts ignore camouflage alone', () => {
  const f = make({ skill: 2 }); ally(f, { col: 7 });
  const valid = enemy(f, { col: 6 }), camou = enemy(f, { col: 7, flags: { camou: true } });
  const hidden = ['stealth', 'sleep', 'untargetable'].map(flag => enemy(f, { col: 7, flags: { [flag]: true } }));
  cast(f); until(f, () => f.attacks.length === 1);
  const line = f.hits.filter(h => h.dmg.tags.includes('akkord:line'));
  const bursts = f.hits.filter(h => h.dmg.tags.includes('akkord:burst'));
  assert.deepEqual(line.map(h => h.target), [valid]); assert.deepEqual(bursts.map(h => h.target), [camou]);
  for (const t of hidden) near(t.hp, t.s.maxHp);
});
test('brief control cancels an unfired native attack; silence does not silence the source skills or talent', () => {
  const f = make(); ally(f); enemy(f); charge(f);
  f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
  until(f, () => f.controller.phase?.kind === 'attack'); assert.equal(f.controller.phase.s1, true);
  const h = f.b.addBuff(f.u, { key: 'fixture:control', flags: { stun: true } }); f.b.removeBuff(f.u, h);
  advance(f.b, 1); assert.equal(f.attacks.length, 0); assert.equal(f.u.skill.active, false); near(f.u.s.atk, 782);
  until(f, () => f.attacks.length === 1);
});
test('S2 mode switches cancel unreleased attacks and retain cooldown without inventing Begin/End clips', () => {
  const f = make({ skill: 2 }); enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack'); const cd = f.u.atkCd;
  cast(f); assert.equal(f.controller.phase, null); near(f.u.atkCd, cd); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Idle');
  advance(f.b, .8); assert.equal(f.hits.length, 0);
  until(f, () => f.controller.phase?.kind === 'attack'); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Loop');
  const remaining = f.u.atkCd; f.u.skill.end('fixture:end'); near(f.u.atkCd, remaining);
  assert.equal(f.controller.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
});
for (const dir of ['RIGHT', 'DOWN', 'UP', 'LEFT']) test(`${dir}: original facing/attack aliases replay each one-shot with capped speed`, () => {
  const f = make({ dir, skill: 2 });
  enemy(f, { row: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5, col: dir === 'LEFT' ? 4 : dir === 'RIGHT' ? 6 : 5 });
  f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 200 } });
  until(f, () => f.controller.phase?.kind === 'attack');
  const visual = { ...f.u.mem.regularFormVisual }, p = f.controller.phase;
  assert.equal(visual.clip, dir === 'DOWN' ? 'Attack_Down' : 'Attack'); assert.equal(visual.speed, 1);
  near(p.releaseAt - p.startedAt, .6666666865348816);
  until(f, () => f.attacks.length === 2); assert.notEqual(f.u.mem.regularFormVisual.playId, visual.playId);
  assert.equal(f.u.mem.regularVisualDirection, ['UP', 'LEFT'].includes(dir) ? 'UP' : 'RIGHT');
});
test('removal during a damage callback cannot spawn further allied blasts or leave a stale source controller', () => {
  const f = make({ skill: 2 }); enemy(f); ally(f); cast(f);
  f.b.on('damaged', ctx => { if (ctx.source === f.u) f.b._remove(f.u, 'fixture:reentrant', null, true); });
  until(f, () => f.controller.stopped); assert.equal(f.hits.length, 1);
  advance(f.b, 5); assert.equal(f.hits.length, 1); assert.equal(f.u.mem.regularFormVisual, undefined);
});
