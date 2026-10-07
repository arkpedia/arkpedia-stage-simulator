// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-fourth-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_FOURTH_OPERATORS } from '../shared/arkpedia/five-star-guard-fourth-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets } from '../server/sim/ai.js';
import { applyHpLoss, makeDamageInfo } from '../server/sim/damage.js';

const BRY = 'char_4106_bryota', MOR = 'char_154_morgan', DAG = 'char_157_dagda';
const LET = 'char_194_leto', WIND = 'char_4083_chimes', BEAGLE = 'char_122_beagle';
const MELA = 'char_208_melan', GUMMY = 'char_196_sunbr', ZIMA = 'char_115_headbr', INDRA = 'char_155_tiger';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(id, options = {}, allies = [], tags = []) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = []; src.stage.mapTags = tags;
  const b = new StandardBattle(src, { operators: [id, ...allies].map(k => ({ ...defaultBuild(src.operators[k]), ...(k === id ? options : {}) })) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99); return b;
}
function deploy(b, id, r = 2, c = 7) { b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, 'RIGHT'); u.atkCd = 1000; return u; }
function enemy(b, x = 8, y = 2) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = e.hp = 100000; e.base.def = e.base.res = e.base.moveSpeed = 0; e.markDirty();
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function cast(u) { u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(u.skill.activate('test'), true); }
function strike(b, u, targets, seconds = 1) {
  const es = Array.isArray(targets) ? targets : [targets], hp = es.map(e => e.hp);
  u.atkCd = 1000; b.forceAttack(u, es); advance(b, seconds); u.atkCd = 1000; return hp.map((h, i) => h - es[i].hp);
}
const components = rows => rows.flatMap(r => r.components);

test('fourth guard batch retains all source skills, selectors, map-tag gates, typed damage and exact model hits', () => {
  assert.equal(evidence.sourceVersion, '26-09-23-17-49-43_b9cc4a');
  for (const [id, support] of Object.entries(FIVE_STAR_GUARD_FOURTH_OPERATORS)) {
    assert.match(evidence.sourceBundles.find(x => x.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.equal(data.operators[id].skills.length, 2);
    for (const skillId of support.skillIds) assert.ok(evidence.skills[skillId.split('[')[0]]?.length);
  }
  assert.deepEqual(evidence.originalModels[DAG].hits.Skill1, [.1]);
  assert.deepEqual(evidence.originalModels[WIND].hits.Skill_End, [.5]);
  assert.deepEqual(evidence.buffTemplates.morgan_t_2.eventToActions.ON_BUFF_START[0]._mapTags, ['main_12']);
  assert.equal(evidence.buffTemplates.morgan_s_1.eventToActions.ON_BUFF_START[0]._skipModifierEvent, true);
  assert.equal(evidence.buffTemplates.damage_resistance.eventToActions.ON_TAKE_DAMAGE[0]._damageMask, 'PHYSICAL_AND_MAGICAL');
  assert.equal(evidence.buffTemplates.dagda_t_1.eventToActions.ON_CALCULATE_DAMAGE[0]._probKey, 'prob');
  const d = components(evidence.characters[DAG]).find(c => c._additionalTimes === 1);
  assert.equal(d._splitDamage, 0); assert.equal(d._waitAttackEventForAllAttacks, 0);
});

test('both skills use exact source ranks, SP costs, durations and non-placeholder specs', () => {
  for (const [id, config] of Object.entries(FIVE_STAR_GUARD_FOURTH_OPERATORS)) for (const skillId of config.skillIds)
    for (let rank = 1; rank <= 10; rank++) {
      const b = make(id, { skillId, skillRank: rank }), u = deploy(b, id);
      assert.equal(u.skill.id, skillId); near(u.skill.spCost, u.def.skill.spCost); assert.equal(u.skill.noSkill, false);
      if (id === DAG && skillId === 'skchr_dagda_1') assert.equal(u.skill.kind, 'toggle');
      else near(u.skill.duration, u.def.skill.duration);
    }
});

test('Bryophyta instructor ATK scale is pre-DEF and depends on own blocking for normal and S1', () => {
  const b = make(BRY), u = deploy(b, BRY), e = enemy(b); e.base.def = 100; e.markDirty();
  near(strike(b, u, e)[0], u.s.atk * 1.2 - 100);
  e.blockedBy = u; u.blocking = [e]; near(strike(b, u, e)[0], u.s.atk - 100);
  cast(u); near(strike(b, u, e)[0], u.s.atk * u.skill.bb.atk_scale - 100);
  e.blockedBy = null; u.blocking = []; cast(u);
  near(strike(b, u, e)[0], u.s.atk * u.skill.bb.atk_scale * 1.2 - 100);
});

test('Bryophyta aura switches between ground-capable x4 neighbors and self, preserving unrelated buffs', () => {
  const b = make(BRY, {}, [BEAGLE, MELA]), u = deploy(b, BRY), a = deploy(b, BEAGLE, 2, 6), far = deploy(b, MELA, 2, 3);
  b.addBuff(a, { key: 'test:outside-def', mods: { defPct: .2 } }); advance(b, b.dt);
  near(a.s.def, a.base.def * (1 + a.def.talents[0].bb.def + .2 + .12)); near(u.s.def, u.base.def);
  const e = enemy(b); e.blockedBy = u; u.blocking = [e]; advance(b, b.dt);
  near(u.s.def, u.base.def * 1.12); near(a.s.def, a.base.def * (1 + a.def.talents[0].bb.def + .2));
  e.blockedBy = null; u.blocking = []; b.addBuff(a, { key: 'test:free', flags: { untargetable: true } }); advance(b, b.dt);
  assert.equal(a.findBuff(`bryophyta:aura:${u.id}`), null); assert.equal(far.findBuff(`bryophyta:aura:${u.id}`), null);
  b.removeBuff(a, 'test:free'); advance(b, b.dt); assert.ok(a.findBuff(`bryophyta:aura:${u.id}`));
  b.retreatOperator(BRY); assert.equal(a.findBuff(`bryophyta:aura:${u.id}`), null); assert.ok(a.findBuff('test:outside-def'));
});

test('Bryophyta S2 selects one highest-block neighbor, keeps own ATK separate and stuns only natural expiry', () => {
  const b = make(BRY, { skillId: 'skchr_bryota_2' }, [BEAGLE, MELA]), u = deploy(b, BRY), a = deploy(b, BEAGLE, 2, 6), c = deploy(b, MELA, 3, 7);
  cast(u); assert.equal(u.mem.bryophytaTarget, a); near(u.s.atk, u.base.atk * 1.8);
  near(a.findBuff(`bryophyta:skill:${u.id}`).mods.defPct, .8); assert.equal(c.findBuff(`bryophyta:skill:${u.id}`), null);
  u.skill.end('duration'); assert.ok(u.findBuff('stun')); assert.equal(a.findBuff(`bryophyta:skill:${u.id}`), null);
  const solo = make(BRY, { skillId: 'skchr_bryota_2' }), x = deploy(solo, BRY); cast(x);
  assert.equal(x.mem.bryophytaTarget, x); near(x.s.def, x.base.def * 1.8);
  solo.retreatOperator(BRY); assert.equal(x.findBuff('stun'), null);
});

test('Morgan Tenacity interpolates by source promotion/potential and clamps below30% HP', () => {
  for (const [elite, potential, max] of [[1, 1, .4], [1, 6, .42], [2, 1, .5], [2, 6, .52]]) {
    const b = make(MOR, { elite, level: elite === 1 ? 70 : 80, skillRank: 7, potential }), u = deploy(b, MOR);
    u.hp = u.s.maxHp * .65; advance(b, b.dt); near(u.s.atk, u.base.atk * (1 + max / 2));
    u.hp = u.s.maxHp * .3; advance(b, b.dt); near(u.s.atk, u.base.atk * (1 + max));
    u.hp = 1; advance(b, b.dt); near(u.s.atk, u.base.atk * (1 + max));
    u.hp = u.s.maxHp; advance(b, b.dt); near(u.s.atk, u.base.atk);
  }
});

test('Morgan S1 drains once on release before chosen HP-derived output and bypasses modifiers/barriers', () => {
  const b = make(MOR), u = deploy(b, MOR), e = enemy(b); cast(u);
  b.addBuff(u, { key: 'test:immune', flags: { invulnerable: true }, mods: { dmgTakenMul: .01 }, shield: 10000 });
  const hp = u.hp; b.forceAttack(u, [e]); advance(b, .4); near(u.hp, hp); near(e.hp, 100000);
  advance(b, .1); u.atkCd = 1000; near(u.hp, hp * .88);
  near(100000 - e.hp, u.base.atk * (1 + .5 * .12 / .7) * 1.9);
  near(u.findBuff('test:immune').shield, 10000);
  u.skill.bb = { ...u.skill.bb, 'attack@hp_ratio': 2 }; const before = e.hp;
  b.forceAttack(u, [e]); advance(b, .5); assert.equal(u.alive, false); near(e.hp, before);
});

test('Morgan S1 HP drain and outgoing scale are source values at all ten ranks', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const b = make(MOR, { skillRank: rank }), u = deploy(b, MOR), e = enemy(b); cast(u);
    const hp = u.hp, dealt = strike(b, u, e, .6)[0]; near(u.hp, hp * (1 - u.skill.bb['attack@hp_ratio']));
    near(dealt, u.s.atk * u.skill.bb['attack@atk_scale']);
  }
});

test('Morgan S2 deploy cut is nonlethal, barrier decays per second independently of duration and never recasts', () => {
  const b = make(MOR, { skillId: 'skchr_morgan_2' }), u = deploy(b, MOR), hp = u.s.maxHp;
  near(u.hp, hp * .3); near(u.findBuff('morgan:barrier').shield, hp * 1.5); assert.equal(u.skill.active, true);
  advance(b, 1.1); near(u.findBuff('morgan:barrier').shield, hp * 1.5 * 5 / 6);
  const before = u.hp; near(b.dealDamage(null, u, { amount: 100, type: 'true' }), 0); near(u.hp, before);
  advance(b, 5.1); assert.equal(u.findBuff('morgan:barrier'), null); assert.equal(u.skill.active, true);
  advance(b, 12); assert.equal(u.skill.active, false); assert.equal(u.skill.activate('test'), false);
  const solo = make(MOR, { skillId: 'skchr_morgan_2' }), x = deploy(solo, MOR);
  x.hp = 2; x.skill.spec.onStart({ battle: solo, unit: x }); near(x.hp, 1);
});

test('Morgan deployment slot exemption requires exact original main_12 tag and E2', () => {
  for (const [elite, tags, cost] of [[2, ['main_12'], 0], [1, ['main_12'], 1], [0, ['main_12'], 1], [2, [], 1], [2, ['main_11'], 1]]) {
    const b = make(MOR, { elite, level: elite === 0 ? 50 : elite === 1 ? 70 : 80, skillRank: elite === 0 ? 4 : 7 }, [], tags);
    const u = deploy(b, MOR); assert.equal(u.deploymentSlotCost, cost); assert.equal(b.deployedSlots(), cost);
  }
});

test('Dagda S1 arms full hurt-SP, reduces one Physical hit only and keeps counter until next valid target', () => {
  const b = make(DAG), u = deploy(b, DAG); b.rng = () => .99;
  u.skill.gainSp(u.skill.spCost, 'test'); advance(b, b.dt); assert.equal(u.skill.active, true);
  const hp = u.hp; b.dealDamage(null, u, { amount: 100, type: 'arts', canDodge: false }); near(hp - u.hp, 100); assert.equal(u.skill.active, true);
  const e = enemy(b), before = u.hp;
  b.dealDamage(e, u, { amount: u.s.def + 200, type: 'phys', canDodge: false }); near(before - u.hp, 80);
  assert.equal(u.skill.active, false); assert.equal(u.mem.dagdaCounter, true);
  near(strike(b, u, e, .2)[0], u.s.atk * 2.1); assert.equal(u.mem.dagdaCounter, false);
  near(strike(b, u, e, .25)[0], u.s.atk);
});

test('Dagda physical guard interrupts an already queued normal attack and resets into original fast counter', () => {
  const b = make(DAG), u = deploy(b, DAG), e = enemy(b); b.rng = () => .99; cast(u);
  b.forceAttack(u, [e]); advance(b, .05); const hp = e.hp;
  b.dealDamage(e, u, { amount: u.s.def + 100, type: 'phys', canDodge: false });
  u.atkCd = 1000; b.forceAttack(u, [e]); advance(b, .15);
  near(hp - e.hp, u.s.atk * 2.1); assert.equal(u.mem.dagdaCounter, false);
  advance(b, .2); near(hp - e.hp, u.s.atk * 2.1);
});

test('Dagda S2 two hits independently mitigate full ATK and assign source probability rather than adding it', () => {
  const b = make(DAG, { skillId: 'skchr_dagda_2' }), u = deploy(b, DAG), e = enemy(b); e.base.def = 100; e.markDirty();
  cast(u); b.rng = () => .65; near(strike(b, u, e, .3)[0], 2 * (u.s.atk - 100));
  b.rng = () => .55; near(strike(b, u, e, .3)[0], 2 * (u.s.atk * 1.5 - 100));
  u.skill.end('duration'); near(strike(b, u, e, .25)[0], u.s.atk - 100);
});

test('Dagda crit increases for nearby Glasgow kills credited to any source, once per kill and caps correctly', () => {
  const b = make(DAG, {}, [INDRA]), u = deploy(b, DAG), a = deploy(b, INDRA, 2, 5), target = enemy(b); b.rng = () => 0;
  near(strike(b, u, target, .25)[0], u.s.atk * 1.5);
  const remote = enemy(b, 2, 0); b.kill(remote, a); near(strike(b, u, target, .25)[0], u.s.atk * 1.5);
  for (let i = 0; i < 30; i++) b.kill(enemy(b, 5, 3), a);
  near(strike(b, u, target, .25)[0], u.s.atk * 2.4);
});

test('Dagda episode HP and damage heal are enabled only by exact main_11 source tag and E2', () => {
  for (const [elite, tags, enabled] of [[2, ['main_11'], true], [1, ['main_11'], false], [2, [], false], [2, ['main_12'], false]]) {
    const b = make(DAG, { elite, level: elite === 1 ? 70 : 80, skillRank: 7 }, [], tags), u = deploy(b, DAG), e = enemy(b); b.rng = () => .99;
    near(u.s.maxHp, u.base.maxHp * (enabled ? 1.2 : 1));
    u.hp = u.s.maxHp / 2; const hp = u.hp, dealt = strike(b, u, e, .25)[0]; near(u.hp - hp, enabled ? dealt * .2 : 0);
  }
});

test('Leto normal/S1 keep physical ranged penalty and S2 hits two with full ranged ATK', () => {
  const b = make(LET), u = deploy(b, LET), close = enemy(b), far = enemy(b, 9); close.base.def = far.base.def = 100; close.markDirty(); far.markDirty();
  near(strike(b, u, far)[0], u.s.atk * .8 - 100); near(strike(b, u, close)[0], u.s.atk - 100);
  cast(u); near(strike(b, u, far)[0], u.s.atk * .8 - 100);
  const s = make(LET, { skillId: 'skchr_leto_2' }), x = deploy(s, LET), e1 = enemy(s, 9), e2 = enemy(s, 8, 3); cast(x);
  assert.equal(acquireTargets(s, x, { ...x.profile, maxTargets: 2 }).length, 2);
  const dealt = strike(s, x, [e1, e2]); near(dealt[0], x.s.atk); near(dealt[1], x.s.atk);
});

test('Leto talent follows own skill, source student tag and eligible live recipients with clean removal', () => {
  const b = make(LET, {}, [GUMMY, MELA]), u = deploy(b, LET), a = deploy(b, GUMMY, 2, 6), other = deploy(b, MELA, 3, 7);
  const normal = a.s.aspd; cast(u); near(a.s.aspd, normal + 21); near(u.s.aspd, u.base.aspd + 45 + 21);
  assert.equal(other.findBuff(`leto:team-speed:${u.id}`), null);
  b.addBuff(a, { key: 'test:outside-speed', mods: { aspd: 7 } });
  b.addBuff(a, { key: 'test:hidden', flags: { untargetable: true } }); advance(b, b.dt); near(a.s.aspd, normal + 7);
  b.removeBuff(a, 'test:hidden'); advance(b, b.dt); near(a.s.aspd, normal + 7 + 21);
  b.retreatOperator(LET); near(a.s.aspd, normal + 7); assert.ok(a.findBuff('test:outside-speed'));
});

test('Leto S2 activates only other ready eligible students and spends their existing SP once', () => {
  const b = make(LET, { skillId: 'skchr_leto_2' }, [GUMMY, ZIMA, MELA]);
  const u = deploy(b, LET), g = deploy(b, GUMMY, 2, 6), z = deploy(b, ZIMA, 3, 7), other = deploy(b, MELA, 3, 6);
  z.skill.gainSp(z.skill.spCost, 'test'); other.skill.gainSp(other.skill.spCost, 'test');
  const zn = z.skill.activations, gn = g.skill.activations, mn = other.skill.activations;
  cast(u); assert.equal(z.skill.activations, zn + 1); assert.equal(z.skill.sp, 0);
  assert.equal(g.skill.activations, gn); assert.equal(other.skill.activations, mn);
  u.skill.end('duration'); z.skill.end('duration'); b.addBuff(z, { key: 'test:silence', flags: { silence: true } });
  z.skill.gainSp(z.skill.spCost, 'test'); cast(u); assert.equal(z.skill.activations, zn + 1); assert.equal(z.skill.ready, true);
});

test('Wind Chimes adds source maxHP and strict50% Vigor and attacks current block capacity including unblocked targets', () => {
  const b = make(WIND), u = deploy(b, WIND), es = [enemy(b, 8), enemy(b, 8.1), enemy(b, 7.9)];
  near(u.s.maxHp, u.base.maxHp * 1.05); near(u.s.atk, u.base.atk * 1.2);
  assert.equal(acquireTargets(b, u, u.profile).length, 2);
  b.addBuff(u, { key: 'test:extra-block', mods: { blockCnt: 1 } }); assert.equal(acquireTargets(b, u, u.profile).length, 3);
  u.hp = u.s.maxHp * .5; advance(b, b.dt); near(u.s.atk, u.base.atk);
  u.hp += .01; advance(b, b.dt); near(u.s.atk, u.base.atk * 1.2);
  cast(u); near(u.s.atk, u.base.atk * 2.2); assert.ok(es.every(e => e.alive));
});

test('Wind Chimes charge starts immediately, ticks once per second, caps at source five stacks and stops attacks', () => {
  const b = make(WIND, { skillId: 'skchr_chimes_2' }), u = deploy(b, WIND), e = enemy(b); cast(u);
  near(u.findBuff('chimes:charge').mods.atkPct, .1); near(u.s.atk, u.base.atk * 1.3);
  u.atkCd = 0; advance(b, .9); near(e.hp, 100000); near(u.findBuff('chimes:charge').mods.atkPct, .1);
  advance(b, .2); near(u.findBuff('chimes:charge').mods.atkPct, .2);
  advance(b, 3); near(u.findBuff('chimes:charge').mods.atkPct, .5); near(e.hp, 100000);
});

test('Wind Chimes source Sanctuary keeps strongest status only, restores weaker after expiry, ignores true and HP loss', () => {
  const b = make(WIND, { skillId: 'skchr_chimes_2' }), u = deploy(b, WIND); cast(u);
  b.applyStatus(u, 'sanctuary', { key: 'test:stronger', value: .6, duration: .3 });
  near(b.dealDamage(null, u, { amount: 100, type: 'arts', canDodge: false }), 40);
  near(b.dealDamage(null, u, { amount: u.s.def + 100, type: 'phys', canDodge: false }), 40);
  near(b.dealDamage(null, u, { amount: 100, type: 'true' }), 100);
  near(applyHpLoss(b, null, u, 100, makeDamageInfo({ type: 'true' })), 100);
  advance(b, .4); near(b.dealDamage(null, u, { amount: 100, type: 'arts', canDodge: false }), 100 * (1 - u.skill.bb.damage_resistance));
  b.applyStatus(u, 'sanctuary', { key: 'test:outside', value: .5 });
  u.skill.end('control'); near(b.dealDamage(null, u, { amount: 100, type: 'arts', canDodge: false }), 50);
  assert.equal(u.findBuff('chimes:sanctuary'), null); assert.ok(u.findBuff('test:outside'));
});

test('Wind Chimes finisher releases after source half-second to all ground targets, with stun and ending cleanup', () => {
  const b = make(WIND, { skillId: 'skchr_chimes_2' }), u = deploy(b, WIND), e1 = enemy(b), e2 = enemy(b, 8.1), e3 = enemy(b, 7.9), fly = enemy(b);
  fly.motion = 'FLY'; fly.markDirty(); cast(u); advance(b, 4.1); const atk = u.s.atk;
  u.skill.end('manual'); assert.equal(u.mem.regularFormVisual.clip, 'Skill_End');
  advance(b, .45); near(e1.hp, 100000); advance(b, .1); u.atkCd = 1000;
  for (const e of [e1, e2, e3]) { near(100000 - e.hp, atk * 2.3); assert.ok(e.findBuff('stun')); }
  near(fly.hp, 100000); assert.equal(fly.findBuff('stun'), null);
  advance(b, 1.2); assert.equal(u.findBuff('chimes:charge'), null); assert.equal(u.findBuff('chimes:ending'), null);
  assert.equal(u.findBuff('chimes:sanctuary'), null); assert.equal(u.mem.regularFormVisual, null);
});

test('Wind Chimes control and retreat interrupt an unfired finisher without stale delayed damage or buffs', () => {
  for (const mode of ['hold-control', 'ending-control', 'retreat']) {
    const b = make(WIND, { skillId: 'skchr_chimes_2' }), u = deploy(b, WIND), e = enemy(b); cast(u);
    if (mode !== 'hold-control') u.skill.end('manual');
    if (mode === 'retreat') b.retreatOperator(WIND); else b.applyStatus(u, 'stun', { duration: .2 });
    advance(b, 2); near(e.hp, 100000); assert.equal(u.findBuff('chimes:charge'), null);
    assert.equal(u.findBuff('chimes:sanctuary'), null); assert.equal(u.mem.chimesEnding, null);
  }
});

test('Wind Chimes original S2_End range3-2 reaches all three frontal tiles and excludes side/air targets', () => {
  const b = make(WIND, { skillId: 'skchr_chimes_2' }), u = deploy(b, WIND, 2, 5);
  const es = [enemy(b, 6), enemy(b, 7), enemy(b, 8)], side = enemy(b, 7, 3), air = enemy(b, 8);
  air.motion = 'FLY'; cast(u); const atk = u.s.atk; u.skill.end('manual'); advance(b, .6);
  for (const e of es) { near(100000 - e.hp, atk * u.skill.bb['attack@atk_scale']); assert.ok(e.findBuff('stun')); }
  near(side.hp, 100000); near(air.hp, 100000);
  assert.deepEqual(evidence.ranges['3-2'], [[0, 0], [0, 1], [0, 2], [0, 3]]);
  const components = evidence.characters[WIND].flatMap(r => r.components);
  assert.equal(components.find(c => c.pathId === '886899049012475937')._rangeId, '3-2');
});
