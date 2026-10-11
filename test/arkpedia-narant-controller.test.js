// SPDX-License-Identifier: GPL-3.0-or-later
// Private phase fixtures alongside separate public build/deployment checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NARANT_ID } from '../server/sim/content/arkpedia-narant-projectiles.js';
import { prepareNarantKit } from '../server/sim/content/arkpedia-narant.js';

const contracts = () => ({ controller: {
  phasePolicy: 'source-clips-local-v1', entrance: 'whole-source-start-clip',
  attackPost: 'max-interval-clip-and-return', skillTransitions: 'whole-source-begin-and-end-clips',
  invalidInput: 'captured-position-for-s3-only',
  reviewNote: 'Explicit fixture phase and captured-input mapping; no native frame parity claim',
} });
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) < tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const until = (f, predicate, seconds = 5) => {
  const limit = f.b.time + seconds;
  while (!predicate() && f.b.time < limit) advance(f.b, f.b.dt);
  assert.ok(predicate(), 'Expected controller condition before timeout');
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', supplied = contracts() } = {}) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_narant_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillId: id, skillRank: rank };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: NARANT_ID, charId: NARANT_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    skill: { ...level, ...level.spData, skillId: id, rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const prepared = prepareNarantKit(b, u, { contracts: supplied });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  assert.equal(b._deploy(u, { initial: false }), true);
  const hits = [], attacks = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  return { b, u, ...prepared, hits, attacks, level };
}
function enemy(f, { x, y, fly = false } = {}) {
  const points = { RIGHT: [5, 1], LEFT: [3, 1], UP: [4, 2], DOWN: [4, 0] };
  const [dx, dy] = points[f.u.dir], e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x ?? dx; e.y = y ?? dy;
  Object.assign(e.base, { maxHp: 1e7, atk: 1000, def: 0, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}
const enter = f => until(f, () => f.controller.phase?.kind !== 'entrance');
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };
const skillHits = (f, mode) => f.hits.filter(h => h.dmg?.tags.includes(`narant:s${mode}`));

test('incomplete skill/build/contracts fail before owned hooks or talent buffs are installed', () => {
  assert.throws(() => make({ supplied: null }), /phase contracts/);
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    for (const change of [
      d => { d.raw.arkpedia.skillRank = 0; }, d => { d.raw.arkpedia.skillId = 'wrong'; },
      d => { d.raw.arkpedia.elite = 0; }, d => { d.raw.arkpedia.potential = 7; },
      d => { d.raw.arkpedia.level = 100; }, d => { d.raw.arkpedia.module = 'native-module'; },
      d => { d.skill.spCost = 0; }, d => { d.skill.initSp = 999; },
      d => { d.skill.spType = 'hurt'; }, d => { d.skill.maxCharges = 2; },
      d => { d.skill.duration = 777; }, d => { d.skill.bb.extra = 1; },
      d => { d.skill.skillType = 'AUTO'; }, d => { d.skill.rangeGrid = [[0, 1]]; },
      d => { d.rangeGrid = [[0, 0]]; },
    ]) {
      const d = structuredClone(f.u.def); change(d);
      const u = f.b._makeAlly(f.u.player, d, 'op', 2, 4);
      const handles = Object.values(f.b._hooks).flat().length;
      assert.throws(() => prepareNarantKit(f.b, u, { contracts: contracts() }));
      assert.equal(Object.values(f.b._hooks).flat().length, handles);
      assert.equal(u.mem.narantController, undefined);
      assert.equal(u.buffs.length, 0);
    }
  }
});

test('all thirty ranks and each unlocked promotion use selected SP, durations and talents', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = f.level;
    assert.equal(f.u.skill.spCost, s.spData.spCost); assert.equal(f.u.skill.spTotal, s.spData.initSp);
    assert.equal(f.u.skill.duration, s.duration); enter(f); cast(f);
    assert.equal(f.controller.mode, skill); assert.equal(f.u.skill.active, skill !== 1);
    assert.equal(f.u.skill.spec.manualCancel, false);
    advance(f.b, .25); enemy(f); until(f, () => f.attacks.length === 1);
    assert.equal(f.links.flight.mode, skill); assert.equal(f.u.stats.attacks, 1);
  }
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6]) {
    const f = make({ skill: elite + 1, rank: [4, 7, 10][elite], elite, potential });
    assert.equal(!!f.talents.steal, elite > 0); assert.equal(!!f.talents.evade, elite === 2);
    enter(f); cast(f); assert.equal(f.controller.mode, elite + 1);
  }
});

test('whole original Start excludes commands and attacks while natural SP still charges', () => {
  const f = make({ skill: 3 }); enemy(f); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
  assert.equal(f.u.skill.activate('fixture'), false); advance(f.b, .9);
  assert.equal(f.controller.phase.kind, 'entrance'); assert.equal(f.u.stats.attacks, 0);
  enter(f); assert.equal(f.u.skill.activate('fixture'), true);
  const time = make(); near(time.u.skill.spTotal, 0); advance(time.b, .9); near(time.u.skill.spTotal, .9);
});

test('ordinary attack releases at the original event and has one target with talent receipts', () => {
  const f = make({ skill: 2 }), a = enemy(f), z = enemy(f, { x: 5.2 }); enter(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, event = evidence.models[NARANT_ID].Front.eventPayloads.Attack[0].time;
  near(p.releaseAt - (p.readyAt - 1), event);
  advance(f.b, .5); assert.equal(f.attacks.length, 0); assert.equal(f.u.stats.attacks, 0);
  until(f, () => f.attacks.length === 1); assert.equal(f.links.flight.mode, 0);
  assert.equal(f.attacks[0].isSkill, false); assert.equal(f.u.skill.spTotal, 9);
  advance(f.b, .15); assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, a);
  near(z.hp, 1e7); assert.equal(f.talents.gains.atk, 25); assert.equal(f.talents.gains.def, 20);
});

test('all four facings choose source attack and skill Begin/Loop/End/Idle clips', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) for (const skill of [1, 2, 3]) {
    const f = make({ dir, skill }); enter(f); cast(f);
    const down = dir === 'DOWN' ? 'Down_' : '';
    assert.equal(f.u.mem.regularFormVisual.clip, skill === 1 ? 'Idle' : `Skill_${down}${skill}_Begin`);
    if (skill !== 1) { until(f, () => !f.controller.phase); assert.equal(f.u.mem.regularFormVisual.clip, `Skill_${down}${skill}_Idle`); }
    enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    assert.equal(f.u.mem.regularFormVisual.clip, skill === 1 ? `Skill_${down}1` : `Skill_${down}${skill}_Loop`);
    until(f, () => f.attacks.length === 1);
    if (skill !== 1) {
      f.u.skill.end('fixture'); assert.equal(f.u.mem.regularFormVisual.clip, `Skill_${down}${skill}_End`);
      until(f, () => f.controller.phase?.kind !== 'skill-end'); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
    }
  }
});

test('S1 switches both ways, preserves shortened rear-inclusive range and recovers time SP in either stance', () => {
  for (const elite of [0, 1, 2]) {
    const f = make({ elite, rank: [4, 7, 10][elite] }); enter(f);
    const range = structuredClone(f.u.rangeGrid); cast(f);
    assert.equal(f.u.skill.active, false); assert.equal(f.controller.mode, 1);
    assert.equal(f.u.rangeGrid.length, range.length - 3);
    assert.ok(f.u.rangeGrid.every(([, c]) => c !== 3));
    assert.equal(f.u.rangeGrid.some(([, c]) => c === -1), elite > 0);
    advance(f.b, f.u.skill.spCost + .1); assert.equal(f.u.skill.ready, true); assert.equal(f.controller.mode, 1);
    assert.equal(f.u.skill.activate('fixture'), true); assert.equal(f.controller.mode, 0);
    assert.deepEqual(f.u.rangeGrid, range); advance(f.b, f.u.skill.spCost + .1); assert.equal(f.u.skill.ready, true);
  }
});

test('S1 rejects the removed far column, reaches a flying near victim and bounces without extra attacks', () => {
  const f = make(); enter(f); cast(f); enemy(f, { x: 7, y: 1 }); advance(f.b, 1.5);
  assert.equal(f.attacks.length, 0);
  enemy(f, { fly: true }); enemy(f, { x: 5.6 }); until(f, () => f.attacks.length === 1);
  until(f, () => skillHits(f, 1).length === 4); assert.equal(f.attacks.length, 1);
  assert.equal(f.attacks[0].isSkill, true);
});

test('S2 receives one attack SP at a legal ordinary birth, none on return or during its timed skill', () => {
  const f = make({ skill: 2 }); enemy(f); enter(f);
  until(f, () => f.attacks.length === 1); assert.equal(f.u.skill.spTotal, 9);
  advance(f.b, .4); assert.equal(f.hits.length, 1); assert.equal(f.u.skill.spTotal, 9);
  cast(f); near(f.u.skill.timeLeft, f.level.duration); near(f.u.skill.spTotal, 0);
  until(f, () => f.attacks.length === 2); assert.equal(f.links.flight.mode, 2);
  advance(f.b, .75); assert.equal(skillHits(f, 2).length, 1);
  assert.ok(f.hits.some(h => h.dmg.tags.includes('narant:s2-return'))); near(f.u.skill.spTotal, 0);
});

test('timed skills can activate without enemies; Begin blocks another command and all attacks', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); enter(f); cast(f);
    assert.equal(f.controller.phase.kind, 'skill-begin'); assert.equal(f.u.skill.activate('fixture'), false);
    enemy(f); advance(f.b, .1); assert.equal(f.attacks.length, 0);
    until(f, () => f.controller.phase?.kind === 'attack');
    assert.equal(f.attacks.length, 0); until(f, () => f.attacks.length === 1);
  }
});

test('S3 births all three source variants but emits one attack event and one attack statistic', () => {
  const f = make({ skill: 3 }); enter(f); cast(f); enemy(f);
  until(f, () => f.attacks.length === 1);
  assert.deepEqual(f.b.projectiles.list.map(p => p.data.narantVariant),
    ['projectile_chr_narant_s3', 'projectile_chr_narant_s3_1', 'projectile_chr_narant_s3_2']);
  assert.equal(f.u.stats.attacks, 1); assert.equal(f.attacks[0].isSkill, true);
  advance(f.b, .5); assert.equal(skillHits(f, 3).length, 3);
  assert.equal(f.attacks.length, 1); near(f.u.skill.spTotal, 0);
});

test('S3 dead/hidden/new-life inputs use the captured point even with beforeAttack hooks', () => {
  for (const invalid of ['dead', 'hidden', 'life']) {
    const f = make({ skill: 3 }); enter(f); cast(f);
    const e = enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    const saved = { ...f.controller.phase.input };
    f.b.on('beforeAttack', () => {});
    if (invalid === 'dead') e.alive = false;
    if (invalid === 'hidden') e.hidden = true;
    if (invalid === 'life') e.deploySeq++;
    e.x = 7; e.y = 3;
    until(f, () => f.attacks.length === 1);
    assert.equal(f.b.projectiles.list.length, 3);
    for (const p of f.b.projectiles.list) {
      assert.equal(p.target, null); near(p.tx, saved.x); near(p.ty, saved.y);
    }
    advance(f.b, .8); assert.equal(skillHits(f, 3).length, 0); near(e.hp, 1e7);
    assert.equal(f.links.canAttack(), true);
  }
});

test('lost ordinary/S1/S2 victims neither retarget nor recover SP or count a failed attack', () => {
  for (const mode of [0, 1, 2]) {
    const f = make({ skill: mode || 2 }); enter(f); if (mode) cast(f);
    enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    f.controller.phase.target.hidden = true; const sp = f.u.skill.spTotal;
    advance(f.b, .9); assert.equal(f.attacks.length, 0); assert.equal(f.u.stats.attacks, 0);
    assert.equal(f.b.projectiles.list.length, 0);
    if (f.u.skill.spType === 'attack') near(f.u.skill.spTotal, sp);
  }
});

test('beforeAttack cancellation/removal cannot be undone by S3 captured-position fallback', () => {
  for (const action of ['remove', 'replace', 'control']) {
    const f = make({ skill: 3 }); enter(f); cast(f); enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    const other = enemy(f, { x: 6 });
    f.b.on('beforeAttack', ctx => {
      if (action === 'remove') ctx.targets = [];
      if (action === 'replace') ctx.targets = [other];
      if (action === 'control') f.b.applyStatus(f.u, 'stun', { source: other, duration: 1 });
    });
    advance(f.b, .5); assert.equal(f.attacks.length, 0); assert.equal(f.u.stats.attacks, 0);
    assert.equal(f.b.projectiles.list.length, 0);
  }
});

test('ASPD above native max scale does not skip the full clip; negative ASPD slows its event', () => {
  for (const aspd of [200, -50]) {
    const f = make({ skill: 2 }); enter(f);
    f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } }); enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase, start = p.startedAt, speed = aspd > 0 ? 1 : .5;
    near(f.u.mem.regularFormVisual.speed, speed);
    near(p.releaseAt - start, .5333333611488342 / speed);
    near(p.readyAt - start, 1 / speed);
    until(f, () => f.attacks.length === 1); advance(f.b, .2);
    assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.spTotal, 9);
  }
});

test('return travel owns the attack gate beyond the full clip, including S3 final return', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); enter(f); if (skill === 3) cast(f); enemy(f, { x: 7 });
    f.b.projectiles.registerSpeedAura({ owner: f.u, contains: () => true, scale: .2 });
    until(f, () => f.attacks.length === 1);
    advance(f.b, 1.5); assert.equal(f.attacks.length, 1); assert.equal(f.links.canAttack(), false);
    until(f, () => f.attacks.length === 2, 8); assert.equal(f.u.stats.attacks, 2);
  }
});

test('mode switching cancels unfired ordinary windup but keeps a born old blade until return', () => {
  for (const born of [false, true]) {
    const f = make(); enter(f); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    if (born) until(f, () => f.attacks.length === 1);
    const flight = f.links.flight; cast(f);
    assert.equal(f.controller.mode, 1); assert.equal(f.controller.phase, null);
    if (born) {
      assert.equal(f.links.flight, flight); advance(f.b, .2);
      assert.equal(f.attacks.length, 1); assert.equal(f.links.flight.mode, 0);
      until(f, () => f.attacks.length === 2); assert.equal(f.links.flight.mode, 1);
    } else { until(f, () => f.attacks.length === 1); assert.equal(f.links.flight.mode, 1); }
  }
});

test('control cancels an unfired event, including transient control between ticks, but retains born blades', () => {
  for (const transient of [false, true]) {
    const f = make({ skill: 2 }); enter(f); const e = enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    f.b.applyStatus(f.u, 'stun', { source: e, duration: 1 });
    if (transient) f.b.removeBuff(f.u, 'stun');
    advance(f.b, .6); assert.equal(f.attacks.length, 0); assert.equal(f.u.skill.spTotal, 8);
  }
  const f = make({ skill: 2 }); enter(f); const e = enemy(f);
  until(f, () => f.attacks.length === 1); const flight = f.links.flight;
  f.b.applyStatus(f.u, 'stun', { source: e, duration: 2 }); advance(f.b, .5);
  assert.equal(flight.complete, true); assert.equal(f.hits.length, 1); assert.equal(f.u.skill.spTotal, 9);
  assert.equal(f.attacks.length, 1);
});

test('skill expiry wins over a pending release; whole End holds every SP source and new commands', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); enter(f); cast(f); enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    const release = f.controller.phase.releaseAt;
    f.u.skill.timeLeft = release - f.b.time; // Deliberately align this boundary fixture.
    until(f, () => f.controller.phase?.kind === 'skill-end');
    assert.equal(f.attacks.length, 0); assert.equal(f.b.projectiles.list.length, 0);
    assert.equal(f.u.s.flags.noSp, true); assert.equal(f.u.skill.gainSp(20, 'fixture'), 0);
    assert.equal(f.u.skill.activate('fixture', { free: true }), false);
    until(f, () => f.controller.phase?.kind !== 'skill-end'); assert.equal(!!f.u.s.flags.noSp, false);
    near(f.u.skill.spTotal, 0); advance(f.b, .1);
    if (skill === 3) assert.ok(f.u.skill.spTotal > 0); else near(f.u.skill.spTotal, 0);
  }
});

test('withdrawal cleans controller/talents and unfired commands; born blades still finish once', () => {
  for (const skill of [1, 2, 3]) for (const born of [false, true]) {
    const f = make({ skill }); enter(f); cast(f); enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack');
    if (born) until(f, () => f.attacks.length === 1);
    f.b.retreat(f.u);
    assert.equal(f.controller.stopped, true); assert.equal(f.controller.handles.length, 0);
    assert.equal(f.talents.handles.length, 0); assert.equal(f.u.mem.regularFormVisual, null);
    assert.equal(f.u.skill.active, false); advance(f.b, 1.1);
    assert.equal(f.attacks.length, born ? 1 : 0);
    assert.equal(f.b.projectiles.list.length, 0); assert.deepEqual(f.talents.gains, { atk: 0, def: 0 });
    assert.equal(f.hits.some(h => h.dmg.tags.includes('narant:s3-return')), false);
  }
});

test('battle end is idempotent and cannot leave an SP hold or an owned runtime hook', () => {
  const f = make({ skill: 3 }); enter(f); cast(f); f.u.skill.end('fixture');
  assert.equal(f.u.s.flags.noSp, true); f.b.emit('battleEnd', {}); f.controller.stop();
  assert.equal(f.controller.handles.length, 0); assert.equal(f.talents.handles.length, 0);
  assert.equal(!!f.u.s.flags.noSp, false); assert.equal(f.u.mem.regularFormVisual, null);
});

test('public runtime review leaves native frame and module fidelity explicitly unclaimed', () => {
  assert.ok(data.operators[NARANT_ID]);
  assert.deepEqual(evidence.enabledOperators, [NARANT_ID]); assert.deepEqual(evidence.heldOperators, []);
  assert.equal(evidence.frameParity, false); assert.equal(evidence.moduleSupport, false);
});
