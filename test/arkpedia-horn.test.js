// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-horn-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4039_horn', BEAGLE = 'char_122_beagle', MEL = 'char_208_melan';
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
function enemy(b, { x = 8, y = 5, fly = false, hp = 100000 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u) { const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  assert.ok(targets.length); performAttack(b, u, p, targets); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_horn_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
const comp = (key, field) => source.projectiles[key].flatMap(g => g.components).map(c => c.data).find(c => c[field] != null);
test('native evidence retains all ranks, 14 templates, projectile boundaries and delivered facings', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 14);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  const bleed = source.templates['horn_s_3[overload_start]'].eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(bleed._skipModifierEvent, true); assert.equal(bleed._ignoreForSp, true);
  assert.equal(bleed._isRatioToMaxHp, true); assert.equal(bleed._isIncreasingToCap, true);
  near(comp('projectile_chr_horn', 'm_Radius').m_Radius, 1);
  near(comp('projectile_chr_horn_s1', 'm_Radius').m_Radius, 1.7);
  near(comp('projectile_chr_horn_s2_full', '_speed')._speed, 9);
  for (const face of ['Front', 'Back']) {
    assert.equal(source.models[ID][face].sha256, source.officialSkeletonBindings[ID][face].sha256);
    near(source.models[ID][face].hits.Attack_A[0], .3);
    near(source.models[ID][face].hits.Skill_1_B[0], .367);
    near(source.models[ID][face].hits.Skill_2_B_Loop[0], .333);
  }
});
for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5]) test(`Defender aura E${elite} P${potential}, ally masks, retirement`, () => {
  const { b, u } = make({ elite, potential, extra: true });
  const defender = b.deployOperator(BEAGLE, 3, 3, 'RIGHT'), guard = b.deployOperator(MEL, 3, 4, 'RIGHT');
  const bonus = elite === 0 ? 0 : (elite === 1 ? .1 : .2) + (potential >= 3 ? .03 : 0);
  near(u.s.atk, u.base.atk * (1 + bonus)); near(defender.s.atk, defender.base.atk * (1 + bonus));
  near(guard.s.atk, guard.base.atk * 1.08);
  b.addBuff(defender, { key: 'test:hide', flags: { stealth: true, untargetable: true } });
  advance(b, .1); near(defender.s.atk, defender.base.atk * (1 + bonus));
  b.retreatOperator(ID); near(defender.s.atk, defender.base.atk);
});
for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) test(`Fortress branches and facing ${dir}`, () => {
  const { b, u, receipts } = make({ dir });
  const dx = dir === 'RIGHT' ? 3 : dir === 'LEFT' ? -3 : 0;
  const dy = dir === 'UP' ? 3 : dir === 'DOWN' ? -3 : 0;
  const ranged = enemy(b, { x: u.x + dx, y: u.y + dy });
  const blocked = enemy(b, { x: u.x, y: u.y + .45 }); blocked.blockedBy = u; u.blocking = [blocked];
  const beside = enemy(b, { x: blocked.x + .3, y: blocked.y });
  shot(b, u); advance(b, .5);
  const hits = outgoing(receipts, u); assert.equal(hits.length, 1); assert.equal(hits[0].target, blocked);
  assert.equal(hits[0].dmg.applyWay, 'melee'); near(hits[0].amount, u.s.atk);
  blocked.hidden = true; beside.hidden = true; u.blocking = []; b._buildEnemyIndex();
  assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], ranged);
});
test('own-tile fallback, ranged priority, flyers and invalid targets', () => {
  const { b, u } = make(); const own = enemy(b, { x: 5 }), fly = enemy(b, { fly: true });
  assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], own); assert.equal(u.mem.hornMelee, true);
  const distant = enemy(b); assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], distant);
  assert.equal(u.mem.hornMelee, false); distant.hidden = true; own.hidden = true; b._buildEnemyIndex();
  assert.deepEqual(acquireTargets(b, u, effectiveProfile(u)), []); assert.equal(fly.isFlying, true);
});
test('normal ranged projectile delays impact, splashes radius one, excludes flyers', () => {
  const { b, u, receipts } = make(), e = enemy(b), side = enemy(b, { x: 8.95 }), out = enemy(b, { x: 9.05 }), fly = enemy(b, { x: 8.3, fly: true });
  shot(b, u); advance(b, .3); assert.equal(outgoing(receipts, u).length, 0);
  advance(b, .8); const hits = outgoing(receipts, u);
  assert.deepEqual(new Set(hits.map(r => r.target)), new Set([e, side]));
  assert.equal(out.hp, out.s.maxHp); assert.equal(fly.hp, fly.s.maxHp);
  assert.ok(hits.every(r => r.dmg.isSplash && r.dmg.applyWay === 'ranged'));
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: charged shot, damage, flare duration and detachment`, () => {
  const { b, u, receipts } = make({ rank }), bb = bbFor(0, rank);
  const e = enemy(b), hidden = enemy(b, { x: 9.4 }), outside = enemy(b, { x: 9.8 });
  b.addBuff(hidden, { key: 'test:stealth', flags: { stealth: true } });
  b.addBuff(outside, { key: 'test:stealth', flags: { stealth: true } });
  const atk = u.s.atk;
  u.skill.setSpTotal(u.skill.spCost * bb.cnt); assert.equal(u.skill.maxCharges, bb.cnt);
  assert.equal(u.skill.onAboutToAttack(), true); shot(b, u);
  advance(b, .3); assert.equal(outgoing(receipts, u).length, 0); advance(b, .9);
  const hits = outgoing(receipts, u); assert.deepEqual(new Set(hits.map(r => r.target)), new Set([e, hidden]));
  hits.forEach(r => near(r.amount, atk * bb.atk_scale)); assert.equal(u.skill.active, false);
  assert.equal(hidden.s.flags.reveal, true); assert.equal(outside.s.flags.reveal, undefined);
  hidden.x = 10; b._buildEnemyIndex(); advance(b, .1); assert.equal(hidden.s.flags.reveal, undefined);
  hidden.x = 9; b._buildEnemyIndex(); advance(b, .1); assert.equal(hidden.s.flags.reveal, true);
  b.retreatOperator(ID); advance(b, .3); assert.equal(hidden.s.flags.reveal, true);
  advance(b, bb.projectile_delay_time); assert.equal(hidden.s.flags.reveal, undefined);
});
test('S1 melee spends a charge, stays single-target, and creates no flare', () => {
  const { b, u, receipts } = make(), e = enemy(b, { x: 5.4 }), side = enemy(b, { x: 5.5 });
  e.blockedBy = u; u.blocking = [e]; cast(b, u); shot(b, u); advance(b, .6);
  const hits = outgoing(receipts, u); assert.equal(hits.length, 1); assert.equal(hits[0].target, e);
  near(hits[0].amount, u.s.atk * u.skill.bb.atk_scale); assert.equal(side.hp, side.s.maxHp);
  assert.equal(u.mem.hornFlareSeq, 0);
});
test('S1 flare reveals flying and target-free occupants while the damage remains ground-only/selectable', () => {
  const { b, u, receipts } = make(); enemy(b);
  const fly = enemy(b, { x: 8.3, fly: true }), free = enemy(b, { x: 8.5 });
  for (const e of [fly, free]) b.addBuff(e, { key: 'test:hidden', flags: { stealth: true } });
  b.addBuff(free, { key: 'test:free', flags: { untargetable: true } });
  cast(b, u); shot(b, u); advance(b, 1.2);
  assert.equal(fly.s.flags.reveal, true); assert.equal(free.s.flags.reveal, true);
  assert.equal(outgoing(receipts, u).length, 1); near(fly.hp, fly.s.maxHp); near(free.hp, free.s.maxHp);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: physical splash, half-ammo overload and dual receipts`, () => {
  const { b, u, receipts } = make({ skill: 1, rank }), bb = bbFor(1, rank);
  const e = enemy(b), side = enemy(b, { x: 8.4 }), atk = u.s.atk;
  cast(b, u); advance(b, .2); assert.equal(u.skill.ammoLeft, 10);
  for (let i = 0; i < 5; i++) { shot(b, u); advance(b, 1.1); }
  assert.equal(u.skill.ammoLeft, 5); assert.equal(outgoing(receipts, u).length, 10);
  assert.equal(skillHud(u.skill).state, 'overloaded'); near(skillHud(u.skill).fraction, 1);
  assert.ok(outgoing(receipts, u).every(r => r.dmg.type === 'phys'));
  receipts.length = 0; shot(b, u); advance(b, 1.1);
  const hits = outgoing(receipts, u); assert.equal(hits.length, 4);
  for (const victim of [e, side]) {
    near(hits.find(r => r.target === victim && r.dmg.type === 'phys').amount, atk * bb['attack@s2.atk_scale']);
    near(hits.find(r => r.target === victim && r.dmg.type === 'arts').amount, atk * bb['attack@s2.magic_atk_scale']);
  }
  near(u.skill.spTotal, 0); assert.equal(u.skill.ammoLeft, 4); near(skillHud(u.skill).fraction, .8);
});
test('S2 melee splashes multiple grounded enemies without ranged travel', () => {
  const { b, u, receipts } = make({ skill: 1 }), e = enemy(b, { x: 5.4 }), side = enemy(b, { x: 5.7 });
  e.blockedBy = u; u.blocking = [e]; cast(b, u); advance(b, .2); shot(b, u); advance(b, .4);
  const hits = outgoing(receipts, u); assert.deepEqual(new Set(hits.map(r => r.target)), new Set([e, side]));
  assert.ok(hits.every(r => r.dmg.isSplash && r.dmg.applyWay === 'ranged'));
});
test('S2 manual stop before overload refunds no ammo and loses no HP', () => {
  const { b, u } = make({ skill: 1 }); cast(b, u); advance(b, .2); const hp = u.hp;
  assert.equal(b.activateOperator(ID), true); assert.equal(u.skill.active, false); near(u.hp, hp);
});
test('S2 overloaded stop without a target only loses current HP and ends', () => {
  const { b, u } = make({ skill: 1 }); cast(b, u); advance(b, .2); u.skill.ammoLeft = 5; u.hp = 1000;
  b.addBuff(u, { key: 'test:immune', flags: { invulnerable: true }, shield: 5000 });
  assert.equal(b.activateOperator(ID), true); near(u.hp, 400); assert.equal(u.skill.active, false);
  assert.equal(u.findBuff('test:immune').shield, 5000);
});
for (const melee of [false, true]) test(`S2 ${melee ? 'melee' : 'ranged'} dump: deferred release, lock, cached physical ATK`, () => {
  const { b, u, receipts } = make({ skill: 1 }), e = enemy(b, { x: melee ? 5.4 : 8 });
  if (melee) { e.blockedBy = u; u.blocking = [e]; }
  cast(b, u); advance(b, .2); u.skill.ammoLeft = 3; u.hp = 1000;
  const atk = u.s.atk, sk = u.skill, bb = sk.bb;
  assert.equal(b.activateOperator(ID), true); assert.equal(sk.active, true); assert.equal(sk.ammoLeft, 3);
  assert.equal(skillHud(sk).canCancel, false); assert.equal(b.activateOperator(ID), false);
  b.addBuff(u, { key: 'test:atk', mods: { atkPct: 1 } });
  advance(b, .2); near(u.hp, 1000); advance(b, 1);
  near(u.hp, 400); assert.equal(sk.active, false);
  const hits = outgoing(receipts, u); assert.equal(hits.length, 6);
  for (const r of hits) near(r.amount, r.dmg.type === 'phys' ? atk * bb['attack@s2.atk_scale'] : u.s.atk * bb['attack@s2.magic_atk_scale']);
  assert.equal(new Set(hits.map(r => r.dmg.attackId)).size, 1);
});
test('S2 dump interruption before release preserves ammunition and permits later cancellation', () => {
  const { b, u, receipts } = make({ skill: 1 }); enemy(b); cast(b, u); advance(b, .2); u.skill.ammoLeft = 4;
  const hp = u.hp; assert.equal(b.activateOperator(ID), true);
  b.applyStatus(u, 'stun', { duration: .2 }); advance(b, .7);
  assert.equal(u.skill.active, true); assert.equal(u.skill.ammoLeft, 4); near(u.hp, hp);
  assert.equal(outgoing(receipts, u).length, 0); assert.equal(skillHud(u.skill).canCancel, true);
  assert.deepEqual(u.mem.regularFormVisual, { clip: 'Skill_2_Idle', loop: true });
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: flat interval, replacement ATK, progressive loss and stop`, () => {
  const { b, u, receipts } = make({ skill: 2, rank }), bb = bbFor(2, rank), aura = .2;
  const interval = u.s.interval; cast(b, u); near(u.s.interval, interval + bb.base_attack_time);
  near(u.s.atk, u.base.atk * (1 + aura + bb.atk));
  near(skillHud(u.skill).fraction, 1); assert.equal(skillHud(u.skill).state, 'active');
  advanceTo(b, 12); assert.equal(u.mem.hornOverloaded, false);
  advance(b, b.dt); assert.equal(u.mem.hornOverloaded, true);
  near(u.s.atk, u.base.atk * (1 + aura + bb['horn_s_3[overload_start].atk']));
  assert.equal(skillHud(u.skill).state, 'overloaded'); assert.ok(skillHud(u.skill).fraction > .99);
  const start = b.time - b.dt, hp = u.hp, max = u.s.maxHp;
  advanceTo(b, start + .6 + b.dt);
  const drain = receipts.filter(r => r.dmg.tags.includes('horn:overload-drain'));
  assert.equal(drain.length, 3);
  for (let i = 0; i < drain.length; i++) near(drain[i].amount, max * .12 * ((i + 1) * .2 / 12) * .2);
  near(u.hp, hp - drain.reduce((n, r) => n + r.amount, 0));
  assert.equal(b.activateOperator(ID), true); advance(b, .5); const stopped = u.hp;
  advance(b, .5); near(u.hp, stopped); near(u.s.atk, u.base.atk * 1.2); near(u.s.interval, interval);
});
for (const potential of [1, 3, 5, 6]) test(`Bloodbath P${potential}: final HP scaler, direct heal, once per deployment`, () => {
  const { b, u } = make({ potential }); const max = u.s.maxHp;
  let healed = 0; b.on('heal', () => healed++);
  b.addBuff(u, { key: 'test:heal-cut', mods: { healTakenMul: .1 } });
  b.dealDamage(null, u, { amount: max * 3, type: 'true' });
  assert.equal(u.alive, true); assert.equal(u.mem.hornReborn, true); near(u.s.maxHp, max * .5); near(u.hp, max * .5);
  near(u.s.aspd, potential >= 5 ? 121 : 118); near(u.s.def, u.base.def * (potential >= 5 ? 1.21 : 1.18));
  assert.equal(healed, 0); b.dealDamage(null, u, { amount: max, type: 'true' }); assert.equal(u.alive, false);
  advance(b, 75); b.addDp('arkpedia', 99); const again = b.deployOperator(ID, 5, 5, 'RIGHT');
  near(again.s.maxHp, max); assert.equal(again.mem.hornReborn, false);
  b.dealDamage(null, again, { amount: max * 2, type: 'true' }); assert.equal(again.alive, true);
});
test('Bloodbath respects heal prohibition, HP loss, Undeadable precedence and E1 unlock', () => {
  const { b, u } = make(); b.addBuff(u, { key: 'test:noheal', flags: { healFree: true } });
  b.addBuff(u, { key: 'test:undead', flags: { undeadable: true } });
  b.loseHp(u, u.s.maxHp * 2); near(u.hp, 1); assert.equal(u.mem.hornReborn, false);
  b.removeBuff(u, 'test:undead'); b.loseHp(u, 3); assert.equal(u.alive, true);
  near(u.hp, 1); assert.equal(u.mem.hornReborn, true);
  const first = make({ elite: 1 }); first.b.dealDamage(null, first.u, { amount: first.u.s.maxHp * 2, type: 'true' });
  assert.equal(first.u.alive, false);
});
test('S3 drain continues under stun, expires on schedule, and restores native intervals/SP', () => {
  const { b, u } = make({ skill: 2 }), interval = u.s.interval;
  cast(b, u); advance(b, 12.5); const hp = u.hp;
  b.applyStatus(u, 'stun', { duration: 15 }); advance(b, 1); assert.ok(u.hp < hp);
  advanceTo(b, 24.1); assert.equal(u.skill.active, false); assert.equal(u.mem.hornOverloaded, false);
  near(u.s.interval, interval); near(u.s.atk, u.base.atk * 1.2);
  const stopped = u.hp; advance(b, 1); near(u.hp, stopped); assert.ok(u.skill.spTotal > 0);
});
test('native capped hit events cancel under brief control and fired shells survive retirement', () => {
  const { b, u, receipts } = make(); enemy(b);
  b.addBuff(u, { key: 'test:aspd', mods: { aspd: 100 } }); shot(b, u);
  advance(b, .2); assert.equal(outgoing(receipts, u).length, 0);
  b.applyStatus(u, 'stun', { duration: .1 }); advance(b, 1); assert.equal(outgoing(receipts, u).length, 0);
  shot(b, u); advance(b, .35); assert.equal(outgoing(receipts, u).length, 0);
  assert.equal(b.projectiles.list.length, 1); b.retreatOperator(ID); advance(b, 1);
  assert.equal(outgoing(receipts, u).length, 1);
});
test('retirement cancels an unfired attack/dump and all source-owned drain/aura', () => {
  const { b, u, receipts } = make({ skill: 1 }); enemy(b); cast(b, u); advance(b, .2); u.skill.ammoLeft = 5;
  b.activateOperator(ID); b.retreatOperator(ID); advance(b, 2);
  assert.equal(outgoing(receipts, u).length, 0); assert.equal(u.mem.hornDump, null);
  assert.equal(u.mem.regularFormVisual, null); assert.equal(u.findBuff('horn:defenders'), null);
});
