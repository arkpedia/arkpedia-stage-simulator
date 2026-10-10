// SPDX-License-Identifier: GPL-3.0-or-later
// Direct source-fed fixtures keep Nymph unregistered. S2 event policies are
// experimental alternatives under test, not recovered native event semantics.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NYMPH_ID } from '../server/sim/content/arkpedia-nymph-links.js';
import { prepareNymphKit, nymphCandidates } from '../server/sim/content/arkpedia-nymph.js';
import { bodyInKeys } from '../server/sim/body.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) < tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const through = (f, at) => { while (f.b.time <= at + f.b.dt) advance(f.b, f.b.dt); };
const position = dir => ({ RIGHT: [5, 1], LEFT: [3, 1], UP: [4, 2], DOWN: [4, 0] })[dir];
function make({ skill = 1, rank = 10, dir = 'RIGHT', eventIndex = 0, contract = true } = {}) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[2], id = `skchr_nymph_${skill}`;
  const build = { elite: 2, level: phase.maxLevel, potential: 1, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: NYMPH_ID, charId: NYMPH_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id,
      rangeGrid: level.rangeId ? evidence.tables.ranges[level.rangeId].grids.map(p => [p.row, p.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const prepared = prepareNymphKit(b, u, { s2Contract: contract ? {
    eventIndex, selectTarget: (battle, unit) => nymphCandidates(battle, unit)[0],
    reviewNote: 'EXPERIMENTAL fixture policy; native release/selector consumption remains unresolved',
  } : undefined });
  b._setupUnit(u, prepared.kit); assert.equal(b._deploy(u, { initial: false }), true);
  prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', c => hits.push({ ...c, time: b.time }));
  b.on('attack', c => { if (c.attacker === u) attacks.push({ ...c, time: b.time }); });
  return { b, u, ...prepared, hits, attacks, level };
}
function enemy(f, { x, y, res = 0 } = {}) {
  const [dx, dy] = position(f.u.dir);
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] }); e.x = x ?? dx; e.y = y ?? dy;
  Object.assign(e.base, { maxHp: 1e7, def: 0, res, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}
const hits = (f, tag) => f.hits.filter(h => h.dmg?.tags.includes(`nymph:${tag}`));
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost * f.u.skill.maxCharges);
  assert.equal(f.u.skill.activate('fixture'), true); };

test('S2 has no silent event/selector default and rejects incomplete experimental contracts', () => {
  assert.throws(() => make({ skill: 2, contract: false }), /explicit experimental/);
  for (const eventIndex of [-1, 2, .5, null])
    assert.throws(() => make({ skill: 2, eventIndex }), /explicit experimental/);
  const f = make({ skill: 2 });
  for (const s2Contract of [{ eventIndex: 0 }, { eventIndex: 1, selectTarget: () => null, reviewNote: '' }]) {
    const def = { ...f.u.def, skill: { ...f.u.def.skill, id: 'skchr_nymph_2' } };
    const u = f.b._makeAlly(f.u.player, def, 'op', 2, 4);
    assert.throws(() => prepareNymphKit(f.b, u, { s2Contract }), /explicit experimental/);
  }
});
test('incomplete or mismatched selected source records are rejected before controller installation', () => {
  const f = make({ skill: 3 });
  for (const change of [d => { d.raw.arkpedia.skillRank = 0; }, d => { d.skill.bb.atk = 99; },
    d => { d.skill.spCost = 0; }, d => { d.skill.duration = 0; },
    d => { d.skill.rangeGrid = []; }, d => { d.skill.maxCharges = 2; }]) {
    const def = structuredClone(f.u.def); change(def);
    const u = f.b._makeAlly(f.u.player, def, 'op', 2, 4);
    assert.throws(() => prepareNymphKit(f.b, u), /Incomplete Nymph selected source skill/);
    assert.equal(u.mem.nymphController, undefined);
  }
});
test('all thirty source selections retain actual SP, charge counts, duration and active modifiers', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), e = enemy(f), base = f.u.s.atk;
    near(f.u.skill.spTotal, f.level.spData.initSp); near(f.u.skill.spCost, f.level.spData.spCost);
    assert.equal(f.u.skill.maxCharges, f.level.spData.maxChargeTime);
    cast(f); near(f.u.skill.spTotal, (f.u.skill.maxCharges - 1) * f.u.skill.spCost);
    if (skill === 1) {
      near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk)); near(f.u.skill.timeLeft, f.level.duration);
    } else if (skill === 3) {
      near(f.u.s.atk, base); assert.equal(f.controller.phase.kind, 's3-begin');
      advance(f.b, .31); near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk));
      near(f.u.s.aspd, 100 + f.u.def.skill.bb.attack_speed);
      assert.ok(f.u.skill.timeLeft > f.level.duration - .1);
    } else {
      assert.equal(f.u.skill.kind, 'charges'); assert.equal(f.u.skill.pending, true);
      assert.equal(skillHud(f.u.skill).text, 'Skill casting');
      assert.equal(skillHud(f.u.skill).canActivate, false);
      assert.equal(f.u.skill.gainSp(10, 'fixture'), 0);
      const sp = f.u.skill.spTotal; advance(f.b, .6); near(f.u.skill.spTotal, sp);
      assert.equal(hits(f, 's2:direct').length, 1); assert.ok(e.findBuff('fear'));
      advance(f.b, .6); assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.pending, false);
      assert.ok(f.u.skill.spTotal > sp); assert.equal(!!f.u.s.flags.noSp, false);
    }
  }
});
test('normal attacks use one original event and one target in every literal facing', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }), e = enemy(f), other = enemy(f);
    advance(f.b, .2); const p = f.controller.phase;
    assert.equal(p.kind, 'attack'); near(p.releaseAt - .03333333333333333, .5333333611488342, .04);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
    advance(f.b, .3); assert.equal(f.attacks.length, 0);
    through(f, p.releaseAt + .15);
    assert.equal(f.attacks.length, 1); assert.equal(f.attacks[0].targets.length, 1);
    assert.equal(hits(f, 'normal').length, 1); near(e.elem.apoptosis, 0); near(other.hp, 1e7);
  }
});
test('native maximum animation scale caps fast release, while slow ASPD scales release and interval', () => {
  for (const aspd of [50, 100, 200, 300]) {
    const f = make(); enemy(f); f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd: aspd - 100 } });
    advance(f.b, .1); const p = f.controller.phase;
    near(f.u.mem.regularFormVisual.speed, Math.min(1, aspd / 100));
    near(p.releaseAt - .03333333333333333, .5333333611488342 / Math.min(1, aspd / 100), .04);
    through(f, p.releaseAt + .1); assert.equal(f.attacks.length, 1);
  }
});
test('fast attack cadence uses the selected interval, without waiting for the full capped visual clip', () => {
  for (const skill of [1, 3]) {
    const f = make({ skill }); enemy(f);
    if (skill === 3) cast(f); else f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 60 } });
    advance(f.b, 3.5); assert.equal(f.attacks.length, 3);
    near(f.attacks[1].time - f.attacks[0].time, 1, f.b.dt * 1.01);
    near(f.attacks[2].time - f.attacks[1].time, 1, f.b.dt * 1.01);
  }
});
test('an invalid captured ordinary target cannot fabricate an accepted attack or silently retarget the cast', () => {
  const f = make(), dead = enemy(f), other = enemy(f); advance(f.b, .2);
  assert.equal(f.controller.phase.targets[0], dead); f.b.kill(dead, null);
  advance(f.b, .6); assert.equal(f.attacks.length, 0); assert.equal(f.u.stats.attacks, 0);
  near(other.hp, 1e7); advance(f.b, 1.5); assert.equal(f.attacks.length, 1);
  assert.equal(f.attacks[0].targets[0], other);
});
test('S1 enters and leaves without resetting an unfinished ordinary attack; birth selects current mode', () => {
  for (const ends of [false, true]) {
    const f = make(), e = enemy(f); advance(f.b, .2); const p = f.controller.phase;
    cast(f); assert.equal(f.controller.phase, p); assert.equal(f.controller.mode, 1);
    if (ends) f.u.skill.end('fixture');
    assert.equal(f.controller.phase, p); through(f, p.releaseAt + .2);
    assert.equal(hits(f, ends ? 'normal' : 's1').length, 1);
    if (ends) near(e.elem.apoptosis, 0);
    else near(e.elem.apoptosis, f.u.s.atk * f.u.def.skill.bb['attack@ep_damage_ratio']);
  }
});
test('S1 uses its real duration and blocks all SP recovery until it ends', () => {
  const f = make(); cast(f); const base = f.u.base.atk;
  assert.equal(f.u.skill.gainSp(10, 'fixture'), 0); advance(f.b, 19);
  assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
  advance(f.b, 1.2); assert.equal(f.u.skill.active, false); near(f.u.s.atk, base);
  assert.ok(f.u.skill.spTotal > 0); assert.equal(f.controller.mode, 0);
});
test('S3 cancels an unborn ordinary attack, delays its modifier/range until Begin, and attacks two distinct victims', () => {
  const f = make({ skill: 3 }), a = enemy(f), z = enemy(f, { x: 7, y: 2 }), third = enemy(f, { x: 6 });
  advance(f.b, .2); const old = f.controller.phase; const baseKeys = [...f.u.rangeKeys], base = f.u.s.atk;
  cast(f); assert.notEqual(f.controller.phase, old); near(f.u.s.atk, base);
  assert.deepEqual(f.u.rangeKeys, baseKeys); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Begin');
  advance(f.b, .31); assert.equal(bodyInKeys(z, f.u.rangeKeySet), true);
  near(f.u.s.atk, base * 3.2); advance(f.b, .9);
  assert.equal(hits(f, 'normal').length, 0); assert.equal(f.attacks.length, 1);
  assert.equal(new Set(f.attacks[0].targets).size, 2); assert.equal(hits(f, 's3').length, 2);
  assert.equal([a, z, third].filter(e => e.hp < 1e7).length, 2);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Attack');
});
test('S3 Begin remains committed through short control and active attacks wait for control to clear', () => {
  const f = make({ skill: 3 }); enemy(f); cast(f);
  f.b.applyStatus(f.u, 'stun', { duration: 1 }); advance(f.b, .4);
  assert.equal(f.controller.mode, 3); assert.equal(f.controller.phase, null);
  near(f.u.s.atk, f.u.base.atk * 3.2); assert.equal(f.attacks.length, 0);
  const left = f.u.skill.timeLeft; advance(f.b, .4); assert.ok(f.u.skill.timeLeft < left);
  advance(f.b, .9); assert.equal(f.attacks.length, 1);
});
test('S3 End restores stats/range, suppresses unborn shots and uses its original finite End clip', () => {
  const f = make({ skill: 3 }); enemy(f); const keys = [...f.u.rangeKeys]; cast(f);
  advance(f.b, .5); assert.equal(f.controller.phase.kind, 'attack');
  f.u.skill.end('fixture'); near(f.u.s.atk, f.u.base.atk); near(f.u.s.aspd, 100);
  assert.deepEqual(f.u.rangeKeys, keys); assert.equal(f.controller.phase.kind, 's3-end');
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_End');
  advance(f.b, .2); assert.equal(f.controller.mode, 0); assert.equal(hits(f, 's3').length, 0);
});
test('born S3 preserves its damage mode through expiry but reads post-expiry ATK at impact', () => {
  const f = make({ skill: 3 }), e = enemy(f, { x: 7 });
  f.b.addBuff(e, { key: 'apoptosisBurst', duration: 10, flags: { burstLock: true } });
  cast(f); advance(f.b, .94); assert.equal(f.attacks.length, 1); assert.equal(f.b.projectiles.list.length, 1);
  f.u.skill.end('fixture'); advance(f.b, .5);
  assert.equal(hits(f, 's3:elemental').length, 1); near(hits(f, 's3:elemental')[0].amount, f.u.base.atk);
});
test('brief control between controller ticks cancels an unborn attack without duplicating a release', () => {
  const f = make({ skill: 3 }); enemy(f); cast(f); advance(f.b, .5);
  f.b.applyStatus(f.u, 'stun', { duration: .0001 }); advance(f.b, .5);
  assert.equal(f.attacks.length, 0); advance(f.b, 1.2); assert.equal(f.attacks.length, 1);
});
test('each explicit S2 alternative consumes exactly its chosen event, one charge, and no basic attack/SP event', () => {
  for (const eventIndex of [0, 1]) for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ skill: 2, eventIndex, dir }); enemy(f); cast(f); const p = f.controller.phase;
    near(p.releaseAt, eventIndex ? .46666666865348816 : .2666666805744171);
    advance(f.b, eventIndex ? .4 : .2); assert.equal(f.b.projectiles.list.length, 0);
    through(f, p.releaseAt); assert.equal(f.b.projectiles.list.length, 1);
    advance(f.b, .4); assert.equal(hits(f, 's2:direct').length, 1); assert.equal(f.attacks.length, 0);
    assert.equal(f.u.stats.attacks, 0); near(f.u.skill.spTotal, f.u.skill.spCost);
    assert.equal(f.u.skill.activate('fixture'), false); assert.equal(f.u.skill.activations, 1);
  }
});
test('S2 refuses absent or illegal selector targets without consuming a ready charge', () => {
  const f = make({ skill: 2 }); f.u.skill.setSpTotal(24);
  assert.equal(f.u.skill.activate('fixture'), false); near(f.u.skill.spTotal, 24);
  const e = enemy(f); e.hidden = true;
  assert.equal(f.u.skill.activate('fixture'), false); near(f.u.skill.spTotal, 24);
  e.hidden = false; e.x = 10; f.b._buildEnemyIndex();
  f.controller.s2Contract.selectTarget = () => e;
  assert.equal(f.u.skill.activate('fixture'), false); near(f.u.skill.spTotal, 24);
});
test('S2 retains the selected original input point after its target becomes invalid; it does not retarget', () => {
  const f = make({ skill: 2 }), dead = enemy(f), current = enemy(f, { x: 5.4 }); cast(f);
  const p = f.controller.phase; assert.equal(p.target, dead); near(p.point.x, 5);
  f.b.kill(dead, null); advance(f.b, .9);
  assert.equal(hits(f, 's2:direct').length, 0); assert.equal(current.findBuff('fear'), null);
  assert.equal(hits(f, 's2:splash').length, 1); assert.equal(hits(f, 's2:splash')[0].target, current);
});
test('S2 interruption before release spends only the accepted command and cannot replay stale births', () => {
  const f = make({ skill: 2 }); enemy(f); cast(f); advance(f.b, .1);
  f.b.applyStatus(f.u, 'stun', { duration: .0001 }); advance(f.b, .5);
  assert.equal(f.u.skill.active, false); assert.equal(hits(f, 's2:direct').length, 0);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.charges, 1);
  assert.ok(f.u.skill.spTotal > 12 && f.u.skill.spTotal < 13);
  assert.equal(f.u.skill.activate('fixture'), true); advance(f.b, .6);
  assert.equal(hits(f, 's2:direct').length, 1); assert.equal(f.u.skill.activations, 2);
});
test('born S2 survives cast interruption while source lives; owner withdrawal removes flight and delayed output', () => {
  for (const removed of [false, true]) {
    const f = make({ skill: 2 }); enemy(f, { x: 7 }); cast(f); advance(f.b, .31);
    assert.equal(f.b.projectiles.list.length, 1);
    if (removed) f.b.retreat(f.u); else f.b.applyStatus(f.u, 'stun', { duration: .0001 });
    advance(f.b, .8);
    assert.equal(hits(f, 's2:direct').length, removed ? 0 : 1);
    assert.equal(hits(f, 's2:splash').length, removed ? 0 : 1);
  }
});
test('real S3 duration expires once, restores ordinary attacks and starts SP recovery', () => {
  const f = make({ skill: 3 }); cast(f); advance(f.b, 35.1);
  assert.equal(f.u.skill.active, true); advance(f.b, .6);
  assert.equal(f.u.skill.active, false); assert.equal(f.controller.mode, 0);
  assert.ok(f.u.skill.spTotal > 0); near(f.u.s.atk, f.u.base.atk);
  enemy(f); advance(f.b, .8); assert.equal(hits(f, 'normal').length, 1);
});
test('owner cleanup removes controller clock, modifiers and links once without late mode transitions', () => {
  const f = make({ skill: 3 }); enemy(f); cast(f); advance(f.b, .1);
  f.b.retreat(f.u); f.controller.stop(); f.controller.stop(); advance(f.b, 2);
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.phase, null);
  assert.equal(f.links.stopped, true); assert.equal(f.u.mem.regularFormVisual, null);
  assert.equal(f.attacks.length, 0); near(f.u.s.atk, f.u.base.atk);
});
