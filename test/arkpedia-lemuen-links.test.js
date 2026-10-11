// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed engine fixtures verify impact kernels, not public deployment,
// Wanted clocks, ammunition, aiming or the managed bombardment controller.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { LemuenCombatLinks, LEMUEN_ID, selectedLemuenBlackboard }
  from '../server/sim/content/arkpedia-lemuen-links.js';

const near = (a, z, epsilon = 1e-5) => assert.ok(Math.abs(a - z) < epsilon, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_lemuen_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: LEMUEN_ID, charId: LEMUEN_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, bb: selectedLemuenBlackboard(skill, rank),
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'duration', duration: 100 } });
  assert.equal(b._deploy(u, { initial: false }), true);
  const links = new LemuenCombatLinks(b, u), hits = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  return { b, u, links, hits, selected: def.skill.bb };
}
function enemy(b, { x = 5, y = 1, res = 0, def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; Object.assign(e.base, { maxHp: 1e7, def, res, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}

test('every selected rank retains its exact source coefficients and rejects missing ranks', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
    assert.deepEqual(selectedLemuenBlackboard(skill, rank), Object.fromEntries(
      evidence.tables.skills[`skchr_lemuen_${skill}`].levels[rank - 1].blackboard.map(r => [r.key, r.value])));
  for (const [s, r] of [[0, 1], [4, 1], [1, 0], [1, 11], [1, 1.5]])
    assert.throws(() => selectedLemuenBlackboard(s, r));
});
test('normal and all S1 ranks use Physical mitigation and only supplied victims', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), e = enemy(f.b, { def: 250 }), other = enemy(f.b, { x: 5.1 });
    f.links.normalImpact(e, 'ordinary'); near(1e7 - e.hp, f.u.s.atk - 250);
    const hp = e.hp; f.links.s1Impact(e, 's1', f.selected);
    near(hp - e.hp, f.u.s.atk * f.selected['attack@atk_scale'] - 250);
    near(other.hp, 1e7);
    assert.equal(f.hits.length, 2); assert.equal(f.u.stats.attacks, 0);
    assert.equal(f.u.skill.activations, 0);
  }
});
test('ordinary/S1 can be dodged; aimed S2 ignores Dodge while respecting DEF and shields', () => {
  for (const shield of [false, true]) {
    const f = make({ skill: 2 }), e = enemy(f.b, { def: 200 });
    f.b.addBuff(e, { key: 'dodge', mods: { dodgePhys: 1 } });
    if (shield) f.b.addBuff(e, { key: 'shield', shield: 1e7 });
    f.links.normalImpact(e, 'normal'); f.links.s1Impact(e, 's1', selectedLemuenBlackboard(1, 10));
    near(e.hp, 1e7);
    const snapshot = f.links.snapshotS2(f.selected['attack@main_atk_scale']);
    f.links.s2Impact(e, 'aim', snapshot);
    near(e.hp, shield ? 1e7 : 1e7 - snapshot + 200);
  }
});
test('S2 snapshot is fixed at aim completion; ordinary/S1 read ATK at impact', () => {
  for (const mode of [0, 1, 2]) {
    const f = make({ skill: mode || 1 }), e = enemy(f.b);
    const atk = f.u.s.atk, fixed = f.links.snapshotS2(2);
    const p = f.links.launch(e, `mode-${mode}`, mode, {
      selected: selectedLemuenBlackboard(1, 10), currentValue: fixed });
    assert.equal(p.speed, 12); assert.equal(p.maxAge, 5);
    f.b.addBuff(f.u, { key: 'changed-atk', mods: { atkPct: 1 } });
    advance(f.b, .2);
    const expected = mode === 2 ? fixed : atk * 2 * (mode === 1 ? 2.1 : 1);
    near(1e7 - e.hp, expected); assert.equal(f.hits.length, 1);
    assert.equal(f.b.projectiles.list.length, 0);
  }
});
test('all S2 ranks keep initial/final aimed snapshots through subsequent ATK changes', () => {
  for (let rank = 1; rank <= 10; rank++) for (const key of ['attack@main_atk_scale', 'attack@fin_atk_scale']) {
    const f = make({ skill: 2, rank }), e = enemy(f.b, { def: 321 });
    const fixed = f.links.snapshotS2(f.selected[key]), atk = f.u.s.atk;
    f.b.addBuff(f.u, { key: 'after-aim', mods: { atkPct: 1 } });
    f.links.s2Impact(e, `${rank}-${key}`, fixed);
    near(1e7 - e.hp, atk * f.selected[key] - 321);
    assert.equal(f.hits.length, 1);
  }
});
test('ordinary source lifetime expires at five seconds and retains its explicit final trace hit', () => {
  const f = make(), e = enemy(f.b);
  // Keep a valid in-arena victim beyond this shot's lifetime using the
  // engine's speed aura; off-board coordinates are clamped during updates.
  f.b.projectiles.registerSpeedAura({ owner: f.u, contains: () => true, scale: .001 });
  const atk = f.u.s.atk; f.links.launch(e, 'lifetime', 0);
  advance(f.b, 4.9); near(e.hp, 1e7); assert.equal(f.b.projectiles.list.length, 1);
  advance(f.b, .2); near(1e7 - e.hp, atk); assert.equal(f.b.projectiles.list.length, 0);
});
test('a released shot survives withdrawal; dead victims cannot retarget to a nearby enemy', () => {
  for (const mode of [0, 1, 2]) {
    for (const killed of [false, true]) {
      const f = make(), e = enemy(f.b), nearby = enemy(f.b, { x: 5.1 });
      const atk = f.u.s.atk;
      f.links.launch(e, `withdraw-${mode}`, mode, {
        selected: f.selected, currentValue: atk * 2 });
      if (killed) f.b.kill(e, null);
      f.b.retreat(f.u); advance(f.b, .3);
      assert.equal(f.hits.length, killed ? 0 : 1);
      near(nearby.hp, 1e7); assert.equal(f.b.projectiles.list.length, 0);
    }
  }
});
test('aimed damage retains invulnerability and hit cancellation rather than bypassing all defenses', () => {
  for (const mode of ['invulnerable', 'cancel']) {
    const f = make({ skill: 2 }), e = enemy(f.b);
    if (mode === 'invulnerable') f.b.addBuff(e, { key: 'immune', flags: { invulnerable: true } });
    else f.b.on('hit', c => { if (c.target === e) c.dmg.cancel = true; });
    f.links.s2Impact(e, 'rejected', f.u.s.atk * 4.25); near(e.hp, 1e7);
  }
});
test('all S3 ranks apply their inner/outer rings to current bodies using a cached ATK', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), bb = f.selected, cache = f.u.s.atk;
    const inner = enemy(f.b, { x: 5 + bb['attack@dist_1'], def: 100 });
    const outer = enemy(f.b, { x: 5 + bb['attack@dist_1'] + .01, def: 100, fly: true });
    const edge = enemy(f.b, { x: 5 + bb['attack@dist_2'], def: 100 });
    const outside = enemy(f.b, { x: 5 + bb['attack@dist_2'] + .01 });
    f.b.addBuff(f.u, { key: 'changed-atk', mods: { atkPct: 1 } });
    assert.deepEqual(f.links.s3Impact(5, 1, cache, 'blast', bb), [inner, outer, edge]);
    near(1e7 - inner.hp, cache * bb['attack@proj_atk_scale_1'] - 100);
    for (const e of [outer, edge]) near(1e7 - e.hp, cache * bb['attack@proj_atk_scale_2'] - 100);
    near(outside.hp, 1e7); assert.equal(f.hits.length, 3);
    assert.ok(f.hits.every(h => h.dmg.isSplash));
  }
});
test('S3 collision includes camouflage and flying bodies; direct shots retain target restrictions', () => {
  const f = make({ skill: 3 }), e = enemy(f.b, { fly: true });
  f.b.addBuff(e, { key: 'camo', flags: { camou: true } });
  assert.equal(f.links.launch(e, 'direct', 0), false); near(e.hp, 1e7);
  f.links.s3Impact(5, 1, f.u.s.atk, 'area', f.selected);
  near(1e7 - e.hp, f.u.s.atk * 4.5);
});
test('bombardment selects by huge body boundaries instead of enemy center', () => {
  const f = make({ skill: 3 }), e = enemy(f.b, { x: 7 });
  e.hitArea = { w: 3, h: 1, dx: 0, dy: 0 }; f.b._buildEnemyIndex();
  assert.deepEqual(f.links.s3Impact(5, 1, f.u.s.atk, 'large', f.selected), [e]);
  near(1e7 - e.hp, f.u.s.atk * 4.5);
});
test('missing accepted-birth snapshots are rejected; no projectiles or skill events are fabricated', () => {
  const f = make(), e = enemy(f.b);
  assert.throws(() => f.links.launch(e, 'missing', 1));
  assert.throws(() => f.links.launch(e, 'missing', 2));
  assert.throws(() => f.links.launch(e, 'bad', 3));
  assert.throws(() => f.links.s2Impact(e, 'bad', NaN));
  assert.throws(() => f.links.s3Impact(5, 1, null, 'bad', f.selected));
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.hits.length, 0);
});
