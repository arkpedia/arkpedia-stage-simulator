// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-texas-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_1028_texas2';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a - z) < tol, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', beforeDeploy = null } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] }, { seed: 1 });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const victims = beforeDeploy?.(b);
  const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts, victims };
}
function enemy(b, { x = 6, y = 5, fly = false, hp = 100000, res = 0 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def: 0, res, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function shot(b, u) { const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  assert.ok(targets.length); performAttack(b, u, p, targets); u.atkCd = 1000; }
const outgoing = (rs, tag = null) => rs.filter(r => r.target.side === 'enemy' && (!tag || r.dmg.tags.includes(tag)));
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_texas2_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
test('exact evidence retains 30 ranks, four native modes, delivered facings, clock and no parity claim', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 13);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  for (const face of ['Front', 'Back']) {
    const m = source.models[ID][face]; assert.equal(m.sha256, source.officialSkeletonBindings[ID][face].sha256);
    near(m.hits.Attack[0], .367); near(m.hits.Skill_2_Loop[0], .267);
    near(m.hits.Skill_2_Loop[1], .367); near(m.hits.Skill_3_Loop[0], .367);
    assert.deepEqual(m.hits.Start ?? [], []); near(m.durations.Start, 1);
    assert.ok(m.durations.Start_3_2 > 0);
  }
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: talent and skill ATK add, silence and target-owned fixed DoT`, () => {
  const { b, u, receipts } = make({ rank }), e = enemy(b), bb = bbFor(0, rank);
  near(u.s.atk, u.base.atk * (1 + bb.atk + .2));
  assert.equal(u.s.flags.untargetable, true); assert.equal(u.s.flags.noBlock, true);
  advance(b, 1.05); shot(b, u); advance(b, .5);
  assert.equal(e.s.flags.silence, true); assert.equal(outgoing(receipts, 'texas2:attack').length, 1);
  near(outgoing(receipts)[0].amount, u.s.atk); advance(b, 1);
  near(outgoing(receipts, 'texas2:dot')[0].amount, bb['attack@texas2_s_1[dot].dot_damage']);
  assert.equal(outgoing(receipts, 'texas2:dot')[0].dmg.isAttack, false);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: delayed ground burst debuffs before damage, two attacks to one victim`, () => {
  const { b, u, receipts, victims: [e, fly] } = make({ skill: 1, rank,
    beforeDeploy: b => [enemy(b, { res: 50 }), enemy(b, { x: 6.1, fly: true })] });
  const bb = bbFor(1, rank), atk = u.s.atk;
  assert.equal(!!u.s.flags.untargetable, false); near(atk, u.base.atk * (1 + bb.atk + .2));
  advance(b, .15); assert.equal(outgoing(receipts).length, 0);
  advance(b, .1); near(e.s.res, 50 * (1 + bb.magic_resistance));
  near(outgoing(receipts)[0].amount, atk * bb.atk_scale * (1 - e.s.res / 100)); near(fly.hp, fly.s.maxHp);
  advance(b, 1); shot(b, u); advance(b, .34);
  assert.equal(outgoing(receipts, 'texas2:attack').length, 1); advance(b, .12);
  const hits = outgoing(receipts, 'texas2:attack'); assert.equal(hits.length, 2);
  assert.equal(hits[0].target, e); assert.equal(hits[1].target, e); assert.equal(hits[0].type, 'arts');
  near(hits[1].time - hits[0].time, .1, b.dt + 1e-6);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: two area pulses including flyers, distinct capped delayed rain`, () => {
  const { b, u, receipts, victims } = make({ skill: 2, rank,
    beforeDeploy: b => Array.from({ length: 6 }, (_, i) => enemy(b, { x: 5.4 + i / 12, fly: !!(i % 2) })) });
  const bb = bbFor(2, rank); advance(b, .6); assert.equal(outgoing(receipts).length, 0);
  advance(b, .1); assert.equal(outgoing(receipts, 'texas2:born').length, 6);
  advance(b, .2); assert.equal(outgoing(receipts, 'texas2:born').length, 12);
  for (const hit of outgoing(receipts, 'texas2:born')) {
    near(hit.amount, u.s.atk * bb['appear.atk_scale']); assert.equal(hit.target.s.flags.stun, true);
  }
  advanceTo(b, 1.4); assert.equal(outgoing(receipts, 'texas2:rain').length, 0);
  advanceTo(b, 1.9); const rain = outgoing(receipts, 'texas2:rain');
  assert.equal(rain.length, bb.max_target); assert.equal(new Set(rain.map(r => r.target)).size, bb.max_target);
  for (const hit of rain) { near(hit.amount, u.s.atk * bb.atk_scale); assert.ok(hit.time > 1.4 && hit.time <= 1.9); }
  assert.ok(victims.some(e => e.motion === 'FLY' && outgoing(receipts).some(r => r.target === e)));
  advanceTo(b, u.skill.duration + 2);
  assert.equal(u.skill.active, false); assert.equal(skillHud(u.skill), null);
  const ticks = Math.floor((u.skill.duration - .4) / bb['texas2_s_3[sword].interval'] + 1e-9) + 1;
  assert.equal(outgoing(receipts, 'texas2:rain').length, ticks * bb.max_target);
});
for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) test(`ordinary and Arts double-strike literal facing ${dir}`, () => {
  const { b, u, receipts } = make({ skill: 1, dir }); advance(b, 1.1);
  const e = enemy(b, { x: 5 + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0),
    y: 5 + (dir === 'UP' ? 1 : dir === 'DOWN' ? -1 : 0) });
  shot(b, u); advance(b, .45); assert.equal(outgoing(receipts).length, 2);
  advanceTo(b, 12); near(u.s.atk, u.base.atk);
  assert.equal(skillHud(u.skill), null); shot(b, u); advance(b, .45);
  assert.equal(outgoing(receipts, 'texas2:attack').length, 3); assert.equal(outgoing(receipts).at(-1).type, 'phys');
  assert.ok(e.hp < e.s.maxHp);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 5]) test(`promotion/potential E${elite} P${potential} and all HP damage channels`, () => {
  const { b, u } = make({ elite, potential }), talent = elite === 2 ? (potential === 5 ? .3 : .25) : 0;
  near(u.s.aspd, u.base.aspd + (elite === 2 ? potential === 5 ? 10 : 8 : 0));
  for (const type of ['phys', 'arts', 'true', 'elemental']) {
    u.hp = u.s.maxHp;
    const amount = b.dealDamage(null, u, { amount: 100, type, ignoreSelect: true });
    near(amount, (type === 'phys' ? Math.max(5, 100 - u.s.def) : type === 'arts' ? 100 * (1 - u.s.res / 100) : 100) * (1 - talent));
  }
  u.hp = u.s.maxHp; near(b.loseHp(u, 100), 100);
  b.applyStatus(u, 'sanctuary', { key: 'test:stronger', value: .4 });
  near(u.s.physTakenMul, .6); near(u.s.artsTakenMul, .6); near(u.s.trueTakenMul, 1 - talent);
});
test('elemental HP sanctuary takes the strongest masked producer and preserves fallback', () => {
  const { b, u } = make();
  b.addBuff(u, { key: 'test:stronger', status: 'sanctuary', mods: { elementalTakenMul: .6 } });
  near(u.s.elementalTakenMul, .6); b.removeBuff(u, 'test:stronger'); near(u.s.elementalTakenMul, .75);
  b.dealDamage(null, u, { amount: 100, type: 'element', element: 'burn' }); near(u.elem.burn, 100);
});
for (const skill of [0, 1, 2]) test(`S${skill + 1} first kill queues one reset, heals without modifiers and replays native birth`, () => {
  const { b, u } = make({ skill }); advance(b, 1.1); u.hp = u.s.maxHp / 2;
  b.addBuff(u, { key: 'test:heal-mods', mods: { healingTakenMul: .1, healingDealtMul: .1 } });
  let healHooks = 0; b.on('heal', () => { healHooks++; });
  const e = enemy(b); b.kill(e, u); assert.equal(u.mem.texasPendingReset, true);
  assert.equal(u.skill.activations, 1); assert.equal(u.findBuff(`texas2:swordsmanship:${u.id}`), null);
  advance(b, .1); assert.equal(u.skill.activations, 2); near(u.hp, u.s.maxHp); assert.equal(healHooks, 0);
  assert.equal(u.mem.regularFormVisual.clip, skill === 2 ? 'Start_3_2' : skill === 1 ? 'Start_2' : 'Start');
  b.kill(enemy(b), u); advance(b, 1.2); assert.equal(u.skill.activations, 2);
});
test('first kill inside birth pulse finishes its phase before reset and retains pending through silence', () => {
  const { b, u } = make({ skill: 2, beforeDeploy: b => [enemy(b, { hp: 1 })] });
  advance(b, .7); assert.equal(u.mem.texasPendingReset, true); assert.equal(u.skill.activations, 1);
  b.applyStatus(u, 'silence', { duration: 1 }); advance(b, .8); assert.equal(u.skill.activations, 1);
  advance(b, .3); assert.equal(u.skill.activations, 2);
});
test('a revived victim and another operator kill cannot spend either talent', () => {
  const { b, u } = make(); advance(b, 1.1); const e = enemy(b);
  b.on('kill', ({ victim }) => { if (victim === e) victim.hp = 20; }); b.kill(e, u);
  assert.equal(e.alive, true); assert.equal(u.mem.texasResetUsed, false);
  assert.ok(u.findBuff(`texas2:swordsmanship:${u.id}`));
  b.kill(enemy(b), null); advance(b, .1); assert.equal(u.skill.activations, 1);
});
test('first kill after expiry reactivates once, respects heal-free and pending stun', () => {
  const { b, u } = make(); advance(b, 13); assert.equal(skillHud(u.skill), null);
  u.hp = u.s.maxHp / 2; b.addBuff(u, { key: 'test:heal-free', flags: { healFree: true } });
  b.applyStatus(u, 'stun', { duration: .5 }); b.kill(enemy(b), u);
  advance(b, .3); assert.equal(u.skill.activations, 1); advance(b, .3);
  assert.equal(u.skill.activations, 2); near(u.hp, u.s.maxHp / 2);
});
test('DoT refresh extends without resetting phase/stacking, lives through expiry and retreat', () => {
  const { b, u, receipts } = make(); advance(b, 1.1); const e = enemy(b);
  shot(b, u); advance(b, .6); shot(b, u); advance(b, .5);
  assert.equal(e.buffs.filter(v => v.key === `texas2:dot:${u.id}`).length, 1);
  advance(b, .5); assert.equal(outgoing(receipts, 'texas2:dot').length, 1);
  b.retreat(u); advance(b, 1); assert.equal(outgoing(receipts, 'texas2:dot').length, 2);
  assert.equal(!!e.s.flags.silence, true);
});
for (const interruption of ['death', 'stun', 'disarm', 'end']) test(`S2 retained second hit cancels on ${interruption}`, () => {
  const { b, u, receipts } = make({ skill: 1 }); advance(b, 1.1); const e = enemy(b), other = enemy(b, { x: 6.1 });
  shot(b, u); advance(b, .34); assert.equal(outgoing(receipts).length, 1);
  if (interruption === 'death') b.kill(e, null);
  else if (interruption === 'end') u.skill.end('test');
  else b.addBuff(u, { key: 'test:interrupt', duration: .01, flags: { [interruption]: true } });
  advance(b, .2); assert.equal(outgoing(receipts).length, 1); near(other.hp, other.s.maxHp);
});
test('rain retains its victim out of range and emitted impact survives source retreat', () => {
  const { b, u, receipts } = make({ skill: 2 }); const e = enemy(b);
  advanceTo(b, 1.5); const first = outgoing(receipts, 'texas2:rain').length;
  e.x = 12; e.y = 12; b._buildEnemyIndex(); b.retreat(u);
  advance(b, .5); assert.ok(outgoing(receipts, 'texas2:rain').length > first);
  const count = outgoing(receipts, 'texas2:rain').length; advance(b, 2); assert.equal(outgoing(receipts, 'texas2:rain').length, count);
});
test('attached rain survives disarm and stun; ordinary attack still cannot act', () => {
  const { b, u, receipts } = make({ skill: 2 }); const e = enemy(b); advance(b, 1.1);
  b.addBuff(u, { key: 'test:control', duration: 2, flags: { disarm: true, stun: true } });
  advance(b, 1); assert.ok(outgoing(receipts, 'texas2:rain').length > 0); assert.equal(u.canAct, false);
  assert.equal(outgoing(receipts, 'texas2:attack').length, 0); assert.ok(e.hp < e.s.maxHp);
});
test('redeployment restores talents and first-kill reset without accepting manual activation', () => {
  const { b, u } = make(); advance(b, 1.1); b.kill(enemy(b), u); advance(b, .1);
  assert.equal(u.skill.activations, 2); b.retreat(u);
  advance(b, 25); b.addDp('arkpedia', 99); const next = b.deployOperator(ID, 5, 5, 'RIGHT');
  assert.notEqual(next, u); assert.equal(next.mem.texasResetUsed, false);
  assert.ok(next.findBuff(`texas2:swordsmanship:${next.id}`)); assert.equal(next.skill.activations, 1);
  assert.equal(next.skill.activate('manual'), false); b.kill(enemy(b), next); advance(b, 1.2);
  assert.equal(next.skill.activations, 2);
});
test('S3 CAST selects at release then retains the first pulse set for its second hit', () => {
  const { b, u, receipts } = make({ skill: 2 }); advance(b, .4); const e = enemy(b);
  advance(b, .3); assert.equal(outgoing(receipts, 'texas2:born').length, 1);
  const late = enemy(b, { x: 5.4 }); e.x = 10; e.y = 10; b._buildEnemyIndex();
  advance(b, .2); const pulses = outgoing(receipts, 'texas2:born');
  assert.equal(pulses.length, 2); assert.ok(pulses.every(r => r.target === e)); near(late.hp, late.s.maxHp);
});
test('S2 START locks its area selection before a later entrant', () => {
  const { b, receipts } = make({ skill: 1 }); advance(b, .1); enemy(b);
  advance(b, .2); assert.equal(outgoing(receipts, 'texas2:born').length, 0);
});
test('S1 silence immunity does not cancel its independent DoT and physical hit', () => {
  const { b, u, receipts } = make(); advance(b, 1.1); const e = enemy(b); e.def.immune.add('silence');
  shot(b, u); advance(b, .5); assert.equal(!!e.s.flags.silence, false);
  assert.equal(outgoing(receipts, 'texas2:attack').length, 1); advance(b, 1);
  assert.equal(outgoing(receipts, 'texas2:dot').length, 1);
});
test('S1 DoT remains after the finite skill expires without extending the ATK stance', () => {
  const { b, u, receipts } = make(); advanceTo(b, 11); const e = enemy(b);
  shot(b, u); advance(b, .5); advanceTo(b, 12.7);
  assert.equal(u.skill.active, false); near(u.s.atk, u.base.atk);
  assert.equal(outgoing(receipts, 'texas2:dot').length, 1); assert.ok(e.hp < e.s.maxHp);
});
test('a transient birth interruption cancels unfired pulse, but does not erase the attached rain', () => {
  const { b, u, receipts } = make({ skill: 2, beforeDeploy: b => [enemy(b)] });
  advance(b, .4); b.applyStatus(u, 'stun', { duration: .01 }); advance(b, .5);
  assert.equal(outgoing(receipts, 'texas2:born').length, 0); advanceTo(b, 1.9);
  assert.equal(outgoing(receipts, 'texas2:rain').length, 1);
});
test('ordinary heals retain modifiers and hooks unless explicitly source-exempt', () => {
  const { b, u } = make(); advance(b, 1.1); u.hp = 10;
  b.addBuff(u, { key: 'test:heal-modifier', mods: { healingTakenMul: .5 } });
  let hooks = 0; b.on('heal', ctx => { hooks++; ctx.amount *= .5; });
  near(b.heal(u, u, 100, { self: true }), 25); assert.equal(hooks, 1);
  near(b.heal(u, u, 100, { self: true, skipModifierEvent: true }), 100); assert.equal(hooks, 1);
  b.addBuff(u, { key: 'test:heal-free', flags: { healFree: true } });
  near(b.heal(u, u, 100, { self: true, skipModifierEvent: true }), 0);
});
test('E0 has no first-kill reset and no post-kill passive ATK', () => {
  const { b, u } = make({ elite: 0, rank: 4 }); advance(b, 1.1); b.kill(enemy(b), u);
  advance(b, .2); assert.equal(u.skill.activations, 1); assert.equal(u.mem.texasResetUsed, false);
  advance(b, 14); near(u.s.atk, u.base.atk); assert.equal(skillHud(u.skill), null);
});

test('S2 slowed attack retains its prepared multi-hit spacing despite first-hit ASPD changes', () => {
  const { b, u, receipts } = make({ skill: 1 }); advance(b, 1.1); enemy(b);
  b.addBuff(u, { key: 'test:slow', mods: { aspd: -58 } }); near(u.s.aspd, 50);
  b.on('damaged', ctx => { if (ctx.source === u && ctx.dmg.tags.includes('texas2:attack')) b.removeBuff(u, 'test:slow'); });
  shot(b, u); advance(b, 1); const hits = outgoing(receipts, 'texas2:attack');
  assert.equal(hits.length, 2); near(hits[1].time - hits[0].time, .2, b.dt + 1e-6);
});

test('born sequence shows selected effect seconds, stays full at startup and never presents manual readiness', () => {
  const { b, u } = make({ skill: 2 }); const hud = skillHud(u.skill);
  assert.equal(hud.text, 'Skill active · 8s'); near(hud.fraction, 1); assert.equal(hud.canActivate, false);
  advance(b, .5); near(skillHud(u.skill).fraction, 1, .01); advance(b, 2);
  assert.ok(skillHud(u.skill).fraction < 1); advance(b, 8); assert.equal(skillHud(u.skill), null);
});
