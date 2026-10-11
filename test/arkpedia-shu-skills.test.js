// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { SHU_ID, selectedShuBuild } from '../server/sim/content/arkpedia-shu.js';
import { prepareShuSkills, SHU_SKILL_CONTRACT } from '../server/sim/content/arkpedia-shu-skills.js';
import { compileRoute } from '../server/sim/ai.js';
import { crossedRootTiles, observeEnemyMove } from '../server/sim/movement-observer.js';

const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
const live = u => u.alive && u.deployed;
function step(f, seconds = f.b.dt) {
  for (let i = 0; i < Math.ceil(seconds / f.b.dt - 1e-9); i++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
function until(f, cond, seconds = 12) {
  const end = f.b.time + seconds;
  while (!cond() && f.b.time < end) step(f);
  assert.ok(cond(), `Missing condition at ${f.b.time}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', contract = SHU_SKILL_CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: source.tables.character.phases[elite].maxLevel, potential, trust: 0,
    skillRank: rank, skillId: `skchr_shu_${skill}` };
  const r = selectedShuBuild(build), c = source.tables.character;
  const def = normalizeChess({ chessId: SHU_ID, charId: SHU_ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, tags: r.tags,
    rangeGrid: r.rangeGrid, talents: r.talents, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: source.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) } });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareShuSkills(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  u.player.dp = 99; assert.ok(b._deploy(u, { initial: false }));
  const heals = [], damage = [], teleports = [], attacks = [];
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push({ ...ctx, time: b.time }); });
  b.on('damaged', ctx => { if (ctx.source === u) damage.push({ ...ctx, time: b.time }); });
  b.on('shuTeleport', ctx => teleports.push({ ...ctx, time: b.time }));
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  return { b, u, d, heals, damage, teleports, attacks, ...prepared };
}
function ally(f, { row = 5, col = 6, ratio = .2, kind = 'op', flags = {}, id = 'char_196_sunbr' } = {}) {
  const def = normalizeChess(recordFor(defaultBuild(f.d.operators[id]), f.d));
  const a = f.b._makeAlly(f.u.player, def, kind, row, col, { dir: 'RIGHT' });
  f.b._setupUnit(a, { trait: { noAttack: true }, talents: [], skill: { kind: 'instant', trigger: 'NEVER' } });
  assert.ok(f.b._deploy(a, { initial: false }));
  f.b.addBuff(a, { key: 'fixture:flags', flags: { noHpRecovery: true, ...flags } });
  a.hp = a.s.maxHp * ratio; return a;
}
function enemy(f, { row = 5, col = 5, fly = false, flags = {} } = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 1e7, atk: 0, def: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = e.s.maxHp;
  if (fly) e.motion = 'FLY';
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return e;
}
function cast(f) { f.u.skill.addCharge(1); assert.equal(f.u.skill.activate(), true); }
function move(f, e, r, c) {
  const from = { x: e.x, y: e.y }; e.x = c; e.y = r;
  observeEnemyMove(f.b, e, from, 'fixture'); f.b._buildEnemyIndex();
}
function sow(f, r = 7, c = 7) {
  const a = ally(f, { row: r, col: c }); f.b.heal(f.u, a, 1); return a;
}

test('skill bridge requires exact source contract and does not enable Shu in the public dataset', () => {
  assert.throws(() => make({ contract: { ...SHU_SKILL_CONTRACT } }), /contract/);
  assert.equal(data.operators[SHU_ID], undefined); assert.deepEqual(source.enabledOperators, []);
});

for (const skill of [1, 2, 3]) test(`Shu S${skill}: all ten source ranks preserve SP, charges, duration and modifiers`, () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = source.tables.skills[`skchr_shu_${skill}`].levels[rank - 1];
    near(f.u.skill.spCost, s.spData.spCost); near(f.u.skill.maxCharges, s.spData.maxChargeTime);
    if (skill === 1) step(f, 1.1);
    ally(f);
    const atk = f.u.s.atk; cast(f);
    if (skill > 1) {
      near(f.u.s.atk, atk * (1 + f.record.bb.atk)); near(f.u.skill.timeLeft, s.duration);
      assert.equal(f.u.skill.gainSp(50, 'gift'), 0);
      until(f, () => f.heals.length > 0);
      near(f.heals[0].amount, atk * (1 + f.record.bb.atk));
      f.u.skill.end('manual'); step(f, .6); near(f.u.s.atk, atk);
    } else {
      assert.equal(f.u.skill.active, false); assert.equal(f.u.s.flags.noSp, true);
      until(f, () => f.heals.length > 0); near(f.heals[0].amount, atk * f.record.bb.heal_scale);
    }
  }
});

test('S1 includes exactly half HP, keeps its original input and observes the original capped heal clock', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }); step(f, 1.1);
    const input = ally(f, { ratio: .5 }), other = ally(f, { col: 4, ratio: .8 });
    f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 100 } });
    cast(f); const p = f.controller.phase;
    near(p.releaseAt - f.b.time, .5333333611488342); near(f.u.mem.regularFormVisual.speed, 1);
    input.hp = input.s.maxHp; other.hp = other.s.maxHp * .1;
    until(f, () => f.heals.length > 0);
    assert.equal(f.heals[0].target, input); assert.equal(f.heals.length, 1);
    assert.equal(f.controller.tiles.has(f.b.grid.key(5, 6)), true);
    assert.equal(f.u.skill.gainSp(1), 0);
    until(f, () => !f.u.s.flags.noSp); assert.ok(f.u.skill.gainSp(1) > 0);
  }
});

test('S1 rejects healthy/no-heal/isolated targets without spending SP and cannot cast during Born', () => {
  const f = make(), a = ally(f, { ratio: .5 });
  f.u.skill.addCharge(1); const initial = f.u.skill.spTotal;
  assert.equal(f.u.skill.activate(), false); near(f.u.skill.spTotal, initial);
  a.hp = a.s.maxHp * .501; step(f, 1.1);
  assert.equal(f.u.skill.activate(), false);
  a.hp = a.s.maxHp * .1;
  for (const flags of [{ healFree: true }, { noHeal: true }, { isolated: true }, { untargetable: true }]) {
    f.b.addBuff(a, { key: 'fixture:reject', flags });
    assert.equal(f.u.skill.activate(), false); f.b.removeBuff(a, 'fixture:reject');
  }
  near(f.u.skill.spTotal, initial + 1.1, .06);
});

test('S1 refunds a dead input once; hidden/stale inputs and interrupted casts do not redirect or refund', () => {
  const f = make(); step(f, 1.1); const a = ally(f), other = ally(f, { col: 4 });
  cast(f); const before = f.u.skill.spTotal;
  f.b.kill(a, null); until(f, () => f.controller.phase?.released);
  near(f.u.skill.spTotal, before + f.u.skill.spCost); assert.equal(f.heals.length, 0);
  assert.ok(other.hp < other.s.maxHp);
  for (const alter of [a => { a.hidden = true; }, a => { a.deploySeq++; },
    (_a, g) => g.b.applyStatus(g.u, 'stun', { duration: .05, source: null })]) {
    const g = make(); step(g, 1.1); const input = ally(g); cast(g); alter(input, g); step(g, .8);
    assert.equal(g.heals.length, 0); assert.equal(g.u.skill.charges, 0);
  }
});

test('S1 slow healing delays the native hit, and automatic charges fire when a valid ally arrives', () => {
  const f = make(); f.b.addBuff(f.u, { key: 'fixture:slow', mods: { aspd: -50 } });
  until(f, () => f.u.skill.ready); assert.equal(f.u.skill.activations, 0);
  const a = ally(f); step(f);
  assert.equal(f.u.skill.activations, 1); near(f.u.mem.regularFormVisual.speed, .5);
  step(f, .9); assert.equal(f.heals.length, 0); until(f, () => f.heals.length > 0);
  assert.equal(f.heals[0].target, a);
});

test('S2 uses two injured CAST recipients, ATK percentage, additive BAT and extra block', () => {
  const f = make({ skill: 2 }); const a = ally(f), z = ally(f, { col: 4, ratio: .3 });
  ally(f, { row: 6, col: 5, ratio: .4 }); enemy(f);
  const baseBlock = f.u.s.blockCnt, baseBat = f.u.s.bat; cast(f);
  near(f.u.s.bat, baseBat + 1.3); near(f.u.s.blockCnt, baseBlock + 1);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  until(f, () => f.controller.phase?.kind === 'heal');
  const p = f.controller.phase; near(p.releaseAt - (p.readyAt - f.u.s.interval), .5333333611488342);
  near(f.u.mem.regularFormVisual.speed, 1);
  a.hp = a.s.maxHp; // legal overheal still sows original CAST input
  until(f, () => f.heals.length === 2);
  assert.deepEqual(f.heals.map(h => h.target), [a, z]); assert.equal(f.damage.length, 0);
  // Shu plus three Guardians satisfy the independent same-class ASPD talent.
  near(f.u.s.aspd, 112); near(f.u.s.interval, 2.5 / 1.12);
  assert.ok(f.controller.tiles.has(f.b.grid.key(5, 6)));
});

test('S2 refreshes existing Sowing and Sanctuary at start/end without stacking or healing modifiers', () => {
  const f = make({ skill: 2, potential: 5 }), a = sow(f, 5, 6);
  const key = `shu:sowing:sanctuary:${f.u.id}`;
  near(a.s.hpRegen, 75); near(a.findBuff(key).data.value, .12);
  cast(f); near(a.s.hpRegen, 112.5); near(a.findBuff(key).data.value, .18);
  assert.equal(a.buffs.filter(b => b.key === key).length, 1);
  f.u.skill.end('manual'); near(a.s.hpRegen, 75); near(a.findBuff(key).data.value, .12);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_End');
  step(f, .5); assert.equal(f.skills.sowingScale, 1);
});

test('manual timed skills allow no targets and during Born; silence permits them, control rejects them', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); f.b.applyStatus(f.u, 'silence', { source: null, duration: 9 }); cast(f);
    assert.equal(f.u.skill.active, true); assert.equal(f.u.mem.regularFormVisual.clip, `Skill_${skill}_Begin`);
    step(f, 1); assert.equal(f.heals.length + f.damage.length, 0);
    const g = make({ skill }); g.b.applyStatus(g.u, 'stun', { source: null, duration: 1 });
    g.u.skill.addCharge(1); assert.equal(g.u.skill.activate(), false);
  }
});

test('S2 ending releases only excess block capacity', () => {
  const f = make({ skill: 2 }); cast(f);
  const targets = Array.from({ length: 4 }, () => enemy(f)); step(f, .1);
  assert.equal(f.u.blocking.length, 4); f.u.skill.end('manual'); step(f);
  assert.equal(f.u.blocking.length, 3); assert.equal(targets.filter(t => t.blockedBy === f.u).length, 3);
});

test('S3 attacks one ground target and independently heals even when Physical damage is dodged', () => {
  const f = make({ skill: 3 }), a = ally(f); const e = enemy(f); enemy(f);
  f.b.addBuff(e, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
  cast(f); const atk = f.u.s.atk; until(f, () => f.heals.length > 0);
  assert.equal(f.heals[0].target, a); near(f.heals[0].amount, atk);
  assert.equal(e.hp, e.s.maxHp); assert.equal(f.damage.length, 0);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Attack_1');
  assert.equal(f.controller.phase.target, e);
  assert.equal(f.attacks.length, 1); assert.equal(f.attacks[0].isSkill, true);
  assert.deepEqual(f.attacks[0].targets, [e]);
});

test('S3 all ranks retain single Physical damage, current release ATK and accepted attack receipts', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }); ally(f); enemy(f); enemy(f); cast(f);
    until(f, () => f.controller.phase?.kind === 'skill-attack');
    f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .3 } });
    const atk = f.u.s.atk; until(f, () => f.damage.length > 0);
    assert.equal(f.damage.length, 1); assert.equal(f.damage[0].type, 'phys');
    near(f.damage[0].amount, atk); near(f.heals[0].amount, atk);
    assert.equal(f.attacks.length, 1); assert.equal(f.u.stats.attacks, 1);
    assert.equal(f.damage[0].dmg.attackId > 0, true);
  }
});

test('S3 CAST targets can change at the strike; external beforeAttack cancellation also cancels its callback', () => {
  const f = make({ skill: 3 }); ally(f); const e = enemy(f); const z = enemy(f); cast(f);
  until(f, () => f.controller.phase?.kind === 'skill-attack'); f.b.kill(e, null);
  until(f, () => f.damage.length > 0); assert.equal(f.damage[0].target, z);
  const g = make({ skill: 3 }); ally(g); enemy(g); cast(g);
  g.b.on('beforeAttack', ctx => { if (ctx.attacker === g.u) ctx.targets = []; });
  step(g, 2); assert.equal(g.damage.length + g.heals.length + g.attacks.length, 0);
});

test('S2 retains only its primary input; other CAST recipients are refreshed at the strike', () => {
  const f = make({ skill: 2 }); const primary = ally(f), old = ally(f, { col: 4, ratio: .3 });
  const next = ally(f, { row: 6, col: 5, ratio: .8 }); cast(f);
  until(f, () => f.controller.phase?.kind === 'heal'); primary.hp = primary.s.maxHp; old.hp = old.s.maxHp;
  next.hp = next.s.maxHp * .1; until(f, () => f.heals.length >= 2);
  assert.deepEqual(f.heals.map(h => h.target), [primary, next]);
});

test('S3 heals without an enemy, uses its expanded range and never targets flying/stealthed bodies', () => {
  const f = make({ skill: 3 }), a = ally(f, { row: 5, col: 7 });
  enemy(f, { fly: true }); enemy(f, { flags: { stealth: true, unblockable: true } });
  cast(f); until(f, () => f.heals.length > 0);
  assert.equal(f.heals[0].target, a); assert.equal(f.damage.length, 0);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Attack_2');
});

test('S3 enemy aura is capped once, includes isolated tokens and rejects devices/out-of-range recipients', () => {
  const f = make({ skill: 3 }); sow(f);
  const a = ally(f, { col: 6, kind: 'token', flags: { isolated: true, healFree: true, untargetable: true } });
  const device = ally(f, { row: 4, col: 5, kind: 'device' });
  const outside = ally(f, { row: 1, col: 1 }); const before = a.s.atk, aspd = a.s.aspd;
  const e = enemy(f, { row: 7, col: 7, flags: { stealth: true, invulnerable: true, untargetable: true } });
  enemy(f, { row: 7, col: 7 }); const fly = enemy(f, { row: 7, col: 7, fly: true });
  cast(f); near(a.s.atk, before * 1.25); near(a.s.aspd, aspd + 25);
  assert.equal(device.findBuff(f.skills.auraKey), null); assert.equal(outside.findBuff(f.skills.auraKey), null);
  assert.equal(f.skills.inside.size, 2); assert.equal(f.skills.marks.has(e), true);
  assert.equal(f.skills.marks.has(fly), false);
  f.u.skill.end('manual'); near(a.s.atk, before); near(a.s.aspd, aspd);
});

test('S3 marks retain first entry across leave/reentry and teleport at Manhattan GE rather than Euclidean distance', () => {
  const f = make({ skill: 3 }); sow(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
  const m = f.skills.marks.get(e); assert.deepEqual([m.r, m.c], [7, 7]);
  move(f, e, 7, 8); assert.equal(f.teleports.length, 0);
  move(f, e, 8, 8); assert.equal(f.teleports.length, 1); assert.deepEqual([e.y, e.x], [7, 7]);
  assert.equal(f.skills.marks.get(e), m);
  move(f, e, 7, 8); move(f, e, 7, 7); assert.equal(f.skills.marks.get(e), m);
  move(f, e, 7, 9); assert.equal(f.teleports.length, 2);
});

test('S3 aura counts current sowed-tile occupants while persistent marks survive leaving', () => {
  const f = make({ skill: 3, rank: 1 }); sow(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
  assert.equal(f.skills.inside.size, 1); move(f, e, 8, 8);
  assert.equal(f.skills.inside.size, 0); assert.equal(f.skills.marks.has(e), true);
  assert.equal(f.u.findBuff(f.skills.auraKey), null); move(f, e, 9, 9);
  assert.equal(f.teleports.length, 1); assert.deepEqual([e.y, e.x], [7, 7]);
});

test('S3 separate mark/teleport immunity and non-displacement immunity follow source rules', () => {
  const f = make({ skill: 3 }); sow(f);
  const markImmune = enemy(f, { row: 7, col: 7 }); f.b.addBuff(markImmune, { key: 'immune_shu_blink' });
  const actionImmune = enemy(f, { row: 7, col: 7 });
  actionImmune.def = { ...actionImmune.def, immune: new Set(['be_teleported']) };
  const staticEnemy = enemy(f, { row: 7, col: 7, flags: { noDisplace: true } }); cast(f);
  assert.equal(f.skills.marks.has(markImmune), false); assert.equal(f.skills.marks.has(actionImmune), true);
  move(f, actionImmune, 7, 9); assert.equal(actionImmune.x, 9);
  move(f, staticEnemy, 7, 9); assert.equal(staticEnemy.x, 7);
});

test('removing mark immunity while staying on a sowed tile does not create a late entry mark', () => {
  const f = make({ skill: 3 }); sow(f); const e = enemy(f, { row: 7, col: 7 });
  f.b.addBuff(e, { key: 'immune_shu_blink' }); cast(f); f.b.removeBuff(e, 'immune_shu_blink'); step(f);
  assert.equal(f.skills.marks.has(e), false); move(f, e, 8, 8); move(f, e, 7, 8);
  assert.deepEqual([f.skills.marks.get(e).r, f.skills.marks.get(e).c], [7, 8]);
});

test('S3 checks forced displacement before later movement can carry a mark past the threshold', () => {
  const f = make({ skill: 3 }); sow(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
  f.b.displace(e, { x: 1, y: 0 }, 6);
  assert.equal(f.teleports.length, 1); assert.deepEqual([e.y, e.x], [7, 7]);
  assert.equal(e.route.pts, null);
});

test('S2/S3 duration expiry cancels an unfinished hit and restores ordinary combat and SP recovery', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); ally(f); cast(f); step(f, f.record.source.duration + .6);
    assert.equal(f.u.skill.active, false); assert.equal(f.skills.marks.size, 0);
    assert.equal(f.skills.aura.size, 0); assert.ok(f.u.skill.spTotal > 0);
    near(f.u.s.atk, f.u.base.atk); near(f.u.s.bat, f.u.base.bat);
    enemy(f); until(f, () => f.damage.length > 0); assert.equal(f.damage.at(-1).dmg.isSkill, false);
  }
});

test('S3 teleport retains blocked relation, current leg, completed checkpoints, wait and speed', () => {
  const f = make({ skill: 3 }); sow(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
  const a = ally(f, { row: 8, col: 9 }); e.blockedBy = a; a.blocking.push(e);
  Object.assign(e.route, { legIdx: 2, waitLeft: 1.5, pts: [{ x: 11, y: 7 }] });
  const speed = e.s.moveSpeed; move(f, e, 7, 9);
  assert.equal(e.blockedBy, a); assert.ok(a.blocking.includes(e));
  assert.equal(e.route.legIdx, 2); assert.equal(e.route.waitLeft, 1.5); assert.equal(e.route.pts, null);
  near(e.s.moveSpeed, speed);
});

test('S3 observes fast route crossing before an exit and does not skip a sowed tile or threshold', () => {
  const f = make({ skill: 3 }); sow(f);
  const e = enemy(f, { row: 7, col: 4 }); cast(f); f.b.removeBuff(e, 'fixture:pin');
  e.profile.noAttack = true; e.base.moveSpeed = 200; e.markDirty();
  e.route.legs = compileRoute({ checkpoints: [{ type: 'MOVE', pos: [7, 5] }], end: [7, 20] }); e.route.legIdx = 0;
  step(f);
  assert.equal(e.alive, true); assert.equal(f.teleports.length, 1);
  assert.deepEqual([e.y, e.x], [7, 6]); assert.equal(e.route.legIdx, 1);
  assert.equal(f.b.leakedCount, 0); assert.equal(e.route.pts, null);
});

test('S3 disappearance removes marks immediately, and reappearance anchors a fresh mark', () => {
  const f = make({ skill: 3 }); sow(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
  const mark = f.skills.marks.get(e); f.b._setHidden(e, true);
  assert.equal(f.skills.marks.has(e), false); assert.equal(f.skills.inside.size, 0);
  f.b._setHidden(e, false); step(f);
  assert.notEqual(f.skills.marks.get(e), mark); assert.equal(f.skills.marks.has(e), true);
});

test('S3 source finish/death clears marks, aura and hooks and cancels pending attack/heal releases', () => {
  for (const action of ['end', 'retreat']) {
    const f = make({ skill: 3 }); sow(f); ally(f); const e = enemy(f, { row: 7, col: 7 }); cast(f);
    until(f, () => f.controller.phase?.kind === 'heal'); const initial = f.heals.length;
    if (action === 'end') f.u.skill.end('manual'); else f.b.retreat(f.u, { permanent: true });
    assert.equal(f.skills.marks.size, 0); assert.equal(f.skills.aura.size, 0);
    move(f, e, 7, 12); step(f, .7); assert.equal(f.teleports.length, 0); assert.equal(f.heals.length, initial);
    if (action === 'retreat') assert.equal(f.skills.handles.length, 0);
  }
});

test('root tracing covers reverse and diagonal movement without phantom edge roots', () => {
  assert.deepEqual([...crossedRootTiles({ x: 2, y: 2 }, { x: 5, y: 2 })], [[2, 2], [2, 3], [2, 4], [2, 5]]);
  assert.deepEqual([...crossedRootTiles({ x: 5, y: 2 }, { x: 2, y: 2 })], [[2, 5], [2, 4], [2, 3], [2, 2]]);
  assert.deepEqual([...crossedRootTiles({ x: 2, y: 2 }, { x: 4, y: 4 })], [[2, 2], [3, 3], [4, 4]]);
  assert.deepEqual([...crossedRootTiles({ x: 2.5, y: 2 }, { x: 2.4, y: 2 })], [[2, 3], [2, 2]]);
});
