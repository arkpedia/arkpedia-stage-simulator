// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { TRAGODIA_CORE_CONTRACT as CONTRACT, prepareTragodiaCore } from '../server/sim/content/arkpedia-tragodia.js';

import { TRAGODIA_ID as ID, selectedTragodiaBuild } from '../server/sim/content/arkpedia-tragodia-source.js';

const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, condition, seconds = 12) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 1, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_phatm2_${skill}` };
  const r = selectedTragodiaBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareTragodiaCore(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, res = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const arts = f => f.hits.filter(h => h.type === 'arts');
const injury = (f, tag) => f.hits.filter(h => h.type === 'element' && (!tag || h.dmg.tags.includes(`tragodia:${tag}`)));
const disarmOwner = f => f.b.addBuff(f.u, { key: 'fixture:owner-pin', flags: { disarm: true } });
function attackContext(f, t, change = {}) {
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, unblockable: true } });
  return { attacker: t, targets: [f.u], isSkill: false, profile: {}, ...change };
}

test('owner contract rejects wrong identity, altered selections and duplicate installation', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed core contract/);
  for (const mutate of [d => d.charId = 'unknown', d => d.stats.atk++, d => d.skill.bb.atk = 1,
    d => d.skill.spCost++, d => d.skill.initSp++, d => d.skill.duration++, d => d.skill.spType = 'hurt',
    d => d.tags.push('fictional'), d => d.rangeGrid = [[0, 99]],
    d => d.talents[0].bb.ep_damage_ratio = 99, d => d.raw.arkpedia.skillId = 'other'])
    assert.throws(() => make({ mutate }));
  const f = make({ defer: true });
  assert.throws(() => prepareTragodiaCore(f.b, f.u, { contract: CONTRACT }), /fresh original owner/);
  assert.throws(() => f.controller.install(), /installed twice/);
  f.controller.stop(); assert.throws(() => f.controller.install(), /retirement/);
});

for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
  test(`owner S${skill} rank ${rank} selection retains ordinary attacks without enabling incomplete skills`, () => {
    const f = make({ skill, rank }), t = enemy(f);
    const initial = f.u.skill.sp;
    until(f, () => arts(f).length === 1);
    assert.equal(arts(f)[0].target, t); near(t.elem.neural, f.u.s.atk * .3);
    if (skill === 1) assert.equal(f.u.skill.sp, Math.min(f.u.skill.spCost, initial + 1));
    else assert.ok(f.u.skill.sp > initial || f.u.skill.sp === f.u.skill.spCost);
    assert.equal(f.u.skill.activate('manual'), false);
    assert.equal(f.u.skill.active, false);
    assert.equal(f.b.regularSummons?.has(`summon:${ID}`) ?? false, false);
  });
}

test('normal strike hits only one retained enemy and adds separate main/splash Nervous', () => {
  const f = make(), a = enemy(f, { res: 80 }), z = enemy(f, { col: 6.2, res: 80 });
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, t = p.target, other = t === a ? z : a;
  near(p.releaseAt - p.startedAt, .5); assert.equal(f.hits.length, 0);
  until(f, () => arts(f).length === 1);
  near(arts(f)[0].hpLoss, f.u.s.atk * .2); assert.equal(arts(f)[0].target, t);
  near(t.elem.neural, f.u.s.atk * .3); near(other.elem.neural, f.u.s.atk * .2);
  assert.equal(injury(f, 'primary-injury').length, 1); assert.equal(injury(f, 'splash-injury').length, 1);
  assert.equal(arts(f)[0].dmg.isSplash, false); assert.equal(injury(f, 'splash-injury')[0].dmg.isSplash, true);
  assert.equal(f.attacks.length, 1); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(f.controller.release(t, {}), false);
});

test('splash is centred on the selected enemy, excludes it and uses centre distance for large bodies', () => {
  const f = make(), t = enemy(f), inside = enemy(f, { col: 7.3 }), outside = enemy(f, { col: 7.301 });
  outside.hitArea = { w: 4, h: 4, dx: 0, dy: 0 };
  // Hold ordinary selection fixed; the splash recipients still use the live shared query.
  f.controller.targets = () => [t];
  until(f, () => arts(f).length === 1);
  near(t.elem.neural, f.u.s.atk * .3); near(inside.elem.neural, f.u.s.atk * .2);
  assert.equal(outside.elem.neural, 0); assert.equal(injury(f, 'splash-injury').some(h => h.target === t), false);
});

test('promotion, trust and potentials feed actual normal and splash amounts', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 6]) {
    const f = make({ elite, potential, trust: 200 }), t = enemy(f), z = enemy(f, { col: 6.2 });
    f.controller.targets = () => [t]; until(f, () => arts(f).length === 1);
    near(arts(f)[0].hpLoss, f.u.s.atk);
    near(t.elem.neural, f.u.s.atk * (potential >= 3 ? [.23, .28, .33][elite] : [.2, .25, .3][elite]));
    near(z.elem.neural, f.u.s.atk * (potential >= 3 ? [.13, .18, .23][elite] : [.1, .15, .2][elite]));
  }
});

test('ground/flying ordinary targets and all four source facings retain their legal ranges', () => {
  for (const fly of [false, true]) for (const [dir, row, col, face] of [
    ['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'], ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ dir }), t = enemy(f, { row, col, fly });
    until(f, () => arts(f).length === 1); assert.equal(arts(f)[0].target, t);
    assert.equal(f.controller.model(), e.models[ID][face]);
    assert.equal(f.u.mem.regularVisualDirection, face === 'Front' ? 'RIGHT' : 'UP');
  }
});

test('sleep/stealth/camouflage ordinary inputs are excluded while splash ignores camouflage only', () => {
  const f = make(); const stealthed = enemy(f, { flags: { stealth: true } });
  const originalCamou = enemy(f, { flags: { camou: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  advance(f.b, 4); assert.equal(f.hits.length, 0);
  const t = enemy(f), camou = enemy(f, { col: 6.1, flags: { camou: true } });
  f.controller.targets = () => [t]; until(f, () => arts(f).length === 1);
  near(camou.elem.neural, f.u.s.atk * .2); assert.equal(sleeping.elem.neural, 0);
  assert.equal(stealthed.elem.neural, 0); near(originalCamou.elem.neural, f.u.s.atk * .2);
  assert.equal(injury(f, 'splash-injury').length, 2);
});

test('ordinary clock caps playback but fast attacks replace clips before full clip completion', () => {
  for (const [aspd, speed] of [[200, 1], [-50, .5]]) {
    const f = make(); enemy(f); f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase; near(f.u.mem.regularFormVisual.speed, speed);
    near(p.releaseAt - p.startedAt, .5 / speed);
    near(p.readyAt - p.startedAt, Math.max(.5 / speed, f.u.s.interval));
    until(f, () => arts(f).length === 2);
    if (speed === 1) assert.ok(arts(f)[1].time - arts(f)[0].time < 1);
  }
});

test('control, disarm and hidden source cancel a pending release without a ghost rider', () => {
  for (const flag of ['stun', 'disarm', 'hidden']) {
    const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    if (flag === 'hidden') f.u.hidden = true;
    else if (flag === 'stun') f.b.applyStatus(f.u, 'stun', { duration: .05 });
    else f.b.addBuff(f.u, { key: 'fixture:control', flags: { disarm: true } });
    advance(f.b, .1); assert.notEqual(f.controller.phase, p);
    while (f.b.time <= p.releaseAt + .05) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
    f.u.hidden = false; f.b.removeBuff(f.u, 'fixture:control');
    until(f, () => arts(f).length === 1);
  }
});

test('stale target life and unsolicited attacks cannot hit a replacement or spend attack SP', () => {
  const f = make({ skill: 1, rank: 1 }), t = enemy(f); const sp = f.u.skill.sp;
  f.b.forceAttack(f.u, [t]); assert.equal(f.hits.length, 0); assert.equal(f.u.skill.sp, sp);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase; t.deploySeq++; enemy(f, { col: 6.1 });
  while (f.b.time <= p.releaseAt + .05) advance(f.b, f.b.dt);
  assert.equal(f.hits.length, 0); assert.equal(f.u.skill.sp, sp);
});

test('release rechecks changed target selectability without retargeting', () => {
  for (const flag of ['sleep', 'stealth', 'camou']) {
    const f = make(), t = enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    if (flag === 'sleep') f.b.applyStatus(t, 'sleep', { duration: 99 });
    else f.b.addBuff(t, { key: 'fixture:changed', flags: { [flag]: true } });
    enemy(f, { col: 6.1 });
    while (f.b.time <= p.releaseAt + .05) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
  }
});

test('Nervous riders are ATK-based through shields, but rejected or dodged Arts receipts do not commit them', () => {
  for (const kind of ['shield', 'dodge', 'cancel']) {
    const f = make(), t = enemy(f), z = enemy(f, { col: 6.2 }); f.controller.targets = () => [t];
    if (kind === 'shield') f.b.addBuff(t, { key: 'fixture:shield', shield: 10000 });
    else if (kind === 'dodge') f.b.addBuff(t, { key: 'fixture:dodge', mods: { dodgeArts: 1 } });
    else f.b.on('hit', ctx => { if (ctx.source === f.u && ctx.dmg.type === 'arts') ctx.dmg.cancel = true; });
    until(f, () => f.attacks.length === 1);
    if (kind === 'shield') { near(t.elem.neural, f.u.s.atk * .3); near(z.elem.neural, f.u.s.atk * .2); }
    else { assert.equal(t.elem.neural, 0); assert.equal(z.elem.neural, 0); }
  }
});

test('fatal primary skips corpse injury but retains committed surrounding buildup', () => {
  const f = make(), t = enemy(f, { hp: 1 }), z = enemy(f, { col: 6.2 }); f.controller.targets = () => [t];
  until(f, () => arts(f).length === 1);
  assert.equal(t.alive, false); assert.equal(t.elem.neural, 0); near(z.elem.neural, f.u.s.atk * .2);
});

test('reentrant retirement during pre-attack or Arts output stops remaining source-owned output', () => {
  for (const event of ['beforeAttack', 'damaged']) {
    const f = make(), t = enemy(f), z = enemy(f, { col: 6.1 });
    f.b.on(event, ctx => { if (ctx.attacker === f.u || ctx.source === f.u) f.b.retreat(f.u); });
    advance(f.b, 3);
    assert.equal(f.controller.stopped, true); assert.equal(t.elem.neural, 0); assert.equal(z.elem.neural, 0);
    assert.equal(arts(f).length, event === 'beforeAttack' ? 0 : 1);
  }
});

test('Nervous buildup bursts once with shared 6000 elemental damage and three palsy stacks', () => {
  const f = make(), t = enemy(f); t.elem.neural = 990;
  until(f, () => t.findBuff('neuralBurst'));
  assert.equal(f.hits.filter(h => h.type === 'elemental' && h.dmg.tags.includes('burst')).length, 0);
  // Burst damage is sourceless, credited to the producer rather than hook-visible source.
  assert.equal(t.findBuff('palsy').stacks, 3); near(t.s.aspd, 88);
  near(t.hp, 1e7 - f.u.s.atk - 6000); assert.equal(t.elem.neural, 1000);
  disarmOwner(f); advance(f.b, 11);
  assert.equal(t.elem.neural, 0); assert.equal(t.findBuff('neuralBurst'), null);
  assert.equal(t.findBuff(f.controller.auraKey()), null); near(t.s.aspd, 100);
});

test('E2 fixed injury uses one normal enemy pre-attack receipt, not attack targets or skill requests', () => {
  for (const potential of [1, 5]) {
    const f = make({ potential }); disarmOwner(f); const t = enemy(f);
    const ctx = attackContext(f, t); f.b.emit('beforeAttack', ctx); f.controller.beforeEnemyAttack(ctx);
    assert.equal(t.elem.neural, 70); assert.equal(f.u.elem.neural, 0);
    const skill = { ...ctx, isSkill: true }; f.b.emit('beforeAttack', skill); assert.equal(t.elem.neural, 70);
    const immune = { ...ctx, profile: { ignorePalsyInterrupt: true } }; f.b.emit('beforeAttack', immune);
    assert.equal(t.elem.neural, 70);
  }
});

test('E2 pre-attack aura ignores TargetFree flags but stops immediately on leaving actual attack range', () => {
  const f = make(); disarmOwner(f); const t = enemy(f);
  const ctx = attackContext(f, t); f.b.addBuff(t, { key: 'fixture:free', flags: { stealth: true, camou: true, untargetable: true } });
  f.b.emit('beforeAttack', ctx); assert.equal(t.elem.neural, 70);
  t.x = 13; f.b.emit('beforeAttack', { ...ctx }); assert.equal(t.elem.neural, 70);
  t.x = 6; f.b.emit('beforeAttack', { ...ctx }); assert.equal(t.elem.neural, 140);
  f.u.hidden = true; f.b.emit('beforeAttack', { ...ctx }); assert.equal(t.elem.neural, 140);
});

test('E0/E1 have no E2 pre-attack talent or global ASPD modifier', () => {
  for (const elite of [0, 1]) {
    const f = make({ elite }); disarmOwner(f); const t = enemy(f), ctx = attackContext(f, t);
    f.b.emit('beforeAttack', ctx); assert.equal(t.elem.neural, 0);
    f.b.dealDamage(f.u, t, { amount: 1000, type: 'element', element: 'neural' });
    assert.equal(t.findBuff(f.controller.auraKey()), null); near(t.s.aspd, 100);
  }
});

test('global burst ASPD is source-owned, applies outside range and removes without disturbing foreign modifiers', () => {
  const f = make({ potential: 5 }); disarmOwner(f); const t = enemy(f, { col: 14, flags: { stealth: true } });
  f.b.addBuff(t, { key: 'fixture:other', mods: { aspd: -7 } });
  f.b.dealDamage(f.u, t, { amount: 1000, type: 'element', element: 'neural' });
  near(t.s.aspd, 77); assert.equal(f.controller.auraEntries.size, 1);
  f.b.removeBuff(t, 'neuralBurst'); advance(f.b, f.b.dt);
  near(t.s.aspd, 93); assert.ok(t.findBuff('fixture:other')); assert.equal(f.controller.auraEntries.size, 0);
});

test('entering after an existing burst applies the selected global reduction and hidden owner removes it', () => {
  const f = make({ defer: true }); const t = enemy(f, { col: 14 });
  f.b.dealDamage(null, t, { amount: 1000, type: 'element', element: 'neural' });
  near(t.s.aspd, 100); f.deploy(); near(t.s.aspd, 88);
  f.u.hidden = true; advance(f.b, f.b.dt); near(t.s.aspd, 100);
  f.u.hidden = false; advance(f.b, f.b.dt); near(t.s.aspd, 88);
  f.b.retreat(f.u); near(t.s.aspd, 100); assert.equal(f.controller.auraEntries.size, 0);
});

test('source life replacement, recipient death and battle end clean up owned reductions', () => {
  for (const cause of ['source-life', 'target-death', 'battle-end']) {
    const f = make(); disarmOwner(f); const t = enemy(f, { col: 14 });
    f.b.dealDamage(f.u, t, { amount: 1000, type: 'element', element: 'neural' });
    assert.ok(t.findBuff(f.controller.auraKey()));
    if (cause === 'source-life') { f.u.deploySeq++; advance(f.b, f.b.dt); }
    else if (cause === 'target-death') f.b.kill(t, f.u);
    else f.b._finish('forced');
    assert.equal(f.controller.auraEntries.size, 0); assert.equal(t.findBuff(f.controller.auraKey()), null);
    if (cause !== 'target-death') assert.equal(f.controller.stopped, true);
  }
});

test('reentrant modifier rejection and source retirement cannot leave or create a late global buff', () => {
  for (const kind of ['cancel', 'retire']) {
    const f = make(); disarmOwner(f); const a = enemy(f, { col: 14 }), z = enemy(f, { col: 15 });
    f.b.addBuff(a, { key: 'neuralBurst', flags: { burstLock: true } });
    f.b.addBuff(z, { key: 'neuralBurst', flags: { burstLock: true } });
    const h = f.b.on('beforeBuff', ctx => {
      if (ctx.buff.key !== f.controller.auraKey()) return;
      if (kind === 'cancel') ctx.cancel = true; else f.b.retreat(f.u);
    });
    f.controller.refreshAuras(); f.b.off(h);
    assert.equal(a.findBuff(f.controller.auraKey()), null); assert.equal(z.findBuff(f.controller.auraKey()), null);
    assert.equal(f.controller.auraEntries.size, 0);
    if (kind === 'cancel') { f.controller.refreshAuras(); near(a.s.aspd, 88); near(z.s.aspd, 88); }
    else assert.equal(f.controller.stopped, true);
  }
});

test('actual enemy normal attacks trigger fixed Nervous, while existing palsy cancellations do not', () => {
  const f = make(); disarmOwner(f); const t = enemy(f);
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, unblockable: true } });
  Object.assign(t.base, { atk: 1, rangeRadius: 2 }); t.markDirty();
  t.profile = { ...t.profile, noAttack: false, melee: false, dmgType: 'phys' }; t.atkCd = 0;
  f.b.applyStatus(t, 'palsy', { value: 2, source: f.u });
  until(f, () => !t.findBuff('palsy'));
  assert.equal(t.stats.attacks, 0); assert.equal(t.elem.neural, 0);
  until(f, () => t.stats.attacks === 1);
  assert.equal(t.elem.neural, 70); assert.equal(injury(f, 'enemy-attack-injury').length, 1);
});

test('a burst born at actual pre-attack leaves the committed attack and interrupts later attacks', () => {
  const f = make(); disarmOwner(f); const t = enemy(f);
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, unblockable: true } });
  Object.assign(t.base, { atk: 1, rangeRadius: 2 }); t.markDirty();
  t.profile = { ...t.profile, noAttack: false, melee: false, dmgType: 'phys' }; t.atkCd = 0;
  t.elem.neural = 990; until(f, () => t.findBuff('neuralBurst'));
  assert.equal(t.stats.attacks, 1); assert.equal(t.findBuff('palsy').stacks, 3);
  until(f, () => t.findBuff('palsy')?.stacks === 2);
  assert.equal(t.stats.attacks, 1); assert.equal(injury(f, 'enemy-attack-injury').length, 1);
});

test('temporary strike multipliers and damage-dealt multipliers do not inflate ATK-based Nervous ratios', () => {
  const f = make(), t = enemy(f), z = enemy(f, { col: 6.2 }); f.controller.targets = () => [t];
  f.b.addBuff(f.u, { key: 'fixture:multipliers', mods: { atkScaleMul: 2, artsDealtMul: 2 } });
  until(f, () => arts(f).length === 1);
  near(arts(f)[0].hpLoss, f.u.s.atk * 4); near(t.elem.neural, f.u.s.atk * .3);
  near(z.elem.neural, f.u.s.atk * .2);
});

test('an enemy life replaced during primary output receives no old-life injury', () => {
  const f = make(), t = enemy(f), z = enemy(f, { col: 6.2 }); f.controller.targets = () => [t];
  f.b.on('damaged', ctx => { if (ctx.target === t && ctx.type === 'arts') t.deploySeq++; });
  until(f, () => arts(f).length === 1);
  assert.equal(t.elem.neural, 0); near(z.elem.neural, f.u.s.atk * .2);
});

test('ordinary targeting still attacks its own blocked victim outside the directional range', () => {
  const f = make(), t = enemy(f, { col: 4 });
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  t.blockedBy = f.u; f.u.blocking.push(t);
  until(f, () => arts(f).length === 1); assert.equal(arts(f)[0].target, t);
  near(t.elem.neural, f.u.s.atk * .3);
});

test('passive talents remain active under owner stun/silence but unrelated element bursts receive no reduction', () => {
  const f = make(); disarmOwner(f); const t = enemy(f), ctx = attackContext(f, t);
  f.b.applyStatus(f.u, 'stun', { duration: 99 }); f.b.applyStatus(f.u, 'silence', { duration: 99 });
  f.b.emit('beforeAttack', ctx); assert.equal(t.elem.neural, 70);
  f.b.dealDamage(f.u, t, { amount: 1000, type: 'element', element: 'apoptosis' });
  assert.equal(t.findBuff(f.controller.auraKey()), null); near(t.s.aspd, 100);
  f.b.removeBuff(t, 'apoptosisBurst');
  f.b.dealDamage(f.u, t, { amount: 1000, type: 'element', element: 'neural' });
  near(t.s.aspd, 88);
});

test('recipient replacement during a primary or aura callback cannot retain stale source-owned effects', () => {
  const f = make(), t = enemy(f), z = enemy(f, { col: 6.2 }); f.controller.targets = () => [t];
  f.b.on('damaged', ctx => { if (ctx.target === t && ctx.type === 'arts') z.deploySeq++; });
  until(f, () => arts(f).length === 1); assert.equal(z.elem.neural, 0);
  disarmOwner(f);
  const h = f.b.on('beforeBuff', ctx => { if (ctx.buff.key === f.controller.auraKey()) ctx.unit.deploySeq++; });
  f.b.dealDamage(f.u, z, { amount: 1000, type: 'element', element: 'neural' }); f.b.off(h);
  assert.equal(z.findBuff(f.controller.auraKey()), null); assert.equal(f.controller.auraEntries.size, 0);
});
