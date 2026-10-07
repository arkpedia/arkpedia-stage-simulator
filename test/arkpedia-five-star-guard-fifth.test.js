// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-fifth-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_FIFTH_OPERATORS } from '../shared/arkpedia/five-star-guard-fifth-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const CROW = 'char_421_crow', HIGH = 'char_4066_highmo', TEQ = 'char_486_takila';
const ODD = 'char_4131_odda', GRACE = 'char_4187_graceb';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(id, options = {}, tags = []) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = []; src.stage.mapTags = tags;
  const b = new StandardBattle(src, { operators: [{ ...defaultBuild(src.operators[id]), ...options }] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99); return b;
}
function deploy(b, id, r = 2, c = 7) { b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, 'RIGHT'); u.atkCd = 1000; return u; }
function enemy(b, x = 8, y = 2) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = e.base.res = e.base.moveSpeed = 0; e.markDirty();
  e.s; e.hp = 100000;
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function cast(u, charges = 1, partial = 0) { u.skill.setSpTotal(u.skill.spCost * charges + partial); assert.equal(u.skill.activate('test'), true); }
function strike(b, u, targets, seconds = 1) {
  const es = Array.isArray(targets) ? targets : [targets], hp = es.map(e => e.hp);
  u.atkCd = 1000; b.forceAttack(u, es); advance(b, seconds); u.atkCd = 1000; return hp.map((h, i) => h - es[i].hp);
}
const components = rows => rows.flatMap(r => r.components);

test('fifth guard evidence retains ten exact abilities, original timings, heal cadence and elemental conversion', () => {
  assert.equal(evidence.sourceVersion, '26-09-23-17-49-43_b9cc4a');
  for (const [id, config] of Object.entries(FIVE_STAR_GUARD_FIFTH_OPERATORS)) {
    assert.match(evidence.sourceBundles.find(x => x.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.equal(data.operators[id].skills.length, 2);
    for (const sid of config.skillIds) assert.ok(evidence.skills[sid]?.length);
    for (const face of ['Front', 'Back']) assert.match(evidence.originalModels[id][face].sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(evidence.originalModels[GRACE].Front.hits.Skill_1_Loop, [.667, 1.1]);
  assert.equal(components(evidence.skills.skchr_crow_1).find(c => c._additionalTimes === 1)._triggerDelta, .10000000149011612);
  const crowBat = components(evidence.skills.skchr_crow_2).flatMap(c => c._buffs ?? [])
    .find(c => c.buffKey === 'crow_s_2').attributes.attributeModifiers.find(m => m.attributeType === 8);
  assert.equal(crowBat.formulaItem, 3); // Original final scaler, not additive BAT seconds.
  assert.equal(crowBat.loadFromBlackboard, 1);
  const highmoreDeath = components(evidence.skills.skchr_highmo_2)
    .find(c => c.pathId === '-9033946886620419481')._targetOptions;
  assert.equal(highmoreDeath.targetMotion, 3);
  assert.equal(highmoreDeath.ignoreTargetFree, 1);
  const heal = evidence.buffTemplates['crow_trait[heal fake]'].eventToActions.ON_BUFF_TRIGGER[0]._buff;
  near(heal.triggerInterval, .12); assert.equal(heal.waitFirstTriggerInterval, false);
  const conversion = evidence.buffTemplates.graceb_sk2.eventToActions.ON_OUTPUT_DAMAGE.at(-1);
  assert.equal(conversion._damageType, 'ELEMENT'); assert.equal(conversion._ignoreForSp, false);
});

test('both skills keep all ten source ranks, unlocks, durations and real specs', () => {
  for (const [id, cfg] of Object.entries(FIVE_STAR_GUARD_FIFTH_OPERATORS)) for (const sid of cfg.skillIds)
    for (let rank = 1; rank <= 10; rank++) {
      const b = make(id, { skillId: sid, skillRank: rank }), u = deploy(b, id);
      assert.equal(u.skill.id, sid); near(u.skill.spCost, u.def.skill.spCost); assert.equal(u.skill.noSkill, false);
      if (u.def.skill.duration > 0) near(u.skill.duration, u.def.skill.duration);
      if (sid === 'skchr_graceb_2' || sid === 'skchr_takila_2') assert.equal(u.skill.maxCharges, u.def.skill.maxCharges);
    }
});

test('Reapers select all eligible ground targets but heal up to actual block with .12 queue cadence', () => {
  for (const id of [CROW, HIGH]) {
    const b = make(id), u = deploy(b, id), es = [enemy(b, 8, 2), enemy(b, 8, 2.2), enemy(b, 7, 2.2)];
    const fly = enemy(b, 8, 2); fly.motion = 'FLY'; const hidden = enemy(b, 8, 2); hidden.hidden = true;
    assert.deepEqual(new Set(acquireTargets(b, u, u.profile)), new Set(es));
    u.hp -= 500; const hp = u.hp; b.forceAttack(u, es); advance(b, .57);
    near(u.hp, hp + 50); for (const e of es) near(100000 - e.hp, u.s.atk); near(fly.hp, 100000);
    advance(b, .13); near(u.hp, hp + 100); advance(b, .3); near(u.hp, hp + 100);
    assert.equal(b.heal(es[0], u, 100), 0); assert.ok(b.heal(u, u, 100, { self: true }) > 0);
  }
});

test('Reaper hit cap follows zero/extra block and fully dodged hits never enqueue', () => {
  for (const [block, count] of [[0, 0], [1, 1], [3, 3]]) {
    const b = make(CROW), u = deploy(b, CROW), es = [enemy(b), enemy(b, 8, 2.1), enemy(b, 8, 2.2)];
    b.addBuff(u, { key: 'test:block', mods: { blockCnt: block - u.s.blockCnt } }); u.hp -= 500; const hp = u.hp;
    strike(b, u, es); near(u.hp, hp + count * 50);
  }
  const b = make(CROW), u = deploy(b, CROW), e = enemy(b); u.hp -= 100;
  b.addBuff(e, { key: 'test:dodge', mods: { dodgePhys: 1 } }); const hp = u.hp;
  strike(b, u, e); near(u.hp, hp); near(e.hp, 100000);
});

test('Reaper original self-healing explicitly ignores HealFree while ordinary allied heals remain refused', () => {
  for (const id of [CROW, HIGH]) {
    const b = make(id), u = deploy(b, id), e = enemy(b); u.hp -= 200; const hp = u.hp;
    b.addBuff(u, { key: 'test:heal-free', flags: { healFree: true } });
    assert.equal(b.heal(null, u, 100), 0); strike(b, u, e); near(u.hp, hp + 50);
  }
});

test('La Pluma S1 two full strikes preserve .1 gap and separate healing cap windows', () => {
  const b = make(CROW), u = deploy(b, CROW), es = [enemy(b), enemy(b, 8, 2.2)];
  for (const e of es) { e.base.def = 100; e.markDirty(); }
  u.hp -= 500; const hp = u.hp; cast(u); b.forceAttack(u, es); advance(b, .53);
  const hit = u.s.atk * u.skill.bb.atk_scale - 100;
  for (const e of es) near(100000 - e.hp, hit); assert.equal(u.skill.active, false);
  advance(b, .1); for (const e of es) near(100000 - e.hp, hit * 2);
  advance(b, .4); near(u.hp, hp + 200); near(u.skill.spTotal, 0);
});

test('La Pluma delayed S1 strike cancels on control or withdrawal without harming later lifetime', () => {
  for (const mode of ['stun', 'withdraw']) {
    const b = make(CROW), u = deploy(b, CROW), e = enemy(b); cast(u); b.forceAttack(u, [e]); advance(b, .53);
    const before = e.hp;
    if (mode === 'stun') b.applyStatus(u, 'stun', { source: e, duration: .2 }); else b.retreatOperator(CROW);
    advance(b, .3); near(e.hp, before);
    if (mode === 'withdraw') { assert.equal(u.mem.reaperHeal.queue, 0); assert.equal(u.mem.reaperHeal.timer, null); }
  }
});

test('La Pluma talent counts only own kills and applies exact promotion caps', () => {
  for (const [elite, max, per] of [[0, 8, 2], [1, 8, 3], [2, 12, 3]]) {
    const b = make(CROW, { elite, level: elite === 0 ? 50 : elite === 1 ? 70 : 80, skillRank: elite === 0 ? 4 : 7 });
    const u = deploy(b, CROW), base = u.base.aspd;
    b.kill(enemy(b), null); near(u.s.aspd, base);
    for (let i = 0; i < max + 2; i++) b.kill(enemy(b), u);
    near(u.s.aspd, base + max * per); assert.equal(u.mem.crowKills, max);
    b.retreatOperator(CROW); advance(b, 80); const next = deploy(b, CROW); near(next.s.aspd, next.base.aspd);
  }
});

test('La Pluma S2 low-HP bonus is strict per-victim additive ATK, applied before DEF without leaking', () => {
  const b = make(CROW, { skillId: 'skchr_crow_2' }), u = deploy(b, CROW);
  const low = enemy(b), exact = enemy(b, 8, 2.1), high = enemy(b, 8, 2.2);
  low.hp = 49000; exact.hp = 50000; high.hp = 51000;
  for (const e of [low, exact, high]) { e.base.def = 100; e.markDirty(); }
  b.addBuff(u, { key: 'test:atk', mods: { atkPct: .2, atkMul: 1.1 } }); cast(u); advance(b, .34);
  near(u.s.bat, u.base.bat * .5); const dealt = strike(b, u, [low, exact, high], .3);
  near(dealt[0], u.base.atk * (1 + .2 + .7 + .5) * 1.1 - 100);
  near(dealt[1], u.base.atk * (1 + .2 + .7) * 1.1 - 100); near(dealt[2], dealt[1]);
  assert.equal(u.findBuff('crow:execute'), null); near(u.s.atk, u.base.atk * 1.9 * 1.1);
  u.skill.end('duration'); advance(b, .34); near(u.s.bat, u.base.bat); assert.ok(u.findBuff('test:atk'));
});

test('Highmore S1 zero-gap pair does not double a shared block-capped heal window', () => {
  const b = make(HIGH), u = deploy(b, HIGH), es = [enemy(b), enemy(b, 8, 2.1)]; u.hp -= 500; const hp = u.hp;
  for (const e of es) { e.base.def = 100; e.markDirty(); }
  cast(u); const dealt = strike(b, u, es); for (const amount of dealt) near(amount, 2 * (u.s.atk * 1.65 - 100));
  near(u.hp, hp + 100); near(u.skill.spTotal, 0);
});

test('Highmore injury healing uses selected potential, every gauge and .12 cadence but respects burst locks', () => {
  for (const [elite, potential, per] of [[1, 1, 18], [1, 5, 23], [2, 1, 30], [2, 5, 35]]) {
    const b = make(HIGH, { elite, potential, level: elite === 1 ? 70 : 80, skillRank: 7 }), u = deploy(b, HIGH);
    for (const k in u.elem) u.elem[k] = 300;
    strike(b, u, [enemy(b), enemy(b, 8, 2.1)]);
    for (const k in u.elem) near(u.elem[k], 300 - per * 2);
    b.addBuff(u, { key: 'neuralBurst', flags: { burstLock: true } });
    const before = u.elem.erosion; strike(b, u, enemy(b)); near(u.elem.erosion, before);
  }
});

test('Highmore IS3 bonus requires exact certified rogue_mizuki tag and unlocked talent', () => {
  for (const [elite, tags, aspd, block] of [[2, [], 0, 0], [2, ['rogue_mizuki'], 25, 1], [1, ['rogue_mizuki'], 10, 1],
    [0, ['rogue_mizuki'], 0, 0], [2, ['IS3'], 0, 0]]) {
    const b = make(HIGH, { elite, level: elite === 0 ? 50 : elite === 1 ? 70 : 80, skillRank: elite === 0 ? 4 : 7 }, tags);
    const u = deploy(b, HIGH); near(u.s.aspd, u.base.aspd + aspd); near(u.s.blockCnt, u.base.blockCnt + block);
  }
});

test('Highmore S2 death aura ignores kill credit, motion and targetability but excludes hidden/far victims', () => {
  const b = make(HIGH, { skillId: 'skchr_highmo_2' }), u = deploy(b, HIGH); cast(u); advance(b, .34);
  u.hp = 100; const e = enemy(b); b.kill(e, null); near(u.hp, 100 + u.s.maxHp * .1);
  const hp = u.hp, fly = enemy(b), hidden = enemy(b), free = enemy(b), stealth = enemy(b), sleep = enemy(b), far = enemy(b, 2, 2);
  fly.motion = 'FLY'; hidden.hidden = true; b.addBuff(free, { key: 'test:free', flags: { untargetable: true } });
  b.addBuff(stealth, { key: 'test:stealth', flags: { stealth: true } });
  b.applyStatus(sleep, 'sleep', { duration: 10 });
  for (const e of [fly, free, stealth, sleep]) b.kill(e, null);
  near(u.hp, hp + u.s.maxHp * .4);
  for (const e of [hidden, far]) b.kill(e, null); near(u.hp, hp + u.s.maxHp * .4);
  near(u.s.dodgePhys, .6); near(u.s.dodgeArts, 0);
  const after = u.hp; u.skill.end('duration'); b.kill(enemy(b), null); near(u.hp, after); near(u.s.dodgePhys, 0);
});

test('Highmore original max animation scale1 caps windup while attack interval still benefits from ASPD', () => {
  const b = make(HIGH), u = deploy(b, HIGH), e = enemy(b); b.addBuff(u, { key: 'test:aspd', mods: { aspd: 100 } });
  near(u.s.interval, u.base.bat / 2); b.forceAttack(u, [e]); advance(b, .3); near(e.hp, 100000);
  advance(b, .3); assert.ok(e.hp < 100000);
});

test('Tequila idle has zero block including external bonuses, cannot attack and ramps once per second to200%', () => {
  const b = make(TEQ), u = deploy(b, TEQ), e = enemy(b); b.addBuff(u, { key: 'test:block', mods: { blockCnt: 5 } });
  u.atkCd = 0; advance(b, .9); near(e.hp, 100000); near(u.s.blockCnt, 0); near(u.s.atk, u.base.atk);
  advance(b, .2); near(u.s.atk, u.base.atk * 1.05); advance(b, 40); near(u.s.atk, u.base.atk * 3);
  assert.equal(u.mem.tequilaStacks, 40);
});

test('Tequila S1 keeps attained ramp without accumulating, restores block, uses source scale then resets at end', () => {
  const b = make(TEQ), u = deploy(b, TEQ); advance(b, 10.1); const ramp = u.s.atk;
  b.addBuff(u, { key: 'test:outside', mods: { atkPct: .2, blockCnt: 2 } }); cast(u); advance(b, .34);
  near(u.s.blockCnt, u.base.blockCnt + 2); near(u.s.aspd, u.base.aspd + 50);
  near(strike(b, u, enemy(b))[0], (ramp + u.base.atk * .2) * 1.7); assert.equal(u.mem.tequilaStacks, 10);
  u.skill.end('duration'); near(u.s.blockCnt, 0); near(u.s.atk, u.base.atk * 1.2); assert.ok(u.findBuff('test:outside'));
  advance(b, .34); near(u.s.aspd, u.base.aspd);
});

test('Tequila S2 one charge keeps15s/two targets and clears partial SP; full charge uses30s/three targets', () => {
  for (const [charges, partial, duration, cap] of [[1, 9, 15, 2], [2, 0, 30, 3]]) {
    const b = make(TEQ, { skillId: 'skchr_takila_2' }), u = deploy(b, TEQ); advance(b, 40.1);
    cast(u, charges, partial); near(u.skill.duration, duration); near(u.skill.spTotal, 0); advance(b, .34);
    const es = [enemy(b), enemy(b, 8, 2.1), enemy(b, 8, 2.2), enemy(b, 8, 2.3)];
    const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, cap);
    const amounts = strike(b, u, targets); for (const n of amounts) near(n, u.base.atk * 3 * 2.3);
    assert.equal(u.skill.spec.manualCancel, true); u.skill.end('manual'); near(u.s.blockCnt, 0); near(u.s.atk, u.base.atk);
    for (const e of es.filter(e => !targets.includes(e))) near(e.hp, 100000);
  }
});

test('Tequila charged duration does not leak into the next normal activation or later deployment', () => {
  const b = make(TEQ, { skillId: 'skchr_takila_2' }), u = deploy(b, TEQ); cast(u, 2); near(u.skill.duration, 30);
  u.skill.end('manual'); advance(b, .34); cast(u); near(u.skill.duration, 15);
  b.retreatOperator(TEQ); advance(b, 80); const next = deploy(b, TEQ); near(next.skill.duration, 15); near(next.s.blockCnt, 0);
});

test('Tequila retaliation is idle-only current-ATK Arts and handles shielded incoming hits', () => {
  for (const [elite, potential, scale] of [[1, 1, .1], [1, 5, .13], [2, 1, .2], [2, 5, .23]]) {
    const b = make(TEQ, { elite, potential, level: elite === 1 ? 70 : 80, skillRank: 7 }), u = deploy(b, TEQ), e = enemy(b);
    advance(b, 20); e.base.res = 20; e.markDirty(); b.addBuff(u, { key: 'test:shield', shield: 1000 });
    const hp = e.hp; near(b.dealDamage(e, u, { amount: 100, type: 'phys' }), 0); near(hp - e.hp, u.s.atk * scale * .8);
    cast(u); advance(b, .34); const before = e.hp; b.dealDamage(e, u, { amount: 100, type: 'arts' }); near(e.hp, before);
  }
});

test('Odda primary and independent splash use separate coefficients, ground selectors and source radii', () => {
  const b = make(ODD), u = deploy(b, ODD), main = enemy(b), close = enemy(b, 8, 2.9), outside = enemy(b, 8, 3.2), fly = enemy(b, 8, 2.5);
  main.base.tauntLevel = 100; main.markDirty();
  fly.motion = 'FLY'; for (const e of [main, close, outside]) { e.base.def = 100; e.markDirty(); }
  const dealt = strike(b, u, [main])[0]; near(dealt, u.s.atk - 100); near(100000 - close.hp, u.s.atk * .5 - 100);
  near(outside.hp, 100000); near(fly.hp, 100000);
  const mh = main.hp, ch = close.hp, oh = outside.hp; cast(u); strike(b, u, main);
  near(mh - main.hp, u.s.atk * 2.4 - 100); near(ch - close.hp, u.s.atk * .5 - 100); near(oh - outside.hp, u.s.atk * .5 - 100);
});

test('Odda output count advances separately for primary and splash and obeys promotion/potential thresholds', () => {
  for (const [elite, potential, count, pct] of [[1, 1, 45, .09], [1, 5, 45, .12], [2, 1, 30, .15], [2, 5, 30, .18]]) {
    const b = make(ODD, { elite, potential, level: elite === 1 ? 70 : 80, skillRank: 7 }), u = deploy(b, ODD);
    const main = enemy(b), splash = enemy(b, 8.3, 2);
    strike(b, u, main); assert.equal(u.mem.oddaOutputs, 2);
    for (let i = 2; i < count - 1; i++) b.dealDamage(u, main, { amount: 1, type: 'phys' });
    near(u.s.atk, u.base.atk); b.dealDamage(u, splash, { amount: 1, type: 'arts' }); near(u.s.atk, u.base.atk);
    b.dealDamage(u, main, { amount: 1, type: 'phys' }); near(u.s.atk, u.base.atk * (1 + pct));
  }
});

test('Odda S2 levitates only light splash victims; primary/heavy/air remain unchanged and control ends normally', () => {
  const b = make(ODD, { skillId: 'skchr_odda_2' }), u = deploy(b, ODD), main = enemy(b), light = enemy(b, 8.3, 2), heavy = enemy(b, 8.4, 2);
  main.base.tauntLevel = 100; main.markDirty();
  light.base.massLevel = 3; heavy.base.massLevel = 4; light.markDirty(); heavy.markDirty(); cast(u); advance(b, .24);
  near(u.s.atk, u.base.atk * 2); near(u.s.def, u.base.def * 2); strike(b, u, main, .75);
  assert.equal(main.findBuff('levitate'), null); assert.ok(light.findBuff('levitate')); assert.equal(heavy.findBuff('levitate'), null);
  advance(b, .51); assert.equal(light.findBuff('levitate'), null); u.skill.end('duration'); advance(b, .18);
  near(u.s.atk, u.base.atk); near(u.s.def, u.base.def);
});

test('Odda retargets source CAST selector at release when a target leaves and another enters', () => {
  const b = make(ODD), u = deploy(b, ODD), first = enemy(b), next = enemy(b, 2, 2); b.forceAttack(u, [first]); advance(b, .3);
  first.x = 2; next.x = 8; b._buildEnemyIndex(); advance(b, .45);
  near(first.hp, 100000); assert.ok(next.hp < 100000);
});

test('Gracebearer talent replaces selected ATK only for own kills during neural burst and resets per deployment', () => {
  for (const [elite, potential, initial, improved] of [[1, 1, .05, .1], [1, 5, .08, .13], [2, 1, .1, .15], [2, 5, .13, .18]]) {
    const b = make(GRACE, { elite, potential, level: elite === 1 ? 70 : 80, skillRank: 7 }), u = deploy(b, GRACE);
    near(u.s.atk, u.base.atk * (1 + initial)); b.kill(enemy(b), u); near(u.s.atk, u.base.atk * (1 + initial));
    const e = enemy(b); b.addBuff(e, { key: 'neuralBurst', flags: { burstLock: true } }); b.kill(e, null); near(u.s.atk, u.base.atk * (1 + initial));
    const victim = enemy(b); b.addBuff(victim, { key: 'neuralBurst', flags: { burstLock: true } }); b.kill(victim, u);
    near(u.s.atk, u.base.atk * (1 + improved));
  }
});

test('Gracebearer S1 uses two original hit events and actual mitigated HP damage for neural injury', () => {
  const b = make(GRACE), u = deploy(b, GRACE), e = enemy(b); e.base.def = 100; e.markDirty(); cast(u); advance(b, .21);
  const atk = u.s.atk, hp = e.hp; b.forceAttack(u, [e]); advance(b, .75); const hit = atk * 1.5 - 100;
  near(hp - e.hp, hit); near(e.elem.neural, hit * .1);
  advance(b, .5); near(hp - e.hp, hit * 2); near(e.elem.neural, hit * .2);
});

test('Gracebearer S1 does not derive injury from absorbed or dodged damage and loses delayed hit under control', () => {
  const b = make(GRACE), u = deploy(b, GRACE), e = enemy(b); cast(u); advance(b, .21);
  b.addBuff(e, { key: 'test:shield', shield: 100000 }); strike(b, u, e, 1.2); near(e.elem.neural, 0);
  b.removeBuff(e, 'test:shield'); b.addBuff(e, { key: 'test:dodge', mods: { dodgePhys: 1 } }); strike(b, u, e, 1.2); near(e.elem.neural, 0);
  b.removeBuff(e, 'test:dodge'); b.forceAttack(u, [e]); advance(b, .7); const before = e.hp;
  b.applyStatus(u, 'stun', { source: e, duration: .5 }); advance(b, .5); near(e.hp, before);
});

test('Gracebearer S2 allows empty cast, consumes charge and holds attack/SP through original clip', () => {
  const b = make(GRACE, { skillId: 'skchr_graceb_2' }), u = deploy(b, GRACE); cast(u, 2);
  near(u.skill.spTotal, u.skill.spCost); assert.equal(u.skill.active, false); assert.equal(u.skill.pending, false);
  assert.ok(u.findBuff('graceb:cast')); assert.equal(u.skill.activate('test'), false); advance(b, 1.3);
  near(u.skill.spTotal, u.skill.spCost); assert.ok(u.findBuff('graceb:cast')); advance(b, .2);
  assert.equal(u.findBuff('graceb:cast'), null); assert.equal(u.mem.regularFormVisual, null);
});

test('Gracebearer S2 snapshots at most six ground targets and triple hits convert only neural-burst victims', () => {
  const b = make(GRACE, { skillId: 'skchr_graceb_2' }), u = deploy(b, GRACE);
  const es = Array.from({ length: 7 }, (_, i) => enemy(b, 8, 2 + i * .01)), fly = enemy(b, 8, 2), far = enemy(b, 2, 2);
  fly.motion = 'FLY'; const armored = es[0], burst = es[1]; armored.base.def = 100; burst.base.def = 10000; burst.base.res = 100;
  armored.markDirty(); burst.markDirty(); b.addBuff(burst, { key: 'neuralBurst', flags: { burstLock: true } });
  b.addBuff(burst, { key: 'test:element-vuln', mods: { elementalTakenMul: 1.2 } });
  const amounts = [], atk = u.s.atk; b.on('damaged', c => { if (c.source === u) amounts.push(c); }); cast(u); advance(b, .14);
  for (const e of es) near(e.hp, 100000); advance(b, .1);
  near(100000 - armored.hp, 3 * (atk * 2.5 - 100)); near(100000 - burst.hp, 3 * atk * 2.5 * 1.2);
  assert.equal(amounts.length, 18); assert.equal(amounts.filter(c => c.target === burst).every(c => c.dmg.type === 'elemental'), true);
  near(es[6].hp, 100000); near(fly.hp, 100000); near(far.hp, 100000); near(burst.elem.neural, 0);
});

test('Gracebearer S2 targetless/control/withdrawal cancel safely without phantom damage or persistent locks', () => {
  for (const mode of ['stun', 'withdraw']) {
    const b = make(GRACE, { skillId: 'skchr_graceb_2' }), u = deploy(b, GRACE), e = enemy(b); cast(u); advance(b, .1);
    if (mode === 'stun') b.applyStatus(u, 'stun', { source: e, duration: .3 }); else b.retreatOperator(GRACE);
    advance(b, 1.5); near(e.hp, 100000); assert.equal(u.mem.graceCast, null); assert.equal(u.findBuff('graceb:cast'), null);
  }
});
test('La Pluma and Gracebearer delayed hits latch sub-frame control; completed receipts still heal', () => {
  for (const [id, firstAt] of [[CROW, .53], [GRACE, .75]]) {
    const b = make(id), u = deploy(b, id), e = enemy(b); u.hp -= 500; cast(u);
    if (id === GRACE) advance(b, .21); // Complete the source skill begin before issuing its attack.
    b.forceAttack(u, [e]); advance(b, firstAt);
    const hp = e.hp; assert.ok(hp < 100000); b.applyStatus(u, 'stun', { duration: .03 }); advance(b, .6);
    near(e.hp, hp); assert.equal(Boolean(u.s.flags.stun), false);
    if (id === CROW) assert.ok(u.hp > u.s.maxHp - 500);
  }
});
test('Gracebearer manual S2 sub-frame control cancels unfired output and removes cast/SP locks', () => {
  const b = make(GRACE, { skillId: 'skchr_graceb_2' }), u = deploy(b, GRACE), e = enemy(b); cast(u);
  b.applyStatus(u, 'stun', { duration: .03 }); advance(b, 1.5); near(e.hp, 100000);
  assert.equal(u.mem.graceCast, null); assert.equal(u.findBuff('graceb:cast'), null); assert.equal(Boolean(u.s.flags.noSp), false);
});
