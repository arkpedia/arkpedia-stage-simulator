// SPDX-License-Identifier: GPL-3.0-or-later
// Engine review of unregistered births/returns, not public attack/SP/talents.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NarantuyaProjectiles, NARANT_ID, selectedNarantBlackboard, narantContactTime }
  from '../server/sim/content/arkpedia-narant-projectiles.js';

const near = (a, z, epsilon = 1e-5) => assert.ok(Math.abs(a - z) < epsilon, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, dir = 'RIGHT' } = {}) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[2], id = `skchr_narant_${skill}`;
  const build = { elite: 2, level: phase.maxLevel, potential: 1, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: NARANT_ID, charId: NARANT_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, bb: selectedNarantBlackboard(skill, rank),
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'duration', duration: 100 } });
  assert.equal(b._deploy(u, { initial: false }), true);
  const links = new NarantuyaProjectiles(b, u), hits = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  return { b, u, links, hits, selected: def.skill.bb };
}
function enemy(b, { x = 5, y = 1, def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; Object.assign(e.base, { maxHp: 1e7, def, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}

const activate = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };

test('all thirty skill blackboards are exact and invalid ranks cannot launch', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
    assert.deepEqual(selectedNarantBlackboard(skill, rank), Object.fromEntries(
      evidence.tables.skills[`skchr_narant_${skill}`].levels[rank - 1].blackboard.map(r => [r.key, r.value])));
  for (const [s, r] of [[0, 1], [4, 1], [1, 0], [1, 11], [1, 1.5]])
    assert.throws(() => selectedNarantBlackboard(s, r));
  const f = make(), e = enemy(f.b);
  assert.throws(() => f.links.launch(e, 1, 4)); assert.throws(() => f.links.launch(e, 1, 1, { rank: 0 }));
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.links.canAttack(), true);
});

test('ordinary birth hits one victim after travel and gates until its slower return', () => {
  const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 }), atk = f.u.s.atk;
  assert.equal(f.links.canAttack(), true);
  const state = f.links.launch(e, 11, 0);
  assert.equal(f.links.canAttack(), false); assert.equal(f.links.launch(e, 12, 0), false);
  assert.equal(f.b.projectiles.list[0].speed, 15);
  advance(f.b, .03); assert.equal(f.hits.length, 0);
  advance(f.b, .09); near(e.hp, 1e7 - atk); near(other.hp, 1e7);
  assert.equal(f.links.canAttack(), false); assert.equal(f.b.projectiles.list[0].speed, 3.75);
  advance(f.b, .4); assert.equal(f.links.canAttack(), true); assert.equal(state.complete, true);
  assert.equal(f.hits.length, 1); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(f.u.stats.attacks, 0); assert.equal(f.u.skill.activations, 0);
});

test('ordinary impact reads current ATK and keeps Physical DEF mitigation', () => {
  const f = make(), e = enemy(f.b, { def: 250 }), atk = f.u.s.atk;
  f.links.launch(e, 21, 0); f.b.addBuff(f.u, { key: 'changed-atk', mods: { atkPct: 1 } });
  advance(f.b, .1); near(1e7 - e.hp, atk * 2 - 250);
});

test('born ordinary shots survive withdrawal and cannot damage a later victim life', () => {
  for (const invalid of [false, true]) {
    const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
    f.links.launch(e, 31, 0);
    if (invalid) e.deploySeq++;
    f.b.retreat(f.u); advance(f.b, .6);
    assert.equal(f.hits.length, invalid ? 0 : 1); near(other.hp, 1e7);
    assert.equal(f.b.projectiles.list.length, 0);
  }
});

test('an old source return cannot release a newer deployment flight', () => {
  const f = make(), e = enemy(f.b);
  const old = f.links.launch(e, 41, 0); advance(f.b, .2);
  f.u.deploySeq++; const fresh = f.links.launch(e, 42, 0);
  assert.notEqual(old, fresh); assert.equal(f.links.flight, fresh);
  advance(f.b, .25); assert.equal(old.complete, true); assert.equal(f.links.flight, fresh);
  assert.equal(f.links.canAttack(), false);
  advance(f.b, .3); assert.equal(fresh.complete, true); assert.equal(f.links.canAttack(), true);
});

test('only S3 accepts a finite captured invalid input and never homes on a later target life', () => {
  for (const mode of [0, 1, 2, 3]) {
    const f = make({ skill: mode || 1 }), e = enemy(f.b);
    const input = { x: e.x, y: e.y, seq: e.deploySeq };
    e.deploySeq++; e.x = 7; e.y = 3;
    const flight = f.links.launch(e, `invalid-${mode}`, mode, { input });
    assert.equal(!!flight, mode === 3);
    if (mode === 3) for (const p of f.b.projectiles.list) {
      assert.equal(p.target, null); near(p.tx, input.x); near(p.ty, input.y);
    }
    advance(f.b, .8); assert.equal(f.hits.length, 0); assert.equal(f.links.canAttack(), true);
    near(e.hp, 1e7);
  }
  const f = make({ skill: 3 }), e = enemy(f.b); e.alive = false;
  assert.equal(f.links.launch(e, 1, 3), false);
  for (const input of [{ x: NaN, y: 1, seq: 1 }, { x: 1, y: 1, seq: .5 }])
    assert.throws(() => f.links.launch(e, 1, 3, { input }), /captured input/);
  assert.equal(f.b.projectiles.list.length, 0); assert.equal(f.links.canAttack(), true);
});

test('all S3 ranks retain their final-return AoE after an invalid-position birth', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), lost = enemy(f.b), nearOwner = enemy(f.b, { x: 4.5 });
    const input = { x: lost.x, y: lost.y, seq: lost.deploySeq }; lost.hidden = true;
    activate(f); f.links.launch(lost, `fallback-${rank}`, 3, { input });
    advance(f.b, .6);
    assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, nearOwner);
    assert.ok(f.hits[0].dmg.tags.includes('narant:s3-return')); near(lost.hp, 1e7);
    near(1e7 - nearOwner.hp, f.u.s.atk * f.selected.atk_scale_aoe);
    assert.equal(f.links.canAttack(), true);
  }
});

test('expiry releases gating and retains a single pending native final trace hit', () => {
  const f = make(), e = enemy(f.b), atk = f.u.s.atk;
  f.b.projectiles.registerSpeedAura({ owner: f.u, contains: () => true, scale: .001 });
  const state = f.links.launch(e, 51, 0);
  advance(f.b, 9.9); assert.equal(f.hits.length, 0); assert.equal(f.links.canAttack(), false);
  advance(f.b, .2); near(1e7 - e.hp, atk); assert.equal(f.hits.length, 1);
  assert.equal(state.failed, true); assert.equal(f.links.canAttack(), true);
  assert.equal(f.b.projectiles.list.length, 0);
});

test('S1 all ten ranks use selected coefficients for the initial hit and three additional bounces', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), a = enemy(f.b), z = enemy(f.b, { x: 5.6 }), atk = f.u.s.atk;
    f.links.launch(a, `s1-${rank}`, 1); advance(f.b, 1.5);
    assert.equal(f.hits.length, 4); assert.deepEqual(f.hits.map(h => h.target), [a, z, a, z]);
    near(1e7 - a.hp, 2 * atk * f.selected['attack@atk_scale']);
    near(1e7 - z.hp, 2 * atk * f.selected['attack@atk_scale']);
    assert.equal(f.links.canAttack(), true); assert.equal(f.b.projectiles.list.length, 0);
  }
});

test('S1 prefers an untouched victim before a closer previously hit one', () => {
  const f = make(), a = enemy(f.b), z = enemy(f.b, { x: 5.6 }), third = enemy(f.b, { x: 6.3 });
  f.links.launch(a, 61, 1); advance(f.b, 2);
  assert.deepEqual(f.hits.slice(0, 3).map(h => h.target), [a, z, third]);
  assert.equal(f.hits.length, 4);
});

test('a single S1 victim cannot bounce to itself or instantly splash neighbours', () => {
  const f = make(), a = enemy(f.b), distant = enemy(f.b, { x: 7 });
  f.links.launch(a, 71, 1); advance(f.b, 1);
  assert.equal(f.hits.length, 1); near(distant.hp, 1e7); assert.equal(f.links.canAttack(), true);
});

test('S1 bounce selection respects invisible, sleeping and unblocked camouflage victims', () => {
  for (const flag of ['stealth', 'sleep', 'camou', 'untargetable']) {
    const f = make(), a = enemy(f.b), hidden = enemy(f.b, { x: 5.2 });
    f.b.addBuff(hidden, { key: 'cannot-select', flags: { [flag]: true } });
    f.links.launch(a, 81, 1); advance(f.b, 1);
    assert.equal(f.hits.length, 1); near(hidden.hp, 1e7);
  }
});

test('swept contacts handle points, endpoints, misses and huge-body corners', () => {
  const target = { x: 2, y: 0 };
  near(narantContactTime(target, { x: 0, y: 0 }, { x: 4, y: 0 }, .5), .375);
  assert.equal(narantContactTime(target, { x: 2, y: 0 }, { x: 2, y: 0 }, .5), 0);
  assert.equal(narantContactTime(target, { x: 0, y: 1 }, { x: 4, y: 1 }, .5), null);
  near(narantContactTime(target, { x: 0, y: .5 }, { x: 2, y: .5 }, .5), 1);
  const huge = { x: 2, y: 2, hitArea: { w: 2, h: 2, dx: 0, dy: 0 } };
  const time = narantContactTime(huge, { x: 0, y: 0 }, { x: 2, y: 2 }, .5);
  near(time, (1 - .5 / Math.sqrt(2)) / 2);
  assert.equal(narantContactTime(huge, { x: 0, y: 0 }, { x: 0, y: 4 }, .5), null);
  assert.throws(() => narantContactTime(target, { x: NaN, y: 0 }, { x: 1, y: 0 }, .5));
});

test('S2 all ten ranks have one primary hit then one return hit per passed victim', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), e = enemy(f.b), passed = enemy(f.b, { x: 4.5 }),
      outside = enemy(f.b, { x: 4.5, y: 1.7 }), atk = f.u.s.atk;
    f.links.launch(e, `s2-${rank}`, 2); advance(f.b, 1.3);
    near(1e7 - e.hp, atk * (f.selected['attack@atk_scale'] + f.selected['attack@atk_scale_comeback']));
    near(1e7 - passed.hp, atk * f.selected['attack@atk_scale_comeback']); near(outside.hp, 1e7);
    assert.equal(f.hits.length, 3); assert.equal(f.links.canAttack(), true);
    assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s2-return')).length, 2);
  }
});

test('S2 forward phase waits before returning and does not hit passerby outbound', () => {
  const f = make({ skill: 2 }), e = enemy(f.b), passed = enemy(f.b, { x: 4.5 });
  const initialSp = f.u.skill.sp;
  f.links.launch(e, 91, 2); advance(f.b, .4);
  assert.equal(f.hits.length, 1); near(passed.hp, 1e7); assert.equal(f.links.canAttack(), false);
  assert.equal(f.b.projectiles.list[0].flightTime, .5);
  advance(f.b, .9); assert.equal(f.hits.length, 3); assert.equal(f.links.canAttack(), true);
  assert.equal(f.u.skill.sp, initialSp); // The future attack controller grants attack recovery once.
});

test('S2 return ignores camouflage but retains invisibility and fly/body targeting', () => {
  const f = make({ skill: 2 }), e = enemy(f.b), camou = enemy(f.b, { x: 4.5 }),
    hidden = enemy(f.b, { x: 4.6 }), flyer = enemy(f.b, { x: 4.4, fly: true });
  f.b.addBuff(camou, { key: 'camou', flags: { camou: true } });
  f.b.addBuff(hidden, { key: 'hidden', flags: { stealth: true } });
  f.links.launch(e, 101, 2); advance(f.b, 1.3);
  assert.ok(camou.hp < 1e7); assert.ok(flyer.hp < 1e7); near(hidden.hp, 1e7);
});

test('S2 primary Slow is missable, shield-compatible and not attached to return-only victims', () => {
  for (const prevent of ['none', 'dodge', 'shield', 'cancel', 'invulnerable']) {
    const f = make({ skill: 2 }), e = enemy(f.b), passed = enemy(f.b, { x: 4.5 });
    if (prevent === 'dodge') f.b.addBuff(e, { key: 'dodge', mods: { dodgePhys: 1 } });
    if (prevent === 'shield') f.b.addBuff(e, { key: 'shield', shield: 1e7 });
    if (prevent === 'invulnerable') f.b.addBuff(e, { key: 'immune', flags: { invulnerable: true } });
    if (prevent === 'cancel') f.b.on('hit', ctx => { if (ctx.target === e) ctx.dmg.cancel = true; });
    f.links.launch(e, 111, 2); advance(f.b, .15);
    assert.equal(!!e.findBuff('sluggish'), ['none', 'shield'].includes(prevent));
    near(passed.hp, 1e7); assert.equal(!!passed.findBuff('sluggish'), false);
    advance(f.b, .8); assert.equal(!!passed.findBuff('sluggish'), false);
    assert.equal(f.b._hooks.calculatedDamage?.length ?? 0, 0);
  }
});

test('S2 clips return collision against a huge-body corner rather than only its centre', () => {
  const f = make({ skill: 2 }), e = enemy(f.b), huge = enemy(f.b, { x: 4.5, y: 2.2 });
  huge.hitArea = { w: 1, h: 2, dx: 0, dy: 0 };
  f.links.launch(e, 121, 2); advance(f.b, 1.3);
  assert.ok(huge.hp < 1e7); assert.equal(f.hits.filter(h => h.target === huge).length, 1);
});

test('S3 all ten ranks release three projectiles and one selected capped follow-up', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), e = enemy(f.b), others = [enemy(f.b, { x: 4, y: 2 }),
      enemy(f.b, { x: 3, y: 1 }), enemy(f.b, { x: 4, y: 0 })], atk = f.u.s.atk;
    activate(f);
    f.links.launch(e, `s3-${rank}`, 3);
    assert.equal(f.b.projectiles.list.length, 3);
    assert.deepEqual(f.b.projectiles.list.map(p => p.data.narantVariant),
      ['projectile_chr_narant_s3', 'projectile_chr_narant_s3_1', 'projectile_chr_narant_s3_2']);
    advance(f.b, .7);
    assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s3')).length, 3);
    const follow = f.hits.filter(h => h.dmg.tags.includes('narant:s3-return'));
    assert.equal(follow.length, 3); assert.equal(new Set(follow.map(h => h.target)).size, 3);
    follow.forEach(h => { near(h.amount, atk * f.selected.atk_scale_aoe); assert.equal(h.dmg.applyWay, 'melee'); });
    assert.ok([e, ...others].some(a => !follow.some(h => h.target === a)));
    assert.equal(f.links.canAttack(), true); assert.equal(f.u.stats.attacks, 0);
  }
});

test('S3 cannot follow up before its last individual projectile returns', () => {
  const f = make({ skill: 3 }), e = enemy(f.b);
  activate(f);
  f.b.projectiles.registerSpeedAura({ owner: f.u,
    contains: p => p.data.narantVariant.endsWith('s3_2'), scale: .25 });
  const state = f.links.launch(e, 131, 3);
  advance(f.b, .6); assert.equal(state.remaining, 1); assert.equal(f.links.canAttack(), false);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s3-return')).length, 0);
  advance(f.b, 1.2); assert.equal(state.complete, true); assert.equal(f.links.canAttack(), true);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s3-return')).length, 1);
});

test('S3 expiry or withdrawal suppresses the follow-up but not born primary hits', () => {
  for (const action of ['expiry', 'retreat', 'death']) {
    const f = make({ skill: 3 }), e = enemy(f.b);
    activate(f); f.links.launch(e, 141, 3);
    if (action === 'expiry') f.u.skill.end('fixture');
    else if (action === 'retreat') f.b.retreat(f.u);
    else f.b.kill(f.u, null);
    advance(f.b, 1); assert.equal(f.hits.length, 3);
    assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s3-return')).length, 0);
    assert.equal(f.b.projectiles.list.length, 0);
  }
});

test('S3 tile follow-up is not a circular explosion and respects selected camouflage filters', () => {
  const f = make({ skill: 3 }), far = enemy(f.b, { x: 6 }),
    diagonal = enemy(f.b, { x: 5, y: 2 }), outside = enemy(f.b, { x: 5.6, y: 2 }),
    camou = enemy(f.b, { x: 3, y: 1 });
  f.b.addBuff(camou, { key: 'camou', flags: { camou: true } });
  activate(f); f.links.launch(far, 151, 3); advance(f.b, 1);
  const follow = f.hits.filter(h => h.dmg.tags.includes('narant:s3-return'));
  assert.equal(follow.length, 1); assert.equal(follow[0].target, diagonal);
  assert.ok(diagonal.findBuff('sluggish')); near(outside.hp, 1e7); near(camou.hp, 1e7);
});

test('S3 lifetime failure never fabricates a complete return or delayed splash', () => {
  const f = make({ skill: 3 }), e = enemy(f.b);
  activate(f);
  f.b.projectiles.registerSpeedAura({ owner: f.u, contains: p => p.data.narantVariant.endsWith('s3_2'), scale: .001 });
  const state = f.links.launch(e, 161, 3); advance(f.b, 10.1);
  assert.equal(state.failed, true); assert.equal(state.complete, true); assert.equal(f.links.canAttack(), true);
  assert.equal(f.hits.length, 3); assert.equal(f.hits.filter(h => h.dmg.tags.includes('narant:s3-return')).length, 0);
  assert.equal(f.b.projectiles.list.length, 0);
  advance(f.b, 1); assert.equal(f.hits.length, 3);
});
