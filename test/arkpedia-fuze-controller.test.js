// SPDX-License-Identifier: GPL-3.0-or-later
// Original-source controller fixtures; public deployment transactions have separate tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-fuze-prefabs.json' with { type: 'json' };
import notes from '../data/arkpedia-fuze-gameplay-notes.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { rotateOffset } from '../server/sim/dir.js';
import { COLS } from '../server/sim/constants.js';
import { OB_BLOCK, OB_CRATE } from '../server/sim/grid.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { FUZE_ID, FUZE_CONTRACT, prepareFuzeKit, fuzeClusterGeometry } from '../server/sim/content/arkpedia-fuze.js';
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
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', contract = FUZE_CONTRACT,
  battle = null, defer = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_fuze_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillId: id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = evidence.tables.skills[id].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: FUZE_ID, charId: FUZE_ID, name: c.name,
    stats: phase.attributesKeyFrames.at(-1).data, profession: c.profession, position: c.position,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareFuzeKit(b, u, { contract }); b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => assert.equal(b._deploy(u, { initial: false }), true);
  if (!defer) deploy();
  const hits = [], attacks = [], births = [], stops = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  b.on('fuzeGrenadeBirth', ctx => { if (ctx.shot.source === u) births.push({ ...ctx, time: b.time }); });
  b.on('fuzeGrenadeStop', ctx => { if (ctx.shot.source === u) stops.push({ ...ctx, time: b.time }); });
  return { b, u, build, level, deploy, hits, attacks, births, stops, ...prepared };
}
function point(f, cross, forward) {
  const [dr, dc] = rotateOffset(cross, forward, f.u.dir); return { x: f.u.tileC + dc, y: f.u.tileR + dr };
}
function tile(f, cross, forward, values) {
  const p = point(f, cross, forward); Object.assign(f.b.grid.tile(p.y, p.x), values); return p;
}
function wall(f, width = 3, side = 'left') {
  tile(f, 0, 1, { height: 'HIGH', pass: 'FLY', build: 'RANGED' });
  if (width === 1 || width === 2 && side === 'left') tile(f, -1, 2, { pass: 'FLY' });
  if (width === 1 || width === 2 && side === 'right') tile(f, 1, 2, { pass: 'FLY' });
  return fuzeClusterGeometry(f.b, f.u);
}
function enemy(f, { x, y, cross = 0, forward = 1, fly = false, def = 0, area } = {}) {
  const p = point(f, cross, forward), e = f.b.spawnEnemy('enemy_1007_slime', { pos: [y ?? p.y, x ?? p.x] });
  Object.assign(e.base, { maxHp: 1e7, atk: 500, def, res: 0, moveSpeed: 0 });
  e.markDirty(); e.hp = 1e7; if (fly) e.motion = 'FLY'; if (area) e.hitArea = area;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}
const enter = f => until(f, () => f.controller.phase?.kind !== 'entrance');
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };

test('Fuze contracts and every malformed selected source fail before installing hooks', () => {
  assert.throws(() => make({ contract: null }), /contracts/);
  const f = make({ skill: 2 });
  for (const mutate of [d => { d.raw.arkpedia.module = 'module'; }, d => { d.raw.arkpedia.level = 81; },
    d => { d.raw.arkpedia.elite = -1; }, d => { d.raw.arkpedia.potential = 7; },
    d => { d.raw.arkpedia.skillId = 'other'; }, d => { d.raw.arkpedia.skillRank = 11; },
    d => { d.skill.spCost = 0; }, d => { d.skill.initSp = 0; }, d => { d.skill.maxCharges = 2; },
    d => { d.skill.spType = 'attack'; }, d => { d.skill.skillType = 'AUTO'; },
    d => { d.skill.bb.extra = 1; }, d => { d.skill.duration = 5; },
    d => { d.skill.rangeGrid = [[0, 3]]; }, d => { d.rangeGrid = [[0, 4]]; }]) {
    const def = structuredClone(f.u.def); mutate(def); const u = f.b._makeAlly(f.u.player, def, 'op', 5, 9);
    const count = Object.values(f.b._hooks).flat().length;
    assert.throws(() => prepareFuzeKit(f.b, u, { contract: FUZE_CONTRACT }));
    assert.equal(Object.values(f.b._hooks).flat().length, count);
  }
});

test('all twenty ranks preserve selected SP, S1 modifiers/range/100 rounds and S2 coefficient/use count', () => {
  for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }); wall(f); enter(f);
    near(f.u.skill.spCost, f.level.spData.spCost); near(f.u.skill.initSp, f.level.spData.initSp);
    assert.equal(f.u.skill.spType, 'time'); assert.equal(f.u.skill.manual, true);
    const atk = f.u.s.atk, interval = f.u.s.interval; cast(f);
    if (skill === 1) {
      near(f.u.s.atk, atk * (1 + f.u.def.skill.bb.atk));
      near(f.u.s.interval, interval * 100 / (100 + f.u.def.skill.bb.attack_speed));
      assert.equal(f.u.skill.ammoLeft, 100); assert.equal(f.u.skill.spec.manualCancel, true);
      assert.ok(f.u.rangeKeys.length > f.u.baseRangeKeys.length);
    } else {
      near(f.u.s.atk, atk); assert.equal(f.controller.uses, 1);
      assert.equal(f.u.skill.remainingUses, 2); assert.equal(f.u.skill.spec.manualCancel, false);
      near(f.u.def.skill.bb.atk_scale, f.level.blackboard.find(v => v.key === 'atk_scale').value);
    }
  }
});

test('geometry independently matches right-to-left edge endpoints for all four facings and widths', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) for (const width of [1, 2, 3])
    for (const side of width === 2 ? ['left', 'right'] : ['left']) {
      const f = make({ skill: 2, dir }), g = wall(f, width, side);
      assert.equal(g.width, width); near(g.spacing, width / 4);
      const first = width === 3 ? -1.5 : width === 2 && side === 'right' ? -1.5 : -.5;
      for (let i = 0; i < 5; i++) assert.deepEqual(g.destinations[i], point(f, first + i * width / 4, 2));
      const front = g.front;
      Object.assign(f.b.grid.tile(front.y, front.x), { height: 'LOW', pass: 'ALL' });
      assert.equal(fuzeClusterGeometry(f.b, f.u), null);
      for (const kind of [OB_BLOCK, OB_CRATE]) {
        f.b.grid.obstacle[front.y * COLS + front.x] = kind;
        assert.ok(fuzeClusterGeometry(f.b, f.u));
      }
      f.b.grid.obstacle[front.y * COLS + front.x] = 0;
      wall(f, width, side); tile(f, 0, 2, { pass: 'FLY' }); assert.equal(fuzeClusterGeometry(f.b, f.u), null);
    }
});

test('illegal S2 geometry keeps SP and uses; exhausted three-use limit resets only with a fresh owner', () => {
  const f = make({ skill: 2 }); enter(f); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.activate(), false); assert.equal(f.controller.uses, 0);
  near(f.u.skill.spTotal, f.u.skill.spCost); assert.equal(skillHud(f.u.skill).canActivate, false);
  wall(f);
  for (let i = 1; i <= 3; i++) {
    cast(f); assert.equal(f.controller.uses, i); assert.equal(f.u.skill.remainingUses, 3 - i);
    advance(f.b, 5.5); assert.equal(f.u.skill.active, false);
  }
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.ready, false);
  assert.equal(f.u.skill.activate(), false); assert.equal(f.births.length, 15);
  f.b.retreat(f.u, { permanent: true });
  const fresh = make({ skill: 2, battle: f.b }); assert.notEqual(fresh.u, f.u); assert.equal(fresh.controller.uses, 0);
});

test('ordinary fire waits for original entrance/event and hits current block count including airborne targets', () => {
  for (const elite of [0, 1, 2]) for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ elite, dir });
    for (let i = 0; i < 4; i++) enemy(f, { fly: i === 0 });
    advance(f.b, .95); assert.equal(f.hits.length, 0);
    until(f, () => f.attacks.length === 1);
    assert.equal(f.hits.length, elite === 2 ? 3 : 2);
    near(f.hits[0].amount, f.u.s.atk); near(f.hits[0].time, 1.2, f.b.dt * 2);
    assert.ok(f.hits.some(h => h.target.motion === 'FLY'));
  }
});

test('S1 consumes one round per multi-target attack, preserves ASPD cadence and uses capped hit events', () => {
  const f = make(); for (let i = 0; i < 4; i++) enemy(f);
  enter(f); cast(f); const start = f.b.time;
  until(f, () => f.controller.phase?.kind === 'attack');
  const event = evidence.models[FUZE_ID].Front.eventPayloads.Skill_1_Loop.find(e => e.name === 'OnAttack').time;
  const attackStart = f.controller.phase.releaseAt - event;
  const begin = modelDuration(f, 'Skill_1_Begin');
  assert.ok(attackStart - start >= begin - 1e-7 && attackStart - start <= begin + 2 * f.b.dt + 1e-7);
  until(f, () => f.attacks.length === 4);
  assert.equal(f.u.skill.ammoLeft, 96); assert.equal(f.hits.length, 12);
  near(f.attacks[0].time - attackStart, event, f.b.dt + 1e-6);
  for (let i = 1; i < 4; i++) near(f.attacks[i].time - f.attacks[i - 1].time, f.u.s.interval, f.b.dt * 2);
  assert.ok(f.attacks[3].time - f.attacks[0].time < 2);
  near(f.u.mem.regularFormVisual.speed, 1);
});

test('S1 range extension affects only S1; accepted hundredth attack starts the original facing End', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ dir }), far = enemy(f, { forward: 2 }); enter(f);
    f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 1 } }); f.b.refreshRange(f.u);
    assert.equal(f.controller.candidates().includes(far), false);
    cast(f); assert.equal(f.controller.candidates().includes(far), true);
    until(f, () => f.attacks.length === 100, 80);
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.ammoLeft, 0);
    assert.equal(f.controller.phase.kind, 'skill-end'); assert.ok(f.u.s.flags.noSp);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_End');
    const end = f.b.time; advance(f.b, modelDuration(f, 'Skill_1_End') - .06);
    near(f.u.skill.spTotal, 0); assert.equal(f.controller.phase.kind, 'skill-end');
    advance(f.b, .12); assert.equal(!!f.u.s.flags.noSp, false); assert.ok(f.b.time > end);
    assert.equal(f.controller.candidates().includes(far), false);
  }
});
function modelDuration(f, clip) { return evidence.models[FUZE_ID][['UP', 'LEFT'].includes(f.u.dir) ? 'Back' : 'Front'].durations[clip]; }

test('control, invalid victims and canceled attack hooks spend no S1 rounds before a legal release', () => {
  const f = make(), e = enemy(f); enter(f); cast(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.b.applyStatus(f.u, 'stun', { duration: .01 }); advance(f.b, .25);
  assert.equal(f.u.skill.ammoLeft, 100); assert.equal(f.hits.length, 0);
  const hook = f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = []; });
  advance(f.b, 1.5); assert.equal(f.u.skill.ammoLeft, 100); f.b.off(hook);
  until(f, () => f.controller.phase?.kind === 'attack' && !f.controller.phase.released);
  e.deploySeq++; advance(f.b, .25); assert.equal(f.u.skill.ammoLeft, 100);
  until(f, () => f.hits.length === 1); assert.equal(f.u.skill.ammoLeft, 99);
});

test('manual S1 discard restores modifiers and cancels an unborn attack before its End phase', () => {
  const f = make(), e = enemy(f); enter(f); const atk = f.u.s.atk; cast(f);
  until(f, () => f.controller.phase?.kind === 'attack'); f.u.skill.end('manual');
  assert.equal(f.u.skill.active, false); near(f.u.s.atk, atk); near(f.u.s.aspd, 100);
  advance(f.b, .25); assert.equal(f.hits.length, 0); near(e.hp, 1e7);
  assert.equal(f.controller.phase.kind, 'skill-end');
});

test('all ten selected S2 ranks in four facings launch five distinct delayed grenades with selected coefficients', () => {
  for (let rank = 1; rank <= 10; rank++) for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ skill: 2, rank, dir }), g = wall(f, 1), e = enemy(f, { forward: 2 });
    enter(f); cast(f); const start = f.b.time; advance(f.b, 1.1);
    assert.equal(f.births.length, 0); assert.equal(f.stops.length, 0);
    until(f, () => f.births.length === 5);
    near(f.births[0].time - start, 1.2000000476837158, f.b.dt + 1e-6);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(f.births[i].shot.destination, g.destinations[i]);
      near(f.births[i].time - f.births[0].time, i * .5, f.b.dt + 1e-6);
    }
    until(f, () => f.stops.length === 5);
    assert.equal(f.hits.length, 5); near(1e7 - e.hp, f.u.s.atk * f.u.def.skill.bb.atk_scale * 5, 1e-4);
    for (const stop of f.stops) {
      near(stop.time - stop.shot.reachedAt, 1.7999999523162842, f.b.dt + 1e-6);
      assert.ok(stop.time - stop.shot.birthAt > 1.9);
    }
    assert.equal(f.attacks.length, 0); assert.equal(f.controller.born.size, 0);
  }
});

test('stop-only area damage resamples recipients, ignores camouflage and has no block-count victim cap', () => {
  const f = make({ skill: 2 }); wall(f, 1); enter(f); cast(f);
  const departed = enemy(f, { forward: 2 }); until(f, () => f.births.length === 2);
  departed.x = 18; departed.y = 18;
  const group = Array.from({ length: 5 }, () => enemy(f, { forward: 2 }));
  f.b.addBuff(group[0], { key: 'fixture:camou', flags: { camou: true } });
  const air = enemy(f, { forward: 2, fly: true }), hidden = enemy(f, { forward: 2 });
  f.b.addBuff(hidden, { key: 'fixture:hidden', flags: { untargetable: true } });
  const stealth = enemy(f, { forward: 2 }); f.b.addBuff(stealth, { key: 'fixture:stealth', flags: { stealth: true } });
  until(f, () => f.stops.length === 5);
  assert.equal(f.hits.length, 25); near(departed.hp, 1e7); near(air.hp, 1e7); near(hidden.hp, 1e7); near(stealth.hp, 1e7);
  assert.ok(f.stops.every(s => s.victims.length === 5));
});

test('current stop ATK, separate mitigation and huge body geometry apply once per grenade', () => {
  const f = make({ skill: 2 }); wall(f, 1); enter(f); cast(f);
  until(f, () => f.births.length === 2);
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: 1 } });
  const e = enemy(f, { forward: 3.6, def: 100, area: { w: 2, h: 2, dx: 0, dy: 0 } });
  until(f, () => f.stops.length === 5);
  assert.equal(f.hits.length, 5);
  for (const hit of f.hits) near(hit.amount, f.u.s.atk * f.u.def.skill.bb.atk_scale - 100);
  assert.equal(new Set(f.hits.map(h => h.dmg.attackId)).size, f.hits.length);
  assert.ok(e.hp < 1e7);
});

test('transient control cancels remaining births while born grenades survive and retain area output', () => {
  const f = make({ skill: 2 }); wall(f, 1); enemy(f, { forward: 2 }); enter(f); cast(f);
  until(f, () => f.births.length === 2); f.b.applyStatus(f.u, 'stun', { duration: .01 }); advance(f.b, .1);
  assert.equal(f.u.skill.active, false); assert.equal(f.controller.uses, 1);
  advance(f.b, 4); assert.equal(f.births.length, 2); assert.equal(f.stops.length, 2); assert.equal(f.hits.length, 2);
});

test('retreat before first birth emits nothing; departure after two births preserves only those old outputs', () => {
  for (const before of [true, false]) {
    const f = make({ skill: 2 }); wall(f, 1); enemy(f, { forward: 2 }); enter(f); cast(f);
    if (before) advance(f.b, .9); else until(f, () => f.births.length === 2);
    f.b.retreat(f.u, { permanent: true }); assert.equal(f.controller.stopped, true);
    const fresh = make({ skill: 2, battle: f.b });
    advance(f.b, 5); assert.equal(f.births.length, before ? 0 : 2); assert.equal(f.stops.length, before ? 0 : 2);
    assert.equal(fresh.controller.uses, 0); assert.equal(f.controller.born.size, 0); assert.equal(f.controller.finishHook, null);
  }
});

test('battle end cancels both flying and planted grenades and removes controller hooks', () => {
  const f = make({ skill: 2 }); wall(f, 1); enemy(f, { forward: 2 }); enter(f); cast(f);
  until(f, () => f.births.length === 2); assert.ok(f.controller.born.size);
  f.b.finished = true; f.b.emit('battleEnd', {});
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.born.size, 0);
  assert.equal(f.controller.finishHook, null); assert.equal(f.controller.handles.length, 0);
  assert.ok(f.births.every(b => b.shot.stopped)); assert.equal(f.stops.length, 0);
});

test('Ballistic Shield selects promotion/potential, fully blocks only ranged-source Physical and survives silence', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 5]) {
    const f = make({ elite, potential }), source = enemy(f), prob = elite === 0 ? 0 : (elite === 1 ? .17 : .27) + (potential === 5 ? .03 : 0);
    near(f.record.talent?.blackboard[0].value ?? 0, prob);
    source.profile.attack = 'ranged'; f.b.rng = () => Math.max(0, prob - .001);
    f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
    let hp = f.u.hp;
    f.b.dealDamage(source, f.u, { amount: 500, type: 'phys', canDodge: false, applyWay: 'none' });
    near(hp - f.u.hp, elite ? 0 : 500 - f.u.s.def);
    f.b.rng = () => prob; hp = f.u.hp;
    f.b.dealDamage(source, f.u, { amount: 500, type: 'phys', canDodge: false, applyWay: 'ranged' });
    near(hp - f.u.hp, 500 - f.u.s.def);
    source.profile.attack = 'melee'; f.b.rng = () => 0; hp = f.u.hp;
    f.b.dealDamage(source, f.u, { amount: 500, type: 'phys', applyWay: 'ranged' }); near(hp - f.u.hp, 500 - f.u.s.def);
    source.profile.attack = 'ranged'; hp = f.u.hp;
    f.b.dealDamage(source, f.u, { amount: 100, type: 'arts' }); near(hp - f.u.hp, 100);
  }
});

test('geometry corroboration remains distinct from native frame/stop evidence', () => {
  assert.equal(notes.source.revision, 434903); assert.equal(notes.source.snapshot, 'rendered-html');
  assert.match(notes.source.sha256, /^[a-f0-9]{64}$/);
  assert.match(notes.observations.join(' '), /right edge.*one quarter.*half a second/);
  assert.match(notes.limits.join(' '), /not compiled Unity/);
  assert.deepEqual(evidence.enabledOperators, [FUZE_ID]); assert.equal(evidence.frameParity, false);
  assert.deepEqual(evidence.geometryEvidence, notes.source);
});


test('total grenade life bounds forced reach under extreme projectile slowdown, including departed owners', () => {
  const f = make({ skill: 2 }); wall(f, 1); enemy(f, { forward: 2 }); enter(f); cast(f);
  f.b.projectiles.registerSpeedAura({ owner: f.u, contains: () => true, scale: .0001 });
  until(f, () => f.births.length === 2);
  // Keep the aura alive through departure using another deployed fixture.
  const fresh = make({ battle: f.b, defer: true });
  f.b.retreat(f.u, { permanent: true }); fresh.deploy();
  f.b.projectiles.registerSpeedAura({ owner: fresh.u, contains: () => true, scale: .0001 });
  until(f, () => f.stops.length === 2, 12);
  for (const stop of f.stops) {
    assert.ok(stop.time - stop.shot.birthAt >= 10 - f.b.dt);
    assert.ok(stop.time - stop.shot.birthAt <= 10 + 2 * f.b.dt + 1e-6);
  }
  assert.equal(f.hits.length, 2); assert.equal(f.controller.born.size, 0);
  assert.equal(f.controller.finishHook, null); assert.equal(f.b.projectiles.list.length, 0);
});

test('ordinary and S1 use the current block count at release, with a one-victim zero-block floor', () => {
  for (const active of [false, true]) for (const count of [0, 1, 2, 3]) {
    const f = make(); for (let i = 0; i < 4; i++) enemy(f);
    enter(f); if (active) cast(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    f.b.addBuff(f.u, { key: 'fixture:block', mods: { blockCnt: count - 3 } });
    near(f.u.s.blockCnt, count);
    until(f, () => f.attacks.length === 1);
    assert.equal(f.hits.length, Math.max(1, count));
    if (active) assert.equal(f.u.skill.ammoLeft, 99);
  }
});

test('owner death preserves only already born grenades and releases source hooks afterward', () => {
  const f = make({ skill: 2 }); wall(f, 1); enemy(f, { forward: 2 }); enter(f); cast(f);
  until(f, () => f.births.length === 2);
  f.b.dealDamage(null, f.u, { amount: 1e6, type: 'true' });
  assert.equal(f.u.alive, false); assert.equal(f.controller.stopped, true);
  advance(f.b, 5);
  assert.equal(f.births.length, 2); assert.equal(f.stops.length, 2); assert.equal(f.hits.length, 2);
  assert.equal(f.controller.finishHook, null); assert.equal(f.controller.handles.length, 0);
});
