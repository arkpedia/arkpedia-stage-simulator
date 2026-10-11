// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-third-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_THIRD_OPERATORS } from '../shared/arkpedia/five-star-guard-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const LAP = 'char_140_whitew', BIB = 'char_252_bibeak', AYER = 'char_294_ayer';
const WHIP = 'char_265_sophia', SWIRE = 'char_308_swire', BEAGLE = 'char_122_beagle', MELA = 'char_208_melan';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(id, options = {}, allies = []) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = [];
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
  const enemies = Array.isArray(targets) ? targets : [targets], before = enemies.map(e => e.hp);
  b.forceAttack(u, enemies); advance(b, seconds); u.atkCd = 1000; return before.map((hp, i) => hp - enemies[i].hp);
}
const components = rows => rows.flatMap(r => r.components);

test('third guard batch retains verified bundles, original projectile speeds, exact animation events and typed selectors', () => {
  assert.equal(evidence.sourceVersion, '26-09-23-17-49-43_b9cc4a');
  for (const id of Object.keys(FIVE_STAR_GUARD_THIRD_OPERATORS)) {
    assert.match(evidence.sourceBundles.find(v => v.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.equal(data.operators[id].skills.length, 2); assert.ok(evidence.characters[id].length);
  }
  assert.deepEqual(evidence.originalModels[BIB].hits.Attack, [.267, .433]);
  assert.equal(evidence.originalModels[BIB].hits.Skill[0], .333);
  assert.ok(components(evidence.skills.skchr_bibeak_2).some(c => c._waitForAttackEvent === 1 && Math.abs(c._preDelay - .533) < 1e-5));
  const projectileSpeed = key => components(evidence.projectiles.filter(r => r.object === key)).find(c => c._speed != null)?._speed;
  assert.equal(projectileSpeed('projectile_whitew_s2_logic'), 6); assert.equal(projectileSpeed('projectile_bibeak_logic'), 6);
  assert.equal(evidence.buffTemplates.bibeak_s_1_throw_knif.eventToActions.ON_ABILITY_CAST_ON_TARGET[0]._excludeTarget, true);
});

test('both skills resolve exact source SP, duration, charges and blackboards at every supported rank', () => {
  for (const [id, support] of Object.entries(FIVE_STAR_GUARD_THIRD_OPERATORS)) for (const skillId of support.skillIds)
    for (let rank = 1; rank <= 10; rank++) {
      const b = make(id, { skillId, skillRank: rank }), u = deploy(b, id);
      assert.equal(u.skill.id, skillId); near(u.skill.spCost, u.def.skill.spCost); assert.equal(u.skill.noSkill, false);
      if (id === BIB && skillId === 'skchr_bibeak_2') assert.equal(u.skill.maxCharges, 3);
      if (id === LAP && skillId === 'skchr_whitew_1') assert.equal(u.skill.kind, 'toggle');
      else near(u.skill.duration, u.def.skill.duration);
    }
});

test('Lappland normal and infinite S1 retain ranged penalty, melee full damage, physical dodge and automatic activation', () => {
  const b = make(LAP), u = deploy(b, LAP), ranged = enemy(b, 9), close = enemy(b, 8); ranged.base.def = close.base.def = 100; ranged.markDirty(); close.markDirty();
  near(strike(b, u, ranged)[0], u.s.atk * .8 - 100); near(strike(b, u, close)[0], u.s.atk - 100);
  u.skill.gainSp(u.skill.spCost, 'test'); advance(b, b.dt); assert.equal(u.skill.active, true);
  near(u.s.atk, u.base.atk * 1.7); near(u.s.dodgePhys, .4); near(strike(b, u, ranged)[0], u.s.atk * .8 - 100);
  b.rng = () => 0; near(b.dealDamage(close, u, { amount: 1000, type: 'phys', isAttack: true }), 0);
  assert.ok(b.dealDamage(close, u, { amount: 100, type: 'arts', isAttack: true }) > 0);
  advance(b, 70); assert.equal(u.skill.active, true); near(u.s.atk, u.base.atk * 1.7);
});

test('Lappland Silence uses promotion and potential source duration and applies to each eligible hit', () => {
  for (const [elite, potential, duration] of [[1, 1, 1], [1, 6, 2], [2, 1, 5], [2, 6, 6]]) {
    const b = make(LAP, { elite, level: elite === 1 ? 70 : 80, skillRank: 7, potential }), u = deploy(b, LAP), e = enemy(b);
    strike(b, u, e, .55); assert.ok(e.findBuff('silence')); assert.ok(e.findBuff('silence').timeLeft > duration - .1);
    u.atkCd = 1000; advance(b, duration + .1); assert.equal(e.findBuff('silence'), null);
  }
});

test('Lappland S2 caps two targets, removes ranged reduction and uses delayed speed6 Arts projectiles', () => {
  const b = make(LAP, { skillId: 'skchr_whitew_2' }), u = deploy(b, LAP), es = Array.from({ length: 3 }, () => enemy(b, 9));
  for (const e of es) { e.base.def = 9999; e.base.res = 25; e.markDirty(); }
  cast(u); near(u.s.atk, u.base.atk * 2.2); const chosen = acquireTargets(b, u, effectiveProfile(u)); assert.equal(chosen.length, 2);
  b.forceAttack(u, chosen); advance(b, .65); es.forEach(e => near(e.hp, 100000)); assert.equal(b.projectiles.list.length, 2);
  advance(b, .35); for (const e of chosen) { near(100000 - e.hp, u.s.atk * .75); assert.ok(e.findBuff('silence')); }
  near(es.find(e => !chosen.includes(e)).hp, 100000); u.atkCd = 1000; advance(b, 21); near(u.s.atk, u.base.atk);
  assert.equal(effectiveProfile(u).maxTargets, 1); assert.equal(effectiveProfile(u).dmgType, 'phys');
});

test('Bibeak normal strikes are two full independent physical damage events at separate original hit frames', () => {
  const b = make(BIB), u = deploy(b, BIB), e = enemy(b), hits = []; e.base.def = 100; e.markDirty();
  b.on('damaged', c => { if (c.source === u && c.target === e) hits.push([b.time, c.amount]); });
  b.forceAttack(u, [e]); advance(b, .35); assert.equal(hits.length, 1); advance(b, .2); assert.equal(hits.length, 2);
  hits.forEach(([, amount]) => near(amount, u.s.atk - 100)); assert.ok(hits[1][0] - hits[0][0] >= .433 - .267 - b.dt);
  near(u.skill.spTotal, 1);
});

test('Bibeak S1 boosts both physical hits and fires one excluding ground-only secondary Arts projectile', () => {
  const b = make(BIB), u = deploy(b, BIB), main = enemy(b), extra = enemy(b), fly = enemy(b); fly.motion = 'FLY';
  main.base.def = 100; main.markDirty(); extra.base.res = 25; extra.markDirty(); cast(u);
  b.forceAttack(u, [main]); advance(b, .35); near(100000 - main.hp, u.s.atk * 1.8 - 100); near(extra.hp, 100000);
  advance(b, .3); near(100000 - main.hp, 2 * (u.s.atk * 1.8 - 100)); near(100000 - extra.hp, u.s.atk * 1.8 * .75);
  near(fly.hp, 100000); assert.equal(u.skill.pending, false); near(u.skill.spTotal, 0);
});

test('Bibeak second strike stops after control interrupts the original multihit sequence', () => {
  const b = make(BIB), u = deploy(b, BIB), e = enemy(b); b.forceAttack(u, [e]); advance(b, .35);
  b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .3); near(100000 - e.hp, u.s.atk);
});

test('Bibeak S2 consumes one of three stored charges, preselects six extended-range targets and locks until full clip end', () => {
  const b = make(BIB, { skillId: 'skchr_bibeak_2' }), u = deploy(b, BIB), es = Array.from({ length: 7 }, () => enemy(b, 9));
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 0); u.skill.gainSp(100, 'test'); assert.equal(u.skill.charges, 3);
  assert.equal(u.skill.activate('test'), true); assert.equal(u.skill.charges, 2); assert.equal(u.skill.castEligible, false);
  near(u.skill.gainSp(1, 'attack'), 0); advance(b, .3); es.forEach(e => near(e.hp, 100000));
  advance(b, .1); const victims = es.filter(e => e.hp < 100000); assert.equal(victims.length, 6);
  victims.forEach(e => { near(100000 - e.hp, u.s.atk * 2); assert.ok(e.findBuff('stun')); });
  assert.equal(u.skill.activate('test'), false); advance(b, .45); assert.equal(u.skill.castEligible, true); assert.equal(u.s.flags.noSp, undefined);
  assert.equal(u.skill.charges, 2); assert.equal(u.skill.activate('test'), true); advance(b, .85); assert.equal(u.skill.charges, 1);
});

test('Bibeak S2 allows an empty cast and cancels the pending area strike when controlled', () => {
  const b = make(BIB, { skillId: 'skchr_bibeak_2' }), u = deploy(b, BIB); cast(u); advance(b, .85); assert.equal(u.skill.castEligible, true);
  const e = enemy(b, 9); cast(u); advance(b, .1); b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .4);
  near(e.hp, 100000); assert.equal(u.mem.bibeakCast, null); assert.equal(u.s.flags.noSp, undefined);
});
test('Bibeak short control cancels queued melee and manual cast, while an emitted Arts projectile remains', () => {
  const b = make(BIB), u = deploy(b, BIB), main = enemy(b), extra = enemy(b); cast(u);
  b.forceAttack(u, [main]); advance(b, .35); const first = main.hp; b.applyStatus(u, 'stun', { duration: .03 }); advance(b, .3);
  assert.equal(Boolean(u.s.flags.stun), false); near(main.hp, first); near(100000 - extra.hp, u.s.atk * 1.8);
  const c = make(BIB, { skillId: 'skchr_bibeak_2' }), a = deploy(c, BIB), e = enemy(c, 9); cast(a);
  c.applyStatus(a, 'stun', { duration: .03 }); advance(c, .85); near(e.hp, 100000); assert.equal(a.mem.bibeakCast, null); assert.equal(Boolean(a.s.flags.noSp), false);
});

test('Bibeak own-kill ASPD stacks cap at promotion/potential source count, exclude allies and reset on redeployment', () => {
  for (const [potential, cap] of [[1, 5], [6, 6]]) {
    const b = make(BIB, { potential }, [BEAGLE]), u = deploy(b, BIB), ally = deploy(b, BEAGLE, 2, 6);
    b.dealDamage(ally, enemy(b), { amount: 200000, type: 'true' }); near(u.s.aspd, u.base.aspd);
    for (let n = 1; n <= cap + 1; n++) { b.dealDamage(u, enemy(b), { amount: 200000, type: 'true' }); near(u.s.aspd, u.base.aspd + 6 * Math.min(n, cap)); }
    b.retreatOperator(BIB); advance(b, u.base.respawnTime + .1); const again = deploy(b, BIB); near(again.s.aspd, again.base.aspd);
  }
});

test('Ayerscarpe aura includes himself, respects source x4 range and removes only its owned buff at withdrawal', () => {
  const b = make(AYER, { potential: 6 }, [BEAGLE, MELA]), u = deploy(b, AYER), nearAlly = deploy(b, BEAGLE, 2, 6), far = deploy(b, MELA, 3, 5);
  advance(b, b.dt); near(u.s.aspd, u.base.aspd + 10); near(nearAlly.s.aspd, nearAlly.base.aspd + 10); near(far.s.aspd, far.base.aspd);
  b.addBuff(nearAlly, { key: 'outside:ASPD', mods: { aspd: 5 } }); b.retreatOperator(AYER);
  near(nearAlly.s.aspd, nearAlly.base.aspd + 5); assert.ok(nearAlly.findBuff('outside:ASPD'));
});

test('Ayerscarpe S1 uses a full-scaled Arts projectile even blocked, caps three targets and slows at impact', () => {
  const b = make(AYER), u = deploy(b, AYER), es = Array.from({ length: 4 }, () => enemy(b));
  es.forEach(e => { e.base.def = 9999; e.base.res = 25; e.markDirty(); }); cast(u);
  const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 3); b.forceAttack(u, targets);
  advance(b, .75); es.forEach(e => near(e.hp, 100000)); assert.ok(b.projectiles.list.length);
  advance(b, .15); targets.forEach(e => { near(100000 - e.hp, u.s.atk * 1.6 * .75); assert.ok(e.findBuff('sluggish')); });
  near(es.find(e => !targets.includes(e)).hp, 100000);
});

test('Ayerscarpe S2 begins with original form lock and separately damages eligible ally blockees at spell release', () => {
  const b = make(AYER, { skillId: 'skchr_ayer_2' }, [BEAGLE]), u = deploy(b, AYER), ally = deploy(b, BEAGLE, 2, 6);
  const main = enemy(b, 10), blocked = enemy(b, 6, 2), outside = enemy(b, 6, 4); blocked.blockedBy = ally; ally.blocking = [blocked];
  const hits = []; b.on('damaged', c => { if (c.source === u) hits.push([c.target, b.time, c.dmg.applyWay, c.amount]); });
  cast(u); assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Begin'); assert.equal(u.s.flags.disarm, true); advance(b, .85);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Idle'); assert.equal(u.s.flags.disarm, undefined);
  assert.ok(acquireTargets(b, u, effectiveProfile(u)).includes(main)); b.forceAttack(u, [main]); advance(b, .55);
  near(100000 - blocked.hp, u.s.atk * 1.7); near(main.hp, 100000); near(outside.hp, 100000);
  assert.equal(hits[0][2], 'melee'); advance(b, .35); near(100000 - main.hp, u.s.atk); assert.equal(hits[1][2], 'ranged');
  u.atkCd = 1000; u.skill.end('duration'); assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_End'); advance(b, .45);
  assert.equal(u.mem.regularFormVisual, null); assert.equal(u.s.flags.disarm, undefined);
});

test('Ayerscarpe supplementary skill hit is once per distinct blockee and excludes isolated/untargetable neighboring blockers', () => {
  const b = make(AYER, { skillId: 'skchr_ayer_2' }, [BEAGLE]), u = deploy(b, AYER), ally = deploy(b, BEAGLE, 2, 6), e = enemy(b, 6);
  e.blockedBy = ally; ally.blocking = [e, e]; cast(u); advance(b, .85); strike(b, u, enemy(b, 10)); near(100000 - e.hp, u.s.atk * 1.7);
  b.addBuff(ally, { key: 'isolated', flags: { isolated: true } }); const hp = e.hp; strike(b, u, enemy(b, 10)); near(e.hp, hp);
  b.removeBuff(ally, 'isolated'); b.addBuff(ally, { key: 'free', flags: { untargetable: true } }); strike(b, u, enemy(b, 10)); near(e.hp, hp);
});

test('Whislash promotion and potential aura follows live block3 and S1 halves source lower-block buffs globally', () => {
  for (const [elite, level, potential, aspd, def] of [[0, 50, 1, 2, .04], [1, 70, 1, 4, .08], [2, 80, 6, 8, .14]]) {
    const b = make(WHIP, { elite, level, potential, skillRank: 4 }, [BEAGLE, MELA]), u = deploy(b, WHIP), full = deploy(b, BEAGLE, 2, 6), less = deploy(b, MELA, 3, 5);
    advance(b, .15); near(full.s.aspd, full.base.aspd + aspd); near(full.s.def, full.base.def * (1.1 + def)); near(less.s.aspd, less.base.aspd);
    cast(u); const factor = u.skill.bb.talent_scale; near(full.s.aspd, full.base.aspd + aspd * factor); near(less.s.aspd, less.base.aspd + aspd * factor / 2);
    near(less.s.def, less.base.def * (1 + def * factor / 2)); b.addBuff(less, { key: 'outside:block', mods: { blockCnt: 2 } }); advance(b, .15);
    near(less.s.aspd, less.base.aspd + aspd * factor); u.skill.end('duration'); near(less.s.aspd, less.base.aspd + aspd);
  }
});

test('Whislash and Swire source ground-capable predicate includes dual-placement allies but excludes RANGED even with block3', () => {
  for (const id of [WHIP, SWIRE]) {
    const b = make(id, {}, ['char_277_sqrrel', 'char_002_amiya']), u = deploy(b, id), dual = deploy(b, 'char_277_sqrrel', 2, 6), ranged = deploy(b, 'char_002_amiya', 1, 7);
    b.addBuff(dual, { key: 'block', mods: { blockCnt: 1 } }); b.addBuff(ranged, { key: 'block', mods: { blockCnt: 3 } }); advance(b, .15);
    assert.ok(dual.findBuff(`guard:aura:${u.id}`)); assert.equal(ranged.findBuff(`guard:aura:${u.id}`), null);
  }
});

test('Whislash instructor trait boosts unblocked ATK before DEF and original begin plays only once per engagement', () => {
  const b = make(WHIP), u = deploy(b, WHIP), e = enemy(b); e.base.def = 100; e.markDirty(); const visuals = [];
  const ev = b._ev.bind(b); b._ev = x => { if (x[0] === 'atk' && x[1] === u.id) visuals.push(x[4]?.animation); ev(x); };
  u.trait.hadTarget = true; near(strike(b, u, e)[0], u.s.atk * 1.2 - 100); near(strike(b, u, e)[0], u.s.atk * 1.2 - 100);
  assert.equal(visuals[0].begin, 'Attack_Start'); assert.equal(visuals[1], 'Attack_Loop');
  e.blockedBy = u; u.blocking = [e]; near(strike(b, u, e)[0], u.s.atk - 100);
});

test('Whislash S2 waits its original begin, selects live block-capacity in extended range and restores form/aura', () => {
  const b = make(WHIP, { skillId: 'skchr_sophia_2' }, [BEAGLE]), u = deploy(b, WHIP), ally = deploy(b, BEAGLE, 2, 6), normal = [...u.rangeKeys];
  const es = Array.from({ length: 4 }, () => enemy(b, 10)); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 0);
  cast(u); near(u.s.blockCnt, 3); near(u.s.atk, u.base.atk * 1.6); near(ally.s.aspd, ally.base.aspd + 12); assert.equal(u.s.flags.disarm, true);
  advance(b, 1.05); assert.equal(u.mem.regularFormVisual.clip, 'Skill_Idle'); const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 3);
  strike(b, u, targets, .45); assert.equal(es.filter(e => e.hp < 100000).length, 3);
  b.addBuff(u, { key: 'outside:block', mods: { blockCnt: 1 } }); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 4);
  u.skill.end('duration'); assert.equal(u.mem.regularFormVisual.clip, 'Skill_End'); advance(b, .4);
  assert.equal(u.mem.regularFormVisual, null); near(u.s.atk, u.base.atk); near(u.s.blockCnt, 3); near(ally.s.aspd, ally.base.aspd + 6); assert.deepEqual(u.rangeKeys, normal);
});

test('Swire aura excludes herself and S1 expands only aura, doubles source bonus and cleans up at skill end/death', () => {
  const b = make(SWIRE, { potential: 6 }, [BEAGLE, MELA]), u = deploy(b, SWIRE), close = deploy(b, BEAGLE, 2, 6), far = deploy(b, MELA, 3, 5), range = [...u.rangeKeys];
  advance(b, b.dt); const baseline = far.s.atk; near(u.s.atk, u.base.atk); near(close.s.atk, close.base.atk * 1.12);
  cast(u); near(close.s.atk, close.base.atk * 1.24); near(far.s.atk, baseline + far.base.atk * .24); assert.deepEqual(u.rangeKeys, range);
  u.skill.end('duration'); near(far.s.atk, baseline); b.addBuff(close, { key: 'outside:ATK', mods: { atkPct: .2 } });
  b.kill(u); near(close.s.atk, close.base.atk * 1.2); assert.ok(close.findBuff('outside:ATK'));
});

test('Swire S2 uses attack SP, combines own ATK independently and triples eligible allied aura', () => {
  const b = make(SWIRE, { skillId: 'skchr_swire_2' }, [BEAGLE]), u = deploy(b, SWIRE), ally = deploy(b, BEAGLE, 2, 6);
  const initial = u.skill.spTotal; advance(b, 3); near(u.skill.spTotal, initial); strike(b, u, enemy(b)); near(u.skill.spTotal, initial + 1);
  cast(u); near(u.s.atk, u.base.atk * 1.8); near(ally.s.atk, ally.base.atk * 1.3); const sp = u.skill.spTotal;
  strike(b, u, enemy(b)); near(u.skill.spTotal, sp); u.skill.end('duration'); near(u.s.atk, u.base.atk); near(ally.s.atk, ally.base.atk * 1.1);
});

test('Whislash/Swire auras preserve friendly hidden-purpose flags but remove isolated targets and owned state on retreat', () => {
  for (const id of [WHIP, SWIRE]) {
    const b = make(id, {}, [BEAGLE]), u = deploy(b, id), ally = deploy(b, BEAGLE, 2, 6), key = `guard:aura:${u.id}`;
    b.addBuff(ally, { key: 'outside', flags: { stealth: true, healFree: true, untargetable: true } }); advance(b, .15); assert.ok(ally.findBuff(key));
    b.addBuff(ally, { key: 'isolated', flags: { isolated: true } }); advance(b, .15); assert.equal(ally.findBuff(key), null);
    b.removeBuff(ally, 'isolated'); advance(b, .15); assert.ok(ally.findBuff(key)); b.retreatOperator(id);
    assert.equal(ally.findBuff(key), null); assert.ok(ally.findBuff('outside'));
  }
});
