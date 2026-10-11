// SPDX-License-Identifier: GPL-3.0-or-later
// Real engine source fixtures, separate from selected-build integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ray-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { RayMagazine, SandbeastMagazine } from '../server/sim/content/arkpedia-ray-magazine.js';
import { RayCombatLinks, RAY_ID, SANDBEAST_ID, SCOUT_MARK,
  rayCandidates, rayPlacementKeys, rayFireEvent } from '../server/sim/content/arkpedia-ray-combat.js';

const bb = xs => Object.fromEntries(xs.map(x => [x.key, x.value]));
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const raw = structuredClone(data);
  raw.stage.geometry.waves[0].spawns = [];
  raw.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(raw, { operators: [defaultBuild(raw.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[elite];
  const id = `skchr_ray_${skill}`, level = evidence.tables.skills[id].levels[rank - 1];
  const build = { elite, level: phase.maxLevel, potential };
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const def = normalizeChess({ chessId: RAY_ID, charId: RAY_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data, rangeGrid: grid(phase.rangeId),
    trait: { bb: bb(sourceCandidate(c.trait.candidates, build).blackboard) }, talents,
    skill: { ...level, ...level.spData, skillId: id, bb: bb(level.blackboard),
      rangeGrid: level.rangeId ? grid(level.rangeId) : null, trigger: { rule: 'NEVER' } },
    arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const magazine = new RayMagazine({ elite, direction: dir });
  const shifts = [];
  b._setupUnit(u, { trait: { noAttack: true, install: null, attack: 'ranged', dmgType: 'phys',
    projectile: 'arrow', canHitFly: true, maxTargets: 1, hits: 1 },
    skill: { kind: skill === 1 ? 'charges' : skill === 2 ? 'toggle' : 'duration',
      // Keep the special-shot command pending for these direct link fixtures.
      // Its full cast/animation controller is deliberately tested separately.
      ...(skill === 1 ? { attack: { noAttack: true } } : {}),
      duration: level.duration, mods: skill === 2 ? { atkPct: bb(level.blackboard).atk } : {},
      targeting: level.rangeId ? { rangeGrid: grid(level.rangeId) } : null,
      trigger: { rule: 'NEVER' } } });
  const links = new RayCombatLinks(b, u, { magazine, specialShift: (e, contract) => shifts.push({ e, ...contract }) });
  links.installDamageScale();
  assert.equal(b._deploy(u, { initial: false }), true);
  u.atkCd = 1000;
  return { b, u, links, magazine, shifts };
}
function enemy(b, { x = 4.9, y = 1, hp = 100000, def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = def; e.base.moveSpeed = 0;
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = hp;
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
function cast(u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('fixture'), true); }
function shoot(f, e, mode = 0) {
  const hp = e.hp;
  assert.equal(f.links.fire(e, { mode, attackId: ++f.b._attackSeq }), true);
  advance(f.b, .3); return hp - e.hp;
}
function scout(f, { enabled = f.u.skill.id === 'skchr_ray_2', x = 5, y = 2 } = {}) {
  const c = evidence.tables.tokens[SANDBEAST_ID], phase = c.phases[2];
  const t = f.b.spawnToken(f.u, SANDBEAST_ID, y, x, { def: { id: SANDBEAST_ID,
    name: c.name, stats: phase.attributesKeyFrames.at(-1).data, position: 'ALL', rangeGrid: grid(phase.rangeId) },
    dir: 'RIGHT', kit: { trait: { noAttack: true, install: null }, skill: null,
      install: (b, t) => { t.kind = 'device'; b.addBuff(t, { key: 'fixture:device',
        flags: { invulnerable: true, noHeal: true, noSp: true }, persist: true, allowDead: true }); } } });
  assert.ok(t); t.mem.rayBorn = true; t.mem.rayMagazine = new SandbeastMagazine({ elite: 2, enabled });
  f.links.attachScout(t); return t;
}

test('registered Ray combat links reject an incomplete constructor contract', () => {
  assert.equal(data.operators[RAY_ID].skills.length, 3);
  assert.deepEqual(evidence.enabledOperators, [RAY_ID]);
  assert.throws(() => new RayCombatLinks({}, { defId: RAY_ID }, {}), /contract/);
});
test('all directions retain exact original normal and three skill release payloads', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const { u } = make({ dir });
    for (const [mode, expected] of [[0, .36666667461395264], [1, .2666666805744171],
      [2, .4000000059604645], [3, .30000001192092896]]) {
      const event = rayFireEvent(u, mode); near(event.time, expected);
      assert.equal(event.clip.includes('Down'), dir === 'DOWN');
    }
  }
});
test('normal birth spends one bullet, hits one victim and starts focus at one before damage', () => {
  const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
  const atk = f.u.s.atk, dmg = shoot(f, e);
  near(dmg, atk * 1.08 * 1.2); near(other.hp, 100000);
  assert.equal(f.magazine.bullets, 7); assert.equal(f.links.focusStacks, 1);
});
test('selected focus potential stacks to three; changed target resets, reload/idle preserve it', () => {
  for (const potential of [1, 5]) {
    const f = make({ potential }), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
    const atk = f.u.base.atk, increment = potential === 5 ? .09 : .08;
    for (let i = 1; i <= 4; i++) near(shoot(f, e), atk * (1 + Math.min(3, i) * increment) * 1.2);
    const reload = f.magazine.beginReload(f.b.time); f.magazine.finishReload(f.b.time + 1.6, reload.generation);
    advance(f.b, 1.7); assert.equal(f.links.focusStacks, 3);
    near(shoot(f, other), atk * (1 + increment) * 1.2); assert.equal(f.links.focusTarget, other);
  }
});
test('E0/E1 ordinary receipts use source trait without inventing E2 focus', () => {
  for (const elite of [0, 1]) {
    const f = make({ elite, rank: elite ? 7 : 4 }), e = enemy(f.b);
    near(shoot(f, e), f.u.base.atk * 1.2); assert.equal(f.links.focusStacks, 0);
    assert.equal(f.magazine.bullets, [3, 5][elite]);
  }
});
test('illegal, controlled, hidden and empty shots neither spend ammunition nor gain focus', () => {
  for (const why of ['range', 'sleep', 'hidden', 'empty', 'stun', 'wrong-skill', 'absent', 'ally']) {
    const f = make(), e = enemy(f.b);
    if (why === 'range') e.x = 15;
    if (why === 'sleep') f.b.applyStatus(e, 'sleep', { duration: 10 });
    if (why === 'hidden') e.hidden = true;
    if (why === 'empty') for (let i = 0; i < 8; i++) f.magazine.commitFire(0);
    if (why === 'stun') f.b.applyStatus(f.u, 'stun', { duration: 1 });
    const ammo = f.magazine.bullets;
    const target = why === 'absent' ? null : why === 'ally' ? f.u : e;
    assert.equal(f.links.fire(target, { mode: why === 'wrong-skill' ? 3 : 0 }), false);
    assert.equal(f.magazine.bullets, ammo); assert.equal(f.links.focusStacks, 0);
    assert.equal(f.b.projectiles.list.length, 0);
  }
});
test('newly marked victim wins normal priority without a per-owner source filter', () => {
  const f = make(), a = enemy(f.b), z = enemy(f.b, { x: 5.7 });
  shoot(f, a); f.b.addBuff(z, { key: SCOUT_MARK, source: a });
  assert.deepEqual(rayCandidates(f.b, f.u), [z]);
  near(shoot(f, z), f.u.base.atk * 1.08 * 1.2 * 1.15);
  f.b.removeBuff(z, SCOUT_MARK); assert.equal(rayCandidates(f.b, f.u).length, 1);
});
test('scout extension is targeting-only; ordinary/S2/S3 placement follows selected grids', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); if (skill !== 1) cast(f.u);
    const before = rayPlacementKeys(f.u), t = scout(f);
    const outside = [...t.rangeKeys].find(k => !before.has(k)); assert.ok(outside != null);
    assert.equal(f.u.rangeKeySet.has(outside), true); assert.equal(rayPlacementKeys(f.u).has(outside), false);
    const e = enemy(f.b, { x: outside % 21, y: Math.floor(outside / 21) });
    assert.deepEqual(rayCandidates(f.b, f.u), [e]); f.links.detachScout(t);
    assert.equal(f.u.rangeKeySet.has(outside), false);
    assert.deepEqual([...rayPlacementKeys(f.u)], [...before]);
  }
});
test('all S1 ranks use selected special scale, no ordinary bullet cost and accumulating direct-kill bonus', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), e = enemy(f.b), bb = f.u.def.skill.bb; cast(f.u);
    const ammo = f.magazine.bullets;
    near(shoot(f, e, 1), f.u.base.atk * 1.08 * 1.2 * bb.atk_scale);
    assert.equal(f.magazine.bullets, ammo); assert.equal(f.shifts[0].force, bb.force);
    e.hp = 1; shoot(f, e, 1); assert.equal(f.magazine.extra, bb.cnt);
    const other = enemy(f.b, { hp: 1 }); shoot(f, other, 1); assert.equal(f.magazine.extra, 2 * bb.cnt);
  }
});
test('special shift exposes separate fall ownership and detaches callbacks on owner removal', () => {
  const f = make(), e = enemy(f.b); cast(f.u); shoot(f, e, 1);
  assert.equal(f.magazine.extra, 0); f.shifts[0].onFall(); assert.equal(f.magazine.extra, 2);
  f.shifts[0].onFall(); assert.equal(f.magazine.extra, 2);
  f.links.remove(); f.shifts[0].onFall(); assert.equal(f.magazine.extra, 0);
});
test('all S2 ranks apply selected owner ATK; collection works with S2 equipped before activation', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), t = scout(f), e = enemy(f.b, { x: 5, y: 2 });
    const sp = f.u.skill.spTotal; shoot(f, e);
    assert.equal(t.mem.rayMagazine.collected, 1); near(f.u.skill.spTotal, sp);
    cast(f.u); near(shoot(f, e, 2), f.u.base.atk * (1 + .16 + f.u.def.skill.bb.atk) * 1.2);
    assert.equal(t.mem.rayMagazine.collected, 2); assert.equal(t.stats.attacks, 0);
  }
});
test('collection counts accepted shielded receipts, rejects misses/foreign hits and excludes flying targets', () => {
  const f = make({ skill: 2 }), t = scout(f), e = enemy(f.b, { x: 5, y: 2 });
  f.b.addBuff(e, { key: 'fixture:shield', shield: 100000 }); shoot(f, e);
  assert.equal(t.mem.rayMagazine.collected, 1);
  f.b.addBuff(e, { key: 'fixture:dodge', mods: { dodgePhys: 1 } }); shoot(f, e);
  assert.equal(t.mem.rayMagazine.collected, 1);
  f.b.removeBuff(e, 'fixture:dodge');
  f.b.dealDamage(f.u, e, { amount: 100, type: 'phys', tags: ['foreign'] });
  assert.equal(t.mem.rayMagazine.collected, 1);
  const fly = enemy(f.b, { x: 5, y: 2, fly: true }); shoot(f, fly);
  assert.equal(t.mem.rayMagazine.collected, 1);
});
test('all S3 ranks retain selected projectile coefficient/bind and defer a single kill refund until finish', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), e = enemy(f.b); cast(f.u); f.links.startThird();
    near(shoot(f, e, 3), f.u.base.atk * 1.08 * 1.2 * f.u.def.skill.bb['attack@atk_scale']);
    assert.equal(e.s.flags.bind, true); e.hp = 1; shoot(f, e, 3);
    shoot(f, enemy(f.b, { hp: 1 }), 3); near(f.u.skill.spTotal, 0);
    assert.throws(() => f.links.finishThird(), /Finish/);
    f.u.skill.end('fixture'); near(f.links.finishThird(), 10); near(f.u.skill.spTotal, 10);
    assert.equal(f.links.finishThird(), 0);
  }
});
test('S3 refund has no ability-family filter but another killer and no-kill windows cannot earn it', () => {
  const f = make({ skill: 3 }); cast(f.u); f.links.startThird();
  f.b.kill(enemy(f.b, { hp: 1 }), null); f.u.skill.end('fixture'); assert.equal(f.links.finishThird(), 0);
  cast(f.u); f.links.startThird(); f.b.kill(enemy(f.b, { hp: 1 }), f.u);
  f.links.startThird(); // Repeated dispatch cannot replace the current window.
  f.u.skill.end('fixture'); assert.equal(f.links.finishThird(), 10);
});
test('already born S3 projectiles survive control/expiry but cannot resurrect ammo/refunds after owner departure', () => {
  for (const leave of [false, true]) {
    const f = make({ skill: 3 }), e = enemy(f.b, { x: 6.2 }); cast(f.u); f.links.startThird();
    assert.equal(f.links.fire(e, { mode: 3 }), true); const atk = f.u.s.atk;
    f.b.applyStatus(f.u, 'stun', { duration: .001 });
    if (leave) f.b.retreat(f.u, { permanent: true }); else f.u.skill.end('fixture');
    advance(f.b, .3); near(100000 - e.hp, (leave ? f.u.base.atk : atk) * 1.2 * 3.3);
    assert.equal(e.s.flags.bind, true); assert.equal(f.magazine.bullets, 7);
    if (leave) { assert.equal(f.magazine.removed, true); assert.equal(f.links.refund, null); }
  }
});
test('opt-in attack dispatch grants attack SP only for accepted births; legacy dispatch stays unchanged', () => {
  for (const [optIn, accepted, expected] of [[true, false, 0], [true, true, 1], [false, false, 1]]) {
    const f = make({ skill: 2 }), e = enemy(f.b); let hits = 0;
    f.b.on('attack', ({ attacker }) => { if (attacker === f.u) hits++; });
    f.u.profile = { ...f.u.profile, noAttack: true, requiresAcceptedLaunch: optIn,
      launchAttack: () => accepted };
    f.u.skill.setSpTotal(0); f.b.forceAttack(f.u, [e]);
    near(f.u.skill.spTotal, expected); assert.equal(hits, expected);
  }
});
test('timed opt-in dispatch rejects a vanished release target without attack SP or finish hooks', () => {
  const f = make({ skill: 2 }), e = enemy(f.b);
  let births = 0, attacks = 0, finishes = 0;
  f.b.on('attack', ({ attacker }) => { if (attacker === f.u) attacks++; });
  f.u.profile = { ...f.u.profile, noAttack: true, windup: .4,
    requiresAcceptedLaunch: true, retargetOnRelease: true,
    acquireTargets: b => rayCandidates(b, f.u),
    launchAttack: (_b, _u, _profile, target, info) => {
      births++; return f.links.fire(target, info);
    },
    afterAttack: () => finishes++ };
  f.u.skill.setSpTotal(0); f.b.forceAttack(f.u, [e]);
  e.x = 15; f.b._buildEnemyIndex(); advance(f.b, .5);
  assert.equal(births, 0); assert.equal(attacks, 0); assert.equal(finishes, 0);
  assert.equal(f.magazine.bullets, 8); assert.equal(f.links.focusStacks, 0);
  near(f.u.skill.spTotal, 0);
});
test('timed opt-in dispatch selects the new marked target and credits one accepted birth', () => {
  const f = make({ skill: 2 }), first = enemy(f.b), next = enemy(f.b, { x: 5.1 });
  let attacks = 0, finishes = 0;
  f.b.on('attack', ({ attacker }) => { if (attacker === f.u) attacks++; });
  f.u.profile = { ...f.u.profile, noAttack: true, windup: .4,
    requiresAcceptedLaunch: true, retargetOnRelease: true,
    acquireTargets: b => rayCandidates(b, f.u),
    launchAttack: (_b, _u, _profile, target, info) => f.links.fire(target, info),
    afterAttack: () => finishes++ };
  f.u.skill.setSpTotal(0); f.b.forceAttack(f.u, [first]);
  f.b.addBuff(next, { key: SCOUT_MARK, source: first }); advance(f.b, .6);
  near(first.hp, 100000); assert.ok(next.hp < 100000);
  assert.equal(f.magazine.bullets, 7); assert.equal(f.links.focusTarget, next);
  assert.equal(attacks, 1); assert.equal(finishes, 1); near(f.u.skill.spTotal, 1);
});
test('brief control interrupts an unfired opt-in shot even if it wears off before release', () => {
  const f = make({ skill: 2 }), e = enemy(f.b);
  let births = 0;
  f.u.profile = { ...f.u.profile, noAttack: true, windup: .4,
    requiresAcceptedLaunch: true,
    launchAttack: (_b, _u, _profile, target, info) => {
      births++; return f.links.fire(target, info);
    } };
  f.u.skill.setSpTotal(0); f.b.forceAttack(f.u, [e]);
  f.b.applyStatus(f.u, 'stun', { duration: .05 }); advance(f.b, .6);
  assert.equal(f.u.canAct, true); assert.equal(births, 0);
  assert.equal(f.magazine.bullets, 8); assert.equal(f.links.focusStacks, 0);
  near(e.hp, 100000); near(f.u.skill.spTotal, 0);
});
