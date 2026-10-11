// SPDX-License-Identifier: GPL-3.0-or-later
// Real-engine linked-controller fixtures. Selected-loadout and deployment
// compiler checks live separately in arkpedia-ray.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ray-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { customizeRayKit, installRay, createSandbeast } from '../server/sim/content/arkpedia-ray.js';
import { RAY_ID, SANDBEAST_ID, rayPlacementKeys } from '../server/sim/content/arkpedia-ray-combat.js';
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
  const c = evidence.tables.character, p = c.phases[elite], id = `skchr_ray_${skill}`;
  const level = evidence.tables.skills[id].levels[rank - 1];
  const build = { elite, level: p.maxLevel, potential, skillRank: rank, skillId: id };
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const def = normalizeChess({ chessId: RAY_ID, charId: RAY_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: p.attributesKeyFrames.at(-1).data, rangeGrid: grid(p.rangeId),
    trait: { bb: bb(sourceCandidate(c.trait.candidates, build).blackboard) }, talents,
    skill: { ...level, ...level.spData, skillId: id, bb: bb(level.blackboard),
      rangeGrid: level.rangeId ? grid(level.rangeId) : null, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  const kit = {}; customizeRayKit({ battle: b, id: RAY_ID, def, unit: u, kit }); b._setupUnit(u, kit);
  let state = null;
  if (elite) {
    const source = evidence.tables.tokens[SANDBEAST_ID], p = source.phases[elite];
    const record = { id: SANDBEAST_ID, name: source.name, position: source.position,
      profession: source.profession, subProfessionId: source.subProfessionId,
      stats: p.attributesKeyFrames.at(-1).data, rangeGrid: grid(p.rangeId),
      talents: source.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean)
        .map(t => ({ ...t, bb: bb(t.blackboard) })),
      skill: skill === 2 ? evidence.tables.tokenSkills.sktok_ray_2.levels[rank - 1] : null,
      arkpedia: build };
    state = { key: `summon:${RAY_ID}`, owner: u, ownerId: RAY_ID, record, stock: 0, readyAt: 0 };
    b.regularSummons = new Map([[state.key, state]]);
  }
  installRay({ battle: b, unit: u, def }); assert.equal(b._deploy(u, { initial: false }), true);
  return { b, u, state, controller: u.mem.rayController, magazine: u.mem.rayMagazine, links: u.mem.rayLinks };
}
function enemy(b, { x = 4.9, y = 1, hp = 100000, mass = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = 0; e.base.moveSpeed = 0;
  e.base.massLevel = mass; if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = hp;
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
function cast(f) {
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true);
}
function scout(f, row = 2, col = 5) {
  const t = createSandbeast(f.b, f.state, row, col); assert.ok(t);
  f.state.stock--; return t;
}
function pauseFire(f) { f.u.atkCd = 1000; }

test('controller follows original first Begin/Loop release, keeps one victim and consumes no ammo before birth', () => {
  const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
  advance(f.b, .5); near(e.hp, 100000); assert.equal(f.magazine.bullets, 8);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Attack_Loop');
  advance(f.b, .2); assert.ok(e.hp < 100000); near(other.hp, 100000);
  assert.equal(f.magazine.bullets, 7); assert.equal(f.links.focusStacks, 1);
  advance(f.b, 1.6); assert.equal(f.magazine.bullets, 6); assert.equal(f.links.focusStacks, 2);
});
test('all promotions exhaust selected capacities, fixed refill then break into a legal shot', () => {
  for (const elite of [0, 1, 2]) {
    const f = make({ elite, rank: elite ? 7 : 4 }), e = enemy(f.b);
    const births = [];
    f.b.on('attack', ({ attacker }) => { if (attacker === f.u) births.push(f.b.time); });
    advance(f.b, f.magazine.capacity * 1.6 + .6);
    assert.equal(f.magazine.bullets, 0); assert.ok(f.magazine.reload);
    const ready = f.magazine.reload.readyAt;
    assert.equal(births.length, f.magazine.capacity); assert.ok(e.hp < 100000);
    advance(f.b, Math.max(0, ready - f.b.time) + .2);
    assert.equal(f.magazine.bullets, 1); assert.equal(births.length, f.magazine.capacity);
    advance(f.b, .5); assert.equal(births.length, f.magazine.capacity + 1);
    assert.equal(f.magazine.bullets, 0);
  }
});
test('fixed no-target reload is independent of ASPD and uses the correct Down-specific clips', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }); pauseFire(f);
    f.magazine.commitFire(0); f.magazine.commitFire(0);
    f.b.addBuff(f.u, { key: 'fixture:fast', mods: { aspd: 100 } });
    advance(f.b, .1); assert.equal(f.u.mem.regularFormVisual.clip,
      dir === 'DOWN' ? 'Down_Reload_Begin' : 'Reload_Begin');
    const ready = f.magazine.reload.readyAt; near(ready - f.magazine.reload.start, 1.767);
    advance(f.b, 1.6); assert.equal(f.magazine.bullets, 6);
    advance(f.b, .2); assert.equal(f.magazine.bullets, 7);
    advance(f.b, 1.6); assert.equal(f.magazine.bullets, 8);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
  }
});
test('an enemy during partial refill breaks the reload without granting its unfinished bullet', () => {
  const f = make(); f.magazine.commitFire(0);
  advance(f.b, .3); const stale = f.magazine.reload.generation;
  const e = enemy(f.b); advance(f.b, .1);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Reload_Break'); assert.equal(f.magazine.bullets, 7);
  advance(f.b, .7); assert.ok(e.hp < 100000); assert.equal(f.magazine.bullets, 6);
  assert.equal(f.magazine.finishReload(f.b.time, stale), 0);
});
test('brief control cancels an unfired normal shot and a pending fixed refill', () => {
  for (const reloading of [false, true]) {
    const f = make(), e = reloading ? null : enemy(f.b);
    if (reloading) { f.magazine.commitFire(0); pauseFire(f); }
    advance(f.b, .3); const ammo = f.magazine.bullets, stale = f.magazine.reload?.generation;
    f.b.applyStatus(f.u, 'stun', { duration: .001 }); advance(f.b, .1);
    assert.equal(f.magazine.bullets, ammo);
    if (reloading) assert.notEqual(f.magazine.reload?.generation, stale);
    if (e) { near(e.hp, 100000); assert.equal(f.links.focusStacks, 0); }
  }
});
test('S1 needs a target, holds command/SP through Loop/End and fires even at zero normal bullets', () => {
  const f = make(); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.activate('fixture'), false);
  const e = enemy(f.b); pauseFire(f);
  for (let i = 0; i < 8; i++) f.magazine.commitFire(0);
  f.u.skill.setSpTotal(f.u.skill.spCost * f.u.skill.maxCharges);
  assert.equal(f.u.skill.activate('fixture'), true);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Begin');
  advance(f.b, .4); near(e.hp, 100000); assert.equal(f.magazine.bullets, 0);
  advance(f.b, .2); assert.ok(e.hp < 100000); assert.equal(f.u.skill.active, true);
  near(f.u.skill.spTotal, 10); // One source charge remains; no recovery during command.
  advance(f.b, 1.6); assert.equal(f.u.skill.active, false);
  assert.equal(f.magazine.bullets, 0); assert.ok(f.u.skill.spTotal > 10);
});
test('all S1 ranks release their selected special damage and direct-kill reload bonus through the controller', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), e = enemy(f.b, { hp: 1 }); pauseFire(f); cast(f);
    advance(f.b, .8); assert.equal(e.alive, false); assert.equal(f.magazine.bullets, 8);
    assert.equal(f.magazine.extra, f.u.def.skill.bb.cnt);
  }
});
test('source S1 directional reduction and hole crossing credit only its fall bonus', () => {
  const f = make(), e = enemy(f.b, { x: 5.4, mass: 0 }); pauseFire(f);
  const index = 1 * 21 + 6, old = f.b.grid.tiles[index];
  f.b.grid.tiles[index] = { ...old, key: 'tile_hole', pass: 'FLY', build: 'NONE' };
  cast(f); advance(f.b, .8); assert.equal(e.alive, false); assert.equal(e.killedBy, undefined);
  assert.equal(f.magazine.extra, 2); f.b.grid.tiles[index] = old;
});
test('off-axis Ray S1 uses retained reduction1 while other directional pushes retain default2', () => {
  const f = make();
  const k = f.b.grid.tiles.findIndex((t, k) => t.pass === 'ALL' && f.b.grid.inRect(Math.floor(k / 21), k % 21));
  assert.ok(k >= 0); const x = k % 21, y = Math.floor(k / 21);
  const a = enemy(f.b, { x, y, mass: 2 });
  const from = { x, y: y - 1 }, dir = { x: 1, y: 0 };
  const ordinary = f.b.push(a, 2, { from, dir });
  a.x = x; a.y = y;
  const ray = f.b.push(a, 2, { from, dir, directionalReduction: 1 });
  assert.ok(ray > ordinary, JSON.stringify({ ray, ordinary, weight: a.s.massLevel,
    tile: f.b.grid.tile(1, 5), displaceable: f.b._displaceable(a) }));
  near(ordinary, .12); near(ray, .44);
});
test('S2 activates from sixteen accepted natural attacks, never from reload, and stays indefinite', () => {
  const f = make({ skill: 2 }), e = enemy(f.b, { hp: 1000000 });
  let births = 0;
  f.b.on('attack', ({ attacker }) => { if (attacker === f.u) births++; });
  f.u.skill.setSpTotal(0);
  for (let i = 0; i < 80 / f.b.dt && !f.u.skill.active; i++) advance(f.b, f.b.dt);
  assert.equal(births, 16);
  assert.equal(f.u.skill.active, true); assert.equal(f.controller.mode, 2);
  assert.ok(e.hp < 1000000); assert.equal(f.magazine.skillMode, 2);
  advance(f.b, 20); assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.timeLeft, Infinity);
});
test('S3 fills every missing bullet at fixed .4s before firing, then keeps emitted Bind at expiry', () => {
  const f = make({ skill: 3 }), e = enemy(f.b); pauseFire(f);
  for (let i = 0; i < 5; i++) f.magazine.commitFire(0);
  cast(f); assert.equal(f.magazine.refillOnly, true);
  advance(f.b, 1.7); near(e.hp, 100000); assert.ok(f.magazine.bullets < 8);
  advance(f.b, 1.3); assert.equal(f.magazine.refillOnly, false);
  assert.ok(e.hp < 100000); assert.equal(e.s.flags.bind, true);
  f.u.atkCd = 0; f.controller.startLoop(); const p = f.controller.phase;
  advance(f.b, p.releaseAt - f.b.time + .034); f.u.skill.end('fixture');
  advance(f.b, .3); assert.equal(e.s.flags.bind, true); assert.equal(f.controller.mode, 0);
});
test('S3 refunds once at natural expiry after an accepted kill, never per kill or on owner removal', () => {
  for (const leave of [false, true]) {
    const f = make({ skill: 3 }), e = enemy(f.b, { hp: 1 }); pauseFire(f); cast(f);
    advance(f.b, .7); assert.equal(e.alive, false); near(f.u.skill.spTotal, 0);
    if (leave) f.b.retreat(f.u, { permanent: true });
    advance(f.b, 15.4); assert.equal(f.u.skill.active, false);
    if (leave) { near(f.u.skill.spTotal, 0); assert.equal(f.magazine.removed, true); }
    else { assert.ok(f.u.skill.spTotal >= 10 && f.u.skill.spTotal < 11); assert.equal(f.links.finishThird(), 0); }
  }
});
test('Sandbeast starts at its original OnStart, extends only targeting and survives its selected lifetime', () => {
  for (const elite of [1, 2]) {
    const f = make({ elite, rank: elite === 1 ? 7 : 10 }); pauseFire(f);
    const before = rayPlacementKeys(f.u), t = scout(f), dp = f.b.dp;
    assert.equal(t.kind, 'device'); assert.equal(t.s.blockCnt, 0); assert.equal(t.mem.rayBorn, undefined);
    assert.equal(t.mem.regularFormVisual.clip, 'Start'); advance(f.b, .134);
    assert.equal(t.mem.rayBorn, true); assert.ok(t.rangeKeys.some(k => !before.has(k) && f.u.rangeKeySet.has(k)));
    assert.deepEqual([...rayPlacementKeys(f.u)], [...before]);
    advance(f.b, 1); assert.equal(t.mem.regularFormVisual.clip, 'Idle');
    advance(f.b, [0, 15, 25][elite] - 1.1); assert.equal(t.alive, true);
    advance(f.b, .2); assert.equal(t.alive, false); near(f.b.dp, dp);
    assert.equal(f.links.scouts.size, 0); assert.deepEqual([...f.u.rangeKeySet], [...before]);
    near(f.state.readyAt - f.b.time, 30, .2); assert.equal(f.state.stock, 0);
    advance(f.b, 30.1); assert.equal(f.state.stock, 1);
  }
});
test('Sandbeast marks ground entry/exit, cannot take damage/heal, and S2 collects accepted owner hits', () => {
  const f = make({ skill: 2 }); pauseFire(f); const t = scout(f), e = enemy(f.b, { x: 5, y: 2 });
  const fly = enemy(f.b, { x: 5, y: 2, fly: true }); advance(f.b, .134);
  assert.ok(e.buffs.some(x => x.tags.includes('ray_sndbst_aura')));
  assert.ok(!fly.buffs.some(x => x.tags.includes('ray_sndbst_aura')));
  const hp = t.hp; near(f.b.dealDamage(e, t, { amount: 999999, type: 'true' }), 0);
  t.hp = 1; f.b.heal(f.u, t, 999999); near(t.hp, 1); t.hp = hp;
  f.links.fire(e); advance(f.b, .3); assert.equal(t.mem.rayMagazine.collected, 1);
  e.x = 15; advance(f.b, .1); assert.ok(!e.buffs.some(x => x.tags.includes('ray_sndbst_aura')));
  const bullets = f.magazine.bullets; f.b.retreat(t, { permanent: true });
  assert.equal(f.magazine.bullets, Math.min(8, bullets + 1));
  assert.equal(f.links.scouts.size, 0); assert.equal(t.mem.rayMagazine.finished, true);
});
test('selected S2 card modifier scales already-cooling cards and restores an unscaled remaining clock at finish', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }); pauseFire(f); const t = scout(f);
    advance(f.b, .1); f.b.retreat(t, { permanent: true }); advance(f.b, 5);
    const remaining = f.state.readyAt - f.b.time; near(remaining, 25, .05);
    cast(f); advance(f.b, .1);
    const ratio = 1 + f.u.def.skill.bb.respawn_time;
    near(f.state.readyAt - f.b.time, (remaining - .1 / ratio) * ratio, .05);
    f.u.skill.end('fixture'); advance(f.b, .1);
    near(f.state.readyAt - f.b.time, remaining - .1 / ratio - .1, .05);
    advance(f.b, 26); assert.equal(f.state.stock, 1);
  }
});
test('owner departure removes born/unborn Sandbeasts, stops controller and prevents refund or stock resurrection', () => {
  for (const warm of [false, true]) {
    const f = make({ skill: 2 }), t = scout(f); if (warm) advance(f.b, .1);
    f.b.retreat(f.u, { permanent: true }); assert.equal(t.alive, false);
    assert.equal(f.controller.stopped, true); assert.equal(f.magazine.removed, true);
    advance(f.b, 40); assert.equal(f.state.stock, 0); assert.equal(f.magazine.bullets, 8);
    assert.equal(f.links.scouts.size, 0);
  }
});
test('controlled S1 loses its spent command without a late projectile, kill bonus or charge refund', () => {
  const f = make(), e = enemy(f.b); pauseFire(f); cast(f);
  const charges = f.u.skill.charges;
  advance(f.b, .2); f.b.applyStatus(f.u, 'stun', { duration: .001 });
  advance(f.b, .6); assert.equal(f.u.skill.active, false);
  near(e.hp, 100000); assert.equal(f.magazine.bullets, 8); assert.equal(f.magazine.extra, 0);
  assert.equal(f.links.focusStacks, 0); assert.equal(f.u.skill.charges, charges);
});
test('fire clocks scale with selected attack interval while fixed reload clocks stay unchanged', () => {
  for (const aspd of [-50, 100]) {
    const f = make(), e = enemy(f.b); f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd } });
    const interval = f.u.s.interval, rate = 1.6 / interval;
    advance(f.b, f.b.dt * 2); assert.equal(f.controller.phase.kind, 'fire-begin');
    near(f.controller.phase.readyAt - f.b.dt, .2 / rate);
    advance(f.b, .2 / rate + f.b.dt * 2);
    assert.equal(f.controller.phase.kind, 'fire');
    near(f.controller.phase.readyAt - f.controller.phase.releaseAt, (1.6 - .36666667461395264) / rate);
    advance(f.b, .37 / rate + .3); assert.ok(e.hp < 100000);
    e.hidden = true; advance(f.b, interval + .4);
    assert.ok(f.magazine.reload); near(f.magazine.reload.interval, 1.6);
  }
});
test('S2/S3 skill exit dispatches the original End clip before returning to the original Idle', () => {
  for (const skill of [2, 3]) for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ skill, dir }); pauseFire(f); cast(f); advance(f.b, .3);
    f.u.skill.end('fixture');
    assert.equal(f.u.mem.regularFormVisual.clip, `Skill_${dir === 'DOWN' ? 'Down_' : ''}${skill}_End`);
    advance(f.b, .5); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
    assert.equal(f.controller.phase, null); assert.equal(f.magazine.skillMode, 0);
  }
});
test('hole handling remains opt-in and never converts flying, immune or blocked movement into a fall kill', () => {
  for (const why of ['legacy', 'fly', 'immune']) {
    const f = make(), e = enemy(f.b, { x: 5.4, fly: why === 'fly' });
    const index = 1 * 21 + 6, old = f.b.grid.tiles[index];
    f.b.grid.tiles[index] = { ...old, key: 'tile_hole', pass: 'FLY', build: 'NONE' };
    if (why === 'immune') f.b.addBuff(e, { key: 'fixture:immune', flags: { noDisplace: true } });
    let falls = 0;
    const moved = f.b.displace(e, { x: 1, y: 0 }, 1, why === 'legacy' ? {}
      : { onFall: v => { falls++; f.b.kill(v, f.u); } });
    assert.equal(falls, 0); assert.equal(e.alive, true);
    if (why === 'immune') assert.equal(moved, 0);
    f.b.grid.tiles[index] = old;
  }
});
