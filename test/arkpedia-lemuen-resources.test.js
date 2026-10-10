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
import { LEMUEN_ID, selectedLemuenBlackboard } from '../server/sim/content/arkpedia-lemuen-links.js';
import { LemuenAmmunition, LemuenTalentLinks, lemuenCandidates }
  from '../server/sim/content/arkpedia-lemuen-resources.js';

const CONTRACT = { wantedContract: 'continuous-union-v1', reviewNote: 'Engine review; native ordering not recovered.' };
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function owner(b, { elite = 2, potential = 1, skill = 1, rank = 10, col = 4 } = {}) {
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

test('all thirty ranks refill only at a new accepted cast and consume once per attack group', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const ammo = new LemuenAmmunition(skill, rank);
    const capacity = selectedLemuenBlackboard(skill, rank)['attack@trigger_time'];
    assert.deepEqual(ammo.ammoUi, { current: 0, maximum: capacity });
    assert.equal(ammo.consume('unborn'), false); assert.equal(ammo.begin(), true);
    assert.equal(ammo.begin(), false); assert.equal(ammo.current, capacity);
    assert.equal(ammo.consume('two-victim-group'), true);
    assert.equal(ammo.consume('two-victim-group'), false); assert.equal(ammo.current, capacity - 1);
    for (let n = 1; n < capacity; n++) assert.equal(ammo.consume(`group-${n}`), true);
    assert.equal(ammo.consume('empty'), false); assert.equal(ammo.active, true);
    // Last-shot finishing and SP release belong to the future cast controller.
    assert.equal(ammo.begin(), false); ammo.end(); assert.equal(ammo.begin(), true);
    assert.equal(ammo.consume('two-victim-group'), true);
  }
});
test('capacity contributions are idempotent, do not refill, and apply on the next cast', () => {
  const ammo = new LemuenAmmunition(2, 10), a = {}, b = {};
  ammo.begin(); ammo.consume('a'); ammo.consume('b'); assert.equal(ammo.current, 5);
  ammo.capacity(a, 1); ammo.capacity(a, 1); ammo.capacity(b, 2);
  assert.deepEqual(ammo.ammoUi, { current: 5, maximum: 10 });
  ammo.capacity(a, 0); assert.equal(ammo.current, 5); assert.equal(ammo.maximum, 9);
  ammo.end(); ammo.begin(); assert.equal(ammo.current, 9);
  ammo.capacity(b, 0); assert.equal(ammo.maximum, 7);
  assert.deepEqual(ammo.ammoUi, { current: 9, maximum: 9 });
  ammo.end(); ammo.begin(); assert.equal(ammo.current, 7);
  for (const count of [-1, .5, NaN]) assert.throws(() => ammo.capacity(a, count));
  assert.throws(() => ammo.consume(null));
  for (const invalid of [0, -1, .5, NaN, Infinity, '']) assert.throws(() => ammo.consume(invalid));
  assert.equal(ammo.consume(1), true); assert.equal(ammo.consume(1), false);
  ammo.remove(); assert.equal(ammo.begin(), false); assert.equal(ammo.capacity(a, 1), false);
  assert.equal(ammo.consume('removed'), false); assert.equal(ammo.bonuses.size, 0);
});
test('Wanted construction requires its documented local timing policy and complete source data', () => {
  const f = make();
  for (const contract of [{}, { wantedContract: 'native' }, { wantedContract: 'continuous-union-v1', reviewNote: '' }])
    assert.throws(() => new LemuenTalentLinks(f.b, f.u, f.ammo, contract), /explicit reviewed/);
  assert.throws(() => new LemuenTalentLinks(f.b, f.u, {}, CONTRACT), /source identity/);
  f.links.stop();
  f.u.def.talents[0].bb.damage_scale = 2;
  assert.throws(() => new LemuenTalentLinks(f.b, f.u, f.ammo, CONTRACT), /Wanted source/);
  assert.equal(f.b._lemuenWantedRegistry, undefined);
});
test('all selected promotion/potential thresholds mark elite and leader enemies, never ordinary enemies', () => {
  for (const [elite, potential, interval, scale] of [[1, 1, 10, 1], [1, 5, 8, 1], [2, 1, 8, 1.15], [2, 5, 6, 1.18]]) {
    const f = make({ elite, potential }), e = enemy(f.b), boss = enemy(f.b, { rank: 'BOSS', fly: true });
    const normal = enemy(f.b, { rank: 'NORMAL' }); range(f.u, e, boss, normal); f.links.tick();
    assert.equal(f.links.t1.damage_scale, scale);
    advance(f.b, interval - f.b.dt); assert.equal(f.links.hasWanted(e), false);
    advance(f.b, f.b.dt); settle(f.b); assert.equal(f.links.hasWanted(e), true); assert.equal(f.links.hasWanted(boss), true);
    assert.equal(f.links.hasWanted(normal), false); assert.equal(f.links.pending.has(normal), false);
  }
  const f = make({ elite: 0 }), e = enemy(f.b); range(f.u, e); f.links.tick(); advance(f.b, 21);
  assert.equal(f.links.hasWanted(e), false); assert.equal(f.links.pending.size, 0);
  assert.equal(f.links.talent2Applied, false);
});
test('overlapping ranges retain one entry clock through contributor withdrawal', () => {
  const f = make(), second = owner(f.b, { elite: 0, col: 3 }), e = enemy(f.b);
  range(f.u, e); range(second.u, e); f.links.tick();
  assert.equal(f.links.pending.get(e).contributors.size, 2); advance(f.b, 4);
  range(f.u); f.links.tick(); assert.equal(f.links.pending.get(e).since, 0);
  advance(f.b, 4); settle(f.b); assert.equal(f.links.hasWanted(e), true);
  f.b.retreat(second.u); f.links.tick(); assert.equal(f.links.hasWanted(e), true);
});
test('leaving every current range resets unfinished time, including range changes on skill switches', () => {
  const f = make(), e = enemy(f.b); range(f.u, e); f.links.tick(); advance(f.b, 5);
  range(f.u); f.links.tick(); assert.equal(f.links.pending.has(e), false);
  advance(f.b, 2); range(f.u, e); f.links.tick(); assert.equal(f.links.pending.get(e).since, 7);
  advance(f.b, 7.9); assert.equal(f.links.hasWanted(e), false);
  advance(f.b, .1); settle(f.b); assert.equal(f.links.hasWanted(e), true);
});
test('invalid contributors and unavailable enemies cannot acquire Wanted', () => {
  for (const flag of ['untargetable', 'stealth', 'sleep']) {
    const f = make(), e = enemy(f.b); range(f.u, e);
    f.b.addBuff(e, { key: 'target-invalid', flags: { [flag]: true } });
    f.links.tick(); advance(f.b, 9); assert.equal(f.links.hasWanted(e), false);
  }
  for (const type of ['hidden', 'not-laterano', 'withdrawn', 'untargetable', 'sleep']) {
    const f = make(), e = enemy(f.b); range(f.u, e);
    if (type === 'hidden') f.u.hidden = true;
    else if (type === 'not-laterano') f.u.tags.delete('laterano');
    else if (type === 'withdrawn') f.b.retreat(f.u);
    else f.b.addBuff(f.u, { key: 'invalid-contributor', flags: { [type]: true } });
    f.links.tick(); advance(f.b, 9); assert.equal(f.links.hasWanted(e), false);
  }
});
test('Wanted extends attack range without bypassing target restrictions or the target cap', () => {
  const f = make(), outside = enemy(f.b, { x: 7, def: 100 }), inside = enemy(f.b, { def: 200 });
  range(f.u, outside); f.links.tick(); advance(f.b, 8); settle(f.b); range(f.u, inside);
  assert.deepEqual(lemuenCandidates(f.b, f.u, f.links), [outside]);
  assert.deepEqual(lemuenCandidates(f.b, f.u, f.links, 2), [outside, inside]);
  const camo = f.b.addBuff(outside, { key: 'camo', flags: { camou: true } });
  assert.deepEqual(lemuenCandidates(f.b, f.u, f.links, 2), [inside]);
  f.b.removeBuff(outside, camo); f.b.addBuff(outside, { key: 'stealth', flags: { stealth: true } });
  assert.deepEqual(lemuenCandidates(f.b, f.u, f.links), [inside]);
  assert.throws(() => lemuenCandidates(f.b, f.u, f.links, 0));
});
test('Wanted boosts Laterano HP damage across damage and delivery types, with mitigation and shield receipts', () => {
  for (const type of ['phys', 'arts', 'true', 'elemental']) for (const applyWay of ['none', 'melee', 'ranged']) {
    const f = make({ potential: 5 }), e = enemy(f.b, { def: 100 });
    range(f.u, e); f.links.tick(); advance(f.b, 6); settle(f.b);
    const amounts = []; f.b.on('calculatedDamage', c => { if (c.target === e) amounts.push(c.amount); });
    f.b.addBuff(e, { key: 'shield', shield: 10000 });
    f.b.dealDamage(f.u, e, { type, applyWay, amount: 1000, canDodge: false, isAttack: false, isSkill: false });
    near(amounts[0], (type === 'phys' ? 900 : 1000) * 1.18); near(e.hp, 1e7);
  }
});
test('non-Laterano, sourceless injury and direct HP loss receive no Wanted boost', () => {
  const f = make(), e = enemy(f.b); range(f.u, e); f.links.tick(); advance(f.b, 8); settle(f.b);
  const amounts = []; f.b.on('calculatedDamage', c => amounts.push(c.amount));
  f.b.dealDamage(f.u, e, { amount: 1000, type: 'true', sourceless: true });
  const hp = e.hp; f.b.loseHp(e, 1000, { source: f.u }); near(hp - e.hp, 1000);
  f.u.tags.delete('laterano'); f.b.dealDamage(f.u, e, { amount: 1000, type: 'true' });
  assert.deepEqual(amounts, [1000, 1000]);
  f.u.tags.add('laterano'); f.b.dealDamage(f.u, e, { amount: 100, type: 'element', element: 'apoptosis' });
  near(e.elem.apoptosis, 100);
});
test('multiple owners use the strongest surviving Wanted bonus once, preserving independent clocks', () => {
  const f = make(), second = owner(f.b, { potential: 5, col: 3 }), e = enemy(f.b);
  range(f.u, e); range(second.u, e); f.links.tick(); second.links.tick();
  advance(f.b, 6); settle(f.b); assert.equal(f.links.hasWanted(e), false); assert.equal(second.links.hasWanted(e), true);
  advance(f.b, 2); assert.equal(f.links.hasWanted(e), true);
  const hp = e.hp; f.b.dealDamage(f.u, e, { amount: 1000, type: 'true' }); near(hp - e.hp, 1180);
  second.links.stop(); const hp2 = e.hp;
  f.b.dealDamage(f.u, e, { amount: 1000, type: 'true' }); near(hp2 - e.hp, 1150);
  assert.equal(f.links.hasWanted(e), true); assert.equal(f.b._lemuenWantedRegistry.owners.size, 1);
  f.links.stop(); assert.equal(f.b._lemuenWantedRegistry, undefined);
});
test('cleanse, victim death and owner removal clean up only their owned marks and pending clocks', () => {
  const f = make(), e = enemy(f.b); range(f.u, e); f.links.tick(); advance(f.b, 8); settle(f.b);
  f.b.removeBuff(e, f.links.wanted.get(e)); assert.equal(f.links.hasWanted(e), false);
  f.links.tick(); assert.equal(f.links.pending.get(e).since, f.b.time);
  f.b.kill(e, null); assert.equal(f.links.pending.size, 0); assert.equal(f.links.wanted.size, 0);
  const next = enemy(f.b); range(f.u, next); f.links.tick(); advance(f.b, 8); settle(f.b);
  assert.equal(f.links.hasWanted(next), true);
  f.b.retreat(f.u); assert.equal(f.links.stopped, true); assert.equal(f.links.wanted.size, 0);
  assert.equal(f.links.pending.size, 0); assert.equal(f.links.hooks.length, 0);
  assert.equal(f.b._lemuenWantedRegistry, undefined);
  f.links.stop(); advance(f.b, 3); assert.equal(f.links.hasWanted(next), false);
});
test('Talent2 grants ATK and capacity at twenty seconds without refilling any active skill', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), atk = f.u.s.atk, base = f.ammo.maximum;
    f.ammo.begin(); f.ammo.consume('one'); f.ammo.consume('two');
    advance(f.b, 19.9); assert.equal(f.ammo.maximum, base); near(f.u.s.atk, atk);
    advance(f.b, .1); settle(f.b); assert.equal(f.links.talent2Applied, true);
    assert.deepEqual(f.ammo.ammoUi, { current: base - 2, maximum: base + 1 }); near(f.u.s.atk, atk * 1.1);
    advance(f.b, 2); assert.equal(f.ammo.maximum, base + 1);
    f.ammo.end(); f.ammo.begin(); assert.equal(f.ammo.current, base + 1);
    f.links.stop(); assert.equal(f.ammo.maximum, base); near(f.u.s.atk, atk);
  }
});
test('Talent2 timing belongs to a deployment and does not survive an interrupted owner', () => {
  const f = make(), atk = f.u.s.atk;
  advance(f.b, 19); f.b.retreat(f.u); advance(f.b, 2);
  assert.equal(f.links.talent2Applied, false); near(f.u.s.atk, atk);
  const next = owner(f.b); const nextAtk = next.u.s.atk;
  advance(f.b, 19.9); assert.equal(next.links.talent2Applied, false);
  advance(f.b, .1); settle(f.b); assert.equal(next.links.talent2Applied, true); near(next.u.s.atk, nextAtk * 1.1);
});

test('stun and silence do not postpone the nonsilenceable delayed talent', () => {
  const f = make(), atk = f.u.s.atk;
  f.b.addBuff(f.u, { key: 'control', flags: { stun: true, silence: true } });
  advance(f.b, 20); settle(f.b);
  assert.equal(f.links.talent2Applied, true); near(f.u.s.atk, atk * 1.1);
  assert.equal(f.ammo.current, 0); assert.equal(f.ammo.maximum, f.ammo.base + 1);
});

test('Wanted does not bypass Dodge, cancellation, invulnerability or ordinary defenses', () => {
  for (const reason of ['dodge', 'cancel', 'invulnerable']) {
    const f = make(), e = enemy(f.b); range(f.u, e); f.links.tick(); advance(f.b, 8); settle(f.b);
    if (reason === 'dodge') f.b.addBuff(e, { key: reason, mods: { dodgePhys: 1 } });
    if (reason === 'invulnerable') f.b.addBuff(e, { key: reason, flags: { invulnerable: true } });
    if (reason === 'cancel') f.b.on('hit', c => { if (c.target === e) c.dmg.cancel = true; });
    f.b.dealDamage(f.u, e, { amount: 1000, type: 'phys', canDodge: true }); near(e.hp, 1e7);
    assert.deepEqual(f.b.errors, []);
  }
});

test('Wanted tracking uses huge-body range overlap rather than requiring the center tile', () => {
  const f = make(), e = enemy(f.b, { x: 7, rank: 'BOSS' });
  e.hitArea = { w: 3, h: 1, dx: 0, dy: 0 };
  f.u.rangeKeySet = new Set([COLS + 6]); f.b._buildEnemyIndex();
  f.links.tick(); assert.deepEqual(f.links.contributors(e), [f.u]);
  advance(f.b, 8); settle(f.b); assert.equal(f.links.hasWanted(e), true);
});

test('delayed installation retains the actual deployment origin for Talent2', () => {
  const f = make(); advance(f.b, 4); f.links.stop();
  const delayed = new LemuenTalentLinks(f.b, f.u, f.ammo, CONTRACT);
  assert.equal(delayed.talent2At, 20);
  advance(f.b, 15.9); assert.equal(delayed.talent2Applied, false);
  advance(f.b, .1); settle(f.b); assert.equal(delayed.talent2Applied, true);
});
