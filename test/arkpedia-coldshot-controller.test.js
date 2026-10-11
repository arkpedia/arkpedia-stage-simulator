// SPDX-License-Identifier: GPL-3.0-or-later
// Real battle fixtures use retained complete source records; roster/loadout
// registration remains a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-coldshot-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { COLDSHOT_ID, ColdshotMagazine, customizeColdshotKit, installColdshot }
  from '../server/sim/content/arkpedia-coldshot.js';
const bb = xs => Object.fromEntries(xs.map(x => [x.key, x.value]));
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) <= tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const raw = structuredClone(data);
  raw.stage.geometry.waves[0].spawns = []; raw.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(raw, { operators: [defaultBuild(raw.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, p = c.phases[elite];
  const id = skill === 1 ? 'skcom_atk_up[3]' : 'skchr_coldst_2';
  const level = evidence.tables.skills[id].levels[rank - 1];
  const build = { elite, level: p.maxLevel, potential, skillRank: rank, skillId: id };
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const def = normalizeChess({ chessId: COLDSHOT_ID, charId: COLDSHOT_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: p.attributesKeyFrames.at(-1).data, rangeGrid: grid(p.rangeId),
    trait: { bb: bb(sourceCandidate(c.trait.candidates, build).blackboard) }, talents,
    skill: { ...level, ...level.spData, skillId: id, bb: bb(level.blackboard),
      rangeGrid: level.rangeId ? grid(level.rangeId) : null, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const kit = {}; customizeColdshotKit({ battle: b, id: COLDSHOT_ID, def, unit: u, kit });
  b._setupUnit(u, kit); installColdshot({ battle: b, unit: u, def });
  assert.equal(b._deploy(u, { initial: false }), true);
  return { b, u, controller: u.mem.coldshotController, magazine: u.mem.coldshotMagazine };
}
function enemy(b, { x = 4.9, y = 1, hp = 100000, fly = false, speed = 0 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = 0; e.base.moveSpeed = speed;
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = hp;
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
function cast(f) { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); }
function move(b, e, x = 0, y = 0) { e.x = x; e.y = y; b._buildEnemyIndex(); }

test('promotion capacities, capped refill and removal never fabricate rounds or change other resources', () => {
  for (const elite of [0, 1, 2]) {
    const m = new ColdshotMagazine(elite); assert.equal(m.capacity, 4 + 2 * elite);
    assert.equal(m.refill(), false);
    for (let i = 0; i < m.capacity; i++) assert.equal(m.consume(), true);
    assert.equal(m.consume(), false); assert.equal(m.bullets, 0);
    for (let i = 0; i < m.capacity; i++) assert.equal(m.refill(), true);
    assert.equal(m.refill(), false); m.remove(); assert.equal(m.consume(), false); assert.equal(m.refill(), false);
  }
  assert.throws(() => new ColdshotMagazine(3));
});
test('original first Begin and Loop produce one legal projectile and one ammunition receipt', () => {
  const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
  advance(f.b, .2); assert.equal(f.magazine.bullets, 8); near(e.hp, 100000);
  advance(f.b, .5); assert.equal(f.magazine.bullets, 7); near(other.hp, 100000);
  near(100000 - e.hp, f.u.s.atk * 1.2); assert.equal(f.controller.talentReady, false);
  advance(f.b, 1.6); assert.equal(f.magazine.bullets, 6); near(100000 - e.hp, f.u.s.atk * 1.2 * 2);
});
test('all20 selected ranks retain skill ATK, duration, SP and S2 slow with fixed reload clocks', () => {
  for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), base = f.u.s.atk; cast(f);
    near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk)); near(f.u.skill.timeLeft, f.u.def.skill.duration);
    near(f.u.skill.spCost, f.u.def.skill.spCost); assert.equal(f.u.skill.manual, true);
    f.magazine.consume(); advance(f.b, .3);
    const p = f.controller.phase; assert.equal(p.kind, 'reload');
    near(p.readyAt - p.releaseAt, skill === 2 ? .9 : .6);
    const e = enemy(f.b, { speed: 1 }); advance(f.b, .5);
    assert.ok(e.hp < 100000); assert.equal(f.magazine.bullets, 6);
    assert.equal(!!e.findBuff('slow'), skill === 2);
    if (skill === 2) near(e.findBuff('slow').mods.moveMul, .2);
    f.u.skill.end('fixture'); near(f.u.s.atk, base); assert.equal(f.controller.mode, 0);
  }
});
test('all original facing clips are used; firing scales withASPD but refill does not', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) for (const skill of [1, 2]) {
    const f = make({ dir, skill }); if (skill === 2) cast(f);
    f.b.addBuff(f.u, { key: 'fast', mods: { aspd: 100 } }); f.magazine.consume();
    advance(f.b, .1); assert.match(f.u.mem.regularFormVisual.clip, /Reload.*Begin$/);
    advance(f.b, .2); const p = f.controller.phase;
    near(p.readyAt - p.releaseAt, skill === 2 ? .9 : .6);
    const e = enemy(f.b, { x: 5, y: 1 });
    // Direction-specific fixture places a body in the first reviewed range cell.
    const k = f.u.rangeKeys.find(k => k !== 1 * 21 + 4);
    move(f.b, e, k % 21, Math.floor(k / 21)); advance(f.b, .3);
    assert.ok(e.hp < 100000); assert.equal(f.magazine.bullets, 6);
    assert.equal(f.u.mem.regularFormVisual.clip, skill === 2
      ? dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop'
      : dir === 'DOWN' ? 'Attack_Down_Loop' : 'Attack_Loop');
    near(f.u.mem.regularFormVisual.speed, skill === 2 ? 3 : 2);
  }
});
test('target returning before refill breaks immediately if a round already exists, without unfinished refill', () => {
  const f = make(); f.magazine.consume(); advance(f.b, .3);
  const old = f.controller.phase; assert.equal(old.refilled, false);
  enemy(f.b); advance(f.b, .1); assert.equal(f.u.mem.regularFormVisual.clip, 'Reload_Break');
  assert.equal(f.magazine.bullets, 7); advance(f.b, .5); assert.equal(f.magazine.bullets, 6);
  advance(f.b, 1.5); assert.notEqual(f.magazine.bullets, 7);
});
test('zero rounds wait for original refill event, then break before the fixed reload cooldown finishes', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }); if (skill === 2) cast(f);
    while (f.magazine.consume()); enemy(f.b); advance(f.b, .3);
    const p = f.controller.phase, due = p.releaseAt;
    advance(f.b, due - f.b.time - .05); assert.equal(f.magazine.bullets, 0);
    advance(f.b, .1); assert.equal(f.magazine.bullets, 1);
    assert.equal(f.controller.phase.kind, 'fire-begin'); assert.ok(f.b.time < p.readyAt);
    advance(f.b, .4); assert.equal(f.magazine.bullets, 0);
  }
});
test('target arriving after refill retains its round and cancels the remaining partial reload clock', () => {
  const f = make(); f.magazine.consume(); f.magazine.consume(); advance(f.b, 1.3);
  const p = f.controller.phase; assert.equal(p.refilled, true); assert.equal(f.magazine.bullets, 7);
  enemy(f.b); advance(f.b, .4); assert.equal(f.magazine.bullets, 6);
  assert.notEqual(f.controller.phase, p);
});
test('repeated no-target reloads add one at each original event, clamp capacity and clear flag conditionally', () => {
  const f = make(); for (let i = 0; i < 3; i++) f.magazine.consume();
  advance(f.b, 1.1); assert.equal(f.magazine.bullets, 5);
  advance(f.b, .2); assert.equal(f.magazine.bullets, 6);
  advance(f.b, 1.6); assert.equal(f.magazine.bullets, 7);
  advance(f.b, 1.6); assert.equal(f.magazine.bullets, 8);
  advance(f.b, 1); assert.equal(f.magazine.bullets, 8); assert.equal(f.controller.reloadFlag, false);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
});
test('selected talent activates only after initial delay and stays invalid during pending Begin/birth', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 5, 6]) {
    const f = make({ elite, potential, rank: elite ? 7 : 4 }); advance(f.b, 2.1);
    assert.equal(f.controller.talentReady, elite !== 0); const e = enemy(f.b);
    advance(f.b, .1); assert.equal(f.controller.attackInvalid, true); assert.equal(f.magazine.bullets, 4 + 2 * elite);
    assert.equal(f.controller.talentReady, false); advance(f.b, .4);
    near(100000 - e.hp, f.u.s.atk * 1.2 * (f.u.def.talents[0]?.bb.atk_scale ?? 1));
    assert.equal(f.controller.attackInvalid, false);
    advance(f.b, 1.6); assert.equal(f.magazine.bullets, 2 + 2 * elite);
    near(100000 - e.hp, f.u.s.atk * 1.2 * ((f.u.def.talents[0]?.bb.atk_scale ?? 1) + 1));
  }
});
test('canceled target produces no ammo/attackSP; fresh release selector may choose a different enemy', () => {
  const f = make(), e = enemy(f.b); advance(f.b, .2); move(f.b, e);
  const before = f.magazine.bullets; advance(f.b, .3); assert.equal(f.magazine.bullets, before);
  const other = enemy(f.b); advance(f.b, 2); assert.ok(other.hp < 100000); near(e.hp, 100000);
  assert.equal(f.magazine.bullets, before - 1);
});
test('brief control and disarm invalidate unborn fire and pending refill without duplicate ammo', () => {
  for (const reload of [false, true]) {
    const f = make(); if (reload) f.magazine.consume(); else enemy(f.b);
    advance(f.b, .1); const old = f.controller.phase, ammo = f.magazine.bullets;
    f.b.applyStatus(f.u, 'stun', { duration: .001 }); advance(f.b, .1);
    assert.notEqual(f.controller.phase, old); assert.equal(f.magazine.bullets, ammo);
    f.b.addBuff(f.u, { key: 'disarm', flags: { disarm: true } }); advance(f.b, 3);
    assert.equal(f.magazine.bullets, ammo); f.b.removeBuff(f.u, 'disarm'); advance(f.b, 2);
    assert.ok(reload ? f.magazine.bullets >= ammo : f.magazine.bullets < ammo);
  }
});
test('S2 mode restart discards unfinished reload and unborn shot but retains already refilled rounds', () => {
  for (const at of [.3, 1.3]) {
    const f = make({ skill: 2 }); f.magazine.consume(); f.magazine.consume(); advance(f.b, at);
    const ammo = f.magazine.bullets; cast(f); assert.equal(f.magazine.bullets, ammo);
    assert.equal(f.controller.phase, null); advance(f.b, .3);
    assert.match(f.u.mem.regularFormVisual.clip, /Skill_2_Reload_Loop/);
    f.u.skill.end('fixture'); const saved = f.magazine.bullets;
    advance(f.b, .7); assert.equal(f.magazine.bullets, saved);
  }
  const f = make({ skill: 2 }), e = enemy(f.b); advance(f.b, .1); cast(f);
  assert.equal(f.magazine.bullets, 8); advance(f.b, .5);
  assert.equal(f.magazine.bullets, 7); assert.ok(e.hp < 100000);
});
test('shielded S2 hit applies source80%Slow; missed or invulnerable targets do not receive it', () => {
  for (const kind of ['shield', 'dodge', 'miss', 'invulnerable']) {
    const f = make({ skill: 2 }); cast(f); const e = enemy(f.b);
    if (kind === 'shield') f.b.addBuff(e, { key: 'shield', shield: { amount: 100000 } });
    if (kind === 'dodge') f.b.addBuff(e, { key: 'dodge', mods: { dodgePhys: 1 } });
    if (kind === 'miss') f.b.addBuff(f.u, { key: 'miss', mods: { hitRatePhys: -1 } });
    if (kind === 'invulnerable') f.b.addBuff(e, { key: 'inv', flags: { invulnerable: true } });
    advance(f.b, .7); assert.equal(!!e.findBuff('slow'), kind === 'shield', kind);
  }
});
test('born S2 projectile retains slow after expiry and owner removal, but detached magazine never refills', () => {
  const f = make({ skill: 2 }); cast(f); const e = enemy(f.b, { x: 6, speed: 1 });
  for (let i = 0; i < 40 && f.b.projectiles.list.length === 0; i++) f.b.step();
  assert.equal(f.b.projectiles.list.length, 1); const ammo = f.magazine.bullets;
  f.u.skill.end('fixture'); f.b.retreat(f.u, { permanent: true }); advance(f.b, .5);
  assert.equal(f.magazine.removed, true); assert.equal(f.magazine.bullets, ammo);
  assert.ok(e.hp < 100000); assert.ok(e.findBuff('slow')); advance(f.b, 10);
  assert.equal(f.magazine.bullets, ammo); assert.equal(e.findBuff('slow'), null);
});
