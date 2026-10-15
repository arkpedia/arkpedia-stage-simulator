// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4237_jcinta.json' with { type: 'json' };
import { JCINTA_ID as ID, selectedJcintaBuild as select, jcintaComponent as component } from '../server/sim/content/arkpedia-jcinta-source.js';
import { JCINTA_CONTRACT } from '../server/sim/content/arkpedia-jcinta.js';
import { flyingSanctuaryRatio } from '../server/sim/damage.js';
import { makeDamageInfo } from '../server/sim/damage.js';
import { make, ally, enemy, blocked, cast, advance, until, near } from './helpers/jcinta-fixture.js';
const key = f => `jcinta:aerial-sanctuary:${f.u.id}`;
test('held original source follows the explicit S1 override without inventing a rank prefab or enabling a kit', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.deepEqual(e.skillBindings['skcom_assist_cost[3]'], [null]);
  assert.deepEqual(e.skillPrefabOverrides, { 'skcom_assist_cost[3]': 'skchr_jcinta_1' });
  assert.deepEqual(e.ownerModeSkills, []); assert.ok(e.skills.skchr_jcinta_1); assert.ok(e.skills.skchr_jcinta_2);
  assert.equal(component('8039878411083565386')._isCont, 1); assert.equal(component('8039878411083565386')._preDelay, 0);
  assert.equal(e.models[ID].Front.eventPayloads.Attack[0].time, .46666666865348816);
  assert.equal(e.models[ID].Back.durations.Die, undefined);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[flag], false);
  assert.throws(() => make({ contract: { ...JCINTA_CONTRACT } }), /source contract/);
  assert.throws(() => make({ mutate: d => { d.stats.atk++; } }), /selected source/);
  const b = make().build;
  for (const patch of [{ elite: 3 }, { level: 0 }, { level: 81 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { skillRank: 11 }, { skillId: 'other' }, { module: 'mod-x' }, { module: '' }, { module: 0 },
    { elite: 0, skillRank: 5 }, { elite: 0, skillRank: 4, skillId: 'skchr_jcinta_2' }]) assert.throws(() => select({ ...b, ...patch }));
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`E${elite}/P${potential}: source phase stats, trust and owned aerial Sanctuary`, () => {
  const f = make({ elite, potential, trust: 200 }), s = f.record.stats;
  const favor = e.tables.character.favorKeyFrames.at(-1).data;
  near(s.maxHp, [892, 1130, 1548][elite] + favor.maxHp); near(s.atk, [319, 421, 502][elite] + favor.atk);
  near(s.def, [249, 328, 387][elite] + favor.def + (potential === 6 ? 23 : 0)); near(s.cost, [9, 11, 11][elite] - (potential === 6 ? 2 : 0));
  const value = elite === 0 ? 0 : [0, .08, .13][elite] + (potential === 6 ? .02 : 0);
  near(f.u.findBuff(key(f))?.data.flyingSourceSanctuary ?? 0, value);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: 18 delayed DP pulses, zero block, no attacks and normal recovery after expiry`, () => {
  const f = make({ rank }); enemy(f); advance(f.b, 1.1); cast(f); const start = f.b.time;
  near(f.u.s.blockCnt, 0); near(f.b.dp, 0); near(f.u.skill.spTotal, 0);
  advance(f.b, .4); near(f.b.dp, 0); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Begin');
  advance(f.b, .15); near(f.b.dp, 1); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Loop');
  until(f, () => !f.u.skill.active, 9);
  near(f.b.time - start, 8, f.b.dt); near(f.b.dp, 18); assert.equal(f.grants.length, 18); assert.equal(f.hits.length, 0);
  near(f.grants[0].time - start, .44, f.b.dt * 1.01); near(f.grants.at(-1).time - start, 7.92, f.b.dt * 1.01);
  near(f.u.s.blockCnt, 1); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_End');
  until(f, () => f.hits.length === 1); near(f.hits[0].amount, 502); advance(f.b, .5); assert.ok(f.u.skill.spTotal > 0);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: 27 delayed DP pulses and source continuous one-ally healing without ordinary attacks`, () => {
  const f = make({ skill: 2, rank }), a = ally(f, { row: 5, col: 7, hp: 100000, ratio: .1 });
  const t = enemy(f); cast(f); const hp = a.hp, start = f.b.time;
  assert.equal(f.u.rangeKeySet.size, e.tables.ranges['x-1'].grids.length);
  advance(f.b, 1); near(a.hp - hp, f.u.s.atk * f.record.bb['attack@heal_scale']); near(f.b.dp, 0);
  near(f.u.s.blockCnt, 0); assert.equal(f.hits.length, 0); assert.equal(t.hp, t.s.maxHp);
  near(a.findBuff(key(f)).data.flyingSourceSanctuary, .13 * f.record.bb.talent_scale);
  until(f, () => !f.u.skill.active, 31);
  near(f.b.time - start, 30, f.b.dt); near(f.b.dp, 27); assert.equal(f.grants.length, 27);
  near(a.hp - hp, 30 * f.u.s.atk * f.record.bb['attack@heal_scale'], .001);
  assert.equal(a.findBuff(key(f)), null); near(f.u.findBuff(key(f)).data.flyingSourceSanctuary, .13);
  assert.equal(f.u.rangeKeySet.size, e.tables.ranges['1-1'].grids.length);
  near(f.u.s.blockCnt, 1); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_End');
});
test('ordinary attacks release one physical hit at the literal native event and never hit air', () => {
  const f = make(); const t = enemy(f), other = enemy(f); enemy(f, { fly: true });
  until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
  near(p.releaseAt - p.startedAt, .46666666865348816); advance(f.b, .4); assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, t); assert.equal(other.hp, other.s.maxHp);
  near(f.hits[0].amount, 502); assert.equal(f.hits[0].dmg.applyWay, 'melee');
  f.b.applyStatus(f.u, 'stun', { duration: .1 }); advance(f.b, .2); assert.deepEqual(f.b.errors, []);
});
test('a channel cancels an unfired ordinary attack; external block bonuses cannot break zero block', () => {
  const f = make({ skill: 2 }); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  f.b.addBuff(f.u, { key: 'test:block', mods: { blockCnt: 3 } }); cast(f); advance(f.b, 1);
  near(f.u.s.blockCnt, 0); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
});
test('aura ignores TargetFree/HealFree but excludes isolated or departed allies; S2 expands and restores its range', () => {
  const f = make({ skill: 2 }), a = ally(f, { flags: { untargetable: true, healFree: true } }),
    isolated = ally(f, { col: 4, flags: { isolated: true } }), outer = ally(f, { col: 7 });
  advance(f.b, .05); assert.ok(a.findBuff(key(f))); assert.equal(isolated.findBuff(key(f)), null); assert.equal(outer.findBuff(key(f)), null);
  cast(f); assert.ok(outer.findBuff(key(f))); a.x = 12; a.y = 12; advance(f.b, .05); assert.equal(a.findBuff(key(f)), null);
  f.u.skill.end('test'); assert.equal(outer.findBuff(key(f)), null);
});
test('continuous healing reselects the lowest HP ratio and obeys healing restrictions independently from its aura', () => {
  const f = make({ skill: 2 }), a = ally(f, { ratio: .2 }), z = ally(f, { col: 4, ratio: .3 }),
    no = ally(f, { row: 4, ratio: .01, flags: { healFree: true } }), iso = ally(f, { row: 6, ratio: .01, flags: { isolated: true } });
  cast(f); const hp = a.hp; advance(f.b, .5); near(a.hp - hp, 502 * .25 * .5); near(z.hp, 3000); near(no.hp, 100); near(iso.hp, 100);
  a.hp = a.s.maxHp; const zh = z.hp; advance(f.b, .5); near(z.hp - zh, 502 * .25 * .5);
  f.b.addBuff(f.u, { key: 'test:aspd', mods: { aspd: 200 } }); const before = z.hp; advance(f.b, 1); near(z.hp - before, 502 * .25);
  f.b.applyStatus(f.u, 'stun', { duration: .5 }); const stopped = z.hp; advance(f.b, .4); near(z.hp, stopped);
  assert.ok(no.findBuff(key(f))); assert.equal(iso.findBuff(key(f)), null);
});
for (const type of ['phys', 'arts', 'true', 'elemental']) test(`aerial Sanctuary: ${type} uses the source mask before flat resistance and shields`, () => {
  const f = make({ potential: 6 }), a = ally(f), source = enemy(f, { fly: true }); advance(f.b, .05);
  f.b.addBuff(a, { key: 'test:flat', mods: { flatDamageResistance: 5 }, shield: 10 });
  const hp = a.hp; f.b.dealDamage(source, a, { amount: 100, type, canDodge: false });
  near(hp - a.hp, ['phys', 'arts'].includes(type) ? 70 : 85);
});
test('aerial Sanctuary competes with ordinary/overlapping Sanctuary, preserves weaker fallback and never protects ground or sourceless damage', () => {
  const f = make({ skill: 2, potential: 6 }), a = ally(f), source = enemy(f, { fly: true }); cast(f);
  f.b.applyStatus(a, 'sanctuary', { key: 'other', value: .2 });
  const hit = (src, opts = {}) => { const hp = a.hp; f.b.dealDamage(src, a, { amount: 100, type: 'arts', ...opts }); return hp - a.hp; };
  near(hit(source), 70); source.motion = 'WALK'; near(hit(source), 80); source.motion = 'FLY'; near(hit(source, { sourceless: true }), 80);
  f.b.addBuff(a, { key: 'test:weaker', status: 'sanctuary', data: { flyingSourceSanctuary: .1 } }); near(hit(source), 70);
  f.b.applyStatus(a, 'sanctuary', { key: 'stronger', value: .4 }); near(hit(source), 60); f.b.removeBuff(a, 'stronger'); near(hit(source), 70);
  f.u.skill.end('test'); near(hit(source), 80); f.b.retreat(f.u); assert.equal(a.findBuff(key(f)), null); near(hit(source), 80);
  assert.ok(a.findBuff('other')); assert.ok(a.findBuff('test:weaker'));
});
test('conditional Sanctuary ratio never mutates shared damage inputs and retains zero/strongest ordinary channels', () => {
  const buffs = [{ status: 'sanctuary', mods: { artsTakenMul: .8 } }, { status: 'sanctuary', data: { flyingSourceSanctuary: .3 } }];
  const original = structuredClone(buffs); near(flyingSanctuaryRatio(buffs, { isFlying: true }, 'arts'), .7 / .8);
  near(flyingSanctuaryRatio(buffs, { isFlying: false }, 'arts'), 1); assert.deepEqual(buffs, original);
  buffs.push({ status: 'sanctuary', mods: { artsTakenMul: 0 } }); near(flyingSanctuaryRatio(buffs, { isFlying: true }, 'arts'), 1);
});
test('one shared area-damage receipt applies aerial Sanctuary independently to protected and unprotected recipients', () => {
  const f = make(), a = ally(f), outside = ally(f, { col: 9 }), source = enemy(f, { fly: true }); advance(f.b, .05);
  const packet = makeDamageInfo({ amount: 100, type: 'arts', canDodge: false }), before = structuredClone(packet);
  const hp = a.hp, outHp = outside.hp; f.b.dealDamage(source, a, packet); f.b.dealDamage(source, outside, packet);
  near(hp - a.hp, 87); near(outHp - outside.hp, 100); assert.deepEqual(packet, before);
});
test('protected DP continues during stun while continuous healing pauses; healing resumes at the current source ATK', () => {
  const f = make({ skill: 2 }), a = ally(f); cast(f); f.b.applyStatus(f.u, 'stun', { duration: 2 });
  const hp = a.hp; advance(f.b, 1.5); near(a.hp, hp); near(f.b.dp, 1); assert.ok(a.findBuff(key(f)));
  advance(f.b, 1); assert.ok(a.hp > hp);
  f.b.addBuff(f.u, { key: 'test:atk', mods: { atkPct: 1 } }); const before = a.hp; advance(f.b, 1); near(a.hp - before, 1004 * .25);
});
test('manual skill remains available under Silence, and aerial aura retains its source unsilenceable lifetime', () => {
  const f = make({ skill: 2 }), a = ally(f); f.b.applyStatus(f.u, 'silence', { duration: 20 }); cast(f); advance(f.b, 1.2);
  assert.equal(f.u.skill.active, true); near(f.b.dp, 1); assert.ok(a.hp > 1000); assert.ok(a.findBuff(key(f)));
});
test('an accepted short control application cancels an unfired native attack even after control expires', () => {
  const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  f.b.applyStatus(f.u, 'stun', { duration: .001 }); advance(f.b, .6); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
  until(f, () => f.hits.length === 1); near(f.hits[0].amount, 502);
});
test('blocked target priority selects a single enemy and attack hooks cannot reenter its release', () => {
  const f = make(), normal = enemy(f), pinned = enemy(f, { col: 4 });
  blocked(f, pinned);
  f.b.on('beforeAttack', ({ attacker }) => { if (attacker === f.u) f.b.forceAttack(f.u, [normal]); });
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, pinned); assert.equal(f.attacks.length, 1);
  near(normal.hp, normal.s.maxHp);
});
test('retreat/death/end remove owned aura and all future channel output', () => {
  for (const removal of ['retreat', 'death', 'end']) {
    const f = make({ skill: 2 }), a = ally(f); cast(f); advance(f.b, 1.2); assert.equal(f.grants.length, 1);
    if (removal === 'retreat') f.b.retreat(f.u); else if (removal === 'death') f.b.kill(f.u); else f.b._finish('cleared');
    const grants = f.grants.length, hp = a.hp; advance(f.b, 2); assert.equal(f.grants.length, grants); near(a.hp, hp);
    assert.equal(f.controller.stopped, true); assert.equal(a.findBuff(key(f)), null);
  }
});
