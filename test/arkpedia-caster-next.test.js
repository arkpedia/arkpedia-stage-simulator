// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-caster-next-prefabs.json' with { type: 'json' };
import { CASTERS_NEXT_OPERATORS } from '../shared/arkpedia/caster-next-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const ARO = 'char_446_aroma', IFR = 'char_134_ifrit', MOS = 'char_213_mostma', CEO = 'char_2013_cerber';
const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const rows = section => section.flatMap(x => x.components);
const source = (section, path) => rows(section).find(x => String(x.pathId) === path);
const bb = (id, skill, rank = 10) => Object.fromEntries(data.operators[id].skills[skill].levels[rank - 1].blackboard.map(x => [x.key, x.value]));
function advance(b, seconds) {
  for (let n = 0; n < Math.round(seconds / b.dt); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, { skill = 0, elite = 2, rank = 10, potential = 1, others = [] } = {}) {
  const src = structuredClone(data), op = src.operators[id];
  assert.ok(op, `Reviewed snapshot required: ${id}`);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const build = (who, opts = {}) => {
    const phase = Math.min(elite, src.operators[who].phases.length - 1);
    return { ...defaultBuild(src.operators[who]), elite: phase,
      level: src.operators[who].phases[phase].maxLevel, potential, skillRank: phase === 2 ? rank : Math.min(rank, 7), ...opts };
  };
  const b = new StandardBattle(src, { operators: [build(id, { skillId: op.skills[skill].id }),
    ...others.map(who => build(who))] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const deploy = (who = id, row = 1, col = 4, dir = 'UP') => {
    b.addDp('arkpedia', 99); const u = b.deployOperator(who, row, col, dir);
    assert.ok(u, `${who} at ${row},${col}`); u.atkCd = 1000; return u;
  };
  return { b, deploy };
}
function enemy(b, { row = 2, col = 4, hp = 100000, def = 0, res = 0, fly = false, weight = 0 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 100000, def, res, massLevel: weight }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
function cast(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  assert.equal(u.skill.manual ? b.activateOperator(u.defId) : u.skill.activate('test'), true);
  u.atkCd = 1000;
}
function strike(b, u, target, seconds = 1) {
  const hp = target.hp; b.forceAttack(u, [target]); u.atkCd = 1000; advance(b, seconds); return hp - target.hp;
}

test('original caster evidence binds all eleven skills, explicit continuous cadence, direct selectors and Eyjafjalla refusal', () => {
  assert.equal(evidence.frameParity, false);
  for (const [id, config] of Object.entries(CASTERS_NEXT_OPERATORS)) {
    assert.match(evidence.source.bundles.find(x => x.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    for (const sid of config.skillIds) assert.ok(evidence.skills[data.operators[id].skills.find(x => x.id === sid).levels[0].prefabId].length);
    for (const facing of ['Front', 'Back']) {
      assert.match(evidence.models[id][facing].sha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.models[id][facing].hits.Attack[0] > 0);
    }
  }
  const ifrit = source(evidence.skills.skchr_ifrit_3, '-5616444399643296383');
  assert.equal(ifrit._triggerDelta, 1); assert.equal(ifrit._waitForAttackEvent, 1);
  const mostima = source(evidence.skills.skchr_mostma_2, '1225678316375065974');
  assert.equal(mostima._triggerDelta, 1);
  assert.equal(source(evidence.characters[MOS], '-7010085154284211548').m_Radius, 1.100000023841858);
  assert.match(evidence.deferredOperators.char_180_amgoat.reason, /no attack event/);
  assert.equal(CASTERS_NEXT_OPERATORS.char_180_amgoat, undefined);
});
test('every source caster skill loads every rank and maintains complete selected-kit and elite talent identities', () => {
  for (const [id, config] of Object.entries(CASTERS_NEXT_OPERATORS)) for (let skill = 0; skill < config.skillIds.length; skill++) {
    for (let rank = 1; rank <= 10; rank++) {
      const { deploy } = make(id, { skill, rank }), u = deploy();
      assert.equal(u.skill.id, config.skillIds[skill]); assert.equal(u.skill.noSkill, false);
      assert.equal(u.def.talents.length, data.operators[id].talents.length);
    }
  }
});
test('Aroma ordinary attack uses original facing event and hits each current line victim once without adjacent splash', () => {
  for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) {
    const { b, deploy } = make(ARO, { elite: 0, rank: 4 }), u = deploy(ARO, 2, 4, dir);
    const dr = { UP: 1, DOWN: -1, RIGHT: 0, LEFT: 0 }[dir], dc = { UP: 0, DOWN: 0, RIGHT: 1, LEFT: -1 }[dir];
    const a = enemy(b, { row: 2 + dr, col: 4 + dc }), z = enemy(b, { row: 2 + 2 * dr, col: 4 + 2 * dc });
    const off = enemy(b, { row: a.y + dc, col: a.x + dr });
    b.forceAttack(u, [a]); u.atkCd = 1000; advance(b, .633); near(a.hp, 100000);
    advance(b, .1); near(100000 - a.hp, u.s.atk); near(100000 - z.hp, u.s.atk); near(off.hp, 100000);
    assert.equal(b.projectiles.list.length, 0);
  }
});
test('natural blast-caster AI releases one line attack across many victims instead of duplicating it for every acquired target', () => {
  for (const [id, skill, charged] of [[ARO, 0, false], [ARO, 0, true], [IFR, 0, false], [IFR, 1, true]]) {
    const { b, deploy } = make(id, { skill }), u = deploy(), a = enemy(b), z = enemy(b, { row: 3 });
    if (charged) u.skill.gainSp(u.skill.spCost, 'test');
    else u.skill.rule = 'NEVER';
    assert.equal(u.profile.rangeAoe, false); assert.equal(u.profile.allInRange, false);
    u.atkCd = 0; advance(b, id === IFR && charged ? 1.4 : .8);
    const s = bb(id, skill), scale = charged ? s.atk_scale : 1;
    const amount = u.s.atk * (id === ARO ? scale * 1.1 + (charged ? s.atk_scale_to_fly : 0) : scale);
    near(100000 - a.hp, amount); near(100000 - z.hp, amount); assert.equal(u.stats.attacks, 1);
  }
});
test('natural Mostima and Ceobe AI keep source primary selection separate from custom AoE and single-target projectile release', () => {
  for (const [id, skill] of [[MOS, 0], [MOS, 2], [CEO, 0], [CEO, 2]]) {
    const { b, deploy } = make(id, { skill }), u = deploy(), a = enemy(b), z = enemy(b, { col: 4.3 });
    if (skill === 2) { cast(b, u); advance(b, .7); }
    else u.skill.rule = 'NEVER';
    u.atkCd = 0; advance(b, id === CEO && skill === 2 ? 1.2 : 1);
    near(100000 - a.hp, u.s.atk); near(100000 - z.hp, id === MOS ? u.s.atk : 0); assert.equal(u.stats.attacks, 1);
  }
});
test('Aroma first output talent follows promotion/potential and levitates only once per deployment', () => {
  for (const [elite, potential, scale] of [[0, 1, 1], [1, 1, 1.05], [1, 5, 1.1], [2, 1, 1.1], [2, 5, 1.15]]) {
    const { b, deploy } = make(ARO, { elite, potential, rank: [4, 7, 10][elite] }), u = deploy(), e = enemy(b);
    near(strike(b, u, e, .767), u.s.atk * scale); assert.equal(Boolean(e.s.flags.levitate), elite > 0);
    near(strike(b, u, e, .767), u.s.atk); advance(b, 3); assert.equal(Boolean(e.s.flags.levitate), false);
    near(strike(b, u, e, .767), u.s.atk); assert.equal(Boolean(e.s.flags.levitate), false);
    b.retreat(u); assert.equal(e.findBuff(`aroma:first:${u.id}`), null);
    b.bench[ARO].readyAt = 0; const next = deploy(); near(strike(b, next, e, .767), next.s.atk * scale);
  }
});
test('Aroma S1 applies one charged line strike then the original .1s aerial follow-up after first-hit levitation', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(ARO, { rank }), u = deploy(), ground = enemy(b), air = enemy(b, { row: 3, fly: true }), s = bb(ARO, 0, rank);
    cast(b, u); b.forceAttack(u, [ground]); u.atkCd = 1000; advance(b, .567);
    near(100000 - ground.hp, u.s.atk * s.atk_scale * 1.1); near(100000 - air.hp, u.s.atk * s.atk_scale * 1.1);
    advance(b, .1); near(100000 - ground.hp, u.s.atk * (s.atk_scale * 1.1 + s.atk_scale_to_fly));
    near(100000 - air.hp, u.s.atk * (s.atk_scale * 1.1 + s.atk_scale_to_fly));
  }
});
test('Aroma S1 immune ground targets receive no fabricated aerial hit and its released follow-up survives retreat', () => {
  const { b, deploy } = make(ARO), u = deploy(), e = enemy(b), immune = enemy(b, { row: 3 });
  immune.def = { ...immune.def, immune: new Set(['levitate']) }; cast(b, u);
  b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .567); const hp = e.hp, imhp = immune.hp, atk = u.s.atk;
  b.retreat(u); advance(b, .15); near(hp - e.hp, atk * .9); near(immune.hp, imhp);
  assert.equal(e.findBuff(`aroma:first:${u.id}`), null);
});
test('Aroma S2 owns landing marks, observes levitation from any source and triggers one in-range landing damage', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make(ARO, { skill: 1, rank }), u = deploy(), e = enemy(b), s = bb(ARO, 1, rank), atk = u.s.atk;
    cast(b, u); near(u.s.atk, atk * (1 + s.atk)); b.applyStatus(e, 'levitate', { duration: .5 }); advance(b, .15);
    assert.ok(e.findBuff(`aroma:landing:${u.id}`)); advance(b, .5);
    near(100000 - e.hp, u.s.atk * s['attack@atk_scale_when_fly_finish'] * 1.1);
    advance(b, .4); near(100000 - e.hp, u.s.atk * s['attack@atk_scale_when_fly_finish'] * 1.1);
  }
});
test('Aroma S2 detaches only its landing marker on target-free/range/skill loss, leaving unrelated levitation intact', () => {
  for (const boundary of ['hidden', 'range', 'end', 'retreat']) {
    const { b, deploy } = make(ARO, { skill: 1 }), u = deploy(), e = enemy(b);
    cast(b, u); b.applyStatus(e, 'levitate', { duration: 1 }); advance(b, .15);
    if (boundary === 'hidden') e.hidden = true;
    if (boundary === 'range') e.x = 7;
    if (boundary === 'end') u.skill.end('test');
    if (boundary === 'retreat') b.retreat(u);
    advance(b, .15); assert.equal(e.findBuff(`aroma:landing:${u.id}`), null); assert.ok(e.s.flags.levitate);
    advance(b, 1); near(e.hp, 100000);
  }
});
test('Ifrit ordinary direct line damage preserves .333 capped event with one hit per victim and same-frame RES refresh', () => {
  const { b, deploy } = make(IFR, { elite: 0, rank: 4 }), u = deploy(), a = enemy(b, { res: 80 }), z = enemy(b, { row: 3, fly: true, res: 80 });
  b.addBuff(u, { key: 'test:ASPD', mods: { aspd: 100 } });
  b.forceAttack(u, [a]); u.atkCd = 1000; advance(b, .3); near(a.hp, 100000); advance(b, .067);
  near(100000 - a.hp, u.s.atk * (1 - .8 * .85)); near(100000 - z.hp, u.s.atk * (1 - .8 * .85));
  assert.equal(b.projectiles.list.length, 0);
});
test('Ifrit RES aura keeps source promotion/potential, composes flat then percentage/final buckets and removes its own effect', () => {
  for (const [elite, potential, reduction] of [[0, 1, .15], [0, 3, .19], [1, 1, .27], [1, 3, .31], [2, 1, .4], [2, 3, .44]]) {
    const { b, deploy } = make(IFR, { elite, potential, rank: [4, 7, 10][elite] }), u = deploy(), e = enemy(b, { res: 80 });
    b.addBuff(e, { key: 'test:RES', mods: { resFlat: -10, resPct: -.2, resMul: .5 } }); advance(b, .05);
    near(e.s.res, 70 * .8 * .5 * (1 - reduction)); e.hidden = true; advance(b, .05); near(e.s.res, 70 * .8 * .5);
    e.hidden = false; advance(b, .05); b.retreat(u); near(e.s.res, 70 * .8 * .5); assert.ok(e.findBuff('test:RES'));
  }
});
test('Ifrit E2 periodic SP waits the selected interval, gives two ordinary points and respects no-SP', () => {
  for (const [potential, interval] of [[1, 6], [6, 5.5]]) {
    const { b, deploy } = make(IFR, { skill: 2, potential }), u = deploy(); near(u.skill.sp, 0);
    advance(b, interval - .1); near(u.skill.sp, interval - .1); advance(b, .133); near(u.skill.sp, interval + 2 + b.dt);
    cast(b, u); advance(b, interval); near(u.skill.sp, 0);
    b.retreat(u); b.bench[IFR].readyAt = 0; const next = deploy(); near(next.skill.sp, 0); advance(b, .1); near(next.skill.sp, .1);
  }
});
test('Ifrit periodic talent attaches its full wait to delayed deployment and starts a new wait after retreat', () => {
  const { b, deploy } = make(IFR, { skill: 2 }); advance(b, 3.3); const u = deploy();
  const grants = []; b.on('spGain', ({ unit, reason, amount }) => { if (reason === 'ifrit:talent') grants.push([unit.id, amount, b.time]); });
  advance(b, 5.9); assert.deepEqual(grants, []); near(u.skill.sp, 5.9); advance(b, .15);
  assert.equal(grants.length, 1); near(grants[0][2] - 3.3, 6);
  b.retreat(u); advance(b, 1.3); b.bench[IFR].readyAt = 0; const next = deploy(), at = b.time;
  advance(b, 5.9); assert.equal(grants.length, 1); near(next.skill.sp, 5.9); advance(b, .15);
  assert.equal(grants.length, 2); assert.equal(grants[1][0], next.id); near(grants[1][2] - at, 6);
});
test('original NORMAL caster extra and continuous outputs retain attack origin while Immolation remains buff damage', () => {
  for (const [id, skill, tags, origin] of [[ARO, 0, 'aroma:aerial', true], [ARO, 1, 'aroma:landing', true],
    [IFR, 1, 'ifrit:burn', false], [IFR, 2, null, true], [MOS, 1, null, true], [CEO, 0, 'cerber:talent', true]]) {
    const { b, deploy } = make(id, { skill }), u = deploy(), e = enemy(b, { def: 400 }); const outputs = [];
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target === e && (tags ? dmg.tags.includes(tags) : true)) outputs.push(dmg);
    });
    if (id === ARO && skill === 1) { cast(b, u); b.applyStatus(e, 'levitate', { duration: .5 }); advance(b, .8); }
    else if (id === IFR && skill === 2 || id === MOS) { cast(b, u); advance(b, .8); }
    else { cast(b, u); strike(b, u, e, id === IFR ? 2.5 : 1.2); }
    assert.ok(outputs.length > 0, `${id} ${tags}`); for (const output of outputs) assert.equal(output.isAttack, origin);
  }
});
test('one continuous source pulse shares a real attack identity across victims and emits exactly one attack lifecycle event', () => {
  for (const [id, skill] of [[IFR, 2], [MOS, 1]]) {
    const { b, deploy } = make(id, { skill }), u = deploy(), a = enemy(b), z = enemy(b, { row: 3 });
    const damage = [], attacks = [];
    b.on('damaged', ({ source, target, dmg }) => { if (source === u && [a, z].includes(target)) damage.push(dmg.attackId); });
    b.on('attack', ctx => { if (ctx.attacker === u) attacks.push(ctx.targets); });
    cast(b, u); advance(b, .8); assert.equal(damage.length, 2); assert.ok(damage[0] > 0); assert.equal(damage[0], damage[1]);
    assert.equal(attacks.length, 1); assert.equal(u.stats.attacks, 1); assert.deepEqual(attacks[0], [a, z]);
    advance(b, 1); assert.equal(damage.length, 4); assert.ok(damage[2] > damage[0]); assert.equal(damage[2], damage[3]); assert.equal(attacks.length, 2);
    u.skill.end('test'); advance(b, 2); assert.equal(attacks.length, 2);
  }
});
test('Ifrit S1 selected ATK and ASPD modify cadence but never invent a faster-than-source capped windup', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(IFR, { rank }), u = deploy(), atk = u.s.atk, e = enemy(b), s = bb(IFR, 0, rank);
    cast(b, u); near(u.s.atk, atk * (1 + s.atk)); near(u.s.aspd, 100 + s.attack_speed);
    b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .3); near(e.hp, 100000); advance(b, .067); near(100000 - e.hp, u.s.atk);
    u.skill.end('test'); near(u.s.atk, atk); near(u.s.aspd, 100);
  }
});
test('Ifrit S2 waits original explicit1.25, burns each line victim three times and keeps independent DEF reduction after retreat', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make(IFR, { skill: 1, rank }), u = deploy(), e = enemy(b, { def: 500 }), air = enemy(b, { row: 3, fly: true }), s = bb(IFR, 1, rank);
    cast(b, u); b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, 1.2); near(e.hp, 100000);
    advance(b, .1); near(100000 - e.hp, u.s.atk * s.atk_scale); near(100000 - air.hp, u.s.atk * s.atk_scale);
    near(e.s.def, Math.max(0, 500 + s.def)); const hp = e.hp, atk = u.s.atk; b.retreat(u);
    advance(b, 3.1); near(hp - e.hp, atk * s['burn.atk_scale'] * 3); near(e.s.def, 500);
    const after = e.hp; advance(b, 1); near(e.hp, after);
  }
});
test('Ifrit S3 original facing begin events lead fixed1s ground-only damage and own target-independent MaxHP loss', () => {
  for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) {
    const { b, deploy } = make(IFR, { skill: 2 }), u = deploy(IFR, 2, 4, dir);
    const dr = { UP: 1, DOWN: -1, RIGHT: 0, LEFT: 0 }[dir], dc = { UP: 0, DOWN: 0, RIGHT: 1, LEFT: -1 }[dir];
    const e = enemy(b, { row: 2 + dr, col: 4 + dc, res: 80 }), air = enemy(b, { row: 2 + 2 * dr, col: 4 + 2 * dc, fly: true });
    const hits = []; b.on('damaged', ({ target }) => { if (target === e) hits.push(b.time); }); const hp = u.hp;
    cast(b, u); advance(b, dir === 'RIGHT' ? .367 : .3); near(e.hp, 100000); advance(b, .067);
    const res = (80 - 20) * .6; near(100000 - e.hp, u.s.atk * 1.4 * (1 - res / 100)); near(air.hp, 100000);
    advance(b, 2); assert.equal(hits.length, 3); near(hits[1] - hits[0], 1); near(hits[2] - hits[1], 1);
    near(hp - u.hp, u.s.maxHp * .02 * 2); e.hidden = true; advance(b, 1); near(hp - u.hp, u.s.maxHp * .02 * 3);
    u.skill.end('test'); const ownhp = u.hp; advance(b, 1.1); near(u.hp, ownhp); near(e.s.res, 80);
  }
});
test('Ifrit S3 selected all-rank debuffs are applied before Arts mitigation and levitated ground enemies are excluded', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(IFR, { skill: 2, rank }), u = deploy(), e = enemy(b, { res: 80 }), lev = enemy(b, { row: 3 });
    b.applyStatus(lev, 'levitate', { duration: 2 }); cast(b, u); advance(b, .4);
    const s = bb(IFR, 2, rank); near(100000 - e.hp, u.s.atk * s.atk_scale * (1 - (80 + s.magic_resistance) * .6 / 100)); near(lev.hp, 100000);
  }
});
test('continuous source casts remember brief startup control and never accumulate hits during later control', () => {
  for (const [id, skill, first] of [[IFR, 2, .333], [MOS, 1, .567]]) {
    const { b, deploy } = make(id, { skill }), u = deploy(), e = enemy(b); cast(b, u);
    advance(b, .1); b.applyStatus(u, 'stun', { duration: .1 }); advance(b, first + 1.2); near(e.hp, 100000); assert.equal(u.canAct, true);
    u.skill.end('test'); advance(b, .6); cast(b, u); advance(b, first + .05); const hp = e.hp;
    b.applyStatus(u, 'stun', { duration: 2.2 }); advance(b, 2.3); near(e.hp, hp); advance(b, .8);
    assert.ok(e.hp < hp); const after = e.hp; advance(b, .1); near(e.hp, after);
  }
});
test('Mostima direct normal AoE uses source radius1.1 at .7 and neither duplicates victims nor adds projectile travel', () => {
  const { b, deploy } = make(MOS, { elite: 0, rank: 4 }), u = deploy(), e = enemy(b), nearEnemy = enemy(b, { col: 4.8 }), far = enemy(b, { col: 5.2 });
  b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .667); near(e.hp, 100000); advance(b, .067);
  near(100000 - e.hp, u.s.atk); near(100000 - nearEnemy.hp, u.s.atk); near(far.hp, 100000); assert.equal(b.projectiles.list.length, 0);
});
test('Mostima named caster SP recovery joins Ptilopsis highest-source channel and leaves other professions on Ptilopsis', () => {
  for (const [elite, rate] of [[1, .2], [2, .4]]) {
    const { b, deploy } = make(MOS, { elite, rank: elite === 1 ? 7 : 10, others: [CEO, 'char_128_plosis', 'char_123_fang'] });
    const u = deploy(), caster = deploy(CEO, 2, 4), medic = deploy('char_128_plosis', 1, 3), vang = deploy('char_123_fang', 3, 4);
    for (const a of [u, caster, medic, vang]) a.skill.sp = 0;
    advance(b, 1); near(caster.skill.sp, 1 + Math.max(rate, elite === 1 ? .15 : .3));
    near(vang.skill.sp, 1 + (elite === 1 ? .15 : .3)); b.retreat(u); const sp = caster.skill.sp;
    advance(b, 1); near(caster.skill.sp - sp, 1 + (elite === 1 ? .15 : .3));
  }
});
test('Mostima move-speed talent is an owned final scaler with potential and dynamic S3 amplification, separate from Sluggish', () => {
  for (const [potential, slow] of [[1, .15], [5, .18]]) {
    const { b, deploy } = make(MOS, { skill: 2, potential }), u = deploy(), e = enemy(b); advance(b, .05);
    near(e.s.moveSpeed, e.base.moveSpeed * (1 - slow)); e.hidden = true; advance(b, .05); near(e.s.moveSpeed, e.base.moveSpeed * (1 - slow));
    b.applyStatus(e, 'sluggish', { duration: 10 }); cast(b, u); near(e.s.moveSpeed, e.base.moveSpeed * (1 - slow * 3) * .2);
    u.skill.end('test'); advance(b, .05); near(e.s.moveSpeed, e.base.moveSpeed * (1 - slow) * .2);
    b.retreat(u); near(e.s.moveSpeed, e.base.moveSpeed * .2); assert.ok(e.findBuff('sluggish'));
  }
});
test('Mostima S1 all selected ranks use source ATK addition and ordinary direct area attack', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(MOS, { rank }), u = deploy(), e = enemy(b), atk = u.s.atk;
    cast(b, u); near(u.s.atk, atk * (1 + bb(MOS, 0, rank).atk)); near(strike(b, u, e, .75), u.s.atk);
  }
});
test('Mostima S2 stuns every legal ground/air range victim with original first event and fixed1s damage, then cleans timers', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make(MOS, { skill: 1, rank }), u = deploy(), e = enemy(b), air = enemy(b, { row: 3, fly: true }), out = enemy(b, { col: 7 });
    const times = []; b.on('damaged', ({ target }) => { if (target === e) times.push(b.time); }); cast(b, u);
    advance(b, .533); near(e.hp, 100000); advance(b, .1); assert.ok(e.s.flags.stun && air.s.flags.stun);
    const damage = u.s.atk * bb(MOS, 1, rank).atk_scale; near(100000 - e.hp, damage); near(100000 - air.hp, damage); near(out.hp, 100000);
    advance(b, 2); assert.equal(times.length, 3); near(times[1] - times[0], 1); near(times[2] - times[1], 1);
    u.skill.end('test'); const hp = e.hp; advance(b, 1.1); near(e.hp, hp); assert.equal(Boolean(e.s.flags.stun), false); assert.equal(Boolean(u.s.flags.disarm), false);
  }
});
test('Mostima S3 source expanded range attacks every current victim once and uses real relative displacement rather than splash', () => {
  const { b, deploy } = make(MOS, { skill: 2 }), u = deploy(), e = enemy(b, { col: 5 }), z = enemy(b, { row: 3, col: 5 }), outside = enemy(b, { col: 8 });
  const atk = u.s.atk, original = u.rangeKeys.slice(); cast(b, u); near(u.s.atk, atk * 2.7); assert.ok(u.rangeKeys.length > original.length);
  assert.ok(u.s.flags.disarm); advance(b, .7); const position = [e.x, e.y], other = [z.x, z.y];
  b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .767);
  near(100000 - e.hp, u.s.atk); near(100000 - z.hp, u.s.atk); near(outside.hp, 100000);
  assert.ok(Math.hypot(e.x - position[0], e.y - position[1]) > 0); assert.ok(Math.hypot(z.x - other[0], z.y - other[1]) > 0);
  assert.equal(b.projectiles.list.length, 0); u.skill.end('test'); assert.deepEqual(u.rangeKeys, original);
});
test('Ceobe DEF talent is a separate mitigated Arts hit at impact, with all source promotions/potential and no recursion', () => {
  for (const [elite, potential, scale] of [[0, 1, 0], [1, 1, .25], [1, 5, .29], [2, 1, .4], [2, 5, .44]]) {
    const { b, deploy } = make(CEO, { elite, potential, rank: [4, 7, 10][elite] }), u = deploy(), e = enemy(b, { def: 400, res: 50 });
    const hits = []; b.on('damaged', ({ target, dmg }) => { if (target === e) hits.push(dmg); });
    b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .733); near(e.hp, 100000); assert.equal(b.projectiles.list.length, 1);
    advance(b, .15); near(100000 - e.hp, u.s.atk * .5 + 400 * scale * .5); assert.equal(hits.length, elite ? 2 : 1);
  }
});
test('Ceobe DEF talent is current-target DEF and persists after a dodged main Arts shot, while flight rejects vanished targets', () => {
  const { b, deploy } = make(CEO), u = deploy(), e = enemy(b, { def: 400 });
  b.addBuff(e, { key: 'test:dodge', mods: { dodgeArts: 1 } }); let main = 0, talent = 0;
  b.on('hit', ({ dmg }) => { if (dmg.tags.includes('cerber:talent')) { talent++; dmg.canDodge = false; } else main++; });
  b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .733); e.base.def = 800; e.markDirty(); advance(b, .15);
  near(100000 - e.hp, 800 * .4); assert.equal(main, 1); assert.equal(talent, 1);
  e.hidden = true; b.forceAttack(u, [e]); u.atkCd = 1000; const hp = e.hp; advance(b, 1); near(e.hp, hp);
});
test('Ceobe E2 alone talent observes orthogonal live allies and restores its source ATK/ASPD after retreat', () => {
  const { b, deploy } = make(CEO, { others: ['char_123_fang', 'char_124_kroos'] }), u = deploy();
  near(u.s.atk, u.base.atk * 1.08); near(u.s.aspd, 108); const diagonal = deploy('char_123_fang', 2, 5);
  near(u.s.atk, u.base.atk * 1.08); const next = deploy('char_124_kroos', 1, 5);
  near(u.s.atk, u.base.atk); near(u.s.aspd, 100); b.retreat(next); near(u.s.atk, u.base.atk * 1.08); near(u.s.aspd, 108);
  assert.ok(diagonal.alive);
});
test('Ceobe S1 source unblocked-first charge selector binds only the selected projectile target at every rank', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(CEO, { rank, others: ['char_123_fang'] }), u = deploy(), blocker = deploy('char_123_fang', 3, 4);
    const blocked = enemy(b, { row: 3 }), free = enemy(b, { col: 4.3 }); blocked.blockedBy = blocker; blocker.blocking.push(blocked); cast(b, u);
    assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], free); b.forceAttack(u, [free]); u.atkCd = 1000; advance(b, 1.15);
    near(100000 - free.hp, u.s.atk * bb(CEO, 0, rank).atk_scale); assert.ok(free.s.flags.bind); assert.equal(Boolean(blocked.s.flags.bind), false);
    near(free.findBuff('bind').duration, bb(CEO, 0, rank).duration);
  }
});
test('Ceobe S2 source BAT final scaler composes with separate flat/pct buckets, targets highest DEF and speed12 flight', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make(CEO, { skill: 1, rank }), u = deploy(), low = enemy(b, { def: 100 }), high = enemy(b, { col: 4.3, def: 1000 });
    b.addBuff(u, { key: 'test:BAT', mods: { batFlat: .2, batPct: .3, batMul: .8 } }); cast(b, u); advance(b, .4);
    near(u.s.bat, (u.base.bat + .2) * 1.3 * .8 * bb(CEO, 1, rank).base_attack_time); assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], high);
    b.forceAttack(u, [high]); u.atkCd = 1000; advance(b, .267); near(high.hp, 100000); assert.equal(b.projectiles.list.at(-1).speed, 12);
    advance(b, .15); near(100000 - high.hp, u.s.atk + 1000 * .4); near(low.hp, 100000);
    u.skill.end('test'); near(u.s.bat, (u.base.bat + .2) * 1.3 * .8);
  }
});
test('Ceobe S3 changes only its main attack to Physical, expands range, prioritizes low DEF and keeps separate Arts talent plus silence', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make(CEO, { skill: 2, rank }), u = deploy(), low = enemy(b, { def: 100, res: 50 }), high = enemy(b, { col: 4.3, def: 500 });
    const original = u.rangeKeys.slice(), atk = u.s.atk; cast(b, u); const s = bb(CEO, 2, rank);
    near(u.s.atk, u.base.atk * (1.08 + s.atk)); assert.ok(u.rangeKeys.length > original.length); assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], low);
    near(strike(b, u, low, 1.15), u.s.atk - 100 + 100 * .4 * .5); assert.ok(low.s.flags.silence); near(high.hp, 100000);
    near(low.findBuff('silence').duration, s['attack@silence']); u.skill.end('test'); assert.deepEqual(u.rangeKeys, original); near(u.s.atk, atk);
  }
});
