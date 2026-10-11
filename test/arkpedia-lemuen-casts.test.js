// SPDX-License-Identifier: GPL-3.0-or-later
// Real-engine talent/resource fixtures bypass public registration and casting.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { COLS } from '../server/sim/constants.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { LEMUEN_ID, LemuenCombatLinks, selectedLemuenBlackboard } from '../server/sim/content/arkpedia-lemuen-links.js';
import { LemuenAmmunition, LemuenTalentLinks, lemuenWanted }
  from '../server/sim/content/arkpedia-lemuen-resources.js';

import { LemuenAiming, LemuenBombardment } from '../server/sim/content/arkpedia-lemuen-casts.js';
const CONTRACT = { wantedContract: 'continuous-union-v1', reviewNote: 'Engine review; native ordering not recovered.' };
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function owner(b, { elite = 2, potential = 1, skill = 2, rank = 10, col = 4 } = {}) {
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_lemuen_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: LEMUEN_ID, charId: LEMUEN_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data, tags: [c.nationId],
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, bb: selectedLemuenBlackboard(skill, rank),
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, col, { dir: 'RIGHT' });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'duration', duration: 100 } });
  assert.equal(b._deploy(u, { initial: false }), true);
  const ammo = new LemuenAmmunition(skill, rank), links = new LemuenTalentLinks(b, u, ammo, CONTRACT);
  return { b, u, ammo, links };
}
function make(options) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  return owner(b, options);
}
function enemy(b, { x = 5, y = 1, rank = 'ELITE', def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.def = { ...e.def, rank }; e.x = x; e.y = y;
  Object.assign(e.base, { maxHp: 1e7, def, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
// Tick hooks execute at the start-of-step time, before the engine advances it.
function settle(b) { b.step(); assert.deepEqual(b.errors, []); }
function range(u, ...enemies) { u.rangeKeySet = new Set(enemies.map(e => Math.round(e.y) * COLS + Math.round(e.x))); }


const AIM = { firstCheck: 'immediate', boundary: 'expiry-before-trigger',
  isLethal: ({ unit, target, scale }) => unit.s.atk * scale > target.hp + target.s.def,
  reviewNote: 'Local immediate-check/expiry-first/plain-HP-plus-DEF predicate; native frame and modifier order unverified.' };
const BOMB = { parentEvent: 'one-child-at-first-period', parentExpiry: 'before-period', childTravel: 'lifetime',
  sampleOffset: () => ({ x: 0, y: 0 }),
  reviewNote: 'Local one child at each parent first period; deterministic offset supplied by fixture; TTL mapped to travel.' };
function aiming(f, contract = AIM) {
  const links = new LemuenCombatLinks(f.b, f.u);
  const aim = new LemuenAiming(f.b, f.u, links, f.ammo, contract); aim.install(); f.ammo.begin(); return aim;
}
function bombardment(f, contract = BOMB) {
  const links = new LemuenCombatLinks(f.b, f.u);
  const bomb = new LemuenBombardment(f.b, f.u, links, f.ammo, contract); bomb.install(); f.ammo.begin(); return bomb;
}
function wanted(f, e) { assert.equal(f.links.mark(e), true); }
function advancePast(b, seconds) { advance(b, seconds); settle(b); }

// These fixtures isolate linked native-source clocks from the unresolved full
// cast controller. Direct mark() creates the pre-existing Wanted prerequisite;
// its actual acquisition timing is tested separately in the resource suite.

test('aiming requires the selected source rank, matching links and explicit scheduling/lethal review', () => {
  const f = make(), links = new LemuenCombatLinks(f.b, f.u);
  for (const contract of [undefined, {}, { ...AIM, firstCheck: 'delayed' },
    { ...AIM, boundary: 'trigger-first' }, { ...AIM, isLethal: null }, { ...AIM, reviewNote: '' }])
    assert.throws(() => new LemuenAiming(f.b, f.u, links, f.ammo, contract), /requires reviewed/);
  assert.throws(() => new LemuenAiming(f.b, f.u, links, new LemuenAmmunition(1, 10), AIM), /impact\/resource/);
  f.u.def.skill.bb.atk = 99;
  assert.throws(() => new LemuenAiming(f.b, f.u, links, f.ammo, AIM), /Incomplete/);
});
test('all S2 ranks check before incrementing, expire before the boundary tick and snapshot the final coefficient', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), e = enemy(f.b), seen = [], bb = f.u.def.skill.bb;
    wanted(f, e);
    const aim = aiming(f, { ...AIM, isLethal: c => { seen.push(c.scale); return false; } });
    assert.equal(aim.begin(e, `rank-${rank}`), true);
    assert.equal(aim.begin(e, 'overlap'), false);
    near(seen[0], bb['attack@main_atk_scale']); assert.equal(aim.state.checks, 1);
    near(aim.state.scale, bb['attack@main_atk_scale'] + bb['attack@ex_atk_scale']);
    assert.equal(f.ammo.current, f.ammo.base - 1);
    advancePast(f.b, bb['attack@aim_duration']);
    assert.equal(aim.result.reason, 'duration'); assert.equal(aim.result.born, true);
    assert.equal(seen.length, bb['attack@trig_cnt']);
    near(aim.result.scale, bb['attack@fin_atk_scale']);
    near(aim.result.currentValue, f.u.s.atk * bb['attack@fin_atk_scale']);
    assert.equal(aim.busy, false); assert.equal(e.findBuff(aim.effectKey), null);
    assert.equal(f.u.stats.attacks, 0); assert.equal(f.u.skill.activations, 0);
  }
});
test('a lethal first check shoots the initial coefficient without an increment or extra ammunition', () => {
  const f = make(), e = enemy(f.b, { def: 100 }); e.hp = 100;
  wanted(f, e); const aim = aiming(f), hp = e.hp;
  assert.equal(aim.begin(e, 'early'), true); assert.equal(aim.result.reason, 'lethal');
  near(aim.result.scale, f.u.def.skill.bb['attack@main_atk_scale']); assert.equal(aim.result.checks, 0);
  assert.equal(f.ammo.current, f.ammo.base - 1); assert.equal(aim.result.born, true);
  advancePast(f.b, .2); assert.ok(e.hp < hp); assert.equal(f.b.projectiles.list.length, 0);
});
test('the local lethal predicate uses a strict threshold and is reevaluated before each increment', () => {
  const f = make(), e = enemy(f.b, { def: 200 }), main = f.u.def.skill.bb['attack@main_atk_scale'];
  e.hp = f.u.s.atk * main - 200; wanted(f, e); const aim = aiming(f);
  aim.begin(e, 'strict'); assert.equal(aim.result, null);
  assert.equal(aim.state.checks, 1);
  advancePast(f.b, .25); assert.equal(aim.result.reason, 'lethal'); assert.equal(aim.result.checks, 1);
  near(aim.result.scale, main + f.u.def.skill.bb['attack@ex_atk_scale']);
});
test('aimed ATK is read at finish and stays cached after later stat changes', () => {
  const f = make(), e = enemy(f.b), aim = aiming(f); wanted(f, e); aim.begin(e, 'snapshot');
  advance(f.b, 1); f.b.addBuff(f.u, { key: 'during-aim', mods: { atkPct: 1 } });
  const atk = f.u.s.atk; advancePast(f.b, 2.5); const fixed = aim.result.currentValue;
  near(fixed, atk * 4.25);
  f.b.removeBuff(f.u, 'during-aim'); const hp = e.hp;
  advancePast(f.b, .2); near(hp - e.hp, fixed * 1.15);
});
test('an invalid or unpaid aiming request cannot consume ammunition or invent a projectile', () => {
  for (const reason of ['normal', 'unwanted', 'camo', 'empty', 'inactive']) {
    const f = make(), e = enemy(f.b, { rank: reason === 'normal' ? 'NORMAL' : 'ELITE' }), aim = aiming(f);
    if (!['normal', 'unwanted'].includes(reason)) wanted(f, e);
    if (reason === 'camo') f.b.addBuff(e, { key: reason, flags: { camou: true } });
    if (reason === 'empty') while (f.ammo.current) f.ammo.consume(`spent-${f.ammo.current}`);
    if (reason === 'inactive') f.ammo.end();
    const current = f.ammo.current;
    assert.equal(aim.begin(e, 'refused'), false); assert.equal(f.ammo.current, current);
    assert.equal(aim.state, null); assert.equal(f.b.projectiles.list.length, 0);
  }
});
test('target death or a reborn target life cannot retarget or produce a cached shot', () => {
  for (const reason of ['dead', 'reborn']) {
    const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 }), aim = aiming(f);
    wanted(f, e); wanted(f, other); aim.begin(e, 'lost');
    if (reason === 'dead') f.b.kill(e, null); else e.deploySeq++;
    advancePast(f.b, 3.5); assert.equal(aim.result.born, false);
    assert.equal(aim.result.reason, 'duration'); near(other.hp, 1e7);
    assert.equal(f.ammo.current, f.ammo.base - 1); assert.equal(f.b.projectiles.list.length, 0);
  }
});
test('removing Wanted after aim starts retains the captured victim and original deadline', () => {
  const f = make(), e = enemy(f.b), aim = aiming(f); wanted(f, e); aim.begin(e, 'cleanse');
  f.links.removeWanted(e); assert.equal(lemuenWanted(f.b, e), false);
  advancePast(f.b, 3.5); assert.equal(aim.result.born, true); assert.equal(aim.result.target, e);
});
test('control cancels an unborn aim without refund; owner withdrawal removes its clocks and effect', () => {
  for (const reason of ['stun', 'disarm', 'epoch', 'withdraw']) {
    const f = make(), e = enemy(f.b), aim = aiming(f); wanted(f, e); aim.begin(e, 'interrupted');
    if (reason === 'withdraw') f.b.retreat(f.u);
    else if (reason === 'epoch') f.u.attackControlEpoch++;
    else f.b.addBuff(f.u, { key: reason, flags: { [reason]: true } });
    advancePast(f.b, 4); assert.equal(aim.result.born, false);
    assert.equal(f.ammo.current, f.ammo.base - 1); near(e.hp, 1e7);
    assert.equal(e.findBuff(aim.effectKey), null);
    if (reason === 'withdraw') { assert.equal(aim.stopped, true); assert.equal(aim.hooks.length, 0); }
  }
});
test('a shot born at aim finish survives owner withdrawal with its cached amount', () => {
  const f = make(), e = enemy(f.b), aim = aiming(f); wanted(f, e); aim.begin(e, 'born');
  advancePast(f.b, 3.5); const fixed = aim.result.currentValue; f.b.retreat(f.u);
  advancePast(f.b, .2); near(1e7 - e.hp, fixed); assert.equal(aim.hooks.length, 0);
});
test('bombardment requires matching source/resource links and reviewed callback, spread and travel choices', () => {
  const f = make({ skill: 3 }), links = new LemuenCombatLinks(f.b, f.u);
  for (const contract of [undefined, {}, { ...BOMB, parentEvent: 'repeat' },
    { ...BOMB, parentExpiry: 'after-period' }, { ...BOMB, childTravel: 'instant' },
    { ...BOMB, sampleOffset: null }, { ...BOMB, reviewNote: '' }])
    assert.throws(() => new LemuenBombardment(f.b, f.u, links, f.ammo, contract), /requires reviewed/);
  assert.throws(() => new LemuenBombardment(f.b, f.u, links, new LemuenAmmunition(2, 10), BOMB), /impact\/resource/);
});
test('all S3 ranks consume one bullet per retained mark and emit exactly one staggered child per mark', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), e = enemy(f.b), bomb = bombardment(f), bb = f.u.def.skill.bb;
    range(f.u, e);
    for (let n = 0; n < f.ammo.base; n++) assert.equal(bomb.mark(e, `mark-${n}`), true);
    assert.equal(bomb.mark(e, 'over-capacity'), false); assert.equal(f.ammo.current, 0);
    assert.equal(bomb.marks.length, bb['attack@trigger_time']);
    const impacts = []; f.b.on('damaged', c => { if (c.dmg.tags?.includes('lemuen:s3')) impacts.push(c); });
    const parents = bomb.release(); assert.equal(parents.length, f.ammo.base); assert.equal(bomb.marks.length, 0);
    assert.equal(bomb.release(), false); assert.equal(bomb.mark(e, 'after-release'), false);
    bomb.install(); assert.equal(bomb.hooks.length, 0); assert.equal(bomb.childLifetime, .25);
    for (let n = 0; n < parents.length; n++) near(parents[n].delay, .1 + .3 * n);
    advancePast(f.b, 3); assert.equal(impacts.length, f.ammo.base);
    assert.ok(parents.every(p => p.child && p.child.maxAge === .25 && p.child.flightTime === .25));
    assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.u.stats.attacks, 0);
    near(1e7 - e.hp, f.u.s.atk * bb['attack@proj_atk_scale_1'] * f.ammo.base);
  }
});
test('markers follow valid target movement until release, then retain their fixed bombardment positions', () => {
  const f = make({ skill: 3 }), e = enemy(f.b), bomb = bombardment(f); range(f.u, e);
  bomb.mark(e, 'moving'); e.x = 6; bomb.sync(); near(bomb.marks[0].x, 6);
  const plans = bomb.release(); e.x = 7; f.b._buildEnemyIndex();
  near(plans[0].x, 6); near(plans[0].to.x, 6);
  advancePast(f.b, 1); near(1e7 - e.hp, f.u.s.atk * f.u.def.skill.bb['attack@proj_atk_scale_2']);
});
test('dead or reborn target lives preserve the last valid marker point instead of chasing a new body', () => {
  for (const reason of ['dead', 'reborn']) {
    const f = make({ skill: 3 }), e = enemy(f.b), nearby = enemy(f.b, { x: 5.1 }), bomb = bombardment(f);
    range(f.u, e); bomb.mark(e, 'last-point');
    if (reason === 'dead') f.b.kill(e, null); else e.deploySeq++;
    e.x = 7; bomb.sync(); near(bomb.marks[0].x, 5);
    bomb.release(); advancePast(f.b, 1); assert.ok(nearby.hp < 1e7);
  }
});
test('S3 snapshots ATK once at release and already emitted parents survive source removal', () => {
  const f = make({ skill: 3 }), e = enemy(f.b), bomb = bombardment(f); range(f.u, e);
  f.b.addBuff(f.u, { key: 'at-release', mods: { atkPct: 1 } });
  bomb.mark(e, 'one'); bomb.mark(e, 'two'); const cached = f.u.s.atk;
  const plans = bomb.release(); f.b.removeBuff(f.u, 'at-release'); f.b.retreat(f.u); bomb.stop();
  advancePast(f.b, 1); assert.ok(plans.every(p => p.child));
  near(1e7 - e.hp, cached * f.u.def.skill.bb['attack@proj_atk_scale_1'] * 2);
});
test('owner removal before S3 release discards managed marks without emitting output', () => {
  const f = make({ skill: 3 }), e = enemy(f.b), bomb = bombardment(f); range(f.u, e);
  bomb.mark(e, 'unreleased'); f.b.retreat(f.u);
  assert.equal(bomb.stopped, true); assert.equal(bomb.marks.length, 0); assert.equal(bomb.hooks.length, 0);
  assert.equal(bomb.release(), false); advancePast(f.b, 2); near(e.hp, 1e7);
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(bomb.emitted.length, 0);
});
test('supplied bounded offsets become fixed child destinations, independent of later target movement', () => {
  const f = make({ skill: 3 }), e = enemy(f.b), offsets = [];
  const bomb = bombardment(f, { ...BOMB, sampleOffset: c => { offsets.push(c); return { x: .1, y: -.1 }; } });
  range(f.u, e); bomb.mark(e, 'spread'); const plans = bomb.release();
  assert.equal(offsets[0].maximum, .2); assert.equal(offsets[0].index, 0);
  near(plans[0].to.x, 5.1); near(plans[0].to.y, .9);
  e.x = 5.1; e.y = .9; f.b._buildEnemyIndex(); advancePast(f.b, 1);
  near(1e7 - e.hp, f.u.s.atk * 4.5);
});
test('invalid spread contracts fail before markers are detached or damage is scheduled', () => {
  for (const offset of [{ x: NaN, y: 0 }, { x: 0 }, { x: .2, y: .2 }]) {
    const f = make({ skill: 3 }), e = enemy(f.b), bomb = bombardment(f, { ...BOMB, sampleOffset: () => offset });
    range(f.u, e); bomb.mark(e, 'invalid'); const sched = f.b._sched.length;
    assert.throws(() => bomb.release(), /offset/); assert.equal(bomb.released, false);
    assert.equal(bomb.marks.length, 1); assert.equal(f.b._sched.length, sched);
    assert.equal(f.b.projectiles.list.length, 0); near(e.hp, 1e7);
  }
});
test('S3 marks only legal in-range or Wanted victims and cannot spend ammunition twice for a mark identity', () => {
  const f = make({ skill: 3 }), e = enemy(f.b, { x: 7 }), bomb = bombardment(f);
  range(f.u); assert.equal(bomb.mark(e, 'outside'), false); wanted(f, e);
  assert.equal(bomb.mark(e, 'global'), true); assert.equal(bomb.mark(e, 'global'), false);
  f.b.addBuff(e, { key: 'camo', flags: { camou: true } });
  assert.equal(bomb.mark(e, 'camo'), false); assert.equal(f.ammo.current, f.ammo.base - 1);
});

test('a parent whose first period lies beyond its native lifetime expires without an extra child', () => {
  const f = make({ skill: 3 }), e = enemy(f.b), bomb = bombardment(f);
  f.ammo.end(); f.ammo.capacity('explicit-test-contribution', 30); f.ammo.begin(); range(f.u, e);
  for (let n = 0; n < 35; n++) bomb.mark(e, `lifetime-${n}`);
  const plans = bomb.release(); assert.equal(plans.length, 35); assert.equal(bomb.parentLifetime, 10);
  advancePast(f.b, 11); assert.equal(plans.filter(p => p.child).length, 33);
  assert.equal(plans.filter(p => p.expired).length, 2); assert.equal(f.b.projectiles.list.length, 0);
});
