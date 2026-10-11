// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed real-engine fixtures bypass public registration. Explicit local
// contracts exercise controller lifetimes, not decoded native frame ordering.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { LEMUEN_ID } from '../server/sim/content/arkpedia-lemuen-links.js';
import { prepareLemuenKit } from '../server/sim/content/arkpedia-lemuen.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) < tolerance, `${a} != ${z}`);
const contracts = () => ({
  wanted: { wantedContract: 'continuous-union-v1', reviewNote: 'Explicit fixture union and strongest-source contract' },
  aiming: { firstCheck: 'immediate', boundary: 'expiry-before-trigger',
    isLethal: ({ unit, target, scale }) => unit.s.atk * scale > target.hp + target.s.def,
    reviewNote: 'Explicit fixture plain strict HP+DEF predicate; no native mitigation parity claim' },
  bombardment: { parentEvent: 'one-child-at-first-period', parentExpiry: 'before-period', childTravel: 'lifetime',
    sampleOffset: () => ({ x: 0, y: 0 }), reviewNote: 'Explicit deterministic fixture offset and callback/travel choices' },
  controller: { phasePolicy: 'source-clips-local-v1', s2AimStart: 'after-begin-clip',
    s3FirstMark: 'begin-plus-predelay', normalPost: 'max-interval-invalid-plus-minimum',
    s2Post: 'invalid-plus-minimum-and-clip', reviewNote: 'Explicit fixture event/post-delay/finish mapping' },
});
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const through = (f, at) => { while (f.b.time <= at + f.b.dt) advance(f.b, f.b.dt); };
function make({ skill = 1, rank = 10, dir = 'RIGHT', elite = 2, potential = 1, supplied = contracts() } = {}) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_lemuen_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: LEMUEN_ID, charId: LEMUEN_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    tags: [c.nationId],
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const prepared = prepareLemuenKit(b, u, { contracts: supplied });
  b._setupUnit(u, prepared.kit); assert.equal(b._deploy(u, { initial: false }), true); prepared.controller.install();
  const hits = [], attacks = [], ends = [];
  b.on('damaged', c => hits.push({ ...c, time: b.time }));
  b.on('attack', c => { if (c.attacker === u) attacks.push({ ...c, time: b.time }); });
  b.on('skillEnd', c => { if (c.unit === u) ends.push({ ...c, time: b.time }); });
  return { b, u, ...prepared, level, hits, attacks, ends };
}
const point = dir => ({ RIGHT: [5, 1], LEFT: [3, 1], UP: [4, 2], DOWN: [4, 0] })[dir];
function enemy(f, { x, y, hp = 1e7, def = 0, rank = 'NORMAL' } = {}) {
  const [dx, dy] = point(f.u.dir), e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x ?? dx; e.y = y ?? dy; e.def = { ...e.def, rank };
  Object.assign(e.base, { maxHp: hp, def, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } }); f.b._buildEnemyIndex(); return e;
}
const hits = (f, tag) => f.hits.filter(h => h.dmg?.tags.includes(`lemuen:${tag}`));
const ready = f => { advance(f.b, 1.1); };
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };
const spendTo = (f, n) => { while (f.ammo.current > n) f.ammo.consume(`fixture-preconsumed:${f.ammo.current}`); f.controller.syncAmmo(); };

test('controller refuses implicit phase/cast contracts and incomplete selected source records without leaking registrations', () => {
  assert.throws(() => make({ supplied: null }), /phase contracts/);
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    for (const change of [d => { d.raw.arkpedia.skillRank = 0; }, d => { d.skill.spCost = 0; },
      d => { d.skill.spType = 'hurt'; }, d => { d.skill.duration = 0; }, d => { d.skill.bb.extra = 1; },
      d => { d.skill.skillType = 'PASSIVE'; }, d => { d.skill.rangeGrid = [[0, 1]]; }]) {
      const def = structuredClone(f.u.def); change(def);
      const u = f.b._makeAlly(f.u.player, def, 'op', 2, 4);
      assert.throws(() => prepareLemuenKit(f.b, u, { contracts: contracts() }), /selected source/);
      assert.equal(u.mem.lemuenController, undefined);
    }
    const u = f.b._makeAlly(f.u.player, f.u.def, 'op', 2, 4);
    const c = contracts(); delete c[skill === 2 ? 'aiming' : skill === 3 ? 'bombardment' : 'controller'];
    const owners = f.b._lemuenWantedRegistry.owners.size;
    assert.throws(() => prepareLemuenKit(f.b, u, { contracts: c }), /contracts/);
    assert.equal(f.b._lemuenWantedRegistry.owners.size, owners);
  }
});
test('original entrance excludes attacks and activation; selected SP still recovers during entrance', () => {
  const f = make({ skill: 2 }); enemy(f); f.u.skill.setSpTotal(30);
  assert.equal(f.u.skill.activate('fixture'), false); advance(f.b, .8);
  assert.equal(f.controller.phase.kind, 'entrance'); assert.equal(f.attacks.length, 0);
  ready(f); assert.equal(f.u.skill.activate('fixture'), true);
});
test('all thirty selected ranks use their actual SP and ammunition through committed skill Begin phases', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), base = f.u.s.atk; ready(f); enemy(f);
    near(f.u.skill.spCost, f.level.spData.spCost); assert.equal(f.u.skill.manual, skill !== 1);
    cast(f); near(f.u.skill.spTotal, 0); assert.equal(f.ammo.current, f.level.blackboard.find(r => r.key === 'attack@trigger_time').value);
    assert.equal(f.u.skill.kind, 'ammo'); assert.equal(f.u.skill.timeLeft, Infinity);
    assert.equal(f.u.skill.gainSp(20, 'fixture'), 0); assert.equal(f.u.skill.ammoLeft, f.ammo.current);
    if (skill === 2) {
      near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk)); near(f.u.s.aspd, 100 + f.u.def.skill.bb.attack_speed);
      assert.equal(f.controller.phase, null);
    } else {
      assert.equal(f.controller.phase.kind, 'skill-begin'); assert.equal(skillHud(f.u.skill).canCancel, false);
      f.b.applyStatus(f.u, 'stun', { duration: .5 }); advance(f.b, .4);
      assert.equal(f.controller.phase, null); assert.equal(f.controller.mode, skill);
      assert.equal(f.ammo.current, f.ammo.base); assert.equal(f.attacks.length, 0);
    }
  }
});
test('ordinary attacks retain one victim, original Begin/Loop events and attack SP in all four facings', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }), e = enemy(f), other = enemy(f); ready(f);
    assert.equal(f.controller.phase.kind, 'attack-begin');
    assert.equal(f.u.mem.regularFormVisual.clip, dir === 'DOWN' ? 'Attack_Down_Begin' : 'Attack_Begin');
    advance(f.b, .3); const p = f.controller.phase;
    near(p.releaseAt - p.startedAt, .267 + .1666666716337204, .04);
    through(f, p.releaseAt + .2); assert.equal(f.attacks.length, 1); assert.equal(f.attacks[0].targets.length, 1);
    near(f.u.skill.spTotal, 1); assert.equal(hits(f, 'normal').length, 1); near(other.hp, 1e7); assert.ok(e.hp < 1e7);
  }
});
test('default and S1 release scales with ASPD while S2 fallback has the native animation cap', () => {
  for (const skill of [1, 2]) for (const aspd of [50, 200]) {
    const f = make({ skill }); ready(f);
    if (skill === 2) cast(f);
    f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd: aspd - f.u.s.aspd } }); enemy(f);
    advance(f.b, .1); const speed = skill === 2 ? Math.min(1, aspd / 100) : aspd / 100;
    near(f.u.mem.regularFormVisual.speed, speed); advance(f.b, .267 / speed + .1);
    near(f.controller.phase.releaseAt - f.controller.phase.intervalAt + f.u.s.interval, .1666666716337204 / speed);
  }
});
test('ready S1 activates automatically without a victim and does not recover attack SP during its skill volleys', () => {
  const f = make(); ready(f); f.u.skill.setSpTotal(8); advance(f.b, .1);
  assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.activations, 1);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Begin'); advance(f.b, .3);
  enemy(f); enemy(f); advance(f.b, .3);
  assert.equal(f.attacks.length, 1); assert.equal(f.ammo.current, 5); near(f.u.skill.spTotal, 0);
});
test('S1 fires at two distinct captured victims, spends one round and preserves both last-round projectiles', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }); ready(f); const a = enemy(f), z = enemy(f); enemy(f); cast(f); spendTo(f, 1);
    advance(f.b, .6); assert.equal(f.attacks.length, 1); assert.equal(f.attacks[0].targets.length, 2);
    assert.equal(new Set(f.attacks[0].targets).size, 2); assert.equal(hits(f, 's1').length, 2);
    assert.equal(f.ammo.current, 0); assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
    through(f, f.controller.phase.intervalAt + .05); assert.equal(f.u.skill.active, false);
    assert.equal(f.ends.length, 1); near(f.u.skill.spTotal, 0);
    near(1e7 - a.hp, f.u.base.atk * 2.1); near(1e7 - z.hp, f.u.base.atk * 2.1);
  }
});
test('a lost captured victim cannot retarget or consume S1 ammunition; surviving companion still spends only one', () => {
  for (const keepSecond of [false, true]) {
    const f = make(); ready(f); const a = enemy(f), z = enemy(f); cast(f); advance(f.b, .3);
    f.b.kill(a, null); if (!keepSecond) f.b.kill(z, null); const fresh = enemy(f);
    advance(f.b, .3); assert.equal(hits(f, 's1').length, keepSecond ? 1 : 0);
    assert.equal(f.ammo.current, keepSecond ? 5 : 6); near(fresh.hp, 1e7);
  }
});
test('ordinary wait-for-projectile plus post-delay cannot be shortened by a fast attack interval', () => {
  const f = make(); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e);
  f.b.addBuff(f.u, { key: 'fixture:haste', mods: { aspd: 900, batMul: .1 } }); advance(f.b, .2);
  assert.equal(f.attacks.length, 1); const p = f.controller.phase; assert.equal(p.projectiles.length, 1);
  through(f, p.intervalAt + .02); assert.equal(f.attacks.length, 1); assert.equal(p.invalidAt, undefined);
  while (p.invalidAt == null && f.b.time < 10) advance(f.b, f.b.dt);
  assert.ok(p.invalidAt != null); assert.equal(f.attacks.length, 1);
  while (f.b.time < p.invalidAt + .4) advance(f.b, f.b.dt);
  assert.equal(f.attacks.length, 1);
  through(f, p.invalidAt + .44999998807907104 + .1); assert.equal(f.attacks.length, 2);
});
test('S2 fallback attacks in ordinary range without spending a round or recovering SP; Wanted overrides fallback', () => {
  const f = make({ skill: 2 }); ready(f); const e = enemy(f); cast(f); advance(f.b, .7);
  assert.equal(hits(f, 'normal').length, 1); assert.equal(f.ammo.current, 7); near(f.u.skill.spTotal, 0);
  const wanted = enemy(f, { x: 20 }); f.talents.mark(wanted);
  through(f, f.controller.phase.intervalAt + .6);
  assert.equal(f.controller.phase.kind, 'aim');
  assert.equal(f.controller.aiming.state.target, wanted); assert.ok(e.hp < 1e7); assert.equal(f.ammo.current, 6);
});
test('S2 final round holds skill, selected ATK and all SP through aim, projectile flight and original End/post delay', () => {
  const f = make({ skill: 2 }); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e); cast(f); spendTo(f, 1);
  const atk = f.u.s.atk; advance(f.b, .5); assert.equal(f.controller.phase.kind, 'aim');
  assert.equal(f.ammo.current, 0); assert.equal(f.u.skill.active, true);
  advance(f.b, 3.6); const p = f.controller.phase; assert.equal(p.kind, 'aim-end');
  assert.equal(f.attacks.length, 1); assert.equal(p.projectiles.length, 1); assert.equal(p.result.checks, 14);
  near(p.result.currentValue, atk * 4.25); assert.equal(f.u.skill.gainSp(10, 'fixture'), 0);
  assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
  through(f, p.clipEnd); assert.equal(f.u.skill.active, true); assert.ok(p.invalidAt != null);
  through(f, p.invalidAt + 1.2000000476837158); assert.equal(f.u.skill.active, false);
  assert.notEqual(f.controller.phase?.kind, 'skill-end'); near(f.u.s.atk, f.u.base.atk);
  assert.ok(f.u.skill.spTotal > 0); assert.equal(!!f.u.s.flags.noSp, false); advance(f.b, 1.3);
  assert.ok(f.u.skill.spTotal > 0); assert.equal(f.ends.length, 1);
  near(hits(f, 's2')[0].amount, atk * 4.25 * 1.15);
});
test('S2 early lethal shot starts only after its facing-specific Begin and never spends a second round', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ skill: 2, dir }); ready(f); const e = enemy(f, { hp: 1 }); f.talents.mark(e); cast(f);
    advance(f.b, .1); const p = f.controller.phase; assert.equal(p.kind, 'aim-begin'); assert.equal(f.ammo.current, 7);
    near(p.readyAt - (f.b.time - .1), evidence.models[LEMUEN_ID][['UP','LEFT'].includes(dir)?'Back':'Front'].durations.Skill_2_Begin, .04);
    through(f, p.readyAt); assert.equal(f.controller.phase.kind, 'aim-end');
    assert.equal(f.controller.phase.result.reason, 'lethal'); assert.equal(f.controller.phase.result.checks, 0);
    assert.equal(f.ammo.current, 6); advance(f.b, .2); assert.equal(hits(f, 's2').length, 1);
  }
});
test('short control cancels an unborn S2 aim without refunding its accepted round or emitting stale output', () => {
  const f = make({ skill: 2 }); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e); cast(f); advance(f.b, .5);
  assert.equal(f.ammo.current, 6); f.b.applyStatus(f.u, 'stun', { duration: .0001 }); advance(f.b, .1);
  assert.equal(f.attacks.length, 0); assert.equal(f.controller.aiming.result.born, false);
  assert.equal(f.controller.aiming.effect, null); assert.equal(f.ammo.current, 6);
});
test('S3 selects at each predelay event, follows retained marks, spends every selected half-second and ends once', () => {
  const f = make({ skill: 3 }); ready(f); const a = enemy(f), z = enemy(f, { def: 10 }); cast(f);
  advance(f.b, .4); assert.equal(f.ammo.current, 5); assert.equal(f.controller.phase.kind, 'mark');
  // Native selectTargetTiming1 is mapped locally to selection at the .1 event.
  a.base.def = 20; a.markDirty(); advance(f.b, .1);
  assert.equal(f.controller.bombardment.marks[0].target, z);
  assert.equal(f.ammo.current, 4); assert.equal(f.attacks.length, 0); assert.equal(hits(f, 's3').length, 0);
  const first = f.b.time; advance(f.b, .5); assert.equal(f.ammo.current, 3); near(f.b.time - first, .5);
  advance(f.b, 1.6); assert.equal(f.ends.length, 1); assert.equal(f.controller.bombardment.emitted.length, 5);
  assert.equal(f.controller.phase.kind, 'skill-end'); assert.equal(f.u.skill.gainSp(10, 'fixture'), 0);
  advance(f.b, 2.4); assert.ok(hits(f, 's3').length > 0); assert.ok(f.u.skill.spTotal > 0);
});
test('S3 cannot activate without a legal victim and waits without wasting rounds when all current victims vanish', () => {
  const f = make({ skill: 3 }); ready(f); f.u.skill.setSpTotal(38);
  assert.equal(f.u.skill.activate('fixture'), false); near(f.u.skill.spTotal, 38);
  const e = enemy(f); assert.equal(f.u.skill.activate('fixture'), true); f.b.kill(e, null); advance(f.b, 3);
  assert.equal(f.u.skill.active, true); assert.equal(f.ammo.current, 5); assert.equal(f.ends.length, 0);
  enemy(f); advance(f.b, .3); assert.equal(f.ammo.current, 4);
});
test('manual S3 deactivation releases only accepted marks and keeps SP held through the original two-second End', () => {
  const f = make({ skill: 3 }); ready(f); enemy(f); cast(f); advance(f.b, 1);
  const bomb = f.controller.bombardment, count = bomb.marks.length; assert.ok(count > 0 && count < 5);
  assert.equal(skillHud(f.u.skill).canCancel, true); f.u.skill.end('manual');
  assert.equal(bomb.emitted.length, count); assert.equal(bomb.released, true);
  near(f.u.skill.spTotal, 0); advance(f.b, 1.8); near(f.u.skill.spTotal, 0);
  advance(f.b, .4); assert.ok(f.u.skill.spTotal > 0); assert.equal(f.ends.length, 1);
  assert.equal(bomb.emitted.filter(p => p.child).length, count);
});
test('manual S2 deactivation cancels unborn aim but born cached damage survives losing the skill modifiers', () => {
  for (const born of [false, true]) {
    const f = make({ skill: 2 }); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e); cast(f);
    const atk = f.u.s.atk; advance(f.b, born ? 4.1 : .5); f.u.skill.end('manual');
    assert.equal(f.ammo.active, false); near(f.u.s.atk, f.u.base.atk);
    advance(f.b, 3); assert.equal(hits(f, 's2').length, born ? 1 : 0);
    if (born) near(hits(f, 's2')[0].amount, atk * 4.25 * 1.15);
    assert.equal(f.ends.length, 1); assert.ok(f.u.skill.spTotal > 0);
  }
});
test('Talent2 increases next-cast capacity without refilling live ammo and its selected ATK remains after skill end', () => {
  const f = make({ skill: 2 }); ready(f); cast(f); spendTo(f, 3);
  advance(f.b, 19.1); assert.equal(f.ammo.maximum, 8); assert.equal(f.ammo.current, 3);
  assert.equal(f.u.skill.ammoLeft, 3); assert.equal(f.u.skill.ammoMax, 8);
  near(f.u.s.atk, f.u.base.atk * 1.8); f.u.skill.end('manual'); advance(f.b, 1.3);
  near(f.u.s.atk, f.u.base.atk * 1.1); cast(f); assert.equal(f.ammo.current, 8);
});
test('withdrawal removes unborn work, Wanted, ammunition, SP holds and listeners while emitted parents keep cached output', () => {
  for (const skill of [1, 2, 3]) for (const emitted of [false, true]) {
    const f = make({ skill }); ready(f); const e = enemy(f, { x: 5 }); f.talents.mark(e); cast(f);
    advance(f.b, skill === 3 ? .7 : .1);
    if (skill === 3 && emitted) f.u.skill.end('manual');
    const bomb = f.controller.bombardment; f.b.retreat(f.u); f.controller.stop(); f.controller.stop(); advance(f.b, 3);
    assert.equal(f.controller.stopped, true); assert.equal(f.talents.stopped, true); assert.equal(f.ammo.removed, true);
    assert.equal(f.b._lemuenWantedRegistry, undefined); assert.equal(f.u.mem.regularFormVisual, null);
    assert.equal(!!f.u.s.flags.noSp, false); assert.equal(f.controller.phase, null);
    assert.equal(f.attacks.length, 0); assert.equal(hits(f, 's3').length, skill === 3 && emitted ? bomb.emitted.length : 0);
  }
});


test('all thirty ranks complete whole real magazines once without preconsuming test rounds or double spending', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }); ready(f); const e = enemy(f);
    if (skill === 2) f.talents.mark(e);
    cast(f); const start = f.b.time, count = f.ammo.current, samples = [count];
    while (!f.ends.length && f.b.time < start + 180) {
      advance(f.b, f.b.dt);
      if (f.u.skill.active && samples.at(-1) !== f.ammo.current) samples.push(f.ammo.current);
    }
    assert.equal(f.ends.length, 1, `skill${skill} rank${rank}`);
    assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.active, false);
    assert.equal(f.ammo.active, false); assert.equal(samples[0], count);
    assert.ok(samples.every((v, i) => i === 0 || v === samples[i - 1] - 1), `skill${skill} rank${rank} samples${samples}`);
    if (skill === 3) {
      const parents = f.controller.bombardment.emitted;
      assert.equal(parents.length, count); assert.equal(f.attacks.length, 0);
      advance(f.b, 5); assert.equal(parents.filter(p => p.child).length, count);
      assert.equal(hits(f, 's3').length, count);
    } else {
      assert.equal(f.attacks.length, count); assert.equal(hits(f, `s${skill}`).length, count);
    }
    // Long casts can cross the real deployment talent deadline. Capacity grows
    // for the next cast but never silently adds a round to this magazine.
    if (f.talents.talent2Applied) assert.equal(f.ammo.maximum, f.ammo.base + 1);
  }
});
test('natural attack SP drives S1 activation and ordinary recovery resumes after its complete magazine', () => {
  const f = make(); enemy(f); const start = f.b.time;
  while (!f.u.skill.activations && f.b.time < start + 60) advance(f.b, f.b.dt);
  assert.equal(f.u.skill.activations, 1); assert.equal(hits(f, 'normal').length, 8);
  const count = f.ammo.current; assert.equal(count, 7); // the actual twenty-second talent already applied
  assert.equal(f.u.skill.spTotal, 0); const activatedAt = f.u.skill.lastStart;
  while (!f.ends.length && f.b.time < activatedAt + 60) advance(f.b, f.b.dt);
  assert.equal(hits(f, 's1').length, count); assert.equal(f.ends.length, 1); near(f.u.skill.spTotal, 0);
  advance(f.b, 4); assert.ok(f.u.skill.spTotal > 0); assert.equal(f.u.skill.activations, 1);
});
test('control after the final S1 birth cannot shorten its projectile and post-delay finish clock', () => {
  const f = make(); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e); cast(f); spendTo(f, 1);
  advance(f.b, .6); const p = f.controller.phase;
  assert.equal(f.attacks.length, 1); assert.equal(f.ammo.current, 0); assert.ok(f.controller.flying(p.projectiles));
  f.b.applyStatus(f.u, 'stun', { duration: 10 }); advance(f.b, .1);
  assert.equal(f.u.skill.active, true); assert.equal(f.controller.phase, p); near(f.u.skill.spTotal, 0);
  through(f, p.intervalAt); assert.equal(f.ends.length, 1); assert.equal(hits(f, 's1').length, 1);
});
test('fresh deployment owns new ammunition, skill SP, entrance and talent deadlines after retreat', () => {
  const old = make({ skill: 2 }); ready(old); const e = enemy(old); old.talents.mark(e); cast(old);
  advance(old.b, .5); old.b.retreat(old.u); assert.equal(old.ammo.removed, true);
  const u = old.b._makeAlly(old.u.player, old.u.def, 'op', 1, 4, { dir: 'RIGHT' });
  const fresh = prepareLemuenKit(old.b, u, { contracts: contracts() });
  old.b._setupUnit(u, fresh.kit); assert.equal(old.b._deploy(u, { initial: false }), true); fresh.controller.install();
  assert.notEqual(fresh.ammo, old.ammo); assert.equal(fresh.ammo.current, 0); assert.equal(fresh.ammo.maximum, 7);
  near(u.skill.spTotal, 15); near(fresh.talents.talent2At, old.b.time + 20);
  assert.equal(fresh.talents.hasWanted(e), false); assert.equal(fresh.controller.phase.kind, 'entrance');
  advance(old.b, .5); assert.equal(fresh.controller.phase.kind, 'entrance');
  assert.equal(fresh.controller.mode, 0); assert.equal(fresh.controller.aiming.busy, false);
});
test('S3 retained marks keep their last valid position through target loss and never follow a reborn life', () => {
  const f = make({ skill: 3 }); ready(f); const e = enemy(f); cast(f); advance(f.b, .6);
  const bomb = f.controller.bombardment; assert.equal(bomb.marks.length, 1);
  e.x = 6; advance(f.b, f.b.dt); assert.equal(bomb.marks[0].x, 6);
  f.b.kill(e, null); e.x = 8; e.deploySeq++; f.u.skill.end('manual');
  assert.equal(bomb.emitted.length, 1); assert.equal(bomb.emitted[0].x, 6);
});


test('S2 final born shot retains its finish wait through control without replaying the End clip at exhaustion', () => {
  const f = make({ skill: 2 }); ready(f); const e = enemy(f, { x: 20 }); f.talents.mark(e); cast(f); spendTo(f, 1);
  advance(f.b, 4.1); const p = f.controller.phase; assert.equal(p.kind, 'aim-end');
  f.b.applyStatus(f.u, 'stun', { duration: 10 }); advance(f.b, .1);
  assert.equal(f.controller.phase, p); assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
  while (!f.ends.length && f.b.time < 20) advance(f.b, f.b.dt);
  assert.equal(f.ends.length, 1); assert.equal(hits(f, 's2').length, 1);
  assert.notEqual(f.controller.phase?.kind, 'skill-end'); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
  assert.ok(f.u.skill.spTotal > 0);
});
test('S3 control pauses unpaid marking events without discarding existing managed marks or catching up a burst', () => {
  const f = make({ skill: 3 }); ready(f); enemy(f); cast(f); advance(f.b, .6);
  const bomb = f.controller.bombardment; assert.equal(bomb.marks.length, 1);
  f.b.applyStatus(f.u, 'stun', { duration: 2 }); advance(f.b, 1.8);
  assert.equal(f.ammo.current, 4); assert.equal(bomb.marks.length, 1); near(f.u.skill.spTotal, 0);
  advance(f.b, .6); assert.equal(f.ammo.current, 3); assert.equal(bomb.marks.length, 2);
});
test('controller acquires real Wanted from its selected deployment talent clock and then uses S2 global aiming', () => {
  const f = make({ skill: 2 }); const e = enemy(f, { rank: 'ELITE' });
  advance(f.b, 7.9); assert.equal(f.talents.hasWanted(e), false);
  advance(f.b, .3); assert.equal(f.talents.hasWanted(e), true);
  e.x = 9; f.b._buildEnemyIndex(); cast(f); advance(f.b, .5);
  assert.equal(f.controller.phase.kind, 'aim'); assert.equal(f.controller.aiming.state.target, e);
  assert.equal(f.ammo.current, 6); assert.ok(f.controller.aiming.effect);
});
test('captured ordinary targets cannot be replaced by a reborn deployment identity', () => {
  const f = make(); ready(f); const e = enemy(f); advance(f.b, .1);
  assert.equal(f.controller.phase.kind, 'attack-begin'); e.deploySeq++;
  advance(f.b, .6); assert.equal(f.attacks.length, 0); assert.equal(hits(f, 'normal').length, 0);
  near(f.u.skill.spTotal, 0);
});
