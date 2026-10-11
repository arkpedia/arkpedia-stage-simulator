// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-typhon-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_2012_typhon';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a - z) < tol, `${a} != ${z}`);
function advance(b, seconds) { const end = b.time + seconds; while (b.time < end - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] }, { seed: 1 });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' })); b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; u.profile.canAttack = () => false;
  advance(b, 1.1); return { b, u, receipts };
}
function enemy(b, { x = 7, y = 5, fly = false, hp = 100000, def = 0, weight = 1 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def, moveSpeed: 0, massLevel: weight }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), true); }
function shot(b, u) { const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  assert.ok(targets.length); performAttack(b, u, p, targets); u.atkCd = 1000; }
const outgoing = rs => rs.filter(r => r.target.side === 'enemy');
const bbFor = (skill, rank) => Object.fromEntries(Object.values(source.tables.skills)[skill].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
test('source retains all ranks, original facing chains, native mark radius and delayed rain', () => {
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 15);
  for (const face of ['Front', 'Back']) {
    const m = source.models[ID][face]; assert.equal(m.sha256, source.officialSkeletonBindings[ID][face].sha256);
    near(m.hits.Attack_Loop[0], .033); near(m.durations.Skill_3_Begin, 1);
    near(m.hits.Skill_3_Loop[0], .033); assert.ok(m.durations.Skill_2_2_Begin > 0);
  }
  assert.equal(source.frameParity, false); assert.equal(source.nativeParticleSupport, false);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: source ATK/ASPD, physical flight, duration and SP lock`, () => {
  const { b, u, receipts } = make({ rank }), e = enemy(b, { fly: true }), bb = bbFor(0, rank);
  cast(b, u); near(u.s.atk, u.base.atk * (1 + bb.atk)); near(u.s.aspd, 100 + bb.attack_speed);
  assert.equal(u.skill.active, true); near(u.skill.timeLeft, 35); shot(b, u);
  advance(b, .15); assert.equal(outgoing(receipts).length, 0);
  advance(b, .4); assert.equal(outgoing(receipts).length, 1); near(e.s.maxHp - e.hp, u.s.atk * 1.6);
  near(u.skill.spTotal, 0); advance(b, 35); assert.equal(u.skill.active, false); near(u.s.atk, u.base.atk);
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: distinct-target arrows, single-target fallback and second-use permanence`, () => {
  const { b, u, receipts } = make({ skill: 1, rank }), e = enemy(b), f = enemy(b, { x: 7.2, fly: true }), bb = bbFor(1, rank);
  cast(b, u); near(u.s.atk, u.base.atk * (1 + bb.atk)); shot(b, u); advance(b, .7);
  const hits = outgoing(receipts); assert.equal(hits.length, 2); assert.equal(new Set(hits.map(v => v.target)).size, 2);
  for (const h of hits) near(h.amount, u.s.atk * 1.6);
  advance(b, bb.first_duration); assert.equal(u.skill.active, false);
  cast(b, u); assert.equal(u.skill.timeLeft, Infinity); assert.equal(skillHud(u.skill).text, 'Skill active');
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_2_Begin');
  b.kill(f); advance(b, .75); const before = outgoing(receipts).length; shot(b, u); advance(b, .5);
  const same = outgoing(receipts).slice(before); assert.equal(same.length, 2); assert.ok(same.every(h => h.target === e));
  near(same[0].amount, u.s.atk * 1.6); near(same[1].amount, u.s.atk);
  advance(b, 30); assert.equal(u.skill.active, true); near(u.skill.spTotal, 0);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: mark, random retained hits, native delay, ammo and cancellation`, () => {
  const { b, u, receipts } = make({ skill: 2, rank }), e = enemy(b), bb = bbFor(2, rank);
  cast(b, u); near(u.s.interval, u.base.bat + bb.base_attack_time);
  assert.equal(u.skill.ammoLeft, bb['attack@s3_trigger_time']); assert.equal(skillHud(u.skill).canCancel, true);
  advance(b, 1.1); shot(b, u); advance(b, .08); near(u.skill.ammoLeft, bb['attack@s3_trigger_time'] - 1);
  advance(b, .15); assert.equal(outgoing(receipts).length, 0); advance(b, .8);
  const hits = outgoing(receipts); assert.equal(hits.length, bb['attack@s3_max_hit_num']);
  near(hits[0].amount, u.s.atk * bb['attack@s3_atk_scale'] * 1.6);
  for (const h of hits.slice(1)) near(h.amount, u.s.atk * bb['attack@s3_atk_scale']);
  assert.ok(hits.every(h => h.target === e && h.dmg.applyWay === 'none'));
  assert.equal(b.activateOperator(ID), true); assert.equal(u.skill.active, false);
  assert.equal(u.mem.typhonMark, null); assert.equal(e.buffs.some(v => v.key.startsWith('typhon:mark:')), false);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_3_End'); advance(b, 1); assert.equal(u.mem.regularFormVisual, null);
});
test('S3 requires a selectable initial target and preserves ready SP when none exists', () => {
  const { b, u } = make({ skill: 2 }); u.skill.setSpTotal(u.skill.spCost);
  assert.equal(skillHud(u.skill).ready, true); assert.equal(skillHud(u.skill).canActivate, false);
  assert.equal(b.activateOperator(ID), false); near(u.skill.spTotal, u.skill.spCost);
  const e = enemy(b); b.addBuff(e, { key: 'test:stealth', flags: { stealth: true } });
  assert.equal(b.activateOperator(ID), false); b.removeBuff(e, 'test:stealth'); assert.equal(b.activateOperator(ID), true);
});
test('normal attacks prefer the heaviest eligible enemy and include flyers', () => {
  const { b, u, receipts } = make(), light = enemy(b, { weight: 1 }), heavy = enemy(b, { x: 7.3, weight: 5, fly: true });
  shot(b, u); advance(b, .6); assert.equal(outgoing(receipts)[0].target, heavy); near(light.hp, light.s.maxHp);
});
for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) test(`original ${dir} opening and down-facing attack roles`, () => {
  const { b, u, receipts } = make({ skill: 1, dir });
  const positions = { UP: [5, 7], RIGHT: [7, 5], DOWN: [5, 3], LEFT: [3, 5] };
  const [x, y] = positions[dir]; enemy(b, { x, y }); cast(b, u); shot(b, u);
  const p = effectiveProfile(u), vis = p.attackVisual(b, u);
  // Release has not run yet, so the first attack retains its Begin binding.
  assert.equal(vis.begin, dir === 'DOWN' ? 'Skill_Down_2_1_Begin' : 'Skill_2_1_Begin');
  advance(b, .7); assert.equal(outgoing(receipts).length, 2);
});
for (const elite of [0, 1, 2]) test(`E${elite} talent penetration accumulates before mitigation and times out`, () => {
  const { b, u, receipts } = make({ elite }), e = enemy(b, { def: 1000 });
  const step = [0, .05, .1][elite], cap = [0, 8, 5][elite], duration = [0, 3, 8][elite];
  for (let i = 0; i < 9; i++) { shot(b, u); advance(b, .6);
    const h = outgoing(receipts).at(-1); near(h.dmg.defIgnorePct, Math.min(i + 1, cap) * step); }
  advance(b, duration + .1); shot(b, u); advance(b, .6); near(outgoing(receipts).at(-1).dmg.defIgnorePct, step);
});
for (const potential of [1, 5]) test(`P${potential} first skill hit bonus is per victim and per activation`, () => {
  const { b, u, receipts } = make({ potential }), e = enemy(b), f = enemy(b, { x: 7.2 });
  cast(b, u); shot(b, u); advance(b, .6); near(outgoing(receipts)[0].amount, u.s.atk * (potential === 5 ? 1.7 : 1.6));
  near(e.s.moveSpeed, 0); assert.ok(e.buffs.some(v => v.status === 'sluggish'));
  shot(b, u); advance(b, .6); near(outgoing(receipts)[1].amount, u.s.atk);
  b.kill(e); shot(b, u); advance(b, .6); near(outgoing(receipts).at(-1).amount, u.s.atk * (potential === 5 ? 1.7 : 1.6));
  u.skill.end('test'); cast(b, u); shot(b, u); advance(b, .6); near(outgoing(receipts).at(-1).amount, u.s.atk * (potential === 5 ? 1.7 : 1.6));
  assert.equal(outgoing(receipts).at(-1).target, f);
});
test('mark follows the original victim beyond base range and freezes at its last position after death', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, 1.1);
  e.x = 12; e.y = 10; b._buildEnemyIndex(); advance(b, .25); assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], e);
  const f = enemy(b, { x: 12.5, y: 10, fly: true }), out = enemy(b, { x: 14, y: 10 });
  advance(b, .25); b.kill(e); shot(b, u); advance(b, 1);
  assert.ok(outgoing(receipts).length); assert.ok(outgoing(receipts).every(h => h.target === f)); near(out.hp, out.s.maxHp);
  near(u.mem.typhonMark.x, 12); near(u.mem.typhonMark.y, 10);
});
test('rain reselects each period, delayed recipient remains fixed when leaving mark', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b, { weight: 9 });
  const e = enemy(b, { x: 7.2 }); b.rng = () => .99; cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); const f = enemy(b, { x: 7.4 });
  e.x = 10; e.y = 5; b._buildEnemyIndex(); advance(b, .24);
  assert.equal(outgoing(receipts)[0].target, e); assert.ok(outgoing(receipts)[0].time > 0);
  advance(b, .8); assert.ok(outgoing(receipts).some(h => h.target === f));
});
test('source retirement stops unselected rain, while already emitted target buffs still finish', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); b.retreatOperator(ID); advance(b, .8);
  assert.equal(outgoing(receipts).length, 1); assert.equal(u.mem.typhonMark, null);
});
test('manual cancellation retains emitted delayed impacts and stops the mark', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); assert.equal(b.activateOperator(ID), true); advance(b, .8);
  assert.equal(outgoing(receipts).length, 1); assert.equal(u.skill.active, false); assert.ok(u.skill.spTotal > 0);
});
test('stun cancels an unreleased arrow without spending ammunition; released rain proceeds under control', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advance(b, 1.1); const ammo = u.skill.ammoLeft;
  shot(b, u); b.applyStatus(u, 'stun', { duration: .2 }); advance(b, .3);
  assert.equal(outgoing(receipts).length, 0); near(u.skill.ammoLeft, ammo);
  shot(b, u); advance(b, .08); b.applyStatus(u, 'stun', { duration: 1 }); advance(b, .8);
  assert.equal(outgoing(receipts).length, 5); near(u.skill.ammoLeft, ammo - 1);
});
test('last ammo keeps its delayed damage before ending and SP recovery resumes after completion', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advance(b, 1.1); u.skill.ammoLeft = 1;
  shot(b, u); advance(b, .08); assert.equal(u.skill.active, true); near(u.skill.ammoLeft, 0);
  advance(b, .7); assert.equal(outgoing(receipts).length, 5); near(u.skill.spTotal, 0);
  advance(b, .3); assert.equal(u.skill.active, false); advance(b, 1); assert.ok(u.skill.spTotal > 0);
});
test('redeployment resets S2 use counter, talent stacks and first-hit marks', () => {
  const { b, u } = make({ skill: 1 }); enemy(b); cast(b, u); u.skill.end('test'); cast(b, u);
  assert.equal(u.skill.timeLeft, Infinity); b.retreatOperator(ID); advance(b, 80); b.addDp('arkpedia', 99);
  const next = b.deployOperator(ID, 5, 5, 'RIGHT'); next.profile.canAttack = () => false;
  assert.equal(next.mem.typhonS2Uses, 0); cast(b, next); near(next.skill.timeLeft, 20);
});
for (const finish of ['expiry', 'retreat', 'death']) test(`first-hit derived slow clears on ${finish} without erasing another producer`, () => {
  const { b, u } = make(), e = enemy(b); e.base.moveSpeed = 1; e.markDirty();
  b.applyStatus(e, 'sluggish', { key: 'test:other-slow', duration: 20 });
  cast(b, u); shot(b, u); advance(b, .6);
  near(e.s.moveSpeed, .2); assert.ok(e.findBuff(`typhon:first-slow:${u.id}`));
  if (finish === 'expiry') u.skill.end('time');
  else if (finish === 'retreat') b.retreatOperator(ID);
  else b.kill(u);
  assert.equal(e.findBuff(`typhon:first-slow:${u.id}`), null);
  assert.ok(e.findBuff('test:other-slow')); near(e.s.moveSpeed, .2);
});
for (const flag of ['stealth', 'untargetable']) test(`retained rain callback reaches a recipient that gains ${flag} after selection`, () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); b.addBuff(e, { key: 'test:conceal', flags: { [flag]: true } }); advance(b, .8);
  assert.equal(outgoing(receipts).length, 1); assert.equal(outgoing(receipts)[0].target, e);
  assert.equal(outgoing(receipts)[0].dmg.ignoreSelect, true);
});
test('a dead retained rain recipient receives no delayed damage or new stun', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); b.kill(e); advance(b, .8); assert.equal(outgoing(receipts).length, 0);
});
test('invulnerability blocks retained damage while the separate stun action still runs', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, 1.1); shot(b, u);
  advance(b, .08); b.addBuff(e, { key: 'test:invulnerable', flags: { invulnerable: true } }); advance(b, .24);
  assert.equal(outgoing(receipts).length, 0); assert.equal(e.s.flags.stun, true);
});
test('automatic S3 attack loop spends one ammo per volley at the selected 5.5-second interval', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u);
  delete u.profile.canAttack; u.atkCd = 0; advance(b, 7.5);
  assert.equal(outgoing(receipts).length, 10); assert.equal(u.skill.ammoLeft, 8);
  near(outgoing(receipts)[5].time - outgoing(receipts)[0].time, 5.5, b.dt + 1e-8);
});
test('S2 stun rolls independently for each arrow and honors immunity', () => {
  const { b, u, receipts } = make({ skill: 1 }), e = enemy(b), f = enemy(b, { x: 7.2 });
  f.def = { ...f.def, immune: new Set([...f.def.immune, 'stun']) };
  b.rng = () => 0; cast(b, u); shot(b, u); advance(b, .55);
  assert.equal(outgoing(receipts).length, 2); assert.equal(e.s.flags.stun, true); assert.equal(f.s.flags.stun, false);
});
test('a mark from another Typhon cannot trigger own acquisition but can join a released rain selector', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); advance(b, 1.1);
  const f = enemy(b, { x: 13, y: 10 }); b.addBuff(f, { key: 'typhon:mark:other', duration: 5 });
  assert.equal(acquireTargets(b, u, effectiveProfile(u))[0], e);
  b.rng = () => .99; shot(b, u); advance(b, 1);
  assert.equal(outgoing(receipts).length, 5); assert.ok(outgoing(receipts).every(h => h.target === f));
  u.skill.end('test'); assert.ok(f.findBuff('typhon:mark:other'));
});
