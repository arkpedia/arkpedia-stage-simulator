// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { SWIRE_ALTER_ID as ID } from '../server/sim/content/arkpedia-swire-alter-economy.js';
import { SWIRE_S3_CONTRACT as CONTRACT, prepareSwireS3 } from '../server/sim/content/arkpedia-swire-alter-s3.js';
const MARK = 'swire2_s_3[mark_to_enemy]';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function until(f, predicate, seconds = 10) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), `Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`);
}
function make({ skill = 3, rank = 10, elite = 2, dir = 'RIGHT', defer = false,
  battle = null, col = 5, contract = CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = e.tables.character, phase = c.phases[elite], skillId = `skchr_swire2_${skill}`;
  const build = { elite, level: phase.maxLevel, potential: 1, skillId,
    skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = e.tables.skills[skillId].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: e.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId,
      rangeGrid: e.tables.ranges[level.rangeId].grids.map(g => [g.row, g.col]), trigger: { rule: 'NEVER' } },
    arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, col, { dir });
  const prepared = prepareSwireS3(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => { assert.equal(b._deploy(u, { initial: false }), true); b.getPlayer('arkpedia').dp = 99; };
  if (!defer) deploy();
  // Use the real regular-stage manual-cancel path, without enabling a roster entry.
  b.bench[ID] = { unit: u };
  const hits = [], attacks = [], doubles = [], births = [], goldHits = [], endings = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  for (const [name, list] of [['swireDoubleHit', doubles], ['swireGoldBirth', births],
    ['swireGoldHit', goldHits], ['swireEnding', endings]])
    b.on(name, ctx => { if (ctx.owner === u) list.push({ ...ctx, time: b.time }); });
  return { b, u, build, deploy, hits, attacks, doubles, births, goldHits, endings, ...prepared };
}
function enemy(f, { row = 5, col = 6, fly = false, def = 0, hp = 1e7, mass = 0, taunt = 0 } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 500, def, res: 0, moveSpeed: 0, massLevel: mass, tauntLevel: taunt });
  t.markDirty(); t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return t;
}
function active(f) { until(f, () => f.u.skill.active && f.controller.phase?.kind !== 'begin'); }
function end(f, coins = 1) {
  active(f); f.controller.wallet.upkeep.cancel(); f.controller.wallet.coins = coins;
  assert.equal(f.b.activateOperator(ID), true); return f.endings.at(-1).time;
}
const marked = t => t.buffs.some(b => b.key === MARK);

test('S3 preparation still requires complete selected source builds before installing hooks', () => {
  assert.ok(REGULAR_OPERATORS[ID]); assert.ok(data.operators[ID]);
  assert.deepEqual(e.enabledOperators, [ID]); assert.equal(e.runtimeMapping[ID], 'swire-alter'); assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ skill: 1 }), /Incomplete/); assert.throws(() => make({ elite: 1 }), /Unsupported/);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  const f = make({ defer: true });
  for (const mutate of [d => { d.skill.rangeGrid = []; }, d => { d.rangeGrid = [[0, 4]]; },
    d => { d.raw.arkpedia.module = 'merchant-x'; }, d => { d.raw.arkpedia.skillRank = 11; },
    d => { d.skill.id = 'skchr_swire2_2'; }, d => { d.skill.skillType = 'MANUAL'; },
    d => { d.skill.spType = 'none'; }, d => { d.skill.spCost = 10; }, d => { d.skill.initSp = 5; },
    d => { d.skill.maxCharges = 2; }, d => { d.skill.duration = 10; }, d => { d.skill.bb.sp = 9; }]) {
    const def = structuredClone(f.u.def); mutate(def); const u = f.b._makeAlly(f.u.player, def, 'op', 7, 7);
    const count = Object.values(f.b._hooks).flat().length;
    assert.throws(() => prepareSwireS3(f.b, u, { contract: CONTRACT }));
    assert.equal(Object.values(f.b._hooks).flat().length, count);
  }
  assert.throws(() => prepareSwireS3(f.b, f.u, { contract: CONTRACT }), /fresh/);
});

test('all ten S3 ranks retain five-second automatic activation, original coefficient/force, infinite duration and ten coins', () => {
  const coef = [.8, .85, .9, 1, 1.05, 1.1, 1.2, 1.3, 1.4, 1.5];
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }); advance(f.b, 4.9); assert.equal(f.u.skill.active, false);
    active(f); near(f.u.skill.lastStart, 5, f.b.dt * 2); assert.equal(f.u.skill.manual, false);
    assert.equal(f.u.skill.timeLeft, Infinity); assert.equal(f.controller.wallet.coins, 1);
    assert.equal(f.record.capacity, 10); assert.equal(f.controller.wallet.gain(20), 9);
    near(f.record.bb.atk_scale, coef[rank - 1]); assert.equal(f.record.bb.force, rank === 10 ? 1 : 0);
    const t = enemy(f); f.b.addBuff(t, { key: 'fixture:anchor', flags: { noDisplace: true } });
    end(f); until(f, () => f.goldHits.length === 1); near(f.hits.at(-1).amount, f.u.s.atk * coef[rank - 1]);
    assert.equal(f.births.length, 1); assert.equal(f.hits.at(-1).target, t);
  }
});

test('ordinary attacks before S3 are single-target and use the source entrance/strike clock', () => {
  const f = make(), a = enemy(f), z = enemy(f);
  advance(f.b, 1.1); assert.equal(f.hits.length, 0); until(f, () => f.hits.length === 1);
  near(f.hits[0].time, 1.2, f.b.dt * 2); near(f.hits[0].amount, 810);
  assert.equal(f.hits[0].target, a); assert.equal(f.attacks[0].isSkill, false); near(z.hp, 1e7);
  assert.equal(f.controller.wallet.coins, 0);
});

test('S3 ordinary double strikes retain one target/identity and do not use the ending coefficient', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ dir }); active(f);
    const [row, col] = { RIGHT: [5, 6], UP: [6, 5], LEFT: [5, 4], DOWN: [4, 5] }[dir];
    const a = enemy(f, { row, col }), z = enemy(f, { row, col });
    until(f, () => f.controller.phase?.kind === 'double'); const start = f.b.time;
    until(f, () => f.doubles.length === 1); near(f.doubles[0].time - start, .233333334, f.b.dt * 2);
    until(f, () => f.doubles.length === 2); near(f.doubles[1].time - start, .5, f.b.dt * 2);
    near(f.hits[0].amount, 810); near(f.hits[1].amount, 810); near(z.hp, 1e7);
    assert.equal(f.hits[0].target, a); assert.equal(f.hits[1].target, a);
    assert.equal(f.hits[0].attackId, f.hits[1].attackId); assert.equal(f.attacks.length, 1);
    assert.equal(f.attacks[0].isSkill, true); assert.equal(f.u.skill.sp, 0);
  }
});

test('uncapped attack speed scales both double markers and cadence; ending clock stays unscaled', () => {
  const f = make(); active(f); enemy(f);
  f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 100 } });
  until(f, () => f.doubles.length === 4);
  near(f.doubles[1].time - f.doubles[0].time, (.5 - .233333334) / 2, f.b.dt * 2);
  near(f.doubles[2].time - f.doubles[0].time, .5, f.b.dt * 2);
  const start = end(f); until(f, () => f.births.length === 1);
  near(f.births[0].time - start, .433333337, f.b.dt * 2);
  until(f, () => f.controller.mode === 0); near(f.b.time - start, 1.333, f.b.dt * 2);
});

test('two strikes credit one owner kill coin and never replace the first dead input', () => {
  const f = make(); active(f); const a = enemy(f, { hp: 100 }), z = enemy(f);
  until(f, () => f.doubles.length === 1); assert.equal(a.alive, false);
  near(z.hp, 1e7); assert.equal(f.controller.wallet.coins, 2);
  advance(f.b, .35); assert.equal(f.doubles.length, 1); near(z.hp, 1e7);
  const g = make(); active(g); const first = enemy(g);
  until(g, () => g.controller.phase?.kind === 'double'); const later = enemy(g, { taunt: 10 });
  until(g, () => g.doubles.length === 2); assert.equal(g.doubles[1].target, first); near(later.hp, 1e7);
});

test('a rejected accepted-attack hook produces neither strike; changed target life cannot receive the second', () => {
  const f = make(); active(f); enemy(f);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = []; });
  until(f, () => f.controller.phase?.kind === 'double'); advance(f.b, .6);
  assert.equal(f.hits.length, 0); assert.equal(f.doubles.length, 0); assert.equal(f.attacks.length, 0);
  const g = make(); active(g); const t = enemy(g); until(g, () => g.doubles.length === 1);
  t.deploySeq++; advance(g.b, .3); assert.equal(g.doubles.length, 1);
});

test('controls between original markers cancel the second but preserve active skill coins', () => {
  for (const flag of ['stun', 'freeze', 'sleep', 'levitate', 'disarm']) {
    const f = make(); active(f); enemy(f); until(f, () => f.doubles.length === 1);
    const coins = f.controller.wallet.coins;
    f.b.addBuff(f.u, { key: 'fixture:control', duration: .01, flags: { [flag]: true } });
    advance(f.b, .3); assert.equal(f.doubles.length, 1); assert.equal(f.u.skill.active, true);
    assert.equal(f.controller.wallet.coins, coins);
  }
});

test('manual cancellation works during Begin, denies control/silence/portrait, and drops unborn ordinary hits', () => {
  const f = make(); until(f, () => f.controller.phase?.kind === 'begin');
  assert.equal(f.b.activateOperator(ID), true); assert.equal(f.controller.mode, 4);
  for (const flag of ['stun', 'disarm', 'silence']) {
    const g = make(); active(g); g.b.addBuff(g.u, { key: 'fixture:gate', flags: { [flag]: true } });
    assert.equal(g.controller.canCancel(), false);
    assert.equal(g.b.activateOperator(ID), false); assert.equal(g.u.skill.active, true);
  }
  const g = make(); active(g); g.b.setViewport('portrait'); assert.equal(g.b.activateOperator(ID), false);
  const h = make(); active(h); enemy(h); until(h, () => h.controller.phase?.kind === 'double');
  end(h); advance(h.b, .3); assert.equal(h.doubles.length, 0); assert.equal(h.hits.length, 0);
});

test('automatic start requires five SP and valid action state but no enemies; inactive bench stays reusable', () => {
  for (const flag of ['disarm', 'silence', 'stun']) {
    const f = make(); f.b.addBuff(f.u, { key: 'fixture:gate', flags: { [flag]: true } });
    advance(f.b, 6); assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.charges, 1);
    f.b.removeBuff(f.u, 'fixture:gate'); active(f); assert.equal(f.controller.wallet.coins, 1);
  }
  const f = make({ defer: true }); advance(f.b, 3); assert.equal(f.controller.stopped, false);
  f.deploy(); active(f); assert.equal(f.u.skill.activations, 1);
});

test('ending captures and clears coins once, holds all SP until End completes and recharges from zero', () => {
  const f = make(), start = end(f, 10);
  assert.equal(f.controller.wallet.coins, 0); assert.equal(f.controller.wallet.active, false);
  assert.equal(f.endings[0].coins, 10); assert.equal(f.u.skill.gainSp(99, 'gift'), 0);
  f.u.skill.sp = 5; f.u.skill.charges = 1;
  advance(f.b, .7); assert.equal(f.u.skill.active, false); assert.equal(f.births.length, 0);
  until(f, () => f.controller.mode === 0); near(f.b.time - start, 1.333, f.b.dt * 2);
  assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.charges, 0); assert.equal(f.u.s.flags.noSp, undefined);
  advance(f.b, 4.9); assert.equal(f.u.skill.active, false); active(f); assert.equal(f.u.skill.activations, 2);
});

test('zero coins and no marked recipients still play End and never fabricate shots', () => {
  for (const coins of [0, 10]) {
    const f = make(); const start = end(f, coins);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_End');
    advance(f.b, 1); assert.equal(f.controller.mode, 4); assert.equal(f.births.length, 0);
    until(f, () => f.controller.mode === 0); near(f.b.time - start, 1.333, f.b.dt * 2);
    assert.equal(f.goldHits.length, 0);
  }
});

test('ending marks the frontal source area once in each facing; new arrivals and unblocked flyers are excluded', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ dir }); active(f);
    const [row, col] = { RIGHT: [5, 7], UP: [7, 5], LEFT: [5, 3], DOWN: [3, 5] }[dir];
    const good = enemy(f, { row, col }), fly = enemy(f, { row, col, fly: true });
    const out = enemy(f, { row: 10, col: 10 }); end(f, 2);
    assert.equal(marked(good), true); assert.equal(marked(fly), false); assert.equal(marked(out), false);
    const later = enemy(f, { row, col }); assert.equal(marked(later), false);
    until(f, () => f.births.length === 2); assert.ok(f.births.every(x => x.target === good));
    until(f, () => f.controller.mode === 0); assert.equal(marked(good), false);
  }
});

test('blocked enemies behind facing can be marked; flying blockees cannot receive ending shots', () => {
  const f = make(); active(f); const behind = enemy(f, { row: 5, col: 4 });
  const fly = enemy(f, { row: 9, col: 9, fly: true });
  for (const t of [behind, fly]) { t.blockedBy = f.u; f.u.blocking.push(t); }
  // Direct cancel before the next block-capacity phase enforces the fixture.
  f.controller.wallet.coins = 1; assert.equal(f.b.activateOperator(ID), true);
  assert.equal(marked(behind), true); assert.equal(marked(fly), true);
  until(f, () => f.births.length === 1); assert.equal(f.births[0].target, behind);
});

test('CAST selections follow globally marked enemies after they leave the ending area', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 2);
  t.x = t.tileC = 12; t.y = t.tileR = 12; f.b._buildEnemyIndex();
  until(f, () => f.births.length === 2); assert.ok(f.births.every(x => x.target === t));
  until(f, () => f.controller.mode === 0); assert.equal(marked(t), false);
  until(f, () => f.goldHits.length === 2); assert.equal(f.hits.length, 2);
});

test('random CAST selection runs per coin with one shared ending identity and native .07 cadence', () => {
  const f = make(); active(f); const a = enemy(f, { col: 7 }), z = enemy(f, { row: 6, col: 6 });
  for (const t of [a, z]) f.b.addBuff(t, { key: 'fixture:anchor', flags: { noDisplace: true } });
  const start = end(f, 10); let n = 0; f.b.rng = () => n++ % 2 ? .99 : 0;
  until(f, () => f.births.length === 10);
  assert.deepEqual(f.births.map(x => x.target), Array.from({ length: 10 }, (_, i) => i % 2 ? z : a));
  near(f.births[0].time - start, .433333337, f.b.dt * 2);
  near(f.births[9].time - f.births[0].time, .0700000003 * 9, f.b.dt * 2);
  assert.equal(new Set(f.births.map(x => x.attackId)).size, 1); assert.equal(f.attacks.length, 0);
  until(f, () => f.goldHits.length === 10); assert.equal(f.hits.length, 10);
  assert.equal(f.controller.wallet.gain(1), 0); assert.equal(f.u.skill.sp, 0);
});

test('newly hidden/camouflaged/target-free/sleeping/flying recipients are not replaced by unmarked arrivals', () => {
  for (const flag of ['camou', 'untargetable', 'sleep', 'hidden', 'fly']) {
    const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 3);
    if (flag === 'hidden') t.hidden = true;
    else if (flag === 'fly') t.motion = 'FLY';
    else f.b.addBuff(t, { key: 'fixture:exclude', flags: { [flag]: true } });
    enemy(f, { col: 7 }); advance(f.b, 1.5);
    assert.equal(f.births.length, 0); assert.equal(f.goldHits.length, 0);
  }
});

test('ending projectile has real speed-8 travel and uses current owner ATK/ordinary DEF at impact', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7, def: 100 }); end(f);
  until(f, () => f.births.length === 1); assert.equal(f.goldHits.length, 0);
  const shot = f.births[0].projectile; near(shot.speed, 8); near(shot.maxAge, 10);
  f.b.addBuff(f.u, { key: 'fixture:impact-atk', mods: { atkPct: .5 } });
  advance(f.b, .1); assert.equal(f.goldHits.length, 0);
  until(f, () => f.goldHits.length === 1);
  near(f.goldHits[0].time - f.births[0].time, .25, f.b.dt * 2);
  near(f.hits[0].amount, 810 * 1.5 * 1.5 - 100); assert.equal(f.hits[0].target, t);
});

test('homing follows a moving marked input without hitting a nearby replacement', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }), replacement = enemy(f, { row: 4, col: 6 }); end(f);
  f.b.rng = () => 0;
  until(f, () => f.births.length === 1);
  const captured = f.births[0].target; assert.equal(captured, t);
  t.x = t.tileC = 12; t.y = t.tileR = 12; f.b._buildEnemyIndex();
  advance(f.b, .3); assert.equal(f.goldHits.length, 0);
  until(f, () => f.goldHits.length === 1); assert.equal(f.goldHits[0].target, t); near(replacement.hp, 1e7);
});

test('rank force produces radial pushes through the shared mass pipeline and respects no-displace', () => {
  for (const [rank, mass, anchored, distance] of [[9, 0, false, 1.7], [10, 0, false, 2.14],
    [10, 1, false, 1.7], [10, 0, true, 0]]) {
    const f = make({ rank }); active(f); const t = enemy(f, { row: 6, col: 6, mass });
    if (anchored) f.b.addBuff(t, { key: 'fixture:anchor', flags: { noDisplace: true } });
    const before = { x: t.x, y: t.y }; end(f); until(f, () => f.goldHits.length === 1);
    until(f, () => !t.forcedMove); advance(f.b, 1);
    near(Math.hypot(t.x - before.x, t.y - before.y), distance, .06);
    if (distance) near(t.x - before.x, t.y - before.y, .01);
  }
});

test('dodged/shielded ending damage still applies the native non-missable push', () => {
  for (const kind of ['dodge', 'shield']) {
    const f = make(); active(f); const t = enemy(f, { col: 7 });
    if (kind === 'dodge') f.b.addBuff(t, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
    else f.b.addBuff(t, { key: 'fixture:shield', shield: 1e6 });
    end(f); until(f, () => f.goldHits.length === 1); advance(f.b, 1);
    near(t.hp, 1e7); assert.ok(t.x > 7.1);
  }
});

test('ending control interruption clears unborn shots/marks/SP, but already born projectiles survive', () => {
  for (const flag of ['stun', 'disarm']) {
    const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 10);
    until(f, () => f.births.length === 1);
    f.b.addBuff(f.u, { key: 'fixture:control', duration: .01, flags: { [flag]: true } });
    advance(f.b, .1); assert.equal(f.controller.mode, 0); assert.equal(marked(t), false);
    assert.equal(f.births.length, 1); until(f, () => f.goldHits.length === 1);
  }
  const f = make(); active(f); enemy(f, { col: 7 }); end(f, 2);
  f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
  until(f, () => f.goldHits.length === 2); assert.equal(f.births.length, 2);
});

test('owner withdrawal clears unborn ending actions, while accepted shots retain credit after removal', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 10);
  until(f, () => f.births.length === 1); f.b.retreat(f.u, { permanent: true });
  assert.equal(marked(t), false); assert.equal(f.controller.stopped, true);
  until(f, () => f.goldHits.length === 1); assert.equal(f.hits[0].source, f.u);
  assert.equal(f.births.length, 1); assert.equal(f.controller.finishHook, null);
  const g = make(); active(g); enemy(g, { col: 7 }); end(g, 10);
  g.b.retreat(g.u, { permanent: true }); advance(g.b, 2); assert.equal(g.births.length, 0);
});

test('source death does not create an ending; born shots cannot credit coins to a fresh owner', () => {
  const f = make(); active(f); f.u.player.dp = 0; f.b.kill(f.u);
  assert.equal(f.endings.length, 0); assert.equal(f.births.length, 0); assert.equal(f.controller.stopped, true);
  const g = make(); active(g); const t = enemy(g, { col: 7, hp: 100 }); end(g);
  until(g, () => g.births.length === 1); g.b.retreat(g.u, { permanent: true });
  const fresh = make({ battle: g.b }); until(g, () => g.goldHits.length === 1);
  assert.equal(t.alive, false); assert.equal(fresh.controller.wallet.coins, 0);
  assert.equal(fresh.controller.wallet.stacks, 0); assert.equal(fresh.u.skill.active, false);
});

test('dead or new-life projectile targets never transfer impact to a nearby victim', () => {
  for (const kind of ['death', 'new-life']) {
    const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f);
    until(f, () => f.births.length === 1);
    if (kind === 'death') f.b.kill(t); else t.deploySeq++;
    const z = enemy(f, { col: 7 }); advance(f.b, 1);
    assert.equal(f.goldHits.length, 0); assert.equal(f.hits.length, 0); near(z.hp, 1e7);
    assert.equal(f.controller.outputs.size, 0);
  }
});

test('projectile lifetime remains bounded even when a recipient runs beyond speed-eight flight', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f);
  until(f, () => f.births.length === 1);
  f.b.rect = { r0: 0, c0: 0, r1: 1000, c1: 1000 };
  // Move at each tick while keeping the recipient live; the native mover forces arrival at lifetime.
  const h = f.b.on('tick', () => { t.x += .5; t.y += .5; });
  until(f, () => f.goldHits.length === 1, 11); f.b.off(h);
  near(f.goldHits[0].time - f.births[0].time, 10, f.b.dt * 2); assert.equal(f.controller.outputs.size, 0);
});

test('shared marks do not filter owner identity and cleanup preserves another ending or external mark', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 0);
  const g = make({ battle: f.b, col: 9, dir: 'LEFT' });
  advance(g.b, 1.1); g.u.skill.gainSp(5, 'gift'); active(g); end(g, 1);
  // f has completed during g's startup, so create simultaneous claims explicitly through the private seam.
  f.controller.mark(t); assert.equal(t.mem.swireEndingMarks.claims.size, 2);
  f.controller.clearMarks(); assert.equal(marked(t), true);
  until(g, () => g.births.length === 1); assert.equal(g.births[0].target, t);
  until(g, () => g.controller.mode === 0); assert.equal(marked(t), false);
  const h = make(); active(h); const out = enemy(h, { row: 10, col: 10 });
  const external = h.b.addBuff(out, { key: MARK }); end(h);
  until(h, () => h.births.length === 1); assert.equal(h.births[0].target, out);
  until(h, () => h.controller.mode === 0); assert.ok(out.buffs.includes(external));
});

test('battle finish cancels born outputs and removes ending marks and remaining hooks', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 10);
  until(f, () => f.births.length === 1); f.b.forceEnd('fixture');
  assert.equal(f.controller.outputs.size, 0); assert.equal(f.controller.finishHook, null);
  assert.equal(marked(t), false); assert.equal(f.u.mem.swireCoinEconomy, undefined);
  assert.equal(f.b.projectiles.list.filter(p => p.data?.swireEnding).length, 0);
});

test('rejected marking and synchronous owner removal during ending buff creation leave no orphan marks', () => {
  for (const action of ['reject-hold', 'reject-mark', 'withdraw-hold', 'withdraw-mark']) {
    const f = make(); active(f); const t = enemy(f, { col: 7 });
    f.b.on('beforeBuff', ctx => {
      const key = action.endsWith('hold') ? 'swire2:s3-ending-no-sp' : MARK;
      if (ctx.buff.key !== key) return;
      if (action.startsWith('reject')) ctx.cancel = true;
      else f.b.retreat(f.u, { permanent: true });
    });
    f.controller.wallet.coins = 10;
    assert.equal(f.b.activateOperator(ID), true); advance(f.b, 1.5);
    assert.equal(f.births.length, 0); assert.equal(marked(t), false);
    assert.equal(t.mem.swireEndingMarks, undefined); assert.equal(f.controller.marked.size, 0);
    assert.equal(f.u.s.flags.noSp, undefined);
  }
});

test('shared mark cleanup removes the owned identity without consuming an external replacement', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7 }); end(f, 0);
  const original = t.buffs.find(x => x.key === MARK);
  f.b.removeBuff(t, original); const replacement = f.b.addBuff(t, { key: MARK, data: { external: true } });
  until(f, () => f.controller.mode === 0);
  assert.ok(t.buffs.includes(replacement)); assert.equal(t.mem.swireEndingMarks, undefined);
});

test('upkeep and ending kills cannot increase the captured closing coin count', () => {
  const f = make(); active(f); const t = enemy(f, { col: 7, hp: 100 });
  // Keep the real three-second upkeep running and close just before its next deadline.
  const deadline = Math.ceil(f.b.time / 3) * 3;
  advance(f.b, Math.max(0, deadline - f.b.time - .1));
  f.controller.wallet.coins = 2; const stacks = f.controller.wallet.stacks;
  assert.equal(f.b.activateOperator(ID), true);
  const beforeDp = f.u.player.dp;
  advance(f.b, .3); near(f.u.player.dp, beforeDp - 3);
  assert.equal(f.controller.wallet.stacks, stacks); assert.equal(f.controller.wallet.coins, 0);
  until(f, () => f.goldHits.length === 1); assert.equal(t.alive, false);
  const ending = f.endings.at(-1); assert.equal(ending.coins, 2); assert.ok(f.births.length <= 2);
  assert.equal(f.controller.wallet.coins, 0);
});
