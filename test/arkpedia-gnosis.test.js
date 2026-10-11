// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-gnosis-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_206_gnosis', BEAGLE = 'char_122_beagle', MEL = 'char_208_melan';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a - z) < tol, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', extra = false } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build, ...(extra ? [BEAGLE, MEL].map(k => defaultBuild(d.operators[k])) : [])] }, { seed: 1 });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts };
}
function enemy(b, { x = 6, y = 5, fly = false, hp = 100000 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u) { const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  assert.ok(targets.length); performAttack(b, u, p, targets); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_gnosis_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
const comp = (key, field) => source.projectiles[key].flatMap(g => g.components).map(c => c.data).find(c => c[field] != null);
test('source evidence: 30 ranks, eventless native S3 loop, actual facings and projectile clock', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 13);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  for (const face of ['Front', 'Back']) {
    const m = source.models[ID][face];
    assert.equal(m.sha256, source.officialSkeletonBindings[ID][face].sha256);
    assert.deepEqual(m.hits.Skill_4_Loop ?? [], []);
    near(m.hits.Skill_4_End[0], .433); near(m.hits.Skill[0], .367);
    near(m.hits.Skill_2[0], .433); near(m.hits.Skill_3[0], .433);
  }
  for (const p of ['projectile_chr_gnosis', 'projectile_chr_gnosis_s1', 'projectile_chr_gnosis_s3']) {
    near(comp(p, '_speed')._speed, 9); near(comp(p, '_lifeTime')._lifeTime, 10);
  }
});
for (const elite of [0, 1, 2]) for (const potential of [1, 5]) test(`ordinary hit E${elite} P${potential}: Cold precedes damage and selected Fragile`, () => {
  const { b, u, receipts } = make({ elite, potential }), e = enemy(b), side = enemy(b, { x: 6.2, fly: true });
  shot(b, u); advance(b, .8); const hits = outgoing(receipts, u);
  assert.equal(hits.length, 1); assert.equal(hits[0].target, e); near(side.hp, side.s.maxHp);
  const weak = elite === 0 ? 0 : (elite === 1 ? .15 : .25) + (potential >= 5 ? .02 : 0);
  near(hits[0].amount, u.s.atk * (1 + weak)); assert.equal(!!e.s.flags.cold, elite > 0);
  if (elite > 0) near(e.s.aspd, e.base.aspd - 30);
});
for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) test(`source-facing normal and S1 release ${dir}`, () => {
  const { b, u, receipts } = make({ dir });
  const e = enemy(b, { x: u.x + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0),
    y: u.y + (dir === 'UP' ? 1 : dir === 'DOWN' ? -1 : 0), fly: true });
  cast(b, u); shot(b, u); advance(b, .8);
  assert.equal(outgoing(receipts, u).length, 2); assert.equal(e.s.flags.freeze, true);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: one cast, two delayed shells, pairing and SP unlock`, () => {
  const { b, u, receipts } = make({ rank }), e = enemy(b), bb = bbFor(0, rank), atk = u.s.atk;
  cast(b, u); shot(b, u); advance(b, .3); assert.equal(outgoing(receipts, u).length, 0);
  advance(b, .266666667); assert.equal(outgoing(receipts, u).length, 1); near(u.skill.spTotal, 0);
  advance(b, .3); const hits = outgoing(receipts, u); assert.equal(hits.length, 2);
  near(hits[0].amount, atk * bb.atk_scale * 1.25); near(hits[1].amount, atk * bb.atk_scale * 1.5);
  near(hits[1].time - hits[0].time, .2, b.dt + 1e-6);
  assert.equal(e.s.flags.freeze, true); near(e.s.aspd, e.base.aspd);
  assert.equal(u.mem.gnosisCast, null); assert.ok(u.skill.spTotal > 0);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: first charge, full charge, all SP consumed, flyers`, () => {
  const first = make({ skill: 1, rank }), bb = bbFor(1, rank), e = enemy(first.b), fly = enemy(first.b, { fly: true, x: 6.1 });
  first.u.skill.setSpTotal(first.u.skill.spCost * 1.75);
  assert.equal(skillHud(first.u.skill).charged, undefined); assert.equal(skillHud(first.u.skill).ready, true);
  assert.equal(first.u.skill.activate('test'), true); near(first.u.skill.spTotal, 0);
  advance(first.b, .4); assert.equal(outgoing(first.receipts, first.u).length, 0); advance(first.b, .1);
  for (const victim of [e, fly]) {
    assert.equal(victim.s.flags.cold, true); assert.equal(!!victim.s.flags.freeze, false);
    near(outgoing(first.receipts, first.u).find(r => r.target === victim).amount, first.u.s.atk * bb.atk_scale * 1.25);
  }
  advance(first.b, 1); assert.ok(first.u.skill.spTotal > 0);
  const full = make({ skill: 1, rank }), frozen = enemy(full.b); full.u.skill.setSpTotal(full.u.skill.spCost * 2);
  assert.equal(skillHud(full.u.skill).charged, true); assert.match(skillHud(full.u.skill).text, /Charged/);
  assert.equal(full.u.skill.activate('test'), true); near(full.u.skill.spTotal, 0);
  assert.equal(full.u.mem.regularFormVisual.clip, 'Skill_3'); advance(full.b, .5);
  assert.equal(frozen.s.flags.freeze, true); assert.equal(!!frozen.s.flags.cold, false);
  near(outgoing(full.receipts, full.u)[0].amount, full.u.s.atk * bb.atk_scale * 1.5);
  assert.equal(full.b.projectiles.list.length, 0);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: two targets, held Freeze, delayed final damage and cleanup`, () => {
  const { b, u, receipts } = make({ skill: 2, rank }), bb = bbFor(2, rank), e = enemy(b), second = enemy(b, { x: 6.1, fly: true });
  cast(b, u); near(u.s.aspd, u.base.aspd + bb.attack_speed);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_4_Begin'); advance(b, .4);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_4_Loop');
  shot(b, u); advance(b, .2); assert.equal(outgoing(receipts, u).length, 2);
  shot(b, u); advance(b, .2); assert.equal(outgoing(receipts, u).length, 4);
  for (const v of [e, second]) assert.equal(v.s.flags.freeze, true);
  advanceTo(b, sDuration(u) - .5); for (const v of [e, second]) assert.equal(v.s.flags.freeze, true);
  const normalHits = outgoing(receipts, u).length;
  advanceTo(b, sDuration(u) + .15); const final = outgoing(receipts, u).slice(normalHits);
  assert.equal(final.length, 2); for (const r of final) near(r.amount, u.s.atk * bb.atk_scale * 1.5);
  assert.equal(u.skill.active, false); for (const v of [e, second]) assert.equal(!!v.s.flags.freeze, false);
  near(u.s.aspd, u.base.aspd); advance(b, .3); assert.equal(u.mem.gnosisFinisher, null);
  assert.ok(u.skill.spTotal > 0); assert.equal(u.mem.regularFormVisual, null);
});
const sDuration = u => u.skill.duration;
test('S3 prioritizes unfrozen Cold, ordinary, then Frozen while retaining two victims', () => {
  const { b, u } = make({ skill: 2 }), frozen = enemy(b), ordinary = enemy(b, { x: 6.1 }), cold = enemy(b, { x: 6.2 });
  cast(b, u); advance(b, .4);
  b.applyStatus(frozen, 'freeze', { duration: 1 }); b.applyStatus(cold, 'cold', { duration: 1 });
  assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), [cold, ordinary]);
  ordinary.hidden = true; b._buildEnemyIndex(); assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), [cold, frozen]);
});
test('S3 original aura detaches on range exit and owner retreat without erasing another producer', () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, .4);
  b.applyStatus(e, 'freeze', { key: 'test:other-freeze', duration: 1 }); advance(b, .2);
  assert.ok(e.buffs.some(v => v.data.gnosisFreezeHolder)); advance(b, 1.1);
  assert.equal(e.s.flags.freeze, true); near(e.s.res, Math.max(0, e.base.res - 15));
  e.x = 15; b._buildEnemyIndex(); advance(b, .1); assert.equal(!!e.s.flags.freeze, false);
  e.x = 6; b._buildEnemyIndex(); b.applyStatus(e, 'freeze', { key: 'test:other-freeze', duration: 10 }); advance(b, .1);
  b.retreatOperator(ID); assert.equal(e.s.flags.freeze, true); assert.ok(e.findBuff('test:other-freeze'));
  assert.ok(!e.buffs.some(v => v.data.gnosisFreezeHolder));
});
test('S3 aura keeps one RES reduction when the original finite Freeze expires', () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); e.base.res = 40; e.markDirty();
  cast(b, u); b.applyStatus(e, 'freeze', { duration: .2 }); advance(b, .1); near(e.s.res, 25);
  advance(b, .3); near(e.s.res, 25); assert.equal(e.s.flags.freeze, true);
  b.retreatOperator(ID); near(e.s.res, 40); assert.equal(!!e.s.flags.freeze, false);
});
test('Freeze immunity: independent Cold credits never stack ASPD or trigger a rejected Freeze', () => {
  const { b, u } = make({ skill: 1 }), e = enemy(b); e.def.immune.add('frozen');
  for (let n = 0; n < 3; n++) {
    u.skill.setSpTotal(u.skill.spCost * 2); assert.equal(u.skill.activate('test'), true); advance(b, 1.25);
    near(e.s.aspd, e.base.aspd - 30); assert.equal(!!e.s.flags.freeze, false);
  }
  assert.equal(e.buffs.filter(v => v.status === 'cold').length, 3);
  advance(b, 4); near(e.s.aspd, e.base.aspd);
});
test('Cold pairing uses accepted post-resistance lifetimes once, never reuses an old pair', () => {
  const { b, u } = make({ skill: 1 }), e = enemy(b);
  b.applyStatus(e, 'resist', { value: .5 });
  b.applyStatus(e, 'cold', { duration: 8, coldPairing: 'independent', key: 'test:cold' });
  cast(b, u); advance(b, .5);
  assert.equal(e.s.flags.freeze, true);
  assert.ok(e.findBuff('freeze').timeLeft > 3.4 && e.findBuff('freeze').timeLeft < 3.7);
  assert.equal(e.findBuff('test:cold').data.gnosisPaired, true);
  assert.equal(e.buffs.filter(v => v.status === 'cold' && v.data.gnosisPaired).length, 2);
});
for (const aspd of [50, 200]) test(`native release scales S1 capped but S2 uncapped at ${aspd} ASPD`, () => {
  const first = make(), e = enemy(first.b); first.b.addBuff(first.u, { key: 'test:aspd', mods: { aspd: aspd - first.u.s.aspd } });
  cast(first.b, first.u); shot(first.b, first.u);
  const firstRelease = .367 / Math.min(1, aspd / 100);
  advance(first.b, firstRelease - .05); assert.equal(first.b.projectiles.list.length, 0);
  advance(first.b, .1); assert.ok(first.b.projectiles.list.length);
  assert.equal(e.hp, e.s.maxHp);
  const second = make({ skill: 1 }); enemy(second.b);
  second.b.addBuff(second.u, { key: 'test:aspd', mods: { aspd: aspd - second.u.s.aspd } });
  cast(second.b, second.u); advance(second.b, .433 / (aspd / 100) - .05);
  assert.equal(outgoing(second.receipts, second.u).length, 0); advance(second.b, .1);
  assert.equal(outgoing(second.receipts, second.u).length, 1);
});
test('S1 target loss before emission refunds its charge; fired target loss releases the SP lock', () => {
  const first = make(), e = enemy(first.b); cast(first.b, first.u); shot(first.b, first.u);
  first.b.dealDamage(null, e, { amount: e.hp * 2, type: 'true' }); advance(first.b, .5);
  assert.equal(first.u.mem.gnosisCast, null); assert.equal(first.u.skill.charges, 1);
  const second = make(), doomed = enemy(second.b); cast(second.b, second.u); shot(second.b, second.u);
  advance(second.b, .433333334); assert.equal(second.b.projectiles.list.length, 1);
  second.b.dealDamage(null, doomed, { amount: doomed.hp * 2, type: 'true' }); advance(second.b, .4);
  assert.equal(second.u.mem.gnosisCast, null); assert.ok(second.u.skill.spTotal > 0);
});
for (const skill of [0, 1]) test(`brief control cancels unreleased S${skill + 1} without a late attack`, () => {
  const { b, u, receipts } = make({ skill }); enemy(b); cast(b, u); if (!skill) shot(b, u);
  b.applyStatus(u, 'stun', { duration: .1 }); advance(b, 1.3);
  assert.equal(outgoing(receipts, u).length, 0); assert.equal(u.mem.gnosisCast, null);
  assert.ok(u.skill.spTotal > 0); assert.equal(u.mem.regularFormVisual, null);
});
test('fired ordinary projectiles survive withdrawal but Fragile aura immediately detaches', () => {
  const { b, u, receipts } = make(), e = enemy(b); shot(b, u); advance(b, .533333334);
  assert.ok(b.projectiles.list.length); b.retreatOperator(ID); advance(b, .4);
  assert.equal(outgoing(receipts, u).length, 1); assert.equal(e.s.flags.cold, true);
  near(outgoing(receipts, u)[0].amount, u.s.atk);
});
test('Fragile follows current range and strongest competing producer without additive stacking', () => {
  const { b, u, receipts } = make(), e = enemy(b);
  b.applyStatus(e, 'fragile', { key: 'test:weak', value: .4, duration: 20 });
  shot(b, u); advance(b, .8); near(outgoing(receipts, u)[0].amount, u.s.atk * 1.4);
  e.x = 15; b._buildEnemyIndex(); advance(b, .1); assert.ok(!e.findBuff(`gnosis:weak:${u.id}`));
  assert.ok(e.findBuff('test:weak')); b.retreatOperator(ID); assert.ok(e.findBuff('test:weak'));
});
test('Kjerag Resist begins at ten seconds, halves accepted control, and resets on withdrawal', () => {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  const roster = [ID, 'char_172_svrash', 'char_198_blackd', BEAGLE].map(k => ({ ...defaultBuild(d.operators[k]), elite: d.operators[k].phases.length - 1,
    level: d.operators[k].phases.at(-1).maxLevel }));
  const b = new StandardBattle(d, { operators: roster }); b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' })); b.addDp('arkpedia', 99);
  const u = b.deployOperator(ID, 1, 1, 'RIGHT'), silver = b.deployOperator('char_172_svrash', 2, 2, 'RIGHT'),
    courier = b.deployOperator('char_198_blackd', 2, 3, 'RIGHT'), outsider = b.deployOperator(BEAGLE, 2, 4, 'RIGHT');
  advanceTo(b, 9.9); near(b.resistOf(silver), 0); advance(b, .2);
  for (const a of [u, silver, courier]) near(b.resistOf(a), .5); near(b.resistOf(outsider), 0);
  b.applyStatus(silver, 'stun', { duration: 4 }); near(silver.findBuff('stun').timeLeft, 2);
  b.retreatOperator(ID); near(b.resistOf(silver), 0); near(b.resistOf(courier), 0);
});
test('S3 delayed finisher refuses stun at its start and cannot fire after withdrawal', () => {
  const first = make({ skill: 2 }), e = enemy(first.b); cast(first.b, first.u);
  first.b.applyStatus(e, 'freeze', { duration: 1 }); advanceTo(first.b, first.u.skill.duration - .6);
  first.b.applyStatus(first.u, 'stun', { duration: 1 }); advance(first.b, 1.5);
  assert.equal(outgoing(first.receipts, first.u).length, 0); assert.equal(!!e.s.flags.freeze, false);
  const second = make({ skill: 2 }); enemy(second.b); cast(second.b, second.u);
  advanceTo(second.b, second.u.skill.duration - .35); assert.ok(second.u.mem.gnosisFinisher);
  second.b.retreatOperator(ID); advance(second.b, 1); assert.equal(outgoing(second.receipts, second.u).length, 0);
});
test('S3 finisher only clears Freeze after damage and leaves unrelated Sleep/Cold producers', () => {
  const { b, u, receipts } = make({ skill: 2 }), frozen = enemy(b), ordinary = enemy(b, { x: 6.1 }), sleeper = enemy(b, { x: 6.2 });
  cast(b, u); b.applyStatus(frozen, 'freeze', { key: 'test:foreign', duration: 20 });
  b.applyStatus(frozen, 'cold', { duration: 20, coldPairing: 'independent' });
  b.applyStatus(sleeper, 'sleep', { duration: 20 }); advance(b, u.skill.duration + .2);
  assert.equal(outgoing(receipts, u).length, 1); assert.equal(outgoing(receipts, u)[0].target, frozen);
  assert.equal(!!frozen.s.flags.freeze, false); assert.equal(frozen.s.flags.cold, true); near(frozen.s.aspd, frozen.base.aspd - 30);
  assert.equal(sleeper.s.flags.sleep, true); near(ordinary.hp, ordinary.s.maxHp);
});
test('real AI uses repeating S3 shots and never damages more than its two selected targets', () => {
  const { b, u, receipts } = make({ skill: 2 });
  const enemies = [enemy(b), enemy(b, { x: 6.1 }), enemy(b, { x: 6.2 })];
  u.profile.canAttack = () => !u.mem.gnosisCast && !u.mem.gnosisFinisher; u.atkCd = 0;
  cast(b, u); advance(b, 4);
  const hits = outgoing(receipts, u); assert.ok(hits.length >= 8);
  const attacks = new Map(); for (const hit of hits) { const targets = attacks.get(hit.dmg.attackId) ?? new Set(); targets.add(hit.target); attacks.set(hit.dmg.attackId, targets); }
  for (const targets of attacks.values()) assert.ok(targets.size <= 2);
  assert.ok(enemies.some(e => e.s.flags.freeze));
});
test('S1 reacquires a legal replacement instead of refunding a cast whose original target died', () => {
  const { b, u, receipts } = make(), original = enemy(b), replacement = enemy(b, { x: 6.2 });
  cast(b, u); shot(b, u); b.dealDamage(null, original, { amount: original.hp * 2, type: 'true' }); advance(b, .9);
  assert.equal(outgoing(receipts, u).length, 2); assert.ok(outgoing(receipts, u).every(r => r.target === replacement));
  assert.equal(u.skill.charges, 0);
});
test('an interrupted S3 End windup cannot deliver its final attack after control expires', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u);
  b.applyStatus(e, 'freeze', { duration: 1 }); advanceTo(b, u.skill.duration - .35);
  assert.ok(u.mem.gnosisFinisher); b.applyStatus(u, 'stun', { duration: .1 }); advance(b, 1);
  assert.equal(outgoing(receipts, u).length, 0); assert.equal(u.mem.gnosisFinisher, null); assert.ok(u.skill.spTotal > 0);
});
test('S2 first-charge cast freezes a Cold target using the longer accepted layer', () => {
  const { b, u, receipts } = make({ skill: 1 }), e = enemy(b);
  b.applyStatus(e, 'cold', { duration: 8, coldPairing: 'independent' }); cast(b, u); advance(b, .5);
  assert.equal(e.s.flags.freeze, true); assert.ok(e.findBuff('freeze').timeLeft > 7.4);
  near(outgoing(receipts, u)[0].amount, u.s.atk * u.skill.bb.atk_scale * 1.5);
});
test('rejected Cold causes no pairing or Fragile; damage still resolves independently', () => {
  const { b, u, receipts } = make({ skill: 1 }), e = enemy(b);
  b.on('beforeStatus', c => { if (c.status === 'cold') c.cancel = true; }); cast(b, u); advance(b, .5);
  assert.equal(!!e.s.flags.cold, false); assert.equal(!!e.s.flags.freeze, false);
  near(outgoing(receipts, u)[0].amount, u.s.atk * u.skill.bb.atk_scale);
});
test('projectile target buffs precede a shield/dodge output in this damage pipeline', () => {
  const { b, u, receipts } = make(), e = enemy(b); b.addBuff(e, { key: 'test:shield', shield: e.hp });
  shot(b, u); advance(b, .8); assert.equal(e.s.flags.cold, true); near(e.hp, e.s.maxHp);
  assert.ok(e.findBuff('test:shield').shield < e.hp); assert.equal(outgoing(receipts, u).length, 1); near(outgoing(receipts, u)[0].amount, 0);
  b.removeBuff(e, 'test:shield'); b.addBuff(e, { key: 'test:dodge', mods: { dodgeArts: 1 } });
  shot(b, u); advance(b, .8); assert.equal(e.s.flags.freeze, true); near(e.hp, e.s.maxHp);
  // Native DamageMissable/action-event ordering is separately bounded; this
  // records the adapter's actual order rather than claiming Unity parity.
});
