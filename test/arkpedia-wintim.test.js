// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4208_wintim.json' with { type: 'json' };
import { WINTIM_ID as ID, selectedWintimBuild as select, wintimComponent as component } from '../server/sim/content/arkpedia-wintim-source.js';
import { WINTIM_CONTRACT } from '../server/sim/content/arkpedia-wintim.js';
import { make, enemy, blocked, charge, cast, near, advance, until, addOwner } from './helpers/wintim-fixture.js';
const disarm = f => f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
test('complete CN native source stays held and selected builds require exact source, skill and contract', () => {
  assert.equal(e.schemaVersion, 2); assert.equal(e.operatorId, ID); assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[flag], false);
  assert.deepEqual(e.nativeTemplateGaps, []); assert.deepEqual(e.jsonTemplateGaps, []); assert.deepEqual(e.ownerModeSkills, []);
  assert.equal(Object.keys(e.projectiles).length, 3); assert.equal(Object.keys(e.templates).length, 5);
  assert.throws(() => make({ contract: { ...WINTIM_CONTRACT } }), /source contract/);
  assert.throws(() => make({ mutate: d => { d.stats.atk++; } }), /selected source/);
  const b = make().build;
  for (const patch of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 71 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { skillRank: 11 }, { skillId: 'other' }, { module: 'mod-x' }, { module: '' }, { module: 0 }, { elite: 0, skillRank: 5 },
    { elite: 0, skillRank: 4, skillId: 'skchr_wintim_2' }]) assert.throws(() => select({ ...b, ...patch }));
});
test('source retains different DP event chains, real-HP talent filter, melee mode and speed caps', () => {
  assert.equal(component('-8871476108691993078')._runActionOnEvent, 2);
  assert.equal(e.templates.charge_cost.eventToActions.ON_BUFF_START[0]._blackboardKey, 'cost');
  const dp = e.templates.wintim_s2_atk_cost.eventToActions; assert.deepEqual(Object.keys(dp), ['ON_OUTPUT_DAMAGE']);
  assert.equal(dp.ON_OUTPUT_DAMAGE[0]._forceToDisplayNumber, true);
  const loss = e.templates.wintim_t_1.eventToActions.ON_APPLIED_MODIFIER;
  assert.match(loss[0].$type, /IsDamage/); assert.equal(loss[1]._modifierTargetType, 'HP'); assert.equal(loss[1]._condType, 'LT');
  assert.equal(component('733469241643020047')._maxAnimScale, -1); assert.equal(component('-7138488055286428150')._maxAnimScale, 1);
  assert.equal(component('-7143610158481625329')._animKey, 'Combat');
  assert.equal(e.models[ID].Front.eventPayloads.Skill_1[0].time, .4333333373069763);
  assert.equal(e.models[ID].Back.eventPayloads.Skill_2_Loop[0].time, .46666666865348816);
  assert.equal(e.models[ID].Back.durations.Die, undefined);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`E${elite}/P${potential}: source stats, trust, potential and deployment ASPD talent`, () => {
  const f = make({ elite, potential, trust: 200 }), r = f.record;
  near(r.stats.maxHp, [948, 1200, 1645][elite] + 100); near(r.stats.atk, [342, 451, 537][elite]);
  near(r.stats.def, [148, 195, 230][elite] + 40); near(r.stats.cost, [7, 9, 9][elite] - (potential === 6 ? 2 : 0));
  near(r.stats.respawnTime, potential === 6 ? 31 : 35);
  near(f.u.s.aspd, 100 + (potential === 6 ? 5 : 0) + (elite === 0 ? 0 : [0, 5, 10][elite] + (potential === 6 ? 2 : 0)));
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: DP is granted at activation, enhanced projectile waits for native release and spends one charge`, () => {
  const f = make({ rank }); enemy(f, { fly: true }); charge(f);
  near(f.u.skill.spCost, [9, 9, 9, 8, 8, 8, 7, 7, 7, 7][rank - 1]);
  until(f, () => f.controller.phase?.s1);
  assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0); near(f.b.dp, 3); assert.equal(f.grants.length, 1);
  const p = f.controller.phase; near(p.releaseAt - p.startedAt, .4333333373069763); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
  advance(f.b, .2); assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.u.skill.spTotal, 0);
  until(f, () => f.attacks.length === 1); assert.equal(f.hits.length, 0); assert.equal(f.b.projectiles.list.length, 1);
  until(f, () => f.hits.length === 1);
  const scale = [1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.3, 2.5, 2.8][rank - 1];
  near(f.hits[0].amount, 537 * scale); assert.equal(f.hits[0].dmg.isSkill, true); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.skill.charges, 0); near(f.u.skill.spTotal, 0); near(f.b.dp, 3);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: manual nine-second ASPD mode, one-second Sluggish and accepted-output DP`, () => {
  const f = make({ skill: 2, rank }), t = enemy(f); cast(f);
  near(f.u.skill.spCost, [39, 38, 37, 36, 35, 34, 33, 32, 31, 30][rank - 1]);
  near(f.u.s.aspd, 110 + [5, 8, 11, 16, 19, 22, 25, 30, 35, 40][rank - 1]);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin'); const start = f.b.time;
  advance(f.b, .1); assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0); near(f.b.dp, 0);
  until(f, () => f.attacks.length === 1); assert.equal(f.hits.length, 0); near(f.b.dp, 0);
  until(f, () => f.hits.length === 1); near(f.b.dp, 1); near(f.hits[0].amount, 537);
  near(t.s.moveSpeed, .2); near(t.findBuff('sluggish').timeLeft, 1, f.b.dt * 2);
  disarm(f); advance(f.b, 1.1); assert.equal(t.findBuff('sluggish'), null); near(t.s.moveSpeed, 1);
  until(f, () => !f.u.skill.active, 9); near(f.b.time - start, 9, f.b.dt); near(f.u.s.aspd, 110);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Idle'); near(f.u.skill.spTotal, 0, f.b.dt * 2);
});
test('ordinary ranged attacks hit one target, including air, and naturally recover offensive SP once per launch', () => {
  const f = make(), a = enemy(f, { fly: true }); enemy(f, { col: 7 });
  until(f, () => f.attacks.length === 1); near(f.u.skill.spTotal, 3); // M3 has two initial SP.
  assert.equal(f.hits.length, 0); until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].target, a); near(f.hits[0].amount, 537); assert.equal(f.hits[0].dmg.applyWay, 'ranged');
  until(f, () => f.u.skill.activations === 1);
  assert.equal(f.attacks.length, 5); near(f.b.dp, 3); assert.equal(f.hits.filter(h => h.dmg.isSkill).length, 0);
});
test('a blocked target uses immediate Combat, takes priority even behind the operator and is never double-hit', () => {
  const f = make(), t = enemy(f); blocked(f, t); t.x = 4;
  enemy(f, { col: 6, fly: true }); until(f, () => f.attacks.length === 1);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Combat'); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, t); assert.equal(f.hits[0].dmg.applyWay, 'melee');
});
test('S1 still uses its original projectile for a blocked input rather than silently becoming a melee ability', () => {
  const f = make(), t = enemy(f); blocked(f, t); charge(f); until(f, () => f.attacks.length === 1);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1'); assert.equal(f.b.projectiles.list.length, 1);
  assert.equal(f.hits.length, 0); until(f, () => f.hits.length === 1); near(f.b.dp, 3);
});
test('S1 dead-input refund retains its earlier DP grant and does not invent a projectile or attack account', () => {
  const f = make(), t = enemy(f); charge(f); until(f, () => f.controller.phase?.s1);
  const p = f.controller.phase; near(f.b.dp, 3); f.b._remove(t, 'fixture:dead', null, true);
  until(f, () => p.released); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
  assert.equal(f.b.projectiles.list.length, 0); near(f.u.skill.spTotal, f.u.skill.spCost); near(f.b.dp, 3);
});
test('a living captured input leaving range still receives the launched shot; TargetFree does not refund S1', () => {
  for (const invalid of [false, true]) {
    const f = make(), t = enemy(f); charge(f); until(f, () => f.controller.phase?.s1);
    if (invalid) f.b.addBuff(t, { key: 'fixture:free', flags: { untargetable: true } }); else t.x = 12;
    const p = f.controller.phase; until(f, () => p.released);
    if (invalid) { assert.equal(f.attacks.length, 0); near(f.u.skill.spTotal, 0); }
    else { until(f, () => f.hits.length === 1); assert.equal(f.attacks.length, 1); }
    near(f.b.dp, 3);
  }
});
test('talent survives shields, zero damage, HPLOSS and gauge fill, then is lost permanently on real HP damage', () => {
  const f = make({ potential: 6 }), t = enemy(f);
  const initial = f.u.s.aspd; f.b.loseHp(f.u, 1, { source: t }); near(f.u.s.aspd, initial);
  f.b.dealDamage(t, f.u, { amount: 1, type: 'element', element: 'neural' }); near(f.u.s.aspd, initial);
  const shield = f.b.addBuff(f.u, { key: 'fixture:shield', shield: 100 });
  f.b.dealDamage(t, f.u, { amount: 10, type: 'true' }); near(f.u.s.aspd, initial);
  f.b.removeBuff(f.u, shield); f.b.dealDamage(t, f.u, { amount: 0, type: 'true' }); near(f.u.s.aspd, initial);
  f.b.dealDamage(t, f.u, { amount: 1, type: 'true' }); near(f.u.s.aspd, 105); assert.equal(f.controller.talentLost, true);
  f.b.heal(f.u, f.u, 1000); advance(f.b, .2); near(f.u.s.aspd, 105);
  f.b._remove(f.u, 'fixture:retire', null, true);
  const next = addOwner(f.b, f.build, { row: 6, col: 5 }); next.u.player.dp = 99;
  assert.ok(f.b._deploy(next.u, { initial: false })); near(next.u.s.aspd, initial); assert.equal(next.controller.talentLost, false);
});
for (const state of ['normal', 'shield', 'dodge', 'cancel']) test(`S2 ${state} output: DP follows accepted HP damage while Sluggish remains a separate attachment`, () => {
  const f = make({ skill: 2 }), t = enemy(f);
  if (state === 'shield') f.b.addBuff(t, { key: 'fixture:shield', shield: 1e5 });
  if (state === 'dodge') f.b.addBuff(t, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
  if (state === 'cancel') f.b.on('hit', ctx => { if (ctx.source === f.u) ctx.dmg.cancel = true; });
  cast(f); until(f, () => f.attacks.length === 1); advance(f.b, .2);
  near(f.b.dp, ['normal', 'shield'].includes(state) ? 1 : 0); near(t.s.moveSpeed, .2);
  near(t.hp, state === 'normal' ? t.s.maxHp - 537 : t.s.maxHp);
});
test('S2 output hook is not restricted to attacks; HPLOSS, gauge fill, another source and expired S2 grant no DP', () => {
  const f = make({ skill: 2 }), t = enemy(f); cast(f);
  f.b.dealDamage(f.u, t, { amount: 10, type: 'arts', isAttack: false }); near(f.b.dp, 1);
  f.b.loseHp(t, 10, { source: f.u }); near(f.b.dp, 1);
  f.b.dealDamage(f.u, t, { amount: 1, type: 'element', element: 'neural' }); near(f.b.dp, 1);
  f.b.dealDamage(t, f.u, { amount: 1, type: 'true' }); near(f.b.dp, 1);
  f.u.skill.end('fixture:end'); f.b.dealDamage(f.u, t, { amount: 10, type: 'phys' }); near(f.b.dp, 1);
});
test('an S2 projectile retains damage/slow after skill expiry or owner removal, but cannot award removed S2 DP', () => {
  for (const retire of [false, true]) {
    const f = make({ skill: 2 }), t = enemy(f, { col: 7 }); cast(f);
    until(f, () => f.attacks.length === 1);
    if (retire) f.b._remove(f.u, 'fixture:retire', null, true); else f.u.skill.end('fixture:end');
    until(f, () => f.hits.length === 1); near(f.hits[0].amount, 537); near(t.s.moveSpeed, .2); near(f.b.dp, 0);
  }
});
test('an ordinary projectile launched before S2 grants active output DP on arrival without gaining an invented slow', () => {
  const f = make({ skill: 2 }), t = enemy(f, { col: 7 }); until(f, () => f.attacks.length === 1);
  cast(f); until(f, () => f.hits.length === 1); near(f.b.dp, 1); assert.equal(t.findBuff('sluggish'), null);
  assert.equal(f.hits[0].dmg.tags.includes('wintim:ordinary'), true);
});
test('an in-flight input redeployed as a new life does not inherit a stale damage or slow receipt', () => {
  const f = make({ skill: 2 }), t = enemy(f); cast(f); until(f, () => f.attacks.length === 1);
  t.deploySeq = ++f.b._deploySeq; advance(f.b, .2); assert.equal(f.hits.length, 0); assert.equal(t.findBuff('sluggish'), null); near(f.b.dp, 0);
});
test('ordinary animation can accelerate beyond one; skill animations retain the native cap and replay one-shots', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }); enemy(f); f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 200 } });
    until(f, () => f.controller.phase?.kind === 'attack'); assert.ok(f.u.mem.regularFormVisual.speed > 1);
    const visual = f.u.mem.regularFormVisual.playId;
    if (skill === 1) charge(f); else cast(f);
    until(f, () => f.controller.phase?.kind === 'attack' && (f.controller.phase.s1 || f.controller.phase.s2));
    assert.equal(f.u.mem.regularFormVisual.speed, 1); assert.notEqual(f.u.mem.regularFormVisual.playId, visual);
  }
});
test('a brief control before release cancels S1 without retracting its already granted DP', () => {
  const f = make(); enemy(f); charge(f); until(f, () => f.controller.phase?.s1);
  const h = f.b.addBuff(f.u, { key: 'fixture:control', flags: { stun: true } }); f.b.removeBuff(f.u, h);
  advance(f.b, .5); assert.equal(f.attacks.length, 0); near(f.b.dp, 3); assert.equal(f.u.skill.active, false);
});
test('beforeAttack veto and recursive hooks cannot award extra DP or manufacture an extra account', () => {
  const f = make({ skill: 2 }), t = enemy(f); cast(f);
  const veto = f.b.on('beforeAttack', c => { if (c.attacker === f.u) c.targets = []; });
  until(f, () => f.controller.phase?.released); assert.equal(f.attacks.length, 0); near(f.b.dp, 0); f.b.off(veto);
  const nested = []; f.b.on('beforeAttack', c => { if (c.attacker === f.u) nested.push(f.b.forceAttack(f.u, [t])); });
  until(f, () => f.hits.length === 1); assert.deepEqual(nested, [false]); assert.equal(f.attacks.length, 1); near(f.b.dp, 1);
});
test('S2 blocked combat applies damage, Sluggish and one DP immediately without a ranged projectile', () => {
  const f = make({ skill: 2 }), t = enemy(f); blocked(f, t); cast(f);
  until(f, () => f.attacks.length === 1); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].dmg.applyWay, 'melee'); near(f.b.dp, 1); near(t.s.moveSpeed, .2);
});
test('real HP damage removes the talent without stripping the separate S2 ASPD bonus', () => {
  const f = make({ skill: 2, potential: 6 }), t = enemy(f); cast(f); near(f.u.s.aspd, 157);
  f.b.dealDamage(t, f.u, { type: 'true', amount: 1 }); near(f.u.s.aspd, 145); near(f.b.dp, 0);
  f.u.skill.end('fixture:end'); near(f.u.s.aspd, 105);
});
for (const dir of ['RIGHT', 'UP', 'DOWN', 'LEFT']) test(`${dir}: attack presentation follows its input while the deployment range stays fixed`, () => {
  const f = make({ dir }); enemy(f, { row: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5,
    col: dir === 'LEFT' ? 4 : dir === 'RIGHT' ? 6 : 5 });
  const range = [...f.u.rangeGrid]; until(f, () => f.controller.phase?.kind === 'attack');
  assert.equal(f.u.dir, dir); assert.equal(f.u.mem.regularVisualDirection, dir); assert.deepEqual(f.u.rangeGrid, range);
  until(f, () => f.hits.length === 1); near(f.hits[0].amount, 537);
});
