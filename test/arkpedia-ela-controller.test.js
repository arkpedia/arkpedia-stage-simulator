// SPDX-License-Identifier: GPL-3.0-or-later
// Private original-source fixtures. No public roster/build/asset claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { absoluteRangeKeys } from '../server/sim/targeting.js';
import { ELA_ID, ELA_INFLUENCE } from '../server/sim/content/arkpedia-ela-mines.js';
import { prepareElaKit, ELA_OWNER_CONTRACT, selectedElaCritical } from '../server/sim/content/arkpedia-ela.js';

const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, predicate, seconds = 5) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), `Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT',
  contract = ELA_OWNER_CONTRACT, battle = null, defer = false } = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_ela_${skill}`;
  const build = { elite, potential, level: phase.maxLevel, skillId: id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = evidence.tables.skills[id].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: ELA_ID, charId: ELA_ID, name: c.name,
    stats: phase.attributesKeyFrames.at(-1).data, profession: c.profession, position: c.position,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id,
      rangeGrid: level.rangeId ? evidence.tables.ranges[level.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareElaKit(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => { assert.equal(b._deploy(u, { initial: false }), true); b.addDp('arkpedia', 99); };
  if (!defer) deploy();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  return { b, u, build, level, deploy, hits, attacks, ...prepared, deck: prepared.controller.deck };
}
function enemy(f, { x, y, fly = false, def = 0, area = null } = {}) {
  const points = { RIGHT: [6, 5], LEFT: [4, 5], UP: [5, 6], DOWN: [5, 4] };
  const [dx, dy] = points[f.u.dir], e = f.b.spawnEnemy('enemy_1007_slime', { pos: [y ?? dy, x ?? dx] });
  Object.assign(e.base, { maxHp: 1e7, atk: 500, def, res: 0, moveSpeed: 0 });
  e.hp = 1e7; if (fly) e.motion = 'FLY'; if (area) e.hitArea = area;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  e.markDirty(); void e.s; f.b._buildEnemyIndex(); return e;
}
const enter = f => until(f, () => f.controller.phase?.kind !== 'entrance');
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };
const skillHits = f => f.hits.filter(h => h.dmg.tags.includes(`ela:s${f.record.index + 1}`));

test('incomplete source builds and phase contracts fail without installing a mine deck or hooks', () => {
  assert.throws(() => make({ contract: null }), /phase contracts/);
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    for (const change of [
      d => { d.raw.arkpedia.skillRank = 0; }, d => { d.raw.arkpedia.level = 91; },
      d => { d.raw.arkpedia.potential = 7; }, d => { d.raw.arkpedia.module = 'mod'; },
      d => { d.raw.arkpedia.skillId = 'wrong'; }, d => { d.skill.spCost = 0; },
      d => { d.skill.initSp = 999; }, d => { d.skill.spType = 'hurt'; },
      d => { d.skill.maxCharges = 2; }, d => { d.skill.duration = 999; },
      d => { d.skill.bb.extra = 1; }, d => { d.skill.skillType = 'PASSIVE'; },
      d => { d.skill.rangeGrid = [[9, 9]]; }, d => { d.rangeGrid = [[0, 0]]; },
    ]) {
      const def = structuredClone(f.u.def); change(def);
      const u = f.b._makeAlly(f.u.player, def, 'op', 5, 9);
      const hooks = Object.values(f.b._hooks).flat().length, state = f.b.regularSummons.get(`summon:${ELA_ID}`);
      assert.throws(() => prepareElaKit(f.b, u, { contract: ELA_OWNER_CONTRACT }));
      assert.equal(Object.values(f.b._hooks).flat().length, hooks);
      assert.equal(f.b.regularSummons.get(`summon:${ELA_ID}`), state);
    }
  }
});

test('promotion and potential select Bullseye independently from mine supply', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const f = make({ elite, potential });
    assert.equal(f.deck.state.stock, elite + 1 + (potential >= 3 ? 1 : 0));
    assert.deepEqual(selectedElaCritical(f.build), elite === 2
      ? { atk_scale: potential >= 5 ? 1.6 : 1.5, prob: .3 } : null);
  }
});

test('all thirty ranks retain selected SP, duration, range, modifiers and ammo', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }); enter(f);
    assert.equal(f.u.skill.spType, skill === 2 ? 'attack' : 'time');
    assert.equal(f.u.skill.spCost, f.level.spData.spCost); near(f.u.skill.initSp, f.level.spData.initSp);
    const atk = f.u.s.atk, def = f.u.s.def, interval = f.u.s.interval, range = structuredClone(f.u.rangeGrid);
    cast(f);
    if (skill === 1) { assert.equal(f.deck.state.stock, 4); assert.equal(f.u.skill.active, false); }
    if (skill === 2) {
      near(f.u.s.def, def * (1 + f.u.def.skill.bb.def)); assert.equal(f.u.skill.timeLeft, f.level.duration);
      assert.deepEqual(f.u.rangeKeys, absoluteRangeKeys(f.u.def.skill.rangeGrid, f.u.tileR, f.u.tileC, f.u.dir));
    }
    if (skill === 3) {
      near(f.u.s.atk, atk * (1 + f.u.def.skill.bb.atk)); near(f.u.s.interval, interval + f.u.def.skill.bb.base_attack_time);
      assert.equal(f.u.skill.ammoLeft, 40); assert.deepEqual(f.u.rangeGrid, range);
    }
  }
});

test('ordinary fire waits for entrance/Begin then follows original Loop events in all four facings', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }); const e = enemy(f), hp = e.hp;
    f.b.rng = () => .99;
    advance(f.b, .9); assert.equal(f.attacks.length, 0); near(e.hp, hp);
    until(f, () => f.controller.phase?.kind === 'attack-begin');
    assert.equal(f.u.mem.regularFormVisual.clip, 'Attack_Begin'); assert.equal(f.attacks.length, 0);
    until(f, () => f.attacks.length === 1);
    assert.equal(f.u.mem.regularFormVisual.clip, dir === 'DOWN' ? 'Attack_Down_Loop' : 'Attack_Loop');
    until(f, () => f.hits.length === 1); near(f.hits[0].amount, f.u.s.atk);
    assert.equal(f.attacks[0].targets.length, 1);
  }
});

test('ordinary shot hits one enemy rather than leaking into S2 splash or S3 ammo', () => {
  const f = make(), a = enemy(f), z = enemy(f, { x: 6.1 }); f.b.rng = () => .99;
  until(f, () => f.hits.length === 1);
  assert.equal(f.attacks.length, 1); assert.equal(f.u.stats.attacks, 1);
  near(a.hp + z.hp, 2e7 - f.u.s.atk); assert.equal(f.u.skill.ammoLeft, 0);
});

test('S1 recharges without an enemy, pauses at capacity, and resumes after paid placement', () => {
  const f = make({ potential: 3 }); enter(f);
  advance(f.b, 2); near(f.u.skill.sp, 0); assert.equal(f.u.skill.activations, 0);
  f.deck.place(5, 9); assert.equal(f.u.s.flags.noSp, undefined);
  until(f, () => f.u.skill.activations === 1, 19);
  assert.equal(f.deck.state.stock, 4); near(f.u.skill.sp, 0); assert.equal(f.attacks.length, 0);
  advance(f.b, 2); near(f.u.skill.sp, 0);
});

test('only accepted ordinary attacks recharge S2 attack SP; S2 splash does not recharge it', () => {
  const f = make({ skill: 2 }); enter(f); enemy(f); enemy(f, { x: 6.1 }); f.b.rng = () => .99;
  const sp = f.u.skill.sp;
  until(f, () => f.attacks.length === 1); near(f.u.skill.sp, sp + 1);
  cast(f); assert.equal(f.u.skill.sp, 0);
  until(f, () => skillHits(f).length === 2);
  near(f.u.skill.sp, 0); assert.equal(f.attacks.length, 2);
});

test('S2 splash uses source stop clock, captured point, selected penetration and eligible bodies', () => {
  const f = make({ skill: 2 }); enter(f); f.b.rng = () => .99; cast(f);
  const target = enemy(f, { def: 1000 }), area = enemy(f, { x: 6.8, def: 1000, fly: true });
  const camou = enemy(f, { x: 6.3, def: 1000 }), hidden = enemy(f, { x: 6.4 }), outside = enemy(f, { x: 7.11 });
  f.b.addBuff(camou, { key: 'fixture:camou', flags: { camou: true } });
  f.b.addBuff(hidden, { key: 'fixture:stealth', flags: { stealth: true } });
  until(f, () => f.attacks.length === 1);
  assert.equal(skillHits(f).length, 0); const atk = f.u.s.atk;
  target.x = 10; f.b._buildEnemyIndex(); advance(f.b, .11);
  assert.equal(skillHits(f).length, 2);
  for (const hit of skillHits(f)) near(hit.amount, atk - 200);
  assert.ok(skillHits(f).some(h => h.target === area)); assert.ok(skillHits(f).some(h => h.target === camou));
  near(target.hp, 1e7); near(hidden.hp, 1e7); near(outside.hp, 1e7);
});

test('S2 expiry restores range/DEF, recharges one mine and holds SP during source End', () => {
  const f = make({ skill: 2 }); enter(f);
  const range = structuredClone(f.u.rangeGrid), def = f.u.s.def; f.deck.state.stock = 0;
  cast(f); until(f, () => !f.u.skill.active, 21);
  assert.equal(f.deck.state.stock, 1); assert.equal(f.controller.phase.kind, 'skill-end');
  assert.deepEqual(f.u.rangeGrid, range); near(f.u.s.def, def); assert.equal(f.u.s.flags.noSp, true);
  assert.equal(f.u.skill.activate('fixture', { free: true }), false);
  until(f, () => f.controller.phase?.kind !== 'skill-end'); assert.equal(!!f.u.s.flags.noSp, false);
});

test('Bullseye uses a marker from any source without spending RNG; P5 changes its scale', () => {
  for (const potential of [1, 5]) {
    const f = make({ potential }), e = enemy(f);
    f.b.addBuff(e, { key: ELA_INFLUENCE, source: { id: 'other-ela' }, duration: 10 });
    let rolls = 0; f.b.rng = () => { rolls++; return .99; };
    until(f, () => f.hits.length === 1);
    near(f.hits[0].amount, f.u.s.atk * (potential === 5 ? 1.6 : 1.5)); assert.equal(rolls, 0);
  }
});

test('unmarked critical chance rolls once per ordinary output, with no talent at E1', () => {
  for (const [elite, roll, scale] of [[2, .29, 1.5], [2, .3, 1], [1, .1, 1]]) {
    const f = make({ elite }); enemy(f); let rolls = 0;
    f.b.rng = () => { rolls++; return roll; }; until(f, () => f.hits.length === 1);
    near(f.hits[0].amount, f.u.s.atk * scale); assert.equal(rolls, elite === 2 ? 1 : 0);
  }
});

test('ordinary critical and ATK are sampled at impact, while S3 preserves their born values', () => {
  for (const skill of [1, 3]) {
    const f = make({ skill }); enter(f); const e = enemy(f, { x: 7 }); f.b.rng = () => .99;
    if (skill === 3) cast(f);
    until(f, () => f.attacks.length === 1); const bornAtk = f.u.s.atk;
    f.b.addBuff(e, { key: ELA_INFLUENCE, source: f.u, duration: 10 });
    f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: 1 } });
    until(f, () => f.hits.length === 1);
    near(f.hits[0].amount, skill === 3 ? bornAtk : f.u.s.atk * 1.5);
  }
});

test('S3 prefers any influenced enemy while preserving core blocker priority', () => {
  const f = make({ skill: 3 }); enter(f); const first = enemy(f), influenced = enemy(f, { x: 6.5 });
  f.b.addBuff(influenced, { key: ELA_INFLUENCE, source: { id: 'other' }, duration: 30 });
  cast(f); until(f, () => f.attacks.length === 1);
  assert.deepEqual(f.attacks[0].targets, [influenced]);
  first.blockedBy = f.u;
  until(f, () => f.attacks.length === 2); assert.deepEqual(f.attacks[1].targets, [first]);
});

test('all forty S3 births consume exactly one round; last cached shot survives skill End', () => {
  const f = make({ skill: 3 }); enter(f); enemy(f, { x: 7 }); f.b.rng = () => .99;
  f.deck.state.stock = 0; const amounts = [], ammo = [];
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u && f.u.skill.active) amounts.push(f.u.s.atk); });
  f.b.on('ammoUsed', ctx => { if (ctx.unit === f.u) ammo.push(ctx.left); });
  cast(f); until(f, () => !f.u.skill.active, 30);
  assert.equal(f.attacks.length, 40); assert.equal(amounts.length, 40); assert.equal(ammo.length, 40);
  assert.deepEqual(ammo, Array.from({ length: 40 }, (_, i) => 39 - i));
  assert.equal(f.deck.state.stock, 2); assert.equal(f.controller.phase.kind, 'skill-end');
  until(f, () => skillHits(f).length === 40);
  for (let i = 0; i < 40; i++) near(skillHits(f)[i].amount, amounts[i]);
});

test('S3 manual cancel discards unused rounds, adds two mines and cannot refill beyond capacity', () => {
  const f = make({ skill: 3 }); enter(f); f.deck.state.stock = 1; cast(f);
  f.b.bench[ELA_ID] = { unit: f.u };
  assert.equal(f.b.activateOperator(ELA_ID), true);
  assert.equal(f.u.skill.ammoLeft, 0); assert.equal(f.u.skill.active, false); assert.equal(f.deck.state.stock, 3);
  until(f, () => f.controller.phase?.kind !== 'skill-end'); cast(f); f.u.skill.end('manual');
  assert.equal(f.deck.state.stock, 4);
});

test('invalid input life, leaving range or control cancels unborn attacks without SP/ammo', () => {
  for (const failure of ['life', 'range', 'stun', 'disarm']) {
    const f = make({ skill: 2 }); enter(f); const e = enemy(f);
    const sp = f.u.skill.sp; until(f, () => f.controller.phase?.kind === 'attack-begin');
    if (failure === 'life') e.deploySeq++;
    if (failure === 'range') { e.x = 18; f.b._buildEnemyIndex(); }
    if (failure === 'stun') f.b.applyStatus(f.u, 'stun', { duration: 1 });
    if (failure === 'disarm') f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
    advance(f.b, .3); assert.equal(f.attacks.length, 0); near(f.u.skill.sp, sp);
  }
  const f = make({ skill: 3 }); enter(f); enemy(f); cast(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.b.applyStatus(f.u, 'stun', { duration: 1 }); advance(f.b, .3);
  assert.equal(f.attacks.length, 0); assert.equal(f.u.skill.ammoLeft, 40);
});

test('beforeAttack cancellation does not create a projectile, spend ammunition or recharge SP', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); enter(f); enemy(f); if (skill === 3) cast(f);
    const sp = f.u.skill.sp, ammo = f.u.skill.ammoLeft;
    f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets = []; });
    advance(f.b, 2); assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0);
    assert.equal(f.u.stats.attacks, 0); near(f.u.skill.sp, sp); assert.equal(f.u.skill.ammoLeft, ammo);
  }
});

test('born ordinary/S2/S3 output survives withdrawal but cannot hit a new life of its trace target', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); enter(f); const e = enemy(f, { x: skill === 2 ? 6 : 7 }); f.b.rng = () => .99;
    if (skill > 1) cast(f); until(f, () => f.attacks.length === 1);
    f.b.retreat(f.u); until(f, () => f.hits.length === 1);
    assert.equal(f.controller.stopped, true); assert.equal(f.deck.valid(), false);
    assert.equal(f.deck.state.stock, 3);
    const old = f.hits[0].amount; assert.ok(old > 0);
  }
  const f = make({ skill: 3 }); enter(f); const e = enemy(f, { x: 7 }); cast(f);
  until(f, () => f.attacks.length === 1); e.deploySeq++; advance(f.b, .2);
  assert.equal(f.hits.length, 0);
});

test('mine influence and shared Fragile feed S3 cached critical without separate mine damage', () => {
  const f = make({ skill: 3 }); enter(f); f.deck.place(5, 7);
  f.b.addBuff(f.u, { key: 'fixture:wait', flags: { disarm: true } });
  const e = enemy(f, { x: 8.2 }); until(f, () => !!e.findBuff(ELA_INFLUENCE));
  assert.equal(f.hits.length, 0); f.b.removeBuff(f.u, 'fixture:wait');
  e.x = 7; f.b._buildEnemyIndex(); cast(f); const atk = f.u.s.atk;
  f.b.rng = () => .99; until(f, () => skillHits(f).length === 1);
  near(skillHits(f)[0].amount, atk * 1.5 * 1.35);
  assert.equal(f.hits.length, 1);
});

test('owner cleanup cannot refill a later deployment and battle finish prevents pending impacts', () => {
  const f = make({ skill: 3 }); enter(f); enemy(f, { x: 7 }); cast(f);
  until(f, () => f.attacks.length === 1); f.b.kill(f.u);
  const fresh = make({ skill: 3, battle: f.b }); assert.notEqual(fresh.u, f.u);
  assert.equal(f.deck.recharge(2), false); assert.equal(fresh.deck.state.stock, 3);
  advance(f.b, .2); assert.equal(fresh.deck.state.stock, 3); assert.equal(fresh.hits.length, 0);
  const g = make({ skill: 2 }); enter(g); enemy(g); cast(g);
  until(g, () => g.attacks.length === 1); g.b.finished = true; g.b.emit('battleEnd', {});
  advance(g.b, .2); assert.equal(g.hits.length, 0); assert.equal(g.controller.stopped, true);
});

test('S2 checks Bullseye independently for every splash recipient and awards one attack identity', () => {
  const f = make({ skill: 2 }); enter(f); cast(f);
  const marked = enemy(f), unmarked = enemy(f, { x: 6.5 });
  f.b.addBuff(marked, { key: ELA_INFLUENCE, source: unmarked, duration: 10 });
  let rolls = 0; f.b.rng = () => { rolls++; return .99; };
  until(f, () => skillHits(f).length === 2);
  near(skillHits(f).find(h => h.target === marked).amount, f.u.s.atk * 1.5);
  near(skillHits(f).find(h => h.target === unmarked).amount, f.u.s.atk);
  assert.equal(rolls, 1); assert.equal(f.attacks.length, 1); assert.equal(f.u.stats.attacks, 1);
  assert.equal(new Set(skillHits(f).map(h => h.dmg.attackId)).size, 1);
});

test('S3 cached critical survives marker expiry while target Fragile stays an impact-time modifier', () => {
  const f = make({ skill: 3 }); enter(f); const e = enemy(f, { x: 7 });
  f.b.addBuff(e, { key: ELA_INFLUENCE, source: f.u, duration: 10 });
  f.b.applyStatus(e, 'fragile', { source: f.u, value: .35, duration: 10 });
  cast(f); let rolls = 0; f.b.rng = () => { rolls++; return .99; };
  until(f, () => f.attacks.length === 1); const atk = f.u.s.atk;
  f.b.removeBuff(e, ELA_INFLUENCE);
  f.b.removeBuff(e, 'fragile'); near(e.s.dmgTakenMul, 1);
  f.u.skill.end('manual'); until(f, () => skillHits(f).length === 1);
  near(skillHits(f)[0].amount, atk * 1.5); assert.equal(rolls, 0);
});

test('S2 target selection uses its reduced range but splash still reaches eligible huge bodies', () => {
  const f = make({ skill: 2 }); enter(f);
  const far = enemy(f, { x: 8 }); cast(f); advance(f.b, 1.4);
  assert.equal(f.attacks.length, 0); near(far.hp, 1e7);
  const trace = enemy(f), huge = enemy(f, { x: 8, area: { w: 2, h: 1, dx: 0, dy: 0 } });
  until(f, () => skillHits(f).length >= 2);
  assert.equal(f.attacks[0].targets[0], trace);
  assert.ok(skillHits(f).some(h => h.target === huge)); assert.equal(skillHits(f).some(h => h.target === far), false);
});

test('skill switching invalidates an ordinary Begin without giving it an attack-SP or damage receipt', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); enter(f); enemy(f); f.b.rng = () => .99;
    until(f, () => f.controller.phase?.kind === 'attack-begin'); cast(f);
    assert.equal(f.controller.phase.kind, 'skill-begin'); assert.equal(f.attacks.length, 0);
    until(f, () => f.attacks.length === 1);
    assert.equal(f.attacks[0].isSkill, true); near(f.u.skill.sp, 0);
    if (skill === 3) assert.equal(f.u.skill.ammoLeft, 39);
  }
});

test('living control leaves S3 ammo and mine triggers intact; owner removal never recharges an active skill', () => {
  const f = make({ skill: 3 }); enter(f); cast(f); f.deck.place(5, 7);
  f.b.applyStatus(f.u, 'stun', { duration: 2 }); const e = enemy(f, { x: 8.2 });
  until(f, () => !!e.findBuff(ELA_INFLUENCE)); assert.equal(f.u.skill.ammoLeft, 40);
  assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0);
  const stock = f.deck.state.stock; f.b.kill(f.u); advance(f.b, 1);
  assert.equal(f.deck.state.stock, stock); assert.equal(f.u.skill.active, false);
  assert.equal(f.controller.stopped, true); assert.equal(f.deck.mines.size, 0);
});

test('S1 automatic supply preserves an ordinary command and its critical/damage output', () => {
  const f = make(); enter(f); enemy(f); f.b.rng = () => .99;
  until(f, () => f.controller.phase?.kind === 'attack-begin'); const command = f.controller.phase;
  f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, f.b.dt);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.deck.state.stock, 4);
  assert.equal(f.controller.phase, command); until(f, () => f.hits.length === 1);
  near(f.hits[0].amount, f.u.s.atk); assert.equal(f.attacks.length, 1);
});

test('source attack caching, original events and critical callbacks remain distinct from local phase choices', () => {
  const cs = evidence.characters[ELA_ID].flatMap(o => o.components);
  const get = id => cs.find(c => c.pathId === id).data;
  for (const [id, wait, cached, transfer] of [
    ['-5815782764201512154', 1, 0, 0], ['-7345763969213795546', 0, 0, 0],
    ['5400400117896966950', 0, 1, 1],
  ]) {
    const c = get(id); assert.equal(c._waitForAttackEvent, wait);
    assert.equal(c._useCachedAtkOnly, cached); assert.equal(c._transferSource, transfer);
    assert.equal(c._maxAnimScale, -1);
  }
  const events = evidence.models[ELA_ID].Front.eventPayloads;
  near(events.Die[0].time, .7666666507720947); assert.equal(events.Die[0].name, 'OnAttack');
  near(events.Start[0].time, .20000000298023224);
  const callbacks = evidence.templates.ela_t_2.eventToActions;
  assert.deepEqual(Object.keys(callbacks), ['ON_CALCULATE_DAMAGE', 'ON_CALCULATE_CACHED_PROJECTILE_DAMAGE']);
  for (const rows of Object.values(callbacks)) {
    assert.deepEqual(rows[0]._conditionNode._buffKeys, [ELA_INFLUENCE]);
    assert.equal(rows[0]._conditionNode._checkBuffSource, false);
    assert.equal(rows[0]._conditionNode._checkSourceHost, false);
    assert.equal(rows[0]._failNodes[0]._probKey, 'prob');
  }
  assert.deepEqual(evidence.enabledOperators, []); assert.match(ELA_OWNER_CONTRACT.reviewNote, /not implemented/);
});

test('single-target selection rejects unselectable enemies and reveals camouflage blocked by another ally', () => {
  for (const flag of ['camou', 'stealth', 'sleep', 'untargetable']) {
    const f = make(), e = enemy(f); f.b.rng = () => .99;
    f.b.addBuff(e, { key: 'fixture:concealed', flags: { [flag]: true } });
    advance(f.b, 1.5); assert.equal(f.attacks.length, 0);
    if (flag === 'camou') {
      const def = structuredClone(f.u.def); def.position = 'MELEE';
      const blocker = f.b._makeAlly(f.u.player, def, 'op', 5, 6);
      f.b._setupUnit(blocker, { trait: { noAttack: true }, skill: null });
      assert.equal(f.b._deploy(blocker, { initial: false }), true);
      e.blockedBy = blocker; blocker.blocking.push(e);
      until(f, () => f.hits.length === 1); near(f.hits[0].amount, f.u.s.atk);
    }
  }
});
